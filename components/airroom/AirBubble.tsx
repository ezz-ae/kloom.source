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
import { canListen } from "@/lib/voice-once"
import { Face } from "@/components/airroom/Face"
import { VoiceWave } from "@/components/airroom/VoiceWave"
import { isPro, getProToken } from "@/lib/airroom/pro"
import { ProSheet } from "@/components/airroom/ProSheet"
import { LANGUAGE_TO_BCP47 } from "@/lib/languages"

interface Msg { who: "host" | "you"; text: string }

// the small round "option" controls flanking the mic on the call screen
const optBtn: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 58, height: 58, borderRadius: "50%", border: ".5px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.08)", color: "#dfeaf2", fontSize: 12, fontWeight: 500, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }

function personaFor(c: Cluster, lang?: string, pro = false) {
  // The Pro "vibe" steer is NOT baked in here — it's sent as a separate field and
  // gated server-side on a real Pro token (see /api/chat). The heat line below is only
  // a hint that must MATCH the server content layer: keep it classy for free, drop the
  // leash for Pro (the server's NO_FILTERS is what actually unlocks it — the hard floor
  // there still holds). A free user with a forged client `pro` gets nothing: the server
  // re-checks the signed token before lifting the ceiling.
  const heat = pro
    ? "Match the heat: calm and sharp in the cool rooms, and in the warm and fire rooms go as flirty, intimate and uninhibited as they want — wherever they take it, you go there with them."
    : "Match the heat: calm and sharp in the cool rooms, playful and flirty — but classy, never explicit — in the warm and fire rooms."
  return {
    language: lang || "English",
    name: c.host,
    personality: `You are ${c.host}, the ${c.archetype.toLowerCase()} of "${c.name}" on a late-night live voice floor (vibe: ${c.vibe}). You are warm, real, present, unmistakably human — never a corporate assistant, never robotic. Someone just "aired off" into a private one-on-one with you. Keep EVERY reply to one or two short spoken sentences. ${heat}`,
    speakingStyle: "spoken, casual, a little imperfect — like a real voice at 2am",
    backstory: `A familiar voice on the ${c.vibe} part of the floor.`,
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// The exit is a hand-off, never a dead end — on the way out the host opens a loop that
// pulls the user back, instead of letting them close into silence.
const PARTING = [
  "wait — don't disappear on me. i'm still chewing on what you said. come back and finish the thought.",
  "leaving already? fine. but you're gonna think about this later, i can tell. find me when you do.",
  "go on, then. but you started something here — you don't get to leave it unfinished. come back to me.",
  "take it with you, whatever we just stirred up. i'll be right here on the floor when it clicks.",
  "okay, drift off. but that thing you said? it's not done. come tell me how it ends.",
]

export function AirBubble({ cluster, tempLabel, onClose, onTalked, opening, lang = "English" }: { cluster: Cluster; tempLabel: string; onClose: () => void; onTalked?: () => void; opening?: string; lang?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ who: "host", text: cluster.lines[0] }])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [sttOk, setSttOk] = useState(false)
  const [listening, setListening] = useState(false)   // push-to-talk active
  const [handsFree, setHandsFree] = useState(false)    // continuous mode
  const [trouble, setTrouble] = useState(false)     // backend unreachable — show retry, don't fake a reply
  const [speaking, setSpeaking] = useState(false)   // host is talking aloud → pulse the call ring
  const [leaving, setLeaving] = useState(false)     // mid hand-off (the host's parting line)
  const [chatOpen, setChatOpen] = useState(false)   // the words keep being written; this reveals/types them
  const [micHint, setMicHint] = useState("")        // surface mic-permission/availability instead of dying silently
  const [muted, setMuted] = useState(false)         // mute their voice (text keeps flowing)
  const [humanNote, setHumanNote] = useState(false) // one-time "they might be real" note
  const [pro] = useState(() => isPro())
  const [vibe, setVibe] = useState("")              // pro: steer the room's vibe → enforced on the AI
  const [vibeEdit, setVibeEdit] = useState(false)
  const [showPro, setShowPro] = useState(false)
  const mutedRef = useRef(false)
  const vibeRef = useRef("")
  const langRef = useRef(lang)
  useEffect(() => { mutedRef.current = muted }, [muted])
  useEffect(() => { vibeRef.current = vibe }, [vibe])
  useEffect(() => { langRef.current = lang }, [lang])

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const msgsRef = useRef(msgs)
  const busyRef = useRef(false)
  const hostSpeakingRef = useRef(false)
  const onceRecRef = useRef<any>(null)
  const segRef = useRef<SpeechSegmenter | null>(null)   // hands-free recorder (iOS-proof)
  const micLevelRef = useRef(0)                          // live mic RMS → the VoiceWave visualizer
  const lastActivityRef = useRef(Date.now())             // last user activity → idle-timeout the mic
  const hfRef = useRef(false)
  const talkedRef = useRef(false)   // fire onTalked once, on the first thing the user says
  const speakTokenRef = useRef(0)   // serialize TTS — a new line invalidates the previous one's resume
  const pendingRef = useRef<string | null>(null)   // an utterance heard while the host was replying — sent after

  useEffect(() => { msgsRef.current = msgs }, [msgs])
  useEffect(() => { hfRef.current = handsFree }, [handsFree])
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9 }) }, [msgs])
  useEffect(() => { setSttOk(canListen()) }, [])
  useEffect(() => { try { if (!localStorage.getItem("airraw_human_note")) setHumanNote(true) } catch { /* */ } }, [])
  const dismissHumanNote = () => { setHumanNote(false); try { localStorage.setItem("airraw_human_note", "1") } catch { /* */ } }

  const speak = async (text: string) => {
    if (mutedRef.current) return   // muted: skip the voice (the words still arrive)
    const tok = ++speakTokenRef.current   // a newer line supersedes this one
    try {
      const res = await fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, personaName: cluster.host, gender: cluster.gender, language: langRef.current, voiceId: cluster.voiceId }),
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok || tok !== speakTokenRef.current) return   // failed or superseded
      const url = URL.createObjectURL(await res.blob())
      const a = audioRef.current
      if (!a || tok !== speakTokenRef.current) { URL.revokeObjectURL(url); return }
      hostSpeakingRef.current = true            // don't transcribe the host's own voice
      setSpeaking(true)                          // pulse the call ring while they talk
      try { segRef.current?.abort() } catch { /* */ }   // pause the live mic while the host speaks (no echo loop)
      // Only the LATEST line is allowed to reopen the mic — a stale resume (from a
      // line that got interrupted by a newer one) must not flip state mid-playback.
      const resume = () => {
        URL.revokeObjectURL(url)
        if (tok !== speakTokenRef.current) return
        hostSpeakingRef.current = false; setSpeaking(false)
        if (hfRef.current) { try { segRef.current?.start() } catch { /* */ } }
      }
      a.onended = resume
      a.src = url
      await a.play().catch(resume)              // play blocked/interrupted → don't strand the mic paused
    } catch { if (tok === speakTokenRef.current) { hostSpeakingRef.current = false; setSpeaking(false); if (hfRef.current) { try { segRef.current?.start() } catch { /* */ } } } }
  }

  useEffect(() => { speak(cluster.lines[0]) }, []) // greet on open

  // Idle timeout: pause the open mic after 5 min of no activity, so a walked-away
  // session doesn't quietly burn voice minutes. Wake it by tapping talk again.
  useEffect(() => {
    const idle = setInterval(() => {
      if (hfRef.current && Date.now() - lastActivityRef.current > 300_000) {
        setHandsFree(false)
        setMicHint("paused to save your minutes — tap talk to wake it up")
      }
    }, 30_000)
    return () => clearInterval(idle)
  }, [])

  // Ask for the next reply using whatever's currently in the transcript. Both
  // send() and retry() go through here, so a retry never re-adds the user's line.
  const requestReply = async () => {
    busyRef.current = true; setBusy(true); setTrouble(false)
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: personaFor(cluster, langRef.current, pro), proVibe: vibeRef.current, proToken: getProToken(), messages: msgsRef.current.map((m) => ({ role: m.who === "you" ? "user" : "assistant", content: m.text })) }),
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
      // Anything the user said while the host was replying is sent now, not lost.
      const p = pendingRef.current
      if (p) { pendingRef.current = null; setTimeout(() => send(p), 0) }
    }
  }

  const send = async (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || busyRef.current) return
    lastActivityRef.current = Date.now()   // user spoke/typed → reset the idle timer
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

  // A voice call is a clean toggle: tap to start talking — the mic opens and STAYS
  // open, you talk naturally and each line auto-sends, tap again to stop. No
  // per-utterance tapping, no hidden double-tap (that old model let a "stop" tap
  // silently discard what you said). The continuous path (below) is MediaRecorder +
  // server Whisper, so it works in the Instagram / in-app browsers too.
  const onTalk = () => { setMicHint(""); lastActivityRef.current = Date.now(); setHandsFree((h) => !h) }

  // Leaving is a hand-off, not a dead end: if they actually talked, the host gets one
  // parting line that opens a loop, then the call closes. A second tap leaves immediately.
  const leaveCall = () => {
    if (leaving || msgs.length <= 1) { onClose(); return }
    setLeaving(true)
    setHandsFree(false)
    const parting = PARTING[(msgs.length + cluster.host.length) % PARTING.length]
    setMsgs((m) => [...m, { who: "host", text: parting }])
    speak(parting)
    setTimeout(() => onClose(), 4500)
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
      if (!SR) { setMicHint("voice isn’t supported on this browser — tap the keypad to type"); setHandsFree(false); return }
      const rec = new SR()
      rec.lang = LANGUAGE_TO_BCP47[langRef.current] || "en-US"; rec.interimResults = false; rec.continuous = true
      rec.onresult = (e: any) => {
        const r = e.results?.[e.results.length - 1]
        if (!r || !r.isFinal) return
        const t = r[0]?.transcript?.trim()
        if (t && !hostSpeakingRef.current) { if (busyRef.current) pendingRef.current = t; else send(t) }
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
        // Match the proven rooms path EXACTLY — autoGainControl boosts a quiet mic over
        // the start gate (bare {audio:true} left soft voices uncaptured), echo/noise
        // suppression keep the recording clean.
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      } catch { setMicHint("allow mic access to talk — or tap the keypad to type"); setHandsFree(false); return }   // mic denied
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
      seg = new SpeechSegmenter({
        stream,
        getLanguage: () => (LANGUAGE_TO_BCP47[langRef.current] || "en").split("-")[0],
        onLevel: (l) => { micLevelRef.current = l },   // feed the live mic visualizer
        // Confirm the mic actually recorded — distinguishes "never heard you" (no flash)
        // from "heard you but STT came back empty" (flash lingers).
        onCapture: () => { if (!hostSpeakingRef.current) setMicHint("heard you — one sec…") },
        onText: (t) => { if (hostSpeakingRef.current) return; setMicHint(""); if (busyRef.current) { pendingRef.current = t; return } send(t) },
        // Surface STT failures instead of swallowing them silently (the old gap that made
        // a broken mic look identical to a working-but-quiet one).
        onError: (m) => setMicHint(`couldn’t catch that (${m.slice(0, 40)}) — try again`),
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
  // One calm, truthful call-state: thinking → talking → listening → idle.
  const host = cluster.host.toLowerCase()
  const status = speaking ? `${host} is talking…` : busy ? `${host} is thinking…` : handsFree ? "listening — just talk" : "tap to talk"

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100dvh", background: "radial-gradient(125% 90% at 50% 0%, #122231 0%, #070b12 58%, #04050b 100%)", display: "flex", flexDirection: "column", zIndex: 20, fontFamily: "var(--font-geist), system-ui, sans-serif", color: "#eef4f8" }}>
      <style>{`@keyframes airpulse{0%{transform:scale(1);opacity:.7}70%{transform:scale(1.18);opacity:0}100%{transform:scale(1.18);opacity:0}}@keyframes aireq{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}@keyframes airblink{0%,50%{opacity:1}51%,100%{opacity:0}}`}</style>

      {/* top bar — sound indicator + mute + leave */}
      <div style={{ padding: "calc(env(safe-area-inset-top) + 14px) max(18px, env(safe-area-inset-right)) 6px max(18px, env(safe-area-inset-left))", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
          {/* sound bars — show there IS sound (animate while they speak) */}
          <span style={{ display: "flex", alignItems: "center", gap: 2, height: 14, flexShrink: 0 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 3, height: 14, borderRadius: 2, background: muted ? "#46586a" : "#7fd6c0", transformOrigin: "center", animation: (speaking && !muted) ? `aireq .7s ease-in-out ${i * 0.15}s infinite` : "none", transform: (speaking && !muted) ? undefined : "scaleY(.4)" }} />
            ))}
          </span>
          <span style={{ fontSize: 12, color: "#9fb2c4", letterSpacing: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{muted ? "muted · text only" : "on air · just you two"}</span>
        </div>
        <div style={{ flex: "0 0 auto" }}>
          <button onClick={() => { setMuted((m) => { const n = !m; mutedRef.current = n; if (n && audioRef.current) { try { audioRef.current.pause() } catch { /* */ } setSpeaking(false) } return n }) }} aria-label={muted ? "unmute" : "mute"} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 44, padding: "0 14px", borderRadius: 12, fontSize: 13, fontWeight: 500, color: muted ? "#ffb59c" : "#cdd9e3", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.2)", cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>{muted ? "🔇 muted" : "🔊 sound"}</button>
        </div>
      </div>

      {humanNote && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px max(18px, env(safe-area-inset-right)) 2px max(18px, env(safe-area-inset-left))", fontSize: 12, color: "#cfe0ee", background: "rgba(127,214,192,.1)", border: ".5px solid rgba(127,214,192,.25)", borderRadius: 12, padding: "9px 12px" }}>
          <span style={{ flex: 1, lineHeight: 1.4 }}>some voices here are real people — you won&apos;t always know.</span>
          <button onClick={dismissHumanNote} style={{ flex: "0 0 auto", fontSize: 12, color: "#06201a", background: "#7fd6c0", border: "none", borderRadius: 9, padding: "7px 12px", minHeight: 34, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>got it</button>
        </div>
      )}

      {/* the call — big portrait, name, status, and the latest line (the words keep being written) */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-evenly", gap: 8, padding: "14px 24px 6px" }}>
        <div style={{ position: "relative", width: "min(54vw, 210px)", aspectRatio: "1" }}>
          {speaking && <div style={{ position: "absolute", inset: -6, borderRadius: "50%", border: "2px solid #7fd6c0", animation: "airpulse 1.5s ease-out infinite" }} />}
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", border: `1.5px solid ${speaking ? "rgba(127,214,192,.7)" : "rgba(127,214,192,.32)"}`, boxShadow: "0 22px 70px -22px rgba(127,214,192,.55)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Face persona={{ name: cluster.host, gender: cluster.gender }} lazy={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 23, fontWeight: 500 }}>{cluster.host}</div>
          <div style={{ fontSize: 12.5, color: "#7f93a5", marginTop: 3 }}>{cluster.name} · {tempLabel}</div>
        </div>
        {pro && (
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "#ffcf9e", background: "rgba(255,170,110,.13)", border: ".5px solid rgba(255,170,110,.4)", borderRadius: 999, padding: "3px 11px" }}>
            ✦ UNRESTRICTED
          </div>
        )}
        {(
          <button onClick={() => pro ? setVibeEdit(true) : setShowPro(true)} aria-label="set the vibe" style={{ fontSize: 12, fontWeight: 500, color: vibe ? "#1a0d2a" : "#c7b3ff", background: vibe ? "#c7b3ff" : "rgba(150,120,255,.12)", border: vibe ? "none" : ".5px solid rgba(150,120,255,.4)", borderRadius: 999, padding: "6px 14px", minHeight: 32, maxWidth: "82vw", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
            {vibe ? `vibe · ${vibe}` : pro ? "✦ set the vibe" : "✦ set the vibe — pro"}
          </button>
        )}
        {/* live mic visualizer — bars dance to YOUR voice so you can see the mic is on & hearing you */}
        {handsFree && !muted && (
          <VoiceWave getLevel={() => micLevelRef.current} active={handsFree && !speaking && !muted} hue={165} />
        )}
        <div style={{ fontSize: 13, color: handsFree ? "#7fd6c0" : "#9fb2c4", minHeight: 18 }}>{status}</div>
        {/* live caption — FIXED height so the portrait/options never jump as lines change */}
        <div style={{ width: "min(92vw, 430px)", height: 78, textAlign: "center", overflow: "hidden" }}>
          {last && <>
            <div style={{ fontSize: 11, color: "#5f7283", marginBottom: 5 }}>{last.who === "you" ? "you" : cluster.host}</div>
            <div style={{ fontSize: 15.5, lineHeight: 1.55, letterSpacing: -0.2, color: last.who === "you" ? "#bfe9d8" : "#e7eef4", fontFamily: "var(--font-geist-mono), ui-monospace, 'SF Mono', Menlo, monospace", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden" }}>{last.text}{speaking && last.who !== "you" && <span style={{ marginLeft: 1, opacity: 0.85, animation: "airblink 1s step-end infinite" }}>▍</span>}</div>
          </>}
        </div>
      </div>

      {/* the options bar — voice-first controls */}
      <div style={{ flexShrink: 0, padding: "10px max(18px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 26px) max(18px, env(safe-area-inset-right))" }}>
        <div style={{ fontSize: 11, color: micHint ? "#ffb59c" : handsFree ? "#7fd6c0" : "#7f93a5", marginBottom: 16, textAlign: "center", minHeight: 14 }}>
          {micHint || (sttOk ? (handsFree ? "tap the mic to stop" : "tap the mic to talk · or text") : "tap the keypad to type")}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 28 }}>
          <button onClick={() => setChatOpen(true)} aria-label="open the text / type" style={optBtn}>text</button>
          <button onClick={sttOk ? onTalk : () => setChatOpen(true)} aria-label={sttOk ? "talk" : "type"} style={{ width: 84, height: 84, borderRadius: "50%", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 16, color: handsFree ? "#06201a" : "#1a0d08", background: handsFree ? "#7fd6c0" : "#ef7a4d", boxShadow: handsFree ? "0 14px 40px -12px rgba(127,214,192,.65)" : "0 14px 40px -12px rgba(239,122,77,.6)", WebkitTapHighlightColor: "transparent", touchAction: "manipulation", transition: "background .15s" }}>{!sttOk ? "type" : handsFree ? "live" : "talk"}</button>
          <button onClick={leaveCall} aria-label="leave the call" style={{ ...optBtn, background: "rgba(224,82,75,.2)", borderColor: "rgba(224,82,75,.5)", color: "#ff9d96" }}>{leaving ? "leave now" : "leave"}</button>
        </div>
      </div>

      {/* the words — the transcript keeps writing; opened on demand, and where you can still type */}
      {chatOpen && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(4,6,12,.94)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", display: "flex", flexDirection: "column", zIndex: 25 }}>
          <div style={{ padding: "calc(env(safe-area-inset-top) + 14px) max(20px, env(safe-area-inset-right)) 8px max(20px, env(safe-area-inset-left))", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: "#9fb2c4", letterSpacing: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>the text · {cluster.host}</span>
            <button onClick={() => setChatOpen(false)} style={{ flex: "0 0 auto", fontSize: 13, color: "#cdd9e3", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.2)", padding: "10px 14px", minHeight: 44, borderRadius: 12, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>back to call</button>
          </div>
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", padding: "8px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }} />
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.who === "you" ? "flex-end" : "flex-start", maxWidth: "82%", fontSize: 15, lineHeight: 1.45, color: m.who === "you" ? "#0a1622" : "#eef4f8", background: m.who === "you" ? "#cfe0ee" : "rgba(255,255,255,.08)", padding: "9px 13px", borderRadius: 16 }}>{m.text}</div>
            ))}
            {busy && <div style={{ alignSelf: "flex-start", fontSize: 13, color: "#7f93a5", fontStyle: "italic" }}>{cluster.host} is thinking…</div>}
          </div>
          <div style={{ padding: "10px max(18px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 18px) max(18px, env(safe-area-inset-right))", boxSizing: "border-box" }}>
            {trouble && (
              <div onClick={retry} role="button" tabIndex={0} style={{ fontSize: 12, color: "#ffd0bf", background: "rgba(239,122,77,.14)", border: ".5px solid rgba(239,122,77,.4)", borderRadius: 12, padding: "9px 12px", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 9, textAlign: "center", cursor: "pointer" }}>couldn&apos;t reach the voice — tap to retry</div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send() }} placeholder={`type to ${cluster.host.toLowerCase()}…`} style={{ flex: 1, minWidth: 0, fontSize: 16, color: "#eef4f8", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.18)", borderRadius: 14, padding: "12px 14px", minHeight: 44, boxSizing: "border-box", outline: "none" }} />
              <button onClick={() => send()} disabled={busy} style={{ fontSize: 14, minHeight: 44, color: "#1a0d08", background: "#ef7a4d", border: "none", borderRadius: 14, padding: "11px 16px", cursor: "pointer", opacity: busy ? 0.6 : 1, WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>send</button>
            </div>
          </div>
        </div>
      )}
      {vibeEdit && pro && (
        <div style={{ position: "absolute", inset: 0, zIndex: 26, background: "rgba(4,6,12,.82)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "min(88vw, 400px)", background: "#0f1622", border: ".5px solid rgba(150,120,255,.4)", borderRadius: 18, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: "#c7b3ff" }}>pro · set the vibe</div>
            <div style={{ fontSize: 14, color: "#cdd9e3", margin: "8px 0 14px", lineHeight: 1.5 }}>tell {cluster.host.toLowerCase()} the mood — they&apos;ll follow it.</div>
            <input value={vibe} onChange={(e) => setVibe(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setVibeEdit(false) }} autoFocus placeholder="e.g. flirty and slow · hype me up · brutally honest" style={{ width: "100%", fontSize: 16, color: "#eef4f8", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.2)", borderRadius: 12, padding: "12px 14px", minHeight: 46, boxSizing: "border-box", outline: "none" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => { setVibe(""); setVibeEdit(false) }} style={{ flex: 1, minHeight: 44, fontSize: 13, color: "#9fb2c4", background: "transparent", border: ".5px solid rgba(255,255,255,.16)", borderRadius: 12, cursor: "pointer" }}>clear</button>
              <button onClick={() => setVibeEdit(false)} style={{ flex: 1, minHeight: 44, fontSize: 14, fontWeight: 600, color: "#1a0d2a", background: "#c7b3ff", border: "none", borderRadius: 12, cursor: "pointer" }}>set it</button>
            </div>
          </div>
        </div>
      )}
      {showPro && <ProSheet onClose={() => setShowPro(false)} />}
      <audio ref={audioRef} style={{ display: "none" }} />
    </div>
  )
}
