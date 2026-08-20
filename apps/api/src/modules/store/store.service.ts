import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";

import type {
  StoreItem,
  UserInventoryItem,
  StoreItemResult,
  StoreResult,
  InventoryItemResult,
  InventoryResult,
  PurchaseResult,
} from "./store.types";

type StoreItemRow = Pick<
  StoreItem,
  | "id"
  | "name"
  | "category"
  | "price"
  | "icon"
  | "preview_url"
  | "duration_days"
  | "is_vip"
>;

type InventoryRow = Pick<
  UserInventoryItem,
  | "id"
  | "user_id"
  | "item_id"
  | "is_equipped"
  | "expires_at"
  | "created_at"
>;

type InventoryWithStoreItemRow =
  InventoryRow & {
    store_items: StoreItemRow | null;
  };

function toStoreItem(
  item: StoreItemRow,
): StoreItemResult {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    price: item.price,
    icon: item.icon,
    previewUrl: item.preview_url,
    durationDays: item.duration_days,
    isVip: item.is_vip ?? false,
  };
}

/**
 * Get all store items.
 */
export async function getStore(): Promise<StoreResult> {
  const {
    data,
    error,
  } = await supabase
    .from("store_items")
    .select(
      `
        id,
        name,
        category,
        price,
        icon,
        preview_url,
        duration_days,
        is_vip
      `,
    )
    .order("category", {
      ascending: true,
    })
    .order("price", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  const items: StoreItemResult[] =
    (data ?? []).map(
      (item: StoreItemRow) =>
        toStoreItem(item),
    );

  return {
    items,
  };
}

/**
 * Get a single store item.
 */
async function getStoreItem(
  itemId: string,
): Promise<StoreItemRow> {
  const {
    data,
    error,
  } = await supabase
    .from("store_items")
    .select(
      `
        id,
        name,
        category,
        price,
        icon,
        preview_url,
        duration_days,
        is_vip
      `,
    )
    .eq("id", itemId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new AppError(
        404,
        "Store item not found",
        {
          code: "STORE_ITEM_NOT_FOUND",
        },
      );
    }

    throw error;
  }

  return data as StoreItemRow;
}

/**
 * Get the authenticated user's inventory.
 */
