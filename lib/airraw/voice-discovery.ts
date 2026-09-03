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
// AND the shared VOICE LIBRARY, which is where the depth actually is. The account
// holds ~125 voices; the library holds thousands, and a library voice_id can be
// synthesised directly — ElevenLabs documents that saving to My Voices is
// optional, and library voices do not consume custom-voice slots either way.
// That retires the old reason this module read only the account: it was written
// believing the library could only be used by COPYING voices onto the account,
// which is capped and tedious to undo. Reading is neither.
//
// It is still READ-ONLY. It never adds, edits or removes a voice on the account.
// Use scripts/find-accent-voices.mjs --fill to copy voices deliberately.
//
// BUT the direct-use claim is documentation, not a promise, and if it is wrong the
// failure is the worst kind: a rejected voice id returns no audio, so a character
// is SILENT rather than merely mis-cast. So the first rejection of a library voice
// latches the whole library off and rebuilds the pools from the account alone —
// same circuit-breaker shape as the dead image key and the rejected LLM seat.
// Set ELEVENLABS_LIBRARY=0 to never consult it at all.
//
// Env still wins: an explicit ELEVENLABS_VOICES_<ACCENT>_<GENDER> list overrides
// anything discovered here.

/**
 * Accent key (see accent.ts) → how to recognise it on a voice.
 *
 * The table itself lives in accent-specs.json because TWO things need it: this
 * module, which sorts the account's voices into pools at runtime, and
 * scripts/find-accent-voices.mjs, which finds voices to add in the first place.
 * They used to keep private copies with a comment asking whoever edited one to
 * remember the other — and they drifted, so the script hunted 10 accents while
 * the server could use 22. A shared file cannot drift.
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
import SPECS from "@/lib/airraw/accent-specs.json"

interface AccentSpec { lang: string; locales: string[]; terms: string[] }

const ACCENT_SPECS: Array<[string, AccentSpec]> =
  (SPECS as Array<{ key: string; lang: string; locales: string[]; terms: string[] }>)
    .map((s) => [s.key, { lang: s.lang, locales: s.locales, terms: s.terms }])

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
/** Word-boundary match. "omani" must not fire on "Romanian". */
const hasWord = (hay: string, term: string) => new RegExp(`\\b${esc(term)}\\b`).test(hay)

/**
 * One voice, from EITHER source.
 *
 * The two endpoints describe the same thing differently: /v1/voices nests accent,
 * gender and language under `labels`, while /v1/shared-voices puts them at the top
 * level. Both shapes are declared here and every reader below checks both, so ONE
 * classifier serves both sources — the alternative is two classifiers that drift,
 * and the drift in this file's history is what put British voices in the Gulf pool.
 */
interface ElevenVoice {
  voice_id?: string
  name?: string
  labels?: Record<string, string>
  /** shared-voices: flat, alongside `gender` and `language`. */
  accent?: string
  gender?: string
  language?: string
  verified_languages?: Array<{ language?: string; accent?: string; locale?: string }>
}

// accentKey|gender -> voice ids
let pools: Record<string, string[]> = {}
// iso|gender -> voice ids for voices whose NATIVE language is that language
let langPools: Record<string, string[]> = {}
// The account-only view, kept so the breaker can drop back to it without a refetch.
let accountPools: Record<string, string[]> = {}
let accountLangPools: Record<string, string[]> = {}
// Which ids came from the library — the TTS route asks before blaming the library
// for a refusal, so an account voice failing can never disable it.
let fromLibrary = new Set<string>()
let libraryOff = false

const LIBRARY_ON = process.env.ELEVENLABS_LIBRARY !== "0"
const LIB_PAGE = Math.max(1, Math.min(100, Number(process.env.ELEVENLABS_LIBRARY_PAGE || 100)))
/**
 * Languages worth paging the library for: every language the product speaks
 * (lib/languages.ts), so a French or Japanese persona finally has NATIVE voices
 * to be cast from instead of falling through to the English gender pool — which
 * is the general form of the "the Arabic voices sound English" complaint.
 *
 * Hardcoded rather than imported to keep this module free of app-level imports;
 * voices-test asserts the two lists agree, so they cannot drift apart silently.
 */
