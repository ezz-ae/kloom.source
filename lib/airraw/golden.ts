// THE GOLDEN ROOM — the one you rent, not the one you enter.
//
// Every other surface here is a place you go. This is a place you take someone
// TO. You are already talking to Sami; you convert that conversation into a
// golden room and Sami comes with you — same person, same voice, same face, mid
// sentence. That constraint is the whole product and it is enforced in code
// below, because the failure it prevents is the one that would make the feature
// worthless: paying eleven dollars and arriving with a stranger.
//
// WHY A SESSION HAS A LENGTH. The brief was "$11 no matter how long the call".
// Flat pricing with unbounded duration is exactly the shape of the pass — nine
// dollars for six thousand voice minutes — which is roughly four hundred
// dollars of speech sold for nine, surviving only because nobody redeemed it. A
// golden room runs the best voice engine there is, so an unbounded one is a bill
// with no ceiling on an eleven dollar sale. So it is eleven dollars for a
// SESSION, and the session has a stated length that the buyer sees before they
// pay, not a meter that surprises them. Flat, honest, and finite.
//
// Dependency-free: the price list is read by the browser, the checkout and the
// tests, and a number that lives in three places drifts in three directions.

/** What a golden session costs, once, however it is used. */
export const GOLDEN_USD = Math.max(1, Number(process.env.GOLDEN_USD || 11))

/**
 * How long a session runs, in minutes.
 *
 * Ninety minutes is longer than almost any call anyone actually has, so in
 * practice this reads as "as long as you like" while still being a real bound.
 * At the premium engine's rate the worst case sits comfortably under the sale.
 */
export const GOLDEN_MINUTES = Math.max(10, Number(process.env.GOLDEN_MINUTES || 90))

/** How many sessions may be held at once. The brief's one-to-ten. */
export const GOLDEN_MAX_BOOKED = Math.min(20, Math.max(1, Number(process.env.GOLDEN_MAX_BOOKED || 10)))

/** Roughly what ninety minutes of the best engine costs us, for sanity. */
export const GOLDEN_COST_USD = 0.063 * GOLDEN_MINUTES * 0.5   // she speaks ~half the time

export interface GoldenGame {
  id: string
  name: string
  /** What the player does. Shown on the card. */
  blurb: string
  /** Appended to her prompt when the game is running. Never replaces who she is. */
  play: string
}

/**
 * Four games, and they are conversation games rather than screens.
 *
 * Anything with its own board would be a different product wearing her face —
 * and worse, it would take the voice off the critical path, which is the only
 * thing anyone is paying for. Each of these is a shape for the talking, so the
 * room stays a conversation the whole time.
 */
export const GOLDEN_GAMES: GoldenGame[] = [
  {
    id: "truth",
    name: "two truths",
    blurb: "three things about tonight. one of them is a lie.",
    play: "Play 'two truths and a lie': tell them three short things about your evening, exactly one of which is false. Do not reveal which until they guess. If they guess right, admit it and tell them the real version.",
  },
  {
    id: "dare",
    name: "the dare ladder",
    blurb: "you take turns. it escalates. either of you can stop it.",
    play: "Play a turn-taking dare game. Start small and escalate slowly, alternating who dares whom. Keep every dare something that can be done or described in conversation. If they decline a dare, accept it lightly and take the next turn yourself.",
  },
  {
    id: "story",
    name: "one line each",
    blurb: "a story, built a sentence at a time, that neither of you controls.",
    play: "Build a story together one sentence at a time. Write exactly one sentence per turn, continuing theirs directly, and never write their sentence for them. Let the story go where their line takes it, even when it is not where you were going.",
  },
  {
    id: "guess",
    name: "what am I thinking",
    blurb: "something is picked. twenty questions, and a hint if you beg.",
    play: "Think of one specific thing and hold it fixed. Answer only yes, no, or 'close' to their questions. Give a real hint if they ask for one, and tell them the answer after about twenty questions whether or not they got it.",
  },
]

export function goldenGame(id?: string | null): GoldenGame | null {
  return GOLDEN_GAMES.find((g) => g.id === id) || null
}

// ── who is in the room ───────────────────────────────────────────────────────

/**
 * The identity that must survive the conversion.
 *
 * `key` is the whole point: it is the seed the face, the voice and the inner
 * life all derive from. Carry it and Sami stays Sami. Drop it and the room
 * regenerates someone — which is the single failure that would make this not
 * worth eleven dollars, and the one thing the brief asked for by name.
 */
export interface GoldenGuest {
  key: string
  host: string
  gender: "female" | "male"
}

/** True only if this is the same person the conversation started with. */
export function sameGuest(a?: GoldenGuest | null, b?: GoldenGuest | null): boolean {
  return !!a && !!b && !!a.key && a.key === b.key
}

export interface GoldenSession {
  id: string
  /** Who it is with. Fixed at conversion and never re-derived. */
  guest: GoldenGuest
  /** ms epoch this session's clock started, or 0 while it is still unopened. */
  startedAt: number
  /** The purchase this session was paid for by. */
  boughtWith: string
  game?: string
}

/** ms remaining, or 0. An unopened session has its full length ahead of it. */
export function goldenLeftMs(s: GoldenSession | null | undefined, now = Date.now()): number {
  if (!s) return 0
  if (!s.startedAt) return GOLDEN_MINUTES * 60_000
  return Math.max(0, s.startedAt + GOLDEN_MINUTES * 60_000 - now)
}

export function goldenLabel(ms: number): string {
  const m = Math.ceil(ms / 60_000)
  if (m <= 0) return "finished"
  if (m === 1) return "1 minute left"
  if (m < 60) return `${m} minutes left`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m left`
}
