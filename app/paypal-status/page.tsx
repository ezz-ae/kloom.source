"use client"

/**
 * /paypal-status — "know first" diagnostic for PayPal.
 *
 * Tells you, in plain language, BEFORE you rely on it:
 *   1. Are the credentials set and VALID (real OAuth token)?  → /api/paypal/status
 *   2. Which environment (live / sandbox)?
 *   3. Are INLINE card fields (Advanced Card Payments) eligible on this account?
 *      → the PayPal SDK's own isEligible() — the definitive answer.
 * If inline isn't eligible, buyers still pay by card via the button fallback.
 */
import { useEffect, useState } from "react"

const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ""

function Row({ label, ok, note }: { label: string; ok: boolean | null; note?: string }) {
  const color = ok === null ? "text-foreground/40" : ok ? "text-emerald-400" : "text-red-400"
  const mark  = ok === null ? "…" : ok ? "✅" : "❌"
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border/30">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        {note && <div className="text-xs text-foreground/40 mt-0.5">{note}</div>}
      </div>
      <div className={`text-sm font-bold shrink-0 ${color}`}>{mark}</div>
    </div>
  )
}

export default function PayPalStatusPage() {
  const [server, setServer] = useState<any>(null)
  const [sdkLoaded, setSdkLoaded] = useState<boolean | null>(null)
  const [eligible, setEligible]   = useState<boolean | null>(null)
  const [eligErr, setEligErr]     = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/paypal/status").then((r) => r.json()).then(setServer).catch(() => setServer({ error: "status_failed" }))
  }, [])

  useEffect(() => {
    if (!CLIENT_ID) { setSdkLoaded(false); return }
    const s = document.createElement("script")
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(CLIENT_ID)}&components=buttons,card-fields&currency=USD&intent=capture`
    s.onload = () => {
      setSdkLoaded(true)
      try {
        const paypal = (window as any).paypal
        const cf = paypal.CardFields({ createOrder: async () => "", onApprove: async () => {} })
        setEligible(!!cf.isEligible())
      } catch (e: any) { setEligErr(String(e?.message || e)); setEligible(false) }
    }
    s.onerror = () => { setSdkLoaded(false); setEligErr("SDK failed to load (check client id / network)") }
    document.body.appendChild(s)
  }, [])

  const envBadge = server?.env === "sandbox"
    ? <span className="text-amber-300">SANDBOX</span>
    : <span className="text-emerald-300">LIVE</span>

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-16">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-black tracking-tight">PayPal readiness</h1>
        <p className="text-sm text-foreground/50 mt-1">Confirms your account is ready for embedded card payments.</p>

        <div className="mt-8 rounded-2xl border border-border/50 bg-foreground/5 px-5">
          <Row label="Environment" ok={server ? true : null}
               note={server ? undefined : "checking…"} />
          {server && (
            <div className="flex items-center justify-between py-3 border-b border-border/30">
              <div className="text-sm font-semibold">Mode</div>
              <div className="text-sm font-bold">{envBadge}</div>
            </div>
          )}
          <Row label="Client ID set" ok={server ? server.clientIdPresent : null}
               note={server?.clientIdMasked ?? "NEXT_PUBLIC_PAYPAL_CLIENT_ID"} />
          <Row label="Secret set" ok={server ? server.secretPresent : null}
               note="PAYPAL_CLIENT_SECRET (server-only)" />
          <Row label="Credentials valid (live OAuth token)" ok={server ? server.credentialsValid : null}
               note={server?.error ? `error: ${server.error}` : "proves the keys actually work"} />
          <Row label="PayPal SDK loads in browser" ok={sdkLoaded} />
          <Row label="Inline card fields eligible (ACDC)" ok={eligible}
               note={eligible === false
                 ? "Not enabled — buyers pay by card via the button fallback. Request 'Advanced Credit and Debit Card Payments' in your PayPal dashboard."
                 : eligErr ?? "the definitive answer for embedded card fields"} />
        </div>

        <div className="mt-6 text-xs text-foreground/40 leading-relaxed space-y-2">
          <p><span className="text-foreground/70 font-semibold">What “ready” looks like:</span> all green, Mode = LIVE,
            and “Inline card fields eligible” = ✅. Then buyers type their card right in the app — no PayPal login.</p>
          <p><span className="text-foreground/70 font-semibold">If inline = ❌:</span> everything still works — buyers use the
            PayPal button (one extra tap, still no account needed). Enable Advanced Card Payments in your dashboard to switch to inline.</p>
          <p><span className="text-foreground/70 font-semibold">Tip:</span> set <code>PAYPAL_ENV=sandbox</code> with sandbox keys to test the
            full inline flow today — sandbox business accounts are ACDC-eligible by default.</p>
        </div>
      </div>
    </div>
  )
}
