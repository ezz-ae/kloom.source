"use client"

/**
 * THE FRONT DOOR — one person, full screen. Swipe for the next. Tap to call.
 *
 * What it replaces: a deck of ROOMS ("A ROOFTOP, LATE — someone's birthday — 18
 * in here"). That sold a venue, when the thing worth selling is a person. The
 * faces, accents, voices and inner lives all belong to individuals, and the
 * first screen never showed you one.
 *
 * Swiping moves on; it never calls. Tinder's swipe-to-like is muscle memory, and
 * borrowing it for "start a voice call" would place calls by accident all day.
 * Passing is cheap and reversible, so the gesture does that; calling costs
 * minutes and attention, so it takes a deliberate tap.
 */
import { useMemo, useRef, useState } from "react"
import { makeCharacter, pickForLanguages, type Cluster } from "@/lib/airroom/roster"
import { matchesPrefs } from "@/lib/airraw/lang-prefs"
import { cardLinesFor } from "@/lib/airraw/dossier"
import { Face } from "@/components/airroom/Face"

// Walk the whole soft→wild gradient rather than one band, so consecutive cards
// are different KINDS of person, not five variations on one mood.
const F_WALK = [0.34, 0.72, 0.12, 0.55, 0.88, 0.26, 0.63, 0.44, 0.95, 0.18, 0.79, 0.5]
const seedAt = (i: number) => ((i + 1) * 2654435761) >>> 0
const fAt = (i: number) => F_WALK[i % F_WALK.length]

const HEAT = (h: string) => (h === "w" ? "#c084fc" : h === "m" ? "#f472b6" : "#fb7185")

