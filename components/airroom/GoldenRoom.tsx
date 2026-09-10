"use client"

/**
 * THE GOLDEN ROOM.
 *
 * Not a place you go — a place you take someone TO. You arrive already mid
 * conversation with a person, and they come with you: same key, same face, same
 * voice, same thread. The guest is passed in and never re-derived here, because
 * the one failure that would make this worthless is paying eleven dollars and
 * finding a stranger in the room.
 *
 * It has to LOOK like eleven dollars, which is a different job from looking
 * good. The gold is doing real work: a deep near-black ground so the metal has
 * something to sit against, a three-stop gradient on every gold edge rather than
 * a flat yellow (flat yellow reads as a highlighter; the shift from pale to
 * amber to bronze is what reads as metal), an inner hairline on the panels, and
 * a slow ambient sheen that moves across the frame. Restrained everywhere else —
 * one accent, no confetti, no second colour.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { useT } from "@/lib/airraw/i18n"
import type { Cluster } from "@/lib/airroom/roster"
import { Face } from "@/components/airroom/Face"
import { faceSeedFor } from "@/lib/airroom/roster"
import { GOLDEN_GAMES, goldenLeftMs, goldenLabel, type GoldenSession } from "@/lib/airraw/golden"

const GOLD_PALE = "#f7e3a1"
const GOLD = "#e8c46a"
const GOLD_DEEP = "#a97c24"
const INK = "#0d0a04"

/** Metal, not highlighter: pale → gold → bronze across the edge. */
const METAL = `linear-gradient(135deg, ${GOLD_PALE} 0%, ${GOLD} 42%, ${GOLD_DEEP} 100%)`

const PANEL: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(232,196,106,.09) 0%, rgba(232,196,106,.03) 100%)",
  border: `.5px solid ${GOLD}44`,
  borderRadius: 16,
  boxShadow: `inset 0 1px 0 ${GOLD_PALE}22`,
}

