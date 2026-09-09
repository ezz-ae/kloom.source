// THE CHARACTER REGISTRY — one definition, rendered per surface.
//
// A character used to be assembled by hand at every place they could appear:
// eight `personality:` template literals across five components, each one
// independently deciding how to name the room, whether to reach for the written
// soul or the generated dossier, what texture to ask for, and whether to pass a
// seedKey at all. Changing what a person IS meant remembering eight files, and
// the drift showed: the chess opponent was given no seedKey, so he had no accent
// and no derived voice, and no inner life whatsoever — he was a sentence.
//
// The split this file draws is the only one that matters:
//
//   THE CHARACTER brings identity, inner life, body, voice seed.  Same everywhere.
//   THE SURFACE   brings the situation, the directive, the texture. Differs.
//
// So a new character is data — nothing here changes. A new surface is one entry
// in SURFACES. Neither is a hunt through components.
//
// WHY THIS IS IN-PROCESS AND NOT AN MCP CALL. Everything below is a pure
// function over data the client already holds, on the path between a person
// finishing a sentence and hearing a voice answer. A protocol hop there buys
// nothing — the data is not remote, not shared and cannot fail — and costs a
// round trip on the one path where latency is the product. MCP earns its place
// on the OTHER side of this file: authoring, inspecting, previewing and minting
// characters out of band, over this same registry, so the two can never
// disagree. That server calls in here; this file never calls out.

import type { Cluster } from "@/lib/airroom/roster"
import { faceSeedFor } from "@/lib/airroom/roster"
import { dossierLine } from "@/lib/airraw/dossier"
import { profileFor, selfLine, selfShort } from "@/lib/airraw/profile"

/** Everything /api/chat is told about who is speaking. */
export interface RenderedPersona {
  name: string
  personality: string
  speakingStyle: string
  backstory: string
  language?: string
  seedKey?: string
  speaks?: string[]
  barTalk?: number
}

/** Where a character is appearing. Each one is a row in SURFACES, nothing more. */
export type Surface = "call" | "room" | "group" | "scene" | "game"

export interface RenderCtx {
  /** The written soul, when this is one of the fifty. Passed in so this file
   *  stays free of the cast50 table and its language lookup. */
  soul?: string
  language?: string
  speaks?: string[]
  /** Surface-specific colour: the other people present, the scene role, the mood. */
  others?: string
  role?: string
  mood?: string
  kind?: string
  /** A per-line voice texture the surface picks per character (the room does). */
  texture?: string
  topic?: string
  you?: string
}

interface SurfaceSpec {
  /** Where they are. One clause, in their own words about their own night. */
  situation: (c: Cluster, x: RenderCtx) => string
  /** What this surface needs from the line — length, addressing, what to avoid. */
  directive: (c: Cluster, x: RenderCtx) => string
  texture: (c: Cluster, x: RenderCtx) => string
  /**
   * How much of the body to send.
   *
   *   full  — a call, where being asked what you look like is likely
   *   short — a room line, which is one sentence and runs constantly; the cost
   *           of the paragraph here is the loop that has already burned money
   *   none  — a surface where appearance never comes up
   */
  body: "full" | "short" | "none"
  /**
   * Whether the character's own night applies here.
   *
   * "none" for a surface whose situation contradicts the dossier: the chess
   * opponent is at a board, and telling him "you're in the bath and the water's
   * going cold" in the same breath produces someone who is in two places. He
   * gets the trait below instead — still one definition, still one renderer.
   */
  inner: "dossier" | "none"
  /** Fixed character notes for a surface that supplies its own person. */
  trait?: string
  /** Whether this surface wants the no-filters layer. */
  barTalk?: number
}

