import { apiClient } from "./client";
import { getCartItems, sellCartItems } from "./cart";
import { useAuthStore } from "@/store/auth.store";

export type WithdrawalStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface WithdrawalRequest {
  id: string;
  intentId: string;
  amount: string;
  destinationAddress: string;
  status: WithdrawalStatus;
  requestedAt?: string;
  confirmedAt?: string | null;
  processedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, any> | null;
  error?: string | null;
}

/** Must match the "Transaction Fee" shown in the withdraw window */
const TRANSACTION_FEE = 0.5;

import { withdrawalCoin, validWithdrawalAddress } from "@/lib/withdrawal-coins";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Backend status words -> the statuses the pages know */
function mapStatus(raw: unknown): WithdrawalStatus {
  const s = String(raw ?? "").toLowerCase();
  if (s === "pending") return "PENDING";
  if (["rejected", "failed", "cancelled", "canceled", "declined"].includes(s)) return "FAILED";
  return "COMPLETED";
}

function getErrorMessage(error: any, fallback: string): string {
  const messages: Record<string, string> = {
    MIN_WITHDRAWAL_FIFTEEN_DOLLARS: "Minimum withdrawal is $15.00.",
    INVALID_AMOUNT: "The withdrawal amount is not valid.",
    INVALID_COIN: "Choose a supported withdrawal coin.",
    WAGER_REQUIREMENT_NOT_MET: "Complete your wagering requirement before withdrawing.",
    WITHDRAWAL_RESTRICTED: "Withdrawals are restricted for this account.",
    REQUEST_ID_REUSED: "This request ID was already used. Refresh before trying again.",
    INVALID_ADDRESS: "The wallet address is not valid.",
    INSUFFICIENT_BALANCE: "Not enough balance for this withdrawal.",
    TX_HASH_ALREADY_CLAIMED: "A withdrawal to this address already exists. Please contact support.",
    TOO_MANY_REQUESTS: "Too many requests. Please wait a minute and try again.",
    SLOW_DOWN: "Please slow down and try again.",
    UNAUTHORIZED: "Please log in first.",
  };
  const code = error?.response?.data?.error;
  if (typeof code === "string" && messages[code]) return messages[code];
  if (error?.response?.status === 429) return messages.TOO_MANY_REQUESTS;
  if (error?.response?.status === 401) return messages.UNAUTHORIZED;
  return fallback;
}

/**
 * Withdraw cart items as crypto.
 * The old backend only pays out MONEY, so this does two steps:
 *  1) sell the selected cart items (their value goes to the balance)
 *  2) POST /api/withdrawals/crypto { amount, coin, address }
 * If step 2 fails, the money safely stays in the balance.
 */
export async function createCartWithdrawal(input: {
  intentId: string;
  token: string; // one of usdt|btc|usdc|eth|sol|trx|ltc
  address: string;
  cartItemIds: string[];
}): Promise<{ alreadyProcessed: boolean; withdrawalRequest: WithdrawalRequest }> {
  const coin = withdrawalCoin(input.token)?.symbol;
  if (!coin) throw new Error("Choose a supported withdrawal coin.");

  const address = String(input.address ?? "").trim();
  if (!validWithdrawalAddress(input.token, address)) throw new Error("Enter a valid address for the selected network.");

  const ids = Array.from(new Set((input.cartItemIds ?? []).map(String)));
  if (ids.length === 0) throw new Error("Please select cart items to withdraw.");

  // Work out how much the chosen items are worth
  const cart = await getCartItems("AVAILABLE");
  const chosen = cart.filter((item) => ids.includes(item.id));
  if (chosen.length !== ids.length) {
    throw new Error("Some of these items are no longer in your cart.");
  }
  const total = round2(chosen.reduce((sum, item) => sum + (Number(item.price) || 0), 0));
  const amount = round2(total - TRANSACTION_FEE);
  if (amount < 15) throw new Error("Minimum withdrawal is $15.00 after the displayed fee.");
  const eligibility=await getWithdrawalEligibility();
  if(!eligibility.canWithdraw)throw new Error(Number(eligibility.remaining)>0 ? `Wager another $${eligibility.remaining} before withdrawing.` : "Withdrawals are restricted for this account.");

  // Step 1: sell the items (throws a readable message if it fails)
  await sellCartItems(ids);

  // Step 2: request the payout
  let data: any;
  try {
    const res = await apiClient.post("/api/withdrawals/crypto", { amount, coin, address, requestId: input.intentId });
    data = res?.data ?? {};
  } catch (error: any) {
    console.warn("Withdrawal request failed:", error);
    throw new Error(
      "Your items were sold and the money is in your balance, but the withdrawal failed: " +
        getErrorMessage(error, "please try again.")
    );
  }

  // Keep the shown balance in step (the backend already deducted the amount)
  try {
    const current = Number(useAuthStore.getState().user?.balance);
    if (Number.isFinite(current)) {
      const next = round2(current - amount);
      useAuthStore.getState().updateUser({ balance: next, walletBalance: String(next) });
    }
  } catch {
    // ignore
  }

  return {
    alreadyProcessed: false,
    withdrawalRequest: {
      id: String(data.transactionId ?? input.intentId),
      intentId: input.intentId,
      amount: String(amount),
      destinationAddress: address,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      metadata: { token: coin },
    },
  };
}

