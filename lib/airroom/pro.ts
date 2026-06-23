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

// the Ziina intent we're mid-paying for — stashed before redirect, claimed on return
export function setPendingIntent(id: string) { try { localStorage.setItem("airraw_pro_pending", id) } catch { /* */ } }
export function getPendingIntent(): string | null { try { return localStorage.getItem("airraw_pro_pending") } catch { return null } }
export function clearPendingIntent() { try { localStorage.removeItem("airraw_pro_pending") } catch { /* */ } }
