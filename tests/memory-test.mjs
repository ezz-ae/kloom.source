// WHO YOU MET IS FOR EVERYONE; WHAT WAS SAID IS FOR THE PASS.
//
// Runs the REAL lib/airraw/memory.ts against a fake window + localStorage, with
// isPro() driven by a real-shaped token in storage — the mirror this test used
// to carry drifted from the module once already.
//
// The rules (lib/airraw/memory.ts header):
//   1. No transcript unless Pro AND memory not off. Free keeps the character and
//      a timestamp, never a word. Off stops even that and erases what is there.
//   2. Erasable one at a time and wholesale.
//   3. Capped.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { if (v.length > 5000) throw new Error("QuotaExceededError"); store.set(k, v) },
  removeItem: (k) => store.delete(k),
}
globalThis.window = { location: { search: "" } }
const PRO_TOKEN = Buffer.from(JSON.stringify({ until: Date.now() + 86_400_000, v: 1, minutes: 6000 })).toString("base64") + ".sig"
const setPro = (on) => { if (on) store.set("airraw_pro_token", PRO_TOKEN); else store.delete("airraw_pro_token"); store.delete("airraw_pro_refused") }

const { saveTalk, listTalks, loadTalk, forgetTalk, forgetAll, setMemoryOff, memoryEnabled, metEnabled } = await import("../lib/airraw/memory.ts")
const KEY = "airraw_talks", MAX_TALKS = 12, MAX_MSGS = 30
const cl = (n) => ({ key: `K:${n}`, host: `H${n}`, gender: "female", lines: ["a", "b", "c"], vibe: "v", name: "r", f: 0.5, n: 1, h: "m", archetype: "GFE" })
const conv = (n) => [{ who: "host", text: "hi" }, ...Array.from({ length: n }, (_, i) => ({ who: i % 2 ? "host" : "you", text: `m${i}` }))]

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }

console.log("— free: who, never what —")
store.clear(); setPro(false)
check(!memoryEnabled() && metEnabled(), "a free session has who-memory and no transcript-memory")
saveTalk(cl(1), conv(6))
check(listTalks().length === 1 && listTalks()[0].cluster.host === "H1", "free keeps WHO was met")
check(!/m0|m1|hi/.test(store.get(KEY) || ""), "and not one word of what was said reaches storage")
check(loadTalk("K:1") === null, "and cannot load a thread — there is none")
store.clear(); saveTalk(cl(2), [{ who: "host", text: "hi" }])
check(listTalks().length === 0, "a room you never spoke in is not offered back, free or not")

console.log("— pro: the thread —")
store.clear(); setPro(true)
check(memoryEnabled(), "a pass turns transcript memory on")
saveTalk(cl(1), conv(6))
check(loadTalk("K:1")?.msgs.length > 0, "pro saves and restores the thread")
saveTalk(cl(3), conv(80))
check(loadTalk("K:3").msgs.length === MAX_MSGS, `only the last ${MAX_MSGS} messages are kept`)
for (let i = 10; i < 30; i++) saveTalk(cl(i), conv(2))
check(listTalks().length <= MAX_TALKS, `no more than ${MAX_TALKS} threads stored`)

console.log("— a lapsed pass —")
setPro(false)
check(listTalks().length > 0, "the faces are still there for the free session")
check(loadTalk("K:3") === null, "the transcripts are not readable")
saveTalk(cl(3), conv(4))
check(loadTalk("K:3") === null && JSON.parse(store.get(KEY)).find((t) => t.key === "K:3").msgs.length === 0,
  "and talking to her again while free OVERWRITES the old transcript with an empty one — nothing lingers under a free session")

console.log("— off, forget, and the failure modes —")
store.clear(); setPro(true); saveTalk(cl(1), conv(4)); saveTalk(cl(2), conv(4))
forgetTalk("K:1"); check(loadTalk("K:1") === null && loadTalk("K:2") !== null, "forget one leaves the others")
forgetAll(); check(listTalks().length === 0, "forget all wipes everything")
saveTalk(cl(1), conv(4)); setMemoryOff(true)
check(store.get(KEY) === undefined, "turning memory off ERASES existing threads, not just future ones")
check(!memoryEnabled() && !metEnabled(), "off stops both tiers — pass or not")
saveTalk(cl(1), conv(4)); check(store.get(KEY) === undefined, "and nothing is written while off, not even who")
setMemoryOff(false)
store.set(KEY, "{not json"); check(listTalks().length === 0, "corrupt storage degrades to empty, no throw")
store.set(KEY, JSON.stringify([{ nope: 1 }, { key: "K:9", cluster: cl(9), msgs: [] }])); check(listTalks().length === 1, "malformed entries are filtered out")
store.clear(); for (let i = 0; i < 12; i++) saveTalk(cl(i), conv(30)); check(listTalks().length > 0, "quota pressure keeps some threads rather than losing all")

console.log("— the surfaces —")
import { readFileSync } from "node:fs"
{
  const bubble = readFileSync("components/airroom/AirBubble.tsx", "utf8")
  const you = readFileSync("components/airroom/YouPage.tsx", "utf8")
  const ar = readFileSync("lib/airraw/ar.ts", "utf8")
  check(!/if \(!memoryEnabled\(\)\) return\s*\n\s*saveTalk/.test(bubble), "the call no longer gates saving on the pass — saveTalk decides what to keep")
  check(/memoryEnabled\(\) && resumed/.test(bubble) && /!!loadTalk\(cluster\.key\)\?\.msgs\.length/.test(bubble), "picking a thread back up stays a pass feature")
  check(/checked=\{!off\}/.test(you) && !/memoryEnabled\(\) \? \(/.test(you), "the You page shows the toggle to everyone, always — a pass holder can switch memory back on")
  check(/with the pass, she also remembers what you said/.test(you), "and tells a free visitor what the pass adds, on the screen where they see the faces")
  check(ar.includes('"Remember who I met":') && ar.includes('"we keep who you met, on this device only. with the pass, she also remembers what you said.":'), "in Arabic too")
}

console.log(fail ? `\n${fail} FAILED` : "\nPASS")
process.exit(fail ? 1 : 0)
