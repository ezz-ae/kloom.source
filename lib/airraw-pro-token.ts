// AIRRAW Pro token — server-side mint + verify. The token proves a real Ziina
// payment (minted only after /api/airraw-pro confirms status="completed"). It's
// HMAC-signed with a server-only secret, so it can be validated anywhere on the
// server (e.g. /api/chat) before honouring a Pro-only request.
import { createHmac, timingSafeEqual } from "crypto"

// Prefer a dedicated AIRRAW_PRO_SECRET. SUPABASE_SERVICE_ROLE_KEY is a strong fallback so
// existing paid tokens keep validating, but NEVER fall back to a public dev constant in
// production — that would let anyone mint a permanently-valid pass and reach unrestricted
// for free. In prod with neither secret set, SECRET is empty and every token fails CLOSED.
const SECRET = process.env.AIRRAW_PRO_SECRET
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || (process.env.NODE_ENV === "production" ? "" : "airraw-dev-secret")

// Every pass is an HMAC over SECRET, so the moment SECRET changes, every pass
// already sold stops verifying — and the holder is silently metered as a free
// visitor: one minute, then the sheet asking them to buy what they already
// bought. That is not hypothetical. SECRET falls back to
// SUPABASE_SERVICE_ROLE_KEY, so it moved when AIRRAW_PRO_SECRET was first set,
// and it moves again with any Supabase rotation or project switch.
//
// So verification accepts a PREVIOUS secret as well. Minting never does: new
// passes are always signed with the current one, and the old value only keeps
// already-sold passes alive until they expire. Rotating is now: put the old
// value in AIRRAW_PRO_SECRET_PREV, the new one in AIRRAW_PRO_SECRET, and nobody
// who paid loses anything.
const PREV_SECRET = process.env.AIRRAW_PRO_SECRET_PREV || ""

/** Secrets a token may be signed with, current first. Verify only. */
const VERIFY_SECRETS: string[] = [SECRET, PREV_SECRET].filter(Boolean)

export function mintProToken(untilMs: number, minutes = 6000): string {
  if (!SECRET) throw new Error("AIRRAW_PRO_SECRET not configured — refusing to mint with an empty secret")
  // The ONE pass: adult18 (S1 age attestation) + minutes (the voice allowance). Both live
  // INSIDE the HMAC-signed payload so an anonymous buyer's allowance can't be forged.
  const payload = Buffer.from(JSON.stringify({ until: untilMs, v: 1, adult18: true, minutes })).toString("base64")
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex")
  return `${payload}.${sig}`
}

/** Verified claims from a Pro token, or null if invalid/expired/unsigned. */
export function proTokenClaims(token?: string | null): { until: number; v: number; adult18?: boolean; minutes?: number } | null {
  if (!token || !VERIFY_SECRETS.length) return null
  const [payload, sig] = token.split(".")
  if (!payload || !sig) return null
  try {
    const a = Buffer.from(sig, "hex")
    // Constant-time against each accepted secret. Both are checked even after a
    // match so a rotated pass and a current one cost the same time.
    let signed = false
    for (const secret of VERIFY_SECRETS) {
      const b = Buffer.from(createHmac("sha256", secret).update(payload).digest("hex"), "hex")
      if (a.length === b.length && timingSafeEqual(a, b)) signed = true
    }
    if (!signed) return null
    const claims = JSON.parse(Buffer.from(payload, "base64").toString())
    if (typeof claims.until !== "number" || claims.until <= Date.now()) return null
    return claims
  } catch { return null }
}

/**
 * Why a token was not honoured — for the response header, so a paying customer
 * being metered as a free visitor is one header away from being diagnosed
 * instead of being guessed at.
 */
export type PassRefusal = "none" | "rejected" | "expired"

export function proTokenRefusal(token?: string | null): PassRefusal | null {
  if (!token) return "none"
  if (proTokenClaims(token)) return null
  // Unverified read of the payload — only to tell "expired" from "rejected".
  // It decides a message, never access.
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[0], "base64").toString())
    if (typeof claims.until === "number" && claims.until <= Date.now()) return "expired"
  } catch { /* not even shaped like a token */ }
  return "rejected"
}

export function proTokenValid(token?: string | null): boolean {
  return proTokenClaims(token) !== null
}

// ── Signed purchase anchor ────────────────────────────────────────────────
// Ziina has no metadata field and its intent object exposes no reliable created
// timestamp, so we carry the purchase moment ourselves — HMAC-signed so it can't
// be forged. Put {i,t,s} in the checkout return URL: the claim uses `t` as the
// anchor so the 90-day pass always expires 90 days from PURCHASE (re-claims can't
// roll the window forward), and it survives a return in a fresh browser / cleared
// localStorage (the URL itself is the claim key). Returns "" if no secret.
export function signIntent(intentId: string, tsMs: number): string {
  if (!SECRET) return ""
  return createHmac("sha256", SECRET).update(`${intentId}.${tsMs}`).digest("hex").slice(0, 32)
}

/** Verify {intentId,tsMs,sig}. Returns the anchor ms if valid, else null. */
export function verifyIntentSig(intentId: string, tsMs: number, sig?: string | null): number | null {
  if (!SECRET || !sig || !Number.isFinite(tsMs)) return null
  const expected = signIntent(intentId, tsMs)
  try {
    const a = Buffer.from(sig), b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    return tsMs
  } catch { return null }
}
