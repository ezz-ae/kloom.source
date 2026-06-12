/**
 * Voice economy. The AI sells its voice — text is free, voice (calls + AI voice
 * notes) draws from a shared allowance:
 *   1. First 5 minutes free (one-time, tracked locally).
 *   2. After that, pay-as-you-go credits ($0.10/min → $1 = 10 min).
 *   3. At the top of the slider ($60) it's UNLIMITED calls — a flat pass.
 *
 * Slider: $1 → $60. Everything below $60 buys minutes; $60 unlocks unlimited.
 */

export const FREE_SECONDS    = 300          // 5 free minutes of voice
export const USD_PER_MINUTE  = 0.10         // $1 = 10 minutes
export const MIN_TOPUP_USD   = 1
export const MAX_TOPUP_USD   = 60           // $60 = unlimited
export const UNLIMITED_USD   = 60

const FREE_USED_KEY  = "kloom_voice_free_used_sec"
const PAID_USED_KEY  = "kloom_voice_paid_used_sec"   // sub-minute rollover for notes
const UNLIMITED_KEY  = "kloom_voice_unlimited"

// ── LAUNCH MODE — everything unlimited until billing is finished ──
// While true, ALL voice is free/unlimited for everyone (no free-pool cap, no
// paid deduction) and the premium tier unlocks. Turn OFF in env when billing is
// live:  NEXT_PUBLIC_FREE_UNLIMITED=0  (voice then bills via the slider again).
export const LAUNCH_UNLIMITED =
  (process.env.NEXT_PUBLIC_FREE_UNLIMITED ?? "1") !== "0"

// ── unlimited pass ──
import { hasActivePass } from "@/lib/pricing"

export function hasUnlimited(): boolean {
  if (LAUNCH_UNLIMITED) return true
  if (hasActivePass()) return true   // Dayuse / Holyweek / Super30 — unlimited voice
  try { return localStorage.getItem(UNLIMITED_KEY) === "1" } catch { return false }
}
export function setUnlimited(on: boolean) {
  try { on ? localStorage.setItem(UNLIMITED_KEY, "1") : localStorage.removeItem(UNLIMITED_KEY) } catch {}
}
/** Is this slider value the unlimited tier? */
export const isUnlimitedTier = (usd: number) => usd >= UNLIMITED_USD

// ── conversions ──
export const usdToMinutes = (usd: number) => Math.round(usd / USD_PER_MINUTE)
export const minutesToUsd = (min: number) => min * USD_PER_MINUTE
export const usdToCredits = (usd: number) => usdToMinutes(usd) // 1 credit = 1 min

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
  // Unlimited pass — never deducts.
  if (hasUnlimited()) return { ok: true, creditsToDeduct: 0 }

  let remaining = Math.max(0, Math.round(seconds))

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

/** Can the user start any voice right now? */
export function voiceAvailable(paidCredits: number): boolean {
  return hasUnlimited() || getFreeRemainingSec() > 0 || paidCredits * 60 - getPaidUsedSec() > 0
}
