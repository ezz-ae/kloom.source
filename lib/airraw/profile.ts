// ONE PERSON, COMPUTED ONCE.
//
// Everything a character is was already being derived — just in four places that
// never met. The roster knew their name, room and heat. The dossier knew their
// job, their opinion and what was on their mind. The portrait pipeline knew they
// were Lebanese, in their early 20s, with long hair, photographed in a café by a
// window. cast50 knew all of it for the written fifty.
//
// The model was told two of those four. So the face knew more about her than she
// did: Bea could tell you what she thought about jealousy and could not tell you
// what she looked like, how old she was, or where she was standing. Asked, she
// invented an answer — a different one each time, and never the one on the card
// the visitor had just tapped.
//
// That is the difference between a calling card and a profile. This file is the
// profile: ONE clean computation from the identity seed, which every surface
// then forks from — the deck card, the call, her page, the room, a photo she
// sends. Nothing re-derives its own half any more.
//
// TWO RULES, and the bugs that wrote them:
//
//  1. DERIVE, NEVER RE-DERIVE. Callers get parts, not a finished string they
//     have to take apart again. `lookFor` used to recover the person by
//     searching the portrait prompt for "portrait of " and slicing after it;
//     when the template was reordered to put the subject first that substring
//     stopped existing, the search silently returned the WHOLE prompt, and every
//     photo request started carrying "shot on a phone, unretouched, visible
//     pores, slight sensor noise" into whatever scene was asked for.
//
//  2. THE WRITTEN FIFTY OVERRIDE THE POOLS, NEVER MIX WITH THEM. A written
//     character describes her own face in her own words. Layering a pool look on
//     top produces someone with two appearances, which is worse than either.
//
// Reads the existing derivations and changes none of them, so no face cache is
// invalidated by anything here.

import type { Cluster } from "@/lib/airroom/roster"
import { buildPortraitPrompt } from "@/lib/airraw/portrait-prompt"
import { dossierForSeed } from "@/lib/airraw/dossier"

export interface FullProfile {
  /** The identity seed. Face, voice, accent and inner life all key off this. */
  key: string
  name: string
  gender: "female" | "male"
  /** True for the hand-written fifty, whose look is authored rather than pooled. */
  written: boolean

  // ── the body ────────────────────────────────────────────────────────────────
  // Previously known only to the image pipeline.
  /** "" for a written character, whose `look` carries it in prose. */
  ethnicity: string
  /** "in their early 20s". "" for a written character. */
  age: string
  /** "long hair". "" for a written character. */
  hair: string
  /** Their face, one clause — pooled, or the authored line. */
  look: string
  /**
   * The PHOTOGRAPHIC setting, which is not the same as where they are.
   *
   * The STYLE pool mixes real places ("café by a window, soft daylight") with
   * pure camera notes ("snapshot on a phone, soft window light"), so this can be
   * handed to an image model and must never be read as a location — "Where you
   * are right now: snapshot on a phone" is what that mistake produces. The
   * dossier's `where` is the authority on location, and it is the one the deck
   * card already shows, so those two can never disagree.
   */
  place: string

  // ── the inner life ──────────────────────────────────────────────────────────
  work: string
  where: string
  onMind: string
  opinion: string
  peeve: string
  tell: string

  // ── the room they are in ────────────────────────────────────────────────────
  room: string
  vibe: string
}

/**
 * The one computation. Everything else in this file reads its result.
 *
 * `writtenLook` is passed in rather than imported so this stays free of the
 * cast50 table — the caller already knows whether it holds a written character
 * and what her authored appearance is.
 */
export function profileFor(c: Cluster): FullProfile {
  const key = c.key || c.host
  const d = dossierForSeed(key)
  // A written character's appearance is authored; the pools are for the floor.
  const authored = (c.look || "").trim()
  const p = authored ? null : buildPortraitPrompt(key, c.gender)
  return {
    key,
    name: c.host,
    gender: c.gender,
    written: !!authored,
    ethnicity: p?.ethnicity || "",
    age: p?.age || "",
    hair: p?.hair || "",
    look: authored || p?.look || "",
    place: p?.style || "",
    work: d.work,
    where: d.where,
    onMind: d.onMind,
    opinion: d.opinion,
    peeve: d.peeve,
    tell: d.tell,
    room: c.name,
    vibe: c.vibe,
  }
}