export function FrontDoor({ onCall, onRooms, air, onProfile }: {
  onCall: (c: Cluster) => void
  onRooms: () => void
  air: string
  onProfile: () => void
}) {
  const [i, setI] = useState(0)
  // Whether the real portrait has arrived. The fallback is a monogram card, which
  // reads fine as a small avatar and terribly as a full-screen letter — so it's
  // blurred back into texture until the photograph replaces it.
  const [live, setLive] = useState(false)
  const [dir, setDir] = useState<"up" | "left">("up")
  const cardRef = useRef<HTMLDivElement | null>(null)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const dragged = useRef(false)

  // Deterministic, and language-steered for Pro. Two cards are pre-resolved so
  // the next portrait is already being fetched while this one is on screen —
  // otherwise every swipe lands on a monogram for a second.
  const person = useMemo(() => pickForLanguages(seedAt(i), fAt(i), matchesPrefs), [i])
  const next = useMemo(() => pickForLanguages(seedAt(i + 1), fAt(i + 1), matchesPrefs), [i])

  const accent = HEAT(person.h)
  const card = cardLinesFor(person.key)

  const go = () => { setLive(false); setI((n) => n + 1) }

  const fling = (d: "up" | "left") => {
    setDir(d)
    const c = cardRef.current
    if (c) {
      c.style.transition = "transform .18s ease-in, opacity .18s ease-in"
      c.style.transform = d === "up" ? "translateY(-60vh) scale(.94)" : "translateX(-70vw) rotate(-8deg)"
      c.style.opacity = "0"
    }
    setTimeout(go, 130)
  }

  return (
    <div
      style={{ position: "absolute", inset: 0, zIndex: 18, overflow: "hidden", background: "#07040f", touchAction: "none", fontFamily: "var(--font-geist), system-ui, sans-serif" }}
      onPointerDown={(e) => {
        swipe.current = { x: e.clientX, y: e.clientY }; dragged.current = false
        // Capture the pointer, or a swipe that carries past the edge of the screen
        // never delivers its pointerup here — the card freezes mid-drag, half
        // transparent, and the deck is stuck. Easy to hit: a fast flick from the
        // middle of a phone screen leaves the viewport well before it ends.
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* older browser */ }
        const c = cardRef.current; if (c) c.style.transition = "none"
      }}
      onPointerMove={(e) => {
        const s = swipe.current, c = cardRef.current
        if (!s || !c) return
        const dx = e.clientX - s.x, dy = e.clientY - s.y
        if (Math.hypot(dx, dy) > 10) dragged.current = true
        c.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 26}deg)`
        c.style.opacity = String(Math.max(0.5, 1 - Math.hypot(dx, dy) / 700))
      }}
      onPointerUp={(e) => {
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* */ }
        const s = swipe.current; swipe.current = null
        const c = cardRef.current
        if (!s || !c) return
        const dx = e.clientX - s.x, dy = e.clientY - s.y
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 70) {
          c.style.transition = "transform .34s cubic-bezier(.2,.9,.25,1.15), opacity .3s ease"
          c.style.transform = ""; c.style.opacity = ""
          return
        }
        fling(Math.abs(dy) > Math.abs(dx) ? "up" : "left")
      }}
      onPointerCancel={() => {
        swipe.current = null
        const c = cardRef.current
        if (c) { c.style.transition = "transform .3s ease"; c.style.transform = ""; c.style.opacity = "" }
      }}
    >
      <style>{`
        @keyframes fdIn{from{opacity:0;transform:scale(1.04)}to{opacity:1;transform:none}}
        @keyframes fdRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
      `}</style>

      {/* the NEXT person, underneath — so a swipe reveals a face, not a black hole */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.5 }} aria-hidden>
        <Face persona={{ name: next.host, gender: next.gender }} lazy={false}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "brightness(.5)" }} />
      </div>

      <div key={i} ref={cardRef} style={{ position: "absolute", inset: 0, willChange: "transform, opacity", animation: "fdIn .4s ease both" }}>
        <Face persona={{ name: person.host, gender: person.gender }} lazy={false} onLive={setLive}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block",
                   filter: live ? "none" : "blur(26px) saturate(1.3)", transform: live ? "none" : "scale(1.15)",
                   transition: "filter .5s ease" }} />

        {/* Scrim: the portraits are photographs and text on them is unreadable
            without one. Heavy at the bottom where the words are, clear at the top
            so the face still reads as a face. */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(7,4,15,.55) 0%, rgba(7,4,15,0) 26%, rgba(7,4,15,.18) 52%, rgba(7,4,15,.88) 82%, #07040f 100%)" }} />

        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 22px calc(env(safe-area-inset-bottom) + 22px)", display: "flex", flexDirection: "column", gap: 10, animation: "fdRise .45s ease both" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: "clamp(30px, 9vw, 42px)", fontWeight: 600, letterSpacing: -0.8, color: "#f6f1ff", lineHeight: 1 }}>{person.host}</span>
            <span style={{ fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", color: accent }}>{person.vibe}</span>
          </div>

          {/* Who they are — the same facts they'll actually have in the call. */}
          <div style={{ fontSize: 13.5, color: "rgba(240,232,255,.72)", lineHeight: 1.45 }}>
            {card.work} · {card.where}
          </div>

          {/* Something they'd say. The reason to press call. */}
          <div style={{ fontSize: 16.5, color: "#efe6ff", lineHeight: 1.4, fontStyle: "italic", maxWidth: "34ch" }}>
            &ldquo;{person.lines[0]}&rdquo;
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
            <button
              onClick={() => { if (!dragged.current) onCall(person) }}
              style={{ flex: 1, minHeight: 58, borderRadius: 999, border: "none", cursor: "pointer", fontSize: 17, fontWeight: 700, letterSpacing: .3, color: "#150a1f", background: `linear-gradient(180deg, ${accent}, ${accent}cc)`, boxShadow: `0 14px 40px -14px ${accent}`, WebkitTapHighlightColor: "transparent", touchAction: "manipulation", fontFamily: "inherit" }}
            >
              call {person.host}
            </button>
            <button
              onClick={() => { if (!dragged.current) fling("left") }}
              aria-label="someone else"
              style={{ flex: "0 0 auto", width: 58, height: 58, borderRadius: 999, cursor: "pointer", fontSize: 20, color: "rgba(240,232,255,.6)", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.14)", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              ›
            </button>
          </div>

          <div style={{ textAlign: "center", fontSize: 11.5, color: "rgba(240,232,255,.34)", marginTop: 2 }}>
            swipe for someone else
          </div>
        </div>
      </div>

      {/* Quiet corners: credits, and the way through to rooms. */}
      <button onClick={onProfile} aria-label="you"
        style={{ position: "absolute", top: "calc(env(safe-area-inset-top) + 12px)", left: 14, zIndex: 24, minHeight: 34, padding: "0 13px", fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#7fd6c0", background: "rgba(4,5,11,.5)", border: ".5px solid rgba(127,214,192,.35)", borderRadius: 999, cursor: "pointer", WebkitTapHighlightColor: "transparent", fontFamily: "inherit" }}>
        {air} AiR
      </button>
      <button onClick={onRooms} aria-label="rooms with more than one person"
        style={{ position: "absolute", top: "calc(env(safe-area-inset-top) + 12px)", right: 14, zIndex: 24, minHeight: 34, padding: "0 13px", fontSize: 12, fontWeight: 600, color: "rgba(240,232,255,.7)", background: "rgba(4,5,11,.5)", border: ".5px solid rgba(255,255,255,.16)", borderRadius: 999, cursor: "pointer", WebkitTapHighlightColor: "transparent", fontFamily: "inherit" }}>
        rooms
      </button>
    </div>
  )
}
