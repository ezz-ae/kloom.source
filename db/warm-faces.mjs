// Generate the floor's faces INTO STORAGE, before the code that points at them
// goes live.
//
// WHY THIS EXISTS
// A face's storage path contains PROMPT_FINGERPRINT, a hash of the assembled
// prompt. So the moment the prompt is edited, every one of the ~600 cached faces
// becomes a cache miss and has to be redrawn on demand, by whichever image
// provider is up, while real people are looking at the screen.
//
// That is not a theory. Shipping an art-direction change did exactly this: the
// fingerprint moved, every face missed, Together answered 402 (no credit) and
// fal answered 403, the failure latched, and airraw.com served
// {"error":"image generation disabled"} for its entire floor — blank monograms,
// with ads running. It was reverted, and this file is the thing that should have
// existed first.
//
// THE ORDER THAT IS SAFE
//   1. Push the prompt change to a branch. Vercel builds a PREVIEW deployment.
//      Preview shares the same Supabase storage bucket as production.
//   2. Point this at the preview URL. Every face it generates is uploaded under
//      the NEW fingerprint, next to the old ones. Production is untouched and
//      still serving the old faces the whole time.
//   3. When it reports full coverage, promote the branch. Every face is already
//      a cache hit on the first request. Nothing is ever generated with someone
//      watching, and the old files stay where they are, so reverting is instant.
//
// It is resumable and idempotent: a face that already exists comes back
// `cached` in milliseconds and costs nothing, so re-running after a failure
// picks up where it stopped.
//
// USAGE
//   node --import ./tests/alias.mjs db/warm-faces.mjs --base https://<preview>.vercel.app
// //   ... --hours 48           warm two days of rooms ahead instead of one
//   ... --limit 20           a trial run before committing to the whole set
//   ... --concurrency 3       default 2; the route is not the place to be clever
//   ... --dry-run             report coverage, generate nothing
//
// It refuses to point at production by default, because warming production is
// the one thing this exists to avoid.
import { ROSTER, groupCast, faceSeedFor, roomSeed, CAST_CYCLE_HOURS } from "@/lib/airroom/roster"
import { writtenCast, CAST_COUNT, CAST_LANGS } from "@/lib/airraw/cast50"
import { isArabSeed, nativeLanguageFor } from "@/lib/airraw/lang-prefs"

const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d }

const BASE = (val("--base") || "").replace(/\/$/, "")
const LIMIT = Math.max(1, Number(val("--limit", 100000)))
// How far ahead of the clock to warm. 24 buys a day of rooms.
const HOURS = Math.max(1, Math.min(168, Number(val("--hours", 24))))
// TheRoom draws 14 (components/airroom/TheRoom.tsx). Kept here rather than
// imported because it is a component-local const, and a drift is caught by
// tests/warm-test.mjs rather than by a blank floor.
const CAST_PER_ROOM = 14
const CONC = Math.max(1, Math.min(6, Number(val("--concurrency", 2))))
const DRY = has("--dry-run")
// A provider that is out of credit fails every request the same way. Without a
// brake, this would make six hundred doomed calls and take twenty minutes to
// tell you the thing it knew after four.
const GIVE_UP_AFTER = Number(val("--give-up-after", 8))

if (!BASE) {
  console.error("--base is required: the deployment to generate through.\n")
  console.error("  node --import ./tests/alias.mjs db/warm-faces.mjs --base https://<preview>.vercel.app\n")
  console.error("Use a PREVIEW url carrying the new prompt. Production is already warm for the")
  console.error("prompt it is running, and warming it is what this file exists to avoid.")
  process.exit(1)
}
if (/airraw\.com|\/\/airroom\.vercel\.app/.test(BASE) && !has("--yes-production")) {
  console.error(`${BASE} looks like production.`)
  console.error("Warming production generates faces with people watching — the exact failure")
  console.error("this exists to prevent. Use a preview URL, or pass --yes-production if you")
  console.error("really mean it (e.g. re-warming after a provider outage).")
  process.exit(1)
}

/**
 * WHICH FACES, AND WHY IT IS NOT "ALL OF THEM".
 *
 * The room draws a new cast every hour — TheRoom seeds it with roomSeed(),
 * which loops over CAST_CYCLE_HOURS slots (roster.ts) — so the set of faces the
 * product will ever ask for is FINITE: one cycle of casts, warmed once, and the
 * floor never draws live again. It used to be the absolute hour, unbounded, and
 * this file could only stay a day ahead of the clock.
 *
 * So three populations, in the order they matter:
 *   1. the written cast, who are on every floor at every hour
 *   2. the roster's cluster hosts, the faces on the deck
 *   3. the room cast for each of the next --hours hours
 *
 * The first two are fixed and small. The third is the ongoing cost, and it is
 * roughly 14 faces an hour — which is also the honest answer to "what does this
 * cost to run": about 340 faces a day if every hour is visited.
 */
