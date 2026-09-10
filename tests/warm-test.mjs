// THE WARMER COVERS WHAT THE SCREEN ACTUALLY ASKS FOR.
//
// A face's storage path contains PROMPT_FINGERPRINT, so editing the prompt makes
// every cached face a miss and every miss a live generation with someone
// watching. That shipped once: the fingerprint moved, the image providers were
// out of credit, and airraw.com served "image generation disabled" for its whole
// floor while ads ran.
//
// db/warm-faces.mjs is the fix — generate into storage against a preview build
// first, promote only at full coverage. Which makes ITS correctness the thing
// standing between a prompt edit and a blank floor, and the way it fails is
// silent: warm the wrong seeds and it reports FULL COVERAGE over faces nobody
// looks at. The first draft did exactly that. It enumerated publicCharacter(),
// the 600 /who pages — which render no faces at all.
//
// So this asserts the warmer's population against the REAL surfaces, by running
// both and comparing seeds.
import { readFileSync } from "node:fs"
import { ROSTER, groupCast, faceSeedFor } from "@/lib/airroom/roster"
import { writtenCast, CAST_COUNT, CAST_LANGS } from "@/lib/airraw/cast50"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const src = readFileSync("db/warm-faces.mjs", "utf8")
const body = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

// ── it draws from the same functions the room does ──────────────────────────
console.log("— it enumerates from the room's own functions —")
check(/writtenCast\(/.test(body), "the written cast, via writtenCast — the function the room calls")
check(/groupCast\(/.test(body), "the generated cast, via groupCast — likewise")
check(/for \(const c of ROSTER\)/.test(body), "and the deck's cluster hosts")
check(!/publicCharacter/.test(body),
  "and NOT publicCharacter — the /who pages render no faces, so warming them is spend with no screen behind it")

// ── the hourly seed matches TheRoom's, or it warms the wrong hours ──────────
console.log("\n— and it warms the hours the room will actually draw —")
const room = readFileSync("components/airroom/TheRoom.tsx", "utf8")
const roomSeed = /Math\.floor\(Date\.now\(\) \/ 3_600_000\) \* 3/.test(room)
check(roomSeed, "TheRoom still seeds its cast on the hour (× 3)")
check(/Math\.floor\(Date\.now\(\) \/ HOUR\)/.test(body) && /\(h0 \+ h\) \* 3/.test(body),
  "and the warmer computes the same seed, so hour+1 is the cast hour+1 will show")
const castN = /const CAST = (\d+)/.exec(room)
const warmN = /const CAST_PER_ROOM = (\d+)/.exec(body)
check(!!castN && !!warmN, "both name a cast size")
check(castN && warmN && Number(warmN[1]) === Number(castN[1]),
  `the warmer's cast size tracks the room's (${warmN?.[1]} vs ${castN?.[1]}) — a drift here warms too few and the tail goes blank`)

// ── the seeds it would warm are the seeds the room would request ────────────
console.log("\n— the seeds line up, not just the function names —")
{
  const h0 = Math.floor(Date.now() / 3_600_000)
  const seed = h0 * 3
  const roomAsks = new Set(groupCast(seed, 0.5, 14).map((c) => faceSeedFor(c)).filter(Boolean))
  const warmerDraws = new Set(groupCast(seed, 0.5, 14 * 2).map((c) => faceSeedFor(c)).filter(Boolean))
  const missing = [...roomAsks].filter((s) => !warmerDraws.has(s))
  check(roomAsks.size > 8, `the room asks for ${roomAsks.size} generated faces this hour`)
  check(missing.length === 0, "and every one of them is inside the warmer's wider draw")
}

// ── language matters, because the host IS the face seed ─────────────────────
console.log("\n— every language, because the name is half the seed —")
{
  const en = new Set(writtenCast(0, CAST_COUNT, "en").map((c) => faceSeedFor(c)))
  const ar = new Set(writtenCast(0, CAST_COUNT, "ar").map((c) => faceSeedFor(c)))
  const shared = [...ar].filter((s) => en.has(s)).length
  check(shared < ar.size,
    `an Arabic floor asks for different face seeds than an English one (${ar.size - shared} of ${ar.size} differ)`)
  check(/for \(const lang of CAST_LANGS\)/.test(body),
    "so the warmer walks every language the cast is written in — warming English alone leaves the Arabic floor blank")
  check(CAST_LANGS.length > 1 && CAST_LANGS.includes("ar"), `CAST_LANGS still carries Arabic (${CAST_LANGS.join(",")})`)
}

// ── the path it writes must be the path production will read ────────────────
//
// A face lives at {slug}-{seed}-{realism}-{fingerprint}. The fingerprint is
// meant to differ — that is the change being warmed. REALISM_VERSION is not: it
// is an env var, and a preview that does not inherit production's pin writes
// r5-... while production reads r3-.... Several hundred faces warmed into that
// still miss on promote, which is this file's whole failure mode with a bill on
// it. Production is pinned to r3 today and the preview defaulted to r5, so this
// is not hypothetical.
{
  console.log("\n— and it refuses to warm a path production will not read —")
  check(/async function pathShape/.test(body), "it reads the storage path shape from both deployments first")
  check(/there\.realism !== prod\.realism/.test(body), "and compares the realism version, not just the fingerprint")
  const at = body.indexOf("there.realism !== prod.realism")
  const arm = body.slice(at, at + 900)
  check(/process\.exit\(1\)/.test(arm), "a mismatch stops it before a single face is generated")
  check(!/there\.fingerprint !== prod\.fingerprint[\s\S]{0,200}process\.exit\(1\)/.test(body),
    "while a DIFFERENT fingerprint is expected and allowed — that is the thing being warmed")
  check(body.indexOf("async function pathShape") < body.indexOf("const people = cast()"),
    "and the check runs before the work, not after it")
}

// ── the guardrails that make it safe to run at all ──────────────────────────
console.log("\n— and it cannot do the damage it exists to prevent —")
check(/looks like production/.test(src) && /--yes-production/.test(body),
  "it refuses a production URL unless told twice — warming production is generating with people watching")
check(/GIVE_UP_AFTER/.test(body) && /streak >= GIVE_UP_AFTER/.test(body),
  "it stops after a run of failures instead of making hundreds of doomed calls at a dead provider")
check(/process\.exit\(1\)/.test(body) && /Do NOT promote until this reports full coverage/.test(src),
  "and it exits non-zero on partial coverage, so a script cannot promote a half-warm build")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
