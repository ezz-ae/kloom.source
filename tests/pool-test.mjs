import { readFileSync } from "fs"
const src = readFileSync("lib/airroom/roster.ts", "utf8")
function grab(name) {
  const m = src.match(new RegExp("const " + name + " = \\[([\\s\\S]*?)\\n\\]"))
  return m[1].split(",").map(s => s.trim().replace(/^"|"$/g, "")).filter(Boolean)
}
const isPrime = n => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true }
const gcd = (a,b) => b ? gcd(b, a%b) : a
let fail = 0
for (const n of ["NAMES_F", "NAMES_M"]) {
  const arr = grab(n)
  const uniq = new Set(arr)
  const dupes = arr.filter((x, i) => arr.indexOf(x) !== i)
  console.log(`${n}: ${arr.length} entries, ${uniq.size} unique, prime=${isPrime(arr.length)}, gcd(97,len)=${gcd(97, arr.length)}`)
  if (dupes.length) { console.log(`  DUPES: ${[...new Set(dupes)].join(", ")}`); fail++ }
  if (!isPrime(arr.length)) { console.log("  NOT PRIME — permutation guarantee broken"); fail++ }
  if (gcd(97, arr.length) !== 1) { console.log("  STRIDE NOT COPRIME"); fail++ }

  // Prove draw-WITHOUT-replacement: walk consecutive seeds, assert a full lap
  // of distinct names before any repeat.
  const L = arr.length
  const seen = new Set()
  let firstRepeatAt = -1
  for (let s = 0; s < L + 5; s++) {
    const idx = ((s % L) * 97) % L
    if (seen.has(idx)) { firstRepeatAt = s; break }
    seen.add(idx)
  }
  console.log(`  consecutive seeds: ${firstRepeatAt === -1 ? "no repeat in " + (L+5) : "first repeat at draw " + firstRepeatAt} (pool ${L})`)
  if (firstRepeatAt !== L) { console.log(`  EXPECTED first repeat exactly at ${L}`); fail++ }

  // Callers use stride-7 seeds (seed*7+i+1). Check those too.
  const seen7 = new Set(); let rep7 = -1
  for (let s = 0; s < L + 5; s++) {
    const seed = s * 7 + 1
    const idx = ((seed % L) * 97) % L
    if (seen7.has(idx)) { rep7 = s; break }
    seen7.add(idx)
  }
  console.log(`  stride-7 seeds:    ${rep7 === -1 ? "no repeat" : "first repeat at draw " + rep7}`)
  if (rep7 !== L) { console.log(`  EXPECTED ${L}`); fail++ }
}
// Old behaviour, for comparison: hashed pick over 61 names.
function hash(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
let collide = 0, TRIALS = 20000
for (let t = 0; t < TRIALS; t++) {
  const seen = new Set(); let hit = false
  for (let d = 0; d < 10; d++) { const i = hash(`t${t}d${d}`) % 61; if (seen.has(i)) { hit = true; break } seen.add(i) }
  if (hit) collide++
}
console.log(`\nold 61-name hashed pick: repeat within 10 swaps ${(100*collide/TRIALS).toFixed(1)}% of sessions`)
console.log(`new 149-name permutation: repeat within 10 swaps 0% (guaranteed, first repeat at draw 149)`)
console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
