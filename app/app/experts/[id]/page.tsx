"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { getExpert, expertTitle, EXPERT_GROUP_LABELS, EXPERT_GROUP_COLORS } from "@/lib/experts"
import { ExpertControls } from "@/components/widgets/ExpertControls"
import { useRealtimeVoice, type Persona } from "@/hooks/use-realtime-voice"
import { MessageRenderer } from "@/components/widgets/MessageRenderer"
import { ReadingExperience } from "@/components/widgets/ReadingExperience"
import { UnrestrictedUpsell } from "@/components/widgets/UnrestrictedUpsell"
import { SolanaWalletProvider } from "@/components/solana-wallet-provider"
import { isSubscribed, hasUnrestricted } from "@/lib/account"
import { resolveVoiceId } from "@/lib/voices"
import "@solana/wallet-adapter-react-ui/styles.css"
import { ChevronLeft, Send, Mic, Phone, PhoneOff, Loader2, Volume2, VolumeX, MessageSquare } from "lucide-react"

interface Msg { role: "user" | "assistant"; content: string; ts: number }

function chatKey(id: string) { return `ora_expert_chat_${id}` }

function ExpertContent() {
  const params = useParams()
  const search = useSearchParams()
  const router = useRouter()
  const expert = getExpert(params.id as string)

  const [panel, setPanel]   = useState<"chat" | "voice">(search.get("mode") === "voice" ? "voice" : "chat")
  const [msgs, setMsgs]     = useState<Msg[]>([])
  const [input, setInput]   = useState("")
  const [loading, setLoad]  = useState(false)
  const [stream, setStream] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (expert) { try { setMsgs(JSON.parse(localStorage.getItem(chatKey(expert.id)) ?? "[]")) } catch {} }
  }, [expert])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs, stream])

  const isCompanion = expert?.mode === "companion"

  // Build a persona for the route. Companion-mode experts (e.g. Fantasy Talk)
  // route via ora_companion (immersive, present); the rest via ora_expert.
  const personaForRoute = expert ? (
    isCompanion
      ? {
          name:          expert.name,
          category:      "roleplay",
          personality:   expert.personality ?? expert.expertise,
          speakingStyle: expert.speakingStyle ?? "Intimate and present",
          backstory:     "",
          forbidden:     expert.forbidden,
          voice:         expert.voice,
          adult:         expert.adult ?? false,
        }
      : {
          name:         expert.name,
          category:     "expert",
          domain:       expert.domain,
          expertise:    expert.expertise,
          outputFormat: expert.outputFormat,
          forbidden:    expert.forbidden,
          tools:        expert.tools,
          voice:        expert.voice,
        }
  ) : null

  // Voice persona (extra fields pass through at runtime)
  const voicePersona = expert ? ({
    name:          expert.name,
    personality:   isCompanion ? (expert.personality ?? expert.expertise) : expert.expertise,
    speakingStyle: isCompanion ? (expert.speakingStyle ?? "Intimate and present") : "In-character, expert, direct",
    backstory:     "",
    voice:         expert.voice,
    gender:        expert.gender,
    voiceId:       resolveVoiceId(expert.name, expert.gender),  // fixed voice — never flips
    language:      "English",
    warmth:        70, talkStyle: 60,
    category:      isCompanion ? "roleplay" : "expert",
    domain:        expert.domain,
    expertise:     expert.expertise,
    outputFormat:  expert.outputFormat,
    forbidden:     expert.forbidden,
    tools:         expert.tools,
    adult:         expert.adult ?? false,
  } as unknown as Persona) : null

  const { isConnected, isConnecting, isSpeaking, error, connect, disconnect, stopAI } =
    useRealtimeVoice(voicePersona
      ? {
          persona: voicePersona,
          onTranscript: (text, speaker) => {
            const m: Msg = { role: speaker === "user" ? "user" : "assistant", content: text, ts: Date.now() }
            setMsgs((prev) => { const n = [...prev, m]; try { localStorage.setItem(chatKey(expert!.id), JSON.stringify(n)) } catch {}; return n })
          },
        }
      : { persona: { name: "", personality: "", speakingStyle: "", backstory: "", voice: "echo", language: "English", warmth: 50, talkStyle: 50 } })

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading || !expert) return
    const next = [...msgs, { role: "user" as const, content: text, ts: Date.now() }]
    setMsgs(next); setInput(""); setLoad(true); setStream("")
    try {
      const res = await fetch("/api/mcp-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "chat", persona: personaForRoute, premium: isSubscribed(), unrestricted: hasUnrestricted(), messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      })
      if (!res.body) throw new Error("no body")
      const reader = res.body.getReader(); const dec = new TextDecoder(); let full = ""
      while (true) { const { done, value } = await reader.read(); if (done) break; full += dec.decode(value, { stream: true }); setStream(full) }
      const done = [...next, { role: "assistant" as const, content: full.trim(), ts: Date.now() }]
      setMsgs(done); try { localStorage.setItem(chatKey(expert.id), JSON.stringify(done)) } catch {}
    } catch {
      setMsgs((p) => [...p, { role: "assistant", content: "⚠️ Couldn't reach the expert — check MCP server + LLM.", ts: Date.now() }])
    } finally { setLoad(false); setStream("") }
  }, [msgs, loading, expert, personaForRoute])

  if (!expert) {
    return <div className="h-screen flex items-center justify-center bg-stone-950 text-white/40">
      <div className="text-center"><p>Expert not found</p>
        <button onClick={() => router.push("/app/experts")} className="text-amber-400 text-sm mt-2">← All experts</button></div>
    </div>
  }

  return (
    <div className="h-screen flex flex-col bg-stone-950 text-white overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-white/8 px-4 lg:px-6 py-3 flex items-center gap-3">
        <button onClick={() => router.push("/app/experts")} className="text-white/40 hover:text-white"><ChevronLeft size={20} /></button>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-white/10 flex items-center justify-center text-lg">{expert.emoji}</div>
        <div className="flex-1 min-w-0">
          {/* Lead with the TITLE/role; name is secondary. */}
          <div className="font-bold text-sm truncate">{expertTitle(expert)}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-white/40">{expert.name}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${EXPERT_GROUP_COLORS[expert.group]}`}>{EXPERT_GROUP_LABELS[expert.group]}</span>
            {expert.adult && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-rose-500/40 text-rose-300 bg-rose-500/10">18+</span>}
          </div>
        </div>
        <ExpertControls expert={expert} />
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {(["chat", "voice"] as const).map((t) => (
            <button key={t} onClick={() => setPanel(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${panel === t ? "bg-white text-stone-950" : "text-white/40 hover:text-white"}`}>
              {t === "chat" ? <MessageSquare size={12} className="inline" /> : <Mic size={12} className="inline" />} {t}
            </button>
          ))}
        </div>
      </div>

      {panel === "chat" && expert.group === "future" ? (
        <ReadingExperience
          expert={expert}
          onTakeCall={() => { setPanel("voice"); setTimeout(() => connect(), 350) }}
        />
      ) : panel === "chat" ? (
        <>
          {expert.adult && (
            <div className="shrink-0 px-4 lg:px-6 pt-3">
              <UnrestrictedUpsell context={expert.name} />
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-5 space-y-4">
            {msgs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-white/10 flex items-center justify-center text-3xl">{expert.emoji}</div>
                <div>
                  <p className="font-bold text-lg">{expert.name}</p>
                  <p className="text-sm text-white/40 mt-1 max-w-xs leading-relaxed">{expert.greeting}</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {expert.starters.map((s) => (
                    <button key={s} onClick={() => send(s)}
                      className="text-xs bg-white/5 border border-white/10 hover:bg-white/10 px-3 py-1.5 rounded-full text-white/60 hover:text-white transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500/40 to-orange-500/40 flex items-center justify-center text-sm shrink-0 mt-0.5">{expert.emoji}</div>}
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-amber-500 text-white rounded-br-sm" : "bg-white/8 border border-white/10 text-white/90 rounded-bl-sm"}`}>
                  {m.role === "user" ? m.content : <MessageRenderer content={m.content} />}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500/40 to-orange-500/40 flex items-center justify-center text-sm shrink-0 mt-0.5">{expert.emoji}</div>
                <div className="bg-white/8 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[80%] text-sm text-white/90">
                  {stream ? <MessageRenderer content={stream} /> : <span className="flex gap-1">{[0,1,2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce inline-block" style={{animationDelay:`${i*0.15}s`}}/>)}</span>}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div className="shrink-0 px-4 py-3 border-t border-white/5">
            <div className="flex gap-2 items-end max-w-3xl mx-auto">
              <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 focus-within:border-amber-500/40">
                <textarea rows={1} placeholder={`Message ${expert.name}…`} value={input}
                  onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px" }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) } }}
                  className="w-full bg-transparent text-sm text-white placeholder-white/30 resize-none focus:outline-none" style={{ maxHeight: 120 }} />
              </div>
              <button onClick={() => send(input)} disabled={!input.trim() || loading}
                className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 flex items-center justify-center shrink-0 mb-0.5">
                <Send size={15} className="text-white" />
              </button>
            </div>
          </div>
        </>
      ) : (
        // VOICE PANEL
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
          <div className={`relative transition-all ${isSpeaking ? "scale-110" : ""}`}>
            <div className={`w-28 h-28 rounded-3xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 border flex items-center justify-center text-5xl transition-all ${isSpeaking ? "ring-4 ring-amber-400 shadow-lg shadow-amber-500/30" : "ring-2 ring-white/10"}`}>
              {expert.emoji}
            </div>
            {isSpeaking && <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center"><Volume2 size={12} className="text-white" /></div>}
          </div>
          <div className="text-center">
            <p className="font-bold">{expert.name}</p>
            <p className="text-xs text-white/40 mt-0.5 max-w-xs">{expert.tagline}</p>
          </div>
          <div className="text-center text-sm">
            {isConnecting && <span className="text-white/50 animate-pulse">Connecting…</span>}
            {isConnected && !isSpeaking && <span className="text-emerald-400">Listening</span>}
            {isConnected && isSpeaking && <span className="text-amber-400 animate-pulse">Speaking…</span>}
            {!isConnected && !isConnecting && <span className="text-white/30">Tap to start the call</span>}
            {error && <p className="text-xs text-red-400 mt-1 max-w-[200px]">{error}</p>}
          </div>
          <div className="flex items-center gap-3">
            {isConnected && isSpeaking && (
              <button onClick={stopAI} className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center"><VolumeX size={16} className="text-amber-400" /></button>
            )}
            <button onClick={isConnected ? disconnect : connect} disabled={isConnecting}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-105 disabled:opacity-50 ${isConnected ? "bg-red-500 hover:bg-red-400" : "bg-amber-500 hover:bg-amber-400"}`}>
              {isConnecting ? <Loader2 size={22} className="text-white animate-spin" /> : isConnected ? <PhoneOff size={22} className="text-white" /> : <Phone size={22} className="text-white" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ExpertPage() {
  return <SolanaWalletProvider><Suspense><ExpertContent /></Suspense></SolanaWalletProvider>
}
