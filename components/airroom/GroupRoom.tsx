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
import { groupCast, type Cluster, faceSeedFor } from "@/lib/airroom/roster"
import { pinnedVoice, pinFromResponse, awaitPin, claimFirst } from "@/lib/airraw/voice-pin"
import { visitorId } from "@/lib/airraw/visitor"
import { joinSession, resolveHandle, colorFor, type WireMessage, type Participant } from "@/lib/room-session"
import { avatarBg } from "@/lib/airroom/avatar"
import { Face } from "@/components/airroom/Face"
import { isPro, getProToken } from "@/lib/airroom/pro"
import { ProSheet } from "@/components/airroom/ProSheet"
import { LANGUAGE_TO_BCP47 } from "@/lib/languages"
import { listenOnce, canListen } from "@/lib/voice-once"
import { resolveAirrawHandle } from "@/lib/airroom/onboard"
import { stripHallucinatedSentences } from "@/lib/text-dedup"
import { dossierLine } from "@/lib/airraw/dossier"

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

export function GroupRoom({ seed, f, tempLabel, onClose, count = 3, opening, lang = "English", onCall, topic }: { seed: number; f: number; tempLabel: string; onClose: () => void; count?: number; opening?: string; lang?: string; onCall?: (m: Cluster) => void; topic?: string }) {
  // Deterministic cast of N — the same crowd for everyone who enters this room.
  // The zoom level chose N (a 60-voice floor or a 4-voice booth); members spread
  // across a small temperature band around the room so the room has texture.
  const [members] = useState<Cluster[]>(() => groupCast(seed, f, count))
  // if they gave a name on the welcome, that's who they are in the room — not
  // a random Guest-XXXX. Airraw-only wrapper; Kloom's resolveHandle() is untouched.
  const handle = useRef(resolveAirrawHandle(resolveHandle)).current

  const [lines, setLines] = useState<WireMessage[]>([])
  const [humans, setHumans] = useState<Participant[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [sttOk, setSttOk] = useState(false)
  const [listening, setListening] = useState(false)
  const [muted, setMuted] = useState(false)         // mute the room's voices (text keeps flowing)
  const [speaking, setSpeaking] = useState(false)   // someone is talking aloud → sound indicator
  const [humanNote, setHumanNote] = useState(false) // one-time "some people are real" note (first room ever)
  const [pro] = useState(() => isPro())
  const [active, setActive] = useState(0)           // who holds the stage (last AI voice heard)
  const [peopleOpen, setPeopleOpen] = useState(false) // ← swipe: everyone on the call; tap one to call them
  const swipeRef = useRef<{ x: number; y: number } | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [vibe, setVibe] = useState("")              // pro: steer the room vibe → enforced on the AI
  const [vibeEdit, setVibeEdit] = useState(false)
  const [showPro, setShowPro] = useState(false)
  const mutedRef = useRef(false)
  const vibeRef = useRef("")
  useEffect(() => { mutedRef.current = muted }, [muted])
  useEffect(() => { vibeRef.current = vibe }, [vibe])
  const langRef = useRef(lang)
  useEffect(() => { langRef.current = lang }, [lang])

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
  useEffect(() => { setSttOk(canListen()) }, [])
  useEffect(() => { try { if (!localStorage.getItem("airraw_human_note")) setHumanNote(true) } catch { /* */ } }, [])
  const dismissHumanNote = () => { setHumanNote(false); try { localStorage.setItem("airraw_human_note", "1") } catch { /* */ } }

  const speak = async (text: string, m: Cluster) => {
    if (mutedRef.current) return   // muted: skip the voices (the words still arrive)
    try {
      // Same seed as the face (archetype + name), so voice and face never disagree;
      // and the voice they were first heard in, pinned, so they never change it.
      const who = faceSeedFor(m) || m.host
      const lang = langRef.current
      await awaitPin(who, lang)
      const req = fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, personaName: m.host, seedKey: who, gender: m.gender, language: lang, voiceId: m.voiceId, elevenId: pinnedVoice(who, lang), proToken: getProToken(), visitorId: visitorId(), mode: "voice" }) })
      claimFirst(who, lang, req)
      const res = await req
      if (!res.ok) return
      pinFromResponse(who, lang, res)
      const url = URL.createObjectURL(await res.blob())
      const a = audioRef.current
      if (a) {
        a.src = url; setSpeaking(true)
        // If play() is rejected (blocked autoplay), log it — same silent-failure
        // trap as the 1:1 call: text would show with no sound and no clue why.
        await a.play().catch((err) => console.error("[room] audio play blocked:", err?.message || err))
        await new Promise<void>((r) => { a.onended = () => r(); a.onerror = () => r() })
        setSpeaking(false)
      }
      URL.revokeObjectURL(url)
    } catch { setSpeaking(false) }
  }

  const push = (m: WireMessage) => {
    if (seen.current.has(m.id)) return
    seen.current.add(m.id)
    // AI lines are id'd `ai-<humanLineId>-<idx>` — record that this human line got
    // an answer, so a backup driver knows not to step in.
    if (m.kind === "ai" && m.id.startsWith("ai-")) { const hp = m.id.split("-")[1]; if (hp) aiByHuman.current.add(hp) }
    // whoever just spoke takes the stage (drives the big portrait spotlight)
    if (m.kind === "ai") { const idx = members.findIndex((x) => x.host === m.handle); if (idx >= 0) setActive(idx) }
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
    // The card promised a topic — the room OPENS on it. Discovery carries through
    // the door instead of resetting to a canned line.
    const greet: WireMessage = { id: `greet-${seed}`, kind: "ai", handle: g.host, content: topic ? `you caught us — we're deep in "${topic}". come in.` : g.lines[0], ts: Date.now() }
    push(greet); speak(greet.content, g)
    return () => { driveTimers.current.forEach((t) => clearTimeout(t)); driveTimers.current.clear(); try { sess.leave() } catch { /* */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const respond = async (mem: Cluster, humanMsgId: string, idx: number) => {
    const id = `ai-${humanMsgId}-${idx}`
    if (seen.current.has(id)) return // a peer driver already produced this exact line
    const others = members.filter((x) => x.host !== mem.host).map((x) => x.host).join(", ")
    // The Pro "vibe" steer is sent separately and gated server-side on a real Pro token.
    const persona = {
      name: mem.host,
      // Same fix as the 1:1 call: every member used to be described by one generic
      // sentence, so nobody in the room had anything of their own to say and they
      // all converged on echoing whatever was said last. The dossier gives each
      // one a job, a night, an opinion — which is also what makes them sound like
      // different people to each other.
      personality: `You are ${mem.host} in a small late-night group room with ${others} and the people who just walked in. ${dossierLine(mem.key || mem.host)} React to the LAST thing said in ONE short spoken sentence. Sometimes to the others, sometimes to a newcomer. Vibe: ${mem.vibe}.${topic ? ` Tonight the room keeps circling one thing: "${topic}" — drift back to it when the thread goes quiet.` : ""}`,
      speakingStyle: "spoken, casual, a little imperfect — like a real voice at 2am", backstory: "", language: langRef.current,
      // The face's seed (archetype + name), not the unique key and not the bare
      // name: accent is derived from this and the face is generated from it, so
      // they must agree.
      seedKey: faceSeedFor(mem) || mem.host,
    }
    const msgs = linesRef.current.map((l) => l.kind === "ai" && l.handle === mem.host
      ? { role: "assistant" as const, content: l.content }
      : { role: "user" as const, content: `${l.kind === "human" ? (l.handle === handle ? "newcomer" : l.handle) : l.handle}: ${l.content}` })
    let full = ""
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ persona, proVibe: vibeRef.current, proToken: getProToken(), messages: msgs }) })
      if (res.ok && res.body) { const rd = res.body.getReader(); const dec = new TextDecoder(); for (;;) { const { done, value } = await rd.read(); if (done) break; full += dec.decode(value) } }
    } catch { /* */ }
    // Strip video-outro hallucinations ("اشتركوا في القناة" / "subscribe to the
    // channel") — training-data leakage the model occasionally produces, never a
    // real line. If that's all this turn had, the empty-reply fallback below picks
    // a roster line instead, same as an LLM-down turn.
    full = stripHallucinatedSentences(full.trim())
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

  // pass the mic — hand the floor to a SPECIFIC person (tap their face on the
  // stage) or, via the button, rotate through the room's voices.
  const passIdx = useRef(0)
  const passTo = (i: number) => {
    if (busyRef.current) return
    const mem = members[i]; if (!mem) return
    setActive(i)   // they take the stage immediately; their line follows
    busyRef.current = true; setBusy(true)
    respond(mem, `pass-${rid()}`, i).finally(() => { busyRef.current = false; setBusy(false) })
  }
  const pass = () => {
    if (!members.length) return
    const i = passIdx.current % members.length; passIdx.current++
    passTo(i)
  }

  // Seed the room with what you wrote on the sky, once you've walked in.
  useEffect(() => {
    const o = opening?.trim()
    if (!o) return
    const id = setTimeout(() => send(o), 900)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // tap → say one line → auto-sends to the room. MediaRecorder + server Whisper
  // first (so it works in the Instagram / in-app browsers), browser SR as fallback.
  const talkOnce = () => {
    if (listening) { try { recRef.current?.stop() } catch { /* */ } setListening(false); return }
    const bcp47 = LANGUAGE_TO_BCP47[langRef.current] || "en-US"
    recRef.current = listenOnce({
      lang: bcp47.split("-")[0],
      bcp47,
      onState: (s) => setListening(s !== "idle"),
      onText: (t) => send(t),
    })
  }

  const realOthers = humans.filter((h) => !h.isYou)
  const hasText = input.trim().length > 0

  // Call gestures: swipe ← opens the people-on-this-call sheet (tap one → call them
  // 1:1); swipe → jumps you to the words (focuses the text input). Pointer events
  // cover touch and trackpad alike.
  const onSwipeDown = (e: React.PointerEvent) => { swipeRef.current = { x: e.clientX, y: e.clientY } }
  const onSwipeUp = (e: React.PointerEvent) => {
    const s = swipeRef.current; swipeRef.current = null
    if (!s || peopleOpen || showPro || vibeEdit) return
    const dx = e.clientX - s.x, dy = e.clientY - s.y
    if (Math.abs(dy) > 80) return
    if (dx < -70) setPeopleOpen(true)
    else if (dx > 70) inputRef.current?.focus()
  }

  return (
    <div onPointerDown={onSwipeDown} onPointerUp={onSwipeUp} className="air-rise" style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100dvh", background: "rgba(3,5,10,.88)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", zIndex: 20, fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
      <style>{`@keyframes greq{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}@keyframes gpulse{0%{transform:scale(1);opacity:.7}70%{transform:scale(1.16);opacity:0}100%{transform:scale(1.16);opacity:0}}@keyframes stagein{from{opacity:0;transform:translateY(14px) scale(.9)}to{opacity:1;transform:none}}@keyframes sheetin{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:none}}`}</style>
      {/* slim header — the cast lives on the STAGE below, not up here */}
      <div style={{ padding: "calc(env(safe-area-inset-top) + 14px) max(22px, env(safe-area-inset-right)) 4px max(22px, env(safe-area-inset-left))", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 2, height: 12, flexShrink: 0 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 3, height: 12, borderRadius: 2, background: muted ? "#46586a" : "#7fd6c0", transformOrigin: "center", animation: (speaking && !muted) ? `greq .7s ease-in-out ${i * 0.15}s infinite` : "none", transform: (speaking && !muted) ? undefined : "scaleY(.4)" }} />
            ))}
          </span>
          <button onClick={() => setPeopleOpen(true)} aria-label="who's on this call" style={{ fontSize: 12, color: "#9fb2c4", letterSpacing: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", background: "none", border: "none", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            {muted ? "muted · text only" : <>{members.length} voices{realOthers.length > 0 ? ` + ${realOthers.length} real` : ""} · {tempLabel}</>}
          </button>
        </div>
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => { setMuted((m) => { const n = !m; mutedRef.current = n; if (n && audioRef.current) { try { audioRef.current.pause() } catch { /* */ } setSpeaking(false) } return n }) }} aria-label={muted ? "unmute" : "mute"} style={{ width: 44, height: 44, borderRadius: 12, fontSize: 13, color: muted ? "#ffb59c" : "#cdd9e3", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.2)", cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>{muted ? "🔇" : "🔊"}</button>
          <button onClick={onClose} style={{ fontSize: 13, color: "#cdd9e3", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.2)", padding: "11px 12px", minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 12, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>← leave</button>
        </div>
      </div>

      {/* THE STAGE — whoever's talking holds the light, everyone else sits around it.
          Tap any small face to hand them the mic. */}
      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "4px 22px 6px" }}>
        {/* key={active} remounts on speaker change → the new speaker RISES onto the
            stage (slide-up + scale-in) instead of the photo just swapping */}
        <div key={active} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, animation: "stagein .45s ease both" }}>
          <div style={{ position: "relative", width: "min(30vw, 118px)", aspectRatio: "1" }}>
            {speaking && !muted && <div style={{ position: "absolute", inset: -6, borderRadius: "50%", border: `2px solid ${dot(members[active]?.f ?? f)}`, animation: "gpulse 1.5s ease-out infinite" }} />}
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", border: `1.5px solid ${dot(members[active]?.f ?? f)}${speaking && !muted ? "" : "66"}`, boxShadow: `0 18px 56px -18px ${dot(members[active]?.f ?? f)}88`, transition: "border-color .3s", background: avatarBg(seed * 7 + active + 1, members[active]?.f ?? f) }}>
              <Face persona={{ name: members[active]?.host || "", gender: members[active]?.gender, seed: faceSeedFor(members[active]) }} lazy={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#eef4f8", lineHeight: 1 }}>{members[active]?.host}</div>
        </div>
        <div style={{ display: "flex", gap: 9, alignItems: "center", maxWidth: "100%", overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch", padding: "2px 2px 4px", maskImage: "linear-gradient(to right, #000 92%, transparent)", WebkitMaskImage: "linear-gradient(to right, #000 92%, transparent)" }}>
          {members.slice(0, 12).map((m, i) => (
            <button key={i} onClick={() => passTo(i)} disabled={busy} aria-label={`pass the mic to ${m.host}`}
              style={{ flexShrink: 0, width: 38, height: 38, borderRadius: "50%", overflow: "hidden", padding: 0, background: avatarBg(seed * 7 + i + 1, m.f), border: i === active ? `2px solid ${dot(m.f)}` : "1px solid rgba(255,255,255,.18)", boxShadow: i === active ? `0 0 10px ${dot(m.f)}88` : "none", opacity: busy ? 0.55 : i === active ? 1 : 0.85, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation", transition: "border-color .2s, box-shadow .2s" }}>
              <Face persona={{ name: m.host, gender: m.gender, seed: faceSeedFor(m) }} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </button>
          ))}
          {members.length > 12 && (
            <span style={{ display: "inline-flex", alignItems: "center", fontSize: 12, fontWeight: 500, color: "#9fb2c4", background: "rgba(255,255,255,.06)", borderRadius: 10, padding: "3px 9px", flexShrink: 0, whiteSpace: "nowrap" }}>+{members.length - 12}</span>
          )}
          {realOthers.map((h) => (
            <span key={h.handle} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 500, color: h.color, flexShrink: 0, whiteSpace: "nowrap" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: h.color, flexShrink: 0 }} />{h.handle}
            </span>
          ))}
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", padding: "8px 22px", display: "flex", flexDirection: "column", gap: 9 }}>
        <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }} />{/* anchor messages to the bottom, like a real chat */}
        {lines.map((l, i) => {
          const mine = l.kind === "human" && l.handle === handle
          const c = l.kind === "ai" ? dot(members.find((m) => m.host === l.handle)?.f ?? 0.5) : colorFor(l.handle)
          return (
            <div key={l.id || i} className="air-msg" style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%" }}>
              {!mine && <div style={{ fontSize: 12, color: c, marginBottom: 2, marginLeft: 4 }}>{l.handle}</div>}
              <div style={{ fontSize: 15, lineHeight: 1.45, color: mine ? "#0a1622" : "#eef4f8", background: mine ? "#cfe0ee" : "rgba(255,255,255,.08)", padding: "9px 13px", borderRadius: 16 }}>{l.content}</div>
            </div>
          )
        })}
        {busy && <div style={{ alignSelf: "flex-start", fontSize: 13, color: "#7f93a5", fontStyle: "italic" }}>the room is talking…</div>}
      </div>

      <div style={{ padding: "10px max(18px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 18px) max(18px, env(safe-area-inset-right))", boxSizing: "border-box" }}>
        {humanNote && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#cfe0ee", background: "rgba(127,214,192,.1)", border: ".5px solid rgba(127,214,192,.25)", borderRadius: 12, padding: "9px 12px", marginBottom: 9 }}>
            <span style={{ flex: 1, lineHeight: 1.4 }}>some people in here are real — you won&apos;t always know which.</span>
            <button onClick={dismissHumanNote} style={{ flex: "0 0 auto", fontSize: 12, color: "#06201a", background: "#7fd6c0", border: "none", borderRadius: 9, padding: "7px 12px", minHeight: 34, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>got it</button>
          </div>
        )}
        {/* pass + vibe — one fixed-height row, never reflows */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", height: 38, marginBottom: 9 }}>
          <button onClick={pass} disabled={busy} aria-label="pass the mic to someone else" style={{ flex: "0 0 auto", fontSize: 12.5, height: 38, color: "#cfe0ee", background: "rgba(255,255,255,.06)", border: ".5px solid rgba(255,255,255,.16)", borderRadius: 999, padding: "0 15px", cursor: "pointer", opacity: busy ? 0.5 : 1, WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>↦ pass the mic</button>
          {(
            <button onClick={() => pro ? setVibeEdit(true) : setShowPro(true)} aria-label="set the room vibe" style={{ flex: "0 1 auto", minWidth: 0, fontSize: 12.5, height: 38, fontWeight: 500, color: vibe ? "#1a0d2a" : "#c7b3ff", background: vibe ? "#c7b3ff" : "rgba(150,120,255,.12)", border: vibe ? "none" : ".5px solid rgba(150,120,255,.4)", borderRadius: 999, padding: "0 15px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>{vibe ? `vibe · ${vibe}` : pro ? "✦ set the vibe" : "✦ vibe — pro"}</button>
          )}
        </div>
        {/* input + ONE morphing button (fixed 66×44, so nothing jumps) — empty = voice, typing = send */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send() }} placeholder={listening ? "listening…" : "say something to the room…"} style={{ flex: 1, minWidth: 0, fontSize: 16, color: "#eef4f8", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.18)", borderRadius: 14, padding: "12px 14px", minHeight: 44, boxSizing: "border-box", outline: "none" }} />
          <button onClick={hasText ? () => send() : (sttOk ? talkOnce : () => send())} disabled={busy && hasText} aria-label={hasText ? "send" : "talk"} style={{ flex: "0 0 auto", width: 66, height: 44, borderRadius: 14, fontSize: hasText ? 14 : 19, fontWeight: 600, lineHeight: 1, border: "none", cursor: "pointer", color: hasText ? "#1a0d08" : (listening ? "#06201a" : "#dfeaf2"), background: hasText ? "#ef7a4d" : (listening ? "#7fd6c0" : "rgba(255,255,255,.12)"), opacity: (busy && hasText) ? 0.6 : 1, WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>{hasText ? "send" : (listening ? "•••" : "🎙")}</button>
        </div>
      </div>
      {/* ← swipe: everyone on this call. Tap a face → call them 1:1. From here:
          swipe → goes back to the call, another swipe ← leaves the room entirely. */}
      {peopleOpen && (
        <div
          onPointerDown={(e) => { swipeRef.current = { x: e.clientX, y: e.clientY } }}
          onPointerUp={(e) => {
            const s = swipeRef.current; swipeRef.current = null
            if (!s) return
            const dx = e.clientX - s.x, dy = e.clientY - s.y
            if (Math.abs(dy) > 80) return
            if (dx > 70) setPeopleOpen(false)      // → back to the call
            else if (dx < -70) onClose()           // ← out of the room (the planet zooms you back out)
          }}
          style={{ position: "absolute", inset: 0, zIndex: 27, background: "rgba(3,5,10,.94)", backdropFilter: "blur(10px)", display: "flex", flexDirection: "column", animation: "sheetin .3s ease both" }}>
          <div style={{ padding: "calc(env(safe-area-inset-top) + 14px) max(22px, env(safe-area-inset-right)) 10px max(22px, env(safe-area-inset-left))", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 12, color: "#9fb2c4", letterSpacing: 1 }}>on this call · {members.length} voices{realOthers.length > 0 ? ` + ${realOthers.length} real` : ""}</div>
            <button onClick={() => setPeopleOpen(false)} style={{ fontSize: 13, color: "#cdd9e3", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.2)", padding: "11px 12px", minHeight: 44, borderRadius: 12, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>back →</button>
          </div>
          <div style={{ fontSize: 12, color: "#7f93a5", textAlign: "center", padding: "0 22px 12px" }}>tap someone to call them, just you two · swipe → back · swipe ← leave</div>
          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "4px 22px calc(env(safe-area-inset-bottom) + 20px)", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 14, alignContent: "start" }}>
            {members.map((m, i) => (
              <button key={i} onClick={() => { setPeopleOpen(false); onCall?.(m) }} aria-label={`call ${m.host}`}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", padding: 4, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
                <span style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", background: avatarBg(seed * 7 + i + 1, m.f), border: i === active ? `2px solid ${dot(m.f)}` : "1px solid rgba(255,255,255,.16)", boxShadow: i === active ? `0 0 12px ${dot(m.f)}77` : "none", display: "block" }}>
                  <Face persona={{ name: m.host, gender: m.gender, seed: faceSeedFor(m) }} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: "#eef4f8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 84 }}>{m.host}</span>
              </button>
            ))}
            {realOthers.map((h) => (
              <div key={h.handle} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 4 }}>
                <span style={{ width: 64, height: 64, borderRadius: "50%", background: `${h.color}22`, border: `1.5px solid ${h.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: h.color, fontWeight: 700 }}>{h.handle.slice(0, 1).toUpperCase()}</span>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: h.color, maxWidth: 84, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.handle} · real</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {vibeEdit && pro && (
        <div style={{ position: "absolute", inset: 0, zIndex: 26, background: "rgba(4,6,12,.82)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: "min(88vw, 400px)", background: "#0f1622", border: ".5px solid rgba(150,120,255,.4)", borderRadius: 18, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: "#c7b3ff" }}>pro · set the room vibe</div>
            <div style={{ fontSize: 14, color: "#cdd9e3", margin: "8px 0 14px", lineHeight: 1.5 }}>set the mood and the whole room follows it.</div>
            <input value={vibe} onChange={(e) => setVibe(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") setVibeEdit(false) }} autoFocus placeholder="e.g. roast each other · deep and honest · hype" style={{ width: "100%", fontSize: 16, color: "#eef4f8", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.2)", borderRadius: 12, padding: "12px 14px", minHeight: 46, boxSizing: "border-box", outline: "none" }} />
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