export function GoldenRoom({
  guest, session, onLeave, onSay, lines, busy, timeLeftMs,
}: {
  guest: Cluster
  session: GoldenSession
  onLeave: () => void
  onSay: (text: string, gameId?: string) => void
  lines: Array<{ who: "you" | "host"; text: string; image?: string }>
  busy?: boolean
  timeLeftMs?: number
}) {
  const t = useT()
  const [draft, setDraft] = useState("")
  const [game, setGame] = useState<string | null>(session.game || null)
  const [left, setLeft] = useState(() => timeLeftMs ?? goldenLeftMs(session))
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const id = setInterval(() => setLeft(goldenLeftMs(session)), 20_000)
    return () => clearInterval(id)
  }, [session])
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }) }, [lines.length])

  // Explicit, and named so it reads as the identity it is — this seed is what
  // makes the person in the room the person you brought.
  const faceSeed = useMemo(() => faceSeedFor(guest) || guest.key, [guest])
  const send = () => {
    const t = draft.trim()
    if (!t || busy) return
    setDraft("")
    onSay(t, game || undefined)
  }

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", color: "#f6efe0", overflow: "hidden",
      background: `radial-gradient(120% 70% at 50% -10%, #2a1f0a 0%, #150f05 42%, ${INK} 100%)` }}>
      <style>{`
        @keyframes goldsheen { 0%{background-position:-140% 0} 100%{background-position:240% 0} }
        .goldsheen::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
          background:linear-gradient(105deg,transparent 38%,rgba(255,241,199,.16) 50%,transparent 62%);
          background-size:240% 100%;animation:goldsheen 7s linear infinite}
        @media (prefers-reduced-motion: reduce){.goldsheen::after{animation:none}}
      `}</style>

      {/* the frame — one gold hairline around the whole room, so it reads as a
          different place the moment it opens */}
      <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: 2, border: `1px solid ${GOLD}55`, pointerEvents: "none", zIndex: 5 }} />

      <header className="goldsheen" style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center", gap: 11,
        padding: "calc(env(safe-area-inset-top) + 12px) 14px 12px", borderBottom: `.5px solid ${GOLD}33`,
        background: "linear-gradient(180deg, rgba(232,196,106,.22), rgba(232,196,106,.04))", boxShadow: `0 12px 34px -20px ${GOLD}` }}>
        <button onClick={onLeave} aria-label={t("leave the golden room")}
          style={{ flex: "0 0 auto", width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,.06)",
            border: `.5px solid ${GOLD}44`, color: GOLD, fontSize: 17, cursor: "pointer", fontFamily: "inherit", lineHeight: 1 }}>‹</button>
        <span style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", flex: "0 0 auto", border: `1.5px solid ${GOLD}`, background: "#1a1408" }}>
          <Face persona={{ name: guest.host, gender: guest.gender, seed: faceSeed }} alt={guest.host}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontSize: 15.5, fontWeight: 700, letterSpacing: -.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{guest.host}</span>
          <span style={{ display: "block", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase",
            background: METAL, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", fontWeight: 700 }}>{t("the golden room")}</span>
        </span>
        <span style={{ flex: "0 0 auto", fontSize: 11.5, color: `${GOLD}cc`, fontVariantNumeric: "tabular-nums" }}>{goldenLabel(left)}</span>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 6px", display: "grid", gap: 10, alignContent: "start" }}>
        {lines.length === 0 && (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "rgba(246,239,224,.55)" }}>
            you brought {guest.host} in here. {guest.gender === "male" ? "he" : "she"} knows.
            <br />{t("pick something below, or just carry on.")}
          </p>
        )}
        {lines.map((l, i) => (
          <div key={i} style={{ display: "flex", justifyContent: l.who === "you" ? "flex-end" : "flex-start" }}>
            <span style={{ maxWidth: "84%", padding: "10px 14px", borderRadius: 15, fontSize: 15.5, lineHeight: 1.45,
              background: l.who === "you" ? `${GOLD}26` : "linear-gradient(180deg, rgba(232,196,106,.10), rgba(232,196,106,.04))",
              border: `.5px solid ${l.who === "you" ? `${GOLD}66` : `${GOLD}30`}`, boxShadow: `inset 0 1px 0 ${GOLD_PALE}18` }}>
              {l.image
                ? <img src={l.image} alt={`from ${guest.host}`} style={{ display: "block", maxWidth: "100%", borderRadius: 10 }} />
                : l.text}
            </span>
          </div>
        ))}
        {busy && <span style={{ fontSize: 13, color: `${GOLD}99` }}>…</span>}
        <div ref={endRef} />
      </div>

      {/* the four games — a shape for the talking, never a second screen */}
      <div style={{ flexShrink: 0, display: "flex", gap: 7, overflowX: "auto", padding: "4px 14px 8px", WebkitOverflowScrolling: "touch" }}>
        {GOLDEN_GAMES.map((g) => {
          const on = game === g.id
          return (
            <button key={g.id} onClick={() => setGame(on ? null : g.id)} aria-pressed={on}
              aria-label={on ? `stop playing ${g.name}` : `play ${g.name} — ${g.blurb}`}
              style={{ flex: "0 0 auto", maxWidth: 190, textAlign: "left", padding: "8px 11px", borderRadius: 12, cursor: "pointer",
                background: on ? METAL : "linear-gradient(180deg, rgba(232,196,106,.12), rgba(232,196,106,.03))", border: `.5px solid ${on ? GOLD : `${GOLD}44`}`, boxShadow: on ? `0 6px 18px -8px ${GOLD}` : `inset 0 1px 0 ${GOLD_PALE}18`,
                color: on ? INK : "rgba(246,239,224,.85)", fontFamily: "inherit", WebkitTapHighlightColor: "transparent" }}>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 700 }}>{g.name}</span>
              <span style={{ display: "block", fontSize: 10.5, marginTop: 2, opacity: on ? .75 : .5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.blurb}</span>
            </button>
          )
        })}
      </div>

      <div style={{ flexShrink: 0, display: "flex", gap: 8, alignItems: "center", padding: "0 14px calc(env(safe-area-inset-bottom) + 12px)" }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send() }}
          placeholder={game ? `${GOLDEN_GAMES.find((g) => g.id === game)?.name}…` : `say something to ${guest.host.toLowerCase()}`}
          aria-label={t("say something in the golden room")}
          style={{ flex: 1, minWidth: 0, minHeight: 46, borderRadius: 13, padding: "0 14px", fontSize: 16, color: "#f6efe0",
            background: "rgba(255,255,255,.05)", border: `.5px solid ${GOLD}55`, outline: "none", fontFamily: "inherit", boxShadow: `inset 0 1px 0 ${GOLD_PALE}14` }} />
        <button onClick={send} disabled={busy || !draft.trim()} aria-label={t("send")}
          style={{ flex: "0 0 auto", minHeight: 46, padding: "0 18px", borderRadius: 13, border: "none", cursor: "pointer",
            background: METAL, color: INK, fontSize: 15, fontWeight: 800, fontFamily: "inherit", boxShadow: `0 8px 22px -10px ${GOLD}`,
            opacity: busy || !draft.trim() ? .45 : 1 }}>↑</button>
      </div>
    </div>
  )
}

export { PANEL as GOLDEN_PANEL, METAL as GOLDEN_METAL, GOLD, GOLD_PALE, GOLD_DEEP, INK as GOLDEN_INK }
