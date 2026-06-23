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
import { imageFor } from "@/lib/persona-utils"

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const dot = (f: number) => (f < 0.4 ? "#6fd6e6" : f < 0.72 ? "#ffce7a" : "#ff7a4d")
const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

// When the LLM is unreachable (e.g. out of credits), replies fall back to the
// character's roster lines then to these generic beats — cycled, never repeated —
// so a dead backend degrades to "alive but quiet", not "same line three times".
const BEATS = ["mm, go on.", "wait — say that again?", "ha, okay.", "i'm listening… tell me more.", "okay, and then?", "hmm. keep going.", "say more."]

// Deterministic turn selection: every client picks the SAME responders for a given
// human line (hashed from its id), so the cast that answers can never diverge
// between participants — and a sender who drops can be safely taken over.
const hashStr = (s: string) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
function pickResponders(msgId: string, n: number): number[] {
  if (n <= 1) return [0]
  if (n === 2) { const a = hashStr(msgId) % 2; return [a, (a + 1) % 2] }
  const a = hashStr(msgId) % n
  const b = (a + 1 + (hashStr(msgId + "b") % (n - 1))) % n
  return [a, b]
}

export function GroupRoom({ seed, f, tempLabel, onClose, count = 3 }: { seed: number; f: number; tempLabel: string; onClose: () => void; count?: number }) {
  // Deterministic cast of N — the same crowd for everyone who enters this room.
  // The zoom level chose N (a 60-voice floor or a 4-voice booth); members spread
  // across a small temperature band around the room so the room has texture.
  const [members] = useState<Cluster[]>(() => {
    const n = Math.max(1, Math.min(120, Math.round(count)))
    return Array.from({ length: n }, (_, i) => makeCharacter(seed * 7 + i + 1, clamp01(f + ((i / n) - 0.5) * 0.08)))
  })
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
  const seen = useRef<Set<string>>(new Set())
  const aiByHuman = useRef<Set<string>>(new Set())      // human-line ids that already got an AI reply
  const drivenRef = useRef<Set<string>>(new Set())       // human-line ids this client has driven
  const driveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const humansRef = useRef<Participant[]>([])
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
    // AI lines are id'd `ai-<humanLineId>-<idx>` — record that this human line got
    // an answer, so a backup driver knows not to step in.
    if (m.kind === "ai" && m.id.startsWith("ai-")) { const hp = m.id.split("-")[1]; if (hp) aiByHuman.current.add(hp) }
    const next = [...linesRef.current, m]; linesRef.current = next; setLines(next)
  }

  // join the room's shared channel — see + hear everyone else here
  useEffect(() => {
    const sess = joinSession("airroom", `g${seed}`, handle, {
      onMessage: (m) => {
        const already = seen.current.has(m.id)
        push(m)
        if (already) return
        if (m.kind === "ai") {
          const mem = members.find((x) => x.host === m.handle); if (mem) speak(m.content, mem)
        } else if (m.kind === "human" && m.handle !== handle) {
          armBackup(m) // someone else sent — stand by to drive the AI turn if they drop
        }
      },
      onPresence: (people) => { setHumans(people); humansRef.current = people },
    })
    bcastRef.current = sess.broadcast
    // arrive mid-conversation: one member greets. The cast is deterministic, so
    // every client shows this locally — no broadcast (or two people entering
    // would each fire their own greeting). Stable id so dedup is belt-and-braces.
    const g = members[0]
    const greet: WireMessage = { id: `greet-${seed}`, kind: "ai", handle: g.host, content: g.lines[0], ts: Date.now() }
    push(greet); speak(greet.content, g)
    return () => { driveTimers.current.forEach((t) => clearTimeout(t)); driveTimers.current.clear(); try { sess.leave() } catch { /* */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const respond = async (mem: Cluster, humanMsgId: string, idx: number) => {
    const id = `ai-${humanMsgId}-${idx}`
    if (seen.current.has(id)) return // a peer driver already produced this exact line
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
    full = full.trim()
    if (!full) {
      // LLM down (e.g. 402 out of credits): vary by how much this member has said
      // so it never repeats the same line — roster lines first, then generic beats.
      const said = linesRef.current.filter((l) => l.kind === "ai" && l.handle === mem.host).length
      full = said < mem.lines.length ? mem.lines[said] : BEATS[(said - mem.lines.length) % BEATS.length]
    }
    if (seen.current.has(id)) return // a peer's copy may have landed while we were waiting
    const aiMsg: WireMessage = { id, kind: "ai", handle: mem.host, content: full, ts: Date.now() }
    push(aiMsg); bcastRef.current?.(aiMsg)
    await speak(full, mem)
  }

  // Run the AI turn for one human line: the same two members on every client,
  // sequentially so they take turns and the TTS doesn't collide.
  const drive = async (humanMsgId: string) => {
    if (drivenRef.current.has(humanMsgId)) return
    drivenRef.current.add(humanMsgId)
    busyRef.current = true; setBusy(true)
    try {
      for (const i of pickResponders(humanMsgId, members.length)) {
        const mem = members[i]; if (mem) await respond(mem, humanMsgId, i)
      }
    } finally { busyRef.current = false; setBusy(false) }
  }

  // If the human who sent a line drops before the AI answers, a present peer takes
  // over — staggered by handle rank so we don't all pile on, and only if no reply
  // has shown up yet. This is what keeps the room from going silent on a leaver.
  const armBackup = (humanMsg: WireMessage) => {
    if (drivenRef.current.has(humanMsg.id) || driveTimers.current.has(humanMsg.id)) return
    const ranks = humansRef.current.map((h) => h.handle).sort()
    const rank = Math.max(0, ranks.indexOf(handle))
    const t = setTimeout(() => {
      driveTimers.current.delete(humanMsg.id)
      if (aiByHuman.current.has(humanMsg.id)) return // sender (or an earlier peer) already handled it
      drive(humanMsg.id)
    }, 5000 + rank * 2500)
    driveTimers.current.set(humanMsg.id, t)
  }

  const send = (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || busyRef.current) return
    setInput("")
    const mine: WireMessage = { id: rid(), kind: "human", handle, content: text, ts: Date.now() }
    push(mine); bcastRef.current?.(mine)
    drive(mine.id) // the sender drives immediately; peers stand by as backups
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
          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap", maxHeight: 64, overflow: "hidden" }}>
            {members.slice(0, 12).map((m, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 500, color: "#eef4f8" }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", overflow: "hidden", background: avatarBg(seed * 7 + i + 1, m.f), boxShadow: `0 0 6px ${dot(m.f)}66`, border: "1px solid rgba(255,255,255,.15)", display: "inline-block" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageFor({ name: m.host })} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </span>{m.host}
              </span>
            ))}
            {members.length > 12 && (
              <span style={{ display: "inline-flex", alignItems: "center", fontSize: 13, fontWeight: 500, color: "#9fb2c4", background: "rgba(255,255,255,.06)", borderRadius: 10, padding: "2px 9px" }}>+{members.length - 12} more</span>
            )}
            {realOthers.map((h) => (
              <span key={h.handle} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 14, fontWeight: 500, color: h.color }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: h.color }} />{h.handle}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#7f93a5", marginTop: 3 }}>{tempLabel}</div>
        </div>
        <button onClick={onClose} style={{ fontSize: 13, color: "#cdd9e3", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.2)", padding: "7px 12px", borderRadius: 12, cursor: "pointer" }}>← leave</button>
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
            ? <span style={{ fontSize: 11, color: "#9fb2c4" }}>{members.slice(0, 6).map((m) => m.host).join(", ")}{members.length > 6 ? ` and ${members.length - 6} more` : ""} are AI · {realOthers.length > 0 ? `${realOthers.map((h) => h.handle).join(", ")} ${realOthers.length === 1 ? "is" : "are"} a real person` : "the only human here right now is you — when someone real wanders in, they'll appear above, and you won't always know which is which"}</span>
            : <button onClick={() => setRevealed(true)} style={{ fontSize: 11, color: "#7f93a5", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>who in here is human?</button>}
        </div>
      </div>
      <audio ref={audioRef} style={{ display: "none" }} />
    </div>
  )
}
