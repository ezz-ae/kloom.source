"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { joinVoiceRoom, type VoiceRoomHandle, type VoiceStatus } from "@/lib/voice-room"
import { colorFor } from "@/lib/room-session"
import { Mic, MicOff, PhoneOff, Phone, Loader2, Users, Headphones } from "lucide-react"

interface GroupVoiceProps {
  roomId: string
  sessionId: string
  selfId: string                 // your handle
  /** Speak AI replies aloud locally while in the call. */
  onWantAiVoice?: (on: boolean) => void
}

interface RemotePeer { id: string; stream: MediaStream }

export function GroupVoice({ roomId, sessionId, selfId, onWantAiVoice }: GroupVoiceProps) {
  const [status, setStatus]   = useState<VoiceStatus>("idle")
  const [statusMsg, setMsg]   = useState<string>("")
  const [peers, setPeers]     = useState<RemotePeer[]>([])
  const [muted, setMuted]     = useState(false)
  const [listenOnly, setListenOnly] = useState(false)
  const [aiVoice, setAiVoice] = useState(true)
  const handleRef             = useRef<VoiceRoomHandle | null>(null)
  const audioElsRef           = useRef<Map<string, HTMLAudioElement>>(new Map())

  const join = useCallback(async (mode: "speak" | "listen" = "speak") => {
    const isListenOnly = mode === "listen"
    setListenOnly(isListenOnly)
    setMuted(isListenOnly) // Muted by default if listen only
    try {
      const h = await joinVoiceRoom(roomId, sessionId, selfId, {
        onRemoteStream: (peerId, stream) => {
          setPeers((prev) => prev.some((p) => p.id === peerId) ? prev : [...prev, { id: peerId, stream }])
        },
        onPeerLeave: (peerId) => {
          setPeers((prev) => prev.filter((p) => p.id !== peerId))
          const el = audioElsRef.current.get(peerId)
          if (el) { el.srcObject = null; el.remove(); audioElsRef.current.delete(peerId) }
        },
        onStatus:    (s, m) => { setStatus(s); if (m) setMsg(m) },
        onPeerCount: () => {},
      }, { listenOnly: isListenOnly })
      handleRef.current = h
      onWantAiVoice?.(aiVoice)
    } catch {
      setStatus("error")
    }
  }, [roomId, sessionId, selfId, aiVoice, onWantAiVoice])

  const leave = useCallback(() => {
    handleRef.current?.leave()
    handleRef.current = null
    setPeers([])
    setStatus("idle")
    onWantAiVoice?.(false)
  }, [onWantAiVoice])

  useEffect(() => () => { handleRef.current?.leave() }, [])

  // Attach remote streams to hidden audio elements
  useEffect(() => {
    peers.forEach((p) => {
      let el = audioElsRef.current.get(p.id)
      if (!el) {
        el = document.createElement("audio")
        el.autoplay = true
        ;(el as any).playsInline = true
        document.body.appendChild(el)
        audioElsRef.current.set(p.id, el)
      }
      if (el.srcObject !== p.stream) el.srcObject = p.stream
    })
  }, [peers])

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    handleRef.current?.setMuted(next)
  }

  const isLive = status === "live" || status === "connecting"

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users size={15} className="text-amber-400" />
        <span className="text-sm font-bold">Group voice</span>
        {isLive && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {peers.length + 1} on the call
          </span>
        )}
      </div>

      {!isLive ? (
        <>
          <p className="text-xs text-white/45 mb-3 leading-relaxed">
            Live mic-to-mic with everyone in this room. AI replies are spoken aloud too.
          </p>
          <div className="flex gap-2">
            <button onClick={() => join("speak")} disabled={status === "requesting-mic"}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-all text-sm">
              {status === "requesting-mic" ? <Loader2 size={15} className="animate-spin" /> : <Phone size={15} />}
              {status === "requesting-mic" ? "Allow mic…" : "Join"}
            </button>
            <button onClick={() => join("listen")} disabled={status === "requesting-mic"}
              className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-all text-sm">
              <Headphones size={15} /> Listen In
            </button>
          </div>
          {status === "error" && <p className="text-xs text-red-400 mt-2 text-center">{statusMsg || "Couldn't start voice"}</p>}
        </>
      ) : (
        <>
          {/* Participants */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className={`flex items-center gap-1.5 border rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              listenOnly ? "bg-stone-800 border-stone-700 text-stone-300" : "bg-amber-500/15 border-amber-500/25 text-amber-300"
            }`}>
              {listenOnly ? <Headphones size={10} /> : <Mic size={10} />} You
            </span>
            {peers.map((p) => (
              <span key={p.id} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border"
                style={{ backgroundColor: colorFor(p.id) + "22", borderColor: colorFor(p.id) + "55", color: colorFor(p.id) }}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" /> {p.id}
              </span>
            ))}
            {peers.length === 0 && <span className="text-[11px] text-white/35 self-center">Waiting for others to join…</span>}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {!listenOnly && (
              <button onClick={toggleMute}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  muted ? "bg-red-500/20 border border-red-500/30 text-red-300" : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                }`}>
                {muted ? <MicOff size={14} /> : <Mic size={14} />} {muted ? "Unmute" : "Mute"}
              </button>
            )}
            <button onClick={leave}
              className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-bold transition-all ${listenOnly ? "flex-1" : ""}`}>
              <PhoneOff size={14} /> Leave
            </button>
          </div>

          {/* AI voice toggle */}
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input type="checkbox" checked={aiVoice} onChange={(e) => { setAiVoice(e.target.checked); onWantAiVoice?.(e.target.checked) }} className="accent-amber-500" />
            <span className="text-[11px] text-white/50">Speak AI replies aloud for everyone</span>
          </label>
        </>
      )}
    </div>
  )
}
