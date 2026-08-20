import type { Database } from "../../types/database.types";

export type StoreItem =
  Database["public"]["Tables"]["store_items"]["Row"];

export type UserInventoryItem =
  Database["public"]["Tables"]["user_inventory"]["Row"];

export interface StoreItemResult {
  id: string;
  name: string;
  category: string;
  price: number;
  icon: string | null;
  previewUrl: string | null;
  durationDays: number | null;
  isVip: boolean;
}

export interface StoreResult {
  items: StoreItemResult[];
}

export interface InventoryItemResult {
  id: string;
  itemId: string;
  name: string;
  category: string;
  price: number;
  icon: string | null;
  previewUrl: string | null;
  durationDays: number | null;
  isVip: boolean;
  isEquipped: boolean;
  expiresAt: string | null;
  createdAt: string | null;
}

export interface InventoryResult {
  items: InventoryItemResult[];
}

export interface PurchaseResult {
  purchaseId: string;
  item: StoreItemResult;
  pricePaid: number;
  remainingCoins: number;
  expiresAt: string | null;
}