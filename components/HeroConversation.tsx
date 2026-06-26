"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { RoomFace } from "@/components/RoomFace"
import { createCustomRoom } from "@/lib/custom-rooms"
import { track } from "@/lib/track"
import { Send, Phone, Loader2 } from "lucide-react"

// The hero's live trio — three distinct minds who actually reply, riff, and disagree.
// Typing on the landing page drops you into a real conversation with them; "Join them
// live" turns it into a voice room with the SAME three.
const TRIO = [
  { name: "Claude", gender: "female", model: "claude", role: "the strategist",
    personality: "Sharp and decisive. Cuts straight to what matters and pressure-tests every idea. Warm, but never wastes a word." },
  { name: "Gemini", gender: "male", model: "gemini", role: "the creative",
    personality: "Playful and lateral. Riffs, jokes, and finds the angle nobody saw. Brings the energy and the wild ideas." },
  { name: "GPT", gender: "male", model: "local", role: "the skeptic",
    personality: "The blunt one. Calls out what won't work and asks the hard question. Dry, funny, allergic to flattery." },
]
const REL = "three friends riffing live on whatever the visitor brings — fast, funny, building on and teasing each other, each one a clear distinct voice."

type Msg = { who: string; gender?: string; text: string }
const SEEDS = ["pitch me a business idea", "settle an argument for us", "what should I do this weekend", "hype me up, I need it"]

export function HeroConversation() {
  const router = useRouter()
  const [input, setInput] = useState("")
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [typing, setTyping] = useState("")
  const [busy, setBusy] = useState(false)
  const scroller = useRef<HTMLDivElement | null>(null)
  useEffect(() => { scroller.current?.scrollTo({ top: 1e9, behavior: "smooth" }) }, [msgs, typing])

  const ask = async (raw: string) => {
    const text = raw.trim()
    if (!text || busy) return
    setBusy(true); setInput("")
    let convo: Msg[] = [...msgs, { who: "you", text }]
    setMsgs(convo)
    try { track("hero_chat", { surface: "home" }) } catch { /* */ }
    for (const c of TRIO) {
      setTyping(c.name)
      try {
        const others = TRIO.filter((t) => t.name !== c.name).map((t) => ({ name: t.name, personality: t.personality }))
        const messages = convo.map((m) =>
          m.who === "you" ? { role: "user", content: `[USER]: ${m.text}` }
          : m.who === c.name ? { role: "assistant", content: m.text }
          : { role: "user", content: `[${m.who}]: ${m.text}` })
        const res = await fetch("/api/mcp-chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "chat", persona: { name: c.name, personality: c.personality, category: "social", model: c.model, gender: c.gender }, partners: others, relationship: REL, messages }),
        })
        let full = ""
        if (res.body) { const rd = res.body.getReader(); const dec = new TextDecoder(); for (;;) { const { done, value } = await rd.read(); if (done) break; full += dec.decode(value) } }
        full = full.trim()
        if (full) { convo = [...convo, { who: c.name, gender: c.gender, text: full }]; setMsgs(convo) }
      } catch { /* skip a stumble, keep the banter moving */ }
    }
    setTyping(""); setBusy(false)
  }

  const joinLive = () => {
    try { track("hero_join_live", { surface: "home" }) } catch { /* */ }
    const id = createCustomRoom({
      name: "The Room", topic: "three minds, live", category: "social",
      members: TRIO.map((c) => ({ name: c.name, gender: c.gender as "female" | "male", personality: c.personality, relation: c.role })),
    })
    router.push(`/app/rooms/${id}?mode=voice`)
  }

  const started = msgs.length > 0

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* the trio, always visible — real faces, so it never looks like a text box */}
      <div className="flex items-center justify-center gap-2 mb-4">
        {TRIO.map((c) => (
          <div key={c.name} className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-full pl-1 pr-3 py-1">
            <span className="w-6 h-6 rounded-full overflow-hidden bg-stone-800 shrink-0"><RoomFace name={c.name} gender={c.gender} className="w-full h-full object-cover" /></span>
            <span className="text-[12px] font-semibold text-foreground/80">{c.name}</span>
          </div>
        ))}
      </div>

      {/* the conversation */}
      {started && (
        <div ref={scroller} className="text-left max-h-[42vh] overflow-y-auto space-y-3 mb-3 px-1 scrollbar-hide">
          {msgs.map((m, i) => m.who === "you" ? (
            <div key={i} className="flex justify-end">
              <div className="bg-foreground text-background rounded-2xl rounded-br-sm px-4 py-2.5 text-sm font-medium max-w-[85%]">{m.text}</div>
            </div>
          ) : (
            <div key={i} className="flex gap-2.5">
              <span className="w-8 h-8 rounded-xl overflow-hidden bg-stone-800 shrink-0 mt-0.5"><RoomFace name={m.who} gender={m.gender} className="w-full h-full object-cover" /></span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-foreground/70 mb-0.5 ml-0.5">{m.who}</div>
                <div className="bg-foreground/[0.06] border border-white/10 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-foreground/90 leading-relaxed max-w-[90%]">{m.text}</div>
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex gap-2.5">
              <span className="w-8 h-8 rounded-xl overflow-hidden bg-stone-800 shrink-0"><RoomFace name={typing} gender={TRIO.find((t) => t.name === typing)?.gender} className="w-full h-full object-cover" /></span>
              <div className="bg-foreground/[0.06] border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                {[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* input */}
      <form onSubmit={(e) => { e.preventDefault(); ask(input) }} className="flex gap-2 items-center bg-white/[0.06] border border-white/15 rounded-2xl p-1.5 pl-4 focus-within:border-amber-400/50 transition-colors">
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy}
          placeholder={started ? "say something back…" : "say anything — they'll answer together"}
          className="flex-1 min-w-0 bg-transparent text-[15px] text-foreground placeholder-foreground/40 focus:outline-none disabled:opacity-60" />
        <button type="submit" disabled={busy || !input.trim()} aria-label="send"
          className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 flex items-center justify-center shrink-0 transition-colors">
          {busy ? <Loader2 size={16} className="text-stone-950 animate-spin" /> : <Send size={16} className="text-stone-950" />}
        </button>
      </form>

      {/* seeds before they start; join-live after they've heard the room */}
      {!started ? (
        <div className="flex flex-wrap justify-center gap-2 mt-3">
          {SEEDS.map((s) => (
            <button key={s} onClick={() => ask(s)} className="text-xs text-foreground/55 hover:text-foreground bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-full px-3 py-1.5 transition-colors">{s}</button>
          ))}
        </div>
      ) : (
        <button onClick={joinLive} className="w-full mt-3 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-bold py-3.5 rounded-2xl transition-all hover:scale-[1.01]">
          <Phone size={17} /> Join them live — hear their voices
        </button>
      )}
    </div>
  )
}
