"use client"

/**
 * TALKS — rooms that are happening, not rooms that exist.
 *
 * A board of live talks: a title you want to be inside, seats that fill on their
 * own, and a cost of one FAI to take one. You can also start your own and set
 * how many seats it has.
 *
 * The seat cost is the point. FAI can't be bought (lib/airraw/fai.ts) — it comes
 * from finishing talks — so a seat is always paid for with a conversation you
 * actually had. That is what stops this being a list of chat rooms.
 */
import { useEffect, useMemo, useState } from "react"
import { liveTalks, seatsLeft, ageLabel, talkRoom, heatF, type Talk, type TalkRoom } from "@/lib/airraw/talks"
import { getFai, spendFai, canAfford } from "@/lib/airraw/fai"
import { groupCast } from "@/lib/airroom/roster"
import { Face } from "@/components/airroom/Face"

const HEAT = (h: string) => (h === "w" ? "#c084fc" : h === "m" ? "#f472b6" : "#fb7185")

// How many faces a card shows before it collapses to "+N". Four is enough to
// read as a crowd and few enough that four cards don't turn the board into a
// wall of circles — the title is still the thing being sold.
const SHOWN = 4

/**
 * Who is already in there.
 *
 * A row of numbers ("9 in") states a fact; four faces make it a room you are
 * late to. These are the REAL cast — the same people groupCast() hands the room
 * when you take a seat — so the faces on the card are the voices you meet.
 */
function Who({ t }: { t: Talk }) {
  const room = talkRoom(t)
  const cast = useMemo(() => groupCast(room.seed, room.f, room.count).slice(0, SHOWN), [room.seed, room.f, room.count])
  const more = Math.max(0, t.taken - cast.length)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ display: "flex" }}>
        {cast.map((m, i) => (
          <span key={m.key} style={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", display: "block", marginLeft: i ? -8 : 0, border: ".5px solid rgba(255,255,255,.22)", boxShadow: "0 2px 8px -2px rgba(0,0,0,.7)", background: "#160f24", zIndex: SHOWN - i }}>
            <Face persona={{ name: m.host, gender: m.gender }} alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </span>
        ))}
      </div>
      {more > 0 && (
        <span style={{ fontSize: 11, color: "rgba(240,232,255,.45)", fontVariantNumeric: "tabular-nums" }}>+{more}</span>
      )}
    </div>
  )
}

