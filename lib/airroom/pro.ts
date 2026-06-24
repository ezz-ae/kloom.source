// AIRRAW Pro — anonymous, no login. A real Ziina payment (see /api/airraw-pro)
// mints a short signed token { until } that we store here; isPro() honours it
// until it expires. No account, no server roundtrip to read it. ?pro=1 stays as a
// dev/test override. (The token is server-signed so it comes from a real payment;
// the gated features are cosmetic, so a client-side expiry check is enough.)

export function getProToken(): string | null {
  if (typeof window === "undefined") return null
  try { return localStorage.getItem("airraw_pro_token") } catch { return null }
}
export function setProToken(t: string) { try { localStorage.setItem("airraw_pro_token", t) } catch { /* */ } }
export function clearPro() { try { localStorage.removeItem("airraw_pro_token") } catch { /* */ } }

function tokenUntil(token: string | null): number {
  if (!token) return 0
  try {
    const json = JSON.parse(atob(token.split(".")[0]))
    return typeof json.until === "number" ? json.until : 0
  } catch { return 0 }
}

/** ms epoch the current pass runs until (0 if none). */
export function proUntil(): number { return tokenUntil(getProToken()) }

/** Voice minutes the current pass carries (0 if no active pass). Read from the signed
 *  token payload; the ONE pass grants 6000. Used by voice-credits to honour the pass. */
export function proMinutes(): number {
  const token = getProToken()
  if (!token || proUntil() <= Date.now()) return 0
  try {
    const json = JSON.parse(atob(token.split(".")[0]))
    return typeof json.minutes === "number" ? json.minutes : 0
  } catch { return 0 }
}

export function isPro(): boolean {
  if (typeof window === "undefined") return false
  try {
    const u = new URLSearchParams(window.location.search)
    if (u.get("pro") === "1") localStorage.setItem("airraw_pro", "1")
    if (u.get("pro") === "0") { localStorage.removeItem("airraw_pro"); clearPro() }
    if (localStorage.getItem("airraw_pro") === "1") return true   // dev/test override
  } catch { /* */ }
  return proUntil() > Date.now()
}

// Meta match-quality keys for an anonymous buyer (no email): the browser pixel's _fbp
// cookie + _fbc (click id). _fbc is synthesized from the ?fbclid landing param when the
// cookie isn't there yet. Forwarded with the claim so the server Purchase actually matches.
export function fbCookies(): { fbp?: string; fbc?: string } {
  if (typeof document === "undefined") return {}
  const g = (n: string) => document.cookie.split("; ").find((c) => c.startsWith(n + "="))?.split("=")[1]
  let fbc = g("_fbc")
  if (!fbc && typeof window !== "undefined") {
    const cid = new URLSearchParams(window.location.search).get("fbclid")
    if (cid) fbc = `fb.1.${Date.now()}.${cid}`
  }
  return { fbp: g("_fbp"), fbc }
}

// the Ziina intent we're mid-paying for — stashed before redirect, claimed on return
export function setPendingIntent(id: string) { try { localStorage.setItem("airraw_pro_pending", id) } catch { /* */ } }
export function getPendingIntent(): string | null { try { return localStorage.getItem("airraw_pro_pending") } catch { return null } }
export function clearPendingIntent() { try { localStorage.removeItem("airraw_pro_pending") } catch { /* */ } }
