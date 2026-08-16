// Which languages this person speaks — their default, plus any others.
//
// Three separate jobs, which is why it's a list and not a single setting:
//   1. DEFAULT — the language a new conversation opens in.
//   2. UNDERSTANDING — a character is told which languages this person speaks, so
//      switching mid-call is expected rather than surprising.
//   3. THE POOL — which characters they're shown. Someone who speaks Arabic
//      should be meeting people who natively speak it, not being handed a floor
//      that only opens in English.
//
// Stored per-browser. No account needed, same as the pass.

import { LANGUAGES, DEFAULT_LANGUAGE } from "@/lib/languages"
import { accentForSeed } from "@/lib/airraw/accent"
import { isPro } from "@/lib/airroom/pro"

const KEY = "airraw_langs"

// Anyone can choose their languages — picking them is not behind the pass, and a
// free session's choice works immediately and completely for that visit.
//
// What the pass adds is that the choice STICKS: a Pro session writes to
// localStorage, so it's their default every time they come back, and it steers
// which characters they're shown. A free session writes to sessionStorage, so it
// holds for the visit and is gone next time.
//
// Storage is resolved through a function rather than captured once, because the
// user can buy the pass mid-session and the very next save must be permanent.
function store(): Storage | null {
  try {
    return isPro() ? localStorage : sessionStorage
  } catch {
    return null
  }
}

/** Does the pass currently apply to language settings? */
export function langPrefsPersist(): boolean {
  return isPro()
}

export interface LangPrefs {
  /** Conversations open in this. */
  primary: string
  /** Other languages they speak. Never includes `primary`. */
  also: string[]
}

const DEFAULTS: LangPrefs = { primary: DEFAULT_LANGUAGE, also: [] }

const known = (n: string) => LANGUAGES.some((l) => l.name === n)

export function getLangPrefs(): LangPrefs {
  const st = store()
  if (!st) return { ...DEFAULTS }
  try {
    // Read the session's choice first, then fall back to a saved default. A Pro
    // user who changes language for one visit shouldn't have to change it back.
    let raw = st.getItem(KEY)
    if (!raw) { try { raw = localStorage.getItem(KEY) } catch { /* */ } }
    if (!raw) return { ...DEFAULTS }
    const p = JSON.parse(raw)
    const primary = known(p?.primary) ? p.primary : DEFAULT_LANGUAGE
    // Filter to known languages and drop the primary if it's duplicated in the
    // list — this is user-editable storage and a duplicate would show the same
    // language twice in the UI and twice in the prompt.
    const also: string[] = Array.isArray(p?.also)
      ? Array.from(new Set(p.also.filter((x: unknown) => typeof x === "string" && known(x) && x !== primary)))
      : []
    return { primary, also }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveLangPrefs(p: LangPrefs) {
  const primary = known(p.primary) ? p.primary : DEFAULT_LANGUAGE
  const also = Array.from(new Set(p.also.filter((x) => known(x) && x !== primary)))
  try { store()?.setItem(KEY, JSON.stringify({ primary, also })) } catch { /* private mode or quota */ }
}

/** Everything they speak, default first. */
export function spokenLanguages(p = getLangPrefs()): string[] {
  return [p.primary, ...p.also]
}

/**
 * The language a character natively opens in, from their accent — which comes
 * from the same seed as their face, so this never disagrees with how they look
 * or sound. Characters from Arabic-speaking regions default to Arabic; everyone
 * else to English.
 *
 * This is a DEFAULT, not a limit. Every character follows whatever language the
 * user actually speaks (see FOLLOW_THEIR_LANGUAGE in the chat route) — this only
 * decides where the conversation starts and who gets shown to whom.
 */
export function nativeLanguageFor(seedKey: string): string {
  return accentForSeed(seedKey).key.startsWith("AR_") ? "Arabic" : "English"
}

/**
 * Would this character be a natural match for what the user speaks?
 *
 * A strict match on native language. Someone who speaks only Arabic should be
 * meeting people who open in Arabic, not a floor that opens in English and
 * switches once they say something.
 *
 * Callers must treat a no-match result as "keep looking", never as "show
 * nothing" — a user whose languages nothing maps onto (the native mapping only
 * produces Arabic or English today) would otherwise get an empty floor. See
 * pickForLanguages in the roster, which always returns somebody.
 */
export function matchesPrefs(seedKey: string, p = getLangPrefs()): boolean {
  // Steering the pool is part of the pass. Without it the floor is unfiltered,
  // exactly as it is today — a free session loses nothing it already had.
  if (!isPro()) return true
  return spokenLanguages(p).includes(nativeLanguageFor(seedKey))
}
