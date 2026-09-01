// SAVED CHARACTERS — the same person, every time you ask for something new.
//
// The floor already mints people deterministically: a seed key decides a face, a
// voice, an accent and an inner life, and re-deriving from that key reproduces
// them exactly. That is enough while the only artefact is one portrait, and it
// stops being enough the moment you can ASK for media — "her, on a balcony",
// "her, laughing" — because each request is a fresh diffusion call and diffusion
// has no memory. Ask twice and you get two different women with the same name.
//
// So identity has to be written down, not re-rolled. What makes a character the
// SAME character across generations is one frozen sentence describing how they
// look, reused verbatim, with only the scene changing after it:
//
//   <appearance, frozen>  +  <scene, whatever you asked for>
//
// The appearance clause comes from buildPortraitPrompt — the same builder the
// first portrait used — so a saved character looks like the card you swiped, not
// like a new person who happens to share her name. The portrait URL is kept too,
// which is what a reference-conditioned model (IP-Adapter, or a LoRA trained per
// character) would take as its anchor if the pipeline gains one; the shape here
// is deliberately ready for that without depending on it.
//
// STORAGE follows memory.ts exactly: sessionStorage for a free visit,
// localStorage once there is a pass. A free session leaves nothing behind, and
// that promise is made on the platform-facts page, so it is honoured here rather
// than restated.

import type { Cluster } from "@/lib/airroom/roster"
import { buildPortraitPrompt } from "@/lib/airraw/portrait-prompt"
import { isPro } from "@/lib/airroom/pro"

export interface SavedMedia {
  /** Where it lives. Server-side generated and cached, same as portraits. */
  url: string
  kind: "image" | "video"
  /** What was asked for — the scene, not the appearance. */
  scene: string
  at: number
}

export interface SavedCharacter {
  /** The roster identity key — face, voice and accent all derive from it. */
  key: string
  name: string
  gender: string
  /** The frozen appearance clause. Written once; never re-rolled. */
  look: string
  /** Their first portrait, and the anchor a reference-conditioned model wants. */
  portrait?: string
  media: SavedMedia[]
  savedAt: number
}

const KEY = "faitalk_characters"
const MAX_CHARACTERS = 24
const MAX_MEDIA = 40

function store(): Storage | null {
  if (typeof window === "undefined") return null
  try { return isPro() ? localStorage : sessionStorage } catch { return null }
}

function read(): SavedCharacter[] {
  const st = store()
  if (!st) return []
  try {
    const raw = st.getItem(KEY)
    if (!raw) return []
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v : []
  } catch { return [] }
}

function write(list: SavedCharacter[]) {
  try { store()?.setItem(KEY, JSON.stringify(list.slice(0, MAX_CHARACTERS))) } catch { /* private mode or quota */ }
}

/**
 * The appearance clause for a character, frozen.
 *
 * Deliberately NOT the whole portrait prompt: that one ends with a photographic
 * style and a framing ("portrait of…"), which would fight every scene you asked
 * for afterwards. This is the part that describes the PERSON — who they are,
 * not how the camera sees them — so a scene can be appended without arguing
 * with it.
 */
export function lookFor(c: Cluster): string {
  const { prompt } = buildPortraitPrompt(c.key, c.gender)
  // buildPortraitPrompt composes "<base>. <style>. portrait of <person>". The
  // person is the last clause; the two before it are camera direction.
  const i = prompt.indexOf("portrait of ")
  return (i >= 0 ? prompt.slice(i + "portrait of ".length) : prompt).trim()
}

export function listCharacters(): SavedCharacter[] {
  return read().sort((a, b) => b.savedAt - a.savedAt)
}

export function getCharacter(key: string): SavedCharacter | null {
  return read().find((c) => c.key === key) || null
}

/**
 * Keep this person. Idempotent: saving someone already kept refreshes when you
 * last saw them without re-rolling their look, because re-rolling the look is
 * precisely the bug this file exists to prevent.
 */
export function saveCharacter(c: Cluster, portrait?: string): SavedCharacter {
  const list = read()
  const existing = list.find((x) => x.key === c.key)
  if (existing) {
    existing.savedAt = Date.now()
    if (portrait && !existing.portrait) existing.portrait = portrait
    write(list)
    return existing
  }
  const next: SavedCharacter = {
    key: c.key,
    name: c.host,
    gender: c.gender,
    look: lookFor(c),
    portrait,
    media: [],
    savedAt: Date.now(),
  }
  write([next, ...list])
  return next
}

export function forgetCharacter(key: string) {
  write(read().filter((c) => c.key !== key))
}

export function forgetAllCharacters() {
  try { store()?.removeItem(KEY) } catch { /* */ }
}

/** Attach something they made. Newest first, oldest dropped past the cap. */
export function addMedia(key: string, m: SavedMedia) {
  const list = read()
  const c = list.find((x) => x.key === key)
  if (!c) return
  c.media = [m, ...c.media.filter((x) => x.url !== m.url)].slice(0, MAX_MEDIA)
  write(list)
}

/**
 * The prompt for a new piece of media OF THIS PERSON.
 *
 * Appearance first and verbatim, scene second. Order matters: diffusion weights
 * early tokens more heavily, so leading with the person is what keeps them the
 * person. The scene is clamped because it arrives from a text box or a
 * transcript, and an essay would drown the identity clause it is appended to.
 */
export function mediaPrompt(c: SavedCharacter, scene: string): string {
  const s = scene.replace(/["\n]/g, " ").trim().slice(0, 180)
  return s ? `${c.look}, ${s}` : c.look
}
