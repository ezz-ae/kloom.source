import { supabase } from "@/lib/supabase"
import { rateLimit, clientIp } from "@/lib/rate-limit"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Capture a founding-access email from the landing. Stored in Supabase
// `airraw_leads`. We always return ok on a valid email so the capture UX
// completes even if the store hiccups (the failure is logged, not shown).
export async function POST(request: Request) {
  const rl = rateLimit(`lead:${clientIp(request)}`, 10, 60_000)
  if (!rl.ok) return Response.json({ ok: false }, { status: 429 })

  let body: { email?: string; source?: string }
  try { body = await request.json() } catch { return Response.json({ ok: false }, { status: 400 }) }

  const email = (body.email || "").trim().toLowerCase().slice(0, 200)
  if (!EMAIL.test(email)) return Response.json({ ok: false, error: "invalid email" }, { status: 400 })
  const source = (body.source || "airraw").slice(0, 60)

  try {
    // Write via a SECURITY DEFINER function: anon can record a lead but can't read
    // the list back (no SELECT policy), which also avoids the RETURNING/RLS trap.
    const { error } = await supabase.rpc("add_airraw_lead", { p_email: email, p_source: source })
    if (error) console.error("[lead] insert failed:", error.message)
  } catch (e) {
    console.error("[lead] insert threw:", e instanceof Error ? e.message : String(e))
  }
  return Response.json({ ok: true })
}
