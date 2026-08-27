#!/usr/bin/env node
/**
 * Run the same Arabic audio through Gemini Transcribe, ElevenLabs Scribe and
 * Groq Whisper, and print what each heard plus how long it took.
 *
 *   vercel env pull .env.local
 *   node scripts/compare-arabic-stt.mjs my-clip.webm
 *
 * Record a few seconds of yourself speaking dialect — ideally the words that keep
 * coming back wrong — and this shows, side by side, which recogniser to keep.
 * Latency and accuracy pull in opposite directions here and the trade is a
 * judgement call about your product, so this reports both rather than deciding.
 */
import { readFileSync, existsSync } from "node:fs"

function fromEnvFile(name) {
  for (const f of [".env.local", ".env", ".env.production.local", "kloom.env"]) {
    if (!existsSync(f)) continue
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && m[1] === name) {
        const v = m[2].trim().replace(/^["']|["']$/g, "")
        if (v) return v
      }
    }
  }
  return ""
}
const env = (n) => process.env[n] || fromEnvFile(n)

const path = process.argv[2]
if (!path || !existsSync(path)) {
  console.error("Usage: node scripts/compare-arabic-stt.mjs <audio file>\n" +
    "Record a few seconds of spoken dialect first — .webm, .m4a, .wav and .mp3 all work.")
  process.exit(1)
}
const bytes = readFileSync(path)
const mime = path.endsWith(".wav") ? "audio/wav" : path.endsWith(".mp3") ? "audio/mpeg"
  : path.endsWith(".m4a") || path.endsWith(".mp4") ? "audio/mp4" : "audio/webm"
console.log(`clip: ${path}  (${(bytes.length / 1024).toFixed(0)} KB, ${mime})\n`)

const AR_VOCAB = ["شو","هلق","هيك","كتير","منيح","بدي","ليش","إزيك","دلوقتي","كده","أوي","عايز","ماشي",
  "شنو","الحين","زين","وايد","أبغى","وش","مو","واش","دابا","بزاف","غادي","مزيان","بغيت",
  "شنوة","برشا","توا","باهي","يعني","لأ","أيوة","خلص","معليش","حبيبي","حبيبتي"]

const time = async (label, fn) => {
  const t0 = Date.now()
  try {
    const text = await fn()
    console.log(`\n${label}  (${Date.now() - t0}ms)`)
    console.log(text ? `  ${text}` : "  (empty)")
  } catch (e) {
    console.log(`\n${label}  FAILED after ${Date.now() - t0}ms`)
    console.log(`  ${String(e.message || e).slice(0, 220)}`)
  }
}

const gem = env("GEMINI_API_KEY")
if (gem) {
  await time("GEMINI 3.5 TRANSCRIBE (with dialect vocabulary)", async () => {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": gem },
      body: JSON.stringify({
        model: process.env.GEMINI_STT_MODEL || "gemini-3.5-transcribe",
        input: [{ type: "audio", data: bytes.toString("base64"), mime_type: mime }],
        generation_config: { transcription_config: {
          language_codes: ["ar"], custom_vocabulary: AR_VOCAB, mode: { type: "verbatim" },
        } },
      }),
    })
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`)
    const d = await r.json()
    return d.output_text ?? d.text ?? JSON.stringify(d).slice(0, 200)
  })
  // Same model, no vocabulary — isolates what the word list is actually buying.
  await time("GEMINI 3.5 TRANSCRIBE (no vocabulary — the control)", async () => {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": gem },
      body: JSON.stringify({
        model: process.env.GEMINI_STT_MODEL || "gemini-3.5-transcribe",
        input: [{ type: "audio", data: bytes.toString("base64"), mime_type: mime }],
        generation_config: { transcription_config: { language_codes: ["ar"], mode: { type: "verbatim" } } },
      }),
    })
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`)
    const d = await r.json()
    return d.output_text ?? d.text ?? JSON.stringify(d).slice(0, 200)
  })
} else console.log("\n(no GEMINI_API_KEY — skipping Gemini)")

const el = env("ELEVENLABS_API_KEY")
if (el) {
  await time("ELEVENLABS SCRIBE (what production uses today)", async () => {
    const fd = new FormData()
    fd.append("file", new Blob([bytes], { type: mime }), path.split("/").pop())
    fd.append("model_id", "scribe_v1")
    fd.append("tag_audio_events", "false")
    const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST", headers: { "xi-api-key": el }, body: fd,
    })
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`)
    return (await r.json()).text
  })
} else console.log("\n(no ELEVENLABS_API_KEY — skipping Scribe)")

const groq = env("GROQ_API_KEY")
if (groq) {
  await time("GROQ WHISPER large-v3 (the fallback)", async () => {
    const fd = new FormData()
    fd.append("file", new Blob([bytes], { type: mime }), path.split("/").pop())
    fd.append("model", "whisper-large-v3")
    fd.append("language", "ar")
    fd.append("temperature", "0")
    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${groq}` }, body: fd,
    })
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`)
    return (await r.json()).text
  })
} else console.log("\n(no GROQ_API_KEY — skipping Whisper)")

console.log(`
─────────────────────────────────────────────
Read the transcripts, not the timings alone. If Gemini-with-vocabulary is the
only one that gets your words right, the extra second is worth it:

  vercel env add STT_GEMINI production --value 1 && vercel --prod

If Scribe is already correct, leave it — it is about three times faster.
─────────────────────────────────────────────`)
