// A PINNED VOICE IS FOREVER, SO A BAD ONE HAS TO BE SURVIVABLE.
//
// The first voice a person is heard in is written to this device and sent back
// on every later request; the server honours it and never casts again. That is
// what stops a character changing voice mid-sentence — and it also means any
// window in which the server cast badly is frozen onto that phone for good.
// Nothing in the product could undo it: clearVoicePins() existed and was called
// from nowhere.
//
// Reported as "all voices are all the same, even with premium", from a device
// that had been testing for weeks, in the same hour the live server handed
// eight characters eight different voices.
//
// So: a map that has obviously collapsed heals itself on load, and the You page
// offers the reset for everything else.
import { readFileSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const KEY = "airraw_voice_pin:v1"
const store = {}
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v }, removeItem: (k) => { delete store[k] } }

const fresh = async () => { for (const k of Object.keys(store)) delete store[k]; return import("../lib/airraw/voice-pin.ts?" + Math.random()) }

console.log("— a collapsed map heals itself —")
{
  const m = await fresh()
  const bad = {}; for (const n of ["a", "b", "c", "d", "e", "f"]) bad[n + "|en"] = "ONEVOICE"
  store[KEY] = JSON.stringify(bad)
  check(m.voicePinStats().people === 0, "six people on one voice is not a coincidence — the map is dropped")
  check(m.pinnedVoice("a", "English") === undefined, "so the server casts them again instead of being told the wrong answer")
  check(store[KEY] === undefined, "and the bad map is erased from the device, not just from memory")
}

console.log("— a healthy one is left alone —")
{
  const m = await fresh()
  const ok = {}; ["a", "b", "c", "d", "e", "f", "g", "h"].forEach((n, i) => { ok[n + "|en"] = "VOICE" + i })
  ok["a|ar"] = "VOICE0"   // one person, two languages, same voice — not a collapse
  store[KEY] = JSON.stringify(ok)
  const st = m.voicePinStats()
  check(st.people === 8 && !st.collapsed, `eight people on eight voices survives (${st.people} kept)`)
  check(m.pinnedVoice("a", "English") === "VOICE0", "and every pin still answers")
}

console.log("— a small map is never touched —")
{
  const m = await fresh()
  store[KEY] = JSON.stringify({ "a|en": "V1", "b|en": "V1", "c|en": "V1" })
  check(m.voicePinStats().people === 3, "three people can share a voice by chance — too little to judge")
}

console.log("— and there is a way out on the screen —")
{
  const you = readFileSync("components/airroom/YouPage.tsx", "utf8")
  const ar = readFileSync("lib/airraw/ar.ts", "utf8")
  check(/clearVoicePins\(\); setPins\(voicePinStats\(\)\); window\.location\.reload\(\)/.test(you), "the You page can reset the voices and reloads so they are heard again")
  check(/pins\.people > 0 &&/.test(you), "offered only when there is something to reset")
  check(/pins\.collapsed \?/.test(you), "and it says so plainly when they have collapsed")
  check(ar.includes('"voices sounding the same? tap to hear them fresh":'), "in Arabic too")
}

console.log(fail ? `\n${fail} FAILED` : "\nPASS")
process.exit(fail ? 1 : 0)
