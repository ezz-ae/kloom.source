#!/usr/bin/env node
/**
 * Give the floor real accents.
 *
 *   vercel env pull .env.local
 *   node scripts/find-accent-voices.mjs                 # what you have / what exists
 *   node scripts/find-accent-voices.mjs --fill          # plan: what it would add
 *   node scripts/find-accent-voices.mjs --fill --yes    # actually add them
 *
 * WHY: the premade voice set is ~21 voices, all American/British/Australian.
 * Several are marked "verified" for Arabic, but with accent "standard" — an
 * English voice reading Arabic, which is exactly why the Arabic voices don't
 * sound Arab. The real Egyptian/Moroccan/Levantine/Khaleeji voices live in the
 * shared library, which a paid plan can copy onto the account.
 *
 * Once a voice is on the account, nothing else needs doing: the server sorts
 * account voices into accent pools itself (lib/airraw/voice-discovery.ts) and
 * /api/tts prefers the pool matching the character's face. Env lines are printed
 * only for pinning an exact set.
 *
 * SAFE BY DEFAULT: --fill prints a plan and changes nothing. Adding requires
 * --yes, respects the account's voice-slot limit, and never removes anything.
 */
import { readFileSync, existsSync } from "node:fs"

// The key lives in Vercel, so the normal path is `vercel env pull` and then just
// running this — read it out of the pulled file rather than making anyone paste a
// secret onto a command line (where it lands in shell history).
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
  node scripts/find-accent-voices.mjs --fill

(.env.local is gitignored — the key never enters the repo or your shell history.)`)
  process.exit(1)
}

const argv = process.argv.slice(2)
const has = (f) => argv.some((a) => a === f || a.startsWith(f + "="))
const val = (f, d) => { const a = argv.find((x) => x.startsWith(f + "=")); return a ? Number(a.split("=")[1]) || d : d }

const FILL = has("--fill")
const APPLY = has("--yes")
const PER = val("--fill", 2)              // voices to add per accent+gender
const MAX_ADD = val("--max", 60)          // absolute ceiling on one run
// --add id1,id2 still works for picking exact voices by hand.
const ADD_IDS = (argv.find((a) => a.startsWith("--add")) || "").replace(/^--add=?/, "").split(",").map((x) => x.trim()).filter(Boolean)
const WANT_LIBRARY = FILL || ADD_IDS.length > 0 || has("--library")

// ONE accent table, shared with the server (lib/airraw/voice-discovery.ts) so the
// two can't drift. Order matters: first match wins, a country beats its region.
const SPECS = JSON.parse(readFileSync(new URL("../lib/airraw/accent-specs.json", import.meta.url), "utf8"))
const LABEL = Object.fromEntries(SPECS.map((s) => [s.key, s.label]))
// Every language any accent is defined in — this is what we page the library for.
const LANGS = [...new Set(SPECS.map((s) => s.lang))]

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const hasWord = (h, t) => new RegExp(`\\b${esc(t)}\\b`).test(h)

// Name + accent label + the verified rows FOR THAT LANGUAGE. Matching free-text
// descriptions is how "Romanian" (contains "omani") and every "woman" became
// Gulf Arabs; flattening ALL verified rows into one string is how English voices
// carrying an ar-SA verification became them a second time.
const hay = (v, lang) => [
  v.name, v.accent, v.labels?.accent,
  ...(v.verified_languages || [])
    .filter((x) => String(x.language || "").toLowerCase() === lang)
    .flatMap((x) => [x.accent, x.locale]),
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
  const L = langsOf(v)
  // A voice's own language decides which regional accents it can carry. The
  // locale on a verification row says which language it was verified in, not
  // where the speaker is from — read as an accent it filed British and Indian
  // voices as Khaleeji. Same gate as lib/airraw/voice-discovery.ts.
  const native = String(v.labels?.language || v.language || "").toLowerCase()
  for (const s of SPECS) {
    if (!L.has(s.lang)) continue
    if (native && native !== s.lang) continue
    const h = hay(v, s.lang)
    if (s.locales.some((l) => h.includes(l))) return s.key
    if (s.terms.some((t) => hasWord(h, t))) return s.key
  }
  return null
}

const genderOf = (v) => {
  const g = String(v.gender || v.labels?.gender || "").toLowerCase()
  return g.startsWith("m") ? "MALE" : g.startsWith("f") ? "FEMALE" : null
}

async function get(url) {
  const r = await fetch(url, { headers: { "xi-api-key": KEY } })
  if (r.status === 401) {
    // The single most likely failure, and a stack trace is a terrible way to
    // say "your key is wrong".
    console.error(`\nElevenLabs rejected the key (401).

