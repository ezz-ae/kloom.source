// HOW MANY PEOPLE ARE THERE, REALLY?
//
// The product's whole draw is that the floor is full of different people, so the
// size of the cast is a feature, not an implementation detail. It had a ceiling
// nobody had written down: faces were generated from the NAME alone, so the
// entire product could only ever contain 298 people — one per name in the two
// pools — and every character called Mara shared one face across every
// archetype, forever.
//
// That directly contradicted makeCharacter's own comment ("two characters may
// both be called Mara and still be two entirely different people, with different
// faces"). The comment was right; the code wasn't.
import { readFileSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const roster = readFileSync("lib/airroom/roster.ts", "utf8")
const count = (k) => {
  const i = roster.indexOf(`const ${k}`)
  return (roster.slice(i, roster.indexOf("\n]", i)).match(/"/g) || []).length / 2
}
const F = count("NAMES_F"), M = count("NAMES_M")
const archStart = roster.indexOf("const ARCH: Arch[] = [")
const blocks = roster.slice(archStart, roster.indexOf("\n]", archStart)).split(/\{ key: /).slice(1)

check(F >= 100 && M >= 100, `${F} female and ${M} male names`)
check(blocks.length >= 10, `${blocks.length} archetypes`)

// ── the ceiling ─────────────────────────────────────────────────────────────
const nameOnly = F + M
const withArchetype = (F + M) * blocks.length
check(withArchetype >= 2500,
  `the cast is archetype x name = ${withArchetype} people, not ${nameOnly}`)

// ── every face-bearing surface asks for the same key ────────────────────────
// One helper, used everywhere: a screen that forgets it silently falls back to
// name-keying and re-imposes the old ceiling on that surface alone, which is the
// kind of regression nobody notices until the floor feels small again.
check(/export function faceSeedFor/.test(roster), "there is one helper for the face key")
const helper = roster.slice(roster.indexOf("export function faceSeedFor"))
check(/\$\{c\.archetype \|\| "x"\}:\$\{c\.host\}/.test(helper), "keyed on archetype AND name")
check(/if \(!c\?\.host\) return undefined/.test(helper),
  "and a character with no name gets no face rather than a generated blank")

import { readdirSync } from "node:fs"
const comps = readdirSync("components/airroom").filter((f) => f.endsWith(".tsx"))
const offenders = []
for (const f of comps) {
  const src = strip(`components/airroom/${f}`)
  for (const m of src.matchAll(/persona=\{\{([^}]*)\}\}/g)) {
    if (!/seed:/.test(m[1])) offenders.push(`${f}: ${m[1].trim().slice(0, 48)}`)
  }
}
check(offenders.length === 0,
  `every face asks for a seed${offenders.length ? ` — missing in ${offenders.join(" | ")}` : ""}`)

// ── the client must drop faces cached under the old key ─────────────────────
const face = readFileSync("lib/airraw/face.ts", "utf8")
const ver = (face.match(/FACE_CACHE_VERSION = "(v\d+)"/) || [])[1]
check(ver && Number(ver.slice(1)) >= 6,
  `the face cache version was bumped for the new key (${ver})`)
check(/p\.seed \|\| p\.name/.test(face), "seed wins over name when both are present")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
