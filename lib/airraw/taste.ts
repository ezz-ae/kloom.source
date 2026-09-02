// WHO YOU WANT TO MEET — the filter on the front door.
//
// The deck used to walk a fixed list of temperatures, so everybody saw the same
// ten kinds of person in the same order forever. Two people with opposite
// interests got an identical floor, and the only way to escape a tier you had no
// interest in was to keep swiping past it.
//
// A taste is deliberately SUBTRACTIVE and starts empty, meaning "everything".
// A new visitor should not have to fill in a form before the product will show
// them anybody, and an empty filter is also the honest default — we don't know
// yet. Choosing narrows; it never has to be set up.
//
// Stored like every other preference here: sessionStorage for a free visit,
// localStorage once there is a pass, so a free session still leaves nothing.

import { VIBES } from "@/lib/airroom/roster"
import { isPro } from "@/lib/airroom/pro"

export type TasteGender = "any" | "female" | "male"

export interface Taste {
  gender: TasteGender
  /** Archetype keys to show. EMPTY means all of them — see above. */
  vibes: string[]
}

const KEY = "faitalk_taste"
const EMPTY: Taste = { gender: "any", vibes: [] }

function store(): Storage | null {
  if (typeof window === "undefined") return null
  try { return isPro() ? localStorage : sessionStorage } catch { return null }
}

export function getTaste(): Taste {
  const st = store()
  if (!st) return { ...EMPTY }
  try {
    const raw = st.getItem(KEY)
    if (!raw) return { ...EMPTY }
    const p = JSON.parse(raw)
    const known = new Set(VIBES.map((v) => v.key))
    return {
      gender: p?.gender === "female" || p?.gender === "male" ? p.gender : "any",
      // Filter to keys that still exist: an archetype could be renamed or
      // removed, and a stale key would silently narrow the floor to nothing.
      vibes: Array.isArray(p?.vibes) ? p.vibes.filter((k: unknown) => typeof k === "string" && known.has(k)) : [],
    }
  } catch { return { ...EMPTY } }
}

export function saveTaste(t: Taste) {
  const known = new Set(VIBES.map((v) => v.key))
  try {
    store()?.setItem(KEY, JSON.stringify({
      gender: t.gender === "female" || t.gender === "male" ? t.gender : "any",
      vibes: t.vibes.filter((k) => known.has(k)),
    }))
  } catch { /* private mode or quota */ }
}

/** Does a taste actually narrow anything? Drives the "filtered" dot in the UI. */
export function tasteIsSet(t = getTaste()): boolean {
  return t.gender !== "any" || t.vibes.length > 0
}

/**
 * The temperatures the deck should walk, given a taste.
 *
 * NEVER returns empty. A filter that excludes everything would leave a blank
 * screen with no way back — worse than showing someone a kind of person they
 * didn't ask for — so an impossible taste falls back to the whole floor.
 */
export function walkFor(t = getTaste()): number[] {
  const chosen = t.vibes.length ? VIBES.filter((v) => t.vibes.includes(v.key)) : VIBES
  const pool = chosen.length ? chosen : VIBES

  // One pass in order, then a second shuffled by a fixed stride, so consecutive
  // cards are different KINDS of person and the cycle is long enough not to read
  // as a loop. A single-vibe taste just repeats that vibe, which is what asking
  // for one thing should do.
  const a = pool.map((v) => v.f)
  if (a.length < 3) return a
  const stride = a.length % 2 === 0 ? 3 : 2   // coprime with the length either way
  const b = a.map((_, i) => a[(i * stride) % a.length])
  return [...a, ...b]
}

/** Does this character pass the taste? Gender only — vibes are handled by the walk. */
export function matchesTaste(gender: string, t = getTaste()): boolean {
  if (t.gender === "any") return true
  return (gender || "").toLowerCase() === t.gender
}
