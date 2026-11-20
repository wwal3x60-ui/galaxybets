import { apiClient } from "./client";
export const BONUS_TERMS_VERSION="streamer-ftd-v3-5x";

export type DepositStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface DepositRequest {
  id: string;
  userId: string;
  amount: string;
  intentId: string;
  transactionHash: string;
  blockchain: string;
  status: DepositStatus;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export interface StartNowPaymentsDepositInput {
  pay_currency: string; // e.g., "sol", "btc", "usdt"
  affiliateCode?: string; // Optional, only if user doesn't have referralCode in profile
}

export interface StartNowPaymentsDepositResponse {
  depositRequestId: string;
  paymentId: string;
  intentId: string;
  status: DepositStatus;
  payAddress: string;
  payCurrency: string;
  payAmount: string;
  amountReceived?: string | null;
  minDepositUSD: number;
  minDepositAmount: string;
}

/** Backend status words -> the statuses the pages know */
function mapStatus(raw: unknown): DepositStatus {
  const s = String(raw ?? "").toLowerCase();
  if (s === "pending") return "PENDING";
  if (["rejected", "failed", "cancelled", "canceled", "declined"].includes(s)) return "FAILED";
  return "COMPLETED";
}

/** Name of the coin icon file in /assets/icons */
function coinToIcon(coin: unknown): string {
  const c = String(coin ?? "").toLowerCase();
  if (c === "sol") return "solana";
  return c || "usdt";
}


/**
 * YOUR deposit wallets (public addresses). Keys are the coin symbols the backend accepts.
 * Double-check every address here before going live: money sent to a wrong address is lost.
 */
export const DEPOSIT_ADDRESSES: Record<string, { address: string; network: string }> = {
  SOL: { address: "52bQWDcjB8uDB9zTCvm7NvykXMXjDBgyr7jE8jLrbZyz", network: "Solana" },
  USDT: { address: "TVThNL6cSDezzt7Up3JmT2NPzJELmuv7dm", network: "Tron (TRC20)" },
  TRX: { address: "TVThNL6cSDezzt7Up3JmT2NPzJELmuv7dm", network: "Tron" },
  LTC: { address: "LVdep1YemWVsPTYiKvK73LFknJ64ZKRacy", network: "Litecoin" },
  DOGE: { address: "DH2xt6hvDBAfmhFFT1xmoWgxpja1JjPj7F", network: "Dogecoin" },
  ETH: { address: "0xd1e973e0a5fb839a1c6d7beb322109eafec0d3bb", network: "Ethereum (ERC20)" },
  BNB: { address: "0xd1e973e0a5fb839a1c6d7beb322109eafec0d3bb", network: "BNB Smart Chain (BEP20)" },
  USDC: { address: "0xd1e973e0a5fb839a1c6d7beb322109eafec0d3bb", network: "Ethereum (ERC20)" },
};

function getErrorMessage(error: any, fallback: string): string {
  const messages: Record<string, string> = {
    BONUS_MIN_DEPOSIT_40: "The streamer bonus requires a first deposit of at least $40.",
    INVALID_STREAMER_CODE: "Enter an active streamer's affiliate code.",
    BONUS_OWN_CODE: "You cannot use your own streamer code.",
    BONUS_AFFILIATE_CONFLICT: "Your account is already linked to another affiliate. Existing referrals cannot be changed.",
    BONUS_LINK_CODE_FIRST: "Activate this streamer code before submitting the bonus deposit.",
    INVALID_BONUS_CODE: "This bonus code is not valid.",
    BONUS_FIRST_DEPOSIT_ONLY: "The streamer bonus is available only on your first confirmed deposit.",
    BONUS_ALREADY_CLAIMED: "Your first-deposit bonus has already been claimed.",
    BONUS_TERMS_CHANGED: "Bonus terms changed. Refresh the page, review the 5× requirement and accept the new terms before submitting.",
    BONUS_TERMS_REQUIRED: "Accept the displayed bonus wagering terms to claim it.",
    BONUS_ACCOUNT_RESTRICTED: "This account is not eligible for the deposit bonus.",
    DEPOSIT_RESTRICTED: "Deposits are restricted for this account.",
    BONUS_NOT_READY: "The bonus offer is temporarily unavailable. You can remove the code to deposit without a bonus.",
    INVALID_AMOUNT: "Enter a valid amount (up to 2 decimals).",
    INVALID_COIN: "This coin is not accepted.",
    INVALID_TX_HASH: "Enter a valid transaction hash.",
    TX_HASH_ALREADY_CLAIMED: "This transaction hash was already submitted.",
    TOO_MANY_REQUESTS: "Too many requests. Please wait a minute and try again.",
    SLOW_DOWN: "Please slow down and try again.",
    UNAUTHORIZED: "Please log in first.",
    DEPOSIT_FAILED: "The deposit could not be saved. Please try again.",
  };
  const code = error?.response?.data?.error;
  if (typeof code === "string" && messages[code]) return messages[code];
  if (error?.response?.status === 429) return messages.TOO_MANY_REQUESTS;
  if (error?.response?.status === 401) return messages.UNAUTHORIZED;
  return fallback;
}

/**
 * Manual crypto deposit: the user has already sent the coins and now submits
 * the amount and the transaction hash. An admin approves it later.
 * Old backend: POST /api/deposits/crypto { amount, coin, txHash }
 */
export async function submitCryptoDeposit(input: {
  amount: number;
  coin: string;
  txHash: string;
  bonusCode?: string;
  bonusTermsAccepted?: boolean;
  bonusVersion?: string;
}): Promise<{ transactionId: string }> {
  try {
    const res = await apiClient.post("/api/deposits/crypto", input);
    return { transactionId: String(res?.data?.transactionId ?? "") };
  } catch (error: any) {
    console.warn("Error submitting deposit:", error);
    throw new Error(getErrorMessage(error, "Failed to submit the deposit. Please try again."));
  }
}

/**
 * The old backend has no automatic payment gateway (NowPayments).
 * Deposits are manual: the user pays, then submits amount + transaction hash
 * (POST /api/deposits/crypto) and an admin approves it.
 * The deposit window has to be updated for that, so for now we say so clearly.
 */
export async function startNowPaymentsDeposit(
  _input: StartNowPaymentsDepositInput
): Promise<StartNowPaymentsDepositResponse> {
  throw new Error("Deposits are not available yet. They are being set up.");
}

/**
 * Old backend: GET /api/deposits (added for this project)
 * Each row is reshaped to what the Deposits page expects.
 */
export async function getDeposits(): Promise<DepositRequest[]> {
  try {
    const res = await apiClient.get("/api/deposits");
    const rows: any[] = Array.isArray(res?.data) ? res.data : [];
    return rows.map((r) => {
      const status = mapStatus(r.status);
      const amount = String(Number(r.amount) || 0);
      return {
        id: String(r.id),
        userId: "",
        amount,
        intentId: String(r.txHash ?? ""),
        transactionHash: String(r.txHash ?? ""),
        blockchain: String(r.coin ?? ""),
        status,
        metadata: {
          bonus_code: r.bonusCode,
          bonus_status: r.bonusStatus,
          bonus_amount: r.bonusAmount,
          bonus_wager: r.wagerAmount,
          bonus_reason: r.bonusReason,
          pay_currency: coinToIcon(r.coin),
          // the page shows "------" while the deposit is not approved
          credited_usd: status === "COMPLETED" ? amount : undefined,
          payment_id: String(r.id),
          // "FINISHED" hides the refresh button (nothing to refresh on manual deposits)
          nowpayments: { lastStatus: "FINISHED" },
        },
        createdAt: String(r.createdAt ?? ""),
        updatedAt: String(r.createdAt ?? ""),
      };
    });
  } catch (error) {
    console.warn("Could not load deposits:", error);
    return [];
  }
}

export async function getDepositByIntent(intentId: string): Promise<DepositRequest> {
  const list = await getDeposits();
  const found = list.find((d) => d.intentId === intentId);
  if (!found) throw new Error("Deposit not found");
  return found;
}

/** Manual deposits have no payment provider to refresh from: just reload the row */
export async function refreshDepositStatus(depositId: string): Promise<DepositRequest> {
  const list = await getDeposits();
  const found = list.find((d) => d.id === depositId);
  if (!found) throw new Error("Deposit not found");
  return found;
}

export type DepositBonusQuote={deposit:string;code:string;rate:number;bonus:string;creditedTotal:string;required:string;multiplier:string;version:string};
export type DepositBonusOffer={streamerId?:string;streamerName?:string;needsAffiliateLink?:boolean;codeMode?:string;eligible:boolean;reason:string|null;code:string;version:string;tiers:{minimum:string;rate:number}[];maxBonus:string;multiplier:string;quote:DepositBonusQuote|null};
export async function getDepositBonusOffer(amount:string,code:string):Promise<DepositBonusOffer>{
  try { const {data}=await apiClient.get('/api/deposits/bonus-offer',{params:{...(amount?{amount}:{}),...(code.trim()?{code:code.trim()}: {})}});return data; }
  catch(error){throw new Error(getErrorMessage(error,'Could not verify the bonus. Retry before submitting, or remove the code to deposit without a bonus.'));}
}
