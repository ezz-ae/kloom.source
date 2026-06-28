"use client"

/**
 * Password reset landing — the Supabase recovery email links here. Supabase
 * puts the recovery session in the URL hash; the auth client picks it up
 * automatically, so we just let the user set a new password.
 */
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { updatePassword } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { SITE } from "@/lib/variant"
import { Loader2, Lock, Check } from "lucide-react"

export default function ResetPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // The recovery token arrives in the URL hash; Supabase establishes a session.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const submit = async () => {
    if (password.length < 8) { setErr("Password must be at least 8 characters."); return }
    setBusy(true); setErr(null)
    const r = await updatePassword(password)
    setBusy(false)
    if (!r.ok) { setErr(r.error || "Could not update password."); return }
    setDone(true)
    setTimeout(() => router.push("/app/settings?tab=billing"), 1500)
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-5">
      <div className="max-w-sm w-full rounded-3xl border border-border/50 bg-foreground/5 p-7">
        <div className="text-[13px] tracking-[6px] uppercase font-bold text-amber-400 mb-6">{SITE.name}</div>

        {done ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4">
              <Check size={20} className="text-emerald-400" />
            </div>
            <h1 className="text-xl font-black">Password updated</h1>
            <p className="text-sm text-muted-foreground mt-1">Taking you back…</p>
          </div>
        ) : !ready ? (
          <div className="text-center py-6">
            <Loader2 size={20} className="animate-spin text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Opening your reset link…</p>
            <p className="text-[11px] text-muted-foreground/50 mt-2">If this hangs, request a new link — they expire after an hour.</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-black tracking-tight mb-2">Set a new password</h1>
            <p className="text-sm text-muted-foreground mb-5">Choose a new password for your account.</p>
            <div className="relative mb-3">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
              <input type="password" autoComplete="new-password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit() }}
                placeholder="New password (8+ chars)"
                className="w-full bg-background/50 border border-border/50 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/50 transition-all" />
            </div>
            {err && <p className="text-xs text-rose-400 mb-3">{err}</p>}
            <button onClick={submit} disabled={busy || !password}
              className="w-full flex items-center justify-center gap-2 brand-gradient text-stone-950 font-bold py-3 rounded-xl brand-glow hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : null}
              Update password
            </button>
          </>
        )}
      </div>
    </div>
  )
}