export interface WithdrawalRequestsPage {
  items: WithdrawalRequest[];
  total: number;
  hasMore: boolean;
}

/**
 * Old backend: GET /api/withdrawals?limit=&offset= (added for this project)
 */
export async function getWithdrawalRequests(params?: {
  limit?: number;
  offset?: number;
}): Promise<WithdrawalRequestsPage> {
  const limit = params?.limit ?? 10;
  const offset = params?.offset ?? 0;
  try {
    const res = await apiClient.get("/api/withdrawals", { params: { limit, offset } });
    const data = res?.data ?? {};
    const rows: any[] = Array.isArray(data.items) ? data.items : [];
    const items: WithdrawalRequest[] = rows.map((r) => ({
      id: String(r.id),
      intentId: String(r.id),
      amount: String(Number(r.amount) || 0),
      destinationAddress: String(r.address ?? ""),
      status: mapStatus(r.status),
      requestedAt: r.createdAt,
      createdAt: r.createdAt,
      metadata: { token: r.coin ?? null },
    }));
    return { items, total: Number(data.total) || 0, hasMore: Boolean(data.hasMore) };
  } catch (error) {
    console.warn("Could not load withdrawals:", error);
    return { items: [], total: 0, hasMore: false };
  }
}

export interface WithdrawalEligibility {
 tipWagering?: {received:string;required:string;remaining:string;multiplier:string;qualifyingGames:string[]}|null;
 bonus?: {code:string;deposit:string;bonus:string;required:string;remaining:string;multiplier:string}|null;
  balance: string; required: string; progress: string; remaining: string;
  minWithdrawal: string; minDeposit: string; canWithdraw: boolean;
}
export async function getWithdrawalEligibility(): Promise<WithdrawalEligibility> {
  return (await apiClient.get('/api/withdrawals/eligibility')).data;
}
export async function requestBalanceWithdrawal(input: {amount:number;token:string;address:string;requestId:string}) {
  const coin=withdrawalCoin(input.token)?.symbol;
  if(!coin || !validWithdrawalAddress(input.token,input.address))throw new Error('Enter a valid address for the selected network.');
  if(!Number.isFinite(input.amount)||input.amount<15||Math.round(input.amount*100)/100!==input.amount)throw new Error('Minimum withdrawal is $15.00.');
  try {
    const {data}=await apiClient.post('/api/withdrawals/crypto',{amount:input.amount,coin,address:input.address.trim(),requestId:input.requestId});
    if(data.balance!=null)useAuthStore.getState().updateUser({balance:Number(data.balance),walletBalance:String(data.balance)});
    return data as {transactionId:string|number;balance:string};
  }catch(error){throw new Error(getErrorMessage(error,'Could not submit the withdrawal. Check your history before retrying.'));}
}
