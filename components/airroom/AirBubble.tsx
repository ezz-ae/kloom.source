"use client"

/**
 * AIRROOM — the air-off bubble. You pulled out of the floor into a private
 * one-on-one with a cluster's host. Real exchange: the host greets you aloud,
 * you reply, it answers in voice (reuses /api/chat + /api/tts). Cam is framed
 * but gated — it only unlocks here, and only by mutual yes (human↔human cam
 * lands when real people are on the floor; for now this is you ↔ the host).
 */
import { useEffect, useRef, useState } from "react"
import type { Cluster } from "@/lib/airroom/roster"

interface Msg { who: "host" | "you"; text: string }

function personaFor(c: Cluster) {
  return {
    name: c.host,
    personality: `You are ${c.host}, the ${c.archetype.toLowerCase()} of "${c.name}" on a late-night live voice floor (vibe: ${c.vibe}). You are warm, real, present, unmistakably human — never a corporate assistant, never robotic. Someone just "aired off" into a private one-on-one with you. Keep EVERY reply to one or two short spoken sentences. Match the heat: calm and sharp in the cool rooms, playful and flirty — but classy, never explicit — in the warm and fire rooms.`,
    speakingStyle: "spoken, casual, a little imperfect — like a real voice at 2am",
    backstory: `A familiar voice on the ${c.vibe} part of the floor.`,
    language: "English",
  }
}

export function AirBubble({ cluster, tempLabel, onClose }: { cluster: Cluster; tempLabel: string; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ who: "host", text: cluster.lines[0] }])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [listening, setListening] = useState(false)
  const [sttOk, setSttOk] = useState(false)
  const recRef = useRef<{ stop: () => void; start: () => void } | null>(null)

  const speak = async (text: string) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, personaName: cluster.host, gender: cluster.gender, language: "English" }),
      })
      if (!res.ok) return
      const url = URL.createObjectURL(await res.blob())
      const a = audioRef.current
      if (a) { a.src = url; await a.play().catch(() => {}) }
    } catch { /* ignore */ }
  }

  useEffect(() => { speak(cluster.lines[0]) }, []) // greet on open
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9 }) }, [msgs])

  const send = async (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || busy) return
    setInput("")
    const next = [...msgs, { who: "you" as const, text }]
    setMsgs(next)
    setBusy(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona: personaFor(cluster),
          messages: next.map((m) => ({ role: m.who === "you" ? "user" : "assistant", content: m.text })),
        }),
      })
      let full = ""
      if (res.ok && res.body) {
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        for (;;) { const { done, value } = await reader.read(); if (done) break; full += dec.decode(value) }
      }
      full = full.trim() || "…"
      setMsgs((m) => [...m, { who: "host", text: full }])
      speak(full)
    } catch {
      setMsgs((m) => [...m, { who: "host", text: "…you cut out for a second. say that again?" }])
    } finally {
      setBusy(false)
    }
  }

  // Voice-first: talk to the host with the browser's speech recognition.
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    setSttOk(typeof window !== "undefined" && !!(w.SpeechRecognition || w.webkitSpeechRecognition))
  }, [])

  const toggleMic = () => {
    if (listening) { try { recRef.current?.stop() } catch { /* */ } setListening(false); return }
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1
    rec.onresult = (e: any) => { const t = e.results?.[0]?.[0]?.transcript?.trim(); setListening(false); if (t) send(t) }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    /* eslint-enable @typescript-eslint/no-explicit-any */
    recRef.current = rec
    try { rec.start(); setListening(true) } catch { setListening(false) }
  }

  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(3,5,10,.86)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", zIndex: 20 }}>
      <div style={{ padding: "18px 22px 10px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 12, color: "#9fb2c4", letterSpacing: 1 }}>aired off · just you two</div>
          <div style={{ fontSize: 19, fontWeight: 500, color: "#eef4f8" }}>{cluster.host} · {cluster.name}</div>
          <div style={{ fontSize: 11, color: "#7f93a5" }}>{tempLabel}</div>
        </div>
        <button onClick={onClose} style={{ fontSize: 13, color: "#cdd9e3", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.2)", padding: "7px 12px", borderRadius: 12, cursor: "pointer" }}>back to floor</button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "8px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.who === "you" ? "flex-end" : "flex-start", maxWidth: "82%", fontSize: 15, lineHeight: 1.45, color: m.who === "you" ? "#0a1622" : "#eef4f8", background: m.who === "you" ? "#cfe0ee" : "rgba(255,255,255,.08)", padding: "9px 13px", borderRadius: 16 }}>
            {m.text}
          </div>
        ))}
        {busy && <div style={{ alignSelf: "flex-start", fontSize: 13, color: "#7f93a5", fontStyle: "italic" }}>{cluster.host} is talking…</div>}
      </div>

      <div style={{ padding: "10px 18px 18px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send() }}
            placeholder={`say something to ${cluster.host.toLowerCase()}…`}
            style={{ flex: 1, fontSize: 14, color: "#eef4f8", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.18)", borderRadius: 14, padding: "11px 14px", outline: "none" }}
          />
          {sttOk && (
            <button onClick={toggleMic} aria-label="talk to the host" style={{ fontSize: 13, color: listening ? "#06201a" : "#dfeaf2", background: listening ? "#7fd6c0" : "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.18)", borderRadius: 14, padding: "11px 14px", cursor: "pointer", whiteSpace: "nowrap" }}>{listening ? "listening" : "talk"}</button>
          )}
          <button onClick={() => send()} disabled={busy} style={{ fontSize: 14, color: "#1a0d08", background: "#ef7a4d", border: "none", borderRadius: 14, padding: "11px 16px", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>send</button>
        </div>
        <div style={{ marginTop: 9, fontSize: 11, color: "#7f93a5", textAlign: "center" }}>
          cam unlocks only here — and only if you both say yes · <span style={{ opacity: 0.55 }}>ask for cam (both must agree)</span>
        </div>
      </div>
      <audio ref={audioRef} style={{ display: "none" }} />
    </div>
  )
}
