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
 *
 * THE CHROME IS TWO PILLS. It used to be four floating things — a FAI count, a
 * language selector, a talks button and a full-width seats banner — stacked in
 * two rows over the top third of a photograph. Four controls competing with the
 * face is not a front door, it's a dashboard. Everything that is a SETTING now
 * lives behind the left pill; everything that is NEWS (seats opening) arrives as
 * a toast that leaves, exactly as a notification should.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { makeCharacter, pickForLanguages, type Cluster } from "@/lib/airroom/roster"
import { matchesPrefs } from "@/lib/airraw/lang-prefs"
import { cardLinesFor } from "@/lib/airraw/dossier"
import { earnFai, canEarnToday, DAILY_EARN_CAP, earnedToday } from "@/lib/airraw/fai"
import { liveTalks, seatsLeft } from "@/lib/airraw/talks"
import { Face } from "@/components/airroom/Face"

// Walk the whole soft→wild gradient rather than one band, so consecutive cards
// are different KINDS of person, not five variations on one mood.
//
// EVERY value must land in a DIFFERENT archetype, and between them they must
// cover all ten. The old walk didn't: its top value was 0.95, which falls inside
// BDSM's band [0.82, 0.96], and the roster takes the first band that matches —
// so "no limits · raw" [0.92, 1.00] was never once shown on the front door.
// The wildest tier in the product, the one the pass is largely for, was
// unreachable by swiping, while three others turned up twice as often as the
// rest. Nothing failed; it was simply invisible. roster-reach in the test suite
// now asserts all ten are hit.
//
// Twenty entries — each archetype twice, in two different orders — so the cycle
// of vibes is long enough not to read as a loop.
const F_WALK = [
  0.36, 0.79, 0.05, 0.58, 0.97, 0.25, 0.68, 0.46, 0.88, 0.15,
  0.68, 0.05, 0.88, 0.36, 0.15, 0.97, 0.46, 0.79, 0.25, 0.58,
]
const seedAt = (i: number) => ((i + 1) * 2654435761) >>> 0
const fAt = (i: number) => F_WALK[i % F_WALK.length]

const HEAT = (h: string) => (h === "w" ? "#c084fc" : h === "m" ? "#f472b6" : "#fb7185")

// A reward card lands every Nth swipe. 7 is far enough apart that it reads as a
// find rather than a slot machine, and close enough that a first session hits one.
const REWARD_EVERY = 7
const isReward = (i: number) => i > 0 && i % REWARD_EVERY === 0

