// One person, one voice — the greeting, the call, and every chunk in between.
//
// Voice casting is deterministic per seed, but the pools it casts FROM are
// discovered per serverless instance and change under a live call, and the
// front door used to cast with a different seed and engine mode than the call.
// So the client pins the voice it was first answered in and sends it back; the
// server exposes it; the first request for a person goes alone; and every
// surface casts from the same seed the FACE was generated from.
import { readFileSync } from "node:fs"

let fails = 0
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) fails++ }
const read = (p) => readFileSync(p, "utf8")

const tts = read("app/api/tts/route.ts")
check(/"X-EL-Voice": elVoice/.test(tts), "the TTS route says which voice it actually used (X-EL-Voice)")
check(/for \(let attempt = 0; attempt < EL_TRIES; attempt\+\+\)/.test(tts) && /if \(res\.status !== 429 && res\.status < 500\) break/.test(tts),
  "a 429/5xx from the engine is retried before any OTHER engine (and voice) is tried")
check(/elevenId\?\.trim\(\) \|\| elVoiceFor\(/.test(tts), "an explicit pin beats the server's own casting")

for (const f of ["components/airroom/AirBubble.tsx", "components/airroom/GroupRoom.tsx", "components/airroom/Planet.tsx", "components/airroom/RoomCard.tsx"]) {
  const s = read(f)
  const short = f.replace("components/airroom/", "")
  check(s.includes('fetch("/api/tts"'), `${short}: speaks`)
  check(/const who = faceSeedFor\(/.test(s) && /seedKey: who/.test(s), `${short}: casts from the FACE's seed`)
  check(/elevenId: pinnedVoice\(who,/.test(s), `${short}: sends the pinned voice back`)
  check(/pinFromResponse\(who,/.test(s), `${short}: pins the voice it was answered in`)
  check(/mode: "voice"/.test(s), `${short}: same engine mode as the call`)
  check(/awaitPin\(who,/.test(s) && /claimFirst\(who,/.test(s), `${short}: the first request for a person goes alone`)
}

const air = read("components/airroom/AirBubble.tsx")
check(/seedKey: faceSeedFor\(c\) \|\| c\.host/.test(air), "the 1:1 persona's dialect comes from the face's seed")
check(/const TTS_LANES = 2/.test(air) && /acquireTtsLane\(\)/.test(air) && /finally \{ releaseTtsLane\(\) \}/.test(air),
  "at most two chunks are in flight, and a lane is always given back")
const room = read("components/airroom/GroupRoom.tsx")
check(/seedKey: faceSeedFor\(mem\) \|\| mem\.host/.test(room), "a group member's dialect comes from the face's seed")
const roster = read("lib/airroom/roster.ts")
check(/matches\(faceSeedFor\(first\) \|\| first\.key\)/.test(roster) && /matches\(faceSeedFor\(c\) \|\| c\.key\)/.test(roster),
  "the language filter judges the same seed the face and voice use")

const pin = read("lib/airraw/voice-pin.ts")
check(/X-EL-Voice/.test(pin) && /localStorage/.test(pin), "pins come from the response and survive a reload")
check(/if \(!seedKey \|\| !res\.ok\) return undefined/.test(pin), "a failed chunk never pins")
check(/req\.then\(\(\) => undefined, \(\) => undefined\)/.test(pin), "a failed first request releases the siblings waiting on it")
check(/isoForLanguage\(language\)/.test(pin), "pins are per language, so Arabic and English may differ deliberately")

const pro = read("app/api/airraw-pro/route.ts")
check(/wallet: "anon", credits: 0, kind: "airraw_pass"/.test(pro), "the pending pass row satisfies the table's NOT NULL wallet (the webhook can find it)")

const photo = read("app/api/character-photo/route.ts")
check(/b === RATE_LIMITED/.test(photo) && /limited = true; break/.test(photo), "a Together 429 backs off once, then stops the walk instead of asking twenty more models")
check(/if \(asked >= WALK_MAX\) break/.test(photo), "one request's model walk is bounded")
check(/Date\.now\(\) < falOffUntil\) return null/.test(photo), "a dead FAL key is not retried on every face")

const face = read("lib/airraw/face.ts")
check(/const FACE_LANES = 4/.test(face) && /await acquireFaceLane\(\)/.test(face) && /inflight\.delete\(k\); releaseFaceLane\(\)/.test(face),
  "portraits are requested a few at a time, never as a burst — and a lane is always given back")

console.log(fails ? `\n${fails} FAILED` : "\nall pin checks pass")
process.exit(fails ? 1 : 0)
