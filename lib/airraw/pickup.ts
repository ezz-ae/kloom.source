// Picking a conversation back up.
//
// Memory already restores the transcript when you reopen a thread — but she
// never says anything. The old lines sit there and you have to start again,
// which is the one thing a person who remembered you would not do. This is the
// difference between storage and being remembered, and it is the single
// strongest reason anyone comes back to a companion product.
//
// THE LINE HAS TO BE TRUE. A model asked to "refer to something specific" will
// invent one when there is nothing to refer to, and a character who confidently
// recalls a conversation you never had is worse than one who says nothing — on
// this product especially, where the whole proposition is that someone was
// actually listening. So the instruction gives her an explicit way out, and a
// reply that takes it is dropped rather than shown. Saying nothing is a correct
// answer here; making something up never is.
//
// Dependency-free so the browser, the prompt and the tests all read one copy.

/** The token she returns when there is nothing concrete to pick up. */
export const NOTHING = "__none__"

/**
 * How long a gap has to be before picking up is natural.
 *
 * Reopening a thread two minutes after closing it is not a return, and "so,
 * about earlier" would be strange. Twenty-five minutes is roughly the point
 * where a conversation reads as having been left rather than paused.
 */
export const MIN_GAP_MS = 25 * 60_000

export function shouldPickUp(lastAt: number, now = Date.now()): boolean {
  if (!lastAt || !Number.isFinite(lastAt)) return false
  const gap = now - lastAt
  // A clock that has gone backwards (timezone change, a device with a bad clock)
  // must not read as a huge gap in the other direction.
  return gap >= MIN_GAP_MS
}

/**
 * The gap in the words a person would use. Deliberately vague at the edges: "a
 * few hours" is how someone actually remembers, and a character announcing
 * "it has been 4 hours and 12 minutes" is a machine.
 */
export function gapLabel(lastAt: number, now = Date.now()): string {
  const m = Math.max(0, Math.floor((now - lastAt) / 60_000))
  if (m < 90) return "a little while ago"
  const h = Math.floor(m / 60)
  if (h < 6) return "a few hours ago"
  if (h < 20) return "earlier today"
  const d = Math.floor(h / 24)
  if (d <= 1) return "yesterday"
  if (d < 7) return `${d} days ago`
  if (d < 14) return "last week"
  if (d < 60) return `${Math.floor(d / 7)} weeks ago`
  return "a long time ago"
}

// ── is there anything to pick up? ────────────────────────────────────────────
// This is the guard that actually works, and it was added because the prompt
// alone measurably did not. Asked to refer to something specific after a
// transcript reading "hey / hi / what's up / nm u", the live model answered
// "still editing your sentences?" — a confident, specific-sounding memory of a
// conversation that never happened. No output filter catches that, because it is
// indistinguishable from a real one except by reading the transcript.
//
// Tightening the instruction did suppress it, but it also flattened the good
// case: the same wording that produced "so did you call him?" started producing
// "no literally. do it." So the judgement moves here, where it is deterministic,
// and the prompt goes back to being about quality. If there is nothing concrete,
// she is never asked in the first place.

/** Acknowledgements that carry no content, however many of them there are. */
const FILLER = /^(?:h[ei]y?|hello|yo|sup|ok(?:ay)?|k|yes|yeah|ya|no|nope|nm|nvm|lol|haha|hmm+|mm+|u|you|thanks|ty|np|sure|cool|nice|wow|same|idk|wyd|hbu|nm u|good|fine|great)[\s.!?,]*$/i

export interface PickupMsg { who: "host" | "you"; text: string }

/**
 * Enough of THEIR OWN words to have said something worth remembering.
 *
 * Only the visitor's lines count. The character's side is generated and is
 * always fluent and always specific-sounding, so counting it would pass every
 * transcript ever written — including the ones where the person said nothing.
 */
export function worthPickingUp(msgs: PickupMsg[]): boolean {
  const mine = (msgs || [])
    .filter((m) => m?.who === "you" && typeof m.text === "string")
    .map((m) => m.text.trim())
    .filter((t) => t.length > 2 && !FILLER.test(t))
  if (!mine.length) return false
  const chars = mine.reduce((n, t) => n + t.length, 0)
  // Either a real exchange, or one line long enough to have carried something.
  return (mine.length >= 2 && chars >= 80) || chars >= 60
}

/**
 * What she is asked to do on reopening.
 *
 * One line, in her own voice, about something that was actually said. The escape
 * hatch is stated twice and plainly, because a single soft "if you can't, don't"
 * is exactly the instruction a model rounds away in favour of producing
 * something. It also forbids the greeting-shaped non-answer — "hey, missed you"
 * is not a memory, and shipping that as one would teach people the feature is
 * hollow within two visits.
 */
export function pickupInstruction(gap: string): string {
  return [
    `You are picking up a conversation you last had ${gap}.`,
    `Say ONE short line — under 20 words — that refers to something specific and concrete the two of you actually said.`,
    `Not a greeting. Not "I missed you". Not "how have you been". Something only someone who was there could say.`,
    `If there is nothing concrete in what was said — small talk, or barely anything — reply with exactly ${NOTHING} and nothing else.`,
    `Do not invent a detail that is not in the conversation above. If you are unsure, ${NOTHING}.`,
  ].join(" ")
}

/**
 * Clean up what came back, or reject it.
 *
 * Rejects the escape token, empty answers, anything long enough to be a speech
 * rather than an opening, and the generic greetings the instruction ruled out —
 * because "hey, missed you" is what a model falls back to when it has nothing,
 * and letting it through would make the feature a liar in the most quietly
 * damaging way: by looking like it worked.
 */
const GENERIC = /^(?:hey|hi|hello|yo|so)?[\s,.!—-]*(?:you'?re back|welcome back|i missed you|missed you|long time|how (?:have you been|are you|'?ve you been)|it'?s been a while|good to (?:see|hear from) you)\b/i

export function cleanPickup(raw: string): string | null {
  const text = (raw || "").replace(/\s+/g, " ").trim().replace(/^["“']|["”']$/g, "")
  if (!text) return null
  const low = text.toLowerCase()
  // The token comes back stripped of its underscores surprisingly often — the
  // route's own sentence processing does it — so the bare word counts too. A
  // real opening line is never the single word "none".
  if (low.includes(NOTHING) || /^none[\s.!?]*$/.test(low)) return null
  if (text.length > 160) return null
  if (GENERIC.test(text)) return null
  return text
}
