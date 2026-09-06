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

/** One atomic spend against one bucket: lifetime cap and per-UTC-day cap. */
async function spendChars(key: string, chars: number, cap: number, dayCap: number): Promise<SpendVerdict> {
  if (chars <= 0) return { ok: true, unmetered: true }
  if (!hasAdmin() || Date.now() < offUntil) return { ok: true, unmetered: true }
  try {
    const { data, error } = await getAdminClient().rpc("pass_spend", {
      p_key: key,
      p_chars: chars,
      p_cap: cap,
      p_day_cap: dayCap,
    })
    if (error) throw new Error(error.message)
    const v = (data || {}) as { ok?: boolean; reason?: string; used?: number }
    if (v.ok === false) return { ok: false, reason: v.reason === "daily-cap" ? "daily-cap" : "exhausted", used: v.used }
    return { ok: true, used: v.used }
  } catch (e) {
    offUntil = Date.now() + OFF_MS
    console.error(`[pass-meter] unavailable — voice unmetered for ${OFF_MS / 60000}m (has db/pass_usage.sql been run?):`, e instanceof Error ? e.message : String(e))
    return { ok: true, unmetered: true }
  }
}

/**
 * Spend `chars` of premium speech from the pass behind `token`. The token has
 * already been verified by the caller; `minutes` is its allowance.
 */
export async function spendPassChars(token: string, minutes: number | undefined, chars: number): Promise<SpendVerdict> {
  const cap = Math.round(Math.max(0, minutes ?? 0) * CHARS_PER_MINUTE)
  if (!cap) return { ok: true, unmetered: true }
  return spendChars(passKey(token), chars, cap, PASS_DAILY_CAP_MIN * CHARS_PER_MINUTE)
}

// ── photos ───────────────────────────────────────────────────────────────────
// A photo of her is the one thing in the product that costs CASH per unit (the
// image provider bills per generation), and the one thing people pay per unit
// for. So it is pass-only, counted against the pass, and — unlike voice —
// FAILS CLOSED: if the meter is unreachable, no photo. Losing a minute of
// speech to a missing table is an annoyance; generating unmetered images on a
// budget of zero is a bill. Same RPC as voice, its own key namespace, one unit
// per photo. Thirty on a pass keeps the worst case at well under a dollar
// against a nine-dollar sale.
export const PHOTOS_PER_DAY = Math.max(1, Number(process.env.PASS_PHOTOS_PER_DAY || 3))
export const PHOTOS_PER_PASS = Math.max(1, Number(process.env.PASS_PHOTOS_PER_PASS || 30))

export async function spendPassPhoto(token: string): Promise<SpendVerdict> {
  if (!hasAdmin()) return { ok: false, reason: "exhausted", unmetered: true }
  try {
    const { data, error } = await getAdminClient().rpc("pass_spend", {
      p_key: `photo:${passKey(token)}`, p_chars: 1, p_cap: PHOTOS_PER_PASS, p_day_cap: PHOTOS_PER_DAY,
    })
    if (error) throw new Error(error.message)
    const v = (data || {}) as { ok?: boolean; reason?: string; used?: number }
    if (v.ok === false) return { ok: false, reason: v.reason === "daily-cap" ? "daily-cap" : "exhausted", used: v.used }
    return { ok: true, used: v.used }
  } catch (e) {
    // Closed, not open. See above.
    console.error("[pass-meter] photo meter unavailable — refusing rather than generating unmetered:", e instanceof Error ? e.message : String(e))
    return { ok: false, reason: "exhausted", unmetered: true }
  }
}

// ── the free minute ──────────────────────────────────────────────────────────
// A free caller hears the SAME premium voice a pass holder does — nobody is sold
// a downgrade — but only for about a minute of a call. Counted in characters the
// engine bills for, against two buckets:
//   • the browser id, for life — the minute is once, not once per visit;
//   • the IP, per day — bounds a visitor who clears storage for a new id, while
//     still letting a household or a carrier-NAT'd phone network have a bounded
//     number of first minutes a day rather than one between all of them.
// 0 for FREE_VOICE_CHARS switches the free meter off (launch mode).

/** ≈ one minute of a call: the character speaks roughly half of it. */
export const FREE_VOICE_CHARS = Math.max(0, Number(process.env.FREE_VOICE_CHARS ?? 400))
/** ≈ ten free minutes a day behind one IP, however many browser ids it mints. */
export const FREE_IP_DAILY_CHARS = Math.max(0, Number(process.env.FREE_IP_DAILY_CHARS ?? 4000))

const bucket = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32)

export async function spendFreeChars(visitorId: string | undefined, ip: string, chars: number): Promise<SpendVerdict> {
  if (!FREE_VOICE_CHARS) return { ok: true, unmetered: true }
  const vid = (visitorId || "").trim().slice(0, 80)
  if (vid) {
    const v = await spendChars(`free:v:${bucket(vid)}`, chars, FREE_VOICE_CHARS, FREE_VOICE_CHARS)
    if (!v.ok) return v
  }
  const ipv = await spendChars(`free:ip:${bucket(ip || "anon")}`, chars, Number.MAX_SAFE_INTEGER, FREE_IP_DAILY_CHARS)
  return ipv.ok ? ipv : { ...ipv, reason: "daily-cap" }
}
