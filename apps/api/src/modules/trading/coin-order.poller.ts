// Background auto-credit for agency coin orders.
//
// Every INTERVAL_MS it looks at unpaid orders, pulls successful USDT deposits
// from Binance once (one signed read per tick, regardless of order count), and
// settles every order whose unique amount/address/network/time matches. The
// user does not have to press anything — credit lands within one interval of
// Binance confirming the deposit.
//
// Safe to run on several API instances: settlement is serialised by a row lock
// in fin_settle_agency_coin_order() and a unique index on the tx id, so a race
// can only ever credit once.

import { setInterval, clearInterval } from "node:timers";
import { supabase } from "../../lib/supabase";
import { isBinanceConfigured } from "../../lib/binance";
import { listSuccessfulDeposits } from "../binance/binance.service";
import { evaluateDeposit, ORDER_COIN, type BinanceDeposit } from "./coin-order.logic";
import { settleOrder, type CoinOrderRow } from "./coin-order.service";

const INTERVAL_MS = 20_000;
const LATE_GRACE_MS = 6 * 60 * 60 * 1000; // still honour deposits detected late
const db = supabase as unknown as { from: (t: string) => any; rpc: (fn: string, a: Record<string, unknown>) => any };

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
let lastExpirySweep = 0;

export function startCoinOrderPoller(): void {
  if (timer) return;
  if (!isBinanceConfigured()) {
    console.warn("[coin-orders] poller NOT started — BINANCE_API_KEY / BINANCE_API_SECRET missing; coin orders will not auto-credit");
    return;
  }
  timer = setInterval(() => void tick(), INTERVAL_MS);
  timer.unref?.();
}

export function stopCoinOrderPoller(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export async function tick(): Promise<void> {
  if (running) return; // never overlap ticks
  running = true;
  try {
    const cutoff = new Date(Date.now() - LATE_GRACE_MS).toISOString();
    const { data, error } = await db
      .from("agency_coin_orders")
      .select("*")
      .eq("status", "pending")
      .gt("expires_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) throw error;
    const orders = (data ?? []) as CoinOrderRow[];

    if (orders.length > 0) {
      const since = Math.min(...orders.map((o) => Date.parse(o.created_at))) - 5 * 60 * 1000;
      const deposits = (await listSuccessfulDeposits(ORDER_COIN, since, Date.now())) as BinanceDeposit[];

      for (const order of orders) {
        const match = deposits.find((d) =>
          evaluateDeposit(
            {
              coin: order.coin,
              network: order.network,
              depositAddress: order.deposit_address,
              expectedMicros: Number(order.expected_micros),
              createdAtMs: Date.parse(order.created_at),
              expiresAtMs: Date.parse(order.expires_at),
            },
            d,
          ).ok,
        );
        if (!match) continue;
        try {
          const result = await settleOrder(order, match, "poller");
          if (!("rejected" in result) && !result.alreadyProcessed) {
            console.log(`[coin-orders] auto-credited order ${order.id}`);
          }
        } catch (err) {
          console.error(`[coin-orders] settle failed for ${order.id}:`, err);
        }
      }
    }

    // Hourly: flip long-unpaid orders to 'expired'.
    if (Date.now() - lastExpirySweep > 60 * 60 * 1000) {
      lastExpirySweep = Date.now();
      await db.rpc("expire_agency_coin_orders", {});
    }
  } catch (err) {
    console.error("[coin-orders] poll tick failed:", err);
  } finally {
    running = false;
  }
}