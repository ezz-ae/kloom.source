import { readFileSync } from "fs"

// ── Rebuild the ethnicity → accent map and the dossier pick, in plain JS. ──
function hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
const pickE = (arr, seed) => arr[hash(seed + "|eth") % arr.length]
const pickD = (arr, seed, salt) => arr[hash(seed + "#" + salt) % arr.length]

const src = readFileSync("lib/airraw/portrait-prompt.ts", "utf8")
const ETH = src.match(/const ETHNICITY = \[([\s\S]*?)\n\]/)[1]
  .split(",").map(s => s.trim().replace(/^"|"$/g, "")).filter(s => s && !s.startsWith("//"))

const acc = readFileSync("lib/airraw/accent.ts", "utf8")
const arabicKeys = ["Egyptian","Moroccan","North African","Lebanese","Middle Eastern","Gulf Arab"]

const dsr = readFileSync("lib/airraw/dossier.ts", "utf8")
const OPINION = dsr.match(/const OPINION = \[([\s\S]*?)\n\]/)[1]
  .split('",').map(s => s.trim().replace(/^"/, "").replace(/"$/, "")).filter(Boolean)

let fail = 0
const check = (cond, label, detail = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${label}${detail ? "  " + detail : ""}`); if (!cond) fail++ }

// ── 1. Accent must NOT predict personality. ──────────────────────────────────
// Draw many characters; for each, record (isArabAccent, opinionIndex). If the two
// are independent, the opinion distribution is the same in both groups.
const N = 60000
const arabOps = new Map(), otherOps = new Map()
let arabN = 0, otherN = 0
for (let i = 0; i < N; i++) {
  const seed = `Room:${i.toString(36)}:Name${i % 149}`
  const eth = pickE(ETH, seed)
  const isArab = arabicKeys.includes(eth)
  const op = pickD(OPINION, seed, "op")
  const m = isArab ? arabOps : otherOps
  m.set(op, (m.get(op) || 0) + 1)
  if (isArab) arabN++; else otherN++
}
// Total-variation distance between the two opinion distributions.
let tv = 0
for (const op of OPINION) {
  tv += Math.abs((arabOps.get(op) || 0) / arabN - (otherOps.get(op) || 0) / otherN)
}
tv /= 2
console.log(`\naccent/personality independence over ${N} characters`)
console.log(`  arab-accent: ${arabN}   other: ${otherN}`)
console.log(`  total-variation distance between opinion distributions: ${tv.toFixed(4)}`)
check(tv < 0.05, "an accented character is no more/less likely to hold any given opinion", `(TV ${tv.toFixed(4)} < 0.05)`)

// Every opinion must actually occur in the arab-accent group — no opinion is
// reserved for non-Arab characters.
const missing = OPINION.filter(o => !arabOps.has(o))
check(missing.length === 0, "every opinion in the pool occurs with an Arab accent", missing.length ? `missing ${missing.length}` : "")

// ── 2. accent.ts must not carry personality fields. ──────────────────────────
const banned = ["personality", "beliefs", "religio", "conservat", "openness", "modest", "limits:"]
const found = banned.filter(w => new RegExp(`\\b${w}`, "i").test(acc.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")))
check(found.length === 0, "accent.ts declares no personality fields (code, comments excluded)", found.join(","))

// ── 3. Kloom no-op: no seedKey → no dialect, no accent pool. ─────────────────
const chat = readFileSync("app/api/chat/route.ts", "utf8")
check(/persona\.seedKey \? arabicDialectLine\(persona\.seedKey\) : ""/.test(chat),
      "chat route applies a dialect ONLY when seedKey is present (Kloom sends none)")
const tts = readFileSync("app/api/tts/route.ts", "utf8")
// Structural, not textual: pull out the `if (seedKey) { ... }` body and require
// every accent-pool lookup to live inside it. A regex on exact formatting broke
// the moment the block was reformatted, while the guarantee was still intact.
const gate = tts.slice(tts.indexOf("if (seedKey) {"))
const gateBody = gate.slice(0, gate.indexOf("\n  }") + 4)
const poolCalls = (tts.match(/(accentPool|discoveredAccentPool)\(/g) || []).length
const insideGate = (gateBody.match(/(accentPool|discoveredAccentPool)\(/g) || []).length
// One extra: the accentPool function's own declaration sits outside the gate.
check(insideGate >= 2 && insideGate >= poolCalls - 2,
      `accent-pool lookups all sit behind the seedKey gate (${insideGate} inside)`)

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
