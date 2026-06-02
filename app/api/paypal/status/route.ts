/**
 * GET /api/paypal/status
 *
 * "Know first" diagnostic — confirms your PayPal credentials are present and VALID
 * (it requests a real OAuth token), and reports the environment. It never returns
 * the secret. The inline-card-fields (ACDC) eligibility itself is a client-side SDK
 * check (isEligible) shown on /paypal-status.
 */
import { NextResponse } from "next/server"
import { paypalConfigured, paypalEnv, verifyCredentials } from "@/lib/paypal"

export async function GET() {
  const clientId = process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ""
  const base = {
    configured:      paypalConfigured(),
    env:             paypalEnv(),
    clientIdPresent: !!clientId,
    clientIdMasked:  clientId ? `${clientId.slice(0, 6)}…${clientId.slice(-4)}` : null,
    secretPresent:   !!process.env.PAYPAL_CLIENT_SECRET,
  }
  if (!base.configured) return NextResponse.json({ ...base, credentialsValid: false })

  const v = await verifyCredentials()
  return NextResponse.json({ ...base, credentialsValid: v.ok, error: v.error ?? null })
}