const LIB_LANGS = ["en", "ar", "es", "fr", "de", "it", "pt", "ja", "ko", "zh", "hi", "ru", "nl", "tr", "pl"]
let fetchedAt = 0
// Whether a refresh has ever SUCCEEDED. Distinct from fetchedAt, which is also
// nudged forward on failure to back off a broken key.
let everLoaded = false
let inflight: Promise<void> | null = null
const TTL_MS = 6 * 60 * 60_000     // 6h — voices change when a human adds one

/**
 * Text an accent could be named in, FOR ONE LANGUAGE.
 *
 * Deliberately NOT the free-text description: descriptions are marketing prose
 * and matching them is how "a warm woman" and "Romanian narrator" became Gulf
 * Arabs. Name, accent label, and the verified-language rows FOR THAT LANGUAGE.
 *
 * The per-language filter is the fix for a second wave of the same bug, found by
 * running this against the real account rather than hand-written fixtures. Every
 * verified_languages row was being flattened into one string, so a voice
 * verified for Spanish with accent "latin american" matched the ENGLISH Latin
 * spec, and English voices carrying an ar-SA verification row matched Khaleeji.
 * An accent claim is only evidence about the language it was made in.
 */
function haystackFor(v: ElevenVoice, lang: string): string {
  const parts = [v.name || "", v.labels?.accent || "", v.accent || ""]
  for (const vl of v.verified_languages || []) {
    if ((vl.language || "").toLowerCase() !== lang) continue
    parts.push(vl.accent || "", vl.locale || "")
  }
  return parts.join(" ").toLowerCase()
}

/** Languages this voice is actually verified to speak. */
function languagesOf(v: ElevenVoice): Set<string> {
  const out = new Set<string>()
  if (v.labels?.language) out.add(v.labels.language.toLowerCase())
  if (v.language) out.add(v.language.toLowerCase())
  for (const vl of v.verified_languages || []) if (vl.language) out.add(vl.language.toLowerCase())
  return out
}

function genderOf(v: ElevenVoice): "MALE" | "FEMALE" | null {
  const g = (v.labels?.gender || v.gender || "").toLowerCase()
  if (g.startsWith("m")) return "MALE"
  if (g.startsWith("f")) return "FEMALE"
  return null   // "neutral"/unknown — don't guess, it would mis-cast the voice
}

/**
 * The ONE accent this voice belongs to, or null. First (most specific) wins.
 *
 * The NATIVE-LANGUAGE GATE is the load-bearing line. ElevenLabs stamps a
 * representative locale on a language verification — an English voice verified
 * for Arabic carries `ar-SA` — and that locale says which language it was
 * verified in, NOT where the speaker is from. Read as an accent it put
 * EN-Christina, EN-Archer, EN-David, "James - Professional British Male" and two
 * Hindi voices into the Khaleeji pool on the live account: nine "Gulf Arabs",
 * most of them British or Indian. A voice's own language decides which regional
 * accents it can carry; being able to pronounce Arabic is not being Arab.
 */
function accentOf(v: ElevenVoice): string | null {
  const langs = languagesOf(v)
  const native = (v.labels?.language || v.language || "").toLowerCase()
  for (const [key, spec] of ACCENT_SPECS) {
    // Must actually speak the language the accent belongs to.
    if (!langs.has(spec.lang)) continue
    // ...and must not be natively something else. Unknown native language falls
    // through, so a voice that simply doesn't declare one is still reachable.
    if (native && native !== spec.lang) continue
    const hay = haystackFor(v, spec.lang)
    if (spec.locales.some((l) => hay.includes(l))) return key
    if (spec.terms.some((t) => hasWord(hay, t))) return key
  }
  return null
}

