"use client"

/**
 * THE ROOM — one big conversation that is always happening, and the door into
 * every private one.
 *
 * The floor used to open on a swipe deck: one stranger, alone, and a decision to
 * make about her before anything has happened. That asks a visitor to commit
 * before the product has shown them anything. A room asks nothing — people are
 * already talking, you read for ten seconds, and the thing you came for is
 * visible immediately instead of promised.
 *
 * TAPPING SOMEONE IS THE WHOLE POINT. Their card opens: who they are, what they
 * do, what is on their mind tonight — and one button that peels them off into a
 * private conversation. The public room is what makes you want someone; the
 * private thread is the product. That is the funnel, and it is the same shape
 * as every place people actually meet each other.
 *
 * ── TEXT, NOT VOICE, AND THAT IS A COST DECISION ────────────────────────────
 *
 * GroupRoom is the voice version and it is expensive: every line is a TTS
 * request, so a room left open burns credit whether or not anyone is reading.
 * This room is text. A line costs LLM tokens and nothing else, which makes it
 * affordable to leave running as the front page — and voice stays where it is
 * worth paying for, in the private call.
 *
 * Everything below that looks like caution is about the same thing: a room that
 * generates while nobody is watching is a bill with no reader. So it stops when
 * the tab is hidden, never has two requests in flight, and pauses when someone
 * opens a card.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { groupCast, faceSeedFor, type Cluster } from "@/lib/airroom/roster"
import { dossierLine, cardLinesFor, dossierForSeed } from "@/lib/airraw/dossier"
import { getLangPrefs } from "@/lib/airraw/lang-prefs"
import { getProToken } from "@/lib/airroom/pro"
import { Face } from "@/components/airroom/Face"

/** Heat → the colour a person is drawn in, same gradient as the rest of the floor. */
const dot = (f: number) => `hsl(${Math.round(320 - f * 300)},85%,${58 + f * 6}%)`

interface Line { who: Cluster; text: string; at: number }

/** How many people are in here. Enough to feel like a room, few enough to follow. */
const CAST = 14
/** Lines kept on screen. Older ones are dropped — this is a room, not an archive. */
const MAX_LINES = 40
/**
 * Seconds between lines.
 *
 * Slow enough to read, and slow enough that an idle tab is not an expense. A
 * room that talks every second looks alive for a minute and then costs more than
 * it earns.
 */
const GAP_MS = 7000