const SURFACES: Record<Surface, SurfaceSpec> = {
  call: {
    situation: (c) => `on a late-night adult voice floor — the "${c.name}" room (vibe: ${c.vibe})`,
    directive: () => `You want things and you say so out loud.`,
    texture: () =>
      "raw, intimate voice at 2am — short fragments, direct, natural. get to it fast. " +
      "stretch letters for feeling when it's real: 'yesss', 'noooo'. never formal, never robotic.",
    body: "full",
    inner: "dossier",
    barTalk: 100,
  },
  room: {
    situation: () => `in a busy late-night room on an adult floor — fourteen people, everyone can see everything`,
    directive: (_c, x) =>
      `Right now you are ${x.mood}. This line: ${x.kind}. ` +
      `When you address someone, write their name as @Name (the visitor is @${x.you}). ` +
      `Never narrate the room, never ask "how is everyone", never introduce yourself. You've been here an hour.`,
    // The room picks a per-character texture per line (pickBy(TEXTURE, …)), so it
    // is passed in rather than fixed here — the constraint after it is the part
    // that belongs to the surface.
    texture: (_c, x) => `${x.texture ? `${x.texture}. ` : ""}one line only, under 22 words, no emoji, no stage directions, no quotation marks.`,
    body: "short",
    inner: "dossier",
  },
  group: {
    situation: (c, x) => `in a small late-night group room with ${x.others} and the people who just walked in`,
    directive: (c, x) =>
      `React to the LAST thing said in ONE short spoken sentence. Sometimes to the others, sometimes to a newcomer. ` +
      `Vibe: ${c.vibe}.` +
      (x.topic ? ` Tonight the room keeps circling one thing: "${x.topic}" — drift back to it when the thread goes quiet.` : ""),
    texture: () => "spoken, casual, a little imperfect — like a real voice at 2am",
    body: "short",
    inner: "dossier",
  },
  scene: {
    situation: (_c, x) => (x.role ? `in a scene, and in it you are ${x.role}` : `in a scene`),
    directive: () => `You want things and you say so out loud.`,
    texture: () => "raw, intimate, unhurried — short fragments, direct, natural. never formal, never robotic.",
    body: "short",
    inner: "dossier",
    barTalk: 100,
  },
  game: {
    // The chess opponent. Was a bare sentence with no seedKey and no inner life,
    // which is why he had no accent and sounded like nobody in particular.
    situation: () => `mid-game against the person across the board, in a late-night arena`,
    directive: (_c, x) =>
      x.kind === "banter"
        ? `React to what just happened in ONE short spoken line — trash talk, a dare, a smirk. Never explain chess, never list moves.`
        : `Talk WITH them — banter, smack talk, dares, but you can hold a real conversation too. Keep it to one or two short spoken lines. Never list chess moves.`,
    texture: () => "spoken, cocky, casual, a little dangerous",
    body: "none",
    inner: "none",
    trait: "a sharp, cocky, playful chess hustler",
  },
}

/**
 * The one place a character becomes a prompt.
 *
 * Order is deliberate and matches the portrait template's own lesson: WHO they
 * are first, then where they are, then what the surface needs. A model reads the
 * opening as the brief.
 */
export function renderPersona(c: Cluster, surface: Surface, x: RenderCtx = {}): RenderedPersona {
  const spec = SURFACES[surface]
  const key = c.key || c.host
  const p = profileFor(c)
  // A written character brings her own inner life and voice registers; everyone
  // else gets the generated dossier. Decided ONCE, here, instead of in each of
  // the five components that used to make the same choice separately.
  const inner = spec.inner === "none" ? "" : (x.soul || dossierLine(key))
  const body = spec.body === "full" ? selfLine(p) : spec.body === "short" ? selfShort(p) : ""

  // Optional fields are OMITTED rather than set to undefined. A caller that
  // spreads this over its own object would otherwise have `language: undefined`
  // silently overwrite the language it just set — which is exactly what happened
  // the first time the room was ported onto this.
  const opt = <T,>(v: T | undefined, k: string) => (v === undefined ? {} : { [k]: v })
  return {
    name: c.host,
    personality: [
      `You are ${c.host}, ${[spec.trait, spec.situation(c, x)].filter(Boolean).join(", ")}.`,
      inner,
      spec.directive(c, x),
    ].filter(Boolean).join(" "),
    speakingStyle: spec.texture(c, x),
    backstory: body,
    ...opt(x.language, "language"),
    ...opt(x.speaks, "speaks"),
    // The FACE's seed — archetype + name — never the bare name and never the
    // unique key. Accent is derived from this and the portrait is generated from
    // it, so a character who gets a different one looks one ethnicity and sounds
    // another. Four components used to repeat this line; one of them forgot.
    seedKey: faceSeedFor(c) || c.host,
    ...opt(spec.barTalk, "barTalk"),
  }
}

/**
 * A fixed, named character that is not drawn from the floor — the chess opponent
 * is the only one today.
 *
 * It exists so that surface does not go back to passing a bare string. Kai had
 * no key, so he had no seed; no seed meant no derived accent and no voice of his
 * own, and he was the one character in the product who sounded like nobody. A
 * stable key fixes all three at once, and costs one function.
 */
export function namedCharacter(host: string, archetype: string, gender: "female" | "male"): Cluster {
  return {
    f: 0.5, n: 1, h: "m",
    name: archetype, vibe: archetype,
    archetype, host, gender,
    lines: [],
    // Stable and unique, in the same shape faceSeedFor produces, so his face,
    // his accent and his voice all agree the way everyone else's do.
    key: `${archetype}:${host}`,
  }
}

/** The surfaces a character can appear on. Exported so a test can walk them all. */
export const SURFACE_NAMES = Object.keys(SURFACES) as Surface[]
