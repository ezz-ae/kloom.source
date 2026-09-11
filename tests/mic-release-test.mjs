// THE MIC IS HANDED BACK WHILE SHE SPEAKS, OR THE PHONE PLAYS HER AS A ROBOT.
//
// Reported from a phone, after the speaker was unlocked: "VOICE WORKING BUT
// SOUND LIKE ROBOT". The server was checked first: 192kbps ElevenLabs MP3,
// provider header elevenlabs, both languages. The file is fine. The phone
// degrades it: any open microphone capture puts iOS into its play-and-record
// session (voice processing on the OUTPUT, lower volume ceiling), and on any
// Bluetooth headset, on any OS, capture flips the link from the music profile
// to the 8kHz headset profile. The call kept the mic live under her voice for
// barge-in, and mute only paused listening — the tracks, and the session, stayed.
//
// The rule: the capture tracks END before the first chunk plays, and a fresh
// stream is taken when the reply ends or is cut off. Muting ends them too.
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const fn = (src, name) => {
  const i = src.indexOf(`const ${name} = `)
  if (i < 0) return ""
  // up to the next top-level const at the same indentation
  const rest = src.slice(i)
  const m = rest.slice(1).search(/\n  const [a-zA-Z]+ = /)
  return m < 0 ? rest : rest.slice(0, m + 1)
}

const bubble = strip(readFileSync("components/airroom/AirBubble.tsx", "utf8"))
const seg = strip(readFileSync("lib/speech-segmenter.ts", "utf8"))

console.log("— the capture session ends before the speaker opens —")
{
  const release = fn(bubble, "releaseMic")
  check(/getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\)/.test(release),
    "releaseMic() STOPS the tracks — an aborted segmenter with live tracks is the bug")
  check(/micGenRef\.current\+\+/.test(release), "and bumps the generation, so a reopen in flight lands dead")
  const pump = fn(bubble, "pump")
  check(/if \(!hostSpeakingRef\.current\) releaseMic\(\)\s*\n\s*hostSpeakingRef\.current = true/.test(pump),
    "pump() releases the mic on the FIRST chunk of a reply, before it marks her as speaking")
  check(/hostSpeakingRef\.current = false; setSpeaking\(false\)[\s\S]*?void reopenMic\(\)/.test(pump),
    "and takes it back when the queue drains")
}

console.log("— and comes back whenever she is quiet, unless the user said no —")
{
  const reopen = fn(bubble, "reopenMic")
  check(/getUserMedia\(\{ audio: phoneMicAudio\(\) \}\)/.test(reopen), "reopenMic() takes a fresh stream with the phone-call constraints")
  check(/micMutedRef\.current/.test(reopen) && /hfRef\.current/.test(reopen), "never for a muted mic, never off a call")
  check(/gen !== micGenRef\.current[\s\S]*?getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\)/.test(reopen),
    "a stream that arrives after she started again is stopped at once, not leaked live")
  check(/replaceStream\(s\)/.test(reopen), "the segmenter is re-sourced rather than rebuilt (its AudioContext needs a tap on iOS)")
  const stop = fn(bubble, "stopSpeaking")
  check(/void reopenMic\(\)/.test(stop), "cutting her off hands the mic back too")
  const mute = fn(bubble, "toggleMicMute")
  check(/releaseMic\(\)/.test(mute), "mute ends the tracks — a muted mic still open degrades the speaker and shows the recording light")
  check(/void reopenMic\(\)/.test(mute), "unmute takes them again")
  check(/return \(\) => \{[\s\S]*?releaseMic\(\)[\s\S]*?seg\?\.destroy\(\)/.test(bubble), "hanging up releases before it destroys")
}

console.log("— the segmenter can be re-sourced —")
{
  const i = seg.indexOf("replaceStream(stream: MediaStream)")
  const body = i < 0 ? "" : seg.slice(i, i + 600)
  check(i >= 0, "SpeechSegmenter.replaceStream exists")
  check(/opts\.stream = stream/.test(body), "the next utterance records from the new stream")
  check(/createMediaStreamSource\(stream\)[\s\S]*?connect\(this\.analyser\)/.test(body), "and the level meter listens to it")
  check(/discardRecorder\(\)/.test(body), "any recording on the dead stream is thrown away")
}

console.log("— Kloom is not in this —")
{
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? (f === "node_modules" || f === ".next" ? [] : walk(p)) : /\.tsx?$/.test(f) ? [p] : [] })
  const importers = [...walk("app"), ...walk("components"), ...walk("lib")]
    .filter((p) => !p.endsWith("speech-segmenter.ts") && /new SpeechSegmenter\(/.test(readFileSync(p, "utf8")))
  // The call, and the rooms' one-utterance listener — which already ends its
  // tracks the moment the utterance is in. replaceStream is additive, and the
  // Kloom voice room takes only phoneMicAudio from this file.
  const airraw = (p) => p.startsWith("components/airroom/") || p === "lib/voice-once.ts"
  check(importers.length > 0 && importers.every(airraw),
    `only AIRRAW surfaces drive a segmenter (${importers.join(", ") || "none"})`)
}

console.log(fail ? `\n${fail} FAILED` : "\nPASS")
process.exit(fail ? 1 : 0)