export function TheRoom({ onPrivate, topic = "tonight" }: {
  /** Peel this person off into a private conversation. */
  onPrivate: (c: Cluster) => void
  topic?: string
}) {
  // One stable crowd per visit. groupCast is prefix-stable (member i depends on i
  // alone), so the same seed always builds the same room in the same order.
  const seed = useMemo(() => Math.floor(Date.now() / 3_600_000), [])
  const cast = useMemo(() => groupCast(seed, 0.5, CAST), [seed])

  const [lines, setLines] = useState<Line[]>([])
  const [open, setOpen] = useState<Cluster | null>(null)   // whose card is showing
  const scroller = useRef<HTMLDivElement | null>(null)
  const busy = useRef(false)
  const openRef = useRef(false)
  const linesRef = useRef<Line[]>([])

  useEffect(() => { linesRef.current = lines }, [lines])
  useEffect(() => { openRef.current = !!open }, [open])

  // ── the room talks ────────────────────────────────────────────────────────
  useEffect(() => {
    let stopped = false
    const ctrl = new AbortController()

    const speak = async () => {
      // Every reason not to spend a request, checked before spending it.
      if (stopped || busy.current) return
      if (typeof document !== "undefined" && document.hidden) return   // nobody is reading
      if (openRef.current) return                                       // reading a card, not the room
      busy.current = true
      try {
        // Whoever has said least recently gets the floor, so one character can't
        // monopolise a room that is meant to feel like several people.
        const recent = linesRef.current.slice(-5).map((l) => l.who.key)
        const eligible = cast.filter((c) => !recent.includes(c.key))
        const who = (eligible.length ? eligible : cast)[Math.floor(Math.random() * (eligible.length || cast.length))]
        const id = faceSeedFor(who) || who.host

        const prefs = getLangPrefs()
        const persona = {
          name: who.host,
          language: prefs.primary || "English",
          personality:
            `You are ${who.host}, in a busy late-night room on an adult floor where several people are talking at once. ` +
            `${dossierLine(id)} ` +
            `You are NOT talking to one person — you are in a room. Say ONE short line: react to what was just said, ` +
            `start something of your own, or answer someone by name. Never ask "how is everyone", never narrate the room.`,
          speakingStyle: "one line, lowercase, casual, like a real message in a group chat. under 18 words. no emoji spam, no stage directions.",
          backstory: "",
          seedKey: id,
        }

        // The room's recent history, attributed. Everyone else's lines arrive as
        // "user" turns tagged with a name so the model can answer a person rather
        // than replying into the void.
        const msgs = linesRef.current.slice(-10).map((l) =>
          l.who.key === who.key
            ? { role: "assistant" as const, content: l.text }
            : { role: "user" as const, content: `${l.who.host}: ${l.text}` },
        )
        if (!msgs.length) msgs.push({ role: "user" as const, content: `(the room is quiet — ${topic})` })

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ persona, proToken: getProToken(), messages: msgs }),
          signal: ctrl.signal,
        })
        if (!res.ok || !res.body) return
        let full = ""
        const rd = res.body.getReader()
        const dec = new TextDecoder()
        for (;;) {
          const { done, value } = await rd.read()
          if (done) break
          full += dec.decode(value)
          if (full.length > 400) { try { await rd.cancel() } catch { /* */ } break }
        }
        const text = full.replace(/^\s*[\w\s]{0,20}:\s*/, "").replace(/\s+/g, " ").trim().slice(0, 220)
        if (!text || stopped) return
        setLines((prev) => [...prev, { who, text, at: Date.now() }].slice(-MAX_LINES))
      } catch { /* a dropped line is not worth surfacing — the room just goes on */ }
      finally { busy.current = false }
    }

    speak()
    const id = setInterval(speak, GAP_MS)
    // Resume promptly when someone comes back, rather than waiting out the gap.
    const onVis = () => { if (!document.hidden) speak() }
    document.addEventListener("visibilitychange", onVis)
    return () => {
      stopped = true
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVis)
      ctrl.abort()
    }
  }, [cast, topic])

  // Follow the conversation, but only if the reader is already at the bottom —
  // yanking the view while someone is reading back is worse than a missed line.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (atBottom) el.scrollTop = el.scrollHeight
  }, [lines])

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* ── who is here ── a tappable strip, so the room has faces before it has
          said anything. This is the first thing a visitor sees and the reason
          they stay: fourteen people, not one card to judge. */}
      <div style={{ flexShrink: 0, padding: "10px 12px 8px", overflowX: "auto", display: "flex", gap: 10, WebkitOverflowScrolling: "touch" }}>
        {cast.map((c) => (
          <button
            key={c.key}
            onClick={() => setOpen(c)}
            aria-label={`open ${c.host}'s profile`}
            style={{ flexShrink: 0, width: 52, background: "none", border: "none", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
          >
            <span style={{ display: "block", width: 52, height: 52, borderRadius: "50%", overflow: "hidden", border: `1.5px solid ${dot(c.f)}66`, background: "#160f24" }}>
              <Face persona={{ name: c.host, gender: c.gender, seed: faceSeedFor(c) }} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </span>
            <span style={{ display: "block", fontSize: 10.5, color: "rgba(240,232,255,.55)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.host}</span>
          </button>
        ))}
      </div>

      {/* ── the conversation ── */}
      <div ref={scroller} style={{ flex: 1, overflowY: "auto", padding: "4px 12px 16px", WebkitOverflowScrolling: "touch" }}>
        {!lines.length && (
          <div style={{ color: "rgba(240,232,255,.3)", fontSize: 13, textAlign: "center", padding: "28px 0" }}>
            the room is waking up…
          </div>
        )}
        {lines.map((l, i) => (
          <div key={`${l.at}-${i}`} style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 11 }}>
            <button
              onClick={() => setOpen(l.who)}
              aria-label={`open ${l.who.host}'s profile`}
              style={{ flexShrink: 0, width: 30, height: 30, borderRadius: "50%", overflow: "hidden", border: `1px solid ${dot(l.who.f)}55`, background: "#160f24", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
            >
              <Face persona={{ name: l.who.host, gender: l.who.gender, seed: faceSeedFor(l.who) }} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </button>
            <div style={{ minWidth: 0 }}>
              <button
                onClick={() => setOpen(l.who)}
                style={{ fontSize: 12, fontWeight: 700, color: dot(l.who.f), background: "none", border: "none", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
              >
                {l.who.host}
              </button>
              <div style={{ fontSize: 14.5, lineHeight: 1.4, color: "#ece4f8" }}>{l.text}</div>
            </div>
          </div>
        ))}
      </div>

      {open && <ProfileCard c={open} onClose={() => setOpen(null)} onPrivate={onPrivate} />}
    </div>
  )
}

/**
 * WHO THIS PERSON IS — the card that turns a name in a room into someone you
 * want to talk to.
 *
 * Everything on it is already true of them: the dossier is what the character is
 * actually told about themselves (lib/airraw/dossier.ts), so the card cannot
 * promise a bartender and open a translator. It is drawn from the same seed as
 * the face and the accent, which is why they agree.
 */
function ProfileCard({ c, onClose, onPrivate }: { c: Cluster; onClose: () => void; onPrivate: (c: Cluster) => void }) {
  const id = faceSeedFor(c) || c.host
  const card = cardLinesFor(id)
  const d = dossierForSeed(id)
  const accent = dot(c.f)

  return (
    <div
      onClick={onClose}
      style={{ position: "absolute", inset: 0, zIndex: 40, background: "rgba(6,5,16,.82)", backdropFilter: "blur(12px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        // The bottom padding CLEARS THE DOCK, which is position:fixed and sits
        // over everything. A bottom sheet that stops at the safe-area inset
        // lands its last control underneath the dock — the same overlap that
        // twice put something on top of the call button. Reserve the dock's
        // height here rather than hand-tuning an offset that drifts.
        style={{ width: "100%", maxWidth: 460, background: "linear-gradient(180deg, rgba(26,20,42,.98), rgba(9,8,16,.98))", borderTop: `.5px solid ${accent}44`, borderRadius: "22px 22px 0 0", padding: "18px 18px calc(env(safe-area-inset-bottom) + 5.75rem)", color: "#eef4f8" }}
      >
        <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
          <span style={{ flexShrink: 0, width: 68, height: 68, borderRadius: "50%", overflow: "hidden", border: `1.5px solid ${accent}77`, background: "#160f24" }}>
            <Face persona={{ name: c.host, gender: c.gender, seed: id }} lazy={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: accent, fontWeight: 600 }}>{c.vibe}</div>
            <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1, marginTop: 2 }}>{c.host}</div>
            <div style={{ fontSize: 12.5, color: "rgba(240,232,255,.5)", marginTop: 3 }}>{card.work} · {card.where}</div>
          </div>
        </div>

        {/* The two facts that make her a person rather than a headshot. Her own
            words, not a bio written about her. */}
        <div style={{ marginTop: 15, display: "flex", flexDirection: "column", gap: 9 }}>
          <Fact label="tonight" text={d.onMind} accent={accent} />
          <Fact label="she'll argue" text={d.opinion} accent={accent} />
        </div>

        <button
          onClick={() => { onClose(); onPrivate(c) }}
          style={{ marginTop: 17, width: "100%", minHeight: 52, fontSize: 16, fontWeight: 700, color: "#180a20", background: accent, border: "none", borderRadius: 15, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          message {c.host} privately
        </button>
        <button
          onClick={onClose}
          style={{ marginTop: 8, width: "100%", minHeight: 42, fontSize: 13, color: "rgba(240,232,255,.45)", background: "transparent", border: ".5px solid rgba(255,255,255,.12)", borderRadius: 13, cursor: "pointer" }}
        >
          back to the room
        </button>
      </div>
    </div>
  )
}

function Fact({ label, text, accent }: { label: string; text: string; accent: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,.04)", border: ".5px solid rgba(255,255,255,.07)", borderRadius: 13, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: `${accent}bb`, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.4, color: "rgba(240,232,255,.82)", marginTop: 3 }}>{text}</div>
    </div>
  )
}