const HOUR = 3_600_000
function cast() {
  const seen = new Set()
  const out = []
  const add = (name, gender, seed, why) => {
    if (!name || !seed || seen.has(seed)) return
    seen.add(seed)
    out.push({ name, gender, seed, why })
  }

  // The written fifty go through clusterFor, which sets host from names[lang] —
  // so an Arabic visitor asks for a DIFFERENT face seed than an English one, and
  // warming only English leaves the Arabic floor blank. Every language the cast
  // is written in, therefore.
  for (const lang of CAST_LANGS) {
    for (const c of writtenCast(0, CAST_COUNT, lang)) add(c.host, c.gender, faceSeedFor(c), `written:${lang}`)
  }
  for (const c of ROSTER) add(c.host, c.gender, faceSeedFor(c), "deck")

  // The hours ahead. Warming the CURRENT hour too, because a face missing right
  // now is the one someone is looking at.
  // The room's hour loops over CAST_CYCLE_HOURS slots (roster.ts), so past one
  // full cycle every further hour is a seed already in `seen` — and a run with
  // the default --hours covers the floor for good, not for a day.
  const now = Date.now()
  for (let h = 0; h < Math.min(HOURS, CAST_CYCLE_HOURS); h++) {
    const seed = roomSeed(now + h * HOUR)
    // The same wide draw the room makes. It takes the leading CAST of whatever
    // survives the visitor's language filter; warming the leading 2×CAST covers
    // the default visitor and most filtered ones without warming the whole tail.
    // TWO FLOORS COME OUT OF ONE DRAW.
    //
    // A visitor with no Arabic preference sees the leading edge. An Arabic one —
    // now the DEFAULT, so this is the common case — sees only characters who are
    // Arab, and roughly one in seven qualifies, so the room keeps reading down
    // the same list until it has fourteen. Measured across the next 24 hours it
    // reaches 115 deep. Warming the leading 28 left about ninety faces an hour to
    // be drawn live, which is the whole failure this file exists to prevent.
    const wide = groupCast(seed, 0.5, (CAST_PER_ROOM + 6) * 10)
    for (const c of wide.slice(0, CAST_PER_ROOM * 2)) {
      add(c.host, c.gender, faceSeedFor(c), `hour+${h}`)
    }
    let arab = 0
    for (const c of wide) {
      if (arab >= CAST_PER_ROOM) break
      const fk = faceSeedFor(c) || c.host
      if (nativeLanguageFor(fk) !== "Arabic" || !isArabSeed(fk)) continue
      arab++
      add(c.host, c.gender, faceSeedFor(c), `hour+${h}`)
    }
  }
  return LIMIT < out.length ? out.slice(0, LIMIT) : out
}

async function warm(p) {
  const res = await fetch(`${BASE}/api/character-photo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: p.name, gender: p.gender, seed: p.seed, diverse: true }),
    signal: AbortSignal.timeout(180000),
  })
  const d = await res.json().catch(() => ({}))
  if (res.ok && d.url) return { ok: true, cached: !!d.cached, url: d.url, model: d.model }
  return { ok: false, status: res.status, why: d.error || `http ${res.status}`, disabled: !!d.disabled }
}

/**
 * THE PATH THE TARGET WRITES MUST BE THE PATH PRODUCTION WILL READ.
 *
 * A face lives at `{slug}-{seed}-{realismVersion}-{fingerprint}.jpg`. The
 * fingerprint is SUPPOSED to differ — that is the change being warmed. The
 * realism version is not: it comes from REALISM_VERSION, which is an env var, and
 * a preview that does not inherit production's pin builds `r5-...` while
 * production reads `r3-...`. Warm several hundred faces into that and every one
 * still misses the moment it is promoted, which is the exact failure this file
 * exists to prevent — just with a bill attached.
 *
 * Caught for real: production is pinned to r3 and the preview defaulted to r5.
 */
async function pathShape(base) {
  const res = await fetch(`${base}/api/character-photo`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Shape", gender: "female", seed: "warm-shape-probe", diverse: true }),
    signal: AbortSignal.timeout(180000),
  })
  const d = await res.json().catch(() => ({}))
  if (!d.url) return null
  const m = /-(\w+)-(\w+)\.(?:jpg|png)$/.exec(d.url)
  return m ? { realism: m[1], fingerprint: m[2] } : null
}

const PROD = val("--production", "https://airraw.com")
if (!has("--skip-shape-check")) {
  // An unreachable host is an answer, not a crash — this runs before anything
  // else and a stack trace here reads as the tool being broken.
  const [there, prod] = await Promise.all([
    pathShape(BASE).catch(() => null),
    pathShape(PROD).catch(() => null),
  ])
  if (!there || !prod) {
    console.error("Could not read the storage path from one of the deployments — refusing to warm blind.")
    console.error(`  ${BASE} -> ${JSON.stringify(there)}`)
    console.error(`  ${PROD} -> ${JSON.stringify(prod)}`)
    process.exit(1)
  }
  if (there.realism !== prod.realism) {
    console.error(`REALISM VERSION MISMATCH — nothing warmed.\n`)
    console.error(`  target     ${BASE}  writes  ${there.realism}-${there.fingerprint}`)
    console.error(`  production ${PROD}  reads   ${prod.realism}-${prod.fingerprint}\n`)
    console.error(`Every face warmed here would still miss on promote, because the path`)
    console.error(`differs by more than the fingerprint. REALISM_VERSION is an env var:`)
    console.error(`set it to "${prod.realism}" on the target's environment, or clear the pin`)
    console.error(`on production so both use the code default. Then run this again.`)
    process.exit(1)
  }
  if (there.fingerprint === prod.fingerprint) {
    console.log(`NOTE: ${BASE} carries the same prompt as production (${there.fingerprint}).`)
    console.log(`Nothing new to warm — this will just confirm existing coverage.\n`)
  } else {
    console.log(`warming ${there.realism}-${there.fingerprint}  (production reads ${prod.realism}-${prod.fingerprint})\n`)
  }
}

