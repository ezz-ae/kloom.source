// One person, one voice — for the whole visit.
//
// The server casts a voice deterministically from a persona's seed. But the POOLS
// it casts from are discovered at runtime, per serverless instance, and they move
// under a live call: an instance publishes its account voices first and merges
// the shared library seconds later; a library page can time out on one instance
// and not the next; and every chunk of a reply is its own request that may land
// on any instance. The same seed hashed into a different-sized pool is a
// different voice — which is how one character came to speak in three voices
// inside a single reply, and in a fourth when the greeting on the front door was
// cast without the seed at all. The casting was deterministic; its inputs weren't.
//
// So the FIRST resolution wins and is remembered here. The server says which
// voice it actually used (X-EL-Voice); every later request for the same person
// carries it back as an explicit pin, and the server's casting is never consulted
// again for them. Kept in localStorage too, so the person you talked to last
// night sounds the same tonight.
//
// Keyed per LANGUAGE: a bilingual character may legitimately own an Arabic voice
// and an English one (a native pool exists for one and not the other). Switching
// language mid-call is a deliberate change; switching voice mid-sentence is not.

import { isoForLanguage } from "@/lib/languages"

const LS = "airraw_voice_pin:v1"
const MAX = 400                    // people remembered; oldest dropped past this
const mem = new Map<string, string>()
let loaded = false

function load() {
  if (loaded) return
  loaded = true
  try {
    if (typeof localStorage === "undefined") return
    const raw = localStorage.getItem(LS)
    if (!raw) return
    const obj = JSON.parse(raw) as Record<string, string>
    for (const [k, v] of Object.entries(obj)) if (typeof v === "string" && v) mem.set(k, v)
  } catch { /* private mode / corrupt entry — start empty */ }
}

function save() {
  try {
    if (typeof localStorage === "undefined") return
    while (mem.size > MAX) { const first = mem.keys().next().value; if (first === undefined) break; mem.delete(first) }
    localStorage.setItem(LS, JSON.stringify(Object.fromEntries(mem)))
  } catch { /* quota / private mode — the in-memory pin still holds for this visit */ }
}

/** The pin key: the person's identity seed, per language. */
export function voicePinKey(seedKey: string | undefined, language?: string): string {
  return `${(seedKey || "").trim()}|${isoForLanguage(language) || "en"}`
}

/** The voice this person already speaks in, if one has been heard. */
export function pinnedVoice(seedKey: string | undefined, language?: string): string | undefined {
  if (!seedKey) return undefined
  load()
  return mem.get(voicePinKey(seedKey, language)) || undefined
}

export function pinVoice(seedKey: string | undefined, language: string | undefined, voiceId: string): void {
  if (!seedKey || !voiceId) return
  load()
  const k = voicePinKey(seedKey, language)
  if (mem.get(k) === voiceId) return
  mem.set(k, voiceId)
  save()
}

/**
 * Remember the voice a TTS response was spoken in.
 *
 * Only a voice the PRIMARY engine chose is worth pinning. A chunk that fell
 * through to the fallback engine carries no X-EL-Voice — and pinning a fallback
 * would turn one bad second into a permanent wrong voice for that person.
 */
export function pinFromResponse(seedKey: string | undefined, language: string | undefined, res: Response): string | undefined {
  if (!seedKey || !res.ok) return undefined
  const v = (res.headers.get("X-EL-Voice") || "").trim()
  if (!v || !/^[A-Za-z0-9_-]{6,}$/.test(v)) return undefined
  pinVoice(seedKey, language, v)
  return v
}

/** Forget every pin — for a "hear them fresh" reset, or when voices are recast. */
export function clearVoicePins(): void {
  mem.clear()
  loaded = true
  try { localStorage.removeItem(LS) } catch { /* */ }
}

// ── the first request goes alone ─────────────────────────────────────────────
// A reply is spoken in sentence-sized chunks that are requested as they stream,
// so several are usually in flight before the first has answered. Until a pin
// exists, those siblings would each be cast independently — on different
// instances, from different pools. The first request for a person is therefore
// registered here, and the rest wait for it to settle (not succeed — a failure
// releases them too) before they ask. One round-trip of latency, once per person.

const firstInFlight = new Map<string, Promise<void>>()

export async function awaitPin(seedKey: string | undefined, language?: string): Promise<void> {
  if (!seedKey || pinnedVoice(seedKey, language)) return
  const p = firstInFlight.get(voicePinKey(seedKey, language))
  if (p) await p
}

export function claimFirst(seedKey: string | undefined, language: string | undefined, req: Promise<unknown>): void {
  if (!seedKey || pinnedVoice(seedKey, language)) return
  const k = voicePinKey(seedKey, language)
  if (firstInFlight.has(k)) return
  const settled = req.then(() => undefined, () => undefined).finally(() => { firstInFlight.delete(k) })
  firstInFlight.set(k, settled)
}
