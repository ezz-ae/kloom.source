"use client"

/**
 * AIRROOM — a group room, where real humans actually meet.
 *
 * Multiplayer over Supabase Realtime (lib/room-session): everyone who steps into
 * the SAME room joins one channel — they see each other (presence) and talk in
 * real time (broadcast). The AI cast is DETERMINISTIC per room (makeCharacter
 * seeded by the room), so two humans see the *same* people, not different
 * randoms. The sender of a human line "owns" the AI turn — runs the models once
 * and broadcasts the replies — so the room stays in sync and the model isn't
 * called N times. The reveal answers honestly: some of these are AI, some are
 * real, and — that's the whole point — you can't always tell.
 */
import { useEffect, useRef, useState } from "react"
import { makeCharacter, type Cluster } from "@/lib/airroom/roster"
import { joinSession, resolveHandle, colorFor, type WireMessage, type Participant } from "@/lib/room-session"
import { avatarBg } from "@/lib/airroom/avatar"

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const dot = (f: number) => (f < 0.4 ? "#6fd6e6" : f < 0.72 ? "#ffce7a" : "#ff7a4d")
const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export function GroupRoom({ seed, f, tempLabel, onClose }: { seed: number; f: number; tempLabel: string; onClose: () => void }) {
  // Deterministic cast — same three for everyone who enters this room.
  const [members] = useState<Cluster[]>(() => [
    makeCharacter(seed * 7 + 1, clamp01(f - 0.03)),
    makeCharacter(seed * 7 + 2, f),
    makeCharacter(seed * 7 + 3, clamp01(f + 0.03)),
  ])
  const handle = useRef(resolveHandle()).current

  const [lines, setLines] = useState<WireMessage[]>([])
  const [humans, setHumans] = useState<Participant[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [sttOk, setSttOk] = useState(false)
  const [listening, setListening] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const linesRef = useRef<WireMessage[]>([])
  const busyRef = useRef(false)
  const turnRef = useRef(0)
  const seen = useRef<Set<string>>(new Set())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const recRef = useRef<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const bcastRef = useRef<((m: WireMessage) => void) | null>(null)

  useEffect(() => { linesRef.current = lines }, [lines])
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9 }) }, [lines, humans])
  useEffect(() => { const w = window as any; setSttOk(!!(w.SpeechRecognition || w.webkitSpeechRecognition)) }, []) // eslint-disable-line

  const speak = async (text: string, m: Cluster) => {
    try {
      const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, personaName: m.host, gender: m.gender, language: "English", voiceId: m.voiceId }) })
      if (!res.ok) return
      const url = URL.createObjectURL(await res.blob())
      const a = audioRef.current
      if (a) { a.src = url; await a.play().catch(() => {}); await new Promise<void>((r) => { a.onended = () => r(); a.onerror = () => r() }) }
      URL.revokeObjectURL(url)
    } catch { /* */ }
  }

  const push = (m: WireMessage) => {
    if (seen.current.has(m.id)) return
    seen.current.add(m.id)
    const next = [...linesRef.current, m]; linesRef.current = next; setLines(next)
  }

  // join the room's shared channel — see + hear everyone else here
  useEffect(() => {
    const sess = joinSession("airroom", `g${seed}`, handle, {
      onMessage: (m) => {
        const already = seen.current.has(m.id)
        push(m)
        if (!already && m.kind === "ai") { const mem = members.find((x) => x.host === m.handle); if (mem) speak(m.content, mem) }
      },
      onPresence: (people) => setHumans(people),
    })
    bcastRef.current = sess.broadcast
    // arrive mid-conversation: one member greets. The cast is deterministic, so
    // every client shows this locally — no broadcast (or two people entering
    // would each fire their own greeting). Stable id so dedup is belt-and-braces.
    const g = members[0]
    const greet: WireMessage = { id: `greet-${seed}`, kind: "ai", handle: g.host, content: g.lines[0], ts: Date.now() }
    push(greet); speak(greet.content, g)
    return () => { try { sess.leave() } catch { /* */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const respond = async (mem: Cluster) => {
    const others = members.filter((x) => x.host !== mem.host).map((x) => x.host).join(", ")
    const persona = {
      name: mem.host,
      personality: `You are ${mem.host} in a small late-night group room with ${others} and the people who just walked in. You are warm, real, human — never a corporate assistant, never robotic. React to the LAST thing said in ONE short spoken sentence. Sometimes to the others, sometimes to a newcomer. Vibe: ${mem.vibe}.`,
      speakingStyle: "spoken, casual, a little imperfect — like a real voice at 2am", backstory: "", language: "English",
    }
    const msgs = linesRef.current.map((l) => l.kind === "ai" && l.handle === mem.host
      ? { role: "assistant" as const, content: l.content }
      : { role: "user" as const, content: `${l.kind === "human" ? (l.handle === handle ? "newcomer" : l.handle) : l.handle}: ${l.content}` })
    let full = ""
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ persona, messages: msgs }) })
      if (res.ok && res.body) { const rd = res.body.getReader(); const dec = new TextDecoder(); for (;;) { const { done, value } = await rd.read(); if (done) break; full += dec.decode(value) } }
    } catch { /* */ }
    full = full.trim(); if (!full) return
    const aiMsg: WireMessage = { id: rid(), kind: "ai", handle: mem.host, content: full, ts: Date.now() }
    push(aiMsg); bcastRef.current?.(aiMsg)
    await speak(full, mem)
  }

  const send = async (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || busyRef.current) return
    setInput(""); busyRef.current = true; setBusy(true)
    const mine: WireMessage = { id: rid(), kind: "human", handle, content: text, ts: Date.now() }
    push(mine); bcastRef.current?.(mine)
    try {
      const n = members.length; const s = turnRef.current; turnRef.current = (s + 2) % n
      for (const mem of [members[s % n], members[(s + 1) % n]]) { if (mem) await respond(mem) }
    } finally { busyRef.current = false; setBusy(false) }
  }

  const talkOnce = () => {
    if (listening) { try { recRef.current?.stop() } catch { /* */ } setListening(false); return }
    const w = window as any // eslint-disable-line @typescript-eslint/no-explicit-any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR(); rec.lang = "en-US"; rec.interimResults = false; rec.continuous = false
    rec.onresult = (e: any) => { const t = e.results?.[0]?.[0]?.transcript?.trim(); setListening(false); if (t) send(t) } // eslint-disable-line
    rec.onerror = () => setListening(false); rec.onend = () => setListening(false)
    recRef.current = rec
    try { rec.start(); setListening(true) } catch { setListening(false) }
  }

  const realOthers = humans.filter((h) => !h.isYou)

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(3,5,10,.88)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", zIndex: 20 }}>
      <div style={{ padding: "18px 22px 10px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 12, color: "#9fb2c4", letterSpacing: 1 }}>
            you stepped into a room · {members.length} voices{realOthers.length > 0 ? ` + ${realOthers.length} real` : ""}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            {members.map((m, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 500, color: "#eef4f8" }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: avatarBg(seed * 7 + i + 1, m.f), boxShadow: `0 0 6px ${dot(m.f)}66`, border: "1px solid rgba(255,255,255,.15)" }} />{m.host}
              </span>
            ))}
            {realOthers.map((h) => (
              <span key={h.handle} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 14, fontWeight: 500, color: h.color }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: h.color }} />{h.handle}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#7f93a5", marginTop: 3 }}>{tempLabel}</div>
        </div>
        <button onClick={onClose} style={{ fontSize: 13, color: "#cdd9e3", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.2)", padding: "7px 12px", borderRadius: 12, cursor: "pointer" }}>back to floor</button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "8px 22px", display: "flex", flexDirection: "column", gap: 9 }}>
        {lines.map((l, i) => {
          const mine = l.kind === "human" && l.handle === handle
          const c = l.kind === "ai" ? dot(members.find((m) => m.host === l.handle)?.f ?? 0.5) : colorFor(l.handle)
          return (
            <div key={l.id || i} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%" }}>
              {!mine && <div style={{ fontSize: 10, color: c, marginBottom: 2, marginLeft: 4 }}>{l.handle}</div>}
              <div style={{ fontSize: 15, lineHeight: 1.45, color: mine ? "#0a1622" : "#eef4f8", background: mine ? "#cfe0ee" : "rgba(255,255,255,.08)", padding: "9px 13px", borderRadius: 16 }}>{l.content}</div>
            </div>
          )
        })}
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
            ? <span style={{ fontSize: 11, color: "#9fb2c4" }}>{members.map((m) => m.host).join(", ")} are AI · {realOthers.length > 0 ? `${realOthers.map((h) => h.handle).join(", ")} ${realOthers.length === 1 ? "is" : "are"} a real person` : "the only human here right now is you — when someone real wanders in, they'll appear above, and you won't always know which is which"}</span>
            : <button onClick={() => setRevealed(true)} style={{ fontSize: 11, color: "#7f93a5", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>who in here is human?</button>}
        </div>
      </div>
      <audio ref={audioRef} style={{ display: "none" }} />
    </div>
  )
}
