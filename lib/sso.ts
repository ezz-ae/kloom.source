"use client"

/**
 * Cross-domain SSO hand-off for the .io → .fun "tap".
 *
 * .io and .fun are separate domains but share ONE Supabase project (so one
 * account + one credit balance). Cookies can't cross domains, so when a signed-in
 * user taps through to .fun we carry their session in the URL fragment (never
 * sent to a server) and restore it on the other side. Result: one wallet, one
 * login, content still firewalled onto its own domain.
 */
import { supabase } from "@/lib/supabase"
import { FUN_ORIGIN } from "@/lib/room-share"

/** Build a kloom.fun URL that lands the user already signed in (shared account +
 *  credits). Falls back to a plain link when there's no session. */
export async function funHandoffUrl(path = "/app"): Promise<string> {
  const base = `${FUN_ORIGIN}${path.startsWith("/") ? path : "/" + path}`
  try {
    const { data } = await supabase.auth.getSession()
    const s = data.session
    if (!s?.access_token || !s?.refresh_token) return base
    const payload = btoa(JSON.stringify({ a: s.access_token, r: s.refresh_token }))
    return `${base}#kloom_sso=${encodeURIComponent(payload)}`
  } catch {
    return base
  }
}

/** On the receiving (.fun) side: if a hand-off token is present, restore the
 *  session, then strip it from the URL. No-op (and harmless) without a token. */
export async function consumeSso(): Promise<boolean> {
  if (typeof window === "undefined") return false
  const m = window.location.hash.match(/kloom_sso=([^&]+)/)
  if (!m) return false
  try {
    const { a, r } = JSON.parse(atob(decodeURIComponent(m[1])))
    if (a && r) await supabase.auth.setSession({ access_token: a, refresh_token: r })
  } catch { /* ignore a malformed token */ }
  try {
    const url = new URL(window.location.href)
    url.hash = url.hash.replace(/[#&]?kloom_sso=[^&]+/, "")
    window.history.replaceState({}, "", url.toString())
  } catch { /* ignore */ }
  return true
}
