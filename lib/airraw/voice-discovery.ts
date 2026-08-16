// Find real accented voices in the ElevenLabs account, automatically.
//
// WHY: the default (premade) voice set is ~21 voices and every one of them is
// American, British or Australian. Nine are flagged as "verified" for Arabic —
// but with accent "standard", which means an English voice reading Arabic. That
// is precisely the complaint: the Arabic voices sound like English speakers.
// No amount of prompt work fixes that; it needs different voices.
//
// So rather than asking anyone to hand-curate voice IDs into env vars, this
// reads the account's OWN voice list and sorts what's there into accent pools.
// Any voice added to the account — cloned, or added from the shared library —
// is picked up automatically on the next refresh.
//
// SAFETY: read-only. It never adds, edits or removes a voice on the account.
// Accounts have a hard cap on custom voice slots, so silently filling them from
// the shared library would be destructive in a way that's tedious to undo.
// Use scripts/find-accent-voices.mjs to see what the library offers and add the
// ones you want deliberately.
//
// Env still wins: an explicit ELEVENLABS_VOICES_<ACCENT>_<GENDER> list overrides
// anything discovered here.

/**
 * Accent key (see accent.ts) → how to recognise it on a voice.
 *
 * `lang`    the language the accent belongs to. A voice is only considered for an
 *           accent if it's actually verified for that language — otherwise an
 *           English voice merely *verified for Spanish* lands in the Latin pool.
 * `locales` BCP-47 locales, the strongest signal there is: ar-EG is Egyptian, full
 *           stop, no guessing from a marketing name.
 * `terms`   words matched with WORD BOUNDARIES, never as substrings. Substring
 *           matching put "R-omani-an" in the Khaleeji pool and every "wo-man" at
 *           risk; that is how British and "EN-" voices ended up cast as Gulf Arabs.
 *
 * Order matters: the first entry that matches wins, so a country beats the region
 * it sits in and one voice can't be both Egyptian and Khaleeji.
 */
interface AccentSpec { lang: string; locales: string[]; terms: string[] }

const ACCENT_SPECS: Array<[string, AccentSpec]> = [
  ["AR_EG",   { lang: "ar", locales: ["ar-eg"], terms: ["egyptian", "egypt", "cairo", "masri", "masry"] }],
  ["AR_MA",   { lang: "ar", locales: ["ar-ma"], terms: ["moroccan", "morocco", "darija", "maghrebi"] }],
  ["AR_TN",   { lang: "ar", locales: ["ar-tn"], terms: ["tunisian", "tunisia", "derja"] }],
  ["AR_LB",   { lang: "ar", locales: ["ar-lb", "ar-sy", "ar-jo", "ar-ps"],
                terms: ["lebanese", "lebanon", "levantine", "syrian", "jordanian", "shami", "palestinian"] }],
  ["AR_GULF", { lang: "ar", locales: ["ar-sa", "ar-ae", "ar-kw", "ar-qa", "ar-bh", "ar-om"],
                terms: ["gulf", "khaleeji", "saudi", "emirati", "kuwaiti", "qatari", "bahraini", "omani"] }],
  ["EN_RU",   { lang: "en", locales: [], terms: ["russian", "slavic", "ukrainian"] }],
  ["EN_TR",   { lang: "en", locales: [], terms: ["turkish"] }],
  ["EN_FA",   { lang: "en", locales: [], terms: ["persian", "iranian", "farsi"] }],
  ["EN_IT",   { lang: "en", locales: [], terms: ["italian"] }],
  ["EN_IE",   { lang: "en", locales: ["en-ie"], terms: ["irish"] }],
  ["EN_DE",   { lang: "en", locales: [], terms: ["german"] }],
  ["EN_SE",   { lang: "en", locales: [], terms: ["swedish", "norwegian", "danish", "nordic", "scandinavian"] }],
  ["EN_NG",   { lang: "en", locales: ["en-ng"], terms: ["nigerian", "ghanaian", "kenyan", "west african"] }],
  ["EN_CARIB",{ lang: "en", locales: [], terms: ["caribbean", "jamaican", "trinidadian"] }],
  ["EN_IN",   { lang: "en", locales: ["en-in"], terms: ["indian", "pakistani", "bengali", "sri lankan", "hindi"] }],
  ["EN_LATAM",{ lang: "en", locales: [], terms: ["mexican", "colombian", "argentinian", "chilean", "latin american", "latino", "latina"] }],
  ["EN_BR",   { lang: "en", locales: [], terms: ["brazilian"] }],
  ["EN_PH",   { lang: "en", locales: ["en-ph"], terms: ["filipino", "tagalog"] }],
  ["EN_JP",   { lang: "en", locales: [], terms: ["japanese"] }],
  ["EN_KR",   { lang: "en", locales: [], terms: ["korean"] }],
  ["EN_CN",   { lang: "en", locales: [], terms: ["chinese", "mandarin", "cantonese"] }],
  ["EN_US_AAVE", { lang: "en", locales: [], terms: ["african american", "aave"] }],
]

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
/** Word-boundary match. "omani" must not fire on "Romanian". */
const hasWord = (hay: string, term: string) => new RegExp(`\\b${esc(term)}\\b`).test(hay)

interface ElevenVoice {
  voice_id?: string
  name?: string
  labels?: Record<string, string>
  verified_languages?: Array<{ language?: string; accent?: string; locale?: string }>
}

