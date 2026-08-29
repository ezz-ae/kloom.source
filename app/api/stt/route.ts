// Server-side speech-to-text. Backend priority:
//   Arabic only, in front:
//     0. Gemini 3.5 Transcribe (GEMINI_API_KEY + STT_GEMINI=1) — opt-in; the only
//        tier that can be handed an explicit dialect vocabulary
//     1. ElevenLabs Scribe (ELEVENLABS_API_KEY) — Arabic default
//   Everything, in order:
//     2. Groq Whisper (GROQ_API_KEY) — fast, direct upload, no cold starts
//     3. RunPod faster-whisper serverless (RUNPOD_STT_ENDPOINT_ID)
//     4. OpenAI-compatible /audio/transcriptions (STT_BASE_URL) — last resort
//
// Every tier returns null on failure and falls through to the next, so a live
// call can never be left with no recogniser at all.
//
// Browser STT fallback is handled client-side when NEXT_PUBLIC_STT_BROWSER=1.

import { rateLimit, clientIp, globalGate } from "@/lib/rate-limit"
import { adultEnabled } from "@/lib/variant"

export const runtime = "nodejs"
export const maxDuration = 300   // RunPod Whisper can cold-start; give it room (capped by plan)

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

// Whisper hallucinates stock phrases ("thank you", "thanks for watching") on silence
// / non-speech — its training data was full of YouTube outros. Drop a transcript that
// is ONLY one of those, so a beat of quiet on the open mic never becomes a phantom
// "thank you" sent to the chat. Real, longer utterances pass through untouched.
const HALLUCINATIONS = new Set([
  "thank you", "thanks", "thankyou", "thank you so much", "thanks so much",
  "thank you very much", "thanks for watching", "thank you for watching",
  "thanks for watching everyone", "thanks for watching the video", "thank you bye",
  "you", "bye", "bye bye", "goodbye", "see you", "see you next time", "okay thank you",
  "please subscribe", "subscribe", "like and subscribe", "youre welcome",
  "music", "silence", "applause", "foreign", "the end",
])

// Arabic Whisper hallucinations — phrases that appear in Arabic YouTube credits,
// subtitle files, and show endings that Whisper regurgitates on silence.
// "ترجمة نانسي قنقر" is the most notorious: an actress whose name appeared in
// thousands of Arabic subtitle credits in training data.
const ARABIC_HALLUCINATIONS = new Set([
  "شكرا", "شكراً", "شكرا لكم", "شكراً لكم", "شكرا جزيلا", "شكراً جزيلاً",
  "شكراً جزيلاً على مشاهدتكم", "شكرا على المشاهدة",
  "ترجمة نانسي قنقر", "ترجمه نانسي قنقر", "ترجمة: نانسي قنقر",
  "ترجمة وتعريب نانسي قنقر", "نانسي قنقر",
  "استمر في المشاهدة", "تابع المشاهدة", "شاهد الجزء الثاني",
  "اشترك في القناة", "اشترك الآن", "لايك واشترك",
  "موسيقى", "صوت", "صمت", "تصفيق", "ضحك",
  "تابعونا", "للمزيد", "نهاية",
])

// Decoding hint for Arabic. Whisper is trained heavily on Modern Standard Arabic,
// so left unbiased it "corrects" everyday spoken Arabic into MSA-shaped words —
// which is how a word comes back as a completely different word. This seed tells it
// to expect casual spoken register instead. Kept deliberately short (~15 tokens):
// longer prompts measurably increase hallucinated insertions on brief clips.
// Override per-deployment with STT_PROMPT_AR.
// Whisper's `prompt` biases the decoder's vocabulary. Untuned it leans Modern
// Standard Arabic and "corrects" everyday speech into MSA-shaped words — a
// measured round trip through the live site turned "أنا مش قادرة أنام" into
// "أنا مش أدرى نام" and "صاحية" into "صحية": one word in five wrong on CLEAN
// synthetic audio, before a real phone microphone is involved.
//
// A style sentence alone ("a casual spoken call") doesn't help, because it names
// no words. What biases a decoder is the WORDS themselves, so this seeds the
// everyday function words the MSA pull erases — deliberately pan-dialect, since
// the floor is Egyptian, Levantine, Gulf and Maghrebi at once, and deliberately
// short: Whisper's accuracy degrades past roughly 16 tokens as the decoder
// starts inventing continuations, and our clips are short enough to be at risk.
const AR_STYLE_SEED = "مكالمة بالعامية: إزيك، لسه، دلوقتي، مش، عايز، كده، أوي، بص، شو، هلق، وين، بزاف"

