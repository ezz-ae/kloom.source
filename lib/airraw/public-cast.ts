// THE PUBLIC CAST — the part of the floor that search engines and X can see.
//
// WHY THIS EXISTS: airraw.com shipped with FOUR indexable URLs. The room behind
// them holds thousands of distinct people, and not one of them had a page. That
// is the whole SEO surface of the product missing, and it is also why there was
// nothing to post: a link to the front door is a link to a door, while a link to
// a person is a link to a person.
//
// ── THE TWO RULES THIS FILE EXISTS TO KEEP ───────────────────────────────────
//
// 1. NO GENERATION COST. A public page is something a crawler hits thousands of
//    times, and portraits are a paid API. Nothing here asks for one. The share
//    card is drawn from the character's own colours at request time (see
//    opengraph-image), which costs nothing and cannot be rate-limited away.
//
// 2. NOT THIN. Mass-produced pages that differ by a swapped name are the single
//    fastest way to get a domain demoted, and 2,980 of them would be a penalty
//    rather than an asset. Every page here is built from the dossier — the job,
//    the room they're in tonight, the thing on their mind, the opinion they'll
//    argue, what annoys them, how they talk — which is ~16.5M distinct
//    combinations before name, voice or archetype are considered. Two pages
//    sharing a sentence is possible; two pages reading the same is not.
//
// The cast is a BOUNDED, ORDERED list rather than the whole space, because a
// sitemap is a promise to crawl and an unbounded one is a promise nobody keeps.

import { makeCharacter, type Cluster } from "@/lib/airroom/roster"
import { dossierForSeed, cardLinesFor } from "@/lib/airraw/dossier"

/**
 * How many people get a page. Bounded on purpose (see header) and tunable
 * without a code change, so the surface can grow as fast as it actually gets
 * crawled rather than all at once.
 */
export const PUBLIC_CAST_SIZE = Math.max(1, Math.min(5000, Number(process.env.AIRRAW_PUBLIC_CAST || 600)))

/**
 * Index → person, deterministically.
 *
 * The index IS the identity here: it goes in the URL, so this mapping is a
 * permanent contract. Changing the seed or f formula renames every page on the
 * site and throws away whatever ranking they had, so treat it as frozen.
 *
 * The seed is spread by a large odd multiplier and f walks the full 0..1
 * gradient on a coprime stride, so consecutive indexes are different people from
 * different parts of the floor rather than a run of near-identical neighbours.
 */
export function publicCharacter(i: number): Cluster {
  const n = i >>> 0
  const seed = (n * 2654435761 + 1013904223) >>> 0
  const f = ((n * 37) % 100) / 100
  return makeCharacter(seed, f)
}

/** A URL-safe fragment: lowercase, words joined by hyphens, nothing else. */
function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

/**
 * The page's URL fragment: name, what they do, and the index.
 *
 * The index is LAST and is what the route actually reads, so the descriptive
 * middle can be rewritten later (better copy, a renamed job) without breaking a
 * single existing link — the tail is the identity and the rest is for humans and
 * for the words in the URL.
 */
export function slugFor(i: number): string {
  const c = publicCharacter(i)
  const { work } = cardLinesFor(c.key)
  const job = slugify(work.split("·")[0] || work).split("-").slice(0, 4).join("-")
  return [slugify(c.host), job, (i >>> 0).toString(36)].filter(Boolean).join("-")
}

/**
 * Slug → index, or null. Reads ONLY the trailing base-36 segment, so a stale or
 * hand-edited descriptive middle still resolves instead of 404ing. Out-of-range
 * indexes return null rather than a person, so the cast size is a real bound and
 * not a suggestion.
 */
export function indexForSlug(slug: string): number | null {
  const tail = String(slug || "").split("-").pop() || ""
  if (!/^[0-9a-z]+$/.test(tail)) return null
  const i = parseInt(tail, 36)
  if (!Number.isFinite(i) || i < 0 || i >= PUBLIC_CAST_SIZE) return null
  return i
}

