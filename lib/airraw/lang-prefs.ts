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

import { LANGUAGES, DEFAULT_LANGUAGE, detectLanguage } from "@/lib/languages"
import { adultEnabled } from "@/lib/variant"
import { ethnicityForSeed } from "@/lib/airraw/portrait-prompt"
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

// ARABIC IS THE DEFAULT ON AIRRAW, NOT A DOOR YOU HAVE TO FIND.
//
// /ar was built as a dedicated Arabic entrance for the Gulf ad, and it set the
// language on the way through. Which meant airraw.com itself — the domain in the
// ad account, the one people type, the one every share link points at — was
// still English, and the Arabic product existed only for people who arrived
// through one specific URL.
//
// So the default moves to the product rather than the door. DEFAULT_LANGUAGE
// stays English because it is shared with Kloom, and Kloom is not an Arabic
// product; this override is inside the AIRRAW-only prefs module and gated on the
// AIRRAW build, so nothing about kloom.io changes.
//
// It is a DEFAULT, not a lock: anyone who picks a language gets what they picked,
// and that choice is what is read on every later visit.
// ...BUT THE BROWSER GETS THE FIRST WORD, BECAUSE THE TRAFFIC IS NOT WHO WE
// ASSUMED. Measured the day this shipped: 101 visitors, 92 of them from the US,
// three from the UAE, none from Saudi. A flat Arabic default would have opened
// an Arabic page for nine visitors in ten — the ads deliver, and they deliver
// mostly English speakers.
//
// So the rule is: whatever the browser asks for, if we support it. Only when the
// browser says nothing we recognise does AIRRAW fall to Arabic rather than
// English, which is what makes the Gulf the house default without making it the
// only language in the building.
const AIRRAW_DEFAULT_LANGUAGE = "Arabic"
function airrawDefaultLanguage(): string {
  if (!adultEnabled()) return DEFAULT_LANGUAGE
  try {
    const fromBrowser = detectLanguage()
    // detectLanguage() returns DEFAULT_LANGUAGE both when it MATCHED English and
    // when it matched nothing at all. Distinguish them, or an Arabic phone with
    // an unsupported locale would be handed English.
    const asked = typeof navigator !== "undefined"
      ? [...((navigator.languages as string[] | undefined) || []), navigator.language || ""].filter(Boolean)
      : []
    const sawSomethingWeSupport = fromBrowser !== DEFAULT_LANGUAGE
      || asked.some((c) => c.toLowerCase().split("-")[0] === "en")
    return sawSomethingWeSupport ? fromBrowser : AIRRAW_DEFAULT_LANGUAGE
  } catch { return AIRRAW_DEFAULT_LANGUAGE }
}
const DEFAULTS: LangPrefs = {
  get primary() { return airrawDefaultLanguage() },
  also: [],
}

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
/**
 * The ethnicities that read as Arab, out of the forty-five the portrait pool
 * draws from.
 *
 * Used to FILTER who is shown, never to change who is generated. ethnicityForSeed
 * feeds buildPortraitPrompt, which feeds PROMPT_FINGERPRINT, which is the face
 * cache key — so steering generation toward Arab faces would regenerate every
 * portrait in the product and bill for all of them. Selecting from the ones that
 * already are costs nothing.
 */
const ARAB = new Set([
  "North African", "Egyptian", "Moroccan", "Middle Eastern", "Gulf Arab", "Lebanese",
])

/**
 * Is this person Arab, as their own face already describes them?
 *
 * The written fifty are excluded from this test on purpose — in Arabic their
 * look comes from LOCALE_FACE.ar ("Levantine or Gulf Arab features"), so all
 * fifty of them ARE Arab in this locale, and the pooled ethnicity that a
 * generated character carries does not apply to them at all.
 */
export function isArabSeed(seedKey: string): boolean {
  return ARAB.has(ethnicityForSeed(seedKey))
}

/**
 * The Arabic entrance (/ar) promises a room of Arabic speakers, so it delivers
 * one — for everybody, pass or no pass.
 *
 * This is a deliberate hole in the rule below, and it is not the pass leaking.
 * `matchesPrefs` gates POOL STEERING on the pass: a paying user's taste and
 * languages shape who they meet. But a visitor who arrived through an Arabic ad,
 * read an Arabic page and picked an Arabic mood has not expressed a preference —
 * they have been sold a specific product, and a floor that opens in Mandarin is
 * not that product. Charging for the thing the advert already promised is how a
 * click becomes a bounce.
 */
export function arabicEntry(): boolean {
  // The /ar door sets this explicitly. But an Arabic visitor who simply typed
  // airraw.com is the same visitor and should get the same floor, so anyone
  // whose language IS Arabic counts as an Arabic arrival — the flag is now the
  // door's shortcut rather than the only way in.
  try {
    if (sessionStorage.getItem("airraw_arabic_entry") === "1") return true
  } catch { /* private mode */ }
  if (!adultEnabled()) return false
  try { return getLangPrefs().primary === "Arabic" } catch { return false }
}

export function markArabicEntry() {
  try { sessionStorage.setItem("airraw_arabic_entry", "1") } catch { /* private mode */ }
}

export function matchesPrefs(seedKey: string, p = getLangPrefs()): boolean {
  // An Arabic arrival gets the floor it was promised, pass or not, AND everyone
  // on it is Arab — which in this locale the written fifty already are, so this
  // only constrains the generated floor behind them.
  if (arabicEntry()) {
    // Language and origin only. Requiring an Arabic-looking NAME as well was
    // measured and abandoned: it left five to seven eligible people per heat band
    // and none at all around f≈0.15, because a walk holds `f` — and therefore the
    // archetype — fixed. Presentation solves it instead (arabic-names.ts), which
    // is what cast50 already does for the written fifty.
    return nativeLanguageFor(seedKey) === "Arabic" && isArabSeed(seedKey)
  }
  // Otherwise: steering the pool is part of the pass. Without it the floor is
  // unfiltered, exactly as it is today — a free session loses nothing it had.
  if (!isPro()) return true
  return spokenLanguages(p).includes(nativeLanguageFor(seedKey))
}
