// Chips — the ledger. The price list lives next door in ./chip-rates, which has
// no dependencies so the browser and the tests can read it too.
//
// THE PROBLEM THIS EXISTS TO FIX. The pass is a single transaction: $9, ninety
// days, six thousand voice minutes. Someone who loves the product cannot give us
// another dollar until it lapses, and someone who actually redeems the allowance
// costs far more than they paid — six thousand minutes is on the order of four
// hundred dollars of speech. Both ends are the same mistake: a price with no
// relationship to what is served. It has held up only because almost nobody
// redeems it, which is a business resting on customers not enjoying themselves.
//
// Chips fix both ends. A chip is a minute of her voice — the thing that costs us
// money — so price and consumption move together. Chips can be bought again the
// moment someone wants more, so a delighted user is no longer capped at nine
// dollars. And because a chip is legible, people can hold a balance and decide;
// the alternative is an invisible meter, which is what we have now.
//
// WHAT THIS IS NOT. Every grant is a fixed amount stated before it is earned.
// No random payout, no streak that takes something away for a missed day, no
// balance that expires to manufacture urgency, no near-miss. Those work by
// overriding judgement rather than rewarding it, and on a product about intimacy
// sold to people who are often lonely, that is the line between a business and a
// trap. A chip someone was told about and chose to spend is the entire model.

import { getAdminClient, hasAdmin } from "@/lib/supabase-admin"

export * from "@/lib/airraw/chip-rates"

export interface ChipMove {
  ok: boolean
  balance: number
  /** True when this exact event had already been applied; nothing changed. */
  replay?: boolean
  reason?: "insufficient" | "no-purse" | "no-event" | "unavailable"
}

export interface ChipState {
  balance: number
  lifetimeIn: number
  lifetimeOut: number
  history: Array<{ delta: number; reason: string; at: string }>
}

/**
 * Move chips. `event` is the idempotency key and is not optional: a grant without
 * one doubles on a retried webhook, and a spend without one double-charges on a
 * client retry. Name it after the thing that happened ("buy:<intentId>",
 * "daily:<wallet>:<day>") — never after the moment it happened, or a retry mints
 * a new key and the guard does nothing.
 */
export async function moveChips(
  wallet: string | null,
  delta: number,
  reason: string,
  event: string,
): Promise<ChipMove> {
  if (!wallet) return { ok: false, balance: 0, reason: "no-purse" }
  if (!event) return { ok: false, balance: 0, reason: "no-event" }
  if (!hasAdmin()) return { ok: false, balance: 0, reason: "unavailable" }
  try {
    const { data, error } = await getAdminClient().rpc("chips_move", {
      p_purse: wallet, p_delta: Math.round(delta), p_reason: reason, p_event: event,
    })
    if (error) throw new Error(error.message)
    const v = (data || {}) as { ok?: boolean; balance?: number; replay?: boolean; reason?: string }
    return {
      ok: v.ok !== false,
      balance: Number(v.balance || 0),
      replay: !!v.replay,
      reason: v.reason as ChipMove["reason"],
    }
  } catch (e) {
    console.error("[chips] ledger unavailable (has db/chips.sql been run?):", e instanceof Error ? e.message : String(e))
    return { ok: false, balance: 0, reason: "unavailable" }
  }
}

/** Grant chips. A grant that did not land is safe to retry — same event id, same result. */
export function grantChips(wallet: string | null, n: number, reason: string, event: string) {
  return moveChips(wallet, Math.abs(n), reason, event)
}

/**
 * Spend chips. FAILS CLOSED, deliberately and unlike the voice meter: chips are
 * money, and serving a paid unit against a ledger we cannot read is not a
 * degraded experience, it is a free one. Callers fall back to the pass meter,
 * which is exactly where everyone is today — so a ledger outage costs us nothing
 * we were not already giving away.
 */
export async function spendChips(wallet: string | null, n: number, reason: string, event: string): Promise<ChipMove> {
  if (n <= 0) return { ok: true, balance: 0 }
  return moveChips(wallet, -Math.abs(n), reason, event)
}

/**
 * Is the ledger actually there?
 *
 * This exists because of the specific way this feature ships: the SQL is applied
 * by hand, so there is a window where the code is live and the tables are not.
 * In that window a purchase would take real money and then be unable to credit
 * anything — the one failure here with no good answer. So the buy path asks this
 * first and refuses to open a checkout it cannot honour.
 *
 * A read against a wallet that does not exist, which is cheap and writes nothing.
 * Cached briefly: this sits in front of a payment, not on a hot path, but there
 * is no reason to ask Postgres the same question on every render.
 */
let readyUntil = 0
let readyCache = false

export async function ledgerReady(): Promise<boolean> {
  if (!hasAdmin()) return false
  if (Date.now() < readyUntil) return readyCache
  try {
    const { error } = await getAdminClient().rpc("chips_state", { p_purse: "__probe__", p_limit: 1 })
    if (error) throw new Error(error.message)
    readyCache = true
  } catch (e) {
    console.error("[chips] ledger not ready — has db/chips.sql been run?:", e instanceof Error ? e.message : String(e))
    readyCache = false
  }
  // Short when down so it recovers on its own the moment the SQL is applied;
  // longer when up, because a working ledger does not stop working every minute.
  readyUntil = Date.now() + (readyCache ? 300_000 : 20_000)
  return readyCache
}

export async function chipState(wallet: string | null, limit = 12): Promise<ChipState> {
  const empty: ChipState = { balance: 0, lifetimeIn: 0, lifetimeOut: 0, history: [] }
  if (!wallet || !hasAdmin()) return empty
  try {
    const { data, error } = await getAdminClient().rpc("chips_state", { p_purse: wallet, p_limit: limit })
    if (error) throw new Error(error.message)
    const v = (data || {}) as Record<string, unknown>
    return {
      balance: Number(v.balance || 0),
      lifetimeIn: Number(v.lifetime_in || 0),
      lifetimeOut: Number(v.lifetime_out || 0),
      history: Array.isArray(v.history) ? (v.history as ChipState["history"]) : [],
    }
  } catch (e) {
    console.error("[chips] state unavailable:", e instanceof Error ? e.message : String(e))
    return empty
  }
}
