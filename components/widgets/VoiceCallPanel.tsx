"use client"

/**
 * Reusable 1:1 voice call overlay — the SAME engine experts use (useRealtimeVoice),
 * so "Voice call" from the Chat page calls THAT persona in-place instead of jumping
 * to a separate generic orb page. Auto-connects on open; X to hang up + close.
 */
import { useEffect } from "react"
import { useRealtimeVoice, type Persona } from "@/hooks/use-realtime-voice"
import { Phone, PhoneOff, Loader2, Volume2, VolumeX, X } from "lucide-react"

export function VoiceCallPanel({
  persona, emoji = "🎙️", title, subtitle, onClose, onTranscript,
}: {
  persona: Persona
  emoji?: string
  title?: string
  subtitle?: string
  onClose: () => void
  onTranscript?: (text: string, who: "user" | "ai") => void
}) {
  const { isConnected, isConnecting, isSpeaking, error, connect, disconnect, stopAI } =
    useRealtimeVoice({ persona, onTranscript: (t, who) => onTranscript?.(t, who === "user" ? "user" : "ai") })

  // Auto-start the call when the panel opens.
  useEffect(() => { const t = setTimeout(() => connect(), 250); return () => clearTimeout(t) }, []) // eslint-disable-line

  const hangUp = () => { try { disconnect() } catch {} ; onClose() }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center gap-7 p-6">
      <button onClick={hangUp} className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/8 border border-border/50 flex items-center justify-center text-foreground/60 hover:text-foreground">
        <X size={18} />
      </button>

      <div className={`relative transition-all ${isSpeaking ? "scale-110" : ""}`}>
        <div className={`w-32 h-32 rounded-[2rem] bg-gradient-to-br from-amber-500/30 to-orange-500/30 border flex items-center justify-center text-6xl transition-all ${isSpeaking ? "ring-4 ring-amber-400 shadow-2xl shadow-amber-500/30" : "ring-2 ring-border/50"}`}>
          {emoji}
        </div>
        {isSpeaking && <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center"><Volume2 size={13} className="text-foreground" /></div>}
      </div>

      <div className="text-center">
        <p className="font-bold text-lg text-foreground">{title ?? persona.name}</p>
        {subtitle && <p className="text-xs text-foreground/40 mt-1 max-w-xs">{subtitle}</p>}
      </div>

      <div className="text-center text-sm h-5">
        {isConnecting && <span className="text-foreground/50 animate-pulse">Connecting…</span>}
        {isConnected && !isSpeaking && <span className="text-emerald-400">● Listening</span>}
        {isConnected && isSpeaking && <span className="text-amber-400 animate-pulse">Speaking…</span>}
        {!isConnected && !isConnecting && <span className="text-foreground/30">Tap to start the call</span>}
        {error && <p className="text-xs text-red-400 mt-1 max-w-[240px]">{error}</p>}
      </div>

      <div className="flex items-center gap-4">
        {isConnected && isSpeaking && (
          <button onClick={stopAI} title="Interrupt" className="w-11 h-11 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center"><VolumeX size={17} className="text-amber-400" /></button>
        )}
        <button onClick={() => (isConnected ? hangUp() : connect())} disabled={isConnecting}
          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-105 disabled:opacity-50 ${isConnected ? "bg-red-500 hover:bg-red-400" : "bg-emerald-500 hover:bg-emerald-400"}`}>
          {isConnecting ? <Loader2 size={24} className="text-foreground animate-spin" /> : isConnected ? <PhoneOff size={24} className="text-foreground" /> : <Phone size={24} className="text-foreground" />}
        </button>
      </div>
      <p className="text-[11px] text-foreground/30">The Pass · $9 · 90 days · 6000 voice minutes</p>
    </div>
  )
}
