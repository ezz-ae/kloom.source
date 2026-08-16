// Conversation memory — come back to a character and pick the thread up.
//
// Pro-gated: a saved thread is the reason to keep the pass. Free sessions store
// nothing at all, so this is not a feature that quietly degrades — it's simply
// absent, and nothing about a free session is written to disk.
//
// PRIVACY: this writes adult conversation transcripts to localStorage on a device
// that may not be private. Three rules follow from that and none of them are
// optional:
//   1. Nothing is stored unless the user is Pro AND has not switched it off.
//   2. It is erasable from the call itself (forget one) and wholesale (forgetAll).
//   3. Storage is capped, so it can't quietly grow into a large archive of
//      everything the user has ever said.
// Anything added here must keep all three true.

import type { Cluster } from "@/lib/airroom/roster"
import { isPro } from "@/lib/airroom/pro"

export interface SavedMsg { who: "host" | "you"; text: string }

export interface SavedTalk {
  /** The character's unique identity — same key their face and voice come from. */
  key: string
  /** Enough to reopen the SAME person: name, room, lines, voice, gender, heat. */
  cluster: Cluster
  msgs: SavedMsg[]
  /** Last time this thread was spoken in. */
  at: number
}

const KEY = "airraw_talks"
const OFF_KEY = "airraw_talks_off"

// How much we're willing to keep. Deliberately small: this is "pick the thread
// back up", not an archive. The tail of a conversation is what makes returning
// feel continuous; the beginning of a three-hour session doesn't.
const MAX_TALKS = 12
const MAX_MSGS = 30

/** Has the user turned memory off? Off is honoured even for Pro. */
export function memoryOff(): boolean {
  if (typeof localStorage === "undefined") return false
  return localStorage.getItem(OFF_KEY) === "1"
}

export function setMemoryOff(off: boolean) {
  try {
    if (off) { localStorage.setItem(OFF_KEY, "1"); forgetAll() }
    else localStorage.removeItem(OFF_KEY)
  } catch { /* private mode */ }
}

/** Memory is live only for a Pro session that hasn't switched it off. */
export function memoryEnabled(): boolean {
  return isPro() && !memoryOff()
}

function readAll(): SavedTalk[] {
  if (typeof localStorage === "undefined") return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Defensive: this is user-writable storage, so never trust its shape.
    return parsed.filter(
      (t): t is SavedTalk =>
        !!t && typeof t.key === "string" && !!t.cluster && Array.isArray(t.msgs),
    )
  } catch {
    return []
  }
}

function writeAll(list: SavedTalk[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_TALKS)))
  } catch {
    // Quota exceeded — drop the oldest half rather than losing everything, and
    // never let a storage failure break the call in progress.
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, Math.floor(MAX_TALKS / 2)))) } catch { /* give up quietly */ }
  }
}

/** Saved threads, most recently spoken in first. */
export function listTalks(): SavedTalk[] {
  if (!memoryEnabled()) return []
  return readAll().sort((a, b) => (b.at || 0) - (a.at || 0))
}

export function loadTalk(key: string): SavedTalk | null {
  if (!memoryEnabled() || !key) return null
  return readAll().find((t) => t.key === key) || null
}

/**
 * Record where this conversation got to. Keeps only the tail, and only if there
 * is actually a conversation — a room the user opened and left without speaking
 * is not something to offer them again.
 */
export function saveTalk(cluster: Cluster, msgs: SavedMsg[]) {
  if (!memoryEnabled()) return
  const key = cluster.key
  if (!key) return
  if (!msgs.some((m) => m.who === "you")) return   // never spoken in — don't save
  const rest = readAll().filter((t) => t.key !== key)
  const entry: SavedTalk = { key, cluster, msgs: msgs.slice(-MAX_MSGS), at: Date.now() }
  writeAll([entry, ...rest].slice(0, MAX_TALKS))
}

export function forgetTalk(key: string) {
  try { writeAll(readAll().filter((t) => t.key !== key)) } catch { /* */ }
}

export function forgetAll() {
  try { localStorage.removeItem(KEY) } catch { /* */ }
}

/** Short "3h ago" style stamp for the resume list. */
export function agoLabel(at: number): string {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000))
  if (s < 90) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? "yesterday" : `${d}d ago`
}
