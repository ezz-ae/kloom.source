"use client"

/**
 * THE SCENE — a cast the user chose, talking.
 *
 * ── WHY THERE IS NO NEW ENDPOINT ─────────────────────────────────────────────
 *
 * /api/chat already speaks multi-character: `persona` is whoever is talking,
 * `partners` is everyone else in the room, `relationship` lands in the prompt as
 * THE SCENE. A scene differs from the floor's rooms only in who is in it and who
 * decided that, so it rides the same route — which means the intent gate and the
 * FLOOR apply here exactly as they do everywhere else, rather than this tab
 * needing its own copy of a safety boundary that could drift out of sync.
 *
 * ── ONE SPEAKER PER TURN, DECIDED HERE ───────────────────────────────────────
 *
 * The model is told to write one line as one person, and the client decides
 * which person that is. That is what makes "in turns" and "you choose" real
 * controls rather than a request the model can ignore: a quiet member is never
 * sent as `persona`, so they cannot speak even if the model would like them to.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { composeScene, castFor, fantasyById, roleById, type SceneConfig } from "@/lib/airraw/fantasy"
import { dossierLine } from "@/lib/airraw/dossier"
import { faceSeedFor, type Cluster } from "@/lib/airroom/roster"
import { getProToken } from "@/lib/airroom/pro"
import { getLangPrefs } from "@/lib/airraw/lang-prefs"
import { pinnedVoice, pinFromResponse, awaitPin, claimFirst } from "@/lib/airraw/voice-pin"
import { visitorId } from "@/lib/airraw/visitor"
import { track } from "@/lib/track"

const ACCENT = "#f472b6"
const HEAT: Record<string, string> = { w: "#c084fc", m: "#f472b6", f: "#fb7185" }

interface Line {
  who: number | null
  text: string
  at: number
  /** Set only when the scene is being recorded — see `speak`. */
  audio?: string
}

