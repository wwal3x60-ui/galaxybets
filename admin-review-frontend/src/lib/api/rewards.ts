import { apiClient } from "./client";
import { getCurrentUser } from "./users";

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  level: number;
  levelProgress: number; // 0-100 percentage
  totalExperience?: number;
  /** Total wagered (USD) - used for reward level on rewards page */
  totalWagered?: number;
}

export type RewardType = "daily" | "weekly" | "monthly";

export interface Reward {
  id: string;
  type: RewardType;
  title: string;
  description: string;
  isClaimed: boolean;
  canClaim: boolean;
  icon?: string;
  /** Claimable amount (e.g. "0.75") */
  amount?: string;
}

export interface PeriodRewardsStatus {
  level: number;
  levelProgress: number;
  totalWagered: number;
  unclaimedDaily: string;
  unclaimedWeekly: string;
  unclaimedMonthly: string;
}

export async function getPeriodRewardsStatus(): Promise<PeriodRewardsStatus> {
  const res = await apiClient.get<{ success: boolean; data: PeriodRewardsStatus }>(
    "/rewards/period-status"
  );
  if (!res.data?.success) throw new Error("Failed to load period rewards status");
  return res.data.data;
}

export async function claimPeriodReward(type: RewardType): Promise<{ amount: string; newBalance: string }> {
  const res = await apiClient.post<{ success: boolean; data: { amount: string; newBalance: string } }>(
    "/rewards/claim-period",
    { type }
  );
  if (!res.data?.success) throw new Error("Claim failed");
  return res.data.data;
}

export interface FreePack {
  id: string;
  level: number;
  isUnlocked: boolean;
  isClaimed: boolean;
  image: string;
}

export interface RewardsData {
  userProfile: UserProfile;
  rewards: Reward[];
  freePacks: FreePack[];
}

/**
 * Get rewards data.
 * Fetches period-status from backend and builds daily/weekly/monthly rewards; uses current user for profile.
 */
export async function getRewards(): Promise<RewardsData> {
  try {
    const currentUser = await getCurrentUser();
    const userProfile: UserProfile = currentUser
      ? {
          id: currentUser.id,
          name: currentUser.name ?? currentUser.username ?? "User",
          avatar: currentUser.avatar ?? "/assets/avatar/avatar (1).png",
          level: currentUser.level ?? 1,
          levelProgress: currentUser.levelProgress ?? 0,
          totalExperience: currentUser.totalExperience ?? 0,
        }
      : {
          id: "1",
          name: "User",
          avatar: "/assets/avatar/avatar (1).png",
          level: 1,
          levelProgress: 0,
        };

    let periodStatus: PeriodRewardsStatus | null = null;
    if (currentUser) {
      try {
        periodStatus = await getPeriodRewardsStatus();
        userProfile.level = periodStatus.level;
        userProfile.levelProgress = periodStatus.levelProgress;
        userProfile.totalWagered = periodStatus.totalWagered;
      } catch {
        // keep defaults
      }
    }

    const dailyAmount = periodStatus?.unclaimedDaily ?? "0";
    const weeklyAmount = periodStatus?.unclaimedWeekly ?? "0";
    const monthlyAmount = periodStatus?.unclaimedMonthly ?? "0";

    const rewards: Reward[] = [
      {
        id: "daily",
        type: "daily",
        title: "Daily Rewards",
        description: "Claim your bonus from deposits in the last day!",
        isClaimed: parseFloat(dailyAmount) <= 0,
        canClaim: parseFloat(dailyAmount) > 0,
        amount: dailyAmount,
        icon: "award",
      },
      {
        id: "weekly",
        type: "weekly",
        title: "Weekly Rewards",
        description: "Claim your bonus from deposits in the last 7 days!",
        isClaimed: parseFloat(weeklyAmount) <= 0,
        canClaim: parseFloat(weeklyAmount) > 0,
        amount: weeklyAmount,
        icon: "medal",
      },
      {
        id: "monthly",
        type: "monthly",
        title: "Monthly Rewards",
        description: "Claim your bonus from deposits in the last 30 days!",
        isClaimed: parseFloat(monthlyAmount) <= 0,
        canClaim: parseFloat(monthlyAmount) > 0,
        amount: monthlyAmount,
        icon: "trophy",
      },
    ];

    return {
      userProfile,
      rewards,
      freePacks: [
        { id: "1", level: 2, isUnlocked: false, isClaimed: false, image: "/assets/images/free1.webp" },
        { id: "2", level: 10, isUnlocked: false, isClaimed: false, image: "/assets/images/free2.webp" },
        { id: "3", level: 20, isUnlocked: false, isClaimed: false, image: "/assets/images/free3.webp" },
        { id: "4", level: 30, isUnlocked: false, isClaimed: false, image: "/assets/images/free4.webp" },
        { id: "5", level: 40, isUnlocked: false, isClaimed: false, image: "/assets/images/free5.webp" },
        { id: "6", level: 50, isUnlocked: false, isClaimed: false, image: "/assets/images/free6.webp" },
        { id: "7", level: 60, isUnlocked: false, isClaimed: false, image: "/assets/images/free7.webp" },
        { id: "8", level: 70, isUnlocked: false, isClaimed: false, image: "/assets/images/free8.webp" },
        { id: "9", level: 80, isUnlocked: false, isClaimed: false, image: "/assets/images/free9.webp" },
        { id: "10", level: 90, isUnlocked: false, isClaimed: false, image: "/assets/images/free10.webp" },
      ],
    };
  } catch (error: unknown) {
    console.error("Error fetching rewards:", error);
    return {
      userProfile: {
        id: "1",
        name: "User",
        avatar: "/assets/avatar/avatar (1).png",
        level: 0,
        levelProgress: 0,
      },
      rewards: [],
      freePacks: [],
    };
  }
}
