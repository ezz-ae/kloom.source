"use client"

/**
 * AIRROOM — the air-off bubble. A private 1:1 with a cluster's host: it greets
 * aloud, you reply, it answers in voice (/api/chat + /api/tts). Two ways to talk:
 *   • push-to-talk ("talk") — tap, say one thing, it sends.
 *   • hands-free ("live")   — keep the mic open; just talk and each line sends,
 *                             no pressing. Ignores its own voice while it speaks.
 * Cam is framed but gated — only here, only by mutual yes.
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

/* eslint-disable @typescript-eslint/no-explicit-any */
export function AirBubble({ cluster, tempLabel, onClose }: { cluster: Cluster; tempLabel: string; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ who: "host", text: cluster.lines[0] }])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [sttOk, setSttOk] = useState(false)
  const [listening, setListening] = useState(false)   // push-to-talk active
  const [handsFree, setHandsFree] = useState(false)    // continuous mode

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const msgsRef = useRef(msgs)
  const busyRef = useRef(false)
  const hostSpeakingRef = useRef(false)
  const onceRecRef = useRef<any>(null)
  const hfRef = useRef(false)
  const clickTimer = useRef<any>(null)

  useEffect(() => { msgsRef.current = msgs }, [msgs])
  useEffect(() => { hfRef.current = handsFree }, [handsFree])
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9 }) }, [msgs])
  useEffect(() => { const w = window as any; setSttOk(!!(w.SpeechRecognition || w.webkitSpeechRecognition)) }, [])

  const speak = async (text: string) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, personaName: cluster.host, gender: cluster.gender, language: "English" }),
      })
      if (!res.ok) return
      const url = URL.createObjectURL(await res.blob())
      const a = audioRef.current
      if (a) {
        hostSpeakingRef.current = true            // don't transcribe the host's own voice
        a.onended = () => { hostSpeakingRef.current = false }
        a.src = url
        await a.play().catch(() => { hostSpeakingRef.current = false })
      }
    } catch { hostSpeakingRef.current = false }
  }

  useEffect(() => { speak(cluster.lines[0]) }, []) // greet on open

  const send = async (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || busyRef.current) return
    setInput("")
    busyRef.current = true; setBusy(true)
    const next: Msg[] = [...msgsRef.current, { who: "you", text }]
    msgsRef.current = next; setMsgs(next)
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: personaFor(cluster), messages: next.map((m) => ({ role: m.who === "you" ? "user" : "assistant", content: m.text })) }),
      })
      let full = ""
      if (res.ok && res.body) {
        const reader = res.body.getReader(); const dec = new TextDecoder()
        for (;;) { const { done, value } = await reader.read(); if (done) break; full += dec.decode(value) }
      }
      full = full.trim() || "…"
      const after: Msg[] = [...next, { who: "host", text: full }]
      msgsRef.current = after; setMsgs(after)
      speak(full)
    } catch {
      const after: Msg[] = [...next, { who: "host", text: "…you cut out for a second. say that again?" }]
      msgsRef.current = after; setMsgs(after)
    } finally {
      busyRef.current = false; setBusy(false)
    }
  }

  // push-to-talk: one utterance, then sends.
  const talkOnce = () => {
    if (listening) { try { onceRecRef.current?.stop() } catch { /* */ } setListening(false); return }
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = "en-US"; rec.interimResults = false; rec.continuous = false
    rec.onresult = (e: any) => { const t = e.results?.[0]?.[0]?.transcript?.trim(); setListening(false); if (t) send(t) }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    onceRecRef.current = rec
    try { rec.start(); setListening(true) } catch { setListening(false) }
  }

  // One button, two gestures: single tap = talk once · double tap = hands-free
  // (mic stays open). Single tap while live turns it back off.
  const onTalk = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current); clickTimer.current = null
      setHandsFree((h) => !h)
      return
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null
      if (hfRef.current) setHandsFree(false)
      else talkOnce()
    }, 240)
  }

  // hands-free: keep the mic open and auto-send each finished utterance.
  useEffect(() => {
    if (!handsFree) return
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) { setHandsFree(false); return }
    try { onceRecRef.current?.stop() } catch { /* */ }
    setListening(false)
    let stopped = false
    const rec = new SR()
    rec.lang = "en-US"; rec.interimResults = false; rec.continuous = true
    rec.onresult = (e: any) => {
      const r = e.results?.[e.results.length - 1]
      if (!r || !r.isFinal) return
      const t = r[0]?.transcript?.trim()
      if (t && !hostSpeakingRef.current && !busyRef.current) send(t)
    }
    rec.onerror = (ev: any) => { if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed") setHandsFree(false) }
    rec.onend = () => { if (!stopped) { try { rec.start() } catch { /* */ } } }
    try { rec.start() } catch { /* */ }
    return () => { stopped = true; try { rec.stop() } catch { /* */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handsFree])

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
        {sttOk && (
          <div style={{ fontSize: 11, color: handsFree ? "#7fd6c0" : "#7f93a5", marginBottom: 9, textAlign: "center" }}>
            {handsFree ? "live — mic's open, just talk · tap talk to stop" : "tap talk to speak once · double-tap to keep the mic open"}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send() }}
            placeholder={handsFree ? "…or type" : `say something to ${cluster.host.toLowerCase()}…`}
            style={{ flex: 1, fontSize: 14, color: "#eef4f8", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.18)", borderRadius: 14, padding: "11px 14px", outline: "none" }}
          />
          {sttOk && (
            <button onClick={onTalk} aria-label="talk — tap to speak once, double-tap for hands-free" style={{ fontSize: 13, fontWeight: handsFree ? 500 : 400, color: (handsFree || listening) ? "#06201a" : "#dfeaf2", background: handsFree ? "#7fd6c0" : listening ? "#bfe9d8" : "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.18)", borderRadius: 14, padding: "11px 14px", cursor: "pointer", whiteSpace: "nowrap" }}>{handsFree ? "live" : listening ? "listening" : "talk"}</button>
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
