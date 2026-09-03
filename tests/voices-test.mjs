// The accent table, the character pools, and the one thing that used to drift.
import { readFileSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

// ── ONE accent table ────────────────────────────────────────────────────────
// The server sorts account voices into accent pools; the script finds voices to
// add. They kept private copies with a comment asking whoever edited one to
// remember the other, and they drifted — the script hunted 10 accents while the
// server could use 22, so twelve accents could never get a voice.
const specs = JSON.parse(readFileSync("lib/airraw/accent-specs.json", "utf8"))
const server = strip("lib/airraw/voice-discovery.ts")
const script = strip("scripts/find-accent-voices.mjs")

check(specs.length >= 20, `${specs.length} accents defined`)
check(/accent-specs\.json/.test(server) && /accent-specs\.json/.test(script),
  "server and script read the SAME accent table")
check(!/const ACCENTS = \[\s*\[/.test(script), "the script keeps no private copy of the table")

// Every accent the personas can actually BE must be findable by the script,
// or that accent is unreachable however many voices are on the account.
const accentSrc = strip("lib/airraw/accent.ts")
const used = new Set([...accentSrc.matchAll(/key: "([A-Z_]+)"/g)].map((m) => m[1]).filter((k) => k !== "NEUTRAL"))
for (const m of accentSrc.matchAll(/voiceOnly\("([A-Z_]+)"/g)) used.add(m[1])
const known = new Set(specs.map((s) => s.key))
const orphans = [...used].filter((k) => !known.has(k))
check(orphans.length === 0, `every accent a character can have is searchable (${orphans.join(", ") || "no orphans"})`)

// Word boundaries, not substrings. "omani" must not fire on "Romanian" — that
// is how British voices were cast as Gulf Arabs.
check(/\\\\b/.test(server) && /\\\\b/.test(script), "both sides match on word boundaries")

// Adding voices costs account slots and is tedious to undo, so the script must
// not do it without being told twice.
check(/--yes/.test(script) && /Nothing was changed/.test(script),
  "the fill mode is a dry run until --yes")

// ── the shop window ─────────────────────────────────────────────────────────
// The front door shows a VIBE and a LINE. Those two pools are the entire
// perceived variety of the product, no matter how large the identity space
// behind them is — with five lines each a visitor had seen every hook in the
// building after fifty swipes.
const roster = readFileSync("lib/airroom/roster.ts", "utf8")
const archStart = roster.indexOf("const ARCH: Arch[] = [")
// Bounded to the array itself: VIBES is derived from ARCH just below it and its
// object literal also opens with `{ key: `, which parsed as an 11th archetype
// with zero opening lines.
const arch = roster.slice(archStart, roster.indexOf("\n]", archStart))
const blocks = arch.split(/\{ key: /).slice(1)
const counts = blocks.map((b) => {
  const lines = (b.match(/lines: \[([\s\S]*?)\n    \]/) || [, ""])[1]
  return (lines.match(/\n      "/g) || []).length
})
const total = counts.reduce((a, b) => a + b, 0)
check(blocks.length >= 10, `${blocks.length} archetypes`)
check(Math.min(...counts) >= 12, `every archetype has at least 12 opening lines (thinnest: ${Math.min(...counts)})`)
check(total >= 150, `${total} distinct opening lines across the floor`)


// EVERY archetype must be reachable by swiping. The front door walks a fixed
// list of temperatures (F_WALK) and the roster takes the FIRST band containing
// one — so a value can be swallowed by an earlier band and a whole tier of the
// product becomes invisible. That is exactly what happened: 0.95 fell inside
// BDSM [0.82, 0.96], so "no limits · raw" [0.92, 1.00] was never shown to
// anyone. Nothing errored, no test failed, it just wasn't there.
const bands = blocks.map((b) => ({
  key: b.match(/"([A-Za-z]+)"/)[1],
  band: b.match(/band: \[([\d.]+), ([\d.]+)\]/).slice(1, 3).map(Number),
}))
// The walk used to be a hardcoded F_WALK list in FrontDoor. It now comes from
// the visitor's taste (lib/airraw/taste.ts), whose temperatures are derived from
// these same bands — which is what makes the swallowed-value bug structurally
// impossible rather than merely fixed. Derived here the way roster.ts does it.
const fd = readFileSync("components/airroom/FrontDoor.tsx", "utf8")
check(!/const F_WALK/.test(fd), "the front door no longer carries a hand-written gradient walk")
check(/walkFor\(/.test(fd), "it walks whatever the visitor asked to see")
const walk = bands.map((a, i) => {
  const prev = bands[i - 1], next = bands[i + 1]
  const lo = Math.max(a.band[0], prev ? prev.band[1] + 0.005 : 0)
  const hi = next ? Math.min(a.band[1], next.band[0] - 0.005) : a.band[1]
  return Number(((lo + hi) / 2).toFixed(3))
})
const archFor = (f) => (bands.find((a) => f >= a.band[0] && f <= a.band[1]) || {}).key
const reached = new Set(walk.map(archFor))
const missed = bands.map((a) => a.key).filter((k) => !reached.has(k))
check(walk.length >= 10, `the gradient walk has ${walk.length} steps`)
check(missed.length === 0, `every archetype is reachable by swiping (${missed.join(", ") || "none missed"})`)
check(walk.every((f) => archFor(f)), "no walk step falls outside every band")

// Consecutive cards should be different KINDS of person — that is the entire
// reason the walk jumps around instead of climbing.
const adjacent = walk.filter((f, i) => i > 0 && archFor(f) === archFor(walk[i - 1])).length
check(adjacent === 0, "no two consecutive cards come from the same archetype")


// ── discovery has to actually RUN ───────────────────────────────────────────
// The pools are filled by a background refresh that was never awaited, so the
// first call on an instance cast from empty pools. On serverless with modest
// traffic most instances serve a few requests and die, which made "the first
// call" most calls — regional casting almost never happened while the right
// voices sat on the account unused.
const disc = strip("lib/airraw/voice-discovery.ts")
const tts = strip("app/api/tts/route.ts")
check(/export async function ensureAccentPools/.test(disc), "there is a way to wait for the pools")
check(/everLoaded/.test(disc), "it blocks only until the first SUCCESSFUL load, not on a backed-off failure")
check(/FIRST_WAIT_MS/.test(disc) && /Promise\.race/.test(disc), "the wait is capped — a slow voice list can't cost a call")
check(/if \(seedKey\) await ensureAccentPools/.test(tts), "AIRRAW waits once per cold instance")
check(/else warmAccentPools\(elKey\)/.test(tts), "Kloom's path is unchanged — it never reads these pools")

// The native-language gate, which is what stopped British voices being Gulf Arabs.
check(/native && native !== spec\.lang/.test(disc), "a voice's own language gates which accents it can carry")
check(/function haystackFor\(v: ElevenVoice, lang: string\)/.test(disc),
  "an accent claim is only evidence about the language it was made in")


// The env inspector must never be able to delete anything itself — it reads a
// pulled env file and PRINTS commands. A script that removes production config
// on its own is not something to run while debugging.
const envcheck = strip("scripts/check-voice-env.mjs")
check(!/execFile|execSync|spawn|child_process/.test(envcheck), "the env inspector cannot run commands")
check(/readFileSync\("app\/api\/tts\/route\.ts"/.test(envcheck),
  "it reads the English pool from the shipped route, so it can't drift")

// ── THE SHARED LIBRARY ──────────────────────────────────────────────────────
// The account holds ~125 voices; the library holds thousands. This module read
// only the account because it was written believing the library could only be
// used by COPYING voices onto it — capped, and tedious to undo. Reading is
// neither, and a library voice_id can be synthesised directly.
check(/shared-voices/.test(disc), "the library is a second source of voices")
check(/page_size=/.test(disc), "and it is paged rather than crawled")

// ONE classifier, both shapes. /v1/voices nests accent/gender/language under
// `labels`; /v1/shared-voices puts them at the top level. Two classifiers would
// drift, and drift in this file is what put British voices in the Gulf pool.
check(/v\.labels\?\.accent \|\| "", v\.accent/.test(disc), "the haystack reads an accent from either shape")
check(/v\.labels\?\.gender \|\| v\.gender/.test(disc), "gender likewise")
check(/v\.labels\?\.language \|\| v\.language/.test(disc), "and the native-language gate likewise")
check((disc.match(/function accentOf/g) || []).length === 1, "there is exactly one accent classifier")

// The native-language gate must still apply to library voices — the library is
// FULL of English voices verified for Arabic, so dropping the gate here would
// reintroduce the original complaint at ten times the scale.
const accentFn = disc.slice(disc.indexOf("function accentOf"), disc.indexOf("function sortInto"))
check(/native && native !== spec\.lang/.test(accentFn), "a library voice can't be cast as an accent it isn't native to")

// ── account first, library second ───────────────────────────────────────────
// Serverless instances are short-lived and the first call after a cold start is
// a large share of ALL calls. One request for the account publishes immediately;
// thirty for the library must never delay that.
const refreshFn = disc.slice(disc.indexOf("async function refresh("), disc.indexOf("const summarise"))
check(refreshFn.indexOf("everLoaded = true") < refreshFn.indexOf("fetchLibrary"),
  "the account pools publish BEFORE the library is fetched")
check(refreshFn.indexOf("publishAccountOnly()") < refreshFn.indexOf("fetchLibrary"),
  "so an instance that dies mid-refresh still casts from the account")
check(/const merged/.test(refreshFn) && /\[\.\.\.v\]/.test(refreshFn),
  "the merge builds on copies, so a mid-way failure can't leave pools half-merged")
// Phase one already published working pools. An exception in phase two must not
// mark the whole refresh failed — that rolls the TTL back and makes every
// instance redo all thirty requests in five minutes, punishing the account
// voices for the library's bad day.
check(/catch \(e\)[\s\S]{0,160}account pools stand/.test(refreshFn),
  "a library failure cannot fail the refresh that already succeeded")
check(/seen\.has\(v\.voice_id\)/.test(disc),
  "a voice present in both sources is counted once, not weighted twice")

// ── the breaker ─────────────────────────────────────────────────────────────
// Direct use of library ids is documented, not guaranteed. Being wrong means a
// rejected id returns NO AUDIO — the character is silent, not mis-cast — so one
// refusal has to be enough.
check(/export function noteLibraryVoiceRejected/.test(disc), "a refused library voice disables the library")
check(/export function isLibraryVoice/.test(disc), "and the route can tell which voices those are")
// Bounded to the function itself — slicing to end-of-file swept in the backoff
// arithmetic and setTimeout from warmAccentPools/ensureAccentPools below.
const breakerStart = disc.indexOf("export function noteLibraryVoiceRejected")
const breaker = disc.slice(breakerStart, disc.indexOf("\n}", breakerStart))
check(/!fromLibrary\.has\(id\)\) return/.test(breaker),
  "an ACCOUNT voice failing can never disable the library")
check(/publishAccountOnly\(\)/.test(breaker), "tripping it rebuilds the pools from the account immediately")
check(!/setTimeout|TTL|Date\.now\(\) \+/.test(breaker),
  "and it does not expire — an id the API rejects won't start working later")
check(/ELEVENLABS_LIBRARY !== "0"/.test(disc), "the library can be switched off entirely without a deploy")

// A swallowed failure must still be VISIBLE. The first live run produced
// it|FEMALE=1 beside it|MALE=100, and there was no way to tell a broken request
// from an empty shelf — swallowing kept the other 29 pages, which is right, but
// silence made the result unreadable.
check(/failed\.push\(/.test(disc), "a failed library page is recorded, not just skipped")
check(/library pages failed/.test(disc), "and reported with which language and gender")

// ── Arabic depth ────────────────────────────────────────────────────────────
// The first live run gave ar 105 male / 69 female, but Tunisian 1 male / 2
// female and Moroccan 3 female — a dialect pool that small casts the same voice
// for nearly every character in it.
check(/const LIB_PAGES/.test(disc) && /ar: 3/.test(disc), "Arabic is paged deeper than a language that only fills a native pool")
check(/ACCENT_TARGETED/.test(disc), "and its dialects are searched for BY NAME, not just hoped for in a general page")
check(/accent=\$\{encodeURIComponent\(accent\)\}/.test(disc), "using the accent filter the endpoint supports")
check(/spec\.terms\[0\]/.test(disc),
  "with the name taken from accent-specs, so a dialect can't be searched under one name and filed under another")

// PAGING IS ZERO-INDEXED. find-accent-voices.mjs pages from 0 against the real
// API; starting at 1 would skip the first hundred voices of every language and
// make the pools SMALLER while looking like it deepened them.
const pageLoop = (disc.match(/for \(let p = (\d+); p ([<=]+) pagesFor/) || [])
check(pageLoop[1] === "0" && pageLoop[2] === "<", `library paging starts at page 0 (found "p = ${pageLoop[1]}; p ${pageLoop[2]}")`)
check(/for \(let page = 0;/.test(script), "which is what the script that was run against the real API does")

// An accent query that matches nothing looks exactly like a dialect the library
// doesn't carry. The yield is logged so the next change is driven by numbers.
check(/accent queries:/.test(disc), "what each accent query returned is logged")

// The person waiting must still hear something.
check(/noteLibraryVoiceRejected\(voice\)/.test(tts), "the TTS route trips the breaker")
check(/isLibraryVoice\(voice\)/.test(tts), "only for a library voice")
check(/!retried &&/.test(tts), "the retry cannot loop")
check(/fallback !== voice/.test(tts), "and it only retries with a DIFFERENT voice")
check(/res\.status === 400 \|\| res\.status === 404/.test(tts),
  "a rate limit or a 5xx is not treated as 'this voice is unusable'")

// ── the language list cannot drift from the app's ───────────────────────────
// The comment in voice-discovery.ts promises this test exists, so it has to.
const libLangs = (disc.match(/const LIB_LANGS = \[([^\]]*)\]/) || [, ""])[1]
  .split(",").map((x) => x.trim().replace(/"/g, "")).filter(Boolean)
const appLangs = [...readFileSync("lib/languages.ts", "utf8").matchAll(/iso:\s*"([a-z-]+)"/g)].map((m) => m[1])
const missing = appLangs.filter((l) => !libLangs.includes(l))
check(missing.length === 0,
  `every language the product speaks is paged for (${libLangs.length} langs${missing.length ? `, missing ${missing.join(",")}` : ""})`)
check(libLangs.every((l) => appLangs.includes(l)),
  "and no language is paged for that the product doesn't speak")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
