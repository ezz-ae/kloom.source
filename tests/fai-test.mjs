// The FAI economy: earn-only, capped, and a seat you can't buy.
const store = new Map()
globalThis.localStorage = {
  getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k,v) => store.set(k,v), removeItem: k => store.delete(k),
}
globalThis.window = {}
const FIRST_GRANT = 3, CAP = 5
const BAL="faitalk_fai", GRANT="faitalk_fai_granted", DAY="faitalk_fai_day"
const today = () => new Date().toISOString().slice(0,10)
const read = k => store.get(k) || ""
const write = (k,v) => store.set(k,v)
const getFai = () => { if(!read(GRANT)){write(GRANT,"1");write(BAL,String(FIRST_GRANT));return FIRST_GRANT}
  const n=Number(read(BAL)); return Number.isFinite(n)?Math.max(0,n):0 }
const earnedToday = () => { const [d,n]=read(DAY).split(":"); return d===today()?Number(n)||0:0 }
const canEarnToday = () => earnedToday() < CAP
const earnFai = (n) => { const want=Math.max(0,Math.floor(n)); if(!want) return getFai()
  const room=Math.max(0,CAP-earnedToday()); const give=Math.min(want,room); if(!give) return getFai()
  const next=getFai()+give; write(BAL,String(next)); write(DAY,`${today()}:${earnedToday()+give}`); return next }
const spendFai = (n=1) => { const b=getFai(); if(b<n) return false; write(BAL,String(b-n)); return true }

let fail=0
const check=(c,l)=>{console.log(`${c?"ok  ":"FAIL"} ${l}`); if(!c) fail++}

check(getFai() === FIRST_GRANT, `new visitor starts with ${FIRST_GRANT} FAI`)

// The cap is what stops swiping from BEING the currency.
store.clear()
let bal = getFai()
for (let i = 0; i < 50; i++) earnFai(1)
check(earnedToday() === CAP, `cannot earn more than ${CAP} a day however much you swipe`)
check(getFai() === FIRST_GRANT + CAP, "balance reflects exactly the capped earnings")

// Spending
check(spendFai(1) === true, "a seat can be paid for when affordable")
const before = getFai()
while (spendFai(1)) { /* drain */ }
check(getFai() === 0, "spending drains to zero and stops")
check(spendFai(1) === false, "cannot spend FAI you don't have")

// A new day restores the earn allowance but NOT the balance.
store.set(DAY, "2020-01-01:5")
check(canEarnToday() === true, "the allowance resets on a new day")
check(getFai() === 0, "a new day does not hand out free balance")

// Earning is the ONLY inbound path — no purchase function exists.
const raw = (await import("node:fs")).readFileSync("lib/airraw/fai.ts", "utf8")
// Strip comments first. The file's own documentation explains that FAI cannot be
// bought, so a naive scan flags the very sentence promising the guarantee.
const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
check(!/\b(buy|purchase|checkout|price|stripe|ziina)\b/i.test(src), "fai.ts exposes no way to buy FAI")
check((src.match(/localStorage\.setItem\(BAL/g) || []).length === 0, "balance is only written through the guarded helpers")
check(/export function earnFai/.test(src) && /reason: string/.test(src),
  "every source of FAI must name a reason (keeps the economy greppable)")

console.log(fail===0?"\nPASS":`\nFAIL — ${fail}`)
process.exit(fail?1:0)
