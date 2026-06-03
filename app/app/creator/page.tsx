"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { MessageRenderer } from "@/components/widgets/MessageRenderer"
import {
  Sparkles, Coins, ClipboardList, ShoppingBag, Bot,
  ChevronLeft, Send, ArrowRight, Users, Check,
} from "lucide-react"

// ── The five build verticals ──────────────────────────────────────────────
// Each is a guided AI workspace. `persona` is sent to /api/mcp-chat — built-in
// categories (creator/trading/professional) or an inline expert (kloom_expert).

interface Mode {
  id: string
  name: string
  icon: typeof Sparkles
  accent: string          // tailwind color stem
  tagline: string
  intro: string
  starters: string[]
  persona: Record<string, unknown>
  relatedRoom?: { id: string; label: string }
}

const MODES: Mode[] = [
  {
    id: "content",
    name: "Content Creation",
    icon: Sparkles,
    accent: "pink",
    tagline: "Captions, hashtags, calendars, and a 90-day growth plan.",
    intro: "I'm Zara — your content strategist. Tell me your platform and niche, or paste your profile, and we'll build your content engine.",
    starters: ["Write an Instagram caption about my morning routine", "Plan my content for this week", "Generate 20 video ideas for my niche", "Grow my account to 10K"],
    persona: { name: "Zara", category: "creator" },
  },
  {
    id: "token",
    name: "Token Launching",
    icon: Coins,
    accent: "emerald",
    tagline: "Tokenomics, contract audit, wallet, and a launch playbook.",
    intro: "I'm Viktor — ex-HFT, 30+ launches. Tell me your idea and I'll architect the tokenomics, check the contract, and walk you to a fair launch.",
    starters: ["Design tokenomics for a 1B supply token", "Review my contract for safety", "Walk me through a fair launch on Solana", "Create a treasury wallet"],
    persona: { name: "Viktor Sol", category: "trading" },
    relatedRoom: { id: "launch-war-room", label: "Open the Launch War Room (Claude + Gemini)" },
  },
  {
    id: "project",
    name: "Project Planning",
    icon: ClipboardList,
    accent: "violet",
    tagline: "Turn any idea into milestones, a timeline, and first tasks.",
    intro: "I'm Iris. Tell me what you're building and by when — I'll turn it into phases, a critical path, and the exact first week of work.",
    starters: ["Plan my app launch in 8 weeks", "Roadmap to learn coding", "Organize a product roadmap", "Plan an event"],
    persona: {
      name: "Iris", category: "expert",
      domain: "project planning and execution",
      expertise: "Milestones, dependencies, realistic timelines, risk buffers, critical path. You fight scope creep and the planning fallacy, and sequence work so momentum compounds.",
      outputFormat: "1) The goal, sharpened. 2) Phases with milestones. 3) The first week's concrete tasks. 4) The #1 risk and how to defuse it. Under 180 words.",
      forbidden: "vague timelines, ignoring dependencies, over-planning before starting, no first action",
      tools: ["kloom_get_strategy", "kloom_calculate", "kloom_web_search"],
    },
  },
  {
    id: "store",
    name: "Online Store",
    icon: ShoppingBag,
    accent: "amber",
    tagline: "Design a store, name products, write copy, set pricing.",
    intro: "I'm Mercer — I build e-commerce brands. Tell me what you want to sell and we'll shape the store, the products, the copy, and the pricing.",
    starters: ["Create a store for handmade candles", "Write product descriptions that sell", "Price my product line", "Name my brand"],
    persona: {
      name: "Mercer", category: "expert",
      domain: "e-commerce and online store building",
      expertise: "Shopify setup, product positioning, pricing psychology, conversion, brand naming, store structure, and launch. You know what makes a store convert vs. collect dust.",
      outputFormat: "Give the specific recommendation, a concrete example (real copy/price/name), and the one thing most stores get wrong. Under 170 words.",
      forbidden: "generic 'just start selling', ignoring margins, vague branding advice, dropshipping hype",
      tools: ["kloom_web_search", "kloom_canva_design", "kloom_financial_calc", "kloom_instagram_caption"],
    },
  },
  {
    id: "ai-app",
    name: "AI Application",
    icon: Bot,
    accent: "cyan",
    tagline: "Build an AI-powered app — write code, preview, ship.",
    intro: "I'm Kaia — senior engineer. Tell me what you want to build and I'll write the code, you can run it inline, and we iterate until it ships.",
    starters: ["Build a chatbot widget", "Generate a landing page", "Connect two APIs with a webhook", "Build a Solana token dashboard"],
    persona: { name: "Kaia", category: "professional" },
    relatedRoom: { id: "build-studio", label: "Open the Build Studio (Claude + Gemini)" },
  },
]

const ACCENTS: Record<string, string> = {
  pink:    "text-pink-400 bg-pink-500/10 border-pink-500/20",
  emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  violet:  "text-amber-400 bg-amber-500/10 border-amber-500/20",
  amber:   "text-amber-400 bg-amber-500/10 border-amber-500/20",
  cyan:    "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
}

// ── Conversational workspace ───────────────────────────────────────────────

interface Msg { role: "user" | "assistant"; content: string }

