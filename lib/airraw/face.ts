// Client-side loader for live, diverse, generated faces. Each persona's photo is
// fetched once from /api/character-photo (which itself generates-once-caches-forever
// server-side), then cached in-memory + localStorage so it's instant on every later
// view. Concurrent requests for the same persona are de-duped. Until a face resolves,
// callers show a cheap fallback (gradient/initial) — so the floor never blocks.

export interface FacePersona { name: string; gender?: string; seed?: string }

const PROVIDER = process.env.NEXT_PUBLIC_AIRRAW_IMG_PROVIDER || "together"
const mem = new Map<string, string>()
const inflight = new Map<string, Promise<string | null>>()

function keyOf(p: FacePersona): string { return String(p.seed || p.name || "").trim() }
const lsKey = (k: string) => "airraw_face:" + k

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
  const pending = inflight.get(k)
  if (pending) return pending
  const req = (async (): Promise<string | null> => {
    try {
      const r = await fetch("/api/character-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: p.name || k, gender: p.gender, seed: k, diverse: true, provider: PROVIDER }),
      })
      if (!r.ok) return null
      const d = await r.json().catch(() => ({}))
      const url: string = d?.url || ""
      if (url) { mem.set(k, url); try { localStorage.setItem(lsKey(k), url) } catch { /* */ } return url }
      return null
    } catch { return null } finally { inflight.delete(k) }
  })()
  inflight.set(k, req)
  return req
}
