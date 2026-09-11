// THE SPEAKER IS UNLOCKED ON A GESTURE, OR THE PRODUCT IS SILENT.
//
// Reported from a phone, after paying: "cant hear any sound".
//
// Every sound this product makes is played from a fetch callback — a reply
// streams, a chunk goes to TTS, audio comes back, and only then is play()
// called. By then iOS no longer counts it as a user gesture, so Safari refuses.
// The refusal was caught and logged to a console nobody has open, which is why
// it read as "the AI went silent" rather than as an error: text on screen, no
// voice, no explanation, and the TTS engine already billed for.
//
// Five surfaces had it — the call, the room, the group room, a scene and the
// chess board. Wiring an unlock into every tap that might lead to sound is a
// list nobody keeps correct, so the rule is: a surface registers its speaker,
// and the first touch on the page unlocks everything registered.
import { readFileSync, readdirSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

console.log("— the unlock plays real silence, inside the gesture —")
{
  const u = strip(readFileSync("lib/airraw/audio-unlock.ts", "utf8"))
  check(/data:audio\/wav;base64,/.test(u),
    "it plays an actual silent file — play() with no source rejects, and a rejected unlock is none")
  check(/\.play\(\)/.test(u), "it calls play() on the element that will carry the voice")
  check(/pause\(\)/.test(u), "and stops it again immediately")
  check(/WeakSet|unlocked\.has/.test(u), "it is idempotent, so repeated taps cost nothing")
  check(/catch/.test(u), "and never throws — a browser that needs no unlock is not one to break")

  check(/addEventListener\("pointerdown"/.test(u), "the first touch anywhere arms it")
  check(/capture: true/.test(u),
    "in the capture phase, so a stopPropagation somewhere in the tree cannot cost the page its sound")
}

console.log("\n— and every surface that makes a sound has registered —")
{
  const dir = "components/airroom"
  const speakers = readdirSync(dir).filter((f) => {
    if (!f.endsWith(".tsx")) return false
    const src = strip(readFileSync(`${dir}/${f}`, "utf8"))
    return /audioRef = useRef<HTMLAudioElement/.test(src)
  })
  check(speakers.length >= 5, `${speakers.length} surfaces own an <audio> element`)
  for (const f of speakers) {
    const src = strip(readFileSync(`${dir}/${f}`, "utf8"))
    check(/registerAudio\(audioRef\.current\)/.test(src),
      `${f.replace(/\.tsx$/, "")} registers its speaker`)
  }
}

console.log("\n— and the call unlocks on the button itself, not just on any touch —")
{
  const b = strip(readFileSync("components/airroom/AirBubble.tsx", "utf8"))
  const at = b.indexOf("const onTalk = ")
  check(at > 0, "the call button has a handler")
  const head = b.slice(at, at + 200)
  check(/unlockAudio\(audioRef\.current\)/.test(head), "which unlocks the speaker")
  check(head.indexOf("unlockAudio") < head.indexOf("setHandsFree"),
    "as its FIRST act, synchronously — an await before it would end the gesture")
}

// ── and no decoy unlock is trusted ──────────────────────────────────────────
//
// Planet used to play a throwaway `new Audio(silence)` on the first tap, with a
// comment asserting the unlock is per-session. It is per-element: that blessed
// the throwaway and left the real speaker locked, and the product stayed silent
// through a fix aimed directly at it. An unlock must target the element that
// will play.
{
  console.log("\n— and the unlock targets the element that speaks, never a decoy —")
  const dir = "components/airroom"
  let decoys = []
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
    const src = strip(readFileSync(`${dir}/${f}`, "utf8"))
    if (/new Audio\(SILENT|new Audio\("data:audio\/wav/.test(src)) decoys.push(f)
  }
  check(decoys.length === 0, `no surface unlocks by playing a throwaway element${decoys.length ? ` (${decoys.join(", ")})` : ""}`)
  const u = strip(readFileSync("lib/airraw/audio-unlock.ts", "utf8"))
  check(/el\.src = SILENCE/.test(u) && /el\.play\(\)/.test(u),
    "the shared unlock plays silence through the caller's OWN element")
}

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
