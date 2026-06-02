"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { PERSONALITY_PRESETS, CATEGORY_INFO } from "@/components/persona-editor"
import { imageFor } from "@/lib/persona-utils"
import { useSolCredits } from "@/hooks/use-sol-credits"
import { VoiceNote } from "@/components/widgets/VoiceNote"
import { UnrestrictedUpsell } from "@/components/widgets/UnrestrictedUpsell"
import { TopUpSlider } from "@/components/widgets/TopUpSlider"
import { BreathingRing } from "@/components/widgets/BreathingRing"
import { VoiceCallPanel } from "@/components/widgets/VoiceCallPanel"
import { isSubscribed, hasUnrestricted } from "@/lib/account"
import { Send, Sparkles, Lock, MessageSquare, Mic, Zap, Globe, Hash, Calculator, Wind, X as XIcon } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
  ts: number
}

interface Conversation {
  personaName: string
  messages: Message[]
  lastActive: number
}

const STORAGE_KEY = "ora_chat_convos_v1"

function loadConvos(): Record<string, Conversation> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") } catch { return {} }
}
function saveConvos(c: Record<string, Conversation>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)) } catch {}
}

function ChatContent() {
  const params         = useSearchParams()
  const initialPersona = params.get("persona") ?? PERSONALITY_PRESETS[0].name

  const [convos, setConvos]           = useState<Record<string, Conversation>>({})
  const [activePersona, setActive]    = useState(initialPersona)
  const [input, setInput]             = useState("")
  const [streaming, setStreaming]     = useState(false)
  const [streamText, setStreamText]   = useState("")
  const [toolsUsed, setToolsUsed]     = useState<string[]>([])
  const [vibe, setVibe]               = useState<string>("")
  const [breatheOpen, setBreatheOpen] = useState(false)
  const [topUpOpen, setTopUpOpen]     = useState(false)
  const [showUnlock, setShowUnlock]   = useState(false)
  const [callOpen, setCallOpen]       = useState(false)
  const isTense = /tense|anxious/i.test(vibe)
  const { balance, spendCredits }     = useSolCredits()
  const bottomRef                     = useRef<HTMLDivElement>(null)
  const taRef                         = useRef<HTMLTextAreaElement>(null)
  const abortRef                      = useRef<AbortController | null>(null)

  useEffect(() => { setConvos(loadConvos()) }, [])
  useEffect(() => {
    const p = params.get("persona")
    if (p) setActive(p)
  }, [params])

  const persona  = PERSONALITY_PRESETS.find((p) => p.name === activePersona) ?? PERSONALITY_PRESETS[0]
  const messages = convos[activePersona]?.messages ?? []

  // 1:1 voice persona for the in-page call (same engine experts use).
  const voicePersona = {
    name:          persona.name,
    personality:   (persona as any).personality ?? "",
    speakingStyle: (persona as any).speakingStyle ?? "Natural and warm",
    backstory:     (persona as any).backstory ?? "",
    voice:         (persona as any).voice ?? "sage",
    language:      "English",
    warmth:        70, talkStyle: 60,
    category:      (persona as any).category ?? "roleplay",
  } as any

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamText])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: Message = { role: "user", content: text, ts: Date.now() }
    const prevMsgs = convos[activePersona]?.messages ?? []
    const nextConvos = {
      ...convos,
      [activePersona]: {
        personaName: activePersona,
        lastActive: Date.now(),
        messages: [...prevMsgs, userMsg],
      },
    }
    setConvos(nextConvos)
    saveConvos(nextConvos)
    setInput("")
    setStreaming(true)
    setStreamText("")
    setToolsUsed([])

    abortRef.current = new AbortController()

    try {
      const res = await fetch("/api/mcp-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          mode: "chat",
          premium: isSubscribed(),
          unrestricted: hasUnrestricted(),
          messages: nextConvos[activePersona].messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          persona: {
            name:          persona.name,
            personality:   persona.personality,
            speakingStyle: persona.speakingStyle,
            backstory:     persona.backstory,
            language:      "auto",
            warmth:        persona.defaultWarmth ?? 70,
            talkStyle:     persona.defaultTalkStyle ?? 50,
            category:      persona.category,
          },
        }),
      })

      // Read which MCP prompt + tools were activated
      const mcpPrompt = res.headers.get("X-MCP-Prompt") ?? ""
      const mcpTools  = res.headers.get("X-MCP-Tools")?.split(",").filter(Boolean) ?? []
      if (mcpTools.length) setToolsUsed(mcpTools)
      // Presence read of the user's vibe
      const vibeHeader = res.headers.get("X-Vibe")
      if (vibeHeader) setVibe(decodeURIComponent(vibeHeader))
      // Restricted ask by a free user → surface the one-tap $10 unlock.
      if (res.headers.get("X-MCP-Upsell")) setShowUnlock(true)

      if (!res.body) throw new Error("No stream body")

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let full = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const raw   = decoder.decode(value, { stream: true })
        // Strip tool metadata markers (\x00TOOLS:...\x00)
        const clean = raw.replace(/\x00TOOLS:([^\x00]*)\x00/, (_, tools) => {
          setToolsUsed(tools.split(",").filter(Boolean))
          return ""
        })
        full += clean
        setStreamText(full)
      }

      const assistantMsg: Message = { role: "assistant", content: full, ts: Date.now() }
      const withReply = {
        ...nextConvos,
        [activePersona]: {
          ...nextConvos[activePersona],
          lastActive: Date.now(),
          messages: [...nextConvos[activePersona].messages, assistantMsg],
        },
      }
      setConvos(withReply)
      saveConvos(withReply)
    } catch (e: unknown) {
      if ((e as Error)?.name !== "AbortError") {
        // show error message inline
        const errMsg: Message = {
          role: "assistant",
          content: "⚠️ Couldn't reach the AI — check your LLM connection.",
          ts: Date.now(),
        }
        setConvos((prev) => {
          const updated = {
            ...prev,
            [activePersona]: {
              ...prev[activePersona],
              messages: [...(prev[activePersona]?.messages ?? []), errMsg],
            },
          }
          saveConvos(updated)
          return updated
        })
      }
    } finally {
      setStreaming(false)
      setStreamText("")
    }
  }, [input, streaming, convos, activePersona, persona])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
  }

  const sortedPersonas = [...PERSONALITY_PRESETS].sort((a, b) => {
    return (convos[b.name]?.lastActive ?? 0) - (convos[a.name]?.lastActive ?? 0)
  })

  return (
    <div className="flex h-screen bg-stone-950 text-white overflow-hidden">

      {/* ── Conversation list ── */}
      <div className="w-64 border-r border-white/8 flex flex-col shrink-0 hidden sm:flex">
        <div className="px-4 py-4 border-b border-white/5">
          <h2 className="font-bold text-sm">Conversations</h2>
          <p className="text-[11px] text-white/35 mt-0.5">Unrestricted · private</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sortedPersonas.map((p) => {
            const lastMsg  = convos[p.name]?.messages?.at(-1)
            const isActive = activePersona === p.name
            return (
              <button
                key={p.name}
                onClick={() => setActive(p.name)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left ${isActive ? "bg-white/8" : ""}`}
              >
                <img
                  src={imageFor(p)}
                  alt={p.name}
                  className="w-9 h-9 rounded-full object-cover shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/notionists/svg?seed=${p.name}` }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{p.name}</div>
                  <div className="text-[11px] text-white/35 truncate mt-0.5">
                    {lastMsg ? lastMsg.content.slice(0, 32) + "…" : CATEGORY_INFO[p.category].label}
                  </div>
                </div>
                {lastMsg && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 self-start mt-1.5" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Chat center ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 shrink-0">
          <img
            src={imageFor(persona)}
            alt={persona.name}
            className="w-9 h-9 rounded-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/notionists/svg?seed=${persona.name}` }}
          />
          <div className="flex-1">
            <h3 className="font-bold text-sm">{persona.name}</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-white/40">{CATEGORY_INFO[persona.category].label} · online</span>
            </div>
          </div>
          {/* Breathe — appears when the read is tense/anxious */}
          {isTense && (
            <button onClick={() => setBreatheOpen(true)} title="Take a breath"
              className="flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 px-2.5 py-1 rounded-full transition-colors">
              <Wind size={11} /> Breathe
            </button>
          )}
          {/* Vibe read of the user */}
          {vibe && (
            <span title="What the room is reading from you"
              className="hidden sm:flex items-center gap-1 text-[11px] font-semibold bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-white/60 capitalize">
              {vibe.split("|")[0]}
            </span>
          )}
          <button
            onClick={() => setCallOpen(true)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-amber-500/15 border border-amber-500/25 text-amber-300 hover:bg-amber-500/25 px-3 py-1.5 rounded-xl transition-colors"
          >
            <Mic size={12} /> Voice call
          </button>
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
            <Sparkles size={10} /> Unrestricted
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {messages.length === 0 && !streaming && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <img
                src={imageFor(persona)}
                alt={persona.name}
                className="w-20 h-20 rounded-2xl object-cover shadow-2xl ring-2 ring-white/10"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/notionists/svg?seed=${persona.name}` }}
              />
              <div>
                <p className="font-bold text-xl">{persona.name}</p>
                <p className="text-sm text-white/40 mt-1.5 max-w-xs leading-relaxed">{persona.personality?.slice(0, 120)}…</p>
              </div>
              <p className="text-xs text-white/20 mt-2">Say hello to start the conversation</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <img
                  src={imageFor(persona)}
                  alt={persona.name}
                  className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/notionists/svg?seed=${persona.name}` }}
                />
              )}
              <div className="max-w-[72%]">
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-amber-500 text-white rounded-br-sm"
                    : "bg-white/8 border border-white/10 text-white/90 rounded-bl-sm"
                }`}>
                  {msg.content}
                </div>
                {/* AI voice note — the AI's voice is the paid product */}
                {msg.role === "assistant" && (
                  <VoiceNote
                    text={msg.content}
                    voice={persona.voice}
                    personaName={persona.name}
                    paidCredits={balance}
                    onSpendCredits={(c) => spendCredits(c, "call_billing")}
                    onNeedTopUp={() => setTopUpOpen(true)}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Tool usage indicator */}
          {streaming && toolsUsed.length > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-amber-400 animate-pulse pl-10">
              <Zap size={10} />
              {toolsUsed.map((t) => (
                <span key={t} className="bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  {t.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}

          {/* Streaming */}
          {streaming && (
            <div className="flex gap-3">
              <img
                src={imageFor(persona)}
                alt={persona.name}
                className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/notionists/svg?seed=${persona.name}` }}
              />
              <div className="bg-white/8 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed text-white/90 max-w-[72%]">
                {streamText || (
                  <span className="flex gap-1">
                    {[0,1,2].map((i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce inline-block"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                )}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Restricted-ask unlock prompt */}
        {showUnlock && (
          <div className="shrink-0 px-5 pb-2">
            <UnrestrictedUpsell context={persona.name} />
          </div>
        )}

        {/* Input */}
        <div className="shrink-0 px-5 py-4 border-t border-white/5">
          <div className="flex gap-3 items-end">
            <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-amber-500/40 transition-colors">
              <textarea
                ref={taRef}
                rows={1}
                placeholder={`Message ${persona.name}…`}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  e.target.style.height = "auto"
                  e.target.style.height = Math.min(e.target.scrollHeight, 130) + "px"
                }}
                onKeyDown={handleKey}
                className="w-full bg-transparent text-sm text-white placeholder-white/30 resize-none focus:outline-none leading-relaxed"
                style={{ maxHeight: 130 }}
              />
            </div>
            <button
              onClick={send}
              disabled={!input.trim() || streaming}
              className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:scale-105 active:scale-95 shrink-0 mb-0.5"
            >
              <Send size={16} className="text-white" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-white/20">Shift+Enter for new line</p>
            <div className="flex items-center gap-1.5 text-[10px] text-white/20">
              <Lock size={9} /> End-to-end private
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="w-60 border-l border-white/8 flex-col shrink-0 hidden xl:flex">
        <div className="p-5 border-b border-white/5">
          <img
            src={imageFor(persona)}
            alt={persona.name}
            className="w-full h-40 object-cover rounded-xl mb-3"
            onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/notionists/svg?seed=${persona.name}` }}
          />
          <h4 className="font-bold text-sm">{persona.name}</h4>
          <span className="text-[11px] text-amber-300 bg-amber-500/15 border border-amber-500/20 px-2 py-0.5 rounded-full mt-1 inline-block">
            {CATEGORY_INFO[persona.category].label}
          </span>
        </div>
        <div className="flex-1 p-4 space-y-4 overflow-y-auto text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/25 font-bold mb-1.5">About</div>
            <p className="text-white/50 leading-relaxed">{persona.personality?.slice(0, 180)}…</p>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/25 font-bold mb-1.5">Voice</div>
            <p className="text-white/50 capitalize">{persona.voice}</p>
          </div>
        </div>
        <div className="p-4 border-t border-white/5">
          <button
            onClick={() => setCallOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold py-2.5 rounded-xl transition-all hover:scale-[1.02]"
          >
            <Mic size={13} /> Switch to voice call
          </button>
        </div>
      </div>

      {/* Breathing overlay */}
      {/* 1:1 voice call with THIS persona — in-place, not a jump to the orb/rooms */}
      {callOpen && (
        <VoiceCallPanel
          persona={voicePersona}
          emoji="🎙️"
          title={persona.name}
          subtitle={(persona as any).personality?.slice(0, 80)}
          onClose={() => setCallOpen(false)}
        />
      )}

      {breatheOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={() => setBreatheOpen(false)}>
          <div className="bg-stone-900/80 border border-white/10 rounded-3xl p-8" onClick={(e) => e.stopPropagation()}>
            <BreathingRing onClose={() => setBreatheOpen(false)} />
          </div>
        </div>
      )}

      {/* Top-up modal — slide $1→$60 (unlimited) */}
      {topUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setTopUpOpen(false)}>
          <div className="bg-stone-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-lg flex items-center gap-2"><Mic size={18} className="text-amber-400" /> Add voice credit</h3>
              <button onClick={() => setTopUpOpen(false)} className="text-white/40 hover:text-white"><XIcon size={18} /></button>
            </div>
            <p className="text-sm text-white/50 mb-5">Text is free. Your 5 free voice minutes are used — top up to keep hearing the AI out loud.</p>
            <TopUpSlider onDone={() => setTopUpOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function ChatPage() {
  return <Suspense><ChatContent /></Suspense>
}
