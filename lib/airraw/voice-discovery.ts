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

/** Accent key (see accent.ts) → words that identify it on a voice's labels. */
const ACCENT_TERMS: Record<string, string[]> = {
  AR_EG:    ["egyptian", "egypt", "cairo", "masri"],
  AR_MA:    ["moroccan", "morocco", "darija", "maghrebi"],
  AR_TN:    ["tunisian", "tunisia", "derja"],
  AR_LB:    ["lebanese", "levantine", "lebanon", "syrian", "jordanian", "shami", "palestinian"],
  AR_GULF:  ["gulf", "khaleeji", "saudi", "emirati", "kuwaiti", "qatari", "bahraini", "omani"],
  EN_RU:    ["russian", "slavic", "ukrainian"],
  EN_TR:    ["turkish"],
  EN_FA:    ["persian", "iranian", "farsi"],
  EN_IT:    ["italian"],
  EN_IE:    ["irish"],
  EN_DE:    ["german"],
  EN_SE:    ["swedish", "norwegian", "danish", "nordic", "scandinavian"],
  EN_NG:    ["nigerian", "african", "ghanaian", "kenyan"],
  EN_CARIB: ["caribbean", "jamaican", "trinidadian"],
  EN_IN:    ["indian", "hindi", "pakistani", "bengali", "sri lankan"],
  EN_LATAM: ["mexican", "latin", "colombian", "spanish", "argentin", "chilean"],
  EN_BR:    ["brazilian", "portuguese"],
  EN_PH:    ["filipino", "tagalog"],
  EN_JP:    ["japanese"],
  EN_KR:    ["korean"],
  EN_CN:    ["chinese", "mandarin", "cantonese"],
  EN_US_AAVE: ["african american", "aave"],
}

interface ElevenVoice {
  voice_id?: string
  name?: string
  labels?: Record<string, string>
  verified_languages?: Array<{ language?: string; accent?: string; locale?: string }>
}

// accentKey|gender -> voice ids
let pools: Record<string, string[]> = {}
let fetchedAt = 0
let inflight: Promise<void> | null = null
const TTL_MS = 6 * 60 * 60_000     // 6h — voices change when a human adds one

/**
 * Everything an accent could be called on this voice: the accent label, the
 * verified-language accents, and the NAME. Names carry the accent far more often
 * than labels do ("Layla - Egyptian Arabic"), and the premade labels only ever
 * say american/british/australian, so name matching is what actually finds them.
 */
function haystack(v: ElevenVoice): string {
  const parts = [v.name || "", v.labels?.accent || "", v.labels?.description || "", v.labels?.language || ""]
  for (const vl of v.verified_languages || []) parts.push(vl.accent || "", vl.locale || "", vl.language || "")
  return parts.join(" ").toLowerCase()
}

function genderOf(v: ElevenVoice): "MALE" | "FEMALE" | null {
  const g = (v.labels?.gender || "").toLowerCase()
  if (g.startsWith("m")) return "MALE"
  if (g.startsWith("f")) return "FEMALE"
  return null   // "neutral"/unknown — don't guess, it would mis-cast the voice
}

async function refresh(key: string): Promise<void> {
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": key },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`voices ${res.status}`)
  const data = (await res.json()) as { voices?: ElevenVoice[] }
  const next: Record<string, string[]> = {}
  for (const v of data.voices || []) {
    if (!v.voice_id) continue
    const hay = haystack(v)
    const g = genderOf(v)
    for (const [accent, terms] of Object.entries(ACCENT_TERMS)) {
      if (!terms.some((t) => hay.includes(t))) continue
      // Filed under both genders when the voice doesn't declare one, so an
      // undeclared voice is still reachable rather than silently dropped.
      for (const gg of g ? [g] : ["MALE", "FEMALE"]) {
        (next[`${accent}|${gg}`] ||= []).push(v.voice_id)
      }
    }
  }
  pools = next
  fetchedAt = Date.now()
  const found = Object.entries(next).map(([k, v]) => `${k}=${v.length}`).join(" ")
  console.log(`[voices] discovered accent pools: ${found || "(none — account has no accented voices)"}`)
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
