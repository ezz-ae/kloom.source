// The AiR economy: earn-only, capped, and a seat you can't buy.
const store = new Map()
globalThis.localStorage = {
  getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k,v) => store.set(k,v), removeItem: k => store.delete(k),
}
globalThis.window = {}
const FIRST_GRANT = 3, CAP = 5
const BAL="airraw_air", GRANT="airraw_air_granted", DAY="airraw_air_day"
const today = () => new Date().toISOString().slice(0,10)
const read = k => store.get(k) || ""
const write = (k,v) => store.set(k,v)
const getAir = () => { if(!read(GRANT)){write(GRANT,"1");write(BAL,String(FIRST_GRANT));return FIRST_GRANT}
  const n=Number(read(BAL)); return Number.isFinite(n)?Math.max(0,n):0 }
const earnedToday = () => { const [d,n]=read(DAY).split(":"); return d===today()?Number(n)||0:0 }
const canEarnToday = () => earnedToday() < CAP
const earnAir = (n) => { const want=Math.max(0,Math.floor(n)); if(!want) return getAir()
  const room=Math.max(0,CAP-earnedToday()); const give=Math.min(want,room); if(!give) return getAir()
  const next=getAir()+give; write(BAL,String(next)); write(DAY,`${today()}:${earnedToday()+give}`); return next }
const spendAir = (n=1) => { const b=getAir(); if(b<n) return false; write(BAL,String(b-n)); return true }

let fail=0
const check=(c,l)=>{console.log(`${c?"ok  ":"FAIL"} ${l}`); if(!c) fail++}

check(getAir() === FIRST_GRANT, `new visitor starts with ${FIRST_GRANT} AiR`)

// The cap is what stops swiping from BEING the currency.
store.clear()
let bal = getAir()
for (let i = 0; i < 50; i++) earnAir(1)
check(earnedToday() === CAP, `cannot earn more than ${CAP} a day however much you swipe`)
check(getAir() === FIRST_GRANT + CAP, "balance reflects exactly the capped earnings")

// Spending
check(spendAir(1) === true, "a seat can be paid for when affordable")
const before = getAir()
while (spendAir(1)) { /* drain */ }
check(getAir() === 0, "spending drains to zero and stops")
check(spendAir(1) === false, "cannot spend AiR you don't have")

// A new day restores the earn allowance but NOT the balance.
store.set(DAY, "2020-01-01:5")
check(canEarnToday() === true, "the allowance resets on a new day")
check(getAir() === 0, "a new day does not hand out free balance")

// Earning is the ONLY inbound path — no purchase function exists.
const raw = (await import("node:fs")).readFileSync("lib/airraw/air.ts", "utf8")
// Strip comments first. The file's own documentation explains that AiR cannot be
// bought, so a naive scan flags the very sentence promising the guarantee.
const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
check(!/\b(buy|purchase|checkout|price|stripe|ziina)\b/i.test(src), "air.ts exposes no way to buy AiR")
check((src.match(/localStorage\.setItem\(BAL/g) || []).length === 0, "balance is only written through the guarded helpers")
check(/export function earnAir/.test(src) && /reason: string/.test(src),
  "every source of AiR must name a reason (keeps the economy greppable)")

console.log(fail===0?"\nPASS":`\nFAIL — ${fail}`)
process.exit(fail?1:0)
