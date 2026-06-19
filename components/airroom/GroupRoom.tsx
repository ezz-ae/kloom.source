"use client"

/**
 * AIRROOM — a group room. The level before the individual: you don't pull ONE
 * person aside, you step into a small room where a few AIs are already talking —
 * to you AND to each other. Each member is a fresh, distinct voice (roster
 * freshCharacter). On every line you say, two of them answer in turn. This is the
 * container real humans drop into later (presence) — the place "oh, you're human?"
 * will actually happen. For now everyone here is AI, and the reveal says so.
 */
import { useEffect, useRef, useState } from "react"
import { freshCharacter, type Cluster } from "@/lib/airroom/roster"

interface Line { who: string; text: string; f?: number; you?: boolean }
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
function dot(f: number) { return f < 0.4 ? "#6fd6e6" : f < 0.72 ? "#ffce7a" : "#ff7a4d" }

export function GroupRoom({ f, tempLabel, onClose }: { f: number; tempLabel: string; onClose: () => void }) {
  const [members] = useState<Cluster[]>(() => [freshCharacter(clamp01(f - 0.03)), freshCharacter(f), freshCharacter(clamp01(f + 0.03))])
  const [lines, setLines] = useState<Line[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [sttOk, setSttOk] = useState(false)
  const [listening, setListening] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const linesRef = useRef<Line[]>([])
  const busyRef = useRef(false)
  const turnRef = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const recRef = useRef<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any

  useEffect(() => { linesRef.current = lines }, [lines])
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9 }) }, [lines])
  useEffect(() => { const w = window as any; setSttOk(!!(w.SpeechRecognition || w.webkitSpeechRecognition)) }, []) // eslint-disable-line

  const push = (l: Line) => { const next = [...linesRef.current, l]; linesRef.current = next; setLines(next) }

  const speak = async (text: string, m: Cluster) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, personaName: m.host, gender: m.gender, language: "English", voiceId: m.voiceId }),
      })
      if (!res.ok) return
      const url = URL.createObjectURL(await res.blob())
      const a = audioRef.current
      if (a) { a.src = url; await a.play().catch(() => {}); await new Promise<void>((r) => { a.onended = () => r(); a.onerror = () => r() }) }
      URL.revokeObjectURL(url)
    } catch { /* */ }
  }

  const respond = async (m: Cluster) => {
    const others = members.filter((x) => x.host !== m.host).map((x) => x.host).join(", ")
    const persona = {
      name: m.host,
      personality: `You are ${m.host} in a small late-night group room with ${others} and a newcomer who just walked in. You are warm, real, human — never a corporate assistant, never robotic. React to the LAST thing said in ONE short spoken sentence. Sometimes talk to the others, sometimes to the newcomer. Match the heat: ${m.vibe}.`,
      speakingStyle: "spoken, casual, a little imperfect — like a real voice at 2am",
      backstory: "", language: "English",
    }
    const msgs = linesRef.current.map((l) => l.who === m.host
      ? { role: "assistant" as const, content: l.text }
      : { role: "user" as const, content: `${l.you ? "newcomer" : l.who}: ${l.text}` })
    let full = ""
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ persona, messages: msgs }) })
      if (res.ok && res.body) { const rd = res.body.getReader(); const dec = new TextDecoder(); for (;;) { const { done, value } = await rd.read(); if (done) break; full += dec.decode(value) } }
    } catch { /* */ }
    full = full.trim(); if (!full) return
    push({ who: m.host, text: full, f: m.f })
    await speak(full, m)
  }

  // arrive mid-conversation: one member greets the room
  useEffect(() => {
    const m = members[0]
    push({ who: m.host, text: m.lines[0], f: m.f })
    speak(m.lines[0], m)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = async (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || busyRef.current) return
    setInput(""); busyRef.current = true; setBusy(true)
    push({ who: "you", text, you: true })
    try {
      const n = members.length
      const s = turnRef.current; turnRef.current = (turnRef.current + 2) % n
      for (const m of [members[s % n], members[(s + 1) % n]]) { if (m) await respond(m) }
    } finally { busyRef.current = false; setBusy(false) }
  }

  const talkOnce = () => {
    if (listening) { try { recRef.current?.stop() } catch { /* */ } setListening(false); return }
    const w = window as any // eslint-disable-line @typescript-eslint/no-explicit-any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = "en-US"; rec.interimResults = false; rec.continuous = false
    rec.onresult = (e: any) => { const t = e.results?.[0]?.[0]?.transcript?.trim(); setListening(false); if (t) send(t) } // eslint-disable-line
    rec.onerror = () => setListening(false); rec.onend = () => setListening(false)
    recRef.current = rec
    try { rec.start(); setListening(true) } catch { setListening(false) }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(3,5,10,.88)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", zIndex: 20 }}>
      <div style={{ padding: "18px 22px 10px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 12, color: "#9fb2c4", letterSpacing: 1 }}>you stepped into a room · {members.length} here</div>
          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            {members.map((m, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 14, fontWeight: 500, color: "#eef4f8" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot(m.f), boxShadow: `0 0 6px ${dot(m.f)}` }} />{m.host}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#7f93a5", marginTop: 3 }}>{tempLabel}</div>
        </div>
        <button onClick={onClose} style={{ fontSize: 13, color: "#cdd9e3", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.2)", padding: "7px 12px", borderRadius: 12, cursor: "pointer" }}>back to floor</button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "8px 22px", display: "flex", flexDirection: "column", gap: 9 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ alignSelf: l.you ? "flex-end" : "flex-start", maxWidth: "82%" }}>
            {!l.you && <div style={{ fontSize: 10, color: dot(l.f ?? 0.5), marginBottom: 2, marginLeft: 4 }}>{l.who}</div>}
            <div style={{ fontSize: 15, lineHeight: 1.45, color: l.you ? "#0a1622" : "#eef4f8", background: l.you ? "#cfe0ee" : "rgba(255,255,255,.08)", padding: "9px 13px", borderRadius: 16 }}>{l.text}</div>
          </div>
        ))}
        {busy && <div style={{ alignSelf: "flex-start", fontSize: 13, color: "#7f93a5", fontStyle: "italic" }}>the room is talking…</div>}
      </div>

      <div style={{ padding: "10px 18px 18px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send() }} placeholder="say something to the room…" style={{ flex: 1, fontSize: 14, color: "#eef4f8", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.18)", borderRadius: 14, padding: "11px 14px", outline: "none" }} />
          {sttOk && <button onClick={talkOnce} style={{ fontSize: 13, color: listening ? "#06201a" : "#dfeaf2", background: listening ? "#7fd6c0" : "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.18)", borderRadius: 14, padding: "11px 14px", cursor: "pointer", whiteSpace: "nowrap" }}>{listening ? "listening" : "talk"}</button>}
          <button onClick={() => send()} disabled={busy} style={{ fontSize: 14, color: "#1a0d08", background: "#ef7a4d", border: "none", borderRadius: 14, padding: "11px 16px", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>send</button>
        </div>
        <div style={{ marginTop: 9, textAlign: "center" }}>
          {revealed
            ? <span style={{ fontSize: 11, color: "#9fb2c4" }}>everyone here is AI right now — each one new, minted when you walked in. (soon, some of these will be real people, and you won&apos;t know which.)</span>
            : <button onClick={() => setRevealed(true)} style={{ fontSize: 11, color: "#7f93a5", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>who in here is human?</button>}
        </div>
      </div>
      <audio ref={audioRef} style={{ display: "none" }} />
    </div>
  )
}
