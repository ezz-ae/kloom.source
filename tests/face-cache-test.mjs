// A DEAD IMAGE PROVIDER COSTS NEW FACES, NEVER THE ONES ALREADY DRAWN.
//
// The floor's whole promise is a screen of faces. Those faces are make-once /
// cache-forever: generated a single time, uploaded to storage, and served from
// there for nothing ever after. Thousands of them already exist.
//
// The route used to answer "image generation disabled" the moment a provider
// was unusable — and it answered it ABOVE the cache lookup. So when the image
// account ran out of credit, production did not lose the faces it could no
// longer draw. It lost every face there was. Worse, the client latches on that
// `disabled` flag and stops asking for the rest of the session, so one 503
// blanked the entire floor for a visitor who could have been served from
// storage at zero cost.
//
// Confirmed live: airraw.com returned {"error":"image generation disabled"} for
// a face that had been generated months earlier.
//
// The rule is an ordering rule, so the test is about order, not about strings.
import { readFileSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }

const src = readFileSync("app/api/character-photo/route.ts", "utf8")
const body = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

console.log("— the cache is consulted before the refusal —")
const cacheAt = body.indexOf("getPublicUrl")
const gateAt = body.indexOf("canGenerate")
const refusalAt = body.indexOf('if (!canGenerate)')
check(cacheAt > 0, "the route serves faces out of storage")
check(gateAt > 0, "and it decides separately whether a NEW one can be drawn")
check(gateAt < cacheAt, "the provider check happens first, but only to record the answer")
check(refusalAt > cacheAt,
  "and the refusal is issued AFTER the cache lookup — a dead provider must not hide a face that already exists")

// The specific regression: no unconditional `disabled` response may sit above
// the cache. That is exactly the shape the bug had.
const beforeCache = body.slice(0, cacheAt)
const earlyDisabled = [...beforeCache.matchAll(/disabled: true/g)]
// One is allowed: the no-storage case, where there is no cache to consult at all.
const noStorageArm = /hasAdmin\(\)[\s\S]{0,400}?disabled: true/.test(beforeCache)
check(earlyDisabled.length <= 1 && (earlyDisabled.length === 0 || noStorageArm),
  `at most one early refusal, and only for the no-storage case (${earlyDisabled.length} found)`)

console.log("\n— and the client is still told to stop asking, once it is true —")
const face = readFileSync("lib/airraw/face.ts", "utf8")
check(/r\.status === 503 && d\?\.disabled/.test(face),
  "the client latches on disabled — which is why it must never be sent while faces remain")
check(/offUntil = Date\.now\(\) \+ RETRY_MS/.test(face),
  "and it stops asking for every other face on the screen, so a wrong 503 is expensive")
check(/const c = cachedFace\(p\)/.test(face),
  "a face already seen on this device is still served from the browser without asking at all")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