/** Sort a list of voices into accent + native-language buckets. */
function sortInto(
  voices: ElevenVoice[],
  accents: Record<string, string[]>,
  langs: Record<string, string[]>,
  seen: Set<string>,
) {
  for (const v of voices) {
    // Dedupe across sources: a voice the account copied from the library appears
    // in both, and casting must not weight it twice.
    if (!v.voice_id || seen.has(v.voice_id)) continue
    seen.add(v.voice_id)
    const g = genderOf(v)

    // NATIVE-language pool. Keyed on the language the voice actually IS, not
    // verified_languages, which merely means "can pronounce". Every premade
    // English voice is verified for Arabic; that is exactly how an Arabic
    // character ended up sounding like Sarah or George.
    const native = (v.labels?.language || v.language || "").toLowerCase()
    if (native) {
      for (const gg of g ? [g] : ["MALE", "FEMALE"]) {
        (langs[`${native}|${gg}`] ||= []).push(v.voice_id)
      }
    }

    const accent = accentOf(v)
    if (!accent) continue
    // Filed under both genders when the voice doesn't declare one, so an
    // undeclared voice is still reachable rather than silently dropped.
    for (const gg of g ? [g] : ["MALE", "FEMALE"]) {
      (accents[`${accent}|${gg}`] ||= []).push(v.voice_id)
    }
  }
}

async function elFetch(url: string, key: string, ms = 10000): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(ms) })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

/**
 * Page the shared library for the languages this product actually speaks.
 *
 * ONE page per language+gender, not everything. The library has thousands of
 * voices and we need depth in the pools we cast from, not a mirror of somebody
 * else's catalogue — a hundred voices per language and gender is already an order
 * of magnitude more than the account holds. The endpoint filters server-side, so
 * this is 30 small requests rather than a crawl.
 *
 * Failures are per-request and swallowed: one language 500ing should cost that
 * language's voices, not the whole library and not the account pools that are
 * already live.
 */
async function fetchLibrary(key: string): Promise<ElevenVoice[]> {
  const out: ElevenVoice[] = []
  const jobs: Array<() => Promise<void>> = []
  for (const lang of LIB_LANGS) {
    for (const gender of ["female", "male"]) {
      jobs.push(async () => {
        try {
          const d = await elFetch(
            `https://api.elevenlabs.io/v1/shared-voices?page_size=${LIB_PAGE}&language=${encodeURIComponent(lang)}&gender=${gender}`,
            key,
          )
          const vs = (d.voices as ElevenVoice[]) || []
          // The filter is a hint, not a guarantee — the response carries each
          // voice's own labels and accentOf() re-derives everything from those,
          // so a mis-tagged row lands where it belongs or nowhere.
          out.push(...vs)
        } catch { /* one language short is not a reason to lose the rest */ }
      })
    }
  }
  // Bounded concurrency: enough to finish quickly, not enough to look like abuse.
  const CONC = 6
  for (let i = 0; i < jobs.length; i += CONC) {
    await Promise.all(jobs.slice(i, i + CONC).map((j) => j()))
  }
  return out
}

/** Publish the account-only view. Also what the breaker rebuilds. */
function publishAccountOnly() {
  pools = accountPools
  langPools = accountLangPools
  fromLibrary = new Set()
}

/**
 * TWO PHASES, and the order is the whole point.
 *
 * The account list is one request; the library is thirty. This runs on serverless,
 * where instances are short-lived and the first call after a cold start is a large
 * share of ALL calls — so the account voices are sorted and PUBLISHED first, and
 * everLoaded flips there. Casting is never slower than it is today, and the
 * library only ever deepens pools that already work. An instance that dies before
 * phase two simply casts from the account, exactly as it did before this existed.
 */
