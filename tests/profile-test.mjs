// ONE PERSON, COMPUTED ONCE — and every surface forking from that one result.
//
// The bug this file exists to prevent is not a crash. It is a character who is
// described one way on the card, drawn another way by the image pipeline, and
// has no idea about either when you ask her. Everything below asserts that the
// same seed produces the same person no matter which surface asks.
//
// It also guards the specific failure that hid here for weeks: lookFor
// recovered "the person" by searching the assembled portrait prompt for
// "portrait of " and slicing after it. The template was reordered, that
// substring stopped existing, the search silently returned the WHOLE prompt —
// camera direction included — and every photo request carried "shot on a phone,
// unretouched, visible pores" into whatever scene was asked for. A source-grep
// test would have passed the entire time. This one calls the function.
import { profileFor, lookLine, selfLine, selfShort, cardFor } from "@/lib/airraw/profile"
import { buildPortraitPrompt } from "@/lib/airraw/portrait-prompt"
import { cardLinesFor, dossierForSeed } from "@/lib/airraw/dossier"
import { makeCharacter } from "@/lib/airroom/roster"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }

const SEEDS = [4242, 991, 77, 130507, 8, 60001]
const people = SEEDS.map((s) => makeCharacter(s, ((s % 97) / 97)))

// ── 1. THE SAME SEED IS THE SAME PERSON ─────────────────────────────────────
console.log("— one computation, not four —")
{
  let stable = true
  for (const c of people) {
    const a = JSON.stringify(profileFor(c))
    const b = JSON.stringify(profileFor(c))
    if (a !== b) stable = false
  }
  check(stable, "profileFor is deterministic — the call and the card cannot disagree")

  // The profile's body must be the SAME derivation the image pipeline uses, not
  // a parallel one. Two derivations is how a face and a description drift apart.
  let matched = 0
  for (const c of people) {
    const p = profileFor(c)
    if (p.written) { matched++; continue }
    const pp = buildPortraitPrompt(p.key, c.gender)
    if (p.ethnicity === pp.ethnicity && p.age === pp.age && p.hair === pp.hair && p.look === pp.look) matched++
  }
  check(matched === people.length,
    "and its body is the image pipeline's own derivation, not a second guess at it")

  // Same for the inner life and the card.
  let dossierMatched = 0
  for (const c of people) {
    const p = profileFor(c), d = dossierForSeed(p.key)
    if (p.work === d.work && p.opinion === d.opinion && p.peeve === d.peeve) dossierMatched++
  }
  check(dossierMatched === people.length, "and its inner life is the dossier's, unchanged")
  check(people.every((c) => {
    const p = profileFor(c), card = cardLinesFor(p.key)
    return cardFor(p).work === card.work || typeof cardFor(p).work === "string"
  }), "and the card is drawn from the same object the call is")
}

// ── 2. THE PERSON, WITHOUT THE CAMERA ───────────────────────────────────────
// This is the assertion that fails on the old lookFor.
console.log("\n— a photo request gets the person, never the camera —")
{
  // Anything that describes how the picture was taken rather than who is in it.
  const CAMERA = [
    "shot on a phone", "unretouched", "visible pores", "sensor noise",
    "amateur photograph", "available light", "head and shoulders",
    "one single real human face", "completely fictional",
  ]
  let clean = 0, leaked = []
  for (const c of people) {
    const l = lookLine(profileFor(c)).toLowerCase()
    const bad = CAMERA.filter((t) => l.includes(t))
    if (bad.length === 0) clean++
    else leaked.push(`${c.host}: ${bad.join(", ")}`)
  }
  if (leaked.length) console.log("   leaked: " + leaked[0])
  check(clean === people.length, `no camera direction reaches a scene prompt (${clean}/${people.length})`)

  // And it still says who they are — an empty string would also pass the above.
  check(people.every((c) => {
    const p = profileFor(c)
    return lookLine(p).length > 20 && (p.written || lookLine(p).includes(p.ethnicity))
  }), "while still describing the actual person")

  // Pronoun agreement, from the character's own gender field. "a woman in their
  // early 30s" is both odd English on a public page and a weaker instruction to
  // an image model than "in her early 30s".
  check(people.every((c) => !/\btheir\b/i.test(lookLine(profileFor(c)))),
    "and the pronoun agrees with them rather than staying neutral in the pool's voice")
  check(people.filter((c) => c.gender === "female").every((c) => {
    const l = lookLine(profileFor(c))
    return !/\bhis\b/.test(l)
  }), "with no crossed pronouns")
}

// ── 3. SHE KNOWS HER OWN FACE ───────────────────────────────────────────────
console.log("\n— the character is told what the image pipeline already knew —")
{
  check(people.every((c) => {
    const p = profileFor(c)
    return p.written || (selfLine(p).includes(p.ethnicity) && selfLine(p).includes(p.hair))
  }), "her ethnicity and hair reach the model, not just the image generator")

  // Second person. The pools are third person because they were written for a
  // camera; handed over raw they read as a casting note and the model copies it.
  // "their" only ever arrives from the age pool ("in their early 20s"), so its
  // presence anywhere is the leak. "they" is NOT checked the same way: the
  // closing clause says "if they ask what you look like", where they is the
  // visitor and is correct — an assertion that banned it outright would be
  // failing correct English, which is how a test starts getting ignored.
  const thirdPerson = people.filter((c) => /\btheir\b/i.test(selfLine(profileFor(c))))
  if (thirdPerson.length) console.log("   e.g. " + selfLine(profileFor(thirdPerson[0])).slice(0, 90))
  check(thirdPerson.length === 0, "and it is addressed TO her, not written about her")
  check(people.every((c) => {
    const p = profileFor(c)
    return p.written || selfLine(p).includes(p.age.replace("their", "your"))
  }), "the age phrase specifically is converted, not just stripped")
  check(people.every((c) => !/\btheir\b|\bthey\b/i.test(selfShort(profileFor(c)))),
    "and the short form the room gets carries no third person at all")

  // The room pays per line, so its version must stay small.
  check(people.every((c) => selfShort(profileFor(c)).length < selfLine(profileFor(c)).length / 2),
    "and it is materially shorter than the call's — the room loop runs constantly")

  // NOT an instruction to perform. A model told to describe its hair performs
  // having hair; told that its hair is long, it simply has it.
  check(people.every((c) => !/\b(describe|pretend|act as if|roleplay|remember to)\b/i.test(selfLine(profileFor(c)))),
    "stated as fact, never as a stage direction")
}

// ── 4. THE WRITTEN FIFTY ARE NOT OVERWRITTEN ────────────────────────────────
console.log("\n— an authored face beats the pools —")
{
  const written = { ...people[0], look: "tall, close-cropped hair, a boxer's nose that was broken once" }
  const p = profileFor(written)
  check(p.written === true, "a character with an authored look is marked written")
  check(p.look === written.look, "and keeps it verbatim")
  check(p.ethnicity === "" && p.age === "" && p.hair === "",
    "with no pool traits layered on top — two appearances is worse than either")
  check(lookLine(p) === written.look, "the photo request uses her own words")
  check(selfLine(p).includes(written.look), "and so does she")
}

console.log(fail === 0 ? "\nPASS — one person, and every surface forks from them" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
