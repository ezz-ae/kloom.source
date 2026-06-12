// POST /api/auth/signup — create a pre-confirmed account at the payment step.
//
// Uses the Supabase admin API to create the user with email_confirm:true, so
// there is no confirmation-email round trip blocking the purchase. The client
// then signs in normally to get a session. If the email already exists we
// return a soft signal so the UI can switch to "sign in" instead.

import { getAdminClient, hasAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!hasAdmin()) {
    return Response.json({ error: "Accounts are not configured." }, { status: 503 })
  }

  let email = "", password = ""
  try {
    const body = await request.json()
    email = String(body.email || "").trim().toLowerCase()
    password = String(body.password || "")
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 })
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email." }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 })
  }

  const admin = getAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    const msg = error.message || ""
    if (/already.*regist|already.*exist|duplicate/i.test(msg)) {
      return Response.json({ exists: true }, { status: 409 })
    }
    return Response.json({ error: msg || "Could not create the account." }, { status: 400 })
  }

  // Seed an empty entitlement row so later upserts are simple.
  if (data.user) {
    await admin.from("kloom_entitlements").upsert({
      user_id: data.user.id, email, credits: 0,
    }, { onConflict: "user_id" })
  }

  return Response.json({ ok: true })
}
