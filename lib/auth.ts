"use client"

/**
 * Account layer — email + password, captured at the payment step.
 *
 * Built on Supabase Auth (the account follows the user across devices). Signup
 * goes through /api/auth/signup which admin-creates a PRE-CONFIRMED user, so
 * there's no confirmation-email friction blocking a purchase; the client then
 * signs in to get a session. Entitlements (the pass a user owns) live in
 * kloom_entitlements and are hydrated into local pass state on load.
 */
import { supabase } from "@/lib/supabase"
import { activatePass, type Pass } from "@/lib/pricing"

export interface AuthResult { ok: boolean; error?: string; existed?: boolean }

/** Create the account (pre-confirmed) and sign in. */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (res.status === 409) {
    // Already registered — try signing in with the supplied password.
    const si = await signIn(email, password)
    return si.ok ? { ok: true, existed: true } : { ok: false, error: "That email already has an account — wrong password?" }
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: data.error || "Could not create the account." }
  return signIn(email, password)
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function currentEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.email ?? null
}

async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

/** Persist a purchased pass to the account (server-side, service role). */
export async function grantPass(passId: Pass["id"]): Promise<boolean> {
  const token = await accessToken()
  if (!token) return false
  const res = await fetch("/api/entitlement", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ kind: "pass", passId }),
  })
  return res.ok
}

/** Persist purchased FlexiCalls minutes to the account. */
export async function grantCredits(minutes: number): Promise<boolean> {
  const token = await accessToken()
  if (!token) return false
  const res = await fetch("/api/entitlement", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ kind: "credits", addCredits: Math.round(minutes) }),
  })
  return res.ok
}

/** On load: pull the account's entitlement and activate the pass locally. */
export async function hydrateEntitlement(): Promise<void> {
  const token = await accessToken()
  if (!token) return
  try {
    const res = await fetch("/api/entitlement", { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const { entitlement } = await res.json()
    if (entitlement?.pass_id && entitlement.expires_at && Date.parse(entitlement.expires_at) > Date.now()) {
      // Re-activate locally with the SERVER's remaining time, not a fresh window.
      const remainingMs = Date.parse(entitlement.expires_at) - Date.now()
      try {
        localStorage.setItem("kloom_pass", JSON.stringify({ id: entitlement.pass_id, expiresAt: Date.now() + remainingMs }))
      } catch { /* ignore */ }
    }
  } catch { /* offline — local state stands */ }
}

/** Convenience for the purchase flow: activate locally AND persist to account. */
export async function completePassPurchase(passId: Pass["id"]) {
  activatePass(passId)
  await grantPass(passId)
}
