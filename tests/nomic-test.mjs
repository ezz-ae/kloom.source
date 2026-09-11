// A PHONE WITH NO MICROPHONE STILL HEARS HER.
//
// 101 of 117 ad visitors arrived inside the Instagram or Facebook in-app
// browser. Those browsers HAVE getUserMedia and will never grant it, so
// canListen() said yes, the screen offered "call", the tap was refused, and a
// voice product met its own paid traffic with a dead button. 1.4 pages a visit,
// no sales.
//
// The rule: in a webview the call screen is a no-mic screen. The first tap
// unlocks the speaker and starts her greeting OUT LOUD, then opens the keypad.
// Voice in one direction is most of the product; a dead button is none of it.
import { readFileSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const bubble = strip(readFileSync("components/airroom/AirBubble.tsx", "utf8"))
const ar = readFileSync("lib/airraw/ar.ts", "utf8")

console.log("— a webview is treated as a phone with no microphone —")
check(/setSttOk\(canListen\(\) && !inAppBrowser\(\)\)/.test(bubble),
  "the call screen asks whether the mic will actually be GRANTED, not whether the API exists")
check(/import \{ inAppBrowser \} from "@\/lib\/airraw\/in-app"/.test(bubble), "from the one detector the product already uses")

console.log("— and the no-mic tap is a real start, not just a keyboard —")
{
  const i = bubble.indexOf("const onType = ")
  const fn = i < 0 ? "" : bubble.slice(i, bubble.indexOf("const onTalk = "))
  check(i >= 0, "there is a no-mic start")
  check(/unlockAudio\(audioRef\.current\)/.test(fn), "it unlocks the speaker inside the gesture, like the call does")
  check(/greetIfNeeded\(\)/.test(fn), "she says hello OUT LOUD — the visitor learns she has a voice")
  check(/setChatOpen\(true\)/.test(fn), "and the keypad opens so they can answer")
  check(/sttOk \? onTalk : onType/.test(bubble), "the big button runs it when there is no mic")
  check(/sttOk \? t\("tap call to start"\) : t\("tap — she talks, you type"\)/.test(bubble),
    "and the screen says what the tap will do instead of promising a call it cannot place")
  check(ar.includes('"tap — she talks, you type":'), "in Arabic too")
}

console.log("— Kloom is not in this —")
check(!/inAppBrowser/.test(strip(readFileSync("lib/voice-once.ts", "utf8"))), "canListen itself is unchanged, so every other surface behaves as before")

console.log(fail ? `\n${fail} FAILED` : "\nPASS")
process.exit(fail ? 1 : 0)
