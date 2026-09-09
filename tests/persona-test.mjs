// ONE DEFINITION, RENDERED PER SURFACE.
//
// A character used to be assembled by hand wherever they could appear — eight
// template literals across five components, each deciding independently what a
// person is made of. The drift that produced is the thing to guard: the chess
// opponent was built without a seedKey, so he had no derived accent and no voice
// of his own, and nobody noticed because nothing compared the surfaces.
//
// So these assertions are mostly "every surface, without exception". A rule that
// holds for four out of five is how the fifth got broken in the first place.
import { renderPersona, namedCharacter, SURFACE_NAMES } from "@/lib/airraw/persona"
import { makeCharacter, faceSeedFor } from "@/lib/airroom/roster"
import { dossierForSeed } from "@/lib/airraw/dossier"

let fail = 0
const check = (c, l) => { console.log(`${c ? "ok  " : "FAIL"} ${l}`); if (!c) fail++ }

const people = [4242, 991, 77, 130507].map((s) => makeCharacter(s, (s % 97) / 97))
const CTX = { mood: "warming up", kind: "a reply", you: "Ezz", texture: "low", others: "Mara", role: "the watcher", topic: "regret" }
const every = (fn) => people.every((c) => SURFACE_NAMES.every((s) => fn(renderPersona(c, s, CTX), c, s)))
const failing = (fn) => {
  for (const c of people) for (const s of SURFACE_NAMES) if (!fn(renderPersona(c, s, CTX), c, s)) return `${c.host}/${s}`
  return null
}

console.log("— every surface, without exception —")
check(every((p, c) => p.name === c.host), "the persona is named for the character")
check(every((p, c) => p.personality.startsWith(`You are ${c.host},`)), "and says who they are first")
check(every((p) => typeof p.speakingStyle === "string" && p.speakingStyle.length > 10), "every surface asks for a texture")

// THE CHESS BUG. seedKey drives the accent AND the portrait; a surface that
// forgets it produces someone who sounds like nobody.
{
  const bad = failing((p) => !!p.seedKey)
  if (bad) console.log(`   missing on: ${bad}`)
  check(!bad, "every surface passes a seedKey — no character is left without a voice")
  check(every((p, c) => p.seedKey === (faceSeedFor(c) || c.host)),
    "and it is the FACE's seed, so the accent and the portrait can never disagree")
}

console.log("\n— the body is sent in proportion to what the surface costs —")
{
  const bodyOf = (c, s) => renderPersona(c, s, CTX).backstory || ""
  check(people.every((c) => bodyOf(c, "call").length > bodyOf(c, "room").length),
    "a call gets the full body; a room line gets the short form")
  check(people.every((c) => bodyOf(c, "room").length > 0), "the room still gets one, so her hair matches across surfaces")
  check(people.every((c) => bodyOf(c, "game") === ""), "a surface where appearance never comes up gets none")
}

console.log("\n— the inner life —")
{
  check(people.every((c) => {
    const d = dossierForSeed(c.key || c.host)
    return renderPersona(c, "call", CTX).personality.includes(d.opinion)
  }), "a generated character brings the dossier")
  check(people.every((c) => {
    const soul = "SOUL-MARKER-UNIQUE"
    const p = renderPersona(c, "call", { ...CTX, soul })
    const d = dossierForSeed(c.key || c.host)
    return p.personality.includes(soul) && !p.personality.includes(d.opinion)
  }), "a written soul REPLACES it rather than stacking two inner lives")
  // The chess opponent is mid-game; "you're in the bath and the water's going
  // cold" in the same breath puts him in two places at once.
  check(people.every((c) => {
    const d = dossierForSeed(c.key || c.host)
    return !renderPersona(c, "game", CTX).personality.includes(d.onMind)
  }), "and a surface whose situation contradicts it opts out instead of contradicting itself")
}

console.log("\n— optional fields are omitted, never undefined —")
{
  // A caller spreading this over its own object had `language: undefined`
  // silently overwrite the language it had just set. Real, and caught late.
  const p = renderPersona(people[0], "room", { mood: "x", kind: "y", you: "z" })
  check(!("language" in p), "an unset language is absent, so a spread cannot clobber the caller's")
  check(!("barTalk" in p), "and so is an unset barTalk")
  const q = renderPersona(people[0], "call", { language: "Arabic", speaks: ["Arabic", "English"] })
  check(q.language === "Arabic" && q.speaks.length === 2, "while a set one comes through intact")
  check(q.barTalk === 100, "and a surface that declares barTalk still sends it")
}

console.log("\n— a fixed named character is minted the same way as everyone else —")
{
  const kai = namedCharacter("Kai", "chess", "male")
  const p = renderPersona(kai, "game", { kind: "banter" })
  check(kai.key === "chess:Kai", "it gets a stable unique key")
  check(p.seedKey === faceSeedFor(kai), "which resolves to a real face seed, like every other character")
  check(p.personality.includes("Kai") && /hustler/.test(p.personality),
    "and keeps the character the surface was written for")
}

console.log("\n— adding a character changes nothing here —")
check(people.every((c) => SURFACE_NAMES.every((s) =>
  JSON.stringify(renderPersona(c, s, CTX)) === JSON.stringify(renderPersona(c, s, CTX)))),
  "and is deterministic, so two surfaces can never show two different people")

console.log(fail === 0 ? "\nPASS — one definition, five surfaces, no drift" : `\nFAIL — ${fail}`)
process.exit(fail ? 1 : 0)
