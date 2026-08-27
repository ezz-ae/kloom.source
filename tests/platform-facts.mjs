import { readFileSync } from "fs"
const src = readFileSync("lib/airraw/platform-facts.ts", "utf8")
const rx = (...p) => new RegExp(p.join("|"), "i")
const block = src.slice(src.indexOf("const TOPIC = {"), src.indexOf("\nconst FACTS"))
const TOPIC = eval("(" + block.replace("const TOPIC = ", "").replace(/String\.raw/g, "String.raw").trim().replace(/\}$/,"}") + ")")
const hits = t => Object.keys(TOPIC).filter(k => TOPIC[k].test(t))

const FIRE = [
  ["can anyone else hear us", "privacy"], ["is anybody listening to this", "privacy"],
  ["does someone else read our chat", "privacy"], ["is this recorded?", "recording"],
  ["are you recording me", "recording"], ["is this private", "privacy"],
  ["is my data safe", "privacy"], ["how much does the pro pass cost", "money"],
  ["do i have to pay for this", "money"], ["how do i cancel my subscription", "money"],
  ["what is this app", "product"], ["will you remember me next time", "memory"],
  ["do you forget everything", "memory"], ["هل تسجل صوتي؟", "recording"],
  ["هل هذا خاص؟", "privacy"], ["كم سعر الاشتراك؟", "money"],
  ["شو هاد الموقع؟", "product"], ["رح تتذكرني؟", "memory"],
  ["في حدا تاني بيسمع؟", "privacy"], ["مين كمان بيسمعنا؟", "privacy"],
  ["صوتي محفوظ عندكم؟", "privacy"],
]
const QUIET = [
  "i had a long day at work", "tell me what you're wearing",
  "i've been thinking about you", "what do you actually want",
  "ما نمت من امبارح", "احكيلي عن ليلتك", "you sound tired",
  "i can hear the rain outside", "i want to see you smile",
]
let fail = 0
console.log("— must fire —")
for (const [q, want] of FIRE) { const h = hits(q); const ok = h.includes(want)
  console.log(`${ok?"ok  ":"FAIL"} [${h.join(",")||"none"}]  ${q}`); if(!ok) fail++ }
console.log("\n— must stay quiet —")
for (const q of QUIET) { const h = hits(q); const ok = h.length===0
  console.log(`${ok?"ok  ":"FAIL"} [${h.join(",")||"none"}]  ${q}`); if(!ok) fail++ }
console.log(fail===0?"\nPASS":`\nFAIL — ${fail}`)
process.exit(fail===0?0:1)
