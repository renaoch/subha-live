import type { Database } from "../../types/database.types";

export type VipSubscription =
  Database["public"]["Tables"]["vip_subscriptions"]["Row"];

export interface VipStatus {
  isVip: boolean;
  vipLevel: number;
  isSvip: boolean;
  svipLevel: number;
  expiresAt: string | null;
  isExpired: boolean;
}

export interface VipSubscriptionResult {
  id: string;
  vipLevel: number;
  isSvip: boolean;
  svipLevel: number;
  expiresAt: string | null;
  createdAt: string | null;
  isExpired: boolean;
}

export interface VipMeResult {
  status: VipStatus;
  subscriptions: VipSubscriptionResult[];
}