Either it's stale or it belongs to a different account. Re-pull it:

  vercel env pull .env.local

If that key is also rejected, rotate it in the ElevenLabs dashboard
(Profile → API Keys) and update ELEVENLABS_API_KEY on Vercel.`)
    process.exit(1)
  }
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`)
  return r.json()
}

// ── what the account already has ────────────────────────────────────────────
const mine = await get("https://api.elevenlabs.io/v1/voices")
const owned = new Set(mine.voices.map((v) => v.voice_id))
console.log(`account voices: ${mine.voices.length}`)

let slotsLeft = Infinity
try {
  const sub = await get("https://api.elevenlabs.io/v1/user/subscription")
  const limit = sub.voice_limit ?? sub.voice_slots ?? null
  const used = sub.voice_slots_used ?? mine.voices.length
  if (limit != null) { slotsLeft = Math.max(0, limit - used); console.log(`plan: ${sub.tier || "?"} — ${used}/${limit} voice slots used`) }
} catch { console.log("(couldn't read the plan's voice-slot limit; will still respect --max)") }

const found = {}   // "ACCENT|GENDER" -> [{id,name}]
const note = (a, g, v) => { (found[`${a}|${g}`] ||= []).push({ id: v.voice_id, name: v.name }) }
const native = {}
for (const v of mine.voices) {
  const nat = String(v.labels?.language || "").toLowerCase()
  if (nat) (native[nat] ||= []).push(v.name)
  const key = accentOf(v)
  if (!key) continue
  for (const g of genderOf(v) ? [genderOf(v)] : ["MALE", "FEMALE"]) note(key, g, v)
}
console.log("native-language voices on the account:",
  Object.entries(native).map(([k, v]) => `${k}=${v.length}`).join(" ") || "(none)")

console.log("\n=== ON YOUR ACCOUNT — usable right now, no setup ===")
const mineKeys = Object.keys(found).sort()
if (!mineKeys.length) console.log("  (none — every account voice is American/British/Australian)")
for (const k of mineKeys) {
  const [a, g] = k.split("|")
  console.log(`ELEVENLABS_VOICES_${a}_${g}=${found[k].map((x) => x.id).join(",")}`)
  console.log(`  # ${LABEL[a]}: ${found[k].map((x) => x.name).join(", ")}`)
}
console.log("\n(The server discovers these itself at runtime — the env lines are only")
console.log(" needed if you want to pin an exact set.)")

// ── the shared library, paged ───────────────────────────────────────────────
const library = {}   // "ACCENT|GENDER" -> [voice]
const byId = new Map()
if (WANT_LIBRARY) {
  console.log(`\nsearching the shared library across ${LANGS.length} language(s)…`)
  for (const lang of LANGS) {
    for (const gender of ["male", "female"]) {
      // Page until a short page comes back. One page of 100 covered a fraction
      // of what is there, which is why rarer accents looked like they had no
      // voices at all.
      for (let page = 0; page < 10; page++) {
        let res
        try {
          res = await get(`https://api.elevenlabs.io/v1/shared-voices?page_size=100&page=${page}&language=${lang}&gender=${gender}`)
        } catch (e) { console.error(`  library ${lang}/${gender} p${page}: ${e.message}`); break }
        const list = res.voices || []
        for (const v of list) {
          byId.set(v.voice_id, v)
          const key = accentOf({ ...v, labels: { ...(v.labels || {}), language: v.language || lang } })
          if (!key) continue
          ;(library[`${key}|${gender.toUpperCase()}`] ||= []).push(v)
        }
        if (list.length < 100 || res.has_more === false) break
      }
    }
  }
  // Most-cloned first: a rough but honest quality signal, and far better than
  // whatever order the API happens to return.
  const rank = (v) => (v.cloned_by_count || 0) * 1000 + (v.usage_character_count_1y || 0) / 1e6
  for (const k of Object.keys(library)) library[k].sort((a, b) => rank(b) - rank(a))

  console.log("\n=== IN THE SHARED LIBRARY ===")
  const libKeys = Object.keys(library).sort()
  if (!libKeys.length) console.log("  (no matches)")
  for (const k of libKeys) {
    const [a, g] = k.split("|")
    console.log(`\n${LABEL[a]} ${g.toLowerCase()} — ${library[k].length} available:`)
    for (const v of library[k].slice(0, 5)) console.log(`  ${v.voice_id}  ${v.name}${v.cloned_by_count ? `  (${v.cloned_by_count} clones)` : ""}`)
  }
}

