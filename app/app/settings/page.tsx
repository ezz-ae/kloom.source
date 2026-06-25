"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { TopUpSlider } from "@/components/widgets/TopUpSlider"
import { keepMemory, setKeepMemory, isSubscribed, hasUnrestricted, getShowAdult, setShowAdult } from "@/lib/account"
import { getProToken, proUntil } from "@/lib/airroom/pro"
import { hydrateEntitlement, currentEmail, signOut } from "@/lib/auth"
import { getCharacter, saveCharacter } from "@/lib/character"
import {
  Sparkles, User, MessageSquare, BookOpen, Shield, Trash2, Copy, Mail, Check,
  Flame, Loader2, X as XIcon, ArrowRight, Mic, Users, Compass, Bell, RotateCcw,
} from "lucide-react"

type Tab = "vibes" | "account" | "chat" | "docs"
const TABS: Array<{ id: Tab; label: string; icon: typeof User }> = [
  { id: "vibes",   label: "Vibes",   icon: Sparkles },
  { id: "account", label: "Account", icon: User },
  { id: "chat",    label: "Chat",    icon: MessageSquare },
  { id: "docs",    label: "Docs",    icon: BookOpen },
]

// ── The Vibes quiz — a few quick picks, then we shape a chat direction from them ──
type Opt = { k: string; label: string; vibe?: "chill" | "playful" | "intense" | "deep"; tone?: string; goal?: string; who?: string; never?: string; cat?: string }
const QUIZ: Array<{ id: string; q: string; opts: Opt[] }> = [
  { id: "q1", q: "What pulls you here?", opts: [
    { k: "build", label: "Get things done", goal: "think and build things out loud", cat: "workshop" },
    { k: "fun",   label: "Fun & banter",    goal: "mess around and laugh", cat: "social" },
    { k: "deep",  label: "Deep talk",       goal: "go deep on what's on my mind", cat: "philosophy" },
    { k: "edge",  label: "The edge",         goal: "go wherever it takes us, no rails", cat: "dark" },
  ]},
  { id: "q2", q: "Your energy right now?", opts: [
    { k: "calm",    label: "Calm",       vibe: "chill" },
    { k: "play",    label: "Playful",    vibe: "playful" },
    { k: "intense", label: "Intense",    vibe: "intense" },
    { k: "reflect", label: "Reflective", vibe: "deep" },
  ]},
  { id: "q3", q: "How blunt should they be?", opts: [
    { k: "gentle", label: "Gentle",          tone: "warm and gentle" },
    { k: "honest", label: "Honest",          tone: "honest and direct" },
    { k: "brutal", label: "Brutally honest", tone: "brutally honest, never softening it" },
  ]},
  { id: "q4", q: "Pick your scene", opts: [
    { k: "trade",  label: "Trading floor",   cat: "trading" },
    { k: "create", label: "Creative studio", cat: "creator" },
    { k: "night",  label: "Late-night talk", cat: "social" },
    { k: "any",    label: "Anything goes",   cat: "dark" },
  ]},
  { id: "q5", q: "Solo or a crowd?", opts: [
    { k: "solo", label: "One voice",   who: "one-on-one" },
    { k: "few",  label: "A few",       who: "a small group" },
    { k: "room", label: "A full room", who: "a lively full room" },
  ]},
  { id: "q6", q: "What should they never do?", opts: [
    { k: "sugar",  label: "Sugarcoat",   never: "sugarcoat or talk down to me" },
    { k: "boring", label: "Get boring",  never: "be boring or play it safe" },
    { k: "hold",   label: "Hold back",   never: "hold back" },
  ]},
]

function composeVibe(picks: Record<string, Opt>) {
  const vibe = picks.q2?.vibe || "chill"
  const goal = picks.q1?.goal || "just talk"
  const tone = picks.q3?.tone || "honest and direct"
  const who  = picks.q5?.who  || "one-on-one"
  const never = picks.q6?.never || "be boring"
  const cats = [picks.q1?.cat, picks.q4?.cat].filter(Boolean) as string[]
  const direction = `Talk to me ${tone}. I'm here to ${goal}, ${who}. Never ${never}.`
  return { vibe, direction, cats: Array.from(new Set(cats)) }
}

// Static class maps — Tailwind can't generate class names from interpolated strings.
const TINT: Record<string, string> = {
  amber: "bg-amber-500/15 border-amber-500/20 text-amber-400",
  rose:  "bg-rose-500/15 border-rose-500/20 text-rose-400",
  sky:   "bg-sky-500/15 border-sky-500/20 text-sky-400",
  red:   "bg-red-500/15 border-red-500/20 text-red-400",
}
const TOGGLE_ON: Record<string, string> = { amber: "bg-amber-500", rose: "bg-rose-500", sky: "bg-sky-500" }

