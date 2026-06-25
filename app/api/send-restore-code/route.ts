// Email the user their own pass code (restore code). The pass is anonymous — the
// signed token IS the credential — so we don't require auth; we just validate the
// token shape, rate-limit hard by IP (it sends mail), and hand it to Resend. Mail is
// a no-op if RESEND_API_KEY is unset (returns ok:false with a clear message).

import { sendRestoreCode, emailEnabled } from "@/lib/email"
import { rateLimit, clientIp } from "@/lib/rate-limit"

export const runtime = "nodejs"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Parse the pass expiry from the token payload (base64(JSON).hexsig) for a friendly date.
function tokenExpiry(token: string): string | undefined {
  try {
    const json = JSON.parse(Buffer.from(token.split(".")[0], "base64").toString("utf8"))
    if (typeof json.until === "number" && json.until > Date.now()) {
      return new Date(json.until).toISOString().slice(0, 10) // YYYY-MM-DD
    }
  } catch { /* ignore */ }
  return undefined
}

export async function POST(request: Request) {
  // Hard rate limit — this sends email, a prime abuse target.
  const rl = rateLimit(`restore-mail:${clientIp(request)}`, 5, 60 * 60_000) // 5 / hour / IP
  if (!rl.ok) return Response.json({ ok: false, error: "Too many requests — try again later." }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } })

  let body: { email?: string; token?: string }
  try { body = await request.json() } catch { return Response.json({ ok: false, error: "Bad request." }, { status: 400 }) }

  const email = (body.email || "").trim()
  const token = (body.token || "").trim()
  if (!EMAIL_RE.test(email)) return Response.json({ ok: false, error: "Enter a valid email." }, { status: 400 })
  // The token must look like our signed pass: base64payload.hexsignature.
  if (!token || token.split(".").length !== 2 || token.length < 24) {
    return Response.json({ ok: false, error: "No valid pass code to send." }, { status: 400 })
  }

  if (!emailEnabled()) {
    return Response.json({ ok: false, error: "Email isn't enabled yet — copy the code instead." }, { status: 503 })
  }

  const sent = await sendRestoreCode({ to: email, token, expires: tokenExpiry(token) })
  if (!sent) return Response.json({ ok: false, error: "Couldn't send right now — copy the code instead." }, { status: 502 })
  return Response.json({ ok: true })
}