// ── the plan: fill every accent the account is missing ───────────────────────
async function add(v) {
  const owner = v.public_owner_id || v.public_user_id
  if (!owner) return `no owner id — add ${v.name} in the UI`
  const r = await fetch(`https://api.elevenlabs.io/v1/voices/add/${owner}/${v.voice_id}`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ new_name: String(v.name || v.voice_id).slice(0, 60) }),
  })
  return r.ok ? null : `${r.status} ${(await r.text()).slice(0, 120)}`
}

if (FILL) {
  const plan = []
  for (const s of SPECS) {
    for (const g of ["MALE", "FEMALE"]) {
      const k = `${s.key}|${g}`
      const already = (found[k] || []).length
      if (already >= PER) continue
      for (const v of (library[k] || [])) {
        if (plan.length >= MAX_ADD || plan.length >= slotsLeft) break
        if (owned.has(v.voice_id) || plan.some((p) => p.v.voice_id === v.voice_id)) continue
        plan.push({ key: s.key, g, v })
        if ((already + plan.filter((p) => p.key === s.key && p.g === g).length) >= PER) break
      }
    }
  }
  const short = SPECS.flatMap((s) => ["MALE", "FEMALE"].map((g) => [s, g]))
    .filter(([s, g]) => (found[`${s.key}|${g}`] || []).length + plan.filter((p) => p.key === s.key && p.g === g).length < PER)
    .map(([s, g]) => `${s.label} ${g.toLowerCase()}`)

  console.log(`\n=== PLAN — ${plan.length} voice(s) to add (${PER} per accent+gender, cap ${MAX_ADD}${slotsLeft < Infinity ? `, ${slotsLeft} slots free` : ""}) ===`)
  for (const p of plan) console.log(`  ${LABEL[p.key].padEnd(14)} ${p.g.toLowerCase().padEnd(6)} ${p.v.voice_id}  ${p.v.name}`)
  if (short.length) console.log(`\nstill short after this (the library has nothing matching): ${short.join(", ")}`)

  if (!APPLY) {
    console.log("\nNothing was changed. Re-run with --yes to add them:")
    console.log("  node scripts/find-accent-voices.mjs --fill --yes")
  } else {
    console.log("\nadding…")
    let ok = 0
    for (const p of plan) {
      const err = await add(p.v)
      if (err) console.log(`  FAILED ${p.v.name}: ${err}`)
      else { ok++; console.log(`  added ${LABEL[p.key]} ${p.g.toLowerCase()}: ${p.v.name}`) }
    }
    console.log(`\n${ok}/${plan.length} added. The server re-scans on its next cold start (or within 6h).`)
  }
}

// ── --add: copy named library voices onto the account ───────────────────────
if (ADD_IDS.length) {
  console.log(`\n=== ADDING ${ADD_IDS.length} named voice(s) ===`)
  for (const id of ADD_IDS) {
    if (owned.has(id)) { console.log(`  already on the account: ${id}`); continue }
    const v = byId.get(id)
    if (!v) { console.log(`  NOT FOUND in the library: ${id}`); continue }
    const err = await add(v)
    console.log(err ? `  FAILED ${v.name}: ${err}` : `  added: ${v.name}`)
  }
}

if (!WANT_LIBRARY) {
  console.log("\nRun with --fill to see what the library could add for every accent —")
  console.log("that's where the real Egyptian / Moroccan / Levantine / Khaleeji voices are.")
}
