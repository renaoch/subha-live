import { randomUUID } from "crypto";
import { supabase } from "../../lib/supabase";
import { AppError } from "../../errors/app-error";
import { logAudit } from "../../lib/audit";

// ─── Coin Packages ──────────────────────────────────────────────
export const COIN_PACKAGES = [
  { id: "pkg_100", coins: 100, priceUsd: 0.99, label: "100 Coins" },
  { id: "pkg_500", coins: 500, priceUsd: 4.99, label: "500 Coins" },
  { id: "pkg_1000", coins: 1000, priceUsd: 9.99, label: "1000 Coins" },
  { id: "pkg_5000", coins: 5000, priceUsd: 49.99, label: "5000 Coins" },
];

// ─── Get user's wallet ─────────────────────────────────────────
export async function getWallet(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("coins, diamonds")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

// ─── Purchase coins ────────────────────────────────────────────
export async function purchaseCoins(
  userId: string,
  packageId: string,
  paymentIntentId?: string // for real payment gateways
) {
  const pkg = COIN_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) throw new AppError(404, "Package not found");

  // 1. Record the transaction (pending)
  const { data: tx, error: txError } = await supabase
    .from("wallet_transactions")
    .insert({
      id: randomUUID(),
      user_id: userId,
      type: "purchase",
      amount: pkg.priceUsd,
      coins: pkg.coins,
      status: "pending",
      payment_intent_id: paymentIntentId,
      metadata: { packageId },
    })
    .select("id")
    .single();
  if (txError) throw txError;

  // 2. In a real flow, you'd confirm the payment via webhook
  // Here we simulate immediate success – mark as completed and credit coins
  const { error: updateError } = await supabase
    .from("wallet_transactions")
    .update({ status: "completed" })
    .eq("id", tx.id);
  if (updateError) throw updateError;

  // 3. Credit coins to user
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("coins")
    .eq("id", userId)
    .single();
  if (profileError) throw profileError;

  const newCoins = (profile.coins || 0) + pkg.coins;
  const { error: updateProfileError } = await supabase
    .from("profiles")
    .update({ coins: newCoins })
    .eq("id", userId);
  if (updateProfileError) throw updateProfileError;

  // 4. Audit
  await logAudit({
    actorId: userId,
    action: "COIN_PURCHASE",
    entityType: "wallet_transactions",
    entityId: tx.id,
    newValue: { packageId, coins: pkg.coins, amount: pkg.priceUsd },
  });

  return { txId: tx.id, newCoins };
}

// ─── Withdraw coins ────────────────────────────────────────────
export async function requestWithdrawal(
  userId: string,
  payload: { amount: number; bankAccount?: string; upiId?: string; note?: string }
) {
  const { amount, bankAccount, upiId, note } = payload;

  // Check if user has enough coins (assuming 1 coin = $0.01 for withdrawal)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("coins")
    .eq("id", userId)
    .single();
  if (profileError) throw profileError;

  const requiredCoins = Math.round(amount * 100); // 1 cent per coin
  if ((profile.coins || 0) < requiredCoins) {
    throw new AppError(400, "Insufficient coins");
  }

  // Deduct coins (immediately to prevent double spending)
  const newCoins = (profile.coins || 0) - requiredCoins;
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ coins: newCoins })
    .eq("id", userId);
  if (updateError) throw updateError;

  // Create withdrawal record (pending)
  const { data: withdrawal, error: wError } = await supabase
    .from("wallet_transactions")
    .insert({
      id: randomUUID(),
      user_id: userId,
      type: "withdrawal",
      amount: amount,
      coins: -requiredCoins, // negative
      status: "pending",
      bank_account: bankAccount,
      upi_id: upiId,
      note: note || null,
    })
    .select("id")
    .single();
  if (wError) throw wError;

  await logAudit({
    actorId: userId,
    action: "WITHDRAWAL_REQUESTED",
    entityType: "wallet_transactions",
    entityId: withdrawal.id,
    newValue: { amount, bankAccount, upiId },
  });

  return { withdrawalId: withdrawal.id, newCoins };
}

// ─── Get transaction history ──────────────────────────────────
export async function getTransactionHistory(userId: string) {
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}