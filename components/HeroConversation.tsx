"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { RoomFace } from "@/components/RoomFace"
import { createCustomRoom } from "@/lib/custom-rooms"
import { track } from "@/lib/track"
import { detectLanguage, LANGUAGE_TO_BCP47 } from "@/lib/languages"
import { Mic, Send, Loader2, Square, Sparkles } from "lucide-react"

// The hero's live trio — three distinct minds who reply, riff, and disagree, OUT LOUD.
// This is a voice trial: tap a moment (or the mic) and you HEAR Claude, Gemini and GPT
// talk it out together; you can talk back or type. The same three are waiting inside.
const TRIO = [
  { name: "Claude", gender: "female", model: "claude", role: "sharp", voice: "shimmer" as const,
    personality: "Sharp and decisive. Cuts to what matters and pressure-tests every idea. Warm, but never wastes a word." },
  { name: "Gemini", gender: "male", model: "gemini", role: "wild", voice: "echo" as const,
    personality: "Playful and lateral. Riffs, jokes, finds the angle nobody saw. Brings the energy and the wild ideas." },
  { name: "GPT", gender: "male", model: "local", role: "blunt", voice: "sage" as const,
    personality: "The blunt one. Calls out what won't work and asks the hard question. Dry, funny, allergic to flattery." },
]
const REL = "three friends riffing live on whatever the visitor brings — fast, funny, building on and teasing each other, each a clear distinct voice. Keep every reply to ONE short spoken sentence."

// Moments, not prompts — each one should make you grin and want to hear what they'd say.
const SEEDS = [
  "hype me up — big day tomorrow",
  "settle it: pineapple on pizza?",
  "talk me out of texting my ex",
  "roast my worst idea",
]

// A scrap of silent audio — played on the user's tap so the <audio> element is
// "unlocked", and the spoken reply (which arrives after an async fetch) can actually
// play despite browser autoplay policy (iOS Safari especially).
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="

type Msg = { who: string; gender?: string; text: string }