/**
 * Every successful transcript, tagged with the tier that produced it.
 *
 * Added because a report of "the Arabic is barely understood" could not be
 * acted on: five tiers can answer this route, which one actually did was
 * invisible from outside, and the obvious suspect (Gemini) turned out to be
 * switched off entirely. X-TTS-Provider has made the voice side debuggable for
 * a while; this is the same thing for the ear.
 */
function transcript(text: string | null | undefined, provider: string, model?: string, why?: string): Response {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "X-STT-Provider": model ? `${provider}/${model}` : provider,
  }
  // Why the better tiers didn't answer. Arabic falling through to Whisper is the
  // difference between understood and not, and from outside the two are
  // indistinguishable — the transcript comes back either way, just wrong.
  if (why) headers["X-STT-Fallback"] = why
  return Response.json({ text: cleanTranscript(text) }, { headers })
}

/** Human-readable reason the Arabic tiers above Whisper were skipped. */
function arabicTierNote(adult: boolean, isArabic: boolean, gemKey?: string, elKey?: string): string {
  if (!isArabic) return ""
  if (!adult) return "not-adult-variant"
  const bits: string[] = []
  if (!gemKey) bits.push("gemini:no-key")
  else if (process.env.STT_GEMINI !== "1") bits.push("gemini:off")
  if (!elKey) bits.push("scribe:no-key")
  else if (process.env.STT_SCRIBE === "0") bits.push("scribe:off")
  else if (Date.now() < scribeParkedUntil) bits.push("scribe:parked")
  else bits.push("scribe:failed")
  return bits.join(",")
}

function cleanTranscript(text: string | null | undefined): string {
  const t = (text || "").trim()
  if (!t) return ""
  // Strip non-ASCII to check against English hallucination phrases.
  const n = t.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim()
  if (!n) {
    // Pure non-Latin text (Arabic, etc.) — check against language-specific hallucinations.
    // Normalize whitespace + strip trailing punctuation for a clean match.
    const normalized = t.replace(/\s+/g, " ").replace(/[.،؟!]+$/, "").trim()
    if (ARABIC_HALLUCINATIONS.has(normalized)) return ""
    return t
  }
  if (HALLUCINATIONS.has(n)) return ""
  return t
}

