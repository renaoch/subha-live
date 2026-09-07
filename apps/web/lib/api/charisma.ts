import { apiFetch } from "@/lib/api/client";

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

export interface CharismaGiftItem {
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
  value: number;
  createdAt: string;
}

/**
 * Actual backend response:
 *
 * {
 *   status: "ok",
 *   charisma: {
 *     currentLevel: 42,
 *     totalCharisma: 128400,
 *     ...
 *   }
 * }
 */
interface CharismaOverviewResponse {
  status: string;
  charisma: CharismaProgress;
}

/**
 * Actual backend response:
 *
 * {
 *   status: "ok",
 *   gifts: [...],
 *   totalValue: 12500,
 *   count: 34
 * }
 */
interface GiftListResponse {
  status: string;
  gifts: CharismaGiftItem[];
  totalValue: number;
  count: number;
}

interface SendGiftResponse {
  status: string;
  gift: CharismaGiftItem;
}

export const charismaApi = {
  async me(): Promise<{ progress: CharismaProgress }> {
    const response = await apiFetch<CharismaOverviewResponse>(
      "/api/v1/charisma/me",
    );

    return { progress: response.charisma };
  },

  async gifts(
    direction: "incoming" | "outgoing",
    limit = 20,
    offset = 0,
  ): Promise<{
    gifts: CharismaGiftItem[];
    totalValue: number;
    count: number;
  }> {
    const response = await apiFetch<GiftListResponse>(
      `/api/v1/charisma/gifts?direction=${direction}&limit=${limit}&offset=${offset}`,
    );

    return {
      gifts: response.gifts,
      totalValue: response.totalValue,
      count: response.count,
    };
  },

  /**
   * Sends a gift. This is the endpoint to use for all in-app gifting
   * (the gift picker, profile gifting, etc.) — it performs the same
   * atomic coin-deduct/diamond-credit transaction as
   * `financialApi.sendGift` (see apps/web/lib/api/financial.ts) plus the
   * presentation-layer side effects: charisma progress, room-task/
   * host-task progress, and PK scoring.
   *
   * `giftId` is a `gift_catalog` row id from `financialApi.giftCatalog()`
   * — never a client-chosen name/icon/value; the price is looked up
   * server-side. `clientRequestId` is an idempotency key: generate one
   * per user tap (see `newClientRequestId()`) and resend the SAME value
   * if that tap's request is retried.
   */
  async send(input: {
    recipientId: string;
    giftId: string;
    streamId?: string;
    roomId?: string;
    clientRequestId: string;
  }): Promise<CharismaGiftItem> {
    const response = await apiFetch<SendGiftResponse>(
      "/api/v1/charisma/send",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );

    return response.gift;
  },
};