"use client"

// How a dedicated landing hands the visitor to the floor.
//
// /ar does the whole welcome itself — in Arabic, right to left — and then sends
// the person to the app. Without this the mood they just picked would be thrown
// away and they would arrive on whichever room the deck happened to open on,
// which makes the choice they were asked to make a lie.
//
// Read-once on purpose: it applies to the arrival it was written for and never
// to the next visit. Session storage, so it also dies with the tab — a landing
// choice is not a preference, and treating it like one would quietly override
// what the person picks later inside the app.

const MOOD_KEY = "airraw_entry_mood"

/** Remember the room a landing page's mood pick chose. */
export function setEntryMood(c: number) {
  try { sessionStorage.setItem(MOOD_KEY, String(c)) } catch { /* private mode */ }
}

/** Take it, once. Returns null when there is nothing waiting. */
export function takeEntryMood(): number | null {
  try {
    const raw = sessionStorage.getItem(MOOD_KEY)
    if (raw === null) return null
    sessionStorage.removeItem(MOOD_KEY)
    const n = Number(raw)
    return Number.isInteger(n) && n >= 0 && n < 64 ? n : null
  } catch { return null }
}
