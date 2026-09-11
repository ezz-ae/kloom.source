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
 * DEVICES ON A PASS, COUNTED IN THE METER WE ALREADY HAVE.
 *
 * A pass bought by email can be opened from another phone by typing that email
 * — no password, which is what makes it usable by someone who has lost their
 * code. The bound on that is the number of devices, and counting devices needs
 * exactly what pass_usage already is: a key with a counter and a cap, applied
 * atomically. So no new table, and nothing for anyone to run.
 *
 * Two keys. The device's own key answers "have I seen this phone before" — the
 * first spend on it comes back as 1. Only a phone that is NEW spends from the
 * email's device budget, so coming back to a phone you already used is free and
 * does not burn a change.
 *
 * It fails OPEN, like the rest of the meter: if the table is missing or the
 * database is down, a buyer is let in rather than locked out of what they paid
 * for. A cap that occasionally lets an extra phone in is a smaller failure than
 * one that refuses the owner.
 */
export const PASS_DEVICES = Math.max(1, Number(process.env.AIRRAW_PASS_DEVICES || 3))

export async function claimDevice(email: string, deviceId: string): Promise<{ ok: boolean; devices?: number; limit: number }> {
  const e = (email || "").trim().toLowerCase()
  const d = (deviceId || "").trim()
  if (!e || !d) return { ok: false, limit: PASS_DEVICES }
  const seen = await spendChars(`dev:${bucket(e)}:${bucket(d)}`, 1, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
  // Unmetered means the meter is unavailable — let them in.
  if (seen.unmetered) return { ok: true, limit: PASS_DEVICES }
  if ((seen.used ?? 1) > 1) return { ok: true, limit: PASS_DEVICES }   // a phone already on this pass
  const budget = await spendChars(`devs:${bucket(e)}`, 1, PASS_DEVICES, Number.MAX_SAFE_INTEGER)
  if (budget.unmetered) return { ok: true, limit: PASS_DEVICES }
  if (!budget.ok) return { ok: false, devices: budget.used, limit: PASS_DEVICES }
  return { ok: true, devices: budget.used, limit: PASS_DEVICES }
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
/**
 * ≈ sixty free minutes a day behind one IP, however many browser ids it mints.
 *
 * This was ten (4,000). Ten is a household; it is not a phone network. Ad
 * traffic arrives on mobile data through carrier-grade NAT, where hundreds of
 * phones share one public address — so on a day the ads delivered a hundred
 * visitors, the eleventh phone on each carrier was told its free minute was
 * used before it had heard a word, and every phone after it too. The
 * per-browser minute above is what makes the minute a minute; this bucket only
 * bounds a visitor who mints ids by clearing storage, and sixty minutes a day
 * bounds that plenty. Still env-overridable; 0 disables the free meter.
 */
export const FREE_IP_DAILY_CHARS = Math.max(0, Number(process.env.FREE_IP_DAILY_CHARS ?? 24_000))

const bucket = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32)

// ── the wall still has to stand when the meter is down ───────────────────────
// spendChars fails OPEN when the row-locked meter is unreachable. For a PASS
// HOLDER that is the right call: losing the voice you paid for because a table
// is missing is worse than a few unmetered minutes.
//
// For a FREE visitor it is the opposite. Failing open does not degrade the free
// minute, it DELETES it — every visitor gets unlimited premium voice, and the
// product is given away in full, in the expensive engine, to everyone. That is
// not a hypothetical: with the meter's table missing, a single day served 1,818
// voice calls and showed the paywall exactly once.
//
// So when the durable meter cannot answer, a per-instance counter answers in its
// place. It leaks by nature — serverless instances come and go, and each new one
// starts a visitor back at zero — so it is a weaker wall, not an equal one. A
// wall that stands most of the time is still the difference between a business
// and a free service, and it costs nothing when the table exists, because it
// only runs when the real meter could not be reached.
const memFree = new Map<string, { chars: number; at: number }>()
const MEM_TTL = 24 * 3_600_000

function spendMem(key: string, chars: number, cap: number): boolean {
  const now = Date.now()
  // Bound the map on a long-lived instance rather than letting it grow forever.
  if (memFree.size > 5000) {
    for (const [k, v] of memFree) if (now - v.at > MEM_TTL) memFree.delete(k)
  }
  const cur = memFree.get(key)
  const used = cur && now - cur.at < MEM_TTL ? cur.chars : 0
  if (used + chars > cap) return false
  memFree.set(key, { chars: used + chars, at: now })
  return true
}

export async function spendFreeChars(visitorId: string | undefined, ip: string, chars: number): Promise<SpendVerdict> {
  if (!FREE_VOICE_CHARS) return { ok: true, unmetered: true }
  const vid = (visitorId || "").trim().slice(0, 80)
  if (vid) {
    const v = await spendChars(`free:v:${bucket(vid)}`, chars, FREE_VOICE_CHARS, FREE_VOICE_CHARS)
    if (!v.ok) return v
    // The durable meter counted nothing. Count it here instead, or the free
    // minute is not a minute — it is everything, forever, for nothing.
    if (v.unmetered && !spendMem(`v:${bucket(vid)}`, chars, FREE_VOICE_CHARS)) {
      return { ok: false, reason: "exhausted" }
    }
  }
  const ipv = await spendChars(`free:ip:${bucket(ip || "anon")}`, chars, Number.MAX_SAFE_INTEGER, FREE_IP_DAILY_CHARS)
  if (!ipv.ok) return { ...ipv, reason: "daily-cap" }
  if (ipv.unmetered && !spendMem(`ip:${bucket(ip || "anon")}`, chars, FREE_IP_DAILY_CHARS)) {
    return { ok: false, reason: "daily-cap" }
  }
  return ipv
}
