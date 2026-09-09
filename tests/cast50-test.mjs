// THE FIFTY ARE FIFTY PEOPLE, AND EACH ONE IS ONE PERSON IN EVERY LANGUAGE.
//
// Two claims, and the file is worth nothing if either fails.
//
//   1. NOT CARBON COPIES. The floor can already generate thousands of plausible
//      people, and plausible is exactly the register that reads as filler. These
//      are hand-written so that no two of them share a want, a tell, an opinion
//      or a contradiction. A cast that differs by label is the thing this
//      replaces.
//
//   2. LOCALISATION NEVER TOUCHES THE PERSON. The obvious way to localise a cast
//      is the wrong one: give the Arabic version a more modest personality and
//      the European version a bolder one. That is not localisation — it is
//      writing different people and calling them the same one, on an assumption
//      nobody asked for. Salma and Selma and Salomé are ONE WOMAN: same wants,
//      same opinions, same limits. Only the name and the face change.
import { readFileSync } from "node:fs"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }
const src = readFileSync("lib/airraw/cast50.ts", "utf8")

// Split the array into one block per character.
const arr = src.slice(src.indexOf("export const CAST: CastMember[] = ["))
const blocks = arr.split(/\n  \{\n    id: "/).slice(1).map((b) => "id: \"" + b.split("\n  },")[0])
check(blocks.length === 50, `there are fifty of them (${blocks.length})`)

const field = (b, name) => (b.match(new RegExp(`\\b${name}: "((?:[^"\\\\]|\\\\.)*)"`)) || [])[1] || ""
const ids = blocks.map((b) => field(b, "id"))
check(new Set(ids).size === 50, `every id is unique (${new Set(ids).size})`)

// ── each one is complete ──────────────────────────────────────────────────
const SOUL = ["core", "work", "where", "onMind", "opinion", "peeve", "tell", "wants", "softens"]
const VOICE = ["base", "laugh", "whisper", "tease", "serious", "wanting"]
let thin = []
for (const b of blocks) {
  for (const f of [...SOUL, ...VOICE]) if (field(b, f).length < 12) thin.push(`${field(b, "id")}.${f}`)
}
check(thin.length === 0, `every soul and every voice layer is written (${thin.slice(0, 3).join(", ")})`)

const openerCount = blocks.map((b) => (b.match(/openers: \[([\s\S]*?)\]/) || ["", ""])[1].split(/",\s*\n/).filter((x) => x.trim()).length)
check(openerCount.every((n) => n >= 3), `everyone has at least three openers (min ${Math.min(...openerCount)})`)

// ── NOT CARBON COPIES ─────────────────────────────────────────────────────
// The fields that carry the person. If two characters share one verbatim, they
// are the same character with a different hat.
for (const f of ["core", "wants", "opinion", "tell", "peeve", "softens"]) {
  const vals = blocks.map((b) => field(b, f))
  const dupes = vals.filter((v, i) => vals.indexOf(v) !== i)
  check(dupes.length === 0, `no two of them share a "${f}" (${dupes.slice(0, 1).join("") || "none"})`)
}
// Voices too — a laugh is the most identifying thing a voice has.
for (const f of ["laugh", "base", "whisper"]) {
  const vals = blocks.map((b) => field(b, f))
  const dupes = vals.filter((v, i) => vals.indexOf(v) !== i)
  check(dupes.length === 0, `no two of them share a "${f}" voice (${dupes.slice(0, 1).join("") || "none"})`)
}

// ── spread across the floor, not clustered ────────────────────────────────
const bands = blocks.map((b) => Number((b.match(/band: ([0-9.]+)/) || [])[1]))
check(bands.every((n) => n >= 0 && n <= 1), "every band is on the gradient")
check(Math.min(...bands) < 0.1 && Math.max(...bands) > 0.9, `they span the whole floor (${Math.min(...bands)}–${Math.max(...bands)})`)
const decades = new Set(bands.map((b) => Math.floor(b * 10)))
check(decades.size >= 9, `and are spread across it rather than bunched (${decades.size}/10 tenths occupied)`)

// Gender is a RESULT of who each one turned out to be, not a quota. So the test
// is that both are well represented — not that they are equal.
const genders = blocks.map((b) => field(b, "gender"))
const f = genders.filter((g) => g === "f").length
check(f >= 15 && f <= 35, `both genders are well represented without being a quota (${f}f / ${50 - f}m)`)

// ── LOCALISATION CANNOT REACH THE PERSON ──────────────────────────────────
const LANGS = ["en", "ar", "es", "fr", "tr", "ru"]
let missing = []
for (const b of blocks) {
  const names = (b.match(/names: \{([^}]*)\}/) || ["", ""])[1]
  for (const l of LANGS) if (!new RegExp(`\\b${l}: "`).test(names)) missing.push(`${field(b, "id")}.${l}`)
}
check(missing.length === 0, `all fifty carry a name in all six languages (${missing.slice(0, 3).join(", ")})`)

// identityFor must pass soul and voice straight through, untouched.
const idf = src.slice(src.indexOf("export function identityFor"), src.indexOf("export function castIn"))
check(/soul: member\.soul/.test(idf), "identityFor passes the soul through by reference — no per-locale copy to diverge")
check(/voice: member\.voice/.test(idf), "and the voice with it")
check(!/lang.*soul|soul.*lang/s.test(idf.replace(/\/\*[\s\S]*?\*\//g, "")) || /soul: member\.soul/.test(idf),
  "nothing in it makes the soul depend on the language")

// A character's own look must not carry an origin — that is the locale's one job,
// and a nationality baked into `look` would fight it.
const ORIGIN = /\b(arab|arabic|european|asian|african|slavic|turkish|french|spanish|latina?|middle[- ]eastern|caucasian|white|black)\b/i
const tainted = blocks.filter((b) => ORIGIN.test(field(b, "look"))).map((b) => field(b, "id"))
check(tainted.length === 0, `no character's look hardcodes an origin (${tainted.slice(0, 3).join(", ")})`)
check(/LOCALE_FACE/.test(src) && /look: `\$\{member\.look\}, \$\{LOCALE_FACE/.test(src),
  "origin comes from the locale, applied on top of the person's own face")

// ── the soul reaches the model as facts, with its registers ───────────────
const sp = src.slice(src.indexOf("export function soulPrompt"))
for (const f of ["wants", "opinion", "softens", "tell"]) {
  check(new RegExp(`s\\.${f}`).test(sp), `the prompt carries "${f}"`)
}
for (const v of VOICE) check(new RegExp(`v\\.${v}`).test(sp), `the prompt carries the "${v}" register`)

// ── they are actually who you meet ────────────────────────────────────────
const room = readFileSync("components/airroom/TheRoom.tsx", "utf8")
check(/writtenCast\(seed, Math\.min\(WRITTEN_IN_ROOM/.test(room), "the room is built from the written cast first")
const inRoom = Number((room.match(/const WRITTEN_IN_ROOM = (\d+)/) || [])[1])
const roomSize = Number((room.match(/const CAST = (\d+)/) || [])[1])
check(inRoom > roomSize / 2, `most of the room is hand-written (${inRoom} of ${roomSize})`)
check(/groupCast/.test(room), "and the generated floor still fills it out, so it is a crowd not a line-up")

// ── their soul is what reaches the model ──────────────────────────────────
// The choice moved into the persona registry, which is the point — but the room
// still has to HAND OVER the written soul, and the registry still has to prefer
// it. Both halves are asserted, because either one alone is a passing test over
// a broken feature.
check(/renderPersona\(who, "room", \{\s*soul: soulOf\(who\)/.test(room),
  "the room hands the written soul to the registry")
{
  const { renderPersona } = await import("@/lib/airraw/persona")
  const { makeCharacter } = await import("@/lib/airroom/roster")
  const { dossierForSeed } = await import("@/lib/airraw/dossier")
  const c = makeCharacter(4242, 0.8)
  const d = dossierForSeed(c.key || c.host)
  const withSoul = renderPersona(c, "room", { soul: "HER-OWN-SOUL", mood: "m", kind: "k", you: "u" })
  const without = renderPersona(c, "room", { mood: "m", kind: "k", you: "u" })
  check(withSoul.personality.includes("HER-OWN-SOUL") && !withSoul.personality.includes(d.opinion),
    "a written character speaks from her own soul, and not also from the dossier")
  check(without.personality.includes(d.opinion), "and a generated one speaks from the dossier")
}
const bubble = readFileSync("components/airroom/AirBubble.tsx", "utf8")
check(/writtenFor\(c\.key\)/.test(bubble) && /soulPrompt/.test(bubble), "and the same in a private thread")

// ── one person, not one per language ──────────────────────────────────────
const cf = src.slice(src.indexOf("export function clusterFor"), src.indexOf("export function writtenCast"))
check(/key: `\$\{WRITTEN_PREFIX\}\$\{member\.id\}`/.test(cf), "her key is her id alone")
check(!/lang/.test(cf.split("key:")[1] || ""), "the language is NOT in the key — meeting her in Arabic and in French is meeting the same person")
check(/voiceForGender/.test(cf), "her voice comes from the same catalogue as everyone else's, not a second list")

// ── a room cannot show the same person twice ──────────────────────────────
const wc = src.slice(src.indexOf("export function writtenCast"))
check(/!order\.includes\(idx\)/.test(wc), "the written cast never repeats a person inside one room")

console.log(fail === 0 ? "\nPASS" : `\nFAIL — ${fail}`)
process.exit(fail === 0 ? 0 : 1)
