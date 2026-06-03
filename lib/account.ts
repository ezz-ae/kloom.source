/**
 * Lightweight account state (client-side). "Subscribed" gates premium actions
 * like inviting a partner into a couple room. Set when the user buys the
 * unlimited voice pass or a Creator subscription; persisted locally and
 * (ideally) mirrored to Supabase by wallet later.
 */

import { hasUnlimited, LAUNCH_UNLIMITED } from "@/lib/voice-credits"

const SUB_KEY    = "kloom_subscribed"
const UNREST_KEY = "kloom_unrestricted"

/**
 * The $95/mo "Unrestricted" tier — full no-restriction mode across the WHOLE
 * platform (every model + character, no content limits). During launch mode
 * everything is unlocked for testing.
 */
export function hasUnrestricted(): boolean {
  if (LAUNCH_UNLIMITED) return true
  try { return localStorage.getItem(UNREST_KEY) === "1" } catch { return false }
}
export function setUnrestricted(on: boolean) {
  try { on ? localStorage.setItem(UNREST_KEY, "1") : localStorage.removeItem(UNREST_KEY) } catch {}
}

export function isSubscribed(): boolean {
  try {
    if (localStorage.getItem(SUB_KEY) === "1") return true
  } catch {}
  // The unlimited voice pass counts as a premium account.
  return hasUnlimited()
}

export function setSubscribed(on: boolean) {
  try { on ? localStorage.setItem(SUB_KEY, "1") : localStorage.removeItem(SUB_KEY) } catch {}
}

/**
 * Pull the wallet's real premium status from the server (Ziina subscription /
 * unlimited pass) and mirror it into localStorage, so the synchronous
 * isSubscribed() reflects actual paid state instead of trusting the browser.
 * Call on wallet connect. No-op on failure (keeps whatever was cached).
 */
export async function refreshAccountStatus(wallet?: string | null): Promise<boolean> {
  if (!wallet) return isSubscribed()
  try {
    const res  = await fetch(`/api/account-status?wallet=${encodeURIComponent(wallet)}`)
    const data = await res.json()
    if (data?.ok) { setSubscribed(!!data.premium); setUnrestricted(!!data.unrestricted); return !!data.premium }
  } catch {}
  return isSubscribed()
}
