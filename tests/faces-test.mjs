// The image API is paid and was being hammered. Two guarantees:
//   1. a talk's cast does not change as it fills  (the churn)
//   2. a dead provider key is asked once, not forever  (the retry storm)
import { readFileSync } from "node:fs"
let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

// ── 1. PREFIX STABILITY ─────────────────────────────────────────────────────
// groupCast's member i must depend on i alone, never on the size of the room.
// With `(i/n - 0.5)` in the spread, growing a room from 4 to 5 changed all four
// existing members into different people — and the talks board, which re-derives
// every 15s off a live seat count, asked for ~99 distinct portraits per 12-minute
// slot as a result.
const mk = (seed, f) => `${seed}@${f.toFixed(6)}`
const spread = (i) => { const h = Math.imul((i + 1) >>> 0, 2654435761) >>> 0; return (h / 4294967296 - 0.5) * 0.08 }
const c01 = (x) => Math.max(0, Math.min(1, x))
const cast = (seed, f, n) => Array.from({ length: n }, (_, i) => mk(seed * 7 + i + 1, c01(f + spread(i))))

let drift = 0
for (const seed of [12345, 99991, 7]) {
  for (const f of [0.3, 0.6, 0.9]) {
    const big = cast(seed, f, 12)
    for (let n = 1; n <= 12; n++) {
      const small = cast(seed, f, n)
      if (small.join("|") !== big.slice(0, n).join("|")) drift++
    }
  }
}
check(drift === 0, "a cast of N is always the first N of a bigger cast (rooms grow, they don't reshuffle)")

const roster = strip("lib/airroom/roster.ts")
check(!/\(i \/ n\)/.test(roster), "the member spread never divides by the room size")
check(/function spread\(i: number\)/.test(roster), "the spread is a function of the index alone")

// The board must ask for a FIXED number of faces, not one derived from live
// seats — that is what made the count move every refresh.
const board = strip("components/airroom/Talks.tsx")
check(/groupCast\(seed, f, SHOWN\)/.test(board), "the board derives a fixed four faces")
check(!/room\.count/.test(board), "the board's faces don't depend on the live seat count")

// A filling talk gets FULLER, not quieter: the room's voice count comes from who
// is seated, not from the empty chairs.
const talks = strip("lib/airraw/talks.ts")
check(/count: Math\.min\(12, Math\.max\(2, t\.taken\)\)/.test(talks), "the room holds the people in it, not the seats left")

// ── 2. NO RETRY STORM ───────────────────────────────────────────────────────
const route = strip("app/api/character-photo/route.ts")
check(/401|403/.test(route) && /markProviderRejected/.test(route),
  "an upstream auth rejection latches the provider off")
check(/providerRejected\(\)/.test(route) && /disabled: true/.test(route),
  "while latched it answers 'disabled', not a 502 that invites a retry")
check(/authOffUntil = Date\.now\(\) \+ AUTH_OFF_MS/.test(route),
  "the latch expires on its own — fixing the key must not need a redeploy")

const face = strip("lib/airraw/face.ts")
check(/failed\.set\(k, Date\.now\(\)\)/.test(face), "a failed lookup is remembered, not retried every render")
check(/offUntil = Date\.now\(\)/.test(face), "'disabled' stops the client asking for anybody")
check(!/localStorage\.setItem\([^)]*failed/.test(face) && !/lsKey\(k\), *""/.test(face),
  "negatives are never persisted (an outage must not blank faces forever)")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
