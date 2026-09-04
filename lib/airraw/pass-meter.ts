// Server-side metering for the anonymous pass — the part the browser can't reset.
//
// The pass token carries a minute allowance, but until now the only thing that
// counted minutes was localStorage, which a visitor can clear in one click. On a
// product whose cost is almost entirely the premium voice engine, that made the
// allowance decorative. This counts what the engine actually bills for —
// characters spoken — against a row keyed on the token's hash, so a cleared
// browser, a second device or a restored code all draw on the same pass.
//
// It sits on the hot path of every premium chunk, so it is one RPC that locks one
// row (db/pass_usage.sql). And it FAILS OPEN: a pass holder losing the voice they
// paid for because a table is missing is a worse failure than ten minutes of
// unmetered speech — so a missing table is logged, tolerated, and retried later.

import { createHash } from "crypto"
import { getAdminClient, hasAdmin } from "@/lib/supabase-admin"

/**
 * Characters of premium speech one pass minute buys. ~140 words a minute at ~5
 * characters a word: a minute of the CHARACTER talking, which is what the engine
 * bills, not a minute of the call. Env-overridable so the exchange rate can be
 * tuned without a deploy.
 */
export const CHARS_PER_MINUTE = Math.max(100, Number(process.env.PASS_CHARS_PER_MINUTE || 700))
/** Fair-use ceiling per UTC day, in minutes — the same figure the client shows. */
export const PASS_DAILY_CAP_MIN = Math.max(1, Number(process.env.PASS_DAILY_CAP_MIN || 240))

export interface SpendVerdict {
  ok: boolean
  reason?: "exhausted" | "daily-cap"
  /** Lifetime characters on this pass after this spend (when known). */
  used?: number
  /** True when nothing was counted — no allowance on the token, or the meter is down. */
  unmetered?: boolean
}

let offUntil = 0
const OFF_MS = 10 * 60_000

/** A stable, non-reversible id for a pass: the signed token's hash. */
export function passKey(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 32)
}

/**
 * Spend `chars` of premium speech from the pass behind `token`. The token has
 * already been verified by the caller; `minutes` is its allowance.
 */
export async function spendPassChars(token: string, minutes: number | undefined, chars: number): Promise<SpendVerdict> {
  const cap = Math.round(Math.max(0, minutes ?? 0) * CHARS_PER_MINUTE)
  if (!cap || chars <= 0) return { ok: true, unmetered: true }
  if (!hasAdmin() || Date.now() < offUntil) return { ok: true, unmetered: true }
  try {
    const { data, error } = await getAdminClient().rpc("pass_spend", {
      p_key: passKey(token),
      p_chars: chars,
      p_cap: cap,
      p_day_cap: PASS_DAILY_CAP_MIN * CHARS_PER_MINUTE,
    })
    if (error) throw new Error(error.message)
    const v = (data || {}) as { ok?: boolean; reason?: string; used?: number }
    if (v.ok === false) return { ok: false, reason: v.reason === "daily-cap" ? "daily-cap" : "exhausted", used: v.used }
    return { ok: true, used: v.used }
  } catch (e) {
    offUntil = Date.now() + OFF_MS
    console.error(`[pass-meter] unavailable — pass voice unmetered for ${OFF_MS / 60000}m (has db/pass_usage.sql been run?):`, e instanceof Error ? e.message : String(e))
    return { ok: true, unmetered: true }
  }
}
