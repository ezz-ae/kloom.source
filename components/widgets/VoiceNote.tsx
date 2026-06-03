"use client"

import { useState, useRef, useCallback } from "react"
import { consumeVoice, voiceAvailable, getFreeRemainingSec, hasUnlimited } from "@/lib/voice-credits"
import { Play, Pause, Loader2, Lock } from "lucide-react"

interface VoiceNoteProps {
  text: string
  voice?: string
  personaName?: string
  paidCredits: number
  onSpendCredits: (credits: number) => void
  onNeedTopUp: () => void
}

// Strip widget markers / markdown so the voice note reads only spoken words.
function clean(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " (code) ")
    .replace(/\[(CHART|CALC|WALLET|TOKEN_WIZARD|PLAYBOOK|CANVA)[^\]]*\]/g, "")
    .replace(/[*_`#>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 600)
}

export function VoiceNote({ text, voice = "sage", personaName, paidCredits, onSpendCredits, onNeedTopUp }: VoiceNoteProps) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle")
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  const play = useCallback(async () => {
    if (state === "playing") { audioRef.current?.pause(); setState("idle"); return }

    // Gate: free 5 min, then paid, then unlimited
    if (!voiceAvailable(paidCredits)) { onNeedTopUp(); return }

    setState("loading")
    try {
      let url = blobUrlRef.current
      if (!url) {
        const res = await fetch("/api/tts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: clean(text), voice, personaName }),
        })
        if (!res.ok) throw new Error("tts")
        const blob = await res.blob()
        url = URL.createObjectURL(blob)
        blobUrlRef.current = url
      }

      const audio = audioRef.current ?? new Audio()
      audioRef.current = audio
      audio.src = url
      audio.onended = () => {
        setState("idle")
        // Bill the actual duration once playback completes
        const secs = Math.max(1, Math.round(audio.duration || 3))
        const r = consumeVoice(secs, paidCredits)
        if (r.creditsToDeduct > 0) onSpendCredits(r.creditsToDeduct)
      }
      audio.onpause = () => setState((s) => (s === "playing" ? "idle" : s))
      await audio.play()
      setState("playing")
    } catch {
      setState("idle")
    }
  }, [state, text, voice, paidCredits, onSpendCredits, onNeedTopUp])

  const blocked = !voiceAvailable(paidCredits)
  const freeLeft = getFreeRemainingSec()

  return (
    <button
      onClick={play}
      title={blocked ? "Add voice credit to hear this" : "Play voice note"}
      className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all ${
        blocked
          ? "border-border/50 bg-white/5 text-foreground/40 hover:bg-white/10"
          : "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
      }`}
    >
      {state === "loading" ? <Loader2 size={12} className="animate-spin" />
        : blocked ? <Lock size={11} />
        : state === "playing" ? <Pause size={12} />
        : <Play size={12} />}
      {/* tiny faux waveform */}
      <span className="flex items-end gap-[2px] h-3">
        {[6, 10, 4, 12, 7, 11, 5].map((h, i) => (
          <span key={i} className={`w-[2px] rounded-full ${state === "playing" ? "bg-amber-300 animate-pulse" : "bg-current opacity-50"}`} style={{ height: h }} />
        ))}
      </span>
      {blocked ? "Add credit"
        // Only nudge free minutes when the user has NO paid credit (and isn't unlimited).
        : (!hasUnlimited() && paidCredits <= 0 && freeLeft > 0)
          ? `Voice note · ${Math.ceil(freeLeft / 60)}m free left`
          : "Voice note"}
    </button>
  )
}