export async function getMyInventory(
  userId: string,
): Promise<InventoryResult> {
  const {
    data,
    error,
  } = await supabase
    .from("user_inventory")
    .select(
      `
        id,
        user_id,
        item_id,
        is_equipped,
        expires_at,
        created_at,
        store_items (
          id,
          name,
          category,
          price,
          icon,
          preview_url,
          duration_days,
          is_vip
        )
      `,
    )
    .eq("user_id", userId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  const rows =
    (data ?? []) as InventoryWithStoreItemRow[];

  const items: InventoryItemResult[] =
    rows.map(
      (
        row: InventoryWithStoreItemRow,
      ) => {
        const item =
          row.store_items;

        if (!item) {
          throw new AppError(
            500,
            "Inventory item references a missing store item",
            {
              code:
                "INVENTORY_ITEM_REFERENCE_INVALID",
            },
          );
        }

        return {
          id: row.id,
          itemId: row.item_id,
          name: item.name,
          category: item.category,
          price: item.price,
          icon: item.icon,
          previewUrl:
            item.preview_url,
          durationDays:
            item.duration_days,
          isVip:
            item.is_vip ?? false,
          isEquipped:
            row.is_equipped ?? false,
          expiresAt:
            row.expires_at,
          createdAt:
            row.created_at,
        };
      },
    );

  return {
    items,
  };
}

/**
 * Purchase a store item using coins.
 *
 * The client never supplies the price.
 * The server reads the current price
 * directly from store_items.
 */
export async function purchaseStoreItem(
  userId: string,
  itemId: string,
): Promise<PurchaseResult> {
  const item =
    await getStoreItem(itemId);

  const price = item.price;

  if (price < 0) {
    throw new AppError(
      500,
      "Store item has an invalid price",
      {
        code:
          "INVALID_STORE_ITEM_PRICE",
      },
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("id, coins")
    .eq("id", userId)
    .single();

  if (profileError) {
    if (
      profileError.code ===
      "PGRST116"
    ) {
      throw new AppError(
        404,
        "User profile not found",
        {
          code:
            "PROFILE_NOT_FOUND",
        },
      );
    }

    throw profileError;
  }

  const currentCoins =
    profile.coins ?? 0;

  if (currentCoins < price) {
    throw new AppError(
      400,
      "Insufficient coins",
      {
        code:
          "INSUFFICIENT_COINS",
        details: {
          required: price,
          available: currentCoins,
        },
      },
    );
  }

  let expiresAt: string | null =
    null;

  if (
    item.duration_days !== null &&
    item.duration_days > 0
  ) {
    const expiry = new Date();

    expiry.setDate(
      expiry.getDate() +
        item.duration_days,
    );

    expiresAt =
      expiry.toISOString();
  }

  const remainingCoins =
    currentCoins - price;

  const {
    error: walletError,
  } = await supabase
    .from("profiles")
    .update({
      coins: remainingCoins,
    })
    .eq("id", userId)
    .gte("coins", price);

  if (walletError) {
    throw walletError;
  }

  const {
    data: inventoryItem,
    error: inventoryError,
  } = await supabase
    .from("user_inventory")
    .insert({
      user_id: userId,
      item_id: item.id,
      is_equipped: false,
      expires_at: expiresAt,
    })
    .select(
      "id, user_id, item_id, is_equipped, expires_at, created_at",
    )
    .single();

  if (inventoryError) {
    throw inventoryError;
  }

  return {
    purchaseId:
      inventoryItem.id,

    item:
      toStoreItem(item),

    pricePaid:
      price,

    remainingCoins,

    expiresAt,
  };
}

/**
 * Equip an inventory item.
 */
export async function equipInventoryItem(
  userId: string,
  inventoryId: string,
): Promise<InventoryItemResult> {
  const {
    data: inventory,
    error: inventoryError,
  } = await supabase
    .from("user_inventory")
    .select(
      `
        id,
        user_id,
        item_id,
        is_equipped,
        expires_at,
        created_at,
        store_items (
          id,
          name,
          category,
          price,
          icon,
          preview_url,
          duration_days,
          is_vip
        )
      `,
    )
    .eq("id", inventoryId)
    .eq("user_id", userId)
    .single();

  if (inventoryError) {
    if (
      inventoryError.code ===
      "PGRST116"
    ) {
      throw new AppError(
        404,
        "Inventory item not found",
        {
          code:
            "INVENTORY_ITEM_NOT_FOUND",
        },
      );
    }

    throw inventoryError;
  }

  const inventoryRow =
    inventory as InventoryWithStoreItemRow;

  if (!inventoryRow.store_items) {
    throw new AppError(
      500,
      "Inventory item references a missing store item",
      {
        code:
          "INVENTORY_ITEM_REFERENCE_INVALID",
      },
    );
  }

  if (
    inventoryRow.expires_at &&
    new Date(
      inventoryRow.expires_at,
    ).getTime() <=
      Date.now()
  ) {
    throw new AppError(
      400,
      "This inventory item has expired",
      {
        code:
          "INVENTORY_ITEM_EXPIRED",
      },
    );
  }

  const {
    data: categoryItems,
    error: categoryError,
  } = await supabase
    .from("user_inventory")
    .select(
      `
        id,
        user_id,
        item_id,
        is_equipped,
        expires_at,
        created_at,
        store_items (
          id,
          name,
          category,
          price,
          icon,
          preview_url,
          duration_days,
          is_vip
        )
      `,
    )
    .eq("user_id", userId);

  if (categoryError) {
    throw categoryError;
  }

  const categoryRows =
    (categoryItems ?? []) as InventoryWithStoreItemRow[];

  const targetCategory =
    inventoryRow.store_items.category;

  const categoryInventory =
    categoryRows.filter(
      (
        item: InventoryWithStoreItemRow,
      ) =>
        item.store_items
          ?.category ===
        targetCategory,
    );

  for (
    const item of categoryInventory
  ) {
    if (
      item.id ===
        inventoryRow.id ||
      !item.is_equipped
    ) {
      continue;
    }

    const {
      error: unequipError,
    } = await supabase
      .from("user_inventory")
      .update({
        is_equipped: false,
      })
      .eq("id", item.id)
      .eq("user_id", userId);

    if (unequipError) {
      throw unequipError;
    }
  }

  const {
    data: updated,
    error: updateError,
  } = await supabase
    .from("user_inventory")
    .update({
      is_equipped: true,
    })
    .eq("id", inventoryRow.id)
    .eq("user_id", userId)
    .select(
      `
        id,
        user_id,
        item_id,
        is_equipped,
        expires_at,
        created_at,
        store_items (
          id,
          name,
          category,
          price,
          icon,
          preview_url,
          duration_days,
          is_vip
        )
      `,
    )
    .single();

  if (updateError) {
    throw updateError;
  }

  const updatedRow =
    updated as InventoryWithStoreItemRow;

  if (!updatedRow.store_items) {
    throw new AppError(
      500,
      "Inventory item references a missing store item",
      {
        code:
          "INVENTORY_ITEM_REFERENCE_INVALID",
      },
    );
  }

  return {
    id: updatedRow.id,
    itemId:
      updatedRow.item_id,
    name:
      updatedRow.store_items.name,
    category:
      updatedRow.store_items.category,
    price:
      updatedRow.store_items.price,
    icon:
      updatedRow.store_items.icon,
    previewUrl:
      updatedRow.store_items
        .preview_url,
    durationDays:
      updatedRow.store_items
        .duration_days,
    isVip:
      updatedRow.store_items
        .is_vip ?? false,
    isEquipped:
      updatedRow.is_equipped ??
      false,
    expiresAt:
      updatedRow.expires_at,
    createdAt:
      updatedRow.created_at,
  };
}