// AIRRAW credits — a light, local balance that gives free visitors a taste of the
// premium moment (AIR: lighting up your best matches) without paying. Each AIR
// costs one credit; Pro never spends (it's unlimited); when the balance hits zero
// the Pro sheet does the asking. Cosmetic/soft economy, same posture as ./pro —
// the real money path stays the server-verified Ziina pass.

import { isPro } from "./pro"

export const FREE_GRANT = 15            // credits a new visitor starts with

const BAL_KEY   = "airraw_credits"
const GRANT_KEY = "airraw_credits_granted"

/** Current balance. First read seeds the one-time free grant. Pro = unlimited. */
export function getCredits(): number {
  if (typeof window === "undefined") return FREE_GRANT
  try {
    if (!localStorage.getItem(GRANT_KEY)) {
      localStorage.setItem(GRANT_KEY, "1")
      localStorage.setItem(BAL_KEY, String(FREE_GRANT))
      return FREE_GRANT
    }
    const n = Number(localStorage.getItem(BAL_KEY))
    return Number.isFinite(n) ? Math.max(0, n) : 0
  } catch { return FREE_GRANT }
}

/** Try to spend n credits. Pro always succeeds (and never deducts). Returns
 *  false (without deducting) when a free user can't afford it. */
export function spendCredits(n = 1): boolean {
  if (isPro()) return true
  const bal = getCredits()
  if (bal < n) return false
  try { localStorage.setItem(BAL_KEY, String(bal - n)) } catch { /* */ }
  return true
}

export function addCredits(n: number): number {
  const bal = getCredits() + Math.max(0, n)
  try { localStorage.setItem(BAL_KEY, String(bal)) } catch { /* */ }
  return bal
}

/** What the profile shows: a number for free users, ∞ for Pro. */
export function creditsLabel(): string {
  return isPro() ? "∞" : String(getCredits())
}
