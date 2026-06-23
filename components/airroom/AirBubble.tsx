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
import { SpeechSegmenter } from "@/lib/speech-segmenter"

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
export function AirBubble({ cluster, tempLabel, onClose, onTalked }: { cluster: Cluster; tempLabel: string; onClose: () => void; onTalked?: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ who: "host", text: cluster.lines[0] }])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [sttOk, setSttOk] = useState(false)
  const [listening, setListening] = useState(false)   // push-to-talk active
  const [handsFree, setHandsFree] = useState(false)    // continuous mode
  const [revealed, setRevealed] = useState(false)
  const [trouble, setTrouble] = useState(false)     // backend unreachable — show retry, don't fake a reply

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const msgsRef = useRef(msgs)
  const busyRef = useRef(false)
  const hostSpeakingRef = useRef(false)
  const onceRecRef = useRef<any>(null)
  const segRef = useRef<SpeechSegmenter | null>(null)   // hands-free recorder (iOS-proof)
  const hfRef = useRef(false)
  const clickTimer = useRef<any>(null)
  const talkedRef = useRef(false)   // fire onTalked once, on the first thing the user says

  useEffect(() => { msgsRef.current = msgs }, [msgs])
  useEffect(() => { hfRef.current = handsFree }, [handsFree])
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9 }) }, [msgs])
  useEffect(() => { const w = window as any; setSttOk(!!(w.SpeechRecognition || w.webkitSpeechRecognition)) }, [])

  const speak = async (text: string) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, personaName: cluster.host, gender: cluster.gender, language: "English", voiceId: cluster.voiceId }),
      })
      if (!res.ok) return
      const url = URL.createObjectURL(await res.blob())
      const a = audioRef.current
      if (a) {
        hostSpeakingRef.current = true            // don't transcribe the host's own voice
        try { segRef.current?.abort() } catch { /* */ }   // pause the live mic while the host speaks (no echo loop)
        const resume = () => { hostSpeakingRef.current = false; if (hfRef.current) { try { segRef.current?.start() } catch { /* */ } } }
        a.onended = resume
        a.src = url
        await a.play().catch(resume)              // play blocked → don't strand the mic paused
      }
    } catch { hostSpeakingRef.current = false }
  }

  useEffect(() => { speak(cluster.lines[0]) }, []) // greet on open

  // Ask for the next reply using whatever's currently in the transcript. Both
  // send() and retry() go through here, so a retry never re-adds the user's line.
  const requestReply = async () => {
    busyRef.current = true; setBusy(true); setTrouble(false)
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: personaFor(cluster), messages: msgsRef.current.map((m) => ({ role: m.who === "you" ? "user" : "assistant", content: m.text })) }),
      })
      if (!res.ok) { setTrouble(true); return } // surfaced, not swallowed — the user's line stays, retry is offered
      let full = ""
      if (res.body) {
        const reader = res.body.getReader(); const dec = new TextDecoder()
        for (;;) { const { done, value } = await reader.read(); if (done) break; full += dec.decode(value) }
      }
      full = full.trim() || cluster.lines[1] || cluster.lines[0] // empty-but-ok: a soft in-character beat, never a bare "…"
      const after: Msg[] = [...msgsRef.current, { who: "host", text: full }]
      msgsRef.current = after; setMsgs(after)
      speak(full)
    } catch {
      setTrouble(true) // network drop — show retry rather than fabricating a reply
    } finally {
      busyRef.current = false; setBusy(false)
    }
  }

  const send = async (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || busyRef.current) return
    setInput("")
    if (!talkedRef.current) { talkedRef.current = true; onTalked?.() }   // the aha — they actually spoke
    const next: Msg[] = [...msgsRef.current, { who: "you", text }]
    msgsRef.current = next; setMsgs(next)
    await requestReply()
  }

  const retry = () => { if (!busyRef.current) requestReply() }

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

  // hands-free: keep the mic open and auto-send each finished utterance. Primary
  // path is MediaRecorder + server Whisper (SpeechSegmenter) — it stays live across
  // many turns, INCLUDING on iOS Safari, where the browser's continuous
  // webkitSpeechRecognition dies after one utterance and can't auto-restart without
  // a fresh user gesture (the "live but only one message" bug). Browser SR is kept
  // only as a fallback when MediaRecorder/STT is unavailable.
  useEffect(() => {
    if (!handsFree) return
    try { onceRecRef.current?.stop() } catch { /* */ }
    setListening(false)

    let cancelled = false
    let seg: SpeechSegmenter | null = null
    let stream: MediaStream | null = null
    let fallbackRec: any = null
    let stopped = false

    const startBrowserFallback = () => {
      const w = window as any
      const SR = w.SpeechRecognition || w.webkitSpeechRecognition
      if (!SR) { setHandsFree(false); return }
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
      fallbackRec = rec
      try { rec.start() } catch { /* */ }
    }

    ;(async () => {
      const canRecord = typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia
      if (!canRecord) { startBrowserFallback(); return }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch { setHandsFree(false); return }   // mic denied
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
      seg = new SpeechSegmenter({
        stream,
        onText: (t) => { if (!hostSpeakingRef.current && !busyRef.current) send(t) },
        // No STT key / model access → fall back to the browser recognizer.
        onUnavailable: () => { try { seg?.destroy() } catch { /* */ } seg = null; segRef.current = null; if (!cancelled) startBrowserFallback() },
      })
      segRef.current = seg
      seg.start()
    })()

    return () => {
      cancelled = true; stopped = true
      try { seg?.destroy() } catch { /* */ }
      segRef.current = null
      try { stream?.getTracks().forEach((t) => t.stop()) } catch { /* */ }
      try { fallbackRec?.stop() } catch { /* */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handsFree])

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100dvh", background: "rgba(6,9,16,.74)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", display: "flex", flexDirection: "column", zIndex: 20, fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
      <div style={{ padding: "calc(env(safe-area-inset-top) + 14px) max(22px, env(safe-area-inset-right)) 10px max(22px, env(safe-area-inset-left))", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, color: "#9fb2c4", letterSpacing: 1 }}>aired off · just you two</div>
          <div style={{ fontSize: 19, fontWeight: 500, color: "#eef4f8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cluster.host} · {cluster.name}</div>
          <div style={{ fontSize: 11, color: "#7f93a5" }}>{tempLabel}</div>
        </div>
        <button onClick={onClose} style={{ flex: "0 0 auto", fontSize: 13, color: "#cdd9e3", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.2)", padding: "10px 14px", minHeight: 44, borderRadius: 12, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>← leave</button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", padding: "8px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.who === "you" ? "flex-end" : "flex-start", maxWidth: "82%", fontSize: 15, lineHeight: 1.45, color: m.who === "you" ? "#0a1622" : "#eef4f8", background: m.who === "you" ? "#cfe0ee" : "rgba(255,255,255,.08)", padding: "9px 13px", borderRadius: 16 }}>
            {m.text}
          </div>
        ))}
        {busy && <div style={{ alignSelf: "flex-start", fontSize: 13, color: "#7f93a5", fontStyle: "italic" }}>{cluster.host} is talking…</div>}
      </div>

      <div style={{ padding: "10px max(18px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 18px) max(18px, env(safe-area-inset-right))", boxSizing: "border-box" }}>
        {trouble && (
          <div onClick={retry} role="button" tabIndex={0} style={{ fontSize: 12, color: "#ffd0bf", background: "rgba(239,122,77,.14)", border: ".5px solid rgba(239,122,77,.4)", borderRadius: 12, padding: "9px 12px", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 9, textAlign: "center", cursor: "pointer" }}>
            couldn&apos;t reach the voice — tap to retry
          </div>
        )}
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
            style={{ flex: 1, minWidth: 0, fontSize: 16, color: "#eef4f8", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.18)", borderRadius: 14, padding: "12px 14px", minHeight: 44, boxSizing: "border-box", outline: "none" }}
          />
          {sttOk && (
            <button onClick={onTalk} aria-label="talk — tap to speak once, double-tap for hands-free" style={{ fontSize: 13, fontWeight: handsFree ? 500 : 400, minHeight: 44, color: (handsFree || listening) ? "#06201a" : "#dfeaf2", background: handsFree ? "#7fd6c0" : listening ? "#bfe9d8" : "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.18)", borderRadius: 14, padding: "11px 14px", cursor: "pointer", whiteSpace: "nowrap", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>{handsFree ? "live" : listening ? "listening" : "talk"}</button>
          )}
          <button onClick={() => send()} disabled={busy} style={{ fontSize: 14, minHeight: 44, color: "#1a0d08", background: "#ef7a4d", border: "none", borderRadius: 14, padding: "11px 16px", cursor: "pointer", opacity: busy ? 0.6 : 1, WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>send</button>
        </div>
        <div style={{ marginTop: 9, textAlign: "center" }}>
          {revealed ? (
            <span style={{ fontSize: 11, color: "#9fb2c4" }}>{cluster.host} is AI — born the second you opened them. (when real people are on the floor, you won&apos;t always be able to tell.)</span>
          ) : (
            <button onClick={() => setRevealed(true)} style={{ fontSize: 11, color: "#7f93a5", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>are they human?</button>
          )}
        </div>
        <div style={{ marginTop: 7, fontSize: 11, color: "#7f93a5", textAlign: "center" }}>
          cam unlocks only here — and only if you both say yes · <span style={{ opacity: 0.55 }}>ask for cam (both must agree)</span>
        </div>
      </div>
      <audio ref={audioRef} style={{ display: "none" }} />
    </div>
  )
}