export async function POST(request: Request) {
  // Cost guard: STT bills GPU-seconds per utterance on an open mic. Gate it
  // like the other billable endpoints (generous limit — a live call fires often).
  const gate = globalGate()
  if (!gate.ok) return Response.json({ error: "at capacity" }, { status: 503, headers: { "Retry-After": "120" } })
  const rl = rateLimit(`stt:${clientIp(request)}`, 90, 60_000)
  if (!rl.ok) return Response.json({ error: "slow down" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: "Expected multipart/form-data with an audio file." }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "Missing audio file." }, { status: 400 })
  }

  const language = typeof form.get("language") === "string" ? (form.get("language") as string) : undefined
  const isArabic = language === "ar"
  // AIRRAW only. Kloom keeps the original behaviour throughout this route.
  const adult = adultEnabled()

  // ── Gemini 3.5 Transcribe (tier 0 for Arabic, opt-in) ─────────────────────
  // The one recogniser here that can be TOLD what dialect words to expect. Whisper
  // and Scribe both have to infer that; this takes an explicit vocabulary, which is
  // the most direct lever there is on a spoken dialect word arriving as a different
  // word. Verified against the account before wiring in: the model is present and
  // the Interactions API accepts inline audio with custom_vocabulary.
  //
  // OFF unless STT_GEMINI=1. It is slower than Scribe in measurement (~3s vs ~1s on
  // a one-second clip), so it trades turn latency for accuracy — that is a product
  // decision, not one to make silently on someone's behalf.
  const gemKey = process.env.GEMINI_API_KEY
  if (adult && isArabic && gemKey && process.env.STT_GEMINI === "1") {
    const t = await geminiSTT(file, gemKey, language)
    if (t !== null) return transcript(t, "gemini", process.env.GEMINI_STT_MODEL || "gemini-3.5-transcribe")
  }

  // ── ElevenLabs Scribe — Arabic (tier 1) ───────────────────────────────────
  // Whisper is weak on spoken Arabic: trained overwhelmingly on Modern Standard
  // Arabic, it "corrects" everyday dialect into MSA-shaped words and a word comes
  // back as a DIFFERENT word. Scribe handles dialect markedly better, and is the
  // Arabic default because it is roughly three times faster than Gemini on a short
  // clip. Scoped to Arabic: English through Groq is already accurate and cheaper.
  // STT_SCRIBE=0 turns it off and falls through to Whisper.
  const elKey = process.env.ELEVENLABS_API_KEY
  if (adult && isArabic && elKey && process.env.STT_SCRIBE !== "0") {
    // No language pinned: Scribe detects it, which is what lets an Arabic-set
    // character understand a line of English without losing Arabic accuracy.
    // Whisper below still pins for Arabic, because it needs the help — that's the
    // fallback path only, and only when Scribe is unavailable.
    const t = await scribeSTT(file, elKey)
    if (t !== null) return transcript(t, "scribe", process.env.ELEVENLABS_STT_MODEL || "scribe_v1")
    // fall through to Whisper on any failure — never leave the call without STT
  }

  // ── Groq Whisper (primary — fast, cheap, direct upload, no cold starts) ──
  const groqKey = process.env.GROQ_API_KEY
  if (groqKey) {
    const groqForm = new FormData()
    groqForm.append("file", file, (file as File).name || "audio.webm")
    // Arabic needs the full large-v3 model — turbo sacrifices too much accuracy
    // for non-Latin scripts and produces garbled / wrong transcriptions noticeably
    // more often. The extra latency (~1-2s) is worth it for correctness.
    const groqModel = isArabic
      ? (process.env.GROQ_STT_MODEL_AR || "whisper-large-v3")
      : (process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo")
    groqForm.append("model", groqModel)
    groqForm.append("response_format", "json")
    // Pin the decoder to a language ONLY for Arabic, where it measurably helps a
    // non-Latin script. For everyone else the language is left to auto-detect.
    //
    // It used to be pinned to whatever the UI was set to, which meant a bilingual
    // user with English selected who said something in Arabic had it force-decoded
    // as English — Whisper doesn't refuse, it invents English words that sound
    // similar, so the character received something the user never said. Detecting
    // costs nothing here and is what makes "speak either language" actually work.
    // Kloom pins whatever the UI selected, exactly as before. On AIRRAW the pin is
    // Arabic-only and everything else auto-detects, which is what lets a bilingual
    // caller with English selected still be understood in Arabic.
    if (language && (!adult || isArabic)) groqForm.append("language", language)
    // Pin sampling off. Left unset, a short clip can decode differently run to run —
    // the same word coming back as two different words on two tries.
    groqForm.append("temperature", "0")
    // Whisper's `prompt` biases spelling/vocabulary/register toward what it expects.
    // Untuned, Whisper leans MSA and mangles everyday spoken Arabic (measured
    // ~59% WER on Egyptian, ~60% on Gulf — every other word wrong). Deliberately
    // SHORT: accuracy degrades past ~16 tokens as the decoder starts inserting
    // hallucinated continuations, and our clips are short enough to be at risk.
    if (isArabic) groqForm.append("prompt", process.env.STT_PROMPT_AR || AR_STYLE_SEED)
    try {
      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}` },
        body: groqForm,
        signal: AbortSignal.timeout(20000),
      })
      if (res.ok) {
        const data = (await res.json()) as { text?: string }
        return transcript(data.text, "groq", groqModel, arabicTierNote(adult, isArabic, gemKey, elKey))
      }
      console.error("[stt] groq failed:", res.status, (await res.text().catch(() => "")).slice(0, 200))
    } catch (e) {
      console.error("[stt] groq error:", e instanceof Error ? e.message : String(e))
    }
  }

  // ── RunPod Faster-Whisper (secondary) ─────────────────────────────────────
  const rpSTTEndpoint = process.env.RUNPOD_STT_ENDPOINT_ID
  const rpKey         = process.env.RUNPOD_API_KEY
  if (rpSTTEndpoint && rpKey) {
    const r = await runpodWhisper(file, rpSTTEndpoint, rpKey, language)
    if (r.text !== null) {
      return transcript(r.text, "runpod")
    }
    if (!process.env.STT_API_KEY && !process.env.OPENAI_API_KEY) {
      return Response.json({ error: `STT failed: ${r.error || "unknown"}` }, { status: 502 })
    }
  }

  // ── OpenAI-compatible fallback ────────────────────────────────────────────
  const baseUrl = (process.env.STT_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")
  const apiKey  = process.env.STT_API_KEY || process.env.OPENAI_API_KEY
  const model   = process.env.STT_MODEL || "whisper-1"

  // Don't attempt the call with no key — an anonymous request to OpenAI returns 401,
  // which the client treats as a permanent failure and destroys the microphone.
  if (!apiKey) {
    return Response.json({ error: "STT temporarily unavailable — try again" }, { status: 503 })
  }

  const upstreamForm = new FormData()
  upstreamForm.append("file", file, (file as File).name || "audio.webm")
  upstreamForm.append("model", model)
  upstreamForm.append("response_format", "json")
  if (language) upstreamForm.append("language", language)

  let upstream: Response
  try {
    upstream = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
      signal: AbortSignal.timeout(20000),
    })
  } catch (err) {
    return Response.json(
      { error: `STT service unreachable: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    )
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "")
    return Response.json({ error: `Transcription failed (${upstream.status}): ${detail.slice(0, 300)}` }, { status: upstream.status })
  }

  const data = (await upstream.json().catch(() => ({}))) as { text?: string }
  return transcript(data.text, "openai-compatible")
}

