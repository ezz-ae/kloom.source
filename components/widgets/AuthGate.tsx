"use client"

/**
 * Account gate at the payment step. A user only needs an account to PAY — text
 * chat and browsing stay anonymous. Collects email + password (sign up or sign
 * in), then renders its children (the checkout) once a session exists.
 */
import { useState, useEffect } from "react"
import { signUp, signIn, currentEmail } from "@/lib/auth"
import { Loader2, Mail, Lock, Check } from "lucide-react"

export function AuthGate({ children, intent = "to continue" }: { children: React.ReactNode; intent?: string }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<"signup" | "signin">("signup")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [authedEmail, setAuthedEmail] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => { currentEmail().then((e) => { setAuthedEmail(e); setChecked(true) }) }, [])

  const submit = async () => {
    setErr(null); setBusy(true)
    const fn = mode === "signup" ? signUp : signIn
    const r = await fn(email, password)
    setBusy(false)
    if (!r.ok) { setErr(r.error || "Something went wrong."); return }
    setAuthedEmail(email.trim().toLowerCase())
  }

  if (!checked) {
    return <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
  }

  // Signed in → show the checkout.
  if (authedEmail) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-semibold">
          <Check size={12} /> Signed in as {authedEmail}
        </div>
        {children}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Create an account {intent} — so your pass follows you on any device.</p>

      <div className="relative">
        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="w-full bg-foreground/5 border border-border/50 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/50 transition-all" />
      </div>
      <div className="relative">
        <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
        <input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit() }}
          placeholder={mode === "signup" ? "Choose a password (8+ chars)" : "Your password"}
          className="w-full bg-foreground/5 border border-border/50 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/50 transition-all" />
      </div>

      {err && <p className="text-xs text-rose-400">{err}</p>}

      <button onClick={submit} disabled={busy || !email || !password}
        className="w-full flex items-center justify-center gap-2 brand-gradient text-stone-950 font-bold py-3 rounded-xl brand-glow hover:scale-[1.01] active:scale-[0.99] transition-transform disabled:opacity-50">
        {busy ? <Loader2 size={15} className="animate-spin" /> : null}
        {mode === "signup" ? "Create account & continue" : "Sign in & continue"}
      </button>

      <button onClick={() => { setMode((m) => (m === "signup" ? "signin" : "signup")); setErr(null) }}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">
        {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </div>
  )
}