function Section({ icon: Icon, title, sub, children, tint = "amber" }: { icon: typeof User; title: string; sub?: string; children: React.ReactNode; tint?: string }) {
  return (
    <section className="bg-card border border-border/50 rounded-3xl p-5 sm:p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${TINT[tint] || TINT.amber}`}>
          <Icon size={15} />
        </div>
        <div>
          <h2 className="font-bold text-sm">{title}</h2>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function Toggle({ on, onClick, color = "amber" }: { on: boolean; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick} className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${on ? (TOGGLE_ON[color] || TOGGLE_ON.amber) : "bg-white/15"}`}>
      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  )
}

function SettingsContent() {
  const params = useSearchParams()
  const router = useRouter()
  const raw = params.get("tab")
  // billing/preferences (old deep-links + the sidebar pass CTA) fold into Account.
  const activeTab: Tab = (TABS.find((t) => t.id === raw)?.id) || (raw === "billing" || raw === "preferences" ? "account" : "vibes")

  // shared
  const [premium, setPremium] = useState(false)
  const [unrestricted, setUnrestricted] = useState(false)
  useEffect(() => { setPremium(isSubscribed()); setUnrestricted(hasUnrestricted()); hydrateEntitlement() }, [])

  // ── Vibes ──
  const [step, setStep] = useState(0)          // -1 = result shown
  const [picks, setPicks] = useState<Record<string, Opt>>({})
  const [savedVibe, setSavedVibe] = useState("")
  const [showAdultOn, setShowAdultOn] = useState(false)
  useEffect(() => {
    const c = getCharacter()
    if (c.chatDirection) { setSavedVibe(c.chatDirection); setStep(-1) }
    setShowAdultOn(getShowAdult())
  }, [])
  const pick = (qid: string, opt: Opt) => {
    const next = { ...picks, [qid]: opt }
    setPicks(next)
    if (step < QUIZ.length - 1) setStep(step + 1)
    else {
      const { vibe, direction, cats } = composeVibe(next)
      const c = getCharacter()
      saveCharacter({ ...c, vibe, chatDirection: direction, preferredCategories: Array.from(new Set([...c.preferredCategories, ...cats])) as never })
      setSavedVibe(direction); setStep(-1)
    }
  }
  const retake = () => { setPicks({}); setStep(0); setSavedVibe("") }
  const toggleAdult = () => {
    if (!premium) { router.push("/app/settings?tab=account"); return }   // must be paid to edit
    const n = !showAdultOn; setShowAdultOn(n); setShowAdult(n)
  }

  // ── Account ──
  const [email, setEmail] = useState<string | null>(null)
  useEffect(() => { currentEmail().then(setEmail) }, [])
  const [proToken, setProTok] = useState<string | null>(null)
  const [passUntil, setPassUntil] = useState(0)
  const [copied, setCopied] = useState(false)
  const [restoreEmail, setRestoreEmail] = useState("")
  const [mailState, setMailState] = useState<"" | "sending" | "sent" | "err">("")
  useEffect(() => { setProTok(getProToken()); setPassUntil(proUntil()) }, [])
  const [memOn, setMemOn] = useState(true)
  useEffect(() => { setMemOn(keepMemory()) }, [])
  const [topUpOpen, setTopUpOpen] = useState(false)
  const copyCode = () => { if (proToken) navigator.clipboard?.writeText(proToken).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {}) }
  const emailCode = async () => {
    const e = restoreEmail.trim(); if (!e || !proToken || mailState === "sending") return
    setMailState("sending")
    try {
      const r = await fetch("/api/send-restore-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: e, token: proToken }) })
      const d = await r.json().catch(() => ({})); setMailState(r.ok && d?.ok ? "sent" : "err")
    } catch { setMailState("err") }
  }

  // ── Chat ──
  const [autoMic, setAutoMic] = useState(true)
  const [notifs, setNotifs] = useState(true)

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border px-6 lg:px-8 py-5">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-black tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your vibe, account, chat and how it all works.</p>
        </div>
      </div>

      {/* Tab strip */}
      <div className="sticky top-[73px] z-10 bg-background/80 backdrop-blur-md border-b border-border/60">
        <div className="max-w-3xl mx-auto px-6 lg:px-8 flex gap-1 overflow-x-auto scrollbar-hide">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => router.push(`/app/settings?tab=${t.id}`)}
              className={`shrink-0 flex items-center gap-2 px-3 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === t.id ? "border-amber-400 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-6 pb-28 space-y-5">

        {/* ════ VIBES ════ */}
        {activeTab === "vibes" && (
          <>
            <Section icon={Sparkles} title="Your vibe" sub="A few quick picks — we shape how rooms talk to you.">
              {step >= 0 ? (
                <div>
                  <div className="flex items-center gap-1.5 mb-4">
                    {QUIZ.map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-amber-400" : "bg-foreground/10"}`} />)}
                  </div>
                  <div className="text-lg font-bold mb-4">{QUIZ[step].q}</div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {QUIZ[step].opts.map((o) => (
                      <button key={o.k} onClick={() => pick(QUIZ[step].id, o)}
                        className="text-left px-4 py-3.5 rounded-2xl border border-border/60 bg-foreground/[0.03] hover:border-amber-400/50 hover:bg-amber-500/[0.06] text-sm font-semibold transition-all">
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {step > 0 && <button onClick={() => setStep(step - 1)} className="mt-4 text-xs text-muted-foreground hover:text-foreground">← back</button>}
                </div>
              ) : (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-amber-400/80 mb-2">Your chat direction</div>
                  <p className="text-[15px] leading-relaxed text-foreground/90 bg-foreground/[0.04] border border-border/50 rounded-2xl p-4">{savedVibe}</p>
                  <p className="text-[11px] text-muted-foreground mt-2.5">Carried into every room as a steer — so they meet you where you are.</p>
                  <button onClick={retake} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
                    <RotateCcw size={13} /> Retake
                  </button>
                </div>
              )}
            </Section>

            {/* Display adult rooms — must hold the pass to edit */}
            <Section icon={Flame} title="Display 18+ rooms" sub="Off by default." tint="rose">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {premium ? <>Show 18+ rooms in your feed. Turn it off anytime.</> : <>Unlocks with <Link href="/app/settings?tab=account" className="text-foreground/70 underline underline-offset-2">the pass</Link>.</>}
                </p>
                <Toggle on={showAdultOn && premium} onClick={toggleAdult} color="rose" />
              </div>
            </Section>
          </>
        )}

        {/* ════ ACCOUNT ════ */}
        {activeTab === "account" && (
          <>
            <Section icon={User} title="Email" sub={email ? "Signed in — your pass follows this account." : "Add an email so your pass follows you on any device."}>
              {email ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold truncate">{email}</div>
                  <button onClick={async () => { await signOut(); setEmail(null) }} className="text-xs font-semibold text-muted-foreground hover:text-foreground shrink-0">Sign out</button>
                </div>
              ) : (
                <Link href="/app/reset" className="inline-flex items-center gap-1.5 bg-foreground/[0.06] hover:bg-foreground/10 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                  <Mail size={14} /> Add email
                </Link>
              )}
            </Section>

            <Section icon={Sparkles} title="Your plan" sub={premium ? "Pass active · 90 days · 6000 min" : "Free to chat · pay only for voice"}>
              {premium ? (
                <div className="flex items-center gap-2 text-sm"><Check size={16} className="text-emerald-400" /> The pass is active{passUntil > 0 && <span className="text-muted-foreground">· until {new Date(passUntil).toISOString().slice(0, 10)}</span>}</div>
              ) : (
                <button onClick={() => setTopUpOpen(true)} className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm px-4 py-2.5 rounded-xl transition-all">Get the pass — $9</button>
              )}
            </Section>

            {proToken && (
              <Section icon={Shield} title="Restore purchase" sub="Your pass code — paste it on any browser to restore.">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 min-w-0 truncate text-[11px] font-mono bg-foreground/5 border border-border/50 rounded-xl px-3 py-2.5 text-muted-foreground">{proToken}</code>
                    <button onClick={copyCode} className="flex items-center gap-1.5 bg-foreground/10 hover:bg-foreground/15 text-xs font-bold px-3 py-2.5 rounded-xl shrink-0">{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input value={restoreEmail} onChange={(e) => { setRestoreEmail(e.target.value); setMailState("") }} type="email" placeholder="email it to me…" className="flex-1 min-w-0 bg-foreground/5 border border-border/50 rounded-xl px-3 py-2.5 text-sm focus:border-amber-400/50 focus:outline-none" />
                    <button onClick={emailCode} disabled={mailState === "sending" || !restoreEmail.trim()} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold px-3 py-2.5 rounded-xl shrink-0 disabled:opacity-60"><Mail size={14} /> {mailState === "sending" ? "Sending…" : mailState === "sent" ? "Sent ✓" : "Email me"}</button>
                  </div>
                  <p className="text-[11px] text-muted-foreground/70 flex items-start gap-1.5"><Shield size={12} className="text-amber-400/70 shrink-0 mt-0.5" /> Anyone with this code can unlock your pass — keep it private.</p>
                </div>
              </Section>
            )}

            <Section icon={User} title="Payment method" sub="Pay by card via Ziina — no card stored here.">
              <p className="text-xs text-muted-foreground">The pass is a one-time card payment through Ziina. Nothing is saved on file or auto-renewed.</p>
            </Section>

            <Section icon={Shield} title="Memory" sub="Keep chat history on this device." tint="sky">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground leading-relaxed">Rooms remember your conversations <span className="text-foreground/70">locally</span> so they pick up where you left off. Off = clean slate, and it wipes what&apos;s stored.</p>
                <Toggle on={memOn} onClick={() => { const n = !memOn; setMemOn(n); setKeepMemory(n) }} color="sky" />
              </div>
            </Section>

            <Section icon={Trash2} title="Delete account" sub="Wipe everything on this device." tint="red">
              <p className="text-xs text-muted-foreground mb-3">Removes your chat history, settings, vibe, and cached pass from this browser. This cannot be undone.</p>
              <button onClick={() => { if (confirm("Delete everything on this device? This cannot be undone.")) { localStorage.clear(); window.location.href = "/app" } }}
                className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"><Trash2 size={14} /> Delete account</button>
            </Section>
          </>
        )}

        {/* ════ CHAT ════ */}
        {activeTab === "chat" && (
          <>
            <Section icon={MessageSquare} title="Chat settings">
              <div className="divide-y divide-white/5 -my-1">
                <div className="flex items-center justify-between gap-3 py-3.5">
                  <div className="flex items-center gap-3"><Mic size={16} className="text-muted-foreground shrink-0" /><div><div className="text-sm font-medium">Auto-pickup mic</div><div className="text-[11px] text-foreground/35 mt-0.5">Start listening the moment a call connects</div></div></div>
                  <Toggle on={autoMic} onClick={() => setAutoMic((v) => !v)} />
                </div>
                <div className="flex items-center justify-between gap-3 py-3.5">
                  <div className="flex items-center gap-3"><Bell size={16} className="text-muted-foreground shrink-0" /><div><div className="text-sm font-medium">Notifications</div><div className="text-[11px] text-foreground/35 mt-0.5">When a friend or matched room goes live</div></div></div>
                  <Toggle on={notifs} onClick={() => setNotifs((v) => !v)} />
                </div>
              </div>
            </Section>

            <div className="grid grid-cols-2 gap-3">
              {[
                { href: "/app/rooms", icon: Users, label: "Rooms", sub: "Every room, clone any" },
                { href: "/app/discover", icon: Compass, label: "Explore", sub: "Browse characters" },
                { href: "/app/create", icon: Sparkles, label: "Voices", sub: "Build a cast & clone a voice" },
                { href: "/app/rooms", icon: Mail, label: "Invite", sub: "Bring a friend in" },
              ].map((c) => (
                <Link key={c.label} href={c.href} className="group bg-card border border-border/50 rounded-3xl p-5 hover:border-foreground/25 transition-all">
                  <c.icon size={18} className="text-amber-400 mb-3" />
                  <div className="font-bold text-sm flex items-center gap-1">{c.label} <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" /></div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* ════ DOCS ════ */}
        {activeTab === "docs" && (
          <Section icon={BookOpen} title="How Kloom works" sub="The short version.">
            <div className="space-y-5">
              {[
                { t: "Every conversation is a room", b: "A room is a cast of AI characters — pick a built one, or build your own. They reply in the chat and, when you start a call, talk out loud in real voices." },
                { t: "Three minds, one room", b: "Claude, Gemini and GPT can sit in the same room and build on each other — one drafts, one refines, one pulls live data. You steer." },
                { t: "Talk, don't type", b: "Tap the call button and just speak. Replies come back as natural voice in 50+ languages — interrupt and they respond like a person." },
                { t: "Free to chat, one pass for voice", b: "Text chat is free forever, no signup. Live voice runs on a single pass — $9 for 90 days and 6000 minutes, paid once by card. No subscription." },
                { t: "Build & clone", b: "Describe a room and the architect builds the cast in seconds. Clone any community room into your own with one tap, then make it yours." },
                { t: "Private by default", b: "Conversations live on your device, not our servers. Turn memory off any time for a clean slate — it also wipes what's stored." },
              ].map((d) => (
                <div key={d.t} className="border-b border-white/[0.06] pb-5 last:border-0 last:pb-0">
                  <div className="font-bold text-sm mb-1.5">{d.t}</div>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{d.b}</p>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>

      {topUpOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5" onClick={() => setTopUpOpen(false)}>
          <div className="w-full max-w-md rounded-3xl border border-border/60 bg-background p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-black text-lg">The pass</h3><button onClick={() => setTopUpOpen(false)} className="text-muted-foreground hover:text-foreground"><XIcon size={18} /></button></div>
            <TopUpSlider onDone={() => { setTopUpOpen(false); setPremium(isSubscribed()) }} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  return <Suspense fallback={<div className="min-h-full flex items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>}><SettingsContent /></Suspense>
}
