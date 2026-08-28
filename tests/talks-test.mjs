// AiR talks: a board that moves on its own, and is never a dead end.
import { readFileSync } from "node:fs"
const src = readFileSync("lib/airraw/talks.ts", "utf8")

const TITLES = [...src.matchAll(/\["([^"]+)",\s*"[wmf]"\]/g)].map(m => m[1])
const SLOT_MS = 12 * 60_000
function hash(n){let h=(n^0x9e3779b9)>>>0;h=Math.imul(h^(h>>>16),2246822507)>>>0;h=Math.imul(h^(h>>>13),3266489909)>>>0;return (h^(h>>>16))>>>0}
function liveTalks(now, count=4){
  const slot=Math.floor(now/SLOT_MS); const out=[]
  for(let i=0;i<count;i++){
    const h=hash(slot*31+i*7919); const title=TITLES[h%TITLES.length]
    const seats=6+(hash(h)%15)
    const startedAt=(h%100)/100*0.55
    const age=Math.min(0.98,(now%SLOT_MS)/SLOT_MS+startedAt)
    const taken=Math.min(seats-1,Math.floor(seats*age*0.9))
    out.push({id:`t${slot}-${i}`,title,seats,taken,startedMinsAgo:Math.floor(age*18)})
  }
  const seen=new Set()
  return out.filter(t=>seen.has(t.title)?false:(seen.add(t.title),true))
}
const seatsLeft = t => Math.max(0, t.seats - t.taken)

let fail=0
const check=(c,l)=>{console.log(`${c?"ok  ":"FAIL"} ${l}`); if(!c) fail++}

const T0 = 1800000000000
check(TITLES.length >= 15, `${TITLES.length} titles — enough that a board rarely repeats`)

// Deterministic for a given instant: two clients must see the same board.
check(JSON.stringify(liveTalks(T0)) === JSON.stringify(liveTalks(T0)),
  "same instant → identical board on every client")

// Never a dead end.
let noSeat = 0, boards = 0
for (let t = T0; t < T0 + 86400000; t += 137000) {
  const b = liveTalks(t); boards++
  if (!b.some(x => seatsLeft(x) > 0)) noSeat++
  for (const x of b) {
    if (seatsLeft(x) < 1) { console.log(`  full talk: ${x.title}`); fail++ }
    if (x.seats < 6 || x.seats > 20) { console.log(`  bad seat count ${x.seats}`); fail++ }
  }
}
check(noSeat === 0, `every one of ${boards} boards across a day had an open seat`)

// The board actually changes over time.
const a = liveTalks(T0).map(t=>t.title).join("|")
const b = liveTalks(T0 + 40*60_000).map(t=>t.title).join("|")
check(a !== b, "the board is different 40 minutes later")

// Seats fill as a slot ages — arriving late has to be possible.
const early = liveTalks(Math.floor(T0/SLOT_MS)*SLOT_MS + 1000)
const late  = liveTalks(Math.floor(T0/SLOT_MS)*SLOT_MS + SLOT_MS - 1000)
check(late.reduce((s,t)=>s+t.taken,0) > early.reduce((s,t)=>s+t.taken,0),
  "seats fill as the slot ages, so you can arrive late")

// No duplicate titles on one board.
let dupes = 0
for (let t = T0; t < T0 + 86400000; t += 311000) {
  const b2 = liveTalks(t).map(x=>x.title)
  if (new Set(b2).size !== b2.length) dupes++
}
check(dupes === 0, "no board ever shows the same talk twice")

// The guarantee that actually matters: a talk must never LOSE occupants while
// someone is watching the board.
const slotStart = Math.floor(T0/SLOT_MS)*SLOT_MS
let regressions = 0
let prev = null
for (let ms = 1000; ms < SLOT_MS; ms += 5000) {
  const board = liveTalks(slotStart + ms)
  if (prev) for (const t of board) {
    const was = prev.find(x => x.id === t.id)
    if (was && t.taken < was.taken) regressions++
  }
  prev = board
}
check(regressions === 0, "seats never un-fill while a slot runs")


// ONE definition of the room a talk opens into. The board shows small faces of
// who is in a talk; the room builds the people who speak. If those two derive
// the cast independently they drift, and the card becomes a lie about who is in
// there — the most expensive bug available to a product whose north star is
// "he forgot they are AI". Structural, not behavioural: assert the callers go
// through the shared helpers rather than re-deriving heat or seat counts.
const fs = await import("node:fs")
const strip = (f) => fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const talksSrc = strip("lib/airraw/talks.ts")
const boardSrc = strip("components/airroom/Talks.tsx")
const planetSrc = strip("components/airroom/Planet.tsx")
const roomSrc = strip("components/airroom/GroupRoom.tsx")

check(/export function talkRoom/.test(talksSrc) && /export const heatF/.test(talksSrc),
  "talks.ts owns the talk -> room mapping")
check(/talkRoom\(/.test(boardSrc) && /groupCast\(/.test(boardSrc),
  "the board derives its faces from the shared helpers")
check(!/heat === "w"/.test(boardSrc) && !/heat === "w"/.test(planetSrc),
  "nobody re-derives heat -> temperature by hand")
check(/groupCast\(seed, f, count\)/.test(roomSrc),
  "the room builds its cast with the same function the board displays")

console.log(fail===0?"\nPASS":`\nFAIL — ${fail}`)
process.exit(fail?1:0)
