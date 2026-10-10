import type { Database } from "../../types/database.types";

export type CharismaDefinition =
  Database["public"]["Tables"]["charisma_definitions"]["Row"];

export type GiftRow = Database["public"]["Tables"]["gifts"]["Row"];

export type UserCharismaProgress =
  Database["public"]["Tables"]["user_charisma_progress"]["Row"];

export interface CharismaProgress {
  currentLevel: number;
  currentCharisma: number;
  totalCharisma: number;

  currentLevelCharisma: number;
  nextLevelCharisma: number | null;

  progress: number;

  nextLevel: number | null;
  currentTitle: string | null;
  nextTitle: string | null;
}

export interface GiftItem {
  id: string;

  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  senderLevel: number;

  recipientId: string;
  recipientName: string;
  recipientAvatar: string | null;
  recipientLevel: number;

  giftName: string;
  giftIcon: string;
  /** Coin value of ONE gift. */
  value: number;
  createdAt: string;
  /** How many were actually delivered (may be less than requested). */
  quantity?: number;
  requestedQuantity?: number;
  /** value × quantity actually charged. */
  totalValue?: number;
}

export interface CharismaOverview {
  progress: CharismaProgress;
}

export interface GiftListResult {
  gifts: GiftItem[];
  totalValue: number;
  count: number;
}