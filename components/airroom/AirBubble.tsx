"use client"

/**
 * AIRROOM — the air-off bubble. A private 1:1 with a cluster's host: it greets
 * aloud, you reply, it answers in voice (/api/chat + /api/tts). Two ways to talk:
 *   • push-to-talk ("talk") — tap, say one thing, it sends.
 *   • hands-free ("live")   — keep the mic open; just talk and each line sends,
 *                             no pressing. Ignores its own voice while it speaks.
 * Cam is framed but gated — only here, only by mutual yes.
 */
import { type CSSProperties, useEffect, useRef, useState } from "react"
import type { Cluster } from "@/lib/airroom/roster"
import { SpeechSegmenter } from "@/lib/speech-segmenter"
import { imageFor } from "@/lib/persona-utils"

interface Msg { who: "host" | "you"; text: string }

// the small round "option" controls flanking the mic on the call screen
const optBtn: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 58, height: 58, borderRadius: "50%", border: ".5px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.08)", color: "#dfeaf2", fontSize: 12, fontWeight: 500, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }

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
export function AirBubble({ cluster, tempLabel, onClose, onTalked, opening }: { cluster: Cluster; tempLabel: string; onClose: () => void; onTalked?: () => void; opening?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ who: "host", text: cluster.lines[0] }])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [sttOk, setSttOk] = useState(false)
  const [listening, setListening] = useState(false)   // push-to-talk active
  const [handsFree, setHandsFree] = useState(false)    // continuous mode
  const [revealed, setRevealed] = useState(false)
  const [trouble, setTrouble] = useState(false)     // backend unreachable — show retry, don't fake a reply
  const [speaking, setSpeaking] = useState(false)   // host is talking aloud → pulse the call ring
  const [chatOpen, setChatOpen] = useState(false)   // the words keep being written; this reveals/types them
  const [micHint, setMicHint] = useState("")        // surface mic-permission/availability instead of dying silently

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const msgsRef = useRef(msgs)
  const busyRef = useRef(false)
  const hostSpeakingRef = useRef(false)
  const onceRecRef = useRef<any>(null)
  const segRef = useRef<SpeechSegmenter | null>(null)   // hands-free recorder (iOS-proof)
  const hfRef = useRef(false)
  const lastTapRef = useRef(0)      // double-tap detection by timestamp (never defers the mic start)
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
        setSpeaking(true)                          // pulse the call ring while they talk
        try { segRef.current?.abort() } catch { /* */ }   // pause the live mic while the host speaks (no echo loop)
        const resume = () => { hostSpeakingRef.current = false; setSpeaking(false); if (hfRef.current) { try { segRef.current?.start() } catch { /* */ } } }
        a.onended = resume
        a.src = url
        await a.play().catch(resume)              // play blocked → don't strand the mic paused
      }
    } catch { hostSpeakingRef.current = false; setSpeaking(false) }
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

  // If you wrote something on the sky before diving, open with it — the host
  // answers what you said, so the call starts already in motion.
  useEffect(() => {
    const o = opening?.trim()
    if (!o) return
    const id = setTimeout(() => send(o), 500)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // push-to-talk: one utterance, then sends. Started SYNCHRONOUSLY inside the tap
  // (iOS Safari only lets you start the mic from within the gesture — the old
  // version deferred this behind a 240ms timer, so on iPhone the tap did nothing).
  const talkOnce = () => {
    if (listening) { try { onceRecRef.current?.stop() } catch { /* */ } setListening(false); return }
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) { setMicHint("voice isn’t supported on this browser — open the words to type"); return }
    const rec = new SR()
    rec.lang = "en-US"; rec.interimResults = false; rec.continuous = false
    rec.onresult = (e: any) => { const t = e.results?.[0]?.[0]?.transcript?.trim(); setListening(false); if (t) { setMicHint(""); send(t) } }
    rec.onerror = (ev: any) => {
      setListening(false)
      const er = ev?.error
      if (er === "not-allowed" || er === "service-not-allowed") setMicHint("mic is blocked — allow it in your browser, or open the words to type")
      else if (er === "no-speech") setMicHint("didn’t catch that — tap the mic and speak")
      else if (er !== "aborted") setMicHint("voice hiccuped — tap again, or type")
    }
    rec.onend = () => setListening(false)
    onceRecRef.current = rec
    setMicHint("")
    try { rec.start(); setListening(true) } catch { setListening(false); setMicHint("couldn’t start the mic — open the words to type") }
  }

  // One mic, two gestures: a tap talks once (started in-gesture above); a quick
  // double-tap goes hands-free "live"; a tap while live stops it. Double-tap is
  // detected by timestamp so it never delays the first tap's mic start.
  const onTalk = () => {
    const now = Date.now()
    const dbl = now - lastTapRef.current < 320
    lastTapRef.current = now
    if (handsFree) { setHandsFree(false); return }
    if (dbl) { try { onceRecRef.current?.stop() } catch { /* */ } setListening(false); setMicHint(""); setHandsFree(true); return }
    talkOnce()
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

  const last = msgs[msgs.length - 1]
  const status = busy ? `${cluster.host.toLowerCase()} is talking…` : listening ? "listening — say it" : handsFree ? "live — just talk" : "tap the mic to talk"
  const portrait = imageFor({ name: cluster.host })

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100dvh", background: "radial-gradient(125% 90% at 50% 0%, #122231 0%, #070b12 58%, #04050b 100%)", display: "flex", flexDirection: "column", zIndex: 20, fontFamily: "var(--font-geist), system-ui, sans-serif", color: "#eef4f8" }}>
      <style>{`@keyframes airpulse{0%{transform:scale(1);opacity:.7}70%{transform:scale(1.18);opacity:0}100%{transform:scale(1.18);opacity:0}}`}</style>

      {/* top bar — "on air" + leave */}
      <div style={{ padding: "calc(env(safe-area-inset-top) + 14px) max(18px, env(safe-area-inset-right)) 6px max(18px, env(safe-area-inset-left))", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#7fd6c0", boxShadow: "0 0 8px #7fd6c0", flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "#9fb2c4", letterSpacing: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>on air · just you two</span>
        </div>
        <button onClick={onClose} aria-label="leave" style={{ flex: "0 0 auto", fontSize: 13, color: "#cdd9e3", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.2)", padding: "10px 14px", minHeight: 44, borderRadius: 12, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>← leave</button>
      </div>

      {/* the call — big portrait, name, status, and the latest line (the words keep being written) */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "4px 24px" }}>
        <div style={{ position: "relative", width: "min(54vw, 210px)", aspectRatio: "1" }}>
          {speaking && <div style={{ position: "absolute", inset: -6, borderRadius: "50%", border: "2px solid #7fd6c0", animation: "airpulse 1.5s ease-out infinite" }} />}
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", border: `1.5px solid ${speaking ? "rgba(127,214,192,.7)" : "rgba(127,214,192,.32)"}`, boxShadow: "0 22px 70px -22px rgba(127,214,192,.55)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={portrait} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 23, fontWeight: 500 }}>{cluster.host}</div>
          <div style={{ fontSize: 12.5, color: "#7f93a5", marginTop: 3 }}>{cluster.name} · {tempLabel}</div>
        </div>
        <div style={{ fontSize: 13, color: (listening || handsFree) ? "#7fd6c0" : "#9fb2c4", minHeight: 18 }}>{status}</div>
        {last && (
          <div style={{ maxWidth: 430, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#5f7283", marginBottom: 5 }}>{last.who === "you" ? "you" : cluster.host}</div>
            <div style={{ fontSize: 16, lineHeight: 1.5, color: last.who === "you" ? "#bfe9d8" : "#e7eef4" }}>&ldquo;{last.text}&rdquo;</div>
          </div>
        )}
      </div>

      {/* the options bar — voice-first controls */}
      <div style={{ padding: "8px max(18px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 18px) max(18px, env(safe-area-inset-right))" }}>
        <div style={{ fontSize: 11, color: micHint ? "#ffb59c" : (listening || handsFree) ? "#7fd6c0" : "#7f93a5", marginBottom: 12, textAlign: "center", minHeight: 14 }}>
          {micHint || (sttOk ? (handsFree ? "live — mic's open · tap the mic to stop" : "tap to talk · double-tap to go hands-free") : "tap the keypad to type")}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22 }}>
          <button onClick={() => setChatOpen(true)} aria-label="open the words / type" style={optBtn}>words</button>
          <button onClick={sttOk ? onTalk : () => setChatOpen(true)} aria-label={sttOk ? "talk" : "type"} style={{ width: 78, height: 78, borderRadius: "50%", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 16, color: (handsFree || listening) ? "#06201a" : "#1a0d08", background: handsFree ? "#7fd6c0" : listening ? "#bfe9d8" : "#ef7a4d", boxShadow: handsFree ? "0 14px 40px -12px rgba(127,214,192,.65)" : "0 14px 40px -12px rgba(239,122,77,.6)", WebkitTapHighlightColor: "transparent", touchAction: "manipulation", transition: "background .15s" }}>{!sttOk ? "type" : handsFree ? "live" : listening ? "stop" : "talk"}</button>
          <button onClick={onClose} aria-label="end the call" style={{ ...optBtn, background: "rgba(224,82,75,.18)", borderColor: "rgba(224,82,75,.5)", color: "#ff9d96" }}>end</button>
        </div>
      </div>

      {/* the words — the transcript keeps writing; opened on demand, and where you can still type */}
      {chatOpen && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(4,6,12,.94)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", display: "flex", flexDirection: "column", zIndex: 25 }}>
          <div style={{ padding: "calc(env(safe-area-inset-top) + 14px) max(20px, env(safe-area-inset-right)) 8px max(20px, env(safe-area-inset-left))", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "#9fb2c4", letterSpacing: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>the words · {cluster.host}</span>
            <button onClick={() => setChatOpen(false)} style={{ flex: "0 0 auto", fontSize: 13, color: "#cdd9e3", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.2)", padding: "10px 14px", minHeight: 44, borderRadius: 12, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>back to call</button>
          </div>
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", padding: "8px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.who === "you" ? "flex-end" : "flex-start", maxWidth: "82%", fontSize: 15, lineHeight: 1.45, color: m.who === "you" ? "#0a1622" : "#eef4f8", background: m.who === "you" ? "#cfe0ee" : "rgba(255,255,255,.08)", padding: "9px 13px", borderRadius: 16 }}>{m.text}</div>
            ))}
            {busy && <div style={{ alignSelf: "flex-start", fontSize: 13, color: "#7f93a5", fontStyle: "italic" }}>{cluster.host} is talking…</div>}
          </div>
          <div style={{ padding: "10px max(18px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 18px) max(18px, env(safe-area-inset-right))", boxSizing: "border-box" }}>
            {trouble && (
              <div onClick={retry} role="button" tabIndex={0} style={{ fontSize: 12, color: "#ffd0bf", background: "rgba(239,122,77,.14)", border: ".5px solid rgba(239,122,77,.4)", borderRadius: 12, padding: "9px 12px", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 9, textAlign: "center", cursor: "pointer" }}>couldn&apos;t reach the voice — tap to retry</div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send() }} placeholder={`type to ${cluster.host.toLowerCase()}…`} style={{ flex: 1, minWidth: 0, fontSize: 16, color: "#eef4f8", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.18)", borderRadius: 14, padding: "12px 14px", minHeight: 44, boxSizing: "border-box", outline: "none" }} />
              <button onClick={() => send()} disabled={busy} style={{ fontSize: 14, minHeight: 44, color: "#1a0d08", background: "#ef7a4d", border: "none", borderRadius: 14, padding: "11px 16px", cursor: "pointer", opacity: busy ? 0.6 : 1, WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>send</button>
            </div>
            <div style={{ marginTop: 9, textAlign: "center" }}>
              {revealed
                ? <span style={{ fontSize: 11, color: "#9fb2c4" }}>{cluster.host} is AI — born the second you opened them. (when real people are on the floor, you won&apos;t always be able to tell.)</span>
                : <button onClick={() => setRevealed(true)} style={{ fontSize: 11, color: "#7f93a5", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>are they human?</button>}
            </div>
          </div>
        </div>
      )}
      <audio ref={audioRef} style={{ display: "none" }} />
    </div>
  )
}
