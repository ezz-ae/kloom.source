// FAI — the thing you cannot buy.
//
// FAI is what opens a seat in a talk. It is deliberately NOT purchasable and not
// part of the pass: money buys the content ceiling and memory, but a seat in a
// room has to be earned. Scarcity you can pay your way out of stops being
// scarcity, and the seat is the moment this product is actually about.
//
// WHY "FAI": you get one when you END a talk. The name, the currency and the
// core loop are the same word — finish a conversation, earn the thing that opens
// the next one. That is the whole economy, and it pays out for the behaviour the
// product actually wants rather than for thumb-flicking.
//
// EARN-ONLY BY CONSTRUCTION: there is one way in — earnFai() — and every caller
// names a reason. Anything that hands out FAI is therefore greppable, which is
// the property that keeps an economy honest as it grows.

const BAL   = "faitalk_fai"
const GRANT = "faitalk_fai_granted"
const DAY   = "faitalk_fai_day"      // "YYYY-MM-DD:count" — the daily earn ledger

export const FIRST_GRANT = 3        // enough to try the thing, not enough to coast
export const DAILY_EARN_CAP = 5     // see canEarnToday

const today = () => new Date().toISOString().slice(0, 10)

function read(k: string): string { try { return localStorage.getItem(k) || "" } catch { return "" } }
function write(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* private mode */ } }

/** Current FAI. Seeds a small one-time grant on first read. */
export function getFai(): number {
  if (typeof window === "undefined") return FIRST_GRANT
  if (!read(GRANT)) { write(GRANT, "1"); write(BAL, String(FIRST_GRANT)); return FIRST_GRANT }
  const n = Number(read(BAL))
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

/** How much has been earned today. */
export function earnedToday(): number {
  const [d, n] = read(DAY).split(":")
  return d === today() ? Number(n) || 0 : 0
}

/**
 * Can more FAI be earned right now?
 *
 * The cap is the load-bearing part. A reward card every few swipes with no
 * ceiling means swiping IS the currency — infinite FAI for anyone willing to
 * flick their thumb, and a seat that costs nothing is worth nothing. The cap
 * makes a day's swiping worth a handful of seats and no more.
 */
export function canEarnToday(): boolean {
  return earnedToday() < DAILY_EARN_CAP
}

/**
 * The ONLY way FAI enters the world. `reason` is required so every source is
 * traceable — an economy where anything can quietly mint currency drifts.
 * Refuses silently past the daily cap rather than throwing, because callers are
 * UI and a thrown error there is worse than a card that simply doesn't appear.
 */
export function earnFai(n: number, reason: string): number {
  const want = Math.max(0, Math.floor(n))
  if (!want) return getFai()
  const room = Math.max(0, DAILY_EARN_CAP - earnedToday())
  const give = Math.min(want, room)
  if (!give) return getFai()
  const next = getFai() + give
  write(BAL, String(next))
  write(DAY, `${today()}:${earnedToday() + give}`)
  if (typeof console !== "undefined") console.debug(`[fai] +${give} (${reason})`)
  return next
}

/** Spend FAI. Returns false without deducting when it can't be afforded. */
export function spendFai(n = 1): boolean {
  const cost = Math.max(0, Math.floor(n))
  const bal = getFai()
  if (bal < cost) return false
  write(BAL, String(bal - cost))
  return true
}

export function canAfford(n = 1): boolean { return getFai() >= n }
