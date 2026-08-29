#!/usr/bin/env node
/**
 * Is a hand-set env list standing in front of the good voices?
 *
 *   vercel env pull .env.production.local --environment=production
 *   node scripts/check-voice-env.mjs .env.production.local
 *
 * Reads only — it changes nothing, it PRINTS the commands to run.
 *
 * Two things go wrong with ELEVENLABS_VOICES_* lists, and both are invisible
 * from the Vercel dashboard because a voice id says nothing about the voice:
 *
 *   1. an ARABIC list containing voices from the built-in ENGLISH pool. That is
 *      the "Arabic characters sound English" bug, pinned in place by env.
 *   2. a FLAT ELEVENLABS_VOICES_AR_* list at all. It sits below per-accent
 *      casting but above the account's native-Arabic voices, so it catches every
 *      character whose specific region has no voice — and flattens Egyptian,
 *      Levantine, Gulf and Moroccan into one undifferentiated pool.
 */
import { readFileSync, existsSync } from "node:fs"

const file = process.argv[2] || (existsSync(".env.production.local") ? ".env.production.local" : ".env.local")
if (!existsSync(file)) {
  console.error(`No ${file}. Pull it first:\n\n  vercel env pull .env.production.local --environment=production\n`)
  process.exit(1)
}

// The built-in English pools, read from the route so this can't drift from what
// actually ships.
const route = readFileSync("app/api/tts/route.ts", "utf8")
const pool = (name) => {
  const i = route.indexOf(`const ${name}`)
  return new Set([...route.slice(i, route.indexOf("]", i)).matchAll(/"([A-Za-z0-9]{15,})"/g)].map((m) => m[1]))
}
const EN = new Set([...pool("EL_FEMALE"), ...pool("EL_MALE")])

const env = {}
for (const line of readFileSync(file, "utf8").split("\n")) {
  const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "")
}

const voiceVars = Object.keys(env).filter((k) => /^ELEVENLABS_VOICES?_/.test(k) && !/_STT_|_API_/.test(k))
if (!voiceVars.length) {
  console.log(`No ELEVENLABS_VOICES_* pins in ${file}.`)
  console.log("Casting is entirely up to runtime discovery, which is what you want.")
  process.exit(0)
}

console.log(`voice pins in ${file}:\n`)
const rm = [], note = []
for (const k of voiceVars.sort()) {
  const ids = env[k].split(",").map((s) => s.trim()).filter(Boolean)
  const eng = ids.filter((id) => EN.has(id))
  const isArabicList = /_AR(_|$)/.test(k)
  console.log(`  ${k}  (${ids.length} voice${ids.length === 1 ? "" : "s"})`)
  if (eng.length) {
    console.log(`    ${eng.length} of them are from the built-in ENGLISH pool: ${eng.join(", ")}`)
    if (isArabicList) { rm.push(k); note.push(`${k}: Arabic list holding English voices`) }
  }
  // A flat AR list (no region) short-circuits regional casting for every accent
  // that has no voice of its own.
  if (/^ELEVENLABS_VOICES_AR_(FEMALE|MALE)$/.test(k) && !rm.includes(k)) {
    rm.push(k); note.push(`${k}: flat Arabic pool, flattens every region into one`)
  }
}

if (!rm.length) {
  console.log("\nNothing here is standing in the way. Leave it as is.")
  process.exit(0)
}

console.log(`\n${rm.length} pin(s) worth removing — the account's own Arabic voices are better,`)
console.log("and discovery sorts them by region (Egyptian, Levantine, Gulf, Moroccan, Tunisian):\n")
for (const n of note) console.log(`  · ${n}`)
console.log("\nRun:\n")
for (const k of rm) for (const e of ["production", "preview", "development"]) {
  console.log(`  vercel env rm ${k} ${e} --yes 2>/dev/null || true`)
}
console.log(`\nThen redeploy. If discovery ever can't reach ElevenLabs, casting falls back to`)
console.log(`the account's native-Arabic voices and then the general pool — never to nothing.`)