// Spoken-dialect vocabulary for Gemini Transcribe.
//
// This is the payload that makes the model worth using. Whisper leans Modern
// Standard Arabic and "corrects" everyday speech into MSA-shaped words — which is
// how a word comes back as a completely different word. Handing the recogniser the
// words people ACTUALLY say, across every dialect on the floor, biases it the
// other way.
//
// All dialects are sent together on purpose: the speaker is a caller, and which
// dialect they speak is exactly what we don't know in advance. The cap is 1,000
// terms and this is well under it.
const AR_DIALECT_VOCAB = [
  // Levantine
  "شو", "هلق", "هيك", "كتير", "منيح", "بدي", "ليش", "شوي", "لسا", "عنجد", "بعرف", "مبارح",
  // Egyptian
  "إزيك", "عامل ايه", "دلوقتي", "كده", "أوي", "عايز", "ماشي", "بص", "خلاص", "يلا", "مش", "إيه",
  // Gulf / Khaleeji
  "شنو", "الحين", "زين", "وايد", "أبغى", "وش", "مو", "عاد", "چذي", "يبه", "تراني", "شفيك",
  // Moroccan Darija
  "واش", "دابا", "بزاف", "غادي", "ديالي", "مزيان", "بغيت", "صافي", "شحال", "فين", "دير",
  // Tunisian Derja
  "شنوة", "برشا", "توا", "باهي", "ياخي", "نحب", "فمة", "برك", "قداش",
  // Common across dialects, and the ones most often mangled into MSA
  "إنت", "إنتي", "احنا", "هدول", "هدا", "كيفك", "شلونك", "عشان", "علشان", "بكرا", "امبارح",
  "طيب", "أكيد", "يعني", "لأ", "أيوة", "إيوا", "معليش", "خلص", "حبيبي", "حبيبتي",
]