export function Talks({ onJoin, onBack, onSpent }: {
  /** The room to open, already resolved by talkRoom() so nothing recomputes it. */
  onJoin: (r: TalkRoom) => void
  onBack: () => void
  onSpent: () => void
}) {
  // Re-derive on a timer: the board is a function of the clock, so seats fill and
  // talks turn over while you're looking at it. That movement IS the feature —
  // a static list is the furniture this replaces.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])
  const talks = useMemo(() => liveTalks(now), [now])

  const [fai, setFaiState] = useState(0)
  useEffect(() => { setFaiState(getFai()) }, [])

  const [making, setMaking] = useState(false)
  const [title, setTitle] = useState("")
  const [seats, setSeats] = useState(8)
  const [denied, setDenied] = useState(false)

  const take = (t: Talk) => {
    if (!canAfford(1)) { setDenied(true); setTimeout(() => setDenied(false), 3200); return }
    spendFai(1); setFaiState(getFai()); onSpent()
    onJoin(talkRoom(t))
  }

  const create = () => {
    const clean = title.trim().slice(0, 70)
    if (!clean) return
    if (!canAfford(1)) { setDenied(true); setTimeout(() => setDenied(false), 3200); return }
    spendFai(1); setFaiState(getFai()); onSpent()
    // Your own talk starts empty and fills with voices as it runs — you're first
    // in rather than last, which is the other half of "you can arrive early".
    onJoin({ seed: (Date.now() >>> 0), f: heatF("m"), count: seats, title: clean, heat: "m" })
  }

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 19, overflowY: "auto", background: "radial-gradient(120% 70% at 50% 0%, #16102a 0%, #0a0713 60%, #07040f 100%)", fontFamily: "var(--font-geist), system-ui, sans-serif", color: "#f0e8ff", WebkitOverflowScrolling: "touch" }}>
      <div style={{ padding: "calc(env(safe-area-inset-top) + 16px) 18px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <button onClick={onBack} aria-label="back to people"
          style={{ minHeight: 34, padding: "0 12px", fontSize: 12, color: "rgba(240,232,255,.7)", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.14)", borderRadius: 999, cursor: "pointer", fontFamily: "inherit" }}>‹ people</button>
        <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 1, color: "#7fd6c0" }}>{fai} FAI</span>
      </div>

      <div style={{ padding: "6px 18px 2px" }}>
        <div style={{ fontSize: "clamp(24px, 7vw, 30px)", fontWeight: 600, letterSpacing: -0.5 }}>happening now</div>
        <div style={{ fontSize: 13, color: "rgba(240,232,255,.5)", marginTop: 4 }}>
          one FAI takes a seat. you earn one every time you finish a talk.
        </div>
      </div>

      {denied && (
        <div style={{ margin: "10px 18px", padding: "11px 13px", borderRadius: 12, background: "rgba(251,113,133,.12)", border: ".5px solid rgba(251,113,133,.35)", fontSize: 12.5, color: "#ffc9d2", lineHeight: 1.45 }}>
          no FAI left. finish a talk and you&apos;ll have one — it isn&apos;t for sale, and the pass doesn&apos;t include it.
        </div>
      )}

      <div style={{ padding: "10px 18px 4px", display: "flex", flexDirection: "column", gap: 10 }}>
        {talks.map((t) => {
          const left = seatsLeft(t)
          const c = HEAT(t.heat)
          return (
            <div key={t.id} style={{ borderRadius: 16, padding: "14px 15px", background: "rgba(255,255,255,.045)", border: `.5px solid ${c}33`, display: "flex", flexDirection: "column", gap: 9 }}>
              <div style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.3, color: "#f4ecff" }}>{t.title}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "rgba(240,232,255,.55)" }}>
                <Who t={t} />
                <span style={{ color: c, fontWeight: 700 }}>{left} seat{left === 1 ? "" : "s"} open</span>
                <span aria-hidden>·</span>
                <span>{ageLabel(t)}</span>
              </div>
              {/* How full it is, at a glance — a nearly-full talk should feel urgent. */}
              <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,.09)", overflow: "hidden" }}>
                <div style={{ width: `${Math.round((t.taken / t.seats) * 100)}%`, height: "100%", background: c, transition: "width .6s ease" }} />
              </div>
              <button onClick={() => take(t)}
                style={{ minHeight: 44, borderRadius: 12, border: "none", cursor: "pointer", fontSize: 14.5, fontWeight: 700, color: "#150a1f", background: c, WebkitTapHighlightColor: "transparent", touchAction: "manipulation", fontFamily: "inherit" }}>
                take a seat · 1 FAI
              </button>
            </div>
          )
        })}
      </div>

      <div style={{ padding: "14px 18px calc(env(safe-area-inset-bottom) + 26px)" }}>
        {!making ? (
          <button onClick={() => setMaking(true)}
            style={{ width: "100%", minHeight: 48, borderRadius: 14, fontSize: 14, color: "rgba(240,232,255,.75)", background: "transparent", border: ".5px dashed rgba(255,255,255,.24)", cursor: "pointer", fontFamily: "inherit" }}>
            + start your own talk
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px", borderRadius: 16, background: "rgba(255,255,255,.05)", border: ".5px solid rgba(255,255,255,.14)" }}>
            <div style={{ fontSize: 12.5, color: "rgba(240,232,255,.6)" }}>
              what&apos;s it about? the good ones sound like a confession, not a topic.
            </div>
            <input
              value={title} onChange={(e) => setTitle(e.target.value)} maxLength={70}
              placeholder="i've never told anyone this"
              style={{ minHeight: 46, borderRadius: 12, fontSize: 15, color: "#f0e8ff", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.2)", padding: "0 12px", outline: "none", fontFamily: "inherit" }}
            />
            <label style={{ fontSize: 12.5, color: "rgba(240,232,255,.6)", display: "flex", alignItems: "center", gap: 10 }}>
              seats
              <input type="range" min={3} max={20} value={seats} onChange={(e) => setSeats(Number(e.target.value))}
                style={{ flex: 1, accentColor: "#7fd6c0" }} />
              <span style={{ width: 26, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#7fd6c0", fontWeight: 700 }}>{seats}</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setMaking(false); setTitle("") }}
                style={{ flex: "0 0 auto", minHeight: 46, padding: "0 16px", borderRadius: 12, fontSize: 13, color: "rgba(240,232,255,.55)", background: "transparent", border: ".5px solid rgba(255,255,255,.16)", cursor: "pointer", fontFamily: "inherit" }}>cancel</button>
              <button onClick={create} disabled={!title.trim()}
                style={{ flex: 1, minHeight: 46, borderRadius: 12, border: "none", fontSize: 14.5, fontWeight: 700, color: "#06121e", background: title.trim() ? "#7fd6c0" : "rgba(127,214,192,.3)", cursor: title.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
                open it · 1 FAI
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
