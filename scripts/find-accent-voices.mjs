#!/usr/bin/env node
/**
 * Find real accented voices for AIRRAW and print the env lines to paste.
 *
 *   ELEVENLABS_API_KEY=sk_... node scripts/find-accent-voices.mjs
 *   ELEVENLABS_API_KEY=sk_... node scripts/find-accent-voices.mjs --library
 *
 * Why this exists: the premade voice set is ~21 voices, all American/British/
 * Australian. Several are marked "verified" for Arabic, but with accent
 * "standard" — an English voice reading Arabic, which is exactly why the Arabic
 * voices don't sound Arab. Real Egyptian/Moroccan/Levantine/Khaleeji voices are
 * in the shared library, which needs your key to read.
 *
 * READ-ONLY. It never adds or changes a voice on the account. Voice slots are
 * capped and filling them automatically would be tedious to undo — adding is
 * left as a deliberate act in the ElevenLabs UI.
 *
 * Nothing here is required: the server also discovers accents from the account's
 * own voices at runtime (lib/airraw/voice-discovery.ts). This is for seeing what
 * the library has before you add any.
 */

// The key lives in Vercel, so the normal path is `vercel env pull` and then just
// running this — read it out of the pulled file rather than making anyone paste a
// secret onto a command line (where it lands in shell history).
import { readFileSync, existsSync } from "node:fs"

function fromEnvFile(name) {
  for (const f of [".env.local", ".env", ".env.production.local", "kloom.env"]) {
    if (!existsSync(f)) continue
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && m[1] === name) {
        const v = m[2].trim().replace(/^["']|["']$/g, "")
        if (v) { console.error(`(using ${name} from ${f})`); return v }
      }
    }
  }
  return ""
}

const KEY = process.env.ELEVENLABS_API_KEY || fromEnvFile("ELEVENLABS_API_KEY")
if (!KEY) {
  console.error(`No ELEVENLABS_API_KEY found.

The key is on Vercel, so pull it first:

  vercel env pull .env.local
  node scripts/find-accent-voices.mjs --library

(.env.local is gitignored — the key never enters the repo or your shell history.)`)
  process.exit(1)
}
const USE_LIBRARY = process.argv.includes("--library")

// Same table the server uses — keep them in step (lib/airraw/voice-discovery.ts).
// Order matters: first match wins, so a country beats the region containing it.
const ACCENTS = [
  ["AR_EG",   { label: "Egyptian",  lang: "ar", locales: ["ar-eg"], terms: ["egyptian","egypt","cairo","masri","masry"] }],
  ["AR_MA",   { label: "Moroccan",  lang: "ar", locales: ["ar-ma"], terms: ["moroccan","morocco","darija","maghrebi"] }],
  ["AR_TN",   { label: "Tunisian",  lang: "ar", locales: ["ar-tn"], terms: ["tunisian","tunisia","derja"] }],
  ["AR_LB",   { label: "Levantine", lang: "ar", locales: ["ar-lb","ar-sy","ar-jo","ar-ps"], terms: ["lebanese","lebanon","levantine","syrian","jordanian","shami","palestinian"] }],
  ["AR_GULF", { label: "Khaleeji",  lang: "ar", locales: ["ar-sa","ar-ae","ar-kw","ar-qa","ar-bh","ar-om"], terms: ["gulf","khaleeji","saudi","emirati","kuwaiti","qatari","bahraini","omani"] }],
  ["EN_RU",   { label: "Slavic",    lang: "en", locales: [], terms: ["russian","slavic","ukrainian"] }],
  ["EN_TR",   { label: "Turkish",   lang: "en", locales: [], terms: ["turkish"] }],
  ["EN_IN",   { label: "Indian",    lang: "en", locales: ["en-in"], terms: ["indian","pakistani","bengali","sri lankan","hindi"] }],
  ["EN_NG",   { label: "Nigerian",  lang: "en", locales: ["en-ng"], terms: ["nigerian","ghanaian","kenyan","west african"] }],
  ["EN_LATAM",{ label: "Latin",     lang: "en", locales: [], terms: ["mexican","colombian","argentinian","chilean","latin american","latino","latina"] }],
]
const LABEL = Object.fromEntries(ACCENTS.map(([k, c]) => [k, c.label]))

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const hasWord = (h, t) => new RegExp(`\\b${esc(t)}\\b`).test(h)