// Circuit breaker for the Gemini tier — same reasoning as Scribe's: it sits in
// FRONT of working recognisers, so a broken one must not add its timeout to every
// Arabic turn.
let gemFails = 0
let gemParkedUntil = 0

/**
 * Gemini 3.5 Transcribe via the Interactions API. Returns the transcript, or null
 * on any failure so the caller falls through to Scribe and then Whisper.
 *
 * verbatim, NOT the "smart" mode. Smart mode strips filler words and resolves
 * spoken self-corrections — sensible for meeting notes, wrong here. On an intimate
 * late-night call a hesitation is content, and a character that never hears one
 * loses the thing it is supposed to be responding to.
 *
 * No diarization, no word timestamps: one speaker, and both cost latency we can't
 * spare on a live turn.
 */
async function geminiSTT(file: Blob, key: string, language?: string): Promise<string | null> {
  if (Date.now() < gemParkedUntil) return null
  if (gemParkedUntil) { gemParkedUntil = 0; gemFails = 0 }
  const fail = () => {
    if (++gemFails >= 2) {
      gemParkedUntil = Date.now() + 5 * 60_000
      console.error("[stt] gemini parked for 5m after repeated failures")
    }
  }
  try {
    const b64 = Buffer.from(await file.arrayBuffer()).toString("base64")
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        model: process.env.GEMINI_STT_MODEL || "gemini-3.5-transcribe",
        input: [{ type: "audio", data: b64, mime_type: (file as File).type || "audio/webm" }],
        generation_config: {
          transcription_config: {
            language_codes: [language || "ar"],
            ...(language === "ar" ? { custom_vocabulary: AR_DIALECT_VOCAB } : {}),
            mode: { type: "verbatim" },
          },
        },
      }),
      signal: AbortSignal.timeout(9000),
    })
    if (!res.ok) {
      console.error("[stt] gemini failed:", res.status, (await res.text().catch(() => "")).slice(0, 200))
      fail(); return null
    }
    const data = (await res.json()) as { output_text?: string; text?: string }
    const text = data.output_text ?? data.text
    if (typeof text !== "string") { fail(); return null }
    gemFails = 0
    return text
  } catch (e) {
    console.error("[stt] gemini error:", e instanceof Error ? e.message : String(e))
    fail(); return null
  }
}

// Circuit breaker for the Scribe tier. Because Scribe sits IN FRONT of a working
// fallback, a broken or misconfigured Scribe would otherwise add its full timeout
// to every single Arabic turn before falling through — making the thing slower
// than it was. Two consecutive failures park it for five minutes; the call keeps
// working on Whisper in the meantime and Scribe is retried automatically.
let scribeFails = 0
let scribeParkedUntil = 0
const SCRIBE_TRIP = 2
const SCRIBE_PARK_MS = 5 * 60_000

function scribeAvailable(): boolean {
  if (Date.now() < scribeParkedUntil) return false
  if (scribeParkedUntil) { scribeParkedUntil = 0; scribeFails = 0 }   // park expired — try again
  return true
}
function scribeFailed() {
  if (++scribeFails >= SCRIBE_TRIP) {
    scribeParkedUntil = Date.now() + SCRIBE_PARK_MS
    console.error(`[stt] scribe parked for ${SCRIBE_PARK_MS / 60_000}m after ${scribeFails} failures`)
  }
}

