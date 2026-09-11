// AIRRAW Pro — anonymous, no login. A real Ziina payment (see /api/airraw-pro)
// mints a short signed token { until } that we store here; isPro() honours it
// until it expires. No account, no server roundtrip to read it. ?pro=1 stays as a
// dev/test override. (The token is server-signed so it comes from a real payment;
// the gated features are cosmetic, so a client-side expiry check is enough.)

export function getProToken(): string | null {
  if (typeof window === "undefined") return null
  try { return localStorage.getItem("airraw_pro_token") } catch { return null }
}
export function setProToken(t: string) {
  try { localStorage.setItem("airraw_pro_token", t); localStorage.removeItem(REFUSED_KEY) } catch { /* */ }
}
export function clearPro() {
  try { localStorage.removeItem("airraw_pro_token"); localStorage.removeItem(REFUSED_KEY) } catch { /* */ }
}

// ── WHEN THE SERVER SAYS NO ──────────────────────────────────────────────────
//
// isPro() reads the expiry OUT OF the token without checking its signature,
// because the client has no secret and never can. That is fine while the two
// agree. It stops being fine the moment they do not: after AIRRAW_PRO_SECRET
// moved, a real customer's You page showed a green "pass active · until Oct 21"
// while every single voice request for that same token was being refused. The
// product told them they were paid up and then behaved as though they were not,
// which is worse than either answer on its own.
//
// The client cannot verify a pass. It CAN listen: a 402 carrying
// X-Pass: rejected is the server settling it, and after one the UI stops
// claiming otherwise. Restoring or buying a pass clears the mark, so this is a
// memory of a refusal rather than a punishment.
const REFUSED_KEY = "airraw_pro_refused"

/** The server refused this token. Called from the 402 path, never guessed at. */
export function markProRefused() {
  try { localStorage.setItem(REFUSED_KEY, "1") } catch { /* private mode */ }
}
export function proRefused(): boolean {
  try { return localStorage.getItem(REFUSED_KEY) === "1" } catch { return false }
}

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
  // The ?pro=1 unlock is a DEV/TEST override only — in a production build it must not
  // grant Pro, or the paywall is one URL param away from free. (It never unlocked the
  // server content tier — /api/chat gates on a signed token — but it did flip paid UI.)
  // ?pro=0 still clears a stuck override everywhere, including prod.
  const devOverride = process.env.NODE_ENV !== "production"
  try {
    const u = new URLSearchParams(window.location.search)
    if (u.get("pro") === "1" && devOverride) localStorage.setItem("airraw_pro", "1")
    if (u.get("pro") === "0") { localStorage.removeItem("airraw_pro"); clearPro() }
    if (devOverride && localStorage.getItem("airraw_pro") === "1") return true
  } catch { /* */ }
  // A refusal outranks the token's own expiry claim: the server has already
  // declined this exact pass, so showing it as active is a lie the UI is telling
  // on the server's behalf.
  if (proRefused()) return false
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

// ── THE ADDRESS THIS PASS CAN BE REOPENED WITH ────────────────────────────────
// Kept so the You page can show it back: "you can open this on any phone with
// m@…". Without it the buyer has to remember which of their addresses they
// typed, weeks later, on a phone that has nothing else.
const EMAIL_KEY = "airraw_pass_email"
export function setPassEmail(e: string) {
  const v = (e || "").trim().toLowerCase()
  if (!v) return
  try { localStorage.setItem(EMAIL_KEY, v) } catch { /* */ }
}
export function getPassEmail(): string {
  if (typeof window === "undefined") return ""
  try { return localStorage.getItem(EMAIL_KEY) || "" } catch { return "" }
}

// the Ziina intent we're mid-paying for — stashed before redirect, claimed on return.
// Now carries the signed purchase anchor {t,s} so the claim pins the pass to purchase
// time (anti-replay). Back-compat: a bare-string value (old pending) is read as {id}.
export interface PendingIntent { id: string; t?: number; s?: string }
export function setPendingIntent(id: string, t?: number, s?: string) {
  try { localStorage.setItem("airraw_pro_pending", JSON.stringify({ id, t, s })) } catch { /* */ }
}
export function getPending(): PendingIntent | null {
  try {
    const raw = localStorage.getItem("airraw_pro_pending")
    if (!raw) return null
    if (raw[0] === "{") return JSON.parse(raw) as PendingIntent
    return { id: raw }   // legacy bare-string id
  } catch { return null }
}
/** @deprecated use getPending() — kept so existing callers reading just the id still work */
export function getPendingIntent(): string | null { return getPending()?.id ?? null }
export function clearPendingIntent() { try { localStorage.removeItem("airraw_pro_pending") } catch { /* */ } }
