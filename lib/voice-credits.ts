/**
 * Voice economy — how voice MINUTES are consumed.
 *
 * Dollars become minutes in lib/pricing.ts (FlexiCalls slider + passes), which
 * is the single source of truth for pricing — this file never reasons in
 * dollars, only in seconds/minutes already bought. Text is free; voice (calls +
 * AI voice notes) draws from a shared allowance:
 *   1. First 5 minutes free (one-time, tracked locally).
 *   2. After that, FlexiCalls minutes bought via the slider (1 credit = 1 min).
 *   3. A pass = unlimited voice within a generous daily fair-use cap
 *      (PASS_DAILY_CAP_MIN), so one heavy day can't burn unbounded COGS.
 */

import { adultEnabled } from "@/lib/variant"
// AIRRAW: ONE free minute, the same premium voice a pass holder gets — and the
// server meters it too (lib/airraw/pass-meter.ts), so this is the on-screen
// number, not the enforcement. Kloom keeps its five.
export const FREE_SECONDS = adultEnabled() ? 60 : 300

// Passes are "unlimited" voice, but only within a generous daily fair-use cap so
// a single outlier can't burn unbounded LLM+TTS cost against a flat pass price.
// 240 min/day = 4h — well beyond any normal use; resets at local midnight.
export const PASS_DAILY_CAP_MIN = 240
const PASS_DAILY_CAP_SEC = PASS_DAILY_CAP_MIN * 60

const FREE_USED_KEY  = "kloom_voice_free_used_sec"
const PAID_USED_KEY  = "kloom_voice_paid_used_sec"   // sub-minute rollover for notes
const UNLIMITED_KEY  = "kloom_voice_unlimited"
const PASS_DAY_KEY   = "kloom_pass_day_used"          // { day, sec } — pass fair-use

// ── LAUNCH MODE — everything unlimited until billing is finished ──
// While true, ALL voice is free/unlimited for everyone (no free-pool cap, no
// paid deduction) and the premium tier unlocks. Turn OFF in env when billing is
// live:  NEXT_PUBLIC_FREE_UNLIMITED=0  (voice then bills via the slider again).
export const LAUNCH_UNLIMITED =
  (process.env.NEXT_PUBLIC_FREE_UNLIMITED ?? "1") !== "0"

// ── unlimited pass ──
import { hasActivePass } from "@/lib/pricing"
import { isPro } from "@/lib/airroom/pro"

export function hasUnlimited(): boolean {
  if (LAUNCH_UNLIMITED) return true
  if (isPro()) return true           // the ONE pass (anonymous airraw_pro token) — voice incl.
  if (hasActivePass()) return true   // legacy kloom pass — unlimited voice
  try { return localStorage.getItem(UNLIMITED_KEY) === "1" } catch { return false }
}
export function setUnlimited(on: boolean) {
  try { on ? localStorage.setItem(UNLIMITED_KEY, "1") : localStorage.removeItem(UNLIMITED_KEY) } catch {}
}

/** Holds an unlimited entitlement (a pass, or the local unlimited flag) — the
 *  thing the daily fair-use cap applies to. Deliberately EXCLUDES launch mode,
 *  which is the pre-billing "everything free" state and is uncapped by design. */
function hasPassUnlimited(): boolean {
  if (isPro()) return true           // the ONE pass — metered against the daily fair-use cap
  if (hasActivePass()) return true
  try { return localStorage.getItem(UNLIMITED_KEY) === "1" } catch { return false }
}

// ── pass daily fair-use tracking (resets at local midnight) ──
function passDayUsedSec(): number {
  try {
    const raw = JSON.parse(localStorage.getItem(PASS_DAY_KEY) || "null")
    if (!raw || raw.day !== new Date().toDateString()) return 0
    return Math.max(0, Number(raw.sec) || 0)
  } catch { return 0 }
}
function addPassDaySec(sec: number) {
  const total = passDayUsedSec() + Math.max(0, Math.round(sec))
  try { localStorage.setItem(PASS_DAY_KEY, JSON.stringify({ day: new Date().toDateString(), sec: total })) } catch {}
}

