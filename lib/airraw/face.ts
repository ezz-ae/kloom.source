// Client-side loader for live, diverse, generated faces. Each persona's photo is
// fetched once from /api/character-photo (which itself generates-once-caches-forever
// server-side), then cached in-memory + localStorage so it's instant on every later
// view. Concurrent requests for the same persona are de-duped. Until a face resolves,
// callers show a cheap fallback (gradient/initial) — so the floor never blocks.

export interface FacePersona { name: string; gender?: string; seed?: string }

const PROVIDER = process.env.NEXT_PUBLIC_AIRRAW_IMG_PROVIDER || "together"
const mem = new Map<string, string>()
const inflight = new Map<string, Promise<string | null>>()

/**
 * Failures are remembered too — for a while, and only in memory.
 *
 * A screen can hold a lot of faces at once (the talks board shows four per
 * talk), and nothing here stopped a failed lookup from being retried on every
 * single render. When the image provider's key was rejected, that turned one
 * dead credential into sustained traffic and a wall of 502s. Two latches:
 * `failed` per persona, and `offUntil` for when the server says generation is
 * disabled outright — then we stop asking for anybody.
 *
 * In memory only, and short. A negative written to localStorage would outlive
 * the outage and leave a returning visitor with permanently blank faces, which
 * is a far worse failure than one extra request.
 */
const RETRY_MS = 5 * 60_000
const failed = new Map<string, number>()
let offUntil = 0

function keyOf(p: FacePersona): string { return String(p.seed || p.name || "").trim() }

// Bump when the SERVER image pipeline changes (model / realism pass) so every client
// drops its cached URLs and re-fetches the new faces — otherwise a returning visitor
// keeps seeing the old face URL saved in localStorage even though the server moved on.
const FACE_CACHE_VERSION = "v5"
const lsKey = (k: string) => `airraw_face:${FACE_CACHE_VERSION}:` + k

// One-time sweep: drop face URLs cached under an older pipeline version so stale
// localStorage entries don't linger (and so the old plastic faces never resurface).
try {
  if (typeof localStorage !== "undefined") {
    const keep = `airraw_face:${FACE_CACHE_VERSION}:`
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key && key.startsWith("airraw_face:") && !key.startsWith(keep)) localStorage.removeItem(key)
    }
  }
} catch { /* localStorage unavailable — fine */ }

/** The already-resolved URL for this persona, or null if not generated yet. */
export function cachedFace(p: FacePersona): string | null {
  const k = keyOf(p)
  if (!k) return null
  const m = mem.get(k)
  if (m) return m
  try {
    const u = typeof localStorage !== "undefined" ? localStorage.getItem(lsKey(k)) : null
    if (u) { mem.set(k, u); return u }
  } catch { /* */ }
  return null
}

/** Resolve (generating if needed) the persona's live photo URL. De-duped per key. */
export function faceUrl(p: FacePersona): Promise<string | null> {
  const k = keyOf(p)
  if (!k || typeof fetch === "undefined") return Promise.resolve(null)
  const c = cachedFace(p)
  if (c) return Promise.resolve(c)
  if (Date.now() < offUntil) return Promise.resolve(null)
  const failedAt = failed.get(k)
  if (failedAt && Date.now() - failedAt < RETRY_MS) return Promise.resolve(null)
  const pending = inflight.get(k)
  if (pending) return pending
  const req = (async (): Promise<string | null> => {
    try {
      const r = await fetch("/api/character-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: p.name || k, gender: p.gender, seed: k, diverse: true, provider: PROVIDER }),
      })
      if (!r.ok) {
        // 503 + disabled:true is the server saying "no photo is coming for
        // anyone" — a missing or rejected provider key. Stop asking entirely
        // rather than working through every face on the screen.
        const d = await r.json().catch(() => ({}))
        if (r.status === 503 && d?.disabled) offUntil = Date.now() + RETRY_MS
        else failed.set(k, Date.now())
        return null
      }
      const d = await r.json().catch(() => ({}))
      const url: string = d?.url || ""
      if (url) { mem.set(k, url); try { localStorage.setItem(lsKey(k), url) } catch { /* */ } return url }
      failed.set(k, Date.now())
      return null
    } catch { failed.set(k, Date.now()); return null } finally { inflight.delete(k) }
  })()
  inflight.set(k, req)
  return req
}
