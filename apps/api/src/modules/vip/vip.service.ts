import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";

import type {
  VipSubscription,
  VipStatus,
  VipSubscriptionResult,
  VipMeResult,
} from "./vip.types";

type VipSubscriptionRow = Pick<
  VipSubscription,
  | "id"
  | "user_id"
  | "vip_level"
  | "is_svip"
  | "svip_level"
  | "expires_at"
  | "created_at"
>;

function isSubscriptionExpired(
  expiresAt: string | null,
): boolean {
  if (!expiresAt) {
    return false;
  }

  return (
    new Date(expiresAt).getTime() <=
    Date.now()
  );
}

function toSubscriptionResult(
  subscription: VipSubscriptionRow,
): VipSubscriptionResult {
  const isExpired =
    isSubscriptionExpired(
      subscription.expires_at,
    );

  return {
    id: subscription.id,

    vipLevel:
      subscription.vip_level ?? 0,

    isSvip:
      subscription.is_svip ?? false,

    svipLevel:
      subscription.svip_level ?? 0,

    expiresAt:
      subscription.expires_at,

    createdAt:
      subscription.created_at,

    isExpired,
  };
}

/**
 * Get the authenticated user's current VIP state
 * and subscription history.
 */
export async function getMyVip(
  userId: string,
): Promise<VipMeResult> {
  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select(
      "id, vip_level, svip",
    )
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

  const {
    data: subscriptions,
    error:
      subscriptionsError,
  } = await supabase
    .from("vip_subscriptions")
    .select(
      `
        id,
        user_id,
        vip_level,
        is_svip,
        svip_level,
        expires_at,
        created_at
      `,
    )
    .eq("user_id", userId)
    .order("created_at", {
      ascending: false,
    });

  if (subscriptionsError) {
    throw subscriptionsError;
  }

  const rows =
    (subscriptions ?? []) as VipSubscriptionRow[];

  const subscriptionResults =
    rows.map(
      (
        subscription: VipSubscriptionRow,
      ) =>
        toSubscriptionResult(
          subscription,
        ),
    );

  /*
   * Determine the currently active
   * subscription.
   */
  const activeSubscription =
    rows.find(
      (
        subscription: VipSubscriptionRow,
      ) =>
        !isSubscriptionExpired(
          subscription.expires_at,
        ),
    );

  const profileVipLevel =
    profile.vip_level ?? 0;

  const profileIsSvip =
    profile.svip ?? false;

  const activeVipLevel =
    activeSubscription
      ? Math.max(
          profileVipLevel,
          activeSubscription.vip_level ??
            0,
        )
      : 0;

  const activeIsSvip =
    activeSubscription
      ? profileIsSvip ||
        activeSubscription.is_svip ===
          true
      : false;

  const activeSvipLevel =
    activeSubscription
      ? activeSubscription.svip_level ??
        0
      : 0;

  const expiresAt =
    activeSubscription
      ?.expires_at ?? null;

  return {
    status: {
      isVip:
        activeVipLevel > 0 ||
        activeIsSvip,

      vipLevel:
        activeVipLevel,

      isSvip:
        activeIsSvip,

      svipLevel:
        activeSvipLevel,

      expiresAt,

      isExpired:
        expiresAt !== null &&
        isSubscriptionExpired(
          expiresAt,
        ),
    },

    subscriptions:
      subscriptionResults,
  };
}

/**
 * Get a specific VIP subscription owned
 * by the authenticated user.
 */
export async function getMyVipSubscription(
  userId: string,
  subscriptionId: string,
): Promise<VipSubscriptionResult> {
  const {
    data,
    error,
  } = await supabase
    .from("vip_subscriptions")
    .select(
      `
        id,
        user_id,
        vip_level,
        is_svip,
        svip_level,
        expires_at,
        created_at
      `,
    )
    .eq("id", subscriptionId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (
      error.code === "PGRST116"
    ) {
      throw new AppError(
        404,
        "VIP subscription not found",
        {
          code:
            "VIP_SUBSCRIPTION_NOT_FOUND",
        },
      );
    }

    throw error;
  }

  return toSubscriptionResult(
    data as VipSubscriptionRow,
  );
}