// What a chip is worth, what a pack costs, and what can be earned.
//
// DEPENDENCY-FREE ON PURPOSE. This is the price list, and three different callers
// need it: the server that takes the money, the browser that renders the offer,
// and the test that checks no pack is sold below what it costs to serve. A price
// list that drags in a database client can only be read by one of those, and the
// other two end up with a second copy of the numbers — which is how a UI comes to
// advertise one price while the checkout charges another.
//
// Every number here is env-overridable so the economics can be tuned without a
// deploy, and every one has a floor, so a missing or hostile env var narrows the
// offer rather than giving the product away.

// ── what a chip buys ─────────────────────────────────────────────────────────
// One chip is one minute of the character SPEAKING — measured in the characters
// the voice engine bills for, so the unit sold and the unit charged for are the
// same thing. This is the whole reason chips exist: the pass priced access and
// then guessed at consumption, and the guess was off by two orders of magnitude.
export const CHARS_PER_CHIP = Math.max(100, Number(process.env.CHIP_CHARS || 700))

/** A photo costs real cash per generation, and less than a voice minute does. */
export const CHIPS_PER_PHOTO = Math.max(1, Number(process.env.CHIP_PHOTO || 3))

/**
 * Roughly what one chip costs us to serve, in USD — a voice minute at ~700
 * characters on our tier. Nothing computes from this; it is the floor every pack
 * price has to clear, kept next to the prices so nobody can change one without
 * seeing the other. The test asserts the gap.
 */
export const CHIP_COST_USD = 0.063

// ── packs ────────────────────────────────────────────────────────────────────
// Three sizes: two gives no middle to choose, four is a decision rather than a
// purchase. The bonus on the bigger packs is real — it is computed below from the
// actual rates, not typed in — and it is expressed against our own smallest pack,
// because there has never been a higher price to strike through and inventing one
// would be a lie about what this used to cost.
export interface ChipPack {
  id: string
  usd: number
  chips: number
  /** Extra chips over the base pack's rate, as a percentage. 0 on the base pack. */
  bonusPct: number
}

const RAW_PACKS: Array<{ id: string; usd: number; chips: number }> = [
  { id: "small",  usd: 5,  chips: 30 },
  { id: "medium", usd: 12, chips: 90 },
  { id: "large",  usd: 30, chips: 260 },
]

/** Chips per dollar on the smallest pack — the rate every bonus is measured against. */
export const BASE_RATE = RAW_PACKS[0].chips / RAW_PACKS[0].usd

export const CHIP_PACKS: ChipPack[] = RAW_PACKS.map((p) => ({
  ...p,
  bonusPct: Math.round(((p.chips / (p.usd * BASE_RATE)) - 1) * 100),
}))

export function packById(id?: string | null): ChipPack | null {
  return CHIP_PACKS.find((p) => p.id === id) || null
}

/** Gross margin on a pack, 0–1. The test requires every pack to clear a floor. */
export function packMargin(p: ChipPack): number {
  const cost = p.chips * CHIP_COST_USD
  return (p.usd - cost) / p.usd
}

// ── earning ──────────────────────────────────────────────────────────────────
// Both grants are fixed, announced before they are earned, and bounded.
//
// The daily is small deliberately. It is enough to open a conversation and hear a
// voice — a reason to come back that costs pennies a week — and nowhere near
// enough to live on, so it never competes with buying. Missing a day costs
// nothing and forfeits nothing: there is no streak here, because a reward you can
// lose is a punishment, and a punishment is how this stops being a product people
// choose and starts being one they are managed by.
export const DAILY_CHIPS = Math.max(0, Number(process.env.CHIP_DAILY || 3))

/**
 * Referral pays only when the person you sent actually BUYS. It is the only
 * version that cannot be farmed: there is no reward for producing visitors, only
 * for producing customers, so the incentive points at telling people who would
 * genuinely like this rather than at spraying a link.
 */
export const REFERRAL_CHIPS = Math.max(0, Number(process.env.CHIP_REFERRAL || 25))

/** Chips the ninety-day pass grants, on top of everything it already includes. */
export const PASS_CHIPS = Math.max(0, Number(process.env.CHIP_PASS_GRANT || 120))

/** UTC day key. The daily is once per UTC day everywhere, for everyone. */
export const utcDay = (at = Date.now()) => new Date(at).toISOString().slice(0, 10)

/**
 * Chips a run of speech costs, rounded UP to the chip.
 *
 * Rounding up matters and is the honest direction: a fractional chip that rounds
 * down is speech served free, and at scale that is the same hole the pass has.
 * Zero characters costs zero — never charge for silence.
 */
export function chipsForChars(chars: number): number {
  if (!(chars > 0)) return 0
  return Math.ceil(chars / CHARS_PER_CHIP)
}
