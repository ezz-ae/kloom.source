"use client"

// THE ARABIC BUILD OF THE INTERFACE.
//
// No library, no key namespace, no extraction step. The ENGLISH STRING IS THE
// KEY: `t("say something to the room")` returns the Arabic when the locale is
// Arabic and returns its own argument otherwise. Three things follow, and they
// are why it is built this way rather than the usual way:
//
//   · An untranslated string degrades to English, never to `room.input.placeholder`
//     on a live screen. With five hundred strings to move, something WILL be
//     missed, and the failure mode has to be "still readable" rather than "broken".
//   · Kloom is untouched by construction. Its locale is never Arabic, so `t`
//     returns the identity function and the rendered output is byte-identical.
//   · A translation can be added or removed without touching the component.
//
// The locale comes from the language preference the visitor already set — /ar
// writes `primary: "Arabic"` before it hands over — so there is one source of
// truth for "what language is this person in" and the interface, the floor and
// the characters all read it.
//
// HYDRATION. The preference lives in storage, which the server cannot see, so
// the server renders English and the client switches on mount. That is one frame
// of English rather than a hydration mismatch, which is the right trade: a
// mismatch makes React throw away and re-render the tree, and on this app that
// is the floor flashing empty.

import { useEffect, useState } from "react"
import { getLangPrefs } from "@/lib/airraw/lang-prefs"
import { AR } from "@/lib/airraw/ar"
import { AR_CONTENT } from "@/lib/airraw/ar-content"

export type Locale = "en" | "ar"

/** The locale right now, from the language the visitor chose. Client-only. */
export function currentLocale(): Locale {
  try {
    return getLangPrefs().primary === "Arabic" ? "ar" : "en"
  } catch {
    return "en"
  }
}

/** Right-to-left languages. One today; the shape is here for the next one. */
export function isRTL(l: Locale): boolean {
  return l === "ar"
}

/**
 * Translate, with the English as the key.
 *
 * `vars` interpolates `{name}`-style placeholders AFTER lookup, so a translation
 * can move them: Arabic word order is not English word order, and a format that
 * forces the same order produces the stilted machine-Arabic that tells a reader
 * immediately that nobody who speaks it was involved.
 */
export function translate(key: string, locale: Locale, vars?: Record<string, string | number>): string {
  // Interface first, then content. Two files because they are two jobs: AR is
  // translation, AR_CONTENT is writing — the characters' own lines, the rooms
  // they sit in, the scenes. One lookup so no caller has to know which is which,
  // and both degrade to English independently as they get filled in.
  let out = locale === "ar" ? (AR[key] ?? AR_CONTENT[key] ?? key) : key
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v))
  return out
}

export interface T {
  (key: string, vars?: Record<string, string | number>): string
  locale: Locale
  rtl: boolean
  /** For a container that should mirror: `dir={t.dir}`. */
  dir: "rtl" | "ltr"
}

/**
 * The hook every component uses.
 *
 * Starts at "en" on purpose and moves after mount — see the hydration note above.
 */
export function useT(): T {
  const [locale, setLocale] = useState<Locale>("en")
  useEffect(() => { setLocale(currentLocale()) }, [])
  const fn = ((key: string, vars?: Record<string, string | number>) => translate(key, locale, vars)) as T
  fn.locale = locale
  fn.rtl = isRTL(locale)
  fn.dir = isRTL(locale) ? "rtl" : "ltr"
  return fn
}
