// THE LANGUAGE OF THE APP IS A CHOICE, NOT A CONSEQUENCE.
//
// Until now there was no such choice: the interface simply followed whichever
// language conversations were set to, so picking Arabic to TALK in also turned
// every button, label and sheet Arabic, and there was no way to want one
// without the other. Plenty of people read an interface in English and would
// rather speak Arabic, and plenty the other way round.
//
// So the interface language is its own preference, stored on the device:
//   · unset  → follow the conversation language, exactly as before
//   · "ar"   → the app is in Arabic
//   · "en"   → the app is in English
//
// And it has to be FINDABLE. Someone arriving from an Arab country must see the
// word عربي without hunting for it — a person who cannot read the screen cannot
// find the setting that would let them read the screen.
import { getLangPrefs } from "@/lib/airraw/lang-prefs"

const KEY = "airraw_ui_lang"

export type UiLang = "ar" | "en"

/** The explicit choice, or null when they have not made one. */
export function uiLangChoice(): UiLang | null {
  if (typeof window === "undefined") return null
  try {
    const v = localStorage.getItem(KEY)
    return v === "ar" || v === "en" ? v : null
  } catch { return null }
}

export function setUiLang(l: UiLang | null): void {
  try {
    if (l) localStorage.setItem(KEY, l)
    else localStorage.removeItem(KEY)
  } catch { /* private mode */ }
  // The page direction and every mounted translator follow this.
  try { window.dispatchEvent(new CustomEvent("airraw:langs")) } catch { /* SSR */ }
}

/**
 * Somewhere Arabic is the language of the street.
 *
 * The timezone, because it is the one signal a browser gives that survives a
 * phone set to English — which is most phones in the Gulf. `navigator.language`
 * is the second question, not the first.
 */
const ARAB_ZONES = new Set([
  "asia/riyadh", "asia/dubai", "asia/qatar", "asia/bahrain", "asia/kuwait", "asia/muscat",
  "asia/aden", "asia/baghdad", "asia/beirut", "asia/damascus", "asia/amman", "asia/jerusalem",
  "asia/gaza", "asia/hebron", "africa/cairo", "africa/khartoum", "africa/tripoli", "africa/tunis",
  "africa/algiers", "africa/casablanca", "africa/el_aaiun", "africa/nouakchott", "africa/djibouti",
  "africa/mogadishu", "indian/comoro",
])

export function inArabRegion(): boolean {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (z && ARAB_ZONES.has(z.toLowerCase())) return true
  } catch { /* older engines */ }
  try {
    const langs = [...(navigator.languages || []), navigator.language || ""]
    if (langs.some((l) => /^ar\b|-ar$|^ar-/i.test(String(l)))) return true
  } catch { /* SSR */ }
  return false
}

/**
 * Should the screen offer Arabic?
 *
 * Yes where Arabic is plausibly theirs — they are in an Arab country, their
 * browser asks for Arabic, or they have set conversations to Arabic — and yes
 * whenever the app is already Arabic, because the way back out has to be at
 * least as visible as the way in.
 */
export function offerArabic(): boolean {
  if (typeof window === "undefined") return false
  if (uiLangChoice()) return true
  if (inArabRegion()) return true
  try { return getLangPrefs().primary === "Arabic" } catch { return false }
}
