// "Her, doing X" — the guarantee is that it is always HER.
//
// Diffusion has no memory, so every request for a scene is an unrelated image
// unless something carries identity across calls. Two ids in the portrait route
// look interchangeable and are not, and swapping them breaks this feature in
// opposite directions: `seed` re-derives the whole appearance, `slug` only picks
// the cache path.
import { readFileSync } from "node:fs"
let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const media = strip("app/api/media/route.ts")
const char = strip("lib/airraw/character.ts")

// ── identity is stored, never re-rolled ─────────────────────────────────────
check(/seed: key \|\| name/.test(media), "the appearance seed is the CHARACTER, so she cannot change between scenes")
check(/slug: `\$\{\(name \|\| "char"\)\}-\$\{sceneId\}`/.test(media),
  "the cache path is the character AND the scene, so scenes cannot collide")
const seedLine = media.slice(media.indexOf("seed: key"), media.indexOf("slug:"))
check(!/scene/.test(seedLine), "the scene never leaks into the identity seed")

// The saved look is written once. Re-deriving it on every save would defeat the
// entire file — that IS the bug this exists to prevent.
check(/existing\.savedAt = Date\.now\(\)/.test(char) && !/existing\.look =/.test(char),
  "saving a character again refreshes when you saw them, never their look")
check(/export function lookFor/.test(char), "the look is derived from the same builder the first portrait used")

// ── the prompt puts the person first ────────────────────────────────────────
// Diffusion weights early tokens more heavily; leading with the scene would let
// a long request wash the person out.
check(/`\$\{look\}, \$\{scene\}`/.test(media), "identity leads the prompt, the scene follows")
check(/`\$\{c\.look\}, \$\{s\}`/.test(char), "and the same order is used client-side")

// ── it is not a general image generator ─────────────────────────────────────
check(/if \(!look\) return Response\.json\(\{ error: "no character" \}/.test(media),
  "a request with no saved character is refused outright")
check(/if \(!adultEnabled\(\)\) return Response\.json\(\{ error: "not available" \}, \{ status: 404 \}\)/.test(media),
  "the route does not exist on Kloom — it can never become an open endpoint on the ad domain")
check(/globalGate\(\)/.test(media) && /rateLimit\(`media:/.test(media),
  "it shares the spend ceiling and takes its own per-client limit")

// Scenes are user text, and arrive from a transcript on the voice path.
check(/replace\(\/\[\\n\\r"\]\+\/g/.test(media), "scene text is stripped of line breaks and quotes")
check(/slice\(0, 180\)/.test(media), "and clamped, so an essay can't drown the identity clause")

// ── voice reuses the recogniser, it does not fork it ────────────────────────
check(/\/api\/stt/.test(media), "voice-to-media transcribes through the existing STT chain")
check(!/whisper|scribe|gemini/i.test(media), "and contains no recogniser of its own to drift from it")

// ── storage matches the promise made elsewhere ──────────────────────────────
check(/isPro\(\) \? localStorage : sessionStorage/.test(char),
  "a free session keeps nothing — the same rule memory.ts follows")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
