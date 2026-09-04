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
// The property that matters is SPECIFICITY, not flaw count. "An attractive young
// woman" alone renders the average of every attractive young woman — which is the
// plastic look. A concrete detail is what makes her a person. The count was
// asserted as >= 15 when the pools were flaw-heavy; that number was measuring the
// over-correction, so it measured well right up until the over-correction was
// fixed.
const DETAILS = [
  "crooked", "freckles", "uneven", "stubble", "messy", "sharp nose", "thin lips",
  "strong brows", "thick eyebrows", "soft jaw", "strong jaw", "round face",
  "high cheekbones", "heavy brow", "no makeup", "wide smile", "laughing eyes",
  "shaved head", "dark eyes", "bare skin", "direct", "half-smile", "grin", "quiet expression",
]
const generic = [...pool("LOOK_F"), ...pool("LOOK_M"), ...pool("LOOK_X")]
  .filter((l) => !DETAILS.some((d) => l.toLowerCase().includes(d)))
check(generic.length === 0,
  `every look names something concrete${generic.length ? ` — vague: ${generic.join(" | ")}` : ""}`)

// And none of them stack. Two details read as a person; five read as a list.
const stacked = [...pool("LOOK_F"), ...pool("LOOK_M")]
  .filter((l) => DETAILS.filter((d) => l.toLowerCase().includes(d)).length > 3)
check(stacked.length === 0, `no look piles on details${stacked.length ? ` — ${stacked.join(" | ")}` : ""}`)
check(/pores|blemishes|unretouched/.test(code), "the base prompt still asks for real skin")
check(/beauty filter/.test(neg) && /poreless/.test(neg), "and still refuses the filtered look")

// ── THE GENERAL RULE, which both bugs here were instances of ────────────────
//
// A negative prompt that contradicts the positive does not cancel out. The model
// resolves it, and it resolves it unpredictably:
//
//   "young-looking" in the negative while every persona is "in their early 20s"
//   → everyone came out fifty.
//
//   "blemishes" in the BASE, applied to every face on top of whatever flaw the
//   look already named → skin damage rather than skin texture.
//
// So: any feature word the positive pools can produce is forbidden in the
// negative, and vice versa. Curated rather than tokenised, because shared nouns
// ("person") are not contradictions and a naive word diff only cries wolf.
const FEATURES = [
  "crooked", "freckles", "uneven", "stubble", "messy", "wavy", "curly",
  "gap", "mole", "scar", "acne", "wrinkle", "shaved", "buzzed", "blemish",
]
const positives = [...pool("LOOK_F"), ...pool("LOOK_M"), ...pool("LOOK_X"), ...pool("HAIR"), ...pool("AGE")]
  .join(" ").toLowerCase()
const base = code.slice(code.indexOf("const BASE ="), code.indexOf("export const PORTRAIT_NEG")).toLowerCase()
const negLower = neg.toLowerCase()
const clashes = FEATURES.filter((w) => (positives.includes(w) || base.includes(w)) && negLower.includes(w))
check(clashes.length === 0,
  `no feature the prompt asks for is also refused${clashes.length ? ` — ${clashes.join(", ")}` : ""}`)

// ── attractive AND real, which is the whole difficulty ──────────────────────
// Stripping "attractive" was not what stopped the faces looking generated — the
// SUPERLATIVES were. Those stay gone; the baseline appeal comes back.
const lookText = [...pool("LOOK_F"), ...pool("LOOK_M")].join(" ").toLowerCase()
const appealing = [...pool("LOOK_F"), ...pool("LOOK_M")]
  .filter((l) => /attractive|beautiful|handsome|pretty|good-looking/.test(l)).length
check(appealing === pool("LOOK_F").length + pool("LOOK_M").length,
  "every look describes someone worth looking at")
check(!/ordinary everyday adult/.test(base), "and the base no longer asks for 'ordinary'")
check(/attractive real person/.test(base), "it asks for an attractive real person")

// Damage is refused; texture is still asked for. These are different things and
// conflating them is what produced a face covered in lesions.
check(/acne|lesions|scabs/.test(negLower), "skin damage is refused")
check(/visible pores|skin texture/.test(base), "while real skin texture is still asked for")
check(!/blemishes/.test(base), "and the base no longer asks for blemishes on every single face")

// ── the faces already generated have to be replaced ─────────────────────────
// Every cached portrait was made under the old prompt, so without a new cache
// key the fifty-year-olds simply stay.
const route = readFileSync("app/api/character-photo/route.ts", "utf8")

// A HAND-BUMPED VERSION WAS NOT ENOUGH, and this is the lesson the file exists
// to keep. The path carried REALISM_VERSION, Vercel had it pinned to r3, and the
// env beat the code default — so the de-glamming pass AND the age fix both wrote
// to a cache key that never moved. Production served faces from a prompt that no
// longer existed, twice, and nothing said why.
check(/PROMPT_FINGERPRINT/.test(route), "the cache path carries a fingerprint of the prompt")
check(/\$\{PROMPT_FINGERPRINT\}/.test(route), "and it is actually interpolated into the path")
const fp = src.slice(src.indexOf("export const PROMPT_FINGERPRINT"))
for (const pool of ["AGE", "LOOK_F", "LOOK_M", "LOOK_X", "STYLE", "HAIR", "PORTRAIT_NEG", "BASE"]) {
  check(new RegExp(`\\b${pool}\\b`).test(fp.slice(0, 600)), `the fingerprint covers ${pool}`)
}
check(!/process\.env/.test(fp.slice(0, 600)),
  "and nothing in the environment can pin it — that is what went wrong before")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
