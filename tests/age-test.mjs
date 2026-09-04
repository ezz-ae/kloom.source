// HOW OLD DOES THE FLOOR LOOK?
//
// The de-glamming pass fixed "the photos look so AI" and broke something else:
// it aged everyone into their fifties. Two causes, and the second is the
// instructive one.
//
//   1. The imperfections it added were AGE cues, not texture cues — "laugh
//      lines", "receding hairline", "sun-damaged skin", "tired eyes", and a
//      "greying hair" option in the hair pool. Individually defensible; stacked,
//      they describe an older person.
//
//   2. The negative prompt contained "young-looking" while every persona is
//      described as "in their early 20s". A negative that contradicts the
//      positive doesn't cancel out — the model resolves it, and it resolved it
//      by ageing everyone up.
//
// The safety floor is NOT part of that trade and is asserted here first, because
// the fix touches the same string.
import { readFileSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }

const src = readFileSync("lib/airraw/portrait-prompt.ts", "utf8")
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const neg = code.slice(code.indexOf("export const PORTRAIT_NEG"))
const pool = (name) => {
  const i = code.indexOf(`const ${name}`)
  return [...code.slice(i, code.indexOf("\n]", i)).matchAll(/"([^"]+)"/g)].map((m) => m[1])
}

// ── THE FLOOR. Non-negotiable, and checked before anything else. ────────────
for (const term of ["child", "minor", "underage", "teenager"]) {
  check(new RegExp(`\\b${term}\\b`).test(neg), `the negative still refuses "${term}"`)
}

// ── the contradiction ───────────────────────────────────────────────────────
check(!/young-looking/.test(neg),
  "the negative no longer pushes away from young-looking people it is asked to draw")
const AGE = pool("AGE")
check(AGE.length > 0 && AGE.every((a) => /\d0s\b/.test(a)), `${AGE.length} age bands, all explicit`)
check(AGE.filter((a) => /20s|30s/.test(a)).length / AGE.length >= 0.8,
  "the cast is weighted to 20s and 30s")

// A negative must never contradict something the positive can say. That is the
// whole bug, stated as a rule: every age band the AGE pool can produce must be
// absent from the negative.
const bandWords = new Set(AGE.flatMap((a) => a.split(/\s+/)))
const contradictions = [...bandWords].filter((w) => /\d0s/.test(w) && new RegExp(`\\b${w}\\b`).test(neg))
check(contradictions.length === 0,
  `no age the positive can ask for is negated${contradictions.length ? ` (${contradictions.join(", ")})` : ""}`)
check(!/middle-aged/.test(neg),
  "and 'middle-aged' is absent, because the AGE pool legitimately reaches the 40s")

// ── ageing cues are gone from the look pools ────────────────────────────────
const AGEING = ["laugh lines", "receding", "sun-damaged", "tired eyes", "tired kind eyes", "heavy eyelids", "greying", "wrinkle"]
const looks = [...pool("LOOK_F"), ...pool("LOOK_M"), ...pool("LOOK_X"), ...pool("HAIR")]
const found = looks.filter((l) => AGEING.some((a) => l.toLowerCase().includes(a)))
check(found.length === 0, `no look or hair option describes age${found.length ? ` — ${found.join(" | ")}` : ""}`)

// ── but the realism the de-glamming bought is KEPT ──────────────────────────
// This is the point: the fix must not simply revert to "strikingly beautiful",
// which is what made the faces look generated in the first place.
const glamour = ["strikingly beautiful", "drop-dead", "perfect bone structure", "flawless", "supermodel"]
check(!looks.some((l) => glamour.some((g) => l.toLowerCase().includes(g))),
  "and no superlative crept back in")
const imperfections = ["crooked", "gap", "freckles", "scar", "uneven", "stubble", "mole", "frizzy", "no makeup", "stick out"]
const withFlaw = looks.filter((l) => imperfections.some((i) => l.toLowerCase().includes(i))).length
check(withFlaw >= 15, `${withFlaw} looks still carry a specific imperfection`)
check(/pores|blemishes|unretouched/.test(code), "the base prompt still asks for real skin")
check(/beauty filter/.test(neg) && /poreless/.test(neg), "and still refuses the filtered look")

// ── the faces already generated have to be replaced ─────────────────────────
// Every cached portrait was made under the old prompt, so without a new cache
// key the fifty-year-olds simply stay.
const route = readFileSync("app/api/character-photo/route.ts", "utf8")
const ver = (route.match(/REALISM_VERSION \|\| "(r\d+)"/) || [])[1]
check(ver && Number(ver.slice(1)) >= 5, `the realism version was bumped so old faces regenerate (${ver})`)

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
