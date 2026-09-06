// PROFILE = CHARACTER, AND NO ONE REPEATS.
//
// A profile card IS a person: same face, same voice, same dossier, every time.
// So the same person must never appear twice in one room, and this hour's room
// must not be next hour's room with a new coat of paint. Both were true only by
// accident before — the name permutation happened to spread consecutive seeds —
// and the hourly seed was one apart, which with groupCast's seed*7+i+1 layout
// meant SEVEN of fourteen people came back the next hour.
import { readFileSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const roster = readFileSync("lib/airroom/roster.ts", "utf8")
const room = readFileSync("components/airroom/TheRoom.tsx", "utf8")
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

// Mirror the real name selection from roster.ts, and assert it IS the real one.
const STRIDE = Number((roster.match(/const NAME_STRIDE = (\d+)/) || [])[1])
check(/return \(\(\(seed >>> 0\) % len\) \* NAME_STRIDE\) % len/.test(roster), "nameIndex is the permutation this test mirrors")
check(/makeCharacter\(seed \* 7 \+ i \+ 1/.test(roster), "groupCast seeds member i as seed*7+i+1, as this test assumes")
const count = (k) => { const i = roster.indexOf(`const ${k}`); return (roster.slice(i, roster.indexOf("\n]", i)).match(/"/g) || []).length / 2 }
const LEN = Math.min(count("NAMES_F"), count("NAMES_M"))
const nameIndex = (seed) => (((seed >>> 0) % LEN) * STRIDE) % LEN
const CAST = Number((room.match(/const CAST = (\d+)/) || [])[1])
const memberSeeds = (roomSeed) => Array.from({ length: CAST }, (_, i) => roomSeed * 7 + i + 1)

// ── within one room, no two people share a name index ─────────────────────
let dupWithin = 0
for (let h = 0; h < 5000; h++) {
  const idx = memberSeeds(h * 3).map(nameIndex)
  if (new Set(idx).size !== idx.length) dupWithin++
}
check(dupWithin === 0, `no room in 5000 hours seats the same name twice (${dupWithin} did)`)

// ── and it is ENFORCED in the room, not just true of the maths ─────────────
const src = strip(room)
check(/seenFace\.has\(fk\) \|\| seenName\.has\(c\.host\)/.test(src), "the room dedupes by face key AND name before seating anyone")
check(/groupCast\(seed, 0\.5, CAST \+ 6\)/.test(src), "drawing a few extra so a dropped duplicate still leaves a full room")

// ── consecutive hours share nobody ─────────────────────────────────────────
check(/Math\.floor\(Date\.now\(\) \/ 3_600_000\) \* 3/.test(src), "the room seed is spaced by 3 (21 member-seeds apart, past the 14 drawn)")
let overlapHours = 0
for (let h = 0; h < 5000; h++) {
  const a = new Set(memberSeeds(h * 3)), b = memberSeeds((h + 1) * 3)
  if (b.some((s) => a.has(s))) overlapHours++
}
check(overlapHours === 0, `no two consecutive hours share a member seed (${overlapHours} did)`)
// Prove the OLD spacing really was the bug, so nobody "simplifies" it back.
let oldOverlap = 0
for (let h = 0; h < 100; h++) { const a = new Set(memberSeeds(h)); if (memberSeeds(h + 1).some((s) => a.has(s))) oldOverlap++ }
check(oldOverlap === 100, "with unspaced hourly seeds every hour repeated people — the spacing is load-bearing")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
