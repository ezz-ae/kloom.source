// A per-browser id, so the free minute is a property of the visitor rather than
// of the page load. Not a secret and not proof of anything — the server also
// buckets by IP for exactly the case where someone mints a new one. Generated
// once, kept in localStorage; empty on the server so SSR never invents one.

const KEY = "airraw_vid"
let mem = ""

export function visitorId(): string {
  if (typeof window === "undefined") return ""
  if (mem) return mem
  try { mem = localStorage.getItem(KEY) || "" } catch { /* private mode */ }
  if (!mem) {
    mem = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    try { localStorage.setItem(KEY, mem) } catch { /* private mode: lives for this page only */ }
  }
  return mem
}