/** Does the current pass still cover voice today (i.e. under the daily cap)? */
export function passCoversVoice(): boolean {
  return hasPassUnlimited() && passDayUsedSec() < PASS_DAILY_CAP_SEC
}
/** Minutes of pass voice left today (Infinity in launch mode, 0 without a pass). */
export function passMinutesLeftToday(): number {
  if (LAUNCH_UNLIMITED) return Infinity
  if (!hasPassUnlimited()) return 0
  return Math.max(0, PASS_DAILY_CAP_MIN - Math.floor(passDayUsedSec() / 60))
}

// ── free-pool tracking (localStorage) ──
export function getFreeUsedSec(): number {
  try { return parseInt(localStorage.getItem(FREE_USED_KEY) ?? "0", 10) || 0 } catch { return 0 }
}
export function getFreeRemainingSec(): number {
  return Math.max(0, FREE_SECONDS - getFreeUsedSec())
}
function setFreeUsedSec(s: number) {
  try { localStorage.setItem(FREE_USED_KEY, String(Math.min(FREE_SECONDS, Math.round(s)))) } catch {}
}

// ── paid sub-minute rollover (so a 15s note doesn't cost a whole minute) ──
function getPaidUsedSec(): number {
  try { return parseInt(localStorage.getItem(PAID_USED_KEY) ?? "0", 10) || 0 } catch { return 0 }
}
function setPaidUsedSec(s: number) {
  try { localStorage.setItem(PAID_USED_KEY, String(Math.max(0, Math.round(s)))) } catch {}
}

export interface ConsumeResult {
  ok: boolean
  creditsToDeduct: number    // whole minutes to remove from paid balance
  blocked?: boolean          // true if not enough free + paid
}

/**
 * Account for `seconds` of voice. Eats the free pool first, then paid.
 * `paidCredits` is the current paid balance (in minutes). Returns how many
 * credits to deduct (caller does the actual spend) and whether it was allowed.
 */
export function consumeVoice(seconds: number, paidCredits: number): ConsumeResult {
  // Launch mode — everything free, no metering, no cap.
  if (LAUNCH_UNLIMITED) return { ok: true, creditsToDeduct: 0 }

  let remaining = Math.max(0, Math.round(seconds))
  if (remaining === 0) return { ok: true, creditsToDeduct: 0 }

  // Pass — covers voice for free up to the daily fair-use cap; anything beyond
  // the cap falls through to the free/paid pools below, so a single outlier day
  // can't burn unbounded COGS against a flat pass price.
  if (hasPassUnlimited()) {
    const passLeft = Math.max(0, PASS_DAILY_CAP_SEC - passDayUsedSec())
    const fromPass = Math.min(passLeft, remaining)
    if (fromPass > 0) { addPassDaySec(fromPass); remaining -= fromPass }
    if (remaining === 0) return { ok: true, creditsToDeduct: 0 }
  }

  // 1) free pool
  const freeLeft = getFreeRemainingSec()
  const fromFree = Math.min(freeLeft, remaining)
  if (fromFree > 0) { setFreeUsedSec(getFreeUsedSec() + fromFree); remaining -= fromFree }
  if (remaining === 0) return { ok: true, creditsToDeduct: 0 }

  // 2) paid pool — roll sub-minute usage so short notes are cheap
  const paidSecAvailable = paidCredits * 60 - getPaidUsedSec()
  if (paidSecAvailable < remaining) {
    return { ok: false, creditsToDeduct: 0, blocked: true }
  }
  const newPaidUsed = getPaidUsedSec() + remaining
  const creditsToDeduct = Math.floor(newPaidUsed / 60)
  setPaidUsedSec(newPaidUsed - creditsToDeduct * 60)
  return { ok: true, creditsToDeduct }
}

/** Can the user start any voice right now? Cap-aware: a pass only counts while
 *  it still covers voice today (under the daily fair-use cap), so a capped-out
 *  pass holder is blocked at the START gate — not mid-call — and can't reconnect
 *  to bleed COGS past the cap. */
export function voiceAvailable(paidCredits: number): boolean {
  if (LAUNCH_UNLIMITED) return true
  if (passCoversVoice()) return true
  return getFreeRemainingSec() > 0 || paidCredits * 60 - getPaidUsedSec() > 0
}
