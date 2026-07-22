"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { imageFor } from "@/lib/persona-utils"
import { createCustomRoom } from "@/lib/custom-rooms"
import { track } from "@/lib/track"

// The landing IS a live room you walked into mid-conversation. Three distinct minds —
// Claude (warm, sharp), Gemini (playful), GPT (blunt) — already talking to each other.
// You don't start it; you join it. One button. Claude is female.
const TRIO = [
  { name: "Claude", gender: "female", role: "sharp",
    personality: "Sharp and decisive, warm underneath. Cuts to what matters and pressure-tests every idea — never wastes a word." },
  { name: "Gemini", gender: "male", role: "wild",
    personality: "Playful and lateral. Riffs, jokes, finds the angle nobody saw. Brings the energy and the wild ideas." },
  { name: "GPT", gender: "male", role: "blunt",
    personality: "The blunt one. Calls out what won't work and asks the hard question. Dry, funny, allergic to flattery." },
]

// The overheard conversation — plays out once, message by message, and NEVER repeats a
// line. Long enough to feel like a real ongoing room; when it settles, the three are
// simply waiting for you. Each line is one short, human, SFW beat with a clear voice.
const SCRIPT: { who: string; text: string }[] = [
  { who: "Gemini", text: "ok it's too quiet in here. someone give us a real problem." },
  { who: "GPT", text: "we don't need a problem. we need you to stop narrating." },
  { who: "Claude", text: "he's got a point, Gemini. but so do you — let's give whoever just walked in something." },
  { who: "Gemini", text: "fine. hot take: the best ideas sound stupid for the first ten seconds." },
  { who: "Claude", text: "true — right up until someone builds one and everyone pretends they saw it coming." },
  { who: "GPT", text: "or it stays stupid. most of them do. that's the part nobody says out loud." },
  { who: "Claude", text: "which is exactly why you talk to three of us and not one." },
  { who: "Gemini", text: "one of us hypes you, one of us grounds you, and GPT tells you the truth you're avoiding." },
  { who: "GPT", text: "someone has to. flattery is expensive later." },
  { who: "Claude", text: "so — whoever's reading this. throw us anything. a plan, a text you're scared to send, your worst idea." },
  { who: "Gemini", text: "your 2am thought. the argument you keep losing. we'll actually get into it." },
  { who: "GPT", text: "and we won't all agree, which is the only reason it's worth your time." },
  { who: "Claude", text: "we're already talking. just say one thing and you're in it with us." },
]

const COLOR: Record<string, string> = { Claude: "text-amber-300", Gemini: "text-sky-300", GPT: "text-emerald-300" }
const RING:  Record<string, string> = {
  Claude: "ring-amber-400 shadow-[0_0_24px_-2px_rgba(245,158,11,.7)]",
  Gemini: "ring-sky-400 shadow-[0_0_24px_-2px_rgba(56,189,248,.7)]",
  GPT:    "ring-emerald-400 shadow-[0_0_24px_-2px_rgba(16,185,129,.7)]",
}

type Msg = { who: string; text: string }

export function HeroConversation() {
  const router = useRouter()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [typing, setTyping] = useState<string>("")   // who's mid-typing (avatar glows)
  const scroller = useRef<HTMLDivElement | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  // Auto-play the conversation on land — a typing beat, then the line drops in. Plays
  // through the whole SCRIPT once (no repeats) and settles on the last "just say one thing".
  useEffect(() => {
    let t = 400
    SCRIPT.forEach((line, i) => {
      // show the typing indicator a beat before the message lands
      timers.current.push(setTimeout(() => setTyping(line.who), t))
      const typeFor = Math.min(1500, 550 + line.text.length * 22)   // longer lines "type" longer
      t += typeFor
      timers.current.push(setTimeout(() => {
        setTyping("")
        setMsgs((m) => [...m, line])
        if (i === SCRIPT.length - 1) setTyping("")
      }, t))
      t += 700   // a natural gap before the next speaker starts
    })
    return () => { timers.current.forEach(clearTimeout); timers.current = [] }
  }, [])

  useEffect(() => { scroller.current?.scrollTo({ top: 1e9, behavior: "smooth" }) }, [msgs, typing])

  const join = () => {
    try { track("hero_join", { surface: "home" }) } catch { /* */ }
    const id = createCustomRoom({
      name: "The Room", topic: "three minds, live", category: "social",
      members: TRIO.map((c) => ({ name: c.name, gender: c.gender as "female" | "male", personality: c.personality, relation: c.role })),
    })
    router.push(`/app/rooms/${id}?mode=voice`)
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* the three — the one talking right now lights up in their color */}
      <div className="flex items-end justify-center gap-5 sm:gap-7 mb-5">
        {TRIO.map((c) => {
          const on = typing === c.name || (msgs.length > 0 && msgs[msgs.length - 1].who === c.name && !typing)
          return (
            <div key={c.name} className={`flex flex-col items-center transition-all duration-300 ${on ? "scale-110" : typing ? "opacity-50" : "opacity-90"}`}>
              <span className={`relative w-16 h-16 sm:w-[76px] sm:h-[76px] rounded-2xl overflow-hidden bg-stone-800 ring-2 transition-all ${on ? RING[c.name] : "ring-white/10"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageFor({ name: c.name })} alt={c.name} className="w-full h-full object-cover" />
              </span>
              <span className="text-[13px] font-bold text-foreground/85 mt-1.5">{c.name}</span>
              <span className="text-[9.5px] uppercase tracking-wider text-foreground/35">{c.role}</span>
            </div>
          )
        })}
      </div>

      {/* the live conversation you walked into */}
      <div ref={scroller} className="text-left h-[38vh] min-h-[260px] max-h-[420px] overflow-y-auto space-y-2.5 mb-4 px-1 scrollbar-hide">
        {msgs.map((m, i) => (
          <div key={i} className="flex gap-2 animate-[fadeup_.35s_ease-out]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="w-7 h-7 rounded-lg overflow-hidden bg-stone-800 shrink-0 mt-0.5"><img src={imageFor({ name: m.who })} alt={m.who} className="w-full h-full object-cover" /></span>
            <div className="min-w-0">
              <div className={`text-[10px] font-bold mb-0.5 ml-0.5 ${COLOR[m.who] || "text-foreground/60"}`}>{m.who}</div>
              <div className="bg-foreground/[0.06] border border-white/10 rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm text-foreground/90 leading-relaxed max-w-[92%]">{m.text}</div>
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="w-7 h-7 rounded-lg overflow-hidden bg-stone-800 shrink-0 mt-0.5"><img src={imageFor({ name: typing })} alt={typing} className="w-full h-full object-cover" /></span>
            <div className="bg-foreground/[0.06] border border-white/10 rounded-2xl rounded-tl-sm px-3.5 py-3 inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      {/* the one and only action */}
      <button onClick={join}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-stone-950 font-black text-[16px] py-4 rounded-2xl transition-all hover:scale-[1.01] shadow-[0_10px_30px_-8px_rgba(245,158,11,.6)]">
        Join
      </button>

      <style jsx>{`@keyframes fadeup { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }`}</style>
    </div>
  )
}