// ── HER OWN WORDS ────────────────────────────────────────────────────────────
//
// The dossier is written in the second person because it is prompt text: "you do
// night shifts and you're wired when you get off". A public page needs the same
// facts in a voice a reader can hear.
//
// FIRST person, not third, and the reason is grammar rather than taste. English
// conjugates first and second person IDENTICALLY for every verb except "to be" —
// "you do" → "I do", "you cut" → "I cut" — so this transformation is total and
// safe. Going to third person would need real conjugation ("she does", "she
// cuts", "she flies") and would produce broken sentences on the pools it didn't
// anticipate, which on an indexed page is worse than no page.
//
// Every replacement below is verified against every entry of every pool by
// tests/who-test.mjs, which walks the whole cast and fails on any leftover
// second-person pronoun. It is exhaustive rather than representative.
const FIRST_PERSON: Array<[RegExp, string]> = [
  // "neither of you" is not a pronoun swap, it is a different phrase: alone, the
  // speaker and the person they are talking about become "us". Runs first
  // because every later rule would turn it into nonsense.
  [/\bneither of you\b/gi, "neither of us"],

  // Contractions and "to be" — the only irregular conjugations in English, and
  // the reason first person is safe where third person would not be. These also
  // have to precede the bare-pronoun rules so "your"/"yourself" are consumed
  // before anything can match the "you" inside them.
  [/\byou're\b/gi, "I'm"],
  [/\byou've\b/gi, "I've"],
  [/\byou'll\b/gi, "I'll"],
  [/\byou'd\b/gi, "I'd"],
  [/\byou are\b/gi, "I am"],
  [/\byou were\b/gi, "I was"],
  [/\byourself\b/gi, "myself"],
  [/\byours\b/gi, "mine"],
  [/\byour\b/gi, "my"],

  // OBJECT POSITION → "me". Everything else in the sentence is the subject.
  //
  // The list is prepositions plus a few named verbs, and the split is not
  // arbitrary. A preposition's complement is ALWAYS object case, so "behind you"
  // and "lies to you" are safe to convert on sight. A verb is not safe in
  // general — "I know you think X" has a subject "you" directly after a verb —
  // so only the transitive verbs that actually occur in the pools are listed,
  // and tests/who-test.mjs pins each of them.
  //
  // "than" and "of" are DELIBERATELY ABSENT despite being prepositions. Both
  // take a clause as often as an object in this copy: "more than you admit" and
  // "colder than you expected" are subjects, and converting them produced "more
  // than me admit". "of" is excluded because its one occurrence is the
  // "neither of you" handled above.
  [/\b(on|to|behind|with|at|about|for|from|by|off|into|onto)\s+you\b/gi, "$1 me"],
  [/\b(shocks|texted|made|make|makes)\s+you\b/gi, "$1 me"],

  // Everything left standing is the subject.
  [/\byou\b/gi, "I"],
]

/** Rewrite one dossier fact as the character saying it. */
export function inHerWords(s: string): string {
  let out = String(s || "")
  for (const [re, to] of FIRST_PERSON) out = out.replace(re, to)
  return out
}

/** Capitalise a sentence without touching the rest of it. */
export function sentence(s: string): string {
  const t = String(s || "").trim()
  return t ? t[0].toUpperCase() + t.slice(1) : t
}

export interface PublicProfile {
  i: number
  slug: string
  c: Cluster
  /** Display name — the person, not the cluster. */
  name: string
  /** Third-person-safe fragments straight from the card pools. */
  work: string
  where: string
  /** The dossier, in her voice. */
  says: { work: string; where: string; onMind: string; opinion: string; peeve: string; tell: string }
  /** Her opening lines, as written on the floor. */
  lines: string[]
  pronoun: "she" | "he"
}

/** Everything a page needs about one person, with no network call anywhere. */
export function publicProfile(i: number): PublicProfile {
  const c = publicCharacter(i)
  const d = dossierForSeed(c.key)
  const card = cardLinesFor(c.key)
  return {
    i,
    slug: slugFor(i),
    c,
    name: sentence(c.host),
    work: card.work,
    where: card.where,
    says: {
      work: sentence(inHerWords(d.work)),
      where: sentence(inHerWords(d.where)),
      onMind: sentence(inHerWords(d.onMind)),
      opinion: sentence(inHerWords(d.opinion)),
      peeve: sentence(inHerWords(d.peeve)),
      tell: sentence(inHerWords(d.tell)),
    },
    lines: c.lines || [],
    pronoun: c.gender === "male" ? "he" : "she",
  }
}

/** The whole public cast, in order. Cheap: pure functions, no I/O. */
export function publicCast(limit = PUBLIC_CAST_SIZE): PublicProfile[] {
  const n = Math.max(0, Math.min(PUBLIC_CAST_SIZE, limit))
  return Array.from({ length: n }, (_, i) => publicProfile(i))
}

/**
 * A few other people to link to from a page.
 *
 * Internal links are how a crawler reaches page 600 without a human ever linking
 * to it, so every page points at others. The offsets are coprime-ish strides
 * rather than i+1 so the link graph is a web instead of a chain — a chain is one
 * broken page away from orphaning everything after it.
 */
export function neighbours(i: number, n = 6): PublicProfile[] {
  const out: PublicProfile[] = []
  const strides = [7, 31, 73, 149, 211, 307, 401, 503]
  for (let k = 0; out.length < n && k < strides.length; k++) {
    const j = (i + strides[k]) % PUBLIC_CAST_SIZE
    if (j !== i && !out.some((p) => p.i === j)) out.push(publicProfile(j))
  }
  return out
}

/**
 * The accent colour for a person, from their heat band.
 *
 * Same three values the private thread uses (components/airroom/AirBubble), so
 * a face carries one colour from the share card through the page and into the
 * conversation. Duplicated as a constant rather than imported because that
 * module is a client component and these pages render on the server.
 */
export const HEAT_COLOR: Record<string, string> = { w: "#c084fc", m: "#f472b6", f: "#fb7185" }

export function accentFor(c: Cluster): string {
  return HEAT_COLOR[c.h] || HEAT_COLOR.m
}
