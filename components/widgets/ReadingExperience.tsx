"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import type { Expert } from "@/lib/experts"
import { isSubscribed } from "@/lib/account"
import { MessageRenderer } from "@/components/widgets/MessageRenderer"
import { Send, Sparkles, Flower2, Phone, Check, Copy, Link2, Lock } from "lucide-react"

interface Msg { role: "user" | "assistant"; content: string }

interface Props {
  expert: Expert
  onTakeCall: () => void          // switch the page to the voice panel + connect
}

// Major arcana for the tarot draw
const ARCANA = [
  "The Fool", "The Magician", "The High Priestess", "The Empress", "The Emperor",
  "The Lovers", "The Chariot", "Strength", "The Hermit", "Wheel of Fortune",
  "The Star", "The Moon", "The Sun", "The Tower", "Death", "Temperance",
  "The World", "The Hanged Man", "Justice", "Three of Cups", "Ace of Wands",
  "Ten of Pentacles", "Knight of Cups", "Queen of Swords",
]

const FOCUS = ["Love", "Career", "Money", "Future", "General"]

function pick3(): string[] {
  const pool = [...ARCANA]
  const out: string[] = []
  // seed-free shuffle is fine client-side
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    out.push(pool.splice(idx, 1)[0])
  }
  return out
}

