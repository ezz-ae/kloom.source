import { resolveVoiceId, getFallbackVoiceId, voiceForLanguage } from "@/lib/voices"
import { isoForLanguage } from "@/lib/languages"
import { rateLimit, clientIp, globalGate } from "@/lib/rate-limit"
import { isSouthAsianSeed } from "@/lib/airraw/portrait-prompt"

// CosyVoice3 cold starts poll up to ~45s; don't let Vercel kill the request.
export const maxDuration = 60

// TEMP: browse the ElevenLabs shared library + add voices to the account (token-gated).
// GET /api/tts?vk=voxlib-7q2&m=account
// GET /api/tts?vk=voxlib-7q2&m=shared&lang=ar&gender=female&n=20
// GET /api/tts?vk=voxlib-7q2&m=add&owner=..&voice=..&name=..
export async function GET(request: Request) {
  const u = new URL(request.url)
  if (u.searchParams.get("vk") !== "voxlib-7q2") return Response.json({ error: "nope" }, { status: 404 })
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return Response.json({ error: "no key" }, { status: 500 })
  const m = u.searchParams.get("m") || "account"
  try {
    if (m === "account") {
      const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } })
      const d = await r.json() as { voices?: Array<{ voice_id: string; name: string; labels?: Record<string, string> }> }
      return Response.json({ count: (d.voices || []).length, voices: (d.voices || []).map((v) => ({ id: v.voice_id, name: v.name, gender: v.labels?.gender, accent: v.labels?.accent })) })
    }
    if (m === "add") {
      const owner = u.searchParams.get("owner") || "", voice = u.searchParams.get("voice") || "", name = u.searchParams.get("name") || "voice"
      const r = await fetch(`https://api.elevenlabs.io/v1/voices/add/${owner}/${voice}`, {
        method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ new_name: name }),
      })
      const j = await r.json().catch(() => ({}))
      return Response.json({ ok: r.ok, status: r.status, newId: (j as { voice_id?: string }).voice_id, body: r.ok ? undefined : JSON.stringify(j).slice(0, 200) })
    }
    // shared library
    const qs = new URLSearchParams({ page_size: u.searchParams.get("n") || "20", sort: "trending" })
    const lang = u.searchParams.get("lang"); if (lang) qs.set("language", lang)
    const gender = u.searchParams.get("gender"); if (gender) qs.set("gender", gender)
    const r = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${qs}`, { headers: { "xi-api-key": key } })
    if (!r.ok) return Response.json({ error: `shared ${r.status}`, body: (await r.text()).slice(0, 200) }, { status: 502 })
    const d = await r.json() as { voices?: Array<Record<string, unknown>> }
    return Response.json({ count: (d.voices || []).length, voices: (d.voices || []).map((v) => ({ owner: v.public_owner_id, voice: v.voice_id, name: v.name, gender: v.gender, accent: v.accent, language: v.language, age: v.age })) })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  // Global spend ceiling / kill-switch first — protects total budget under ad traffic.
  const gate = globalGate()
  if (!gate.ok) return Response.json({ error: "at capacity" }, { status: 503, headers: { "Retry-After": "120" } })
  // Per-client guard on the open TTS endpoint.
  const rl = rateLimit(`tts:${clientIp(request)}`, 80, 60_000)
  if (!rl.ok) return Response.json({ error: "Slow down a sec." }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } })

  const { text, voice, voiceId, elevenId, personaName, gender, language, mode, prevText } = (await request.json()) as {
    text: string
    voice?: string
    voiceId?: string
    elevenId?: string
    personaName?: string
    gender?: string
    language?: string
    mode?: string
    /** What this speaker already said just before this chunk — lets the engine keep
     *  one continuous prosody across chunked replies instead of restarting cold. */
    prevText?: string
  }

  if (!text || typeof text !== "string") {
    return Response.json({ error: "Missing text" }, { status: 400 })
  }
  // A spoken line is short; cap it so a huge payload can't be forwarded to (and
  // billed by) the TTS provider. Shape it for natural speech first; if shaping strips
  // a line down to nothing (e.g. a URL/emoji-only message), fall back to the raw text
  // so we never send an empty request.
  const ttsText = shapeForSpeech(text) || text.replace(/\s+/g, " ").trim().slice(0, 1000)

  // ── ElevenLabs — premium natural TTS (tier 0) ─────────────────────────────
  // PRIMARY. One consistent, expressive voice identity per persona (deterministic
  // pool pick), and prosody continuity across chunked replies via previous_text.
  // Sesame CSM used to run first, but CSM-1B is a BASE model: every chunk comes
  // out a slightly different voice (the "voice keeps shifting mid-reply" bug) and
  // its male speaker reads flat/robotic. Eleven first; CSM is now the fallback.
  const elKey = process.env.ELEVENLABS_API_KEY
  if (elKey) {
    const el = await elevenTTS(ttsText, elKey, personaName, gender, elevenId, mode, prevText, language)
    if (el) return new Response(el, { status: 200, headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-TTS-Provider": "elevenlabs", "X-EL-Cast": elCast } })
    // fall through to Sesame / CosyVoice / Fish
  }

  // ── Sesame CSM-1B (fal.ai) — conversational voice (fallback tier) ──────────
  // Activated by SESAME_TTS=1; uses the existing FAL_KEY (same as image gen).
  const falKey = process.env.FAL_KEY
  if (falKey && process.env.SESAME_TTS === "1") {
    const csm = await sesameCSMTTS(ttsText, falKey, gender)
    if (csm) return new Response(csm, { status: 200, headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store", "X-TTS-Provider": "sesame-csm" } })
    // fall through to CosyVoice / Fish
  }

  // ── CosyVoice3 (RunPod serverless) — primary TTS ──────────────────────────
  // High-quality, natural-sounding TTS. Runs first when the endpoint is configured.
  // Falls through to fish.audio on any failure.
  const cvEndpoint = process.env.COSYVOICE_ENDPOINT_ID
  const rpKey      = process.env.RUNPOD_API_KEY
  // CosyVoice only ships English speakers, so route English here and let every
  // other language fall through to Fish's multilingual model (which also honors
  // a curated voiceForLanguage). Without this gate, a configured CosyVoice would
  // speak non-English text with an English voice and never reach the Fish chain.
  if (cvEndpoint && rpKey && isoForLanguage(language) === "en") {
    // Pick speaker by gender: female → English Female, male → English Male.
    const speaker = gender === "male"
      ? (process.env.COSYVOICE_SPEAKER_MALE   || "English Male")
      : (process.env.COSYVOICE_SPEAKER_FEMALE || "English Female")

    const wav = await cosyvoiceTTS(ttsText, cvEndpoint, rpKey, speaker)
    if (wav) {
      return new Response(wav, {
        status: 200,
        headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store", "X-TTS-Provider": "cosyvoice" },
      })
    }
    // fall through to fish.audio
  }

  // ── Fish Audio (cloud) — fallback TTS ────────────────────────────────────
  const apiKey = process.env.FISH_API_KEY
  if (!apiKey) {
    return Response.json({ error: "No TTS configured (COSYVOICE_ENDPOINT_ID or FISH_API_KEY required)" }, { status: 500 })
  }

  // Priority: explicit voiceId on the persona → FISH_VOICE_ID env → pool lookup.
  // Priority: explicit pinned voiceId → gender+name POOL (varied per persona) →
  // env default as a last resort. The pool MUST come before resolveReferenceId,
  // or every persona collapses to the single FISH_VOICE_ID and all voices sound
  // the same.
  // Priority: explicit pinned voice → a curated language-native voice (non-EN)
  // → the gender/name pool → env default. The language-native step only fires
  // when FISH_VOICE_<ISO> is configured for that language (see voiceForLanguage).
  let referenceId = voiceId?.trim() || voiceForLanguage(language, gender) || resolveVoiceId(personaName, gender) || resolveReferenceId(voice)

  let fishResponse: Response | null = null
  let lastErrorText = ""

  for (let attempt = 1; attempt <= 4; attempt++) {
    if (attempt === 3 && referenceId) {
      referenceId = getFallbackVoiceId(referenceId, gender)
    }

    const body = JSON.stringify({
      text: ttsText,
      reference_id: referenceId,
      format: "mp3",
      mp3_bitrate: 192,                 // richer than 128 — less "boxed" compression
      normalize: true,
      latency: "normal",                // best quality over lowest latency
      // NOTE: temperature/top_p/chunk_length/prosody tuning was REVERTED — it made Fish
      // sound worse (choppier/robotic). Fish s1 on its own defaults is the cleaner baseline.
      // The real non-robotic voice comes from the engine swap (Kokoro RunPod / ElevenLabs).
    })

    try {
      fishResponse = await fetch("https://api.fish.audio/v1/tts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "model": "s1",                // force Fish's flagship model for the most natural voice
        },
        body,
      })
    } catch (err) {
      lastErrorText = err instanceof Error ? err.message : String(err)
      await sleep(150 * attempt)
      continue
    }

    if (fishResponse.ok) {
      const buf = await fishResponse.arrayBuffer()
      if (buf.byteLength > 0) {
        return new Response(buf, {
          status: 200,
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-TTS-Provider": "fish", "X-EL-Diag": (elDiag || "").replace(/[^\x20-\x7e]/g, " ").slice(0, 200) },
        })
      }
      lastErrorText = "Fish returned 200 with empty audio"
      await sleep(150 * attempt)
      continue
    }

    lastErrorText = await fishResponse.text()
    if (fishResponse.status < 500 && fishResponse.status !== 429) break
    await sleep(150 * attempt)
  }

  return Response.json(
    { error: `Fish Audio error after retries: ${lastErrorText}` },
    { status: fishResponse?.status || 502 }
  )
}

function resolveReferenceId(voice?: string): string | undefined {
  if (voice) {
    const perVoiceEnv = process.env[`FISH_VOICE_${voice.toUpperCase()}`]
    if (perVoiceEnv) return perVoiceEnv
  }
  return process.env.FISH_VOICE_ID || undefined
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// Make ANY TTS engine sound more human by cleaning what we send it: strip markdown,
// links, emoji and stage-directions (engines read them aloud as gibberish), expand
// abbreviations/symbols, and insert natural comma/sentence beats so the voice breathes
// instead of machine-gunning. NO SSML (safe for non-SSML engines like Fish/CosyVoice).
// Idempotent; length-bounded. Caller falls back to the raw text if this empties out.
function shapeForSpeech(input: string): string {
  if (!input || typeof input !== "string") return ""
  let t = input.normalize("NFC")

  // 1) Strip code & links (read out as gibberish otherwise).
  t = t.replace(/```[\s\S]*?```/g, " ").replace(/`([^`]*)`/g, "$1")
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  t = t.replace(/https?:\/\/\S+/gi, " ").replace(/\bwww\.\S+/gi, " ")
  t = t.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, " ")

  // 2) Strip markdown structure & inline emphasis (keep the words).
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, "").replace(/^\s{0,3}>\s?/gm, "")
  t = t.replace(/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/gm, " ")
  t = t.replace(/(\*{1,3}|_{1,3}|~{2})(\S[\s\S]*?\S|\S)\1/g, "$2")
  t = t.replace(/^\s*[-*+]\s+/gm, "").replace(/^\s*\d+[.)]\s+/gm, "")
  t = t.replace(/[*_~`#|>]/g, " ")

  // 3) Strip stage directions / sound cues — engines voice them literally.
  t = t.replace(/\((?:laughs?|sighs?|giggles?|whispers?|pauses?|smiles?|grins?|chuckles?|clears throat|beat|gasps?|inhales?|exhales?|softly|coughs?)[^)]*\)/gi, " ")
  t = t.replace(/\[(?:laughs?|sighs?|music|sound|sfx|pause|beat|applause)[^\]]*\]/gi, " ")

  // 4) Strip emoji & pictographs.
  t = t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu, " ")

  // 5) Currency (before generic number handling).
  t = t.replace(/\$\s?(\d[\d,]*)(\.\d{1,2})?/g, (_m, d: string, c?: string) => {
    const dollars = d.replace(/,/g, "")
    return c ? `${dollars} dollars and ${c.slice(1)} cents` : `${dollars} dollars`
  })
  t = t.replace(/€\s?(\d[\d,]*)/g, (_m, d: string) => `${d.replace(/,/g, "")} euros`)
  t = t.replace(/£\s?(\d[\d,]*)/g, (_m, d: string) => `${d.replace(/,/g, "")} pounds`)

  // 6) Common abbreviations.
  const ABBR: Record<string, string> = {
    "Dr.": "Doctor", "Mr.": "Mister", "Mrs.": "Missus", "Ms.": "Miss",
    "Prof.": "Professor", "St.": "Saint", "Mt.": "Mount", "vs.": "versus",
    "e.g.": "for example", "i.e.": "that is", "etc.": "and so on",
    "approx.": "approximately", "Jan.": "January", "Feb.": "February",
    "Aug.": "August", "Sept.": "September", "Oct.": "October",
    "Nov.": "November", "Dec.": "December",
  }
  for (const [k, v] of Object.entries(ABBR)) {
    t = t.replace(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), v)
  }

  // 7) Symbols → words.
  t = t.replace(/(\d)\s?%/g, "$1 percent")
  t = t.replace(/\s&\s/g, " and ").replace(/&/g, " and ")
  t = t.replace(/\band\s*\/\s*or\b/gi, "and or")  // before the generic slash rule
  t = t.replace(/\s*\/\s*/g, " or ")
  t = t.replace(/(\d)\s?-\s?(\d)/g, "$1 to $2")

  // 8) Micro-pause shaping so the voice breathes.
  t = t.replace(/\s*[—–]\s*/g, ", ")
  t = t.replace(/\.{3,}/g, "… ")
  t = t.replace(/[!?]{2,}/g, (m) => (m.includes("!") ? "!" : "?"))  // ?!?! / !!! → one mark
  t = t.replace(/,{2,}/g, ",")
  t = t.replace(/\n{2,}/g, "\n").replace(/\n+/g, ". ")

  // 9) Whitespace & punctuation spacing cleanup.
  t = t.replace(/[ \t]+/g, " ")
  t = t.replace(/\s+([,.!?…;:])/g, "$1")
  t = t.replace(/([,;:])\s*([.!?…])/g, "$2")
  t = t.replace(/([.!?…])\s*,/g, "$1")
  t = t.replace(/([,.!?…;:])(?=[^\s\d])/g, "$1 ")
  t = t.replace(/\s{2,}/g, " ").trim()

  // 10) Guarantee a sentence-final beat so the line lands instead of cutting dead.
  if (t && !/[.!?…"')\]]$/.test(t)) t += "."

  return t.slice(0, 1000).trim()
}

// ── ElevenLabs (premium natural TTS) ─────────────────────────────────────────
// Preset voice pools (public default voices, available to every account). One is
// chosen PER PERSONA by name hash so every character in a room sounds like a
// different person. Curate the whole pool with ELEVENLABS_VOICES_MALE / _FEMALE
// (comma-separated ID lists). The old singular ELEVENLABS_VOICE_MALE / _FEMALE is
// now MERGED into the pool (not an override) — as a hard override it collapsed
// EVERY male to one voice and EVERY female to one voice ("all guys same voice").
// 21 distinct ENGLISH-appropriate female voices (the account's American/British/Canadian
// premade+professional voices, verified live, plus the classic ElevenLabs defaults). The
// account's NATIVE-ARABIC female voices are deliberately NOT here — they belong in the
// Arabic pool (ELEVENLABS_VOICES_AR_FEMALE, set in env), so an English persona doesn't get
// an Arabic accent and an Arabic persona gets a real native voice.
const EL_FEMALE = [
  "EXAVITQu4vr4xnSDxMaL", "FGY2WhTYpPnrIDTdsKH5", "Xb7hH8MSUJpSbSDYk0k2", "XrExE9yKIg1WjnnlVkGX",
  "cgSgspJ2msm6clMCkdW9", "hpp4J3VqNfWAUOO0d1Us", "pFZP5JQG7iQjIQuC4Bku", "umKoJK6tP1ALjO0zo1EE",
  "FvmvwvObRqIHojkEGh5N", "jqcCZkN6Knx8BJ5TBdYR",
  "21m00Tcm4TlvDq8ikWAM", "AZnzlk1XvdvUeBnXmlld", "MF3mGyEYCl7XYWbV9V6O", "jsCqWAovK2LkecY7zXl4",
  "pMsXgVXv3BLzUgSXRplE", "oWAxZDx7w5VEj9dCyTzz", "ThT5KcBeYPX3keUQqHPh", "9BWtsMINqrJLrRacOk9x",
  "XB0fDUnXU5powFXDhCwa", "LcfcDJNUP1GQjkzn1xUU", "z9fAnlkpzviPz146aGWa",
]
// 21 distinct male voices (account premade+professional, verified live, + classic defaults).
const EL_MALE   = [
  "CwhRBWXzGAHq8TQ4Fs17", "IKne3meq5aSn9XLyUdCD", "JBFqnCBsd6RMkjVDRZzb", "N2lVS1w4EtoT3dr4eOWO",
  "SOYHLrjzK2X1ezoPC6cr", "TX3LPaxmHKxFdv7VOQHJ", "bIHbv24MWmeRgasZH58o", "cjVigY5qzO86Huf0OWal",
  "iP95p4xoKVk53GoZ742B", "nPczCjzI2devNBz1zQrb", "onwK4e9ZLuTAKqWW03F9", "pNInz6obpgDQGcFmaJgB",
  "pqHfZKP75CvOlQylNhV4", "fH9gsStnzq6PZe3n6pZv", "2ajXGJNYBR0iNHpS4VZb",
  "ErXwobaYiN019PkySvjV", "TxGEqnHWrfWFTfGW9XjX", "VR6AewLTigWG4xSOukaG", "yoZ06aMxZJJ28mfd3POQ",
  "flq6f7yk4E4fJM5XTYuZ", "bVMeCyTHy58xNoL34h3p",
]
// A dedicated Indian-English female voice for South-Asian female personas — it MATCHES
// their face (face ethnicity is derived from the same persona name). Deliberately NOT in
// the random pool, so it only ever plays on a face it fits. Env-overridable.
const SA_FEMALE_VOICE = process.env.ELEVENLABS_VOICE_FEMALE_SA || "f0JpDwzbGK384Dd1WH2s"

// Language-native ElevenLabs voice pools. A voice CLONED from a native speaker of the
// target language sounds far more authentic than an English voice reading Arabic through
// the multilingual model (accent, emphasis, natural rhythm). Curate per language via env
// as comma-separated ID lists — one is picked per persona by name hash so neighbours stay
// distinct — e.g.  ELEVENLABS_VOICES_AR_FEMALE=id1,id2   ELEVENLABS_VOICES_AR_MALE=id3,id4
// (singular ELEVENLABS_VOICE_AR_FEMALE / _MALE also works for one pinned voice).
function langPool(iso: string, gender?: string): string[] {
  const g = gender === "male" ? "MALE" : "FEMALE"
  const raw = process.env[`ELEVENLABS_VOICES_${iso}_${g}`]
    || process.env[`ELEVENLABS_VOICE_${iso}_${g}`]
    || process.env[`ELEVENLABS_VOICES_${iso}`]
    || process.env[`ELEVENLABS_VOICE_${iso}`]
    || ""
  return raw.split(",").map((s) => s.trim()).filter(Boolean)
}
const hashPick = (arr: string[], seed: string): string => {
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return arr[h % arr.length]
}
const csv = (v?: string) => (v || "").split(",").map((s) => s.trim()).filter(Boolean)
// The per-gender pool: an ELEVENLABS_VOICES_<G> comma-list fully replaces it; otherwise
// the built-in pool, with any legacy singular ELEVENLABS_VOICE_<G> MERGED in (added, not
// overriding — a single pin used to flatten every persona to one voice).
function genderPool(gender?: string): string[] {
  const g = gender === "male" ? "MALE" : "FEMALE"
  const list = csv(process.env[`ELEVENLABS_VOICES_${g}`])
  if (list.length) return list
  const builtin = gender === "male" ? EL_MALE : EL_FEMALE
  const pin = (process.env[`ELEVENLABS_VOICE_${g}`] || "").trim()
  return pin && !builtin.includes(pin) ? [...builtin, pin] : builtin
}
function elVoiceFor(name?: string, gender?: string, language?: string): string {
  const seed = name || "x"
  // Language-native pool first (when curated for this language) — so an Arabic persona
  // speaks in an Arabic-native voice, not an English one bent through the model.
  const iso = isoForLanguage(language)
  if (iso && iso !== "en") {
    const pool = langPool(iso.toUpperCase(), gender)
    if (pool.length) return hashPick(pool, seed)
    // No language-native pool curated → still give per-persona VARIETY from the gender
    // pool (never the single pinned voice, which made "all Arabic same voice").
    return hashPick(genderPool(gender), seed)
  }
  // Voice-casting by face ethnicity: a South-Asian female face gets the Indian-English
  // voice (checked BEFORE the pool so it isn't diluted by it).
  if (gender !== "male" && name && isSouthAsianSeed(name)) return SA_FEMALE_VOICE
  return hashPick(genderPool(gender), seed)
}
async function elevenTTS(text: string, key: string, name?: string, gender?: string, elevenId?: string, mode?: string, prevText?: string, language?: string): Promise<ArrayBuffer | null> {
  try {
    const voice = elevenId?.trim() || elVoiceFor(name, gender, language)
    const iso = isoForLanguage(language)
    // turbo_v2_5 handles Latin-script languages with the LOWEST latency, but it's
    // measurably weaker on Arabic (and other non-Latin scripts) — softer consonants,
    // wrong emphasis, occasional dropped diacritics. For those, use multilingual_v2
    // even in a live call: the ~300ms extra latency is worth an actually-native sound.
    // English/Latin stay on turbo for snappy mic turns. All env-overridable.
    const nonLatin = !!iso && iso !== "en" && /^(ar|fa|ur|he|hi|bn|ru|uk|zh|ja|ko|th|el)$/.test(iso)
    const model = nonLatin
      ? (process.env.ELEVENLABS_MODEL_NONLATIN || "eleven_multilingual_v2")
      : mode === "voice"
        ? (process.env.ELEVENLABS_MODEL_VOICE || "eleven_turbo_v2_5")
        : (process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2")
    // EXPRESSIVE defaults — user reported the voice felt flat/monotone/robotic. Lower
    // stability = more emotional variation; HIGH style = lively, performed delivery;
    // speaker_boost for presence. (A previous "calm" 0.5/0.75/0.2 read as dead.) These
    // are env-overridable so it can be re-tuned without a deploy via ELEVENLABS_STABILITY
    // / _SIMILARITY / _STYLE. 192kbps for crisper audio.
    const fmt = process.env.ELEVENLABS_FORMAT || "mp3_44100_192"
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=${fmt}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: model,
        // Prosody continuity: when a reply is spoken in chunks, tell the engine what
        // this voice JUST said so the next chunk continues the same breath instead of
        // restarting cold — kills the audible "shift" between sentences.
        ...(prevText?.trim() ? { previous_text: prevText.trim().slice(-280) } : {}),
        // Arabic (and other non-Latin) reads cleaner with a touch MORE stability and a
        // touch LESS style — the low-stability/high-style "performed" English setting
        // warbles on long Arabic vowels and over-emphasises. English keeps the lively
        // expressive defaults. All still env-overridable (AR_* wins for Arabic).
        voice_settings: nonLatin
          ? {
              stability: Number(process.env.ELEVENLABS_STABILITY_AR ?? process.env.ELEVENLABS_STABILITY_NONLATIN ?? 0.55),
              similarity_boost: Number(process.env.ELEVENLABS_SIMILARITY ?? 0.85),
              style: Number(process.env.ELEVENLABS_STYLE_AR ?? process.env.ELEVENLABS_STYLE_NONLATIN ?? 0.35),
              use_speaker_boost: true,
            }
          : {
              stability: Number(process.env.ELEVENLABS_STABILITY ?? 0.4),
              similarity_boost: Number(process.env.ELEVENLABS_SIMILARITY ?? 0.85),
              style: Number(process.env.ELEVENLABS_STYLE ?? 0.6),
              use_speaker_boost: true,
            },
      }),
      signal: AbortSignal.timeout(30000),
    })
    elCast = `${model}/${voice}${nonLatin ? "/nonlatin" : ""}`
    if (!res.ok) { elDiag = `${res.status} ${(await res.text()).slice(0, 180)}`; console.error("elevenlabs", elDiag); return null }
    const buf = await res.arrayBuffer()
    if (buf.byteLength > 0) return buf
    elDiag = "empty audio"; return null
  } catch (e) { elDiag = e instanceof Error ? e.message : String(e); console.error("elevenlabs threw", elDiag); return null }
}

// Last ElevenLabs model+voice actually used — surfaced as X-EL-Cast for verification.
let elCast = ""
// Last ElevenLabs failure reason — surfaced on the fallback response as X-EL-Diag so
// we can see WHY it fell back to Fish (e.g. a 401 missing-permissions) without ever
// handling the key directly.
let elDiag = ""

// ── Sesame CSM-1B via fal.ai ──────────────────────────────────────────────────
// CSM (Conversational Speech Model) generates strikingly human-sounding speech.
// Uses the sync fal.run endpoint (same as image gen) — blocks until ready (≤30s).
// speaker_id 0 = female, 1 = male (CSM's two default voices).
// Returns WAV bytes, or null on any failure (caller falls through to ElevenLabs).
async function sesameCSMTTS(text: string, falKey: string, gender?: string): Promise<ArrayBuffer | null> {
  const speakerId = gender === "male" ? 1 : 0
  try {
    const res = await fetch("https://fal.run/fal-ai/csm-1b", {
      method: "POST",
      headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        scene: [{ text, speaker_id: speakerId }],
      }),
      // Short timeout — fail fast so ElevenLabs takes over immediately if CSM
      // is cold or slow. 6s is generous for a warm worker; cold starts fall through.
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) {
      console.error("[tts] sesame-csm failed:", res.status, (await res.text().catch(() => "")).slice(0, 200))
      return null
    }
    const data = await res.json() as { audio?: { url?: string } }
    const audioUrl = data?.audio?.url
    if (!audioUrl) { console.error("[tts] sesame-csm: no audio URL in response"); return null }
    const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(15000) })
    if (!audioRes.ok) return null
    return audioRes.arrayBuffer()
  } catch (e) {
    console.error("[tts] sesame-csm error:", e instanceof Error ? e.message : String(e))
    return null
  }
}

// CosyVoice3 RunPod serverless endpoint.
// Input:  { tts_text, spk_id, speed }
// Output: { audio_base64 } (WAV, 22050 Hz)
// Returns the WAV bytes, or null on any failure (caller falls back to fish.audio).
async function cosyvoiceTTS(
  text: string,
  endpointId: string,
  key: string,
  speaker: string,
): Promise<ArrayBuffer | null> {
  const base    = `https://api.runpod.ai/v2/${endpointId}`
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }
  try {
    const res = await fetch(`${base}/runsync`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          tts_text: text,
          spk_id:   speaker,
          speed:    1.0,
        },
      }),
    })
    if (!res.ok) return null
    let data: any = await res.json()

    // Poll if cold-start (IN_QUEUE / IN_PROGRESS) — 3 idle workers so usually instant.
    let tries = 0
    while ((data?.status === "IN_PROGRESS" || data?.status === "IN_QUEUE") && tries < 30) {
      await sleep(1500)
      const s = await fetch(`${base}/status/${data.id}`, { headers })
      if (!s.ok) return null
      data = await s.json()
      tries++
    }
    if (data?.status !== "COMPLETED") return null

    const b64: string | undefined = data?.output?.audio_base64 ?? data?.output?.audio
    if (!b64) return null
    const bin = Buffer.from(b64, "base64")
    return bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)
  } catch {
    return null
  }
}