export function SceneRoom({ cfg, onClose, onPass }: { cfg: SceneConfig; onClose: () => void; onPass: () => void }) {
  // One seed per scene, fixed for its lifetime: the cast must not change under
  // the user between turns.
  const [seed] = useState(() => (Date.now() / 1000) | 0)
  const cast = useMemo(() => castFor(cfg, seed), [cfg, seed])
  const names = useMemo(() => {
    const out: Record<string, string> = {}
    cfg.cast.forEach((m, i) => { out[m.id] = cast[i]?.host || "someone" })
    return out
  }, [cfg, cast])
  const scene = useMemo(() => composeScene(cfg, names), [cfg, names])
  const fantasy = fantasyById(cfg.fantasyId)

  const [lines, setLines] = useState<Line[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  const [muted, setMuted] = useState(false)
  const linesRef = useRef<Line[]>([])
  const turnRef = useRef(0)
  const endRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mutedRef = useRef(false)
  useEffect(() => { mutedRef.current = muted }, [muted])

  // Who is allowed to talk. A quiet member is in the scene and out of the rota.
  const speakers = useMemo(
    () => cfg.cast.map((m, i) => ({ m, i })).filter(({ m }) => !m.quiet),
    [cfg],
  )

  useEffect(() => { linesRef.current = lines }, [lines])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }) }, [lines])

  // Keep the transcript only if they asked for it. Off means nothing is written.
  useEffect(() => {
    if (!cfg.save || lines.length === 0) return
    try {
      localStorage.setItem("airraw_scene_last", JSON.stringify({
        at: Date.now(), fantasy: cfg.fantasyId, cast: cfg.cast, lines: lines.slice(-120),
      }))
    } catch { /* a full quota is not worth an error in a scene */ }
  }, [lines, cfg])

  const personaFor = (c: Cluster, slot: number) => {
    const m = cfg.cast[slot]
    const role = roleById(m?.roleId || "")
    return {
      name: c.host,
      personality:
        `You are ${c.host}. ${role ? `In this scene you are ${role.line}. ` : ""}` +
        `${dossierLine(c.key || c.host)} You want things and you say so out loud.`,
      speakingStyle: "raw, intimate, unhurried — short fragments, direct, natural. never formal, never robotic.",
      backstory: `Part of this scene by choice.`,
      seedKey: faceSeedFor(c) || c.host,
      barTalk: 100,
    }
  }

  /** Whose turn it is, by the mode the user picked. */
  const nextSpeaker = (): number | null => {
    if (speakers.length === 0) return null
    if (cfg.turnMode === "random") return speakers[Math.floor(Math.random() * speakers.length)].i
    // "turns" walks the rota; "director" never auto-picks — the user names them.
    if (cfg.turnMode === "turns") { const s = speakers[turnRef.current % speakers.length]; turnRef.current++; return s.i }
    return null
  }

  /**
   * Say a line out loud in that character's own voice.
   *
   * Voice PINNING is the point of the ceremony here: the first request for a
   * given person claims a voice and every later one reuses it, so a character
   * does not change voice halfway through a scene. It is the same helper the
   * floor's rooms use, which is why a person cast here sounds like the same
   * person if you meet them anywhere else.
   *
   * Failure is silent and returns nothing. A scene whose words arrived is still
   * a scene; stopping it because a voice did not is the worse outcome.
   */
  const speak = async (c: Cluster, text: string): Promise<string | null> => {
    if (mutedRef.current) return null
    try {
      const who = faceSeedFor(c) || c.host
      const lang = getLangPrefs().primary || "English"
      await awaitPin(who, lang)
      const req = fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, personaName: c.host, seedKey: who, gender: c.gender, language: lang, voiceId: c.voiceId, elevenId: pinnedVoice(who, lang), proToken: getProToken(), visitorId: visitorId(), mode: "voice" }),
      })
      claimFirst(who, lang, req)
      const res = await req
      if (!res.ok) return null
      pinFromResponse(who, lang, res)
      const url = URL.createObjectURL(await res.blob())
      const a = audioRef.current
      if (a) { a.src = url; a.play().catch(() => { /* a refused autoplay is not an error worth stopping for */ }) }
      // Recording is the ONLY reason to hold on to the object URL. Without it the
      // clip is revoked once it has played, because a scene that runs for an hour
      // would otherwise pin every clip it ever spoke in memory.
      if (cfg.record) return url
      setTimeout(() => { try { URL.revokeObjectURL(url) } catch { /* */ } }, 60_000)
      return null
    } catch { return null }
  }

  const say = async (slot: number, history: Line[]) => {
    const c = cast[slot]
    if (!c) return
    setBusy(true)
    try {
      const others = cast.map((o, i) => (i === slot ? null : personaFor(o, i))).filter(Boolean)
      // Multi-speaker history has to carry WHO said each line or the model loses
      // track of the room; the route expects the client to have prefixed them.
      const msgs = history.map((l) => l.who === null
        ? { role: "user", content: l.text }
        : { role: "assistant", content: cast.length > 1 ? `${cast[l.who]?.host}: ${l.text}` : l.text })
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona: personaFor(c, slot), partners: others, relationship: scene, proToken: getProToken(), messages: msgs }),
      })
      const raw = (await res.text()).trim()
      // Strip a name prefix if the model added one — attribution is the client's job.
      const text = raw.replace(new RegExp(`^${c.host}\\s*:\\s*`, "i"), "").trim()
      if (!text) return
      const at = Date.now()
      setLines((ls) => [...ls, { who: slot, text, at }])
      track("scene_line")
      const audio = await speak(c, text)
      if (audio) setLines((ls) => ls.map((l) => (l.at === at && l.who === slot ? { ...l, audio } : l)))
    } catch { setNote("that didn't come through — try again.") ; setTimeout(() => setNote(""), 4000) }
    finally { setBusy(false) }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput("")
    const next = [...linesRef.current, { who: null, text, at: Date.now() }]
    setLines(next)
    const slot = nextSpeaker()
    if (slot === null) return   // director mode: nobody speaks until named
    await say(slot, next)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", color: "#f0e8ff" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 11, padding: "4px 0 14px", borderBottom: ".5px solid rgba(255,255,255,.09)" }}>
        <button onClick={onClose} aria-label="leave the scene" style={{ background: "none", border: "none", color: "rgba(240,232,255,.6)", fontSize: 22, cursor: "pointer", padding: "2px 4px" }}>‹</button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fantasy?.label || "a scene"}</div>
          <div style={{ fontSize: 12, color: "rgba(240,232,255,.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {cast.map((c) => c.host).join(" · ")}{cfg.save ? "" : " · not saved"}
          </div>
        </div>
        <button onClick={() => setMuted((v) => !v)} aria-pressed={muted} aria-label={muted ? "turn the voices on" : "turn the voices off"}
          style={{ flex: "0 0 auto", width: 40, height: 40, borderRadius: "50%", fontSize: 17, cursor: "pointer",
            background: muted ? "rgba(255,255,255,.06)" : `${ACCENT}22`, color: muted ? "rgba(240,232,255,.5)" : ACCENT,
            border: ".5px solid rgba(255,255,255,.12)", fontFamily: "inherit" }}>{muted ? "🔇" : "🔊"}</button>
      </header>

      <audio ref={audioRef} style={{ display: "none" }} />

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 0", display: "grid", gap: 11, alignContent: "start" }}>
        {lines.length === 0 && (
          <p style={{ fontSize: 14, color: "rgba(240,232,255,.45)", lineHeight: 1.6, margin: 0 }}>
            {fantasy?.scene} <br /><br />Say something, and it starts.
          </p>
        )}
        {lines.map((l, k) => {
          const c = l.who === null ? null : cast[l.who]
          const col = c ? HEAT[c.h] || ACCENT : ACCENT
          return (
            <div key={`${l.at}-${k}`} style={{ display: "flex", gap: 9, justifyContent: l.who === null ? "flex-end" : "flex-start" }}>
              {c && cfg.attribution === "face" && (
                <span aria-hidden style={{ width: 30, height: 30, flex: "0 0 auto", borderRadius: "50%", marginTop: 2, background: `radial-gradient(circle at 32% 28%, ${col}, ${col}22 70%, transparent)` }} />
              )}
              <div style={{ maxWidth: "82%", padding: "10px 14px", borderRadius: 15, fontSize: 15.5, lineHeight: 1.45,
                background: l.who === null ? `${ACCENT}22` : "rgba(255,255,255,.06)", border: `.5px solid ${l.who === null ? ACCENT + "44" : "rgba(255,255,255,.1)"}` }}>
                {l.text}
                {c && cfg.attribution === "name" && (
                  <span style={{ display: "block", fontSize: 11.5, color: col, marginTop: 5, letterSpacing: .3 }}>— {c.host.toLowerCase()}</span>
                )}
                {l.audio && (
                  <button onClick={() => { const a = audioRef.current; if (a) { a.src = l.audio!; a.play().catch(() => { /* */ }) } }}
                    aria-label={`play ${c?.host || "that"} again`}
                    style={{ marginTop: 6, background: "none", border: "none", color: col, fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>▶ play again</button>
                )}
              </div>
            </div>
          )
        })}
        {busy && <div style={{ fontSize: 13, color: "rgba(240,232,255,.4)" }}>…</div>}
        {note && <div style={{ fontSize: 13, color: ACCENT }}>{note}</div>}
        <div ref={endRef} />
      </div>

      {/* Director mode: nobody speaks unless the user names them. The same row
          doubles as a nudge in the other modes, so any member can be pulled in. */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "8px 0" }}>
        {speakers.map(({ i }) => (
          <button key={i} disabled={busy} onClick={() => say(i, linesRef.current)}
            style={{ flex: "0 0 auto", padding: "7px 12px", borderRadius: 999, fontSize: 13, cursor: busy ? "default" : "pointer", fontFamily: "inherit",
              background: "rgba(255,255,255,.06)", color: HEAT[cast[i]?.h || "m"] || ACCENT, border: ".5px solid rgba(255,255,255,.1)", opacity: busy ? .5 : 1 }}>
            {cfg.turnMode === "director" ? cast[i]?.host : `${cast[i]?.host}?`}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 9, paddingBottom: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send() }}
          placeholder="say something…" aria-label="say something in the scene"
          style={{ flex: 1, padding: "13px 15px", borderRadius: 14, background: "rgba(255,255,255,.06)", color: "#f0e8ff",
            border: ".5px solid rgba(255,255,255,.11)", fontSize: 16, fontFamily: "inherit", outline: "none", minWidth: 0 }} />
        <button onClick={send} disabled={busy || !input.trim()} aria-label="send"
          style={{ flex: "0 0 auto", padding: "0 20px", borderRadius: 14, background: ACCENT, color: "#0d0418", fontSize: 15, fontWeight: 700,
            border: "none", cursor: "pointer", fontFamily: "inherit", opacity: busy || !input.trim() ? .5 : 1 }}>send</button>
      </div>
    </div>
  )
}