async function refresh(key: string): Promise<void> {
  const data = await elFetch("https://api.elevenlabs.io/v1/voices", key) as { voices?: ElevenVoice[] }

  const acc: Record<string, string[]> = {}
  const accLang: Record<string, string[]> = {}
  const seen = new Set<string>()
  sortInto(data.voices || [], acc, accLang, seen)

  accountPools = acc
  accountLangPools = accLang
  publishAccountOnly()
  fetchedAt = Date.now()
  everLoaded = true
  console.log(`[voices] account: ${summarise(acc)} | native: ${summarise(accLang)}`)

  if (!LIBRARY_ON || libraryOff) return

  // Phase two CANNOT fail the refresh. Phase one already published working pools;
  // letting an exception here escape would mark the whole discovery failed, roll
  // the TTL back, and have every instance redo all thirty requests in five
  // minutes — punishing the account voices for the library's bad day.
  try {
    // Build on COPIES so a failure mid-way can never leave the live pools
    // half-merged, and so the breaker can drop back to the account instantly.
    const libVoices = await fetchLibrary(key)
    if (!libVoices.length) return
    const merged: Record<string, string[]> = Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, [...v]]))
    const mergedLang: Record<string, string[]> = Object.fromEntries(Object.entries(accLang).map(([k, v]) => [k, [...v]]))
    const libIds = new Set<string>()
    const before = new Set(seen)
    sortInto(libVoices, merged, mergedLang, seen)
    for (const id of seen) if (!before.has(id)) libIds.add(id)

    pools = merged
    langPools = mergedLang
    fromLibrary = libIds
    console.log(`[voices] +library ${libIds.size} voices → ${summarise(merged)} | native: ${summarise(mergedLang)}`)
  } catch (e) {
    console.error("[voices] library merge failed, account pools stand:", e instanceof Error ? e.message : String(e))
  }
}

const summarise = (m: Record<string, string[]>) =>
  Object.entries(m).map(([k, v]) => `${k}=${v.length}`).join(" ") || "(none)"

/** Did this voice come from the library rather than the account? */
export function isLibraryVoice(id: string): boolean {
  return fromLibrary.has(id)
}

/**
 * A library voice was refused by the TTS endpoint. Stop using the library.
 *
 * Called from the TTS route on a 4xx naming the voice. The direct-use of library
 * ids is documented but not guaranteed, and being wrong about it means silence
 * rather than a wrong accent — so one refusal is enough to fall back to the
 * account for the life of this instance. It is deliberately NOT a TTL: a voice id
 * the API rejects will not start working in ten minutes, and retrying costs a real
 * person their audio each time.
 */
export function noteLibraryVoiceRejected(id: string): void {
  if (libraryOff || !fromLibrary.has(id)) return
  libraryOff = true
  publishAccountOnly()
  console.error(`[voices] library voice ${id} was refused — falling back to account voices only`)
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
 * Wait for discovery, but only the first time an instance ever needs it.
 *
 * warmAccentPools() alone was sound reasoning for a long-lived server and wrong
 * for this one. It never blocks, so the first call after a cold start casts from
 * empty pools — and on serverless with modest traffic most instances serve a
 * handful of requests and die, so "the first call" is a large share of ALL
 * calls. The effect on the live floor was that regional casting almost never
 * happened: an Egyptian character kept being cast from the flat Arabic pool
 * while two Egyptian voices sat unused on the account.
 *
 * So: block once, briefly, and never again. Warm instances keep the old
 * behaviour exactly, which is what matters for the chunks of a reply already in
 * flight. The cap means a slow voice-list can cost a fraction of a second, not a
 * call.
 */
const FIRST_WAIT_MS = 1200
export async function ensureAccentPools(key: string | undefined): Promise<void> {
  warmAccentPools(key)
  if (!key || everLoaded || !inflight) return
  await Promise.race([inflight, new Promise((r) => setTimeout(r, FIRST_WAIT_MS))])
}

/**
 * Discovered voices for an accent. Synchronous by design: TTS casting sits on the
 * hot path of a live call and must never wait on a voice-list round trip — see
 * ensureAccentPools() for the one deliberate exception.
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