/**
 * The person, with no camera in the sentence.
 *
 * This is what a photo request needs: appending a scene to "shot on a phone,
 * unretouched, visible pores" argues with the scene, which is precisely the bug
 * rule 1 above describes. Everything here describes the human.
 */
export function lookLine(p: FullProfile): string {
  if (p.written) return p.look
  return [
    [p.ethnicity, p.gender === "female" ? "woman" : "man", personThird(p.age, p.gender)].filter(Boolean).join(" "),
    p.look,
    p.hair ? `with ${p.hair}` : "",
  ].filter(Boolean).join(", ")
}

/**
 * What she is told about herself, in the second person.
 *
 * Stated as fact, never as instruction — the same reasoning as `dossierLine`.
 * A model told "describe your hair if asked" performs having hair; a model told
 * "your hair is long" simply has it, and mentions it when it is relevant the way
 * a person would.
 *
 * Deliberately does NOT repeat the dossier: this is the BODY, which is the half
 * that was missing. Her job, her evening and where she is stay in dossierLine,
 * and the caller joins the two so neither has to know about the other.
 */
export function selfLine(p: FullProfile): string {
  // The pools are written for a camera — "a handsome man with light stubble",
  // "in their early 20s" — which is third person and reads as a casting note
  // when handed straight to the character. Told "You are Bangladeshi, in their
  // early 20s", a model repeats the grammar back. So the person is switched
  // here, in the one place that speaks TO her, rather than in the pools, which
  // are correct as they are for the job they were written for.
  const body = p.written
    ? `You look like this: ${p.look}.`
    : [
        p.look ? `You're ${p.look}` : "You're",
        [p.ethnicity, personSecond(p.age), p.hair ? `with ${p.hair}` : ""].filter(Boolean).join(", "),
      ].filter(Boolean).join(" — ") + "."
  // No location here on purpose — see the note on `place`. Where she is tonight
  // comes from the dossier, which the card is also drawn from.
  return (
    `${body} ` +
    // The point of telling her at all. Without this she has the facts and no
    // reason to ever use them, which reads exactly like not having them.
    `That is your actual body, not a description you were handed — if they ask what ` +
    `you look like, you already know, and you answer like someone who does.`
  )
}

/**
 * The body in one clause, for surfaces that pay per line.
 *
 * The room generates constantly — fourteen people, every few seconds — and that
 * loop is the one that has already burned real money, so it gets the fact and
 * not the paragraph. Enough that her hair in the room matches her hair on the
 * call, which is the whole point of computing this once.
 */
export function selfShort(p: FullProfile): string {
  if (p.written) return `You look like: ${p.look}.`
  const bits = [p.ethnicity, personSecond(p.age), p.hair].filter(Boolean).join(", ")
  return bits ? `You are ${bits}.` : ""
}

/** What the deck card shows. Same object as the call, so they can never disagree. */
export function cardFor(p: FullProfile): { work: string; where: string } {
  return { work: p.work, where: p.where }
}

/**
 * The pools are written for a camera — "in their early 20s" — which is third
 * person and reads as a casting note when handed to the character herself. Told
 * "You are Bangladeshi, in their early 20s", a model repeats the grammar back.
 * Switched here, in the code that speaks TO her, rather than in the pools, which
 * are correct as they are for the job they were written for.
 */
function personSecond(t: string): string {
  return t.replace(/\btheir\b/g, "your").replace(/\bthey\b/g, "you")
}

/**
 * The same pool text as it should read ABOUT her — on her public page, and in a
 * scene prompt where an image model does better with a definite pronoun than an
 * ambiguous one. "Central Asian woman in their early 30s" is both odd English
 * and a weaker instruction than "in her early 30s".
 *
 * This follows the character's own gender field, which the whole product already
 * keys on for voice casting and the look pools — it is reading the data, not
 * guessing at it.
 */
function personThird(t: string, gender: "female" | "male"): string {
  const poss = gender === "female" ? "her" : "his"
  return t.replace(/\btheir\b/g, poss).replace(/\bthey\b/g, gender === "female" ? "she" : "he")
}
