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
  const payload = Buffer.from(JSON.stringify({ until: untilMs, v: 1 })).toString("base64")
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex")
  return `${payload}.${sig}`
}

export function proTokenValid(token?: string | null): boolean {
  if (!token || !SECRET) return false   // no server secret → fail closed, never validate
  const [payload, sig] = token.split(".")
  if (!payload || !sig) return false
  try {
    const expected = createHmac("sha256", SECRET).update(payload).digest("hex")
    const a = Buffer.from(sig, "hex"), b = Buffer.from(expected, "hex")
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false
    const { until } = JSON.parse(Buffer.from(payload, "base64").toString())
    return typeof until === "number" && until > Date.now()
  } catch { return false }
}
