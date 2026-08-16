// Where a character SOUNDS like they're from — and nothing else.
//
// ────────────────────────────────────────────────────────────────────────────
// ORTHOGONALITY RULE — read before adding anything to this file.
//
// This module maps a persona to SPEECH attributes only: which dialect they
// write, which voice pool they draw from, how the recogniser should expect
// them to talk. It must NEVER carry personality, beliefs, religion,
// conservatism, openness, what they will or won't discuss, or anything else
// that shapes WHO they are.
//
// "Character by accent" is the thing we are deliberately avoiding: an Arab
// character must not come out reserved-and-religious while a European one
// comes out open, purely because of where their voice is from. Accent is a
// sound. Personality is drawn independently in lib/airraw/dossier.ts from a
// pool that has no idea what accent the character has. The two are combined
// only at the very end, in personaFor().
//
// So: no `personality`, no `limits`, no `vibe` field may be added here.
// ────────────────────────────────────────────────────────────────────────────
//
// Keyed off ethnicityForSeed() — the SAME deterministic ethnicity the persona's
// FACE is generated from — so the voice you hear matches the face you see.

import { ethnicityForSeed } from "@/lib/airraw/portrait-prompt"

export interface Accent {
  /** Voice-pool key. Selects ELEVENLABS_VOICES_<KEY>_<GENDER> when curated. */
  key: string
  /** Human label, for logs/debug only. */
  label: string
  /**
   * How this character WRITES Arabic. Empty for non-Arabic-speaking origins:
   * the accent then lives entirely in the voice, never in mangled grammar.
   * Writing "Russian-accented English" as broken English would be a caricature,
   * so we don't — a Slavic character writes ordinary English and the VOICE
   * carries the accent.
   */
  arabicDialect?: string
  /** Dialect words that make the dialect audible instead of merely asserted. */
  arabicMarkers?: string
}

// The regional buckets. Everything not listed falls through to the neutral
// entry, which imposes no dialect and draws from the general voice pool.
const NEUTRAL: Accent = { key: "NEUTRAL", label: "unmarked" }

const EGYPTIAN: Accent = {
  key: "AR_EG", label: "Egyptian",
  arabicDialect: "Egyptian Arabic (Cairene) — the way people actually talk in Cairo",
  arabicMarkers: "إزيك، عامل إيه، دلوقتي، كده، مش، أوي، بص، يلا، عايز، ماشي",
}
const MOROCCAN: Accent = {
  key: "AR_MA", label: "Moroccan",
  arabicDialect: "Moroccan Darija",
  arabicMarkers: "واش، دابا، بزاف، شنو، غادي، ديالي، مزيان، بغيت، دْرْت، صافي",
}
const TUNISIAN: Accent = {
  key: "AR_TN", label: "Tunisian",
  arabicDialect: "Tunisian Derja",
  arabicMarkers: "شنوة، برشا، توا، باهي، ياخي، نحب، فمة، برك، قداش",
}
const LEVANTINE: Accent = {
  key: "AR_LB", label: "Levantine",
  arabicDialect: "Levantine Arabic (Lebanese/Shami)",
  arabicMarkers: "شو، هلق، هيك، كتير، منيح، بدي، ليش، عم، شوي، يعني",
}
const GULF: Accent = {
  key: "AR_GULF", label: "Khaleeji",
  arabicDialect: "Gulf Arabic (Khaleeji)",
  arabicMarkers: "شنو، الحين، زين، وايد، جذي، أبغى، وش، مو، عاد، يبه",
}

// Non-Arabic origins: no text steer at all, only a voice-pool key, so the
// accent is heard and never written as broken grammar.
const voiceOnly = (key: string, label: string): Accent => ({ key, label })

const BY_ETHNICITY: Record<string, Accent> = {
  Egyptian: EGYPTIAN,
  Moroccan: MOROCCAN,
  "North African": TUNISIAN,
  Lebanese: LEVANTINE,
  "Middle Eastern": LEVANTINE,
  "Gulf Arab": GULF,

  "Slavic Eastern European": voiceOnly("EN_RU", "Slavic"),
  Turkish: voiceOnly("EN_TR", "Turkish"),
  Persian: voiceOnly("EN_FA", "Persian"),
  "Mediterranean Italian": voiceOnly("EN_IT", "Italian"),
  Irish: voiceOnly("EN_IE", "Irish"),
  German: voiceOnly("EN_DE", "German"),
  Scandinavian: voiceOnly("EN_SE", "Nordic"),
  Nigerian: voiceOnly("EN_NG", "Nigerian"),
  "West African": voiceOnly("EN_NG", "West African"),
  "Black American": voiceOnly("EN_US_AAVE", "Black American"),
  "Afro-Caribbean": voiceOnly("EN_CARIB", "Caribbean"),
  Indian: voiceOnly("EN_IN", "Indian"),
  "South Asian": voiceOnly("EN_IN", "South Asian"),
  Pakistani: voiceOnly("EN_IN", "Pakistani"),
  Bangladeshi: voiceOnly("EN_IN", "Bangladeshi"),
  "Sri Lankan": voiceOnly("EN_IN", "Sri Lankan"),
  Mexican: voiceOnly("EN_LATAM", "Mexican"),
  Colombian: voiceOnly("EN_LATAM", "Colombian"),
  Brazilian: voiceOnly("EN_BR", "Brazilian"),
  Latino: voiceOnly("EN_LATAM", "Latino"),
  "Afro-Latina": voiceOnly("EN_LATAM", "Afro-Latina"),
  Filipino: voiceOnly("EN_PH", "Filipino"),
  Japanese: voiceOnly("EN_JP", "Japanese"),
  Korean: voiceOnly("EN_KR", "Korean"),
  "Han Chinese": voiceOnly("EN_CN", "Chinese"),
}

/** The accent for a persona, matching the ethnicity their FACE was drawn with. */
export function accentForSeed(seedKey: string): Accent {
  return BY_ETHNICITY[ethnicityForSeed(seedKey || "anon")] || NEUTRAL
}

/**
 * The dialect steer for the Arabic system prompt, or "" when the character has
 * no Arabic-region origin (they then get the existing generic colloquial rule
 * and mirror whatever dialect the user speaks).
 *
 * This is the single biggest lever on "the Arabic voices don't sound Arab":
 * a voice reading Cairene words sounds Egyptian even on a generic voice model,
 * whereas a perfect Egyptian voice reading MSA still sounds like a newsreader.
 */
export function arabicDialectLine(seedKey: string): string {
  const a = accentForSeed(seedKey)
  if (!a.arabicDialect) return ""
  return `\nYou are from this dialect region — speak ${a.arabicDialect}, consistently, every reply. Natural words for you: ${a.arabicMarkers}. This is only HOW you talk. It says nothing about what you believe, what you're willing to talk about, or how open you are — those are entirely your own.`
}
