// AiR talks — a room that is happening, not a room that exists.
//
// The old rooms were furniture: always there, always the same, nothing lost by
// scrolling past. A talk is the opposite. It has a title you want to be inside,
// a fixed number of seats, and it fills whether or not you join. Arriving late
// to something already underway is the feeling being built here.
//
// DETERMINISTIC, NOT STORED: a talk is derived from a time slot, so every client
// computes the same board with no server and no database. Time is the only input
// that moves, which is also what makes seats fill on their own.
//
// The north star for all of it: the moment someone forgets these are AI. That is
// why seats fill gradually rather than instantly, why you can arrive early or
// late, and why the titles sound like something a person typed.

export interface Talk {
  id: string
  title: string
  seats: number        // total
  taken: number        // filled so far — grows as the slot ages
  startedMinsAgo: number
  heat: "w" | "m" | "f"
  /** Seed for the cast, so the same talk has the same people for everyone. */
  seed: number
}

// Titles are the whole pitch. They work when they sound like a confession
// someone is already halfway through — a claim, a contradiction, or a secret with
// the interesting half withheld. Not topics. Nobody joins "relationships".
const TITLES: Array<[string, "w" | "m" | "f"]> = [
  ["i married two men", "f"],
  ["dirty minded people only", "f"],
  ["sara calls it the entrance. it's the exit.", "m"],
  ["things i've never said out loud", "m"],
  ["i'm the other woman and i'm not sorry", "f"],
  ["we agreed on rules. i broke all of them.", "f"],
  ["nobody here knows my real name", "m"],
  ["tell me the worst thing you've forgiven", "m"],
  ["i still have his key", "m"],
  ["the group chat doesn't know about this", "m"],
  ["i said yes to the wrong person twice", "m"],
  ["what you'd do if nobody found out", "f"],
  ["my ex is in this room. probably.", "m"],
  ["i lied on the first date and kept lying", "m"],
  ["married, bored, honest", "f"],
  ["the thing i want isn't the thing i ask for", "f"],
  ["3am and i'm not sleeping either", "w"],
  ["confession hour. no advice, just tell me.", "m"],
  ["i've been pretending for four years", "m"],
  ["say it here, it stays here", "f"],
  ["i don't want to be fixed tonight", "w"],
  ["everyone lies about how often. go.", "f"],
]

// A new board every 12 minutes: long enough that a talk feels like it has been
// running, short enough that the board is different if you come back after
// making a coffee.
const SLOT_MS = 12 * 60_000

function hash(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

/**
 * The talks on the board right now.
 *
 * `now` is injected rather than read inside, so this is a pure function of time —
 * testable, and identical on the server and the client for the same instant.
 */
export function liveTalks(now: number = Date.now(), count = 4): Talk[] {
  const slot = Math.floor(now / SLOT_MS)
  const out: Talk[] = []
  for (let i = 0; i < count; i++) {
    const h = hash(slot * 31 + i * 7919)
    const [title, heat] = TITLES[h % TITLES.length]
    // 6–20 seats. Small enough that "15 seats left" means something.
    const seats = 6 + (hash(h) % 15)
    // How far along this talk is, 0..1.
    //
    // MUST be monotonic within a slot. An earlier version wrapped with `% 1`, so
    // a talk would fill up and then snap back to empty while you were looking at
    // it — seats un-filling, which reads as broken rather than alive.
    //
    // The per-talk offset staggers when each one "started", so a fresh board
    // still shows some talks already underway and some just opening.
    const startedAt = (h % 100) / 100 * 0.55
    const age = Math.min(0.98, (now % SLOT_MS) / SLOT_MS + startedAt)
    // Never completely full: a board where everything is closed is a dead end.
    const taken = Math.min(seats - 1, Math.floor(seats * age * 0.9))
    out.push({
      id: `t${slot}-${i}`,
      title,
      seats,
      taken,
      startedMinsAgo: Math.floor(age * 18),
      heat,
      seed: h,
    })
  }
  // Distinct titles only — two identical rooms on one board reads as broken.
  const seen = new Set<string>()
  return out.filter((t) => (seen.has(t.title) ? false : (seen.add(t.title), true)))
}

export const seatsLeft = (t: Talk) => Math.max(0, t.seats - t.taken)

/** "just started" / "8 min in" — arriving late should feel like arriving late. */
export function ageLabel(t: Talk): string {
  return t.startedMinsAgo < 2 ? "just started" : `${t.startedMinsAgo} min in`
}

/** Heat → where the talk sits on the roster's soft→wild gradient. */
export const heatF = (h: Talk["heat"]) => (h === "w" ? 0.3 : h === "m" ? 0.6 : 0.9)

export interface TalkRoom {
  seed: number
  f: number
  count: number
  title: string
  heat: Talk["heat"]
}

/**
 * The room a talk opens into.
 *
 * ONE definition, shared by the board (which shows small faces of who is in
 * there) and by the room itself. This used to be computed in two places — the
 * board in Talks.tsx and the handoff in Planet.tsx — which meant the faces on
 * the card and the people who turned up could disagree. For a product whose
 * north star is "he forgot they are AI", a room that opens on a different crowd
 * than the one advertised is the single most expensive kind of bug.
 */
export function talkRoom(t: Talk): TalkRoom {
  return {
    seed: t.seed,
    f: heatF(t.heat),
    count: Math.min(12, Math.max(2, seatsLeft(t))),
    title: t.title,
    heat: t.heat,
  }
}