export function FrontDoor({ onCall, onRooms, onEarned }: {
  onCall: (c: Cluster) => void
  /** The seats toast taps through to the talks board. */
  onRooms: () => void
  /** Fired after FAI is earned so the balance in the corner updates immediately. */
  onEarned?: () => void
}) {
  // A talk with room in it, surfaced while you're swiping. This is the "15 seats
  // open for a talk on …" moment: something is happening elsewhere and you can
  // still get in. Deliberately ONE, and only when there's real room — a banner
  // that's always there is wallpaper, and one advertising a full talk is a lie.
  const [nudge, setNudge] = useState<{ title: string; left: number } | null>(null)
  useEffect(() => {
    const pick = () => {
      const open = liveTalks().filter((t) => seatsLeft(t) >= 4)
      const best = open.sort((a, b) => seatsLeft(b) - seatsLeft(a))[0]
      setNudge(best ? { title: best.title, left: seatsLeft(best) } : null)
    }
    pick()
    const id = setInterval(pick, 25_000)
    return () => clearInterval(id)
  }, [])
  // The nudge is a NOTIFICATION, not furniture: it appears when a different talk
  // becomes the one worth knowing about, then leaves. A banner that is always
  // there is wallpaper — and it was eating a whole row of a photograph.
  const [nudgeOn, setNudgeOn] = useState(false)
  const shown = useRef<string | null>(null)
  useEffect(() => {
    if (!nudge) { setNudgeOn(false); return }
    if (shown.current === nudge.title) return
    shown.current = nudge.title
    setNudgeOn(true)
    const id = setTimeout(() => setNudgeOn(false), 9000)
    return () => clearTimeout(id)
  }, [nudge])

  const [i, setI] = useState(0)
  // Whether the real portrait has arrived. The fallback is a monogram card, which
  // reads fine as a small avatar and terribly as a full-screen letter — so it's
  // blurred back into texture until the photograph replaces it.
  const [live, setLive] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const reward = isReward(i)
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

  const go = () => { setLive(false); setClaimed(false); setI((n) => n + 1) }

  /**
   * Swiping UP on a reward card claims it. Any other direction skips it — the
   * AiR is offered, never forced, and a user who flicks past shouldn't be
   * silently credited for a card they didn't read.
   */
  const claim = () => {
    if (claimed || !canEarnToday()) return
    earnFai(1, "front-door reward card")
    setClaimed(true)
    onEarned?.()
  }

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
        // NOTE: the pointer is deliberately NOT captured here. Capturing on
        // pointerdown retargets every later event to this container, and the
        // browser then computes the click target from those — so no button
        // inside the card would ever be clicked again, "call" included. Capture
        // is taken in pointermove, once a real drag has begun.
        const c = cardRef.current; if (c) c.style.transition = "none"
      }}
      onPointerMove={(e) => {
        const s = swipe.current, c = cardRef.current
        if (!s || !c) return
        const dx = e.clientX - s.x, dy = e.clientY - s.y
        if (Math.hypot(dx, dy) > 10 && !dragged.current) {
          dragged.current = true
          // NOW capture — this is a drag, not a tap. Without it a swipe that
          // carries past the edge of the screen never delivers its pointerup and
          // the card freezes mid-drag, half transparent, with the deck stuck.
          try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* older browser */ }
        }
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
        const up = Math.abs(dy) > Math.abs(dx) && dy < 0
        if (reward && up) {
          claim()
          // Let the confirmation land before moving on, so the card isn't a
          // reward that vanishes before it's been read.
          setTimeout(() => fling("up"), 620)
          const c2 = cardRef.current
          if (c2) { c2.style.transition = "transform .3s ease"; c2.style.transform = "" ; c2.style.opacity = "1" }
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

      {reward ? (
        <div key={`r${i}`} ref={cardRef} style={{ position: "absolute", inset: 0, willChange: "transform, opacity", animation: "fdIn .4s ease both", background: "radial-gradient(120% 80% at 50% 35%, #123c33 0%, #0a1a18 55%, #07040f 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: "0 34px", textAlign: "center" }}>
          <div style={{ fontSize: 54, lineHeight: 1 }} aria-hidden>✦</div>
          <div style={{ fontSize: "clamp(26px, 8vw, 34px)", fontWeight: 600, color: "#eafff7", letterSpacing: -0.5, lineHeight: 1.15 }}>
            {claimed ? "that's yours" : "swipe up for a free FAI"}
          </div>
          <div style={{ fontSize: 14, color: "rgba(200,240,228,.7)", lineHeight: 1.5, maxWidth: "30ch" }}>
            {claimed
              ? "one seat, whenever you want it."
              : "FAI opens a seat in a talk. You get one every time you end a talk — this one's just a gift."}
          </div>
          {!claimed && (
            <div style={{ fontSize: 12, color: "rgba(200,240,228,.45)", marginTop: 4 }}>
              {canEarnToday() ? `${DAILY_EARN_CAP - earnedToday()} left to find today` : "that's all of today's"}
            </div>
          )}
          <div className="bottom-[calc(env(safe-area-inset-bottom)+6.25rem)] lg:bottom-[calc(env(safe-area-inset-bottom)+1.625rem)]" style={{ position: "absolute", left: 0, right: 0, fontSize: 12, color: "rgba(200,240,228,.4)" }}>
            {claimed ? "swipe on" : "↑ swipe up"}
          </div>
        </div>
      ) : (
      <div key={i} ref={cardRef} style={{ position: "absolute", inset: 0, willChange: "transform, opacity", animation: "fdIn .4s ease both" }}>
        <Face persona={{ name: person.host, gender: person.gender }} lazy={false} onLive={setLive}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block",
                   filter: live ? "none" : "blur(26px) saturate(1.3)",
                   // Lift the face out of the copy. The portraits are 3:4 and a
                   // phone is roughly 1:2, so `cover` crops the SIDES and shows
                   // the full height — which puts the subject's chin exactly
                   // where the name and the vibe land. Worse, the block grows
                   // when the character's line wraps to two, so on a real device
                   // the label ends up on their mouth. Scaling up and shifting
                   // up moves the face into the clear third of the screen and
                   // crops the shoulders instead, which are under the heaviest
                   // part of the scrim anyway.
                   transform: live ? "scale(1.12) translateY(-5%)" : "scale(1.15)",
                   transition: "filter .5s ease" }} />

        {/* Scrim, LIT BY WHO THEY ARE. Text on a photograph is unreadable without
            one, but a neutral black wash also makes every card identical — and
            with no portrait yet it makes them all the same grey blur. This one
            carries the character's own heat colour through the middle, so a card
            from the soft end of the floor is lilac-lit and one from the wild end
            burns red. It is the same gradient the whole product is built on,
            finally visible on the screen that matters. */}
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(7,4,15,.55) 0%, rgba(7,4,15,.04) 20%, ${accent}1c 38%, rgba(7,4,15,.42) 54%, rgba(7,4,15,.84) 68%, rgba(7,4,15,.97) 80%, #07040f 100%)` }} />

        {/* Grain. Photographs have it and flat gradients don't, which is most of
            why an un-loaded card reads as "broken image" rather than "portrait
            not here yet". Pure CSS — an inline SVG, no request. */}
        <div aria-hidden style={{ position: "absolute", inset: 0, opacity: live ? 0.16 : 0.3, mixBlendMode: "overlay", pointerEvents: "none",
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

        {/* THE HEAT RAIL — where this person sits on the soft→wild gradient, as a
            hairline down the edge of the screen with a bead at their position.
            The floor has always been a gradient from tender to wild; until now
            you could only feel it by swiping and hoping. Costs four pixels. */}
        <div aria-hidden style={{ position: "absolute", top: "18%", bottom: "34%", right: 0, width: 2, borderRadius: 2, background: "linear-gradient(180deg, #c084fc 0%, #f472b6 52%, #fb7185 100%)", opacity: .35 }} />
        <div aria-hidden style={{ position: "absolute", right: -2.5, top: `calc(18% + ${(person.f * 48).toFixed(1)}%)`, width: 7, height: 7, borderRadius: 999, background: accent, boxShadow: `0 0 12px 1px ${accent}`, transition: "top .45s cubic-bezier(.2,.9,.25,1.1)" }} />

        {/* Bottom padding clears the shell's dock on phones (the dock is a fixed
            overlay, so an absolutely-positioned card has to make room itself).
            On desktop the rail is a flex sibling and there is no bottom bar. */}
        <div
          className="px-[22px] pb-[calc(env(safe-area-inset-bottom)+5.75rem)] lg:mx-auto lg:max-w-2xl lg:pb-[calc(env(safe-area-inset-bottom)+1.375rem)]"
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", gap: 10, animation: "fdRise .45s ease both" }}
        >
          {nudgeOn && (
            <button
              onClick={() => { if (!dragged.current) onRooms() }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4, padding: "9px 12px", borderRadius: 14, background: "rgba(4,5,11,.82)", border: ".5px solid rgba(127,214,192,.34)", backdropFilter: "blur(10px)", cursor: "pointer", textAlign: "left", fontFamily: "inherit", WebkitTapHighlightColor: "transparent", animation: "fdRise .3s ease both" }}
            >
              <span style={{ flex: "0 0 auto", fontSize: 11, fontWeight: 800, letterSpacing: .6, color: "#06121e", background: "#7fd6c0", borderRadius: 6, padding: "3px 6px" }}>{nudge?.left} SEATS</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "#eafff7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nudge?.title}</span>
              <span style={{ flex: "0 0 auto", fontSize: 15, color: "rgba(234,255,247,.5)" }} aria-hidden>›</span>
            </button>
          )}

          {/* The vibe leads and the name lands under it — a masthead rather than
              a label trailing a heading. It also stops long vibes wrapping the
              name onto its own ragged second line. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: -2 }}>
            <span style={{ width: 14, height: 1.5, borderRadius: 2, background: accent, flex: "0 0 auto" }} aria-hidden />
            <span style={{ fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase", color: accent, fontWeight: 600 }}>{person.vibe}</span>
          </div>
          <div style={{ fontSize: "clamp(38px, 12vw, 56px)", fontWeight: 600, letterSpacing: -1.6, color: "#fbf7ff", lineHeight: .95 }}>{person.host}</div>

          {/* Who they are — the same facts they'll actually have in the call. */}
          <div style={{ fontSize: 13.5, color: "rgba(240,232,255,.72)", lineHeight: 1.45 }}>
            {card.work} · {card.where}
          </div>

          {/* Something they'd say. The reason to press call. */}
          {/* Two lines, hard. The stack is anchored to the bottom and grows
              upward, so an unbounded quote is an unbounded bite out of the
              portrait — and the lines vary in length by design. */}
          <div style={{ fontSize: 16.5, color: "#efe6ff", lineHeight: 1.4, fontStyle: "italic", maxWidth: "34ch",
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
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
      )}

      {/* NO HEADER. Nothing is pinned to the top of this screen at all.
          The last thing up there was a pill holding your FAI and your language,
          and both now live on the You tab — so it was a control that existed to
          duplicate a tab. What is left is the person, edge to edge, which is the
          only thing this screen is for. */}

      {/* The seats notification lives INSIDE the card's bottom stack — see below.
          Floated absolutely above the dock, it landed straight on top of the
          call button: the second time a fixed overlay has covered the one
          control this screen exists for. A flex column cannot overlap itself;
          geometry hand-tuned against two other absolutely-positioned things
          can, and did. */}

    </div>
  )
}
