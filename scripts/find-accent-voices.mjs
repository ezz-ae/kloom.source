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

const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) {
  console.error("Set ELEVENLABS_API_KEY first:\n  ELEVENLABS_API_KEY=sk_... node scripts/find-accent-voices.mjs")
  process.exit(1)
}
const USE_LIBRARY = process.argv.includes("--library")

// Same table the server uses — keep them in step.
const ACCENTS = {
  AR_EG:   { label: "Egyptian",  lang: "ar", terms: ["egyptian", "egypt", "cairo", "masri"] },
  AR_MA:   { label: "Moroccan",  lang: "ar", terms: ["moroccan", "morocco", "darija", "maghrebi"] },
  AR_TN:   { label: "Tunisian",  lang: "ar", terms: ["tunisian", "tunisia", "derja"] },
  AR_LB:   { label: "Levantine", lang: "ar", terms: ["lebanese", "levantine", "lebanon", "syrian", "jordanian", "shami", "palestinian"] },
  AR_GULF: { label: "Khaleeji",  lang: "ar", terms: ["gulf", "khaleeji", "saudi", "emirati", "kuwaiti", "qatari", "bahraini", "omani"] },
  EN_RU:   { label: "Slavic",    lang: "en", terms: ["russian", "slavic", "ukrainian"] },
  EN_TR:   { label: "Turkish",   lang: "en", terms: ["turkish"] },
  EN_IN:   { label: "Indian",    lang: "en", terms: ["indian", "hindi", "pakistani"] },
  EN_NG:   { label: "Nigerian",  lang: "en", terms: ["nigerian", "african", "ghanaian"] },
  EN_LATAM:{ label: "Latin",     lang: "en", terms: ["mexican", "latin", "colombian", "argentin"] },
}

const hay = (v) => [
  v.name, v.accent, v.description, v.labels?.accent, v.labels?.description,
  ...(v.verified_languages || []).flatMap((x) => [x.accent, x.locale, x.language]),
].filter(Boolean).join(" ").toLowerCase()

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
for (const v of mine.voices) {
  const h = hay(v)
  for (const [key, cfg] of Object.entries(ACCENTS)) {
    if (!cfg.terms.some((t) => h.includes(t))) continue
    const g = genderOf(v)
    for (const gg of g ? [g] : ["MALE", "FEMALE"]) note(key, gg, v)
  }
}

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
        const h = hay(v)
        for (const [key, cfg] of Object.entries(ACCENTS)) {
          if (cfg.lang !== lang) continue
          if (!cfg.terms.some((t) => h.includes(t))) continue
          const k = `${key}|${gender.toUpperCase()}`
          ;(library[k] ||= []).push({ id: v.voice_id, name: v.name })
        }
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
  console.log(`  # ${ACCENTS[a].label}: ${found[k].map((x) => x.name).join(", ")}`)
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
    console.log(`\n${ACCENTS[a].label} ${g.toLowerCase()} — ${library[k].length} available:`)
    for (const v of top) console.log(`  ${v.id}  ${v.name}`)
  }
  console.log("\nAdd the ones you like in the ElevenLabs UI (Voices → Library → Add).")
  console.log("Once added they show up on the account and the server picks them up")
  console.log("automatically within 6 hours, or immediately on the next cold start.")
} else {
  console.log("\nRun with --library to see the Egyptian / Moroccan / Levantine / Khaleeji")
  console.log("voices available to add — that's where the real Arabic accents are.")
}
