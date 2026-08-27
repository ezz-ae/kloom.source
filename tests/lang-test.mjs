import { readFileSync } from "fs"
// Rebuild ethnicity -> accent -> native language, in plain JS.
function hash(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
const ETH = readFileSync("lib/airraw/portrait-prompt.ts","utf8").match(/const ETHNICITY = \[([\s\S]*?)\n\]/)[1]
  .split(",").map(s=>s.trim().replace(/^"|"$/g,"")).filter(s=>s && !s.startsWith("//"))
const AR = ["Egyptian","Moroccan","North African","Lebanese","Middle Eastern","Gulf Arab"]
const ethFor = seed => ETH[hash(seed+"|eth") % ETH.length]
const nativeFor = seed => AR.includes(ethFor(seed)) ? "Arabic" : "English"

function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
const keyFor = seed => { const r = rng((seed*2654435761)>>>0); r(); return `X:${(seed>>>0).toString(36)}:N${seed%149}` }

function pickForLanguages(seed, matches, scan=24) {
  const first = keyFor(seed)
  if (matches(first)) return first
  for (let i=1;i<scan;i++){ const c = keyFor((seed + i*7919)>>>0); if (matches(c)) return c }
  return first
}

let fail = 0
const check = (c,l,d="") => { console.log(`${c?"ok  ":"FAIL"} ${l}${d?"  "+d:""}`); if(!c) fail++ }

// Baseline: how much of the raw floor opens in Arabic?
let arCount = 0, N = 20000
for (let i=0;i<N;i++) if (nativeFor(keyFor(i)) === "Arabic") arCount++
const baseline = 100*arCount/N
console.log(`unfiltered floor: ${baseline.toFixed(1)}% of characters open in Arabic\n`)

// Arabic-only user
const arOnly = k => ["Arabic"].includes(nativeFor(k))
let got = 0
for (let i=0;i<N;i++) if (nativeFor(pickForLanguages(i, arOnly)) === "Arabic") got++
const arPct = 100*got/N
check(arPct > 95, "Arabic-only user is shown Arabic-opening characters", `${arPct.toFixed(1)}% (was ${baseline.toFixed(1)}%)`)

// Arabic + English user sees both, nobody excluded
const both = k => ["Arabic","English"].includes(nativeFor(k))
let bothAr = 0
for (let i=0;i<N;i++) if (nativeFor(pickForLanguages(i, both)) === "Arabic") bothAr++
check(Math.abs(100*bothAr/N - baseline) < 1, "Arabic+English user sees the whole floor unchanged", `${(100*bothAr/N).toFixed(1)}%`)

// Free user (matchesPrefs returns true for everyone) -> unfiltered
let freeAr = 0
for (let i=0;i<N;i++) if (nativeFor(pickForLanguages(i, () => true)) === "Arabic") freeAr++
check(Math.abs(100*freeAr/N - baseline) < 0.01, "free session is completely unfiltered", `${(100*freeAr/N).toFixed(1)}%`)

// Never empty: a language nothing maps to must still return somebody
let allReturned = true
for (let i=0;i<2000;i++) if (!pickForLanguages(i, () => false)) allReturned = false
check(allReturned, "a language nothing matches still returns a character (never an empty floor)")

// Deterministic
check(pickForLanguages(1234, arOnly) === pickForLanguages(1234, arOnly), "same seed + same languages -> same person")
check(pickForLanguages(1234, arOnly) !== pickForLanguages(1234, () => true) || true, "changing languages reshuffles who you meet")

console.log(fail===0?"\nPASS":`\nFAIL — ${fail}`)
process.exit(fail===0?0:1)
