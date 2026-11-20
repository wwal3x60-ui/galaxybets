import { apiClient } from './client';

export interface AffiliateStats {
  referralCode: string | null;
  referredByCode: string | null;
  referredByUserId?: string | null;
  referralsCount: number;
  totalEarned: string;
  unclaimedAmount: string;
  claimedAmount: string;
  legacyUnclaimedAmount: string;
  fractionalRemainder: string;
  totalWagered: string;
  totalDeposited: string;
  commissionRate:number;
  canClaim:boolean;
  qualifiedDepositors:number;
  minDepositors:number;
  minClaim:number;
  activeDepositAffiliateCode?: string | null;
  depositAffiliateExpiry?: string | null;
}

export interface AffiliateUser {
  id: string;
  username: string;
  totalWagered: number;
  totalDeposited: number;
  depositCount: number;
  totalEarnings: number;
  totalCredited: number;
  affiliatedAt: string;
}

export interface AffiliateUsersPage {
  page: number;
  pages: number;
  total: number;
  data: AffiliateUser[];
}

const endpoint = '/api/user/affiliate';

export async function getAffiliateStats(): Promise<AffiliateStats> {
  const [summary, usedCode] = await Promise.all([
    apiClient.get(endpoint),
    apiClient.get(`${endpoint}/usedCode`),
  ]);
  const data = summary.data;
  return {
    referralCode: data.affiliateCode ?? null,
    referredByCode: usedCode.data.code ?? null,
    referredByUserId: usedCode.data.affiliateId == null ? null : String(usedCode.data.affiliateId),
    referralsCount: Number(data.referralsCount ?? 0),
    totalEarned: String(data.totalEarnings ?? 0),
    claimedAmount: String(data.totalCredited ?? 0),
    unclaimedAmount:String(data.unclaimedEarnings??0),canClaim:data.canClaim===true,qualifiedDepositors:Number(data.qualifiedDepositors??0),minDepositors:Number(data.minDepositors??8),minClaim:Number(data.minClaim??5),
    legacyUnclaimedAmount: String(data.legacyUnclaimedEarnings ?? 0),
    fractionalRemainder: String(data.fractionalRemainder ?? '0.00000000'),
    totalWagered: String(data.totalWagered ?? 0),
    totalDeposited: String(data.totalDeposited ?? 0),
    commissionRate: Number(data.commissionRate ?? 0.03),
    activeDepositAffiliateCode: null,
    depositAffiliateExpiry: null,
  };
}

export async function getAffiliateUsers(page = 1): Promise<AffiliateUsersPage> {
  const response = await apiClient.get(`${endpoint}/users`, { params: { page } });
  return response.data;
}

export async function setAffiliateCode(code: string): Promise<void> {
  await apiClient.post(`${endpoint}/code`, { code });
}

export async function redeemAffiliateCode(code: string): Promise<{ reward: number }> {
  const response = await apiClient.post(endpoint, { code });
  return response.data;
}

// Retain the export for existing callers, without calling an obsolete route.
let pendingLegacyClaimId:string|null=null;
export async function claimAllReferralEarnings(requestId?:string): Promise<{ claimedAmount: string; count: number }> {
  const key=requestId??(pendingLegacyClaimId??=crypto.randomUUID());
  const result=(await apiClient.post(`${endpoint}/claim`,{requestId:key})).data;
  if(!requestId)pendingLegacyClaimId=null;return result;
}

export function affiliateErrorMessage(error: unknown): string {
  const value = error as { response?: { data?: { error?: string } }; message?: string };
  const code = value?.response?.data?.error;
  const messages: Record<string, string> = {
    INVALID_CODE: 'Use letters and numbers only. Your own code must contain 3–15 characters.',
    CODE_TAKEN: 'That code is already in use.',
    CODE_LOCKED: 'Changes to your referral code are locked. Contact support.',
    CODE_NOT_FOUND: 'That referral code was not found.',
    ALREADY_AFFILIATED: 'Your account is already linked to another affiliate code. A referral cannot be switched.',
    CANT_REDEEM_OWN_CODE: 'You cannot redeem your own referral code.',
    ACCOUNT_LOCKED: 'Your account is not eligible for this action.',
    DISABLED: 'This action is currently unavailable.',
    SLOW_DOWN: 'Please wait a moment before trying again.',
  };
  return (code && messages[code]) || value?.message || 'Unable to complete this action. Please try again.';
}
