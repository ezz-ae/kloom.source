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

export function mintProToken(untilMs: number): string {
  if (!SECRET) throw new Error("AIRRAW_PRO_SECRET not configured — refusing to mint with an empty secret")
  // adult18:true records that the user affirmed 18+ at payment time (S1 age attestation).
  const payload = Buffer.from(JSON.stringify({ until: untilMs, v: 1, adult18: true })).toString("base64")
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex")
  return `${payload}.${sig}`
}

/** Verified claims from a Pro token, or null if invalid/expired/unsigned. */
export function proTokenClaims(token?: string | null): { until: number; v: number; adult18?: boolean } | null {
  if (!token || !SECRET) return null
  const [payload, sig] = token.split(".")
  if (!payload || !sig) return null
  try {
    const expected = createHmac("sha256", SECRET).update(payload).digest("hex")
    const a = Buffer.from(sig, "hex"), b = Buffer.from(expected, "hex")
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const claims = JSON.parse(Buffer.from(payload, "base64").toString())
    if (typeof claims.until !== "number" || claims.until <= Date.now()) return null
    return claims
  } catch { return null }
}

export function proTokenValid(token?: string | null): boolean {
  return proTokenClaims(token) !== null
}
