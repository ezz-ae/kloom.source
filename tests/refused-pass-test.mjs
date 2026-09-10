// A REFUSED PASS MUST NOT END THE CALL, AND MUST NOT KEEP SAYING "ACTIVE".
//
// Reported from a phone: "no voice at all, call started, text first letter from
// the first word". Two separate faults produced that one screen.
//
//   1. The 402 handler dropped handsFree on EVERY branch. So the first refused
//      audio chunk tore the call down mid-sentence — no voice, half a line of
//      text, dead screen. For a customer whose PASS was refused that is
//      indefensible: they are still paid up and the words still work.
//
//   2. isPro() reads the expiry out of the token without checking its signature,
//      because the client has no secret and never can. So the You page showed a
//      green "pass active · until Oct 21" while every voice request for that
//      same token was being refused. Both screenshots, same minute.
//
// The client cannot verify a pass. It CAN listen to a refusal.
import { readFileSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

// ── 1. the call survives a refusal ──────────────────────────────────────────
console.log("— a refused pass does not tear the call down —")
{
  const src = strip(readFileSync("components/airroom/AirBubble.tsx", "utf8"))
  const at = src.indexOf("res.status === 402")
  check(at > 0, "the call handles a 402")
  const block = src.slice(at, at + 2000)

  // The words are free. Whatever ran out, the transcript opens so the
  // conversation stays readable instead of the screen simply dying.
  check(/setChatOpen\(true\)/.test(block),
    "the transcript opens, so a caller is left reading rather than staring at a dead screen")

  // And the refused-pass arm never sells them the pass they hold.
  const refused = block.slice(block.indexOf('why === "rejected"'))
  const arm = refused.slice(0, Math.max(0, refused.indexOf("else {")))
  check(arm.length > 40, "the refused-pass arm exists")
  check(!/setShowPro\(true\)/.test(arm), "and does not open the buy sheet")
  check(/markProRefused\(\)/.test(arm), "it records the server's refusal instead of arguing with it")
}

// ── 2. the UI stops claiming a pass the server refused ──────────────────────
console.log("\n— and the UI stops calling that pass active —")
{
  const pro = strip(readFileSync("lib/airroom/pro.ts", "utf8"))
  check(/export function markProRefused/.test(pro), "a refusal can be recorded")
  check(/export function proRefused/.test(pro), "and read back")

  const isPro = pro.slice(pro.indexOf("export function isPro"))
  const body = isPro.slice(0, isPro.indexOf("\n}"))
  check(/if \(proRefused\(\)\) return false/.test(body),
    "isPro() returns false after a refusal, whatever the token's own expiry claims")
  check(body.indexOf("proRefused()") < body.indexOf("proUntil()"),
    "and the refusal is checked BEFORE the expiry — the server outranks the claim")

  // A refusal is a memory, not a sentence: restoring or buying clears it, or a
  // customer who fixes their pass could never get back in.
  const setTok = pro.slice(pro.indexOf("export function setProToken"), pro.indexOf("export function clearPro"))
  check(/removeItem\(REFUSED_KEY\)/.test(setTok), "restoring a pass clears the refusal")
  const clear = pro.slice(pro.indexOf("export function clearPro"))
  check(/removeItem\(REFUSED_KEY\)/.test(clear.slice(0, 200)), "and so does clearing one")
}

// ── 3. the free wall still works, because it is the business ────────────────
console.log("\n— while the free wall still stops a free caller and still sells —")
{
  const src = strip(readFileSync("components/airroom/AirBubble.tsx", "utf8"))
  const at = src.indexOf("res.status === 402")
  const block = src.slice(at, at + 2000)
  const freeArm = block.slice(block.indexOf("else {", block.indexOf('why === "rejected"')))
  check(/free minute/.test(freeArm), "a genuine free caller is told the minute is up")
  check(/setShowPro\(true\)/.test(freeArm), "and is shown the pass — this is the moment it sells")
  check(/setHandsFree\(false\)/.test(block),
    "and hands-free still ends, because what ran out is the voice and there is no more to give")
}

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
