/**
 * Canonical language registry — one source of truth for the conversation
 * languages Kloom supports. Each entry carries the display name (what a persona
 * stores), its BCP-47 tag (browser STT), and ISO-639-1 code (Whisper + Fish
 * voice lookup).
 *
 * Also the client-side auto-detector: it maps the visitor's browser locale to a
 * supported language so a room opens in THEIR language instead of defaulting to
 * English — the single biggest conversion lever for non-English ad traffic.
 */
export interface Language {
  name: string    // display + persona.language value
  bcp47: string   // browser SpeechRecognition lang
  iso: string     // ISO-639-1 (Whisper STT + Fish voice env lookup)
}

export const LANGUAGES: Language[] = [
  { name: "English",    bcp47: "en-US", iso: "en" },
  { name: "Spanish",    bcp47: "es-ES", iso: "es" },
  { name: "French",     bcp47: "fr-FR", iso: "fr" },
  { name: "German",     bcp47: "de-DE", iso: "de" },
  { name: "Italian",    bcp47: "it-IT", iso: "it" },
  { name: "Portuguese", bcp47: "pt-PT", iso: "pt" },
  { name: "Japanese",   bcp47: "ja-JP", iso: "ja" },
  { name: "Korean",     bcp47: "ko-KR", iso: "ko" },
  { name: "Chinese",    bcp47: "zh-CN", iso: "zh" },
  { name: "Arabic",     bcp47: "ar-SA", iso: "ar" },
  { name: "Hindi",      bcp47: "hi-IN", iso: "hi" },
  { name: "Russian",    bcp47: "ru-RU", iso: "ru" },
  { name: "Dutch",      bcp47: "nl-NL", iso: "nl" },
  { name: "Turkish",    bcp47: "tr-TR", iso: "tr" },
  { name: "Polish",     bcp47: "pl-PL", iso: "pl" },
]

export const DEFAULT_LANGUAGE = "English"

/** name → BCP-47, used by the voice hook for browser SpeechRecognition. */
export const LANGUAGE_TO_BCP47: Record<string, string> =
  Object.fromEntries(LANGUAGES.map((l) => [l.name, l.bcp47]))

const ISO_TO_NAME: Record<string, string> =
  Object.fromEntries(LANGUAGES.map((l) => [l.iso, l.name]))

/** ISO-639-1 code for a language name (for Whisper STT + Fish voice env keys). */
export function isoForLanguage(name?: string): string {
  const l = LANGUAGES.find((x) => x.name === name)
  return l ? l.iso : "en"
}

/**
 * The visitor's preferred supported language NAME, from the browser locale.
 * SSR-safe: returns DEFAULT_LANGUAGE when navigator is unavailable, so it never
 * breaks server render or hydration. Walks navigator.languages in order, taking
 * the first that maps to something we support.
 */
export function detectLanguage(): string {
  if (typeof navigator === "undefined") return DEFAULT_LANGUAGE
  const candidates: string[] = [
    ...((navigator.languages as string[] | undefined) || []),
    navigator.language || "",
  ].filter(Boolean)
  for (const c of candidates) {
    const iso = c.toLowerCase().split("-")[0]
    if (ISO_TO_NAME[iso]) return ISO_TO_NAME[iso]
  }
  return DEFAULT_LANGUAGE
}
