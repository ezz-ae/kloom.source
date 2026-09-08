// SAVED SCENES — a scene you can leave and come back to.
//
// A scene used to exist only while you were looking at it. Leaving one dropped
// the cast, the transcript and the configuration on the floor, the tab went back
// to the builder, and there was no way to reach what you had just been in. So
// the feature read as a toy: you could make a thing once and never keep it.
//
// This is the store behind the fix. It is deliberately LOCAL — the same rule the
// rest of the adult side follows: nothing about a conversation leaves the device
// unless the person paid and asked. A scene with `save: false` is never written
// here at all, not written and hidden.

import type { SceneConfig } from "@/lib/airraw/fantasy"

const KEY = "airraw_scenes"
/** Enough to be a library, small enough that localStorage never fills. */
const MAX_SCENES = 24
/** Per scene. A long night is still a readable transcript, not a database. */
const MAX_LINES = 200

export interface SavedLine { who: number | null; text: string; at: number }

export interface SavedScene {
  id: string
  cfg: SceneConfig
  /** The seed the cast was built from — so reopening brings back the same people. */
  seed: number
  /** Their names, for the list, so it needn't rebuild the cast to draw a row. */
  names: string[]
  lines: SavedLine[]
  createdAt: number
  updatedAt: number
}

function read(): SavedScene[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch { return [] }
}

function write(list: SavedScene[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_SCENES))) } catch { /* a full quota is not worth an error mid-scene */ }
}

/** Newest first — the one you were just in is the one you want. */
export function listScenes(): SavedScene[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getScene(id: string): SavedScene | null {
  return read().find((s) => s.id === id) || null
}

export function newSceneId(): string {
  return `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Create or update. Called as the scene runs, so it is an upsert rather than an
 * append — the same scene being written repeatedly must not become twenty rows.
 */
export function saveScene(s: SavedScene) {
  if (!s.cfg?.save) return   // they asked for nothing to be kept
  const list = read().filter((x) => x.id !== s.id)
  list.unshift({ ...s, lines: s.lines.slice(-MAX_LINES), updatedAt: Date.now() })
  write(list)
}

export function deleteScene(id: string) {
  write(read().filter((s) => s.id !== id))
}

export function deleteAllScenes() {
  try { localStorage.removeItem(KEY) } catch { /* */ }
}

/** A one-line summary for the list: who is in it. */
export function castLabel(s: SavedScene): string {
  return s.names.filter(Boolean).join(" · ") || "a scene"
}

/** The last thing said, for the row's second line. */
export function lastLine(s: SavedScene): string {
  const l = [...s.lines].reverse().find((x) => x.text)
  return l ? l.text : "nothing said yet"
}