const people = cast()
const byWhy = people.reduce((a, p) => ({ ...a, [p.why.replace(/\+\d+$/, "+N")]: (a[p.why.replace(/\+\d+$/, "+N")] || 0) + 1 }), {})
console.log(`${people.length} faces to account for, through ${BASE}`)
console.log(`  ${Object.entries(byWhy).map(([k, v]) => `${k}: ${v}`).join("  ")}  (${HOURS}h ahead)\n`)
if (DRY) {
  console.log("\n--dry-run: checking what already exists, generating nothing.\n")
}

let done = 0, made = 0, hit = 0, failed = 0, streak = 0, fingerprint = ""
let stop = ""
const queue = people.slice()

async function worker() {
  while (queue.length && !stop) {
    const p = queue.shift()
    // In a dry run only report what is already there — a cached face answers
    // instantly and costs nothing, and anything else is left alone.
    const r = await warm(p).catch((e) => ({ ok: false, why: e.message?.slice(0, 60) || "threw" }))
    done++
    if (r.ok) {
      streak = 0
      if (r.cached) hit++
      else made++
      if (!fingerprint) {
        const m = /-([a-z0-9]{5,8})\.(?:jpg|png)$/.exec(r.url)
        if (m) { fingerprint = m[1]; console.log(`fingerprint on this deployment: ${fingerprint}\n`) }
      }
      if (DRY && !r.cached) console.log(`  would generate  ${p.name} [${p.why}]`)
    } else {
      failed++; streak++
      if (streak <= 3 || streak % 10 === 0) console.log(`  failed  ${p.name} [${p.why}] — ${r.why}`)
      if (streak >= GIVE_UP_AFTER) {
        stop = `${streak} failures in a row — the provider is not answering. ` +
               (r.disabled ? "It reports image generation disabled: the keys are rejected or out of credit." : "")
      }
    }
    if (done % 25 === 0 || done === people.length) {
      console.log(`  ${done}/${people.length}  already there ${hit}  generated ${made}  failed ${failed}`)
    }
  }
}

const started = Date.now()
await Promise.all(Array.from({ length: CONC }, worker))
const mins = ((Date.now() - started) / 60000).toFixed(1)

console.log(`\n${hit} already there, ${made} generated, ${failed} failed, in ${mins} min`)
if (stop) {
  console.log(`\nSTOPPED: ${stop}`)
  console.log("Nothing is broken — the faces that did land are in storage and this is")
  console.log("resumable. Fix the provider, run it again, and it will skip everything")
  console.log("it already did.")
  process.exit(1)
}
const covered = hit + made
if (covered === people.length) {
  console.log(`\nFULL COVERAGE${fingerprint ? ` at ${fingerprint}` : ""}. Every face is in storage.`)
  console.log("This deployment is safe to promote: nothing will be generated with someone watching.")
} else {
  console.log(`\n${people.length - covered} still missing. Re-run to pick them up.`)
  console.log("Do NOT promote until this reports full coverage.")
  process.exit(1)
}