// accentKey|gender -> voice ids
let pools: Record<string, string[]> = {}
// iso|gender -> voice ids for voices whose NATIVE language is that language
let langPools: Record<string, string[]> = {}
let fetchedAt = 0
let inflight: Promise<void> | null = null
const TTL_MS = 6 * 60 * 60_000     // 6h — voices change when a human adds one

/**
 * Text an accent could be named in. Deliberately NOT the free-text description:
 * descriptions are marketing prose and matching them is how "a warm woman" and
 * "Romanian narrator" became Gulf Arabs. Name, accent labels and locales only.
 */
function haystack(v: ElevenVoice): string {
  const parts = [v.name || "", v.labels?.accent || ""]
  for (const vl of v.verified_languages || []) parts.push(vl.accent || "", vl.locale || "")
  return parts.join(" ").toLowerCase()
}

/** Languages this voice is actually verified to speak. */
function languagesOf(v: ElevenVoice): Set<string> {
  const out = new Set<string>()
  if (v.labels?.language) out.add(v.labels.language.toLowerCase())
  for (const vl of v.verified_languages || []) if (vl.language) out.add(vl.language.toLowerCase())
  return out
}

function genderOf(v: ElevenVoice): "MALE" | "FEMALE" | null {
  const g = (v.labels?.gender || "").toLowerCase()
  if (g.startsWith("m")) return "MALE"
  if (g.startsWith("f")) return "FEMALE"
  return null   // "neutral"/unknown — don't guess, it would mis-cast the voice
}

/** The ONE accent this voice belongs to, or null. First (most specific) wins. */
function accentOf(v: ElevenVoice): string | null {
  const hay = haystack(v)
  const langs = languagesOf(v)
  for (const [key, spec] of ACCENT_SPECS) {
    // Must actually speak the language the accent belongs to.
    if (!langs.has(spec.lang)) continue
    if (spec.locales.some((l) => hay.includes(l))) return key
    if (spec.terms.some((t) => hasWord(hay, t))) return key
  }
  return null
}

async function refresh(key: string): Promise<void> {
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": key },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`voices ${res.status}`)
  const data = (await res.json()) as { voices?: ElevenVoice[] }
  const next: Record<string, string[]> = {}
  const nextLang: Record<string, string[]> = {}
  for (const v of data.voices || []) {
    if (!v.voice_id) continue
    const g = genderOf(v)

    // NATIVE-language pool. Keyed on labels.language — the language the voice
    // actually IS — not verified_languages, which merely means "can pronounce".
    // Every premade English voice is verified for Arabic; that is exactly how an
    // Arabic character ended up sounding like Sarah or George. A voice belongs to
    // Arabic here only if Arabic is what it is.
    const native = (v.labels?.language || "").toLowerCase()
    if (native) {
      for (const gg of g ? [g] : ["MALE", "FEMALE"]) {
        (nextLang[`${native}|${gg}`] ||= []).push(v.voice_id)
      }
    }

    const accent = accentOf(v)
    if (!accent) continue
    // Filed under both genders when the voice doesn't declare one, so an
    // undeclared voice is still reachable rather than silently dropped.
    for (const gg of g ? [g] : ["MALE", "FEMALE"]) {
      (next[`${accent}|${gg}`] ||= []).push(v.voice_id)
    }
  }
  pools = next
  langPools = nextLang
  fetchedAt = Date.now()
  const found = Object.entries(next).map(([k, v]) => `${k}=${v.length}`).join(" ")
  const langs = Object.entries(nextLang).map(([k, v]) => `${k}=${v.length}`).join(" ")
  console.log(`[voices] accents: ${found || "(none)"} | native: ${langs || "(none)"}`)
}

/** Kick off a refresh if the cache is cold/stale. Never throws, never blocks. */
export function warmAccentPools(key: string | undefined): void {
  if (!key) return
  if (Date.now() - fetchedAt < TTL_MS) return
  if (inflight) return
  inflight = refresh(key)
    .catch((e) => {
      console.error("[voices] discovery failed:", e instanceof Error ? e.message : String(e))
      // Back off on failure so a broken key doesn't retry on every single call.
      fetchedAt = Date.now() - TTL_MS + 5 * 60_000
    })
    .finally(() => { inflight = null })
}

/**
 * Discovered voices for an accent. Synchronous by design: TTS casting sits on the
 * hot path of a live call and must never wait on a voice-list round trip. The
 * first call after a cold start returns empty (casting falls through to the
 * existing pools) and the background refresh fills it for every call after.
 */
export function discoveredAccentPool(accentKey: string, gender?: string): string[] {
  if (!accentKey || accentKey === "NEUTRAL") return []
  const g = gender === "male" ? "MALE" : "FEMALE"
  return pools[`${accentKey}|${g}`] || []
}

/**
 * Voices whose NATIVE language is `iso`. Used when no specific accent matched —
 * a Levantine-named voice is better cast as "some Arabic voice" than as a British
 * one, which is what happened before this existed.
 */
export function discoveredLangPool(iso: string, gender?: string): string[] {
  if (!iso) return []
  const g = gender === "male" ? "MALE" : "FEMALE"
  return langPools[`${iso.toLowerCase()}|${g}`] || []
}