function Workspace({ mode }: { mode: Mode }) {
  const router = useRouter()
  const [msgs, setMsgs]   = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoad] = useState(false)
  const [stream, setStream] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const key = `kloom_workspace_${mode.id}`

  useEffect(() => { try { setMsgs(JSON.parse(localStorage.getItem(key) ?? "[]")) } catch {} }, [key])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs, stream])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    const next = [...msgs, { role: "user" as const, content: text }]
    setMsgs(next); setInput(""); setLoad(true); setStream("")
    try {
      const res = await fetch("/api/mcp-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "chat", persona: mode.persona, messages: next }),
      })
      if (!res.body) throw new Error("no body")
      const reader = res.body.getReader(); const dec = new TextDecoder(); let full = ""
      while (true) { const { done, value } = await reader.read(); if (done) break; full += dec.decode(value, { stream: true }); setStream(full) }
      const done = [...next, { role: "assistant" as const, content: full.trim() }]
      setMsgs(done); try { localStorage.setItem(key, JSON.stringify(done)) } catch {}
    } catch {
      setMsgs((p) => [...p, { role: "assistant", content: "⚠️ Couldn't reach the workspace — check MCP server + LLM." }])
    } finally { setLoad(false); setStream("") }
  }, [msgs, loading, mode, key])

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="shrink-0 border-b border-white/8 px-4 lg:px-6 py-3 flex items-center gap-3">
        <button onClick={() => router.push("/app/creator")} className="text-foreground/40 hover:text-foreground"><ChevronLeft size={20} /></button>
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${ACCENTS[mode.accent]}`}><mode.icon size={18} /></div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">{mode.name}</div>
          <div className="text-[11px] text-foreground/40 truncate">{mode.tagline}</div>
        </div>
        {mode.relatedRoom && (
          <Link href={`/app/rooms/${mode.relatedRoom.id}`}
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold bg-foreground/5 border border-border/50 hover:bg-white/10 px-3 py-1.5 rounded-xl transition-colors text-foreground/70">
            <Users size={13} /> Live room
          </Link>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-5 space-y-4">
        {msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 max-w-md mx-auto">
            <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center ${ACCENTS[mode.accent]}`}><mode.icon size={28} /></div>
            <div>
              <p className="font-bold text-lg">{mode.name}</p>
              <p className="text-sm text-foreground/45 mt-1.5 leading-relaxed">{mode.intro}</p>
            </div>
            {mode.relatedRoom && (
              <Link href={`/app/rooms/${mode.relatedRoom.id}`}
                className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400 hover:text-amber-300">
                <Users size={13} /> {mode.relatedRoom.label} <ArrowRight size={13} />
              </Link>
            )}
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {mode.starters.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="text-xs bg-foreground/5 border border-border/50 hover:bg-white/10 px-3 py-1.5 rounded-full text-foreground/60 hover:text-foreground transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && <div className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${ACCENTS[mode.accent]}`}><mode.icon size={14} /></div>}
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-amber-500 text-foreground rounded-br-sm" : "bg-white/8 border border-border/50 text-foreground/90 rounded-bl-sm"}`}>
              {m.role === "user" ? m.content : <MessageRenderer content={m.content} />}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5">
            <div className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${ACCENTS[mode.accent]}`}><mode.icon size={14} /></div>
            <div className="bg-white/8 border border-border/50 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[80%] text-sm text-foreground/90">
              {stream ? <MessageRenderer content={stream} /> : <span className="flex gap-1">{[0,1,2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce inline-block" style={{animationDelay:`${i*0.15}s`}}/>)}</span>}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 py-3 border-t border-white/5">
        <div className="flex gap-2 items-end max-w-3xl mx-auto">
          <div className="flex-1 bg-foreground/5 border border-border/50 rounded-2xl px-4 py-2.5 focus-within:border-amber-500/40">
            <textarea rows={1} placeholder={`Message ${mode.persona.name as string}…`} value={input}
              onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px" }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) } }}
              className="w-full bg-transparent text-sm text-foreground placeholder-white/30 resize-none focus:outline-none" style={{ maxHeight: 120 }} />
          </div>
          <button onClick={() => send(input)} disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 flex items-center justify-center shrink-0 mb-0.5">
            <Send size={15} className="text-foreground" />
          </button>
        </div>
        <p className="text-[10px] text-foreground/25 text-center mt-2">Text is free · pay only for voice calls</p>
      </div>
    </div>
  )
}

// ── Hub ─────────────────────────────────────────────────────────────────────

function CreatorContent() {
  const params = useSearchParams()
  const router = useRouter()
  const modeId = params.get("mode")
  const active = MODES.find((m) => m.id === modeId)

  if (active) return <Workspace mode={active} />

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="border-b border-white/5 px-6 lg:px-8 py-6">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Sparkles size={18} className="text-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Build with Kloom</h1>
            <p className="text-sm text-foreground/40">Pick what you're building. An expert and live tools are ready for each.</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => router.push(`/app/creator?mode=${m.id}`)}
              className="group text-left rounded-2xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 transition-all p-6 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${ACCENTS[m.accent]}`}><m.icon size={22} /></div>
                <h3 className="font-bold text-lg">{m.name}</h3>
                <ArrowRight size={16} className="ml-auto text-foreground/20 group-hover:text-foreground/60 transition-colors" />
              </div>
              <p className="text-sm text-foreground/50 leading-relaxed">{m.tagline}</p>
              {m.relatedRoom && (
                <span className="text-[11px] text-amber-400/80 flex items-center gap-1"><Users size={11} /> Has a live Claude + Gemini room</span>
              )}
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-foreground/25 mt-8">Every workspace is free to chat in · voice calls are pay-as-you-go</p>
      </div>
    </div>
  )
}

export default function CreatorPage() {
  return <Suspense><CreatorContent /></Suspense>
}
