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
const arch = roster.slice(roster.indexOf("const ARCH: Arch[] = ["))
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
const fd = readFileSync("components/airroom/FrontDoor.tsx", "utf8")
const walk = [...fd.slice(fd.indexOf("const F_WALK")).slice(0, 500).matchAll(/0\.\d+/g)].map((m) => Number(m[0]))
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

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
