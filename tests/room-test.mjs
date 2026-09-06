// THE ROOM — where the site lands, and the rules that keep it affordable.
//
// Two things have to be true at once. It must feel like fourteen distinct
// people, some of whom talk out loud — that is what makes a visitor catch one of
// them. And it must never spend while nobody is reading, because a room that
// generates for an empty screen is a bill with no reader. Both are guarded here.
import { readFileSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const strip = (f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
const room = strip("components/airroom/TheRoom.tsx")
const raw = readFileSync("components/airroom/TheRoom.tsx", "utf8")
const planet = strip("components/airroom/Planet.tsx")
const pool = (name) => {
  const i = raw.indexOf(`const ${name} = [`)
  return [...raw.slice(i, raw.indexOf("\n]", i)).matchAll(/"([^"]+)"/g)].map((m) => m[1])
}

// ── the site lands here ─────────────────────────────────────────────────────
check(/useState\(true\)/.test(planet.slice(planet.indexOf("const [roomOpen"), planet.indexOf("const [roomOpen") + 80)),
  "the room is open on landing")
const shell = strip("components/airroom/AirShell.tsx")
check(shell.indexOf('id: "room"') < shell.indexOf('id: "people"'), "and it is the first tab")

// ── fourteen DISTINCT people, not one narrator ──────────────────────────────
const TEXTURE = pool("TEXTURE"), MOOD = pool("MOOD"), KIND = pool("KIND")
check(TEXTURE.length >= 10, `${TEXTURE.length} ways of writing`)
check(MOOD.length >= 8, `${MOOD.length} moods`)
check(KIND.length >= 6, `${KIND.length} kinds of line`)
check(/pickBy\(TEXTURE, id, "texture"\)/.test(room), "how a person writes is FIXED per person, like their face")
check(/rand\(MOOD\)/.test(room) && /rand\(KIND\)/.test(room), "mood and kind change per line — the weather, not the person")
check(!/one line, lowercase, casual/.test(room), "the single flat house style is gone")
// A room where everyone answers the visitor at once is a chorus. Answering is a
// distinct, deliberate act.
check(/replyDue\.current/.test(room) && /Answer THEM, by name/.test(room), "when the visitor speaks, exactly one person answers, by name")

// ── some talk, most write ───────────────────────────────────────────────────
const TALKERS = Number((raw.match(/const TALKERS = (\d+)/) || [])[1])
const CAST = Number((raw.match(/const CAST = (\d+)/) || [])[1])
const VOICE_EVERY = Number((raw.match(/const VOICE_EVERY = (\d+)/) || [])[1])
check(TALKERS > 0 && TALKERS < CAST / 2, `${TALKERS} of ${CAST} ever speak aloud — a garnish, not the meal`)
check(VOICE_EVERY >= 3, `and only one line in ${VOICE_EVERY} of theirs is spoken`)
check(/talkers\.has\(who\.key\)/.test(room), "a non-talker can never be voiced — the ratio holds")
// The reply to the visitor is the hook, so it goes to someone who can say it
// aloud — spend concentrated on the one moment the visitor engaged.
check(/answering && talkersFree\.length \? talkersFree/.test(room), "the reply to the visitor is given to a talker when one is free")
check(/api\/tts/.test(room) && /spoken: aloud/.test(room), "a spoken line is marked so it stands out")
check(/awaitPin\(who, lang\)/.test(room) && /pinnedVoice\(who, lang\)/.test(room),
  "a talker keeps the voice they were first heard in")

// ── the visitor can take part ───────────────────────────────────────────────
check(/listenOnce\(/.test(room) && /canListen\(\)/.test(room), "there is a mic, shown only where the browser can record")
check(/onKeyDown=\{\(e\) => \{ if \(e\.key === "Enter"\) say\(draft\)/.test(room), "and a text box that sends on enter")
check(/who: null/.test(room), "the visitor's own lines are in the transcript, so replies have something to answer")

// ── it never spends with nobody watching ────────────────────────────────────
check(/document\.hidden\) return/.test(room), "a hidden tab generates nothing")
check(/openRef\.current\) return/.test(room), "neither does a room with a card open over it")
check(/busy\.current\) return/.test(room), "never two requests in flight")
const gap = Number((raw.match(/const GAP_MS = (\d+)/) || [])[1])
check(gap >= 5000, `lines are ${gap / 1000}s apart — slow enough to read, cheap enough to leave open`)
check(/ctrl\.abort\(\)/.test(room) && /micHandle\.current\?\.cancel\(\)/.test(room), "leaving the room stops the request and the mic")

// ── the card clears the dock ────────────────────────────────────────────────
check(/calc\(env\(safe-area-inset-bottom\) \+ 5\.75rem\)/.test(room), "the profile sheet reserves the dock's height")
check(/calc\(env\(safe-area-inset-bottom\) \+ 5\.5rem\)/.test(room), "and so does the input row")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