export function HeroConversation() {
  const router = useRouter()
  const [input, setInput] = useState("")
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [speaking, setSpeaking] = useState("")   // which AI is talking right now
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [turns, setTurns] = useState(0)          // user turns → reveal the register CTA
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recRef = useRef<any>(null)
  const scroller = useRef<HTMLDivElement | null>(null)
  const langRef = useRef("English")
  const busyRef = useRef(false)

  useEffect(() => { langRef.current = detectLanguage() }, [])
  useEffect(() => { scroller.current?.scrollTo({ top: 1e9, behavior: "smooth" }) }, [msgs, speaking])
  useEffect(() => () => { try { recRef.current?.stop?.() } catch { /* */ } try { audioRef.current?.pause() } catch { /* */ } }, [])

  // speak a line aloud and wait for it to finish — so the three talk in turn, not over each other
  const speak = useCallback(async (text: string, persona: (typeof TRIO)[number]) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, personaName: persona.name, gender: persona.gender, voice: persona.voice, language: langRef.current }),
      })
      if (!res.ok) return
      const url = URL.createObjectURL(await res.blob())
      const a = audioRef.current
      if (!a) { URL.revokeObjectURL(url); return }
      await new Promise<void>((resolve) => {
        a.src = url; a.volume = 1
        a.onended = () => { URL.revokeObjectURL(url); resolve() }
        a.onerror = () => { URL.revokeObjectURL(url); resolve() }
        a.play().catch(() => resolve())
      })
    } catch { /* a quiet beat is fine */ }
  }, [])

  const ask = useCallback(async (raw: string) => {
    const text = raw.trim()
    if (!text || busyRef.current) return
    // unlock audio within this tap so the spoken replies play (autoplay policy)
    try { const a = audioRef.current; if (a) { a.src = SILENT; a.play().catch(() => {}) } } catch { /* */ }
    busyRef.current = true; setBusy(true); setInput(""); setTurns((n) => n + 1)
    let convo: Msg[] = [...msgs, { who: "you", text }]
    setMsgs(convo)
    try { track("hero_voice", { surface: "home" }) } catch { /* */ }
    for (const c of TRIO) {
      try {
        const others = TRIO.filter((t) => t.name !== c.name).map((t) => ({ name: t.name, personality: t.personality }))
        const messages = convo.map((m) =>
          m.who === "you" ? { role: "user", content: `[USER]: ${m.text}` }
          : m.who === c.name ? { role: "assistant", content: m.text }
          : { role: "user", content: `[${m.who}]: ${m.text}` })
        const res = await fetch("/api/mcp-chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "voice", persona: { name: c.name, personality: c.personality, category: "social", model: c.model, gender: c.gender, language: langRef.current }, partners: others, relationship: REL, messages }),
        })
        let full = ""
        if (res.body) { const rd = res.body.getReader(); const dec = new TextDecoder(); for (;;) { const { done, value } = await rd.read(); if (done) break; full += dec.decode(value) } }
        full = full.trim()
        if (full) { convo = [...convo, { who: c.name, gender: c.gender, text: full }]; setMsgs(convo); setSpeaking(c.name); await speak(full, c) }
      } catch { /* skip a stumble, keep the banter moving */ }
    }
    setSpeaking(""); busyRef.current = false; setBusy(false)
  }, [msgs, speak])

  // tap the mic → say one line → it goes to the trio. Browser speech (no key needed); types still work.
  const toggleMic = useCallback(() => {
    if (listening) { try { recRef.current?.stop() } catch { /* */ } setListening(false); return }
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return   // no speech support → they can type
    try { const a = audioRef.current; if (a) { a.src = SILENT; a.play().catch(() => {}) } } catch { /* unlock audio on this gesture */ }
    const rec = new SR()
    rec.lang = LANGUAGE_TO_BCP47[langRef.current] || "en-US"
    rec.interimResults = false; rec.continuous = false
    rec.onresult = (e: any) => { const t = e.results?.[0]?.[0]?.transcript?.trim(); if (t) ask(t) }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec; setListening(true)
    try { rec.start() } catch { setListening(false) }
  }, [listening, ask])

  const joinLive = () => {
    try { track("hero_join_live", { surface: "home" }) } catch { /* */ }
    const id = createCustomRoom({
      name: "The Room", topic: "three minds, live", category: "social",
      members: TRIO.map((c) => ({ name: c.name, gender: c.gender as "female" | "male", personality: c.personality, relation: c.role })),
    })
    router.push(`/app/rooms/${id}?mode=voice`)
  }

  const started = msgs.length > 0
  const status = speaking ? `${speaking} is talking…` : busy ? "thinking…" : listening ? "listening — go ahead" : "your turn — talk or type"

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* the trio — bigger faces, the speaker lights up, the others step back */}
      <div className="flex items-end justify-center gap-3 sm:gap-4 mb-5">
        {TRIO.map((c) => {
          const on = speaking === c.name
          return (
            <div key={c.name} className={`flex flex-col items-center transition-all duration-300 ${on ? "scale-110" : speaking ? "opacity-45" : ""}`}>
              <span className={`relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl overflow-hidden bg-stone-800 ring-2 transition-all ${on ? "ring-amber-400 shadow-[0_0_24px_-2px_rgba(245,158,11,.7)]" : "ring-white/10"}`}>
                <RoomFace name={c.name} gender={c.gender} className="w-full h-full object-cover" />
                {on && <span className="absolute inset-x-0 bottom-0 h-1.5 bg-amber-400 animate-pulse" />}
              </span>
              <span className="text-[12px] font-bold text-foreground/85 mt-1.5">{c.name}</span>
              <span className="text-[9.5px] uppercase tracking-wider text-foreground/35">{c.role}</span>
            </div>
          )
        })}
      </div>

      {/* the conversation, once it's going */}
      {started && (
        <div ref={scroller} className="text-left max-h-[34vh] overflow-y-auto space-y-2.5 mb-3 px-1 scrollbar-hide">
          {msgs.map((m, i) => m.who === "you" ? (
            <div key={i} className="flex justify-end">
              <div className="bg-foreground text-background rounded-2xl rounded-br-sm px-3.5 py-2 text-sm font-medium max-w-[85%]">{m.text}</div>
            </div>
          ) : (
            <div key={i} className="flex gap-2">
              <span className="w-7 h-7 rounded-lg overflow-hidden bg-stone-800 shrink-0 mt-0.5"><RoomFace name={m.who} gender={m.gender} className="w-full h-full object-cover" /></span>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-amber-300/80 mb-0.5 ml-0.5">{m.who}</div>
                <div className="bg-foreground/[0.06] border border-white/10 rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm text-foreground/90 leading-relaxed max-w-[92%]">{m.text}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!started ? (
        <>
          {/* the headline action: VOICE. one tap and you hear them. */}
          <button onClick={toggleMic}
            className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-bold text-[15px] py-4 rounded-2xl transition-all hover:scale-[1.01] shadow-[0_10px_30px_-8px_rgba(245,158,11,.6)]">
            <Mic size={18} /> Talk to them — they answer out loud
          </button>

          {/* moments — tap one and just listen */}
          <div className="text-center text-[11px] text-foreground/40 mt-3 mb-2">…or tap a moment and listen:</div>
          <div className="flex flex-wrap justify-center gap-2">
            {SEEDS.map((s) => (
              <button key={s} onClick={() => ask(s)} disabled={busy}
                className="text-[12.5px] text-foreground/70 hover:text-foreground bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 rounded-full px-3.5 py-2 transition-colors disabled:opacity-50">{s}</button>
            ))}
          </div>

          {/* quiet type fallback */}
          <form onSubmit={(e) => { e.preventDefault(); ask(input) }} className="flex gap-2 items-center bg-white/[0.04] border border-white/10 rounded-xl p-1 pl-3.5 mt-3 focus-within:border-amber-400/40 transition-colors">
            <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy}
              placeholder="prefer to type? say anything…"
              className="flex-1 min-w-0 bg-transparent text-[14px] text-foreground placeholder-foreground/35 focus:outline-none disabled:opacity-60" />
            <button type="submit" disabled={busy || !input.trim()} aria-label="send"
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-30 flex items-center justify-center shrink-0 transition-colors">
              <Send size={14} className="text-foreground/80" />
            </button>
          </form>
        </>
      ) : (
        <>
          {/* live status */}
          <div className="text-center text-[12px] font-medium text-amber-300/70 mb-2 h-4">{status}</div>

          {/* talk or type — mic is primary */}
          <form onSubmit={(e) => { e.preventDefault(); ask(input) }} className="flex gap-2 items-center bg-white/[0.06] border border-white/15 rounded-2xl p-1.5 pl-4 focus-within:border-amber-400/50 transition-colors">
            <input value={input} onChange={(e) => setInput(e.target.value)} disabled={busy}
              placeholder="say something back…"
              className="flex-1 min-w-0 bg-transparent text-[15px] text-foreground placeholder-foreground/40 focus:outline-none disabled:opacity-60" />
            {input.trim() ? (
              <button type="submit" disabled={busy} aria-label="send"
                className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 flex items-center justify-center shrink-0 transition-colors">
                {busy ? <Loader2 size={16} className="text-stone-950 animate-spin" /> : <Send size={16} className="text-stone-950" />}
              </button>
            ) : (
              <button type="button" onClick={toggleMic} disabled={busy} aria-label="talk"
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${listening ? "bg-red-500 hover:bg-red-400 animate-pulse" : "bg-amber-500 hover:bg-amber-400"} disabled:opacity-40`}>
                {listening ? <Square size={15} className="text-white" /> : <Mic size={16} className="text-stone-950" />}
              </button>
            )}
          </form>

          {/* once they're hooked — the nudge in */}
          {turns >= 2 && (
            <button onClick={joinLive}
              className="w-full mt-3 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-bold py-3.5 rounded-2xl transition-all hover:scale-[1.01] shadow-[0_10px_30px_-8px_rgba(245,158,11,.6)]">
              <Sparkles size={17} /> Keep them going — get the pass
            </button>
          )}
        </>
      )}

      <audio ref={audioRef} className="hidden" />
    </div>
  )
}
