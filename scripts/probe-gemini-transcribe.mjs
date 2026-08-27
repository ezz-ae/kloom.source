#!/usr/bin/env node
/**
 * Establish whether Gemini 3.5 Transcribe is usable for AIRRAW, and in what shape.
 *
 *   vercel env pull .env.local
 *   node scripts/probe-gemini-transcribe.mjs
 *
 * WHY A PROBE AND NOT JUST AN INTEGRATION: the announcement is newer than what I
 * could verify, and every unauthenticated request to Google's API host returns the
 * same 403 regardless of whether the path exists — so the model name, the endpoint
 * and the request body could not be confirmed from outside. Arabic recognition
 * currently works through ElevenLabs Scribe; guessing a shape and wiring it into
 * that path could only make it worse.
 *
 * This sends ONE second of real audio and reports exactly what each candidate
 * shape returns, so the integration can be finished against facts. It is
 * read-only apart from the transcription call itself (a few thousandths of a
 * cent) and touches nothing in the app.
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

const KEY = process.env.GEMINI_API_KEY || fromEnvFile("GEMINI_API_KEY")
if (!KEY) {
  console.error("No GEMINI_API_KEY found. Run:  vercel env pull .env.local")
  process.exit(1)
}

// A real 1s 16kHz mono WAV (a quiet tone) — enough for the API to accept and
// respond. We care about the SHAPE of the answer, not the words in it.
function wav() {
  const rate = 16000, secs = 1, n = rate * secs
  const data = Buffer.alloc(n * 2)
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(3000 * Math.sin(2 * Math.PI * 220 * i / rate)), i * 2)
  const h = Buffer.alloc(44)
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8)
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34)
  h.write("data", 36); h.writeUInt32LE(data.length, 40)
  return Buffer.concat([h, data])
}
const B64 = wav().toString("base64")

// Arabic dialect markers — the whole reason this model is interesting. If custom
// vocabulary works, this is the lever on "a word arrives as a different word".
const AR_VOCAB = ["شو","هلق","هيك","إزيك","دلوقتي","عايز","واش","دابا","بزاف","شنو","الحين","وايد","زين","برشا","توا","يلا","خلص","مش","ماشي"]

async function post(url, body) {
  const t0 = Date.now()
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify(body),
    })
    const text = await r.text()
    return { ok: r.ok, status: r.status, ms: Date.now() - t0, text }
  } catch (e) { return { ok: false, status: 0, ms: Date.now() - t0, text: String(e) } }
}

const results = []
const show = (label, r) => {
  const head = r.text.replace(/\s+/g, " ").slice(0, 300)
  console.log(`\n${r.ok ? "OK  " : "FAIL"} [${r.status}] ${r.ms}ms  ${label}`)
  console.log(`     ${head}`)
  results.push({ label, ok: r.ok, status: r.status, ms: r.ms, head })
}

console.log("=== 1. Does the model exist? ===")
const list = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
  headers: { "x-goog-api-key": KEY },
}).then((r) => r.json()).catch((e) => ({ error: String(e) }))
const names = (list.models || []).map((m) => m.name.replace("models/", ""))
const transcribe = names.filter((n) => /transcribe/i.test(n))
console.log(`models visible: ${names.length}`)
console.log(`transcribe models: ${transcribe.length ? transcribe.join(", ") : "(none found)"}`)
if (list.error) console.log("list error:", JSON.stringify(list.error).slice(0, 240))

const MODEL = transcribe[0] || "gemini-3.5-transcribe"
console.log(`\nusing model: ${MODEL}`)

console.log("\n=== 2. Interactions API (the shape the announcement showed) ===")
show("POST /v1beta/interactions (inline audio)", await post(
  "https://generativelanguage.googleapis.com/v1beta/interactions",
  {
    model: MODEL,
    input: [{ type: "audio", data: B64, mime_type: "audio/wav" }],
    generation_config: {
      transcription_config: {
        language_codes: ["ar"],
        custom_vocabulary: AR_VOCAB,
        mode: { type: "verbatim" },
      },
    },
  },
))

console.log("\n=== 3. generateContent fallback (the shape that exists today) ===")
show(`POST /v1beta/models/${MODEL}:generateContent`, await post(
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
  {
    contents: [{ parts: [
      { text: "Transcribe this audio verbatim in Arabic. Output only the transcript." },
      { inline_data: { mime_type: "audio/wav", data: B64 } },
    ] }],
  },
))

console.log("\n=== 4. Same, on a model we know exists (control) ===")
show("POST /v1beta/models/gemini-2.5-flash:generateContent", await post(
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
  {
    contents: [{ parts: [
      { text: "Transcribe this audio verbatim. Output only the transcript." },
      { inline_data: { mime_type: "audio/wav", data: B64 } },
    ] }],
  },
))

// Everything above scrolls. The single block worth pasting back goes LAST.
const [interactions, genContent, control] = results
const verdict =
  interactions?.ok ? "INTERACTIONS_API_WORKS  (custom_vocabulary available — the dialect fix)"
  : genContent?.ok ? "GENERATECONTENT_WORKS   (model usable, no custom vocabulary)"
  : control?.ok    ? "MODEL_UNAVAILABLE       (key is fine; this model isn't on the account yet)"
  :                  "KEY_OR_NETWORK_PROBLEM  (even the control call failed)"

const summary = [
  "───────── PASTE THIS BACK ─────────",
  `models visible : ${names.length}`,
  `transcribe     : ${transcribe.length ? transcribe.join(", ") : "(none found)"}`,
  `model used     : ${MODEL}`,
  ...results.map((r) => `${r.ok ? "OK  " : "FAIL"} [${String(r.status).padEnd(3)}] ${String(r.ms).padStart(5)}ms  ${r.label}`),
  ...results.filter((r) => !r.ok).map((r) => `   why: ${r.head.slice(0, 180)}`),
  `VERDICT: ${verdict}`,
  "───────────────────────────────────",
].join("\n")

console.log("\n" + summary)
try {
  const { writeFileSync } = await import("node:fs")
  writeFileSync("gemini-probe.txt", summary + "\n")
  console.log("(also written to gemini-probe.txt)")
} catch { /* printing is enough */ }