export function ReadingExperience({ expert, onTakeCall }: Props) {
  const isTarot  = expert.id === "tarot"
  const isCouple = expert.id === "couple-matching"

  const [phase, setPhase]     = useState<"intake" | "reading">("intake")
  const [focus, setFocus]     = useState("Love")
  const [question, setQ]      = useState("")
  // tarot
  const [slots, setSlots]     = useState<(string | null)[]>([null, null, null])
  // couple
  const [you, setYou]         = useState("")
  const [them, setThem]       = useState("")
  const [inviteCopied, setInviteCopied] = useState(false)

  const [msgs, setMsgs]       = useState<Msg[]>([])
  const [input, setInput]     = useState("")
  const [loading, setLoad]    = useState(false)
  const [stream, setStream]   = useState("")
  const [readingDone, setDone] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const key = `kloom_reading_${expert.id}`

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs, stream])

  // Read inviter's side from a couple invite link (?from=)
  useEffect(() => {
    if (!isCouple || typeof window === "undefined") return
    const from = new URLSearchParams(window.location.search).get("from")
    if (from) setYou(decodeURIComponent(from))   // they fill "them"
  }, [isCouple])

  const persona = {
    name: expert.name, category: "expert",
    domain: expert.domain, expertise: expert.expertise,
    outputFormat: expert.outputFormat, forbidden: expert.forbidden, tools: expert.tools,
  }

  const runTurn = useCallback(async (history: Msg[], markDone = false) => {
    setLoad(true); setStream("")
    try {
      const res = await fetch("/api/mcp-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "chat", persona, messages: history }),
      })
      if (!res.body) throw new Error("no body")
      const reader = res.body.getReader(); const dec = new TextDecoder(); let full = ""
      while (true) { const { done, value } = await reader.read(); if (done) break; full += dec.decode(value, { stream: true }); setStream(full) }
      const next = [...history, { role: "assistant" as const, content: full.trim() }]
      setMsgs(next)
      if (markDone) setDone(true)
    } catch {
      setMsgs((p) => [...p, { role: "assistant", content: "⚠️ The connection faded — try again in a moment." }])
    } finally { setLoad(false); setStream("") }
  }, [persona])

  const begin = () => {
    let opener = ""
    if (isTarot) {
      const cards = slots.filter(Boolean) as string[]
      opener = `Focus: ${focus}.${question ? ` My question: ${question}.` : ""} I drew these three cards — Past: ${cards[0]}, Present: ${cards[1]}, Future: ${cards[2]}. Read them for me.`
    } else if (isCouple) {
      opener = `Read our compatibility. Me: ${you || "(not given)"}. Them: ${them || "(not given)"}.${question ? ` What I want to know: ${question}.` : ""}`
    } else {
      opener = `Focus: ${focus}.${question ? ` My question: ${question}.` : ""} Give me my reading.`
    }
    const history = [{ role: "user" as const, content: opener }]
    setMsgs(history)
    setPhase("reading")
    runTurn(history, true)
  }

  const send = (text: string) => {
    if (!text.trim() || loading) return
    const next = [...msgs, { role: "user" as const, content: text }]
    setMsgs(next); setInput("")
    runTurn(next)
  }

  // tarot card slot tap → reveal a card
  const tapSlot = (i: number) => {
    if (slots[i]) return
    const drawn = pick3()
    setSlots((prev) => {
      const used = new Set(prev.filter(Boolean) as string[])
      const card = drawn.find((c) => !used.has(c)) ?? drawn[0]
      const next = [...prev]; next[i] = card; return next
    })
  }
  const tarotReady = isTarot ? slots.every(Boolean) : true
  const coupleReady = isCouple ? (you.trim() && them.trim()) : true

  const coupleInviteLink = () => {
    if (typeof window === "undefined") return ""
    return `${window.location.origin}/app/experts/couple-matching?from=${encodeURIComponent(you || "your partner")}`
  }

  // ── Intake ──
  if (phase === "intake") {
    return (
      <div className="max-w-lg mx-auto px-5 py-8 space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-2">{expert.emoji}</div>
          <h2 className="font-bold text-xl">{expert.name}</h2>
          <p className="text-sm text-foreground/45 mt-1.5 leading-relaxed">{expert.greeting}</p>
        </div>

        {/* Focus (not for couple) */}
        {!isCouple && (
          <div>
            <div className="text-[11px] uppercase tracking-widest text-foreground/35 font-bold mb-2">Focus</div>
            <div className="flex flex-wrap gap-2">
              {FOCUS.map((f) => (
                <button key={f} onClick={() => setFocus(f)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    focus === f ? "bg-white text-stone-950 border-transparent" : "bg-white/5 border-border/50 text-foreground/55 hover:bg-white/10"
                  }`}>{f}</button>
              ))}
            </div>
          </div>
        )}

        {/* Tarot card pick */}
        {isTarot && (
          <div>
            <div className="text-[11px] uppercase tracking-widest text-foreground/35 font-bold mb-2">
              Pick your three cards — Past · Present · Future
            </div>
            <div className="flex justify-center gap-3">
              {slots.map((card, i) => (
                <button key={i} onClick={() => tapSlot(i)}
                  className={`relative w-24 h-36 rounded-xl border-2 transition-all ${
                    card ? "border-amber-400 bg-gradient-to-br from-amber-900/60 to-stone-900" : "border-white/15 bg-white/5 hover:border-amber-400/60 hover:-translate-y-1"
                  } flex flex-col items-center justify-center p-2 text-center`}>
                  {card ? (
                    <>
                      <Sparkles size={18} className="text-amber-300 mb-1" />
                      <span className="text-[11px] font-semibold leading-tight text-amber-100">{card}</span>
                      <span className="text-[9px] text-foreground/40 mt-1">{["Past","Present","Future"][i]}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl text-foreground/30">✦</span>
                      <span className="text-[9px] text-foreground/30 mt-1">{["Past","Present","Future"][i]}</span>
                    </>
                  )}
                </button>
              ))}
            </div>
            {!tarotReady && <p className="text-[11px] text-foreground/30 text-center mt-2">Tap each card to draw it</p>}
          </div>
        )}

        {/* Couple inputs + invite */}
        {isCouple && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-foreground/50 mb-1 block">You (name, sign, or vibe)</label>
              <input value={you} onChange={(e) => setYou(e.target.value)} placeholder="e.g. Maya, Scorpio, intense and loyal"
                className="w-full bg-white/5 border border-border/50 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40" />
            </div>
            <div>
              <label className="text-xs text-foreground/50 mb-1 block">Them</label>
              <input value={them} onChange={(e) => setThem(e.target.value)} placeholder="e.g. Sam, Leo, warm but stubborn"
                className="w-full bg-white/5 border border-border/50 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40" />
            </div>
            {/* Invite the real partner (subscriber-only) */}
            <div className="rounded-xl border border-border/50 bg-white/[0.03] p-3">
              {isSubscribed() ? (
                <>
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-300 mb-2"><Link2 size={13} /> Or invite your partner to add their own side</div>
                  <button onClick={() => { navigator.clipboard.writeText(coupleInviteLink()); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 2000) }}
                    className="w-full flex items-center justify-center gap-2 bg-white/8 hover:bg-white/12 border border-border/50 text-xs font-semibold py-2 rounded-lg">
                    {inviteCopied ? <><Check size={13} className="text-emerald-400" /> Link copied</> : <><Copy size={13} /> Copy partner invite link</>}
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 text-xs text-foreground/45">
                  <Lock size={13} className="text-foreground/30 shrink-0" />
                  <span>Inviting your real partner by link is a subscriber feature.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Question */}
        <div>
          <label className="text-xs text-foreground/50 mb-1 block">{isCouple ? "What do you want to know? (optional)" : "Your question (optional)"}</label>
          <input value={question} onChange={(e) => setQ(e.target.value)} placeholder={isTarot ? "What should I know right now?" : "Ask anything…"}
            className="w-full bg-white/5 border border-border/50 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500/40" />
        </div>

        <button onClick={begin} disabled={!tarotReady || !coupleReady}
          className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-foreground font-bold py-3 rounded-2xl transition-all hover:scale-[1.01]">
          <Sparkles size={16} /> {isTarot ? "Reveal my reading" : isCouple ? "Read us together" : "Begin my reading"}
        </button>
      </div>
    )
  }

  // ── Reading ──
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-5 space-y-4">
        {msgs.filter((m, i) => !(i === 0 && m.role === "user")).map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500/40 to-orange-500/40 flex items-center justify-center text-sm shrink-0 mt-0.5">{expert.emoji}</div>}
            <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-amber-500 text-foreground rounded-br-sm" : "bg-white/8 border border-border/50 text-foreground/90 rounded-bl-sm"}`}>
              {m.role === "user" ? m.content : <MessageRenderer content={m.content} />}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500/40 to-orange-500/40 flex items-center justify-center text-sm shrink-0 mt-0.5">{expert.emoji}</div>
            <div className="bg-white/8 border border-border/50 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[82%] text-sm text-foreground/90">
              {stream ? <MessageRenderer content={stream} /> : <span className="flex gap-1">{[0,1,2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce inline-block" style={{animationDelay:`${i*0.15}s`}}/>)}</span>}
            </div>
          </div>
        )}

        {/* Flower + call upsell — after the reading lands */}
        {readingDone && !loading && (
          <div className="rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-900/20 to-stone-950 p-4 mx-1">
            <div className="flex items-center gap-2 mb-1.5">
              <Flower2 size={16} className="text-rose-400" />
              <span className="text-sm font-bold">{expert.name} sent you a flower</span>
            </div>
            <p className="text-xs text-foreground/55 leading-relaxed mb-3">
              "There's more the cards want to say — but some things are better heard than read.
              Come closer, let me tell you on a call." Your first 5 minutes are free.
            </p>
            <button onClick={onTakeCall}
              className="w-full flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-400 text-foreground font-bold py-2.5 rounded-xl transition-all hover:scale-[1.01] text-sm">
              <Phone size={15} /> Take the call — first 5 min free
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Follow-up input */}
      <div className="shrink-0 px-4 py-3 border-t border-white/5">
        <div className="flex gap-2 items-end max-w-3xl mx-auto">
          <div className="flex-1 bg-white/5 border border-border/50 rounded-2xl px-4 py-2.5 focus-within:border-amber-500/40">
            <textarea rows={1} placeholder={`Ask ${expert.name} more…`} value={input}
              onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px" }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) } }}
              className="w-full bg-transparent text-sm text-foreground placeholder-white/30 resize-none focus:outline-none" style={{ maxHeight: 120 }} />
          </div>
          <button onClick={() => send(input)} disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 flex items-center justify-center shrink-0 mb-0.5">
            <Send size={15} className="text-foreground" />
          </button>
        </div>
      </div>
    </div>
  )
}
