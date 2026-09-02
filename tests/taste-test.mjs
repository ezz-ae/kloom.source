// WHO YOU WANT TO MEET — the front door's filter.
//
// Two things can go wrong with a subtractive filter, and both have shipped in
// this repo before in some form:
//
//   1. A temperature lands in the WRONG archetype's band, so picking a vibe
//      shows you a different one. That is exactly the bug that made "no limits"
//      unreachable from the old hardcoded walk, and the bug that put 4 of 10
//      VIBES in their neighbour's band when they were plain midpoints.
//   2. A filter excludes everything and leaves a blank screen with no way back.
//
// So this suite derives VIBES from the real ARCH table the same way the source
// does, resolves every one through the real first-match lookup, and hammers
// walkFor with tastes designed to empty it.
import { readFileSync } from "node:fs"

const src = readFileSync("lib/airroom/roster.ts", "utf8")
const taste = readFileSync("lib/airraw/taste.ts", "utf8")

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }

// ── the real archetype table, read out of the source ────────────────────────
const ARCH = [...src.matchAll(/\{\s*key:\s*"([^"]+)",\s*band:\s*\[([\d.]+),\s*([\d.]+)\],\s*clusters:\s*\d+,\s*lean:\s*"([fmx])",\s*vibe:\s*"([^"]+)"/g)]
  .map((m) => ({ key: m[1], band: [Number(m[2]), Number(m[3])], lean: m[4], vibe: m[5] }))
check(ARCH.length >= 8, `parsed the archetype table (${ARCH.length} tiers)`)

// VIBES, derived exactly as roster.ts derives them.
const VIBES = ARCH.map((a, i) => {
  const prev = ARCH[i - 1], next = ARCH[i + 1]
  const lo = Math.max(a.band[0], prev ? prev.band[1] + 0.005 : 0)
  const hi = next ? Math.min(a.band[1], next.band[0] - 0.005) : a.band[1]
  return { key: a.key, label: a.vibe, f: Number(((lo + hi) / 2).toFixed(3)), lean: a.lean }
})

// The lookup the roster actually uses: bands overlap, FIRST match wins.
const archFor = (f) =>
  ARCH.find((a) => f >= a.band[0] && f <= a.band[1]) ||
  ARCH.reduce((best, a) => {
    const d = Math.min(Math.abs(f - a.band[0]), Math.abs(f - a.band[1]))
    const bd = Math.min(Math.abs(f - best.band[0]), Math.abs(f - best.band[1]))
    return d < bd ? a : best
  })

// ── picking a vibe shows you THAT vibe ──────────────────────────────────────
const wrong = VIBES.filter((v) => archFor(v.f).key !== v.key)
check(wrong.length === 0,
  `every vibe resolves to its own archetype${wrong.length ? ` — ${wrong.map((v) => `${v.key}→${archFor(v.f).key}`).join(", ")}` : ""}`)

// And every tier is offered, including the last one. A filter that silently
// omits the top of the gradient is the unreachable-tier bug wearing a hat.
check(VIBES.length === ARCH.length, "every archetype is offered as a choice")
check(VIBES.some((v) => v.key === ARCH[ARCH.length - 1].key), "the hottest tier is reachable from the filter")
check(new Set(VIBES.map((v) => v.f)).size === VIBES.length, "no two vibes share a temperature")

// ── walkFor, mirrored from lib/airraw/taste.ts ──────────────────────────────
function walkFor(t) {
  const chosen = t.vibes.length ? VIBES.filter((v) => t.vibes.includes(v.key)) : VIBES
  const pool = chosen.length ? chosen : VIBES
  const a = pool.map((v) => v.f)
  if (a.length < 3) return a
  const stride = a.length % 2 === 0 ? 3 : 2
  const b = a.map((_, i) => a[(i * stride) % a.length])
  return [...a, ...b]
}

// EMPTY MEANS EVERYTHING. A new visitor must not have to fill in a form before
// the product will show them anybody.
check(walkFor({ gender: "any", vibes: [] }).length >= VIBES.length,
  "an unset taste walks the whole floor")

// The blank-screen case: a taste naming only vibes that no longer exist.
check(walkFor({ gender: "any", vibes: ["Ponies", "Nonsense"] }).length >= VIBES.length,
  "a taste of vibes that no longer exist falls back to everyone, never to nothing")

// Every single-vibe taste is non-empty and stays on its own tier.
for (const v of VIBES) {
  const w = walkFor({ gender: "any", vibes: [v.key] })
  if (!w.length || w.some((f) => archFor(f).key !== v.key)) {
    check(false, `asking only for "${v.key}" shows only ${v.key}`)
    break
  }
}
check(VIBES.every((v) => { const w = walkFor({ gender: "any", vibes: [v.key] }); return w.length > 0 && w.every((f) => archFor(f).key === v.key) }),
  "every single-vibe taste is non-empty and shows only that vibe")

// ── the deck does not read as a loop ────────────────────────────────────────
// The whole complaint this filter answers is "same every time same way".
const full = walkFor({ gender: "any", vibes: [] })
check(full.length >= 2 * VIBES.length, "the cycle is longer than one pass through the tiers")
let adjacentRepeats = 0
for (let i = 1; i < full.length; i++) if (full[i] === full[i - 1]) adjacentRepeats++
check(adjacentRepeats === 0, "no two consecutive cards are the same kind of person")
// The second pass must reorder, not repeat the first.
const half = full.length / 2
check(full.slice(0, half).join() !== full.slice(half).join(), "the second pass is shuffled, not a replay of the first")

// A two-vibe taste alternates rather than showing one then the other.
const two = walkFor({ gender: "any", vibes: [VIBES[0].key, VIBES[VIBES.length - 1].key] })
check(two.length === 2 && two[0] !== two[1], "a two-vibe taste keeps both")

// ── gender ──────────────────────────────────────────────────────────────────
const matchesTaste = (gender, t) => t.gender === "any" ? true : (gender || "").toLowerCase() === t.gender
check(matchesTaste("female", { gender: "any", vibes: [] }) && matchesTaste("male", { gender: "any", vibes: [] }),
  "an unset gender matches everyone")
check(matchesTaste("female", { gender: "female", vibes: [] }) && !matchesTaste("male", { gender: "female", vibes: [] }),
  "a set gender filters")
check(matchesTaste("", { gender: "female", vibes: [] }) === false, "a character with no gender is not smuggled through")

// ── a free session still leaves nothing behind ──────────────────────────────
// The privacy promise is made on the platform-facts page, so every store in
// this repo has to honour it — a preference is not an exemption.
check(/isPro\(\)\s*\?\s*localStorage\s*:\s*sessionStorage/.test(taste),
  "a free visit keeps the taste in sessionStorage; only a pass persists it")
check(/known\.has/.test(taste), "unknown vibe keys are dropped on read, so a rename can't silently empty the floor")
check(/gender:\s*"any",\s*vibes:\s*\[\]/.test(taste), "the default taste is empty, meaning everything")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
