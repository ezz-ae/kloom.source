/**
 * Lightweight account state (client-side). "Subscribed" gates premium actions
 * like inviting a partner into a couple room. Set when the user buys the
 * unlimited voice pass or a Creator subscription; persisted locally and
 * (ideally) mirrored to Supabase by wallet later.
 */

import { hasUnlimited, LAUNCH_UNLIMITED } from "@/lib/voice-credits"
import { hasActivePass } from "@/lib/pricing"
import { isPro } from "@/lib/airroom/pro"

const SUB_KEY    = "kloom_subscribed"
const UNREST_KEY = "kloom_unrestricted"

/**
 * Unrestricted — full no-restriction mode across the WHOLE platform (every
 * model + character, no content limits). Included in the ONE pass (the anonymous
 * airraw_pro token). During launch mode everything is unlocked for testing.
 */
export function hasUnrestricted(): boolean {
  if (LAUNCH_UNLIMITED) return true
  if (isPro()) return true           // the ONE pass includes full unrestriction
  if (hasActivePass()) return true   // legacy kloom pass
  try { return localStorage.getItem(UNREST_KEY) === "1" } catch { return false }
}
export function setUnrestricted(on: boolean) {
  try { on ? localStorage.setItem(UNREST_KEY, "1") : localStorage.removeItem(UNREST_KEY) } catch {}
}

// On-device chat memory — keep full conversation history on THIS device (default ON).
// Turning it off stops new saves AND wipes what's stored. Independent of the variant gate.
const MEM_KEY = "kloom_keep_memory"
export function keepMemory(): boolean {
  try { return localStorage.getItem(MEM_KEY) !== "0" } catch { return true }
}
export function setKeepMemory(on: boolean) {
  try {
    if (on) localStorage.removeItem(MEM_KEY)
    else { localStorage.setItem(MEM_KEY, "0"); localStorage.removeItem("kloom_room_chats_v1") }
  } catch {}
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