/**
 * ElevenLabs Scribe. Returns the transcript, or null on ANY failure so the caller
 * falls through to Whisper — a live call must never be left without speech input
 * because one provider had a bad minute.
 *
 * Timeout is tight (8s): this sits in front of a working fallback, so waiting
 * costs more than moving on. An utterance is a few seconds of audio; a healthy
 * response lands well inside this.
 */
async function scribeSTT(file: Blob, key: string, language?: string): Promise<string | null> {
  // `language` is optional and normally omitted — Scribe auto-detects, which is
  // what makes a character bilingual. Pass one only to force a specific language.
  if (!scribeAvailable()) return null
  try {
    const form = new FormData()
    form.append("file", file, (file as File).name || "audio.webm")
    form.append("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v1")
    if (language) form.append("language_code", language)
    // We want words, not "[door slams]" — audio-event tags would be read out by
    // the character as if they were something the user said.
    form.append("tag_audio_events", "false")
    form.append("diarize", "false")
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": key },
      body: form,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error("[stt] scribe failed:", res.status, (await res.text().catch(() => "")).slice(0, 200))
      scribeFailed()
      return null
    }
    const data = (await res.json()) as { text?: string }
    if (typeof data.text !== "string") { scribeFailed(); return null }
    scribeFails = 0
    return data.text
  } catch (e) {
    console.error("[stt] scribe error:", e instanceof Error ? e.message : String(e))
    scribeFailed()
    return null
  }
}

// RunPod faster-whisper worker. Sends audio as base64, polls if cold-starting.
// Returns the transcript string, or null on any failure (caller falls back).
async function runpodWhisper(
  file: Blob,
  endpointId: string,
  key: string,
  language?: string,
): Promise<{ text: string | null; error?: string }> {
  const base    = `https://api.runpod.ai/v2/${endpointId}`
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }
  try {
    const buf    = await file.arrayBuffer()
    const b64    = Buffer.from(buf).toString("base64")
    // faster-whisper model (tiny|base|small|medium|large-v3|turbo). Use a RunPod-specific
    // var so it can't collide with STT_MODEL, which is the OpenAI-compat fallback's model id
    // (e.g. "whisper-1" — an invalid value for this worker).
    const model  = process.env.RUNPOD_STT_MODEL || "large-v3"

    const res = await fetch(`${base}/runsync`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: {
          audio_base64:  b64,                    // worker wants base64 here; `audio` is a URL field
          model:         model,
          language:      language || undefined,  // omit → whisper auto-detects (multilingual)
          transcription: "plain_text",
          word_timestamps: false,
          enable_vad:    true,                   // skip non-speech → far fewer silence hallucinations
          no_speech_threshold: 0.6,              // be stricter about "this segment is silence"
          condition_on_previous_text: false,     // don't let a phantom line prime the next
        },
      }),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) return { text: null, error: `http ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}` }
    let data: any = await res.json()

    // Poll if worker was cold (IN_QUEUE / IN_PROGRESS).
    let tries = 0
    while ((data?.status === "IN_PROGRESS" || data?.status === "IN_QUEUE") && tries < 30) {
      await sleep(2000)
      const s = await fetch(`${base}/status/${data.id}`, { headers })
      if (!s.ok) return { text: null, error: `poll http ${s.status}` }
      data = await s.json()
      tries++
    }
    if (data?.status !== "COMPLETED") return { text: null, error: `status=${data?.status}; ${JSON.stringify(data?.error || data?.output || "").slice(0, 200)}` }

    const o = data?.output
    const text: string | undefined =
      o?.transcription ?? o?.text ?? o?.[0]?.text ??
      (Array.isArray(o?.segments) ? o.segments.map((s: any) => s?.text || "").join(" ") : undefined)

    if (typeof text === "string") return { text: text.trim() }
    return { text: null, error: `no transcript in output: ${JSON.stringify(o).slice(0, 200)}` }
  } catch (e) {
    return { text: null, error: e instanceof Error ? e.message : String(e) }
  }
}