// Name + accent labels + locales ONLY. Matching free-text descriptions is how
// "Romanian" (contains "omani") and every "woman" became Gulf Arabs.
const hay = (v) => [
  v.name, v.accent, v.labels?.accent,
  ...(v.verified_languages || []).flatMap((x) => [x.accent, x.locale]),
].filter(Boolean).join(" ").toLowerCase()

const langsOf = (v) => {
  const out = new Set()
  if (v.labels?.language) out.add(String(v.labels.language).toLowerCase())
  if (v.language) out.add(String(v.language).toLowerCase())
  for (const x of v.verified_languages || []) if (x.language) out.add(String(x.language).toLowerCase())
  return out
}

/** The ONE accent this voice belongs to, or null. */
const accentOf = (v) => {
  const h = hay(v), L = langsOf(v)
  for (const [key, cfg] of ACCENTS) {
    if (!L.has(cfg.lang)) continue
    if (cfg.locales.some((l) => h.includes(l))) return key
    if (cfg.terms.some((t) => hasWord(h, t))) return key
  }
  return null
}

const genderOf = (v) => {
  const g = String(v.gender || v.labels?.gender || "").toLowerCase()
  return g.startsWith("m") ? "MALE" : g.startsWith("f") ? "FEMALE" : null
}

async function get(url) {
  const r = await fetch(url, { headers: { "xi-api-key": KEY } })
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`)
  return r.json()
}

const found = {}   // "ACCENT|GENDER" -> [{id, name}]
const note = (accent, gender, v) => {
  const k = `${accent}|${gender}`
  ;(found[k] ||= []).push({ id: v.voice_id, name: v.name })
}

// ── the account's own voices (what the server can already use) ──────────────
const mine = await get("https://api.elevenlabs.io/v1/voices")
console.log(`account voices: ${mine.voices.length}`)
const native = {}
for (const v of mine.voices) {
  const nat = String(v.labels?.language || "").toLowerCase()
  if (nat) (native[nat] ||= []).push(v.name)
  const key = accentOf(v)
  if (!key) continue
  const g = genderOf(v)
  for (const gg of g ? [g] : ["MALE", "FEMALE"]) note(key, gg, v)
}
console.log("native-language voices on the account:",
  Object.entries(native).map(([k, v]) => `${k}=${v.length}`).join(" ") || "(none)")

// ── the shared library (needs adding to the account before use) ─────────────
const library = {}
if (USE_LIBRARY) {
  for (const lang of ["ar", "en"]) {
    for (const gender of ["male", "female"]) {
      let page
      try {
        page = await get(`https://api.elevenlabs.io/v1/shared-voices?page_size=100&language=${lang}&gender=${gender}`)
      } catch (e) { console.error(`  library ${lang}/${gender}: ${e.message}`); continue }
      for (const v of page.voices || []) {
        const key = accentOf({ ...v, labels: { ...(v.labels || {}), language: v.language || lang } })
        if (!key) continue
        const k = `${key}|${gender.toUpperCase()}`
        ;(library[k] ||= []).push({ id: v.voice_id, name: v.name })
      }
    }
  }
}

console.log("\n=== ON YOUR ACCOUNT — usable right now, no setup ===")
const mineKeys = Object.keys(found).sort()
if (!mineKeys.length) console.log("  (none — every account voice is American/British/Australian)")
for (const k of mineKeys) {
  const [a, g] = k.split("|")
  console.log(`ELEVENLABS_VOICES_${a}_${g}=${found[k].map((x) => x.id).join(",")}`)
  console.log(`  # ${LABEL[a]}: ${found[k].map((x) => x.name).join(", ")}`)
}
console.log("\n(The server discovers these itself at runtime — you only need the env")
console.log(" lines if you want to pin an exact set.)")

if (USE_LIBRARY) {
  console.log("\n=== IN THE SHARED LIBRARY — add in the ElevenLabs UI, then they work ===")
  const libKeys = Object.keys(library).sort()
  if (!libKeys.length) console.log("  (no matches)")
  for (const k of libKeys) {
    const [a, g] = k.split("|")
    const top = library[k].slice(0, 6)
    console.log(`\n${LABEL[a]} ${g.toLowerCase()} — ${library[k].length} available:`)
    for (const v of top) console.log(`  ${v.id}  ${v.name}`)
  }
  console.log("\nAdd the ones you like in the ElevenLabs UI (Voices → Library → Add).")
  console.log("Once added they show up on the account and the server picks them up")
  console.log("automatically within 6 hours, or immediately on the next cold start.")
} else {
  console.log("\nRun with --library to see the Egyptian / Moroccan / Levantine / Khaleeji")
  console.log("voices available to add — that's where the real Arabic accents are.")
}
