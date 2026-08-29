#!/usr/bin/env node
/**
 * How much of spoken Arabic actually survives the round trip.
 *
 *   node scripts/ar-stt-wer.mjs                       # against production
 *   BASE=http://localhost:3000 node scripts/ar-stt-wer.mjs
 *
 * Speaks a line of everyday dialect with the site's OWN TTS, feeds that audio
 * straight back to the site's OWN /api/stt, and compares against the text we
 * asked for. No keys needed — it only talks to the deployed site — which is what
 * makes it runnable when the report is "the Arabic is barely understood" and
 * nobody can say which of five tiers is answering.
 *
 * TWO NUMBERS, and the second is the one that matters:
 *   raw        — every difference, including hamza and ة/ى spelling
 *   normalized — after folding أإآ→ا, ى→ي, ة→ه. Arabic orthography varies and
 *                the model reading the transcript handles that fine, so this is
 *                the rate of genuine MISHEARINGS.
 *
 * And it is a FLOOR. Synthetic speech is cleaner than a person on a phone in a
 * room, so whatever this reports, real callers do worse.
 */
const BASE = (process.env.BASE || "https://airraw.com").replace(/\/$/, "")
const VOICE = process.env.VOICE || ""   // optional: pin an ElevenLabs voice id

// Everyday spoken lines, not textbook Arabic — mixed Egyptian and Levantine,
// because the floor is both. Each carries at least one word MSA-trained models
// are known to "correct" into a different word.
const LINES = [
  "إزيك، أنا لسه صاحية",
  "إنت عامل إيه دلوقتي",
  "مش عايز أتكلم في الموضوع ده",
  "بص، أنا تعبانة أوي النهاردة",
  "يلا قوللي، إيه اللي حصل",
  "أنا مش قادرة أنام خالص",
  "عايزاك تفضل معايا شوية",
  "دا كلام فاضي، بجد",
  "شو عم تعمل هلق",
  "ما بدي احكي عن هالموضوع",
]

const strip = (s) => s.replace(/[.،؟!,?"«»]/g, " ").replace(/\s+/g, " ").trim()
const norm = (s) => strip(s).replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ّ/g, "")

function distance(ref, hyp) {
  const a = ref.split(" "), b = hyp.split(" ")
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1])
  return { err: d[a.length][b.length], words: a.length }
}

let rawErr = 0, rawWords = 0, nErr = 0, nWords = 0
let provider = "(not reported — deploy the X-STT-Provider header)"
let fallback = ""

for (const line of LINES) {
  const body = { text: line, personaName: "Probe", seedKey: "Probe", gender: "female", language: "Arabic" }
  if (VOICE) body.elevenId = VOICE
  const tts = await fetch(`${BASE}/api/tts`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  })
  if (!tts.ok) { console.log(`  TTS ${tts.status} — skipped: ${line}`); continue }
  const audio = new Blob([await tts.arrayBuffer()], { type: "audio/mpeg" })

  const form = new FormData()
  form.append("file", audio, "audio.mp3")
  form.append("language", "ar")
  const stt = await fetch(`${BASE}/api/stt`, { method: "POST", body: form })
  const got = (await stt.json().catch(() => ({})))?.text || ""
  provider = stt.headers.get("x-stt-provider") || provider
  fallback = stt.headers.get("x-stt-fallback") || fallback

  const r = distance(strip(line), strip(got))
  const n = distance(norm(line), norm(got))
  rawErr += r.err; rawWords += r.words; nErr += n.err; nWords += n.words
  console.log(`${n.err === 0 ? "ok  " : "MISS"} ${n.err}/${n.words}`)
  console.log(`     said: ${line}`)
  console.log(`     got : ${got}`)
}

console.log(`\nprovider : ${provider}`)
if (fallback) console.log(`fallback : ${fallback}   <- why the better Arabic tiers didn't answer`)
console.log(`raw WER        : ${(100 * rawErr / rawWords).toFixed(0)}%  (${rawErr}/${rawWords})`)
console.log(`normalized WER : ${(100 * nErr / nWords).toFixed(0)}%  (${nErr}/${nWords})  <- real mishearings`)
