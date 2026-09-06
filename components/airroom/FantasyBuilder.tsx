"use client"

/**
 * CAST THE SCENE — the paid tab's front half.
 *
 * Three decisions, in the order people actually make them: what this is, who is
 * in it, and how it runs. Each step is one screenful with one obvious next
 * action, because the alternative — every control on one page — reads as a
 * settings screen, and nobody arrives here wanting to configure something.
 *
 * Nothing here talks to a model. It produces a SceneConfig and hands it over.
 */
import { useMemo, useState } from "react"
import {
  FANTASIES, FANTASY_KINDS, ROLES, VIBES, GENDERS, TURN_MODES, ATTRIBUTIONS,
  MAX_CAST, VIBE_MAX, cleanVibe,
  type SceneConfig, type SceneMember, type Gender, type TurnMode, type Attribution,
} from "@/lib/airraw/fantasy"

const ACCENT = "#f472b6"
const CARD: React.CSSProperties = { background: "rgba(255,255,255,.05)", border: ".5px solid rgba(255,255,255,.11)", borderRadius: 14 }

const newMember = (i: number): SceneMember => ({
  id: `s${i}`,
  gender: i === 0 ? "f" : "m",
  roleId: ROLES[(i * 11) % ROLES.length].id,
  vibe: "",
  quiet: false,
})

export function FantasyBuilder({ onStart, onClose }: { onStart: (cfg: SceneConfig) => void; onClose?: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [fantasyId, setFantasyId] = useState("")
  const [kind, setKind] = useState<string>("meeting")
  const [q, setQ] = useState("")
  const [cast, setCast] = useState<SceneMember[]>([newMember(0)])
  const [turnMode, setTurnMode] = useState<TurnMode>("turns")
  const [attribution, setAttribution] = useState<Attribution>("name")
  const [save, setSave] = useState(true)
  const [record, setRecord] = useState(false)

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (t) return FANTASIES.filter((f) => f.label.toLowerCase().includes(t) || f.scene.toLowerCase().includes(t))
    return FANTASIES.filter((f) => f.kind === kind)
  }, [q, kind])

  const patch = (id: string, p: Partial<SceneMember>) =>
    setCast((c) => c.map((m) => (m.id === id ? { ...m, ...p } : m)))

  const go = () => onStart({ fantasyId, cast, turnMode, attribution, save, record })

  return (
    <div style={{ minHeight: "100%", color: "#f0e8ff", padding: "6px 16px 96px", maxWidth: 640, margin: "0 auto", boxSizing: "border-box" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        {onClose && (
          <button onClick={onClose} aria-label="back" style={{ background: "none", border: "none", color: "rgba(240,232,255,.6)", fontSize: 22, cursor: "pointer", padding: "4px 6px" }}>‹</button>
        )}
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -.3 }}>
            {step === 1 ? "what is this" : step === 2 ? "who's in it" : "how it runs"}
          </div>
          <div style={{ fontSize: 12.5, color: "rgba(240,232,255,.45)" }}>step {step} of 3</div>
        </div>
      </header>

      {/* ── 1. the scene ── */}
      {step === 1 && (
        <>
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="search 57 scenes…" aria-label="search scenes"
            style={{ ...CARD, width: "100%", padding: "12px 14px", color: "#f0e8ff", fontSize: 15, fontFamily: "inherit", outline: "none", marginBottom: 12, boxSizing: "border-box" }}
          />
          {!q.trim() && (
            <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 10, marginBottom: 4 }}>
              {FANTASY_KINDS.map((k) => (
                <button key={k.id} onClick={() => setKind(k.id)}
                  style={{ flex: "0 0 auto", padding: "8px 13px", borderRadius: 999, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                    background: kind === k.id ? ACCENT : "rgba(255,255,255,.06)", color: kind === k.id ? "#0d0418" : "rgba(240,232,255,.75)",
                    border: ".5px solid rgba(255,255,255,.1)", fontWeight: kind === k.id ? 700 : 400 }}>{k.label}</button>
              ))}
            </div>
          )}
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8, gridTemplateColumns: "minmax(0, 1fr)" }}>
            {shown.map((f) => (
              <li key={f.id}>
                <button onClick={() => { setFantasyId(f.id); setStep(2) }}
                  style={{ ...CARD, width: "100%", textAlign: "left", padding: "13px 15px", cursor: "pointer", color: "#f0e8ff", fontFamily: "inherit",
                    borderColor: fantasyId === f.id ? ACCENT : "rgba(255,255,255,.11)" }}>
                  <div style={{ fontSize: 15.5, fontWeight: 600 }}>{f.label}</div>
                  <div style={{ fontSize: 13, color: "rgba(240,232,255,.5)", marginTop: 4, lineHeight: 1.45 }}>{f.scene}</div>
                </button>
              </li>
            ))}
            {shown.length === 0 && <li style={{ color: "rgba(240,232,255,.45)", fontSize: 14, padding: "18px 2px" }}>nothing by that name.</li>}
          </ul>
        </>
      )}

      {/* ── 2. the cast ── */}
      {step === 2 && (
        <>
          <p style={{ fontSize: 13.5, color: "rgba(240,232,255,.5)", margin: "0 0 14px", lineHeight: 1.5 }}>
            You are in this. Add up to {MAX_CAST} others — what they are, what they&rsquo;re like, and whether they speak.
          </p>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0, 1fr)" }}>
            {cast.map((m, i) => (
              <div key={m.id} style={{ ...CARD, padding: 14, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
                  <span style={{ fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: "rgba(240,232,255,.42)", fontWeight: 600 }}>#{i + 1}</span>
                  {cast.length > 1 && (
                    <button onClick={() => setCast((c) => c.filter((x) => x.id !== m.id))} aria-label={`remove person ${i + 1}`}
                      style={{ background: "none", border: "none", color: "rgba(240,232,255,.45)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>remove</button>
                  )}
                </div>

                <div style={{ display: "flex", gap: 7, marginBottom: 11 }}>
                  {GENDERS.map((g) => (
                    <button key={g.id} onClick={() => patch(m.id, { gender: g.id as Gender })} aria-pressed={m.gender === g.id}
                      style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                        background: m.gender === g.id ? ACCENT : "rgba(255,255,255,.06)", color: m.gender === g.id ? "#0d0418" : "rgba(240,232,255,.7)",
                        border: ".5px solid rgba(255,255,255,.1)" }}>{g.label}</button>
                  ))}
                </div>

                <select value={m.roleId} onChange={(e) => patch(m.id, { roleId: e.target.value })} aria-label={`role for person ${i + 1}`}
                  style={{ width: "100%", padding: "11px 12px", borderRadius: 10, background: "rgba(255,255,255,.06)", color: "#f0e8ff",
                    border: ".5px solid rgba(255,255,255,.1)", fontSize: 14.5, fontFamily: "inherit", marginBottom: 11, boxSizing: "border-box" }}>
                  {ROLES.map((r) => <option key={r.id} value={r.id} style={{ background: "#1a0828" }}>{r.label}</option>)}
                </select>

                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, minWidth: 0 }}>
                  {VIBES.map((v) => (
                    <button key={v} onClick={() => patch(m.id, { vibe: m.vibe === v ? "" : v })}
                      style={{ flex: "0 0 auto", padding: "6px 11px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit",
                        background: m.vibe === v ? `${ACCENT}33` : "rgba(255,255,255,.05)", color: m.vibe === v ? ACCENT : "rgba(240,232,255,.6)",
                        border: `.5px solid ${m.vibe === v ? ACCENT + "88" : "rgba(255,255,255,.09)"}` }}>{v}</button>
                  ))}
                </div>
                <input value={m.vibe} onChange={(e) => patch(m.id, { vibe: cleanVibe(e.target.value) })} maxLength={VIBE_MAX}
                  placeholder="or describe them in your own words…" aria-label={`vibe for person ${i + 1}`}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,.05)", color: "#f0e8ff",
                    border: ".5px solid rgba(255,255,255,.09)", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />

                <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 11, fontSize: 13.5, color: "rgba(240,232,255,.6)", cursor: "pointer" }}>
                  <input type="checkbox" checked={m.quiet} onChange={(e) => patch(m.id, { quiet: e.target.checked })} style={{ accentColor: ACCENT, width: 17, height: 17 }} />
                  here, but doesn&rsquo;t speak
                </label>
              </div>
            ))}
          </div>

          {cast.length < MAX_CAST && (
            <button onClick={() => setCast((c) => [...c, newMember(c.length)])}
              style={{ ...CARD, width: "100%", padding: "13px 0", marginTop: 12, color: ACCENT, fontSize: 14.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", borderStyle: "dashed" }}>
              + add someone ({cast.length}/{MAX_CAST})
            </button>
          )}
          <Nav back={() => setStep(1)} next={() => setStep(3)} nextLabel="how it runs →" />
        </>
      )}

      {/* ── 3. the controls ── */}
      {step === 3 && (
        <>
          <Group label="who speaks, and when">
            {TURN_MODES.map((t) => (
              <Choice key={t.id} on={turnMode === t.id} onPick={() => setTurnMode(t.id)} title={t.label} hint={t.hint} />
            ))}
          </Group>
          <Group label="how you can tell who's talking">
            {ATTRIBUTIONS.map((a) => (
              <Choice key={a.id} on={attribution === a.id} onPick={() => setAttribution(a.id)} title={a.label} hint={a.hint} />
            ))}
          </Group>
          <Group label="afterwards">
            <Toggle on={save} set={setSave} title="keep the transcript" hint="it stays on this device — off means nothing is written" />
            {/* Says what it actually does. The clips are object URLs held for the life of
              the scene, so "replay any line" is true and "saved forever" would not be. */}
          <Toggle on={record} set={setRecord} title="keep the voices" hint="replay any line while the scene is open" />
          </Group>
          <Nav back={() => setStep(2)} next={go} nextLabel="begin →" />
        </>
      )}
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h3 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1.3, color: "rgba(240,232,255,.42)", fontWeight: 600, margin: "0 0 10px" }}>{label}</h3>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0, 1fr)" }}>{children}</div>
    </section>
  )
}

function Choice({ on, onPick, title, hint }: { on: boolean; onPick: () => void; title: string; hint: string }) {
  return (
    <button onClick={onPick} aria-pressed={on}
      style={{ ...CARD, textAlign: "left", padding: "13px 15px", cursor: "pointer", color: "#f0e8ff", fontFamily: "inherit",
        borderColor: on ? ACCENT : "rgba(255,255,255,.11)", background: on ? `${ACCENT}18` : "rgba(255,255,255,.05)" }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "rgba(240,232,255,.5)", marginTop: 3 }}>{hint}</div>
    </button>
  )
}

function Toggle({ on, set, title, hint }: { on: boolean; set: (v: boolean) => void; title: string; hint: string }) {
  return (
    <label style={{ ...CARD, display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", cursor: "pointer" }}>
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} style={{ accentColor: ACCENT, width: 18, height: 18, flex: "0 0 auto" }} />
      <span>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{title}</span>
        <span style={{ display: "block", fontSize: 12.5, color: "rgba(240,232,255,.5)", marginTop: 2 }}>{hint}</span>
      </span>
    </label>
  )
}

/**
 * The step navigation, PINNED above the dock.
 *
 * It used to sit at the end of the content, and on a phone that put the primary
 * button underneath the fixed tab dock at most scroll positions — a hit-test put
 * the dock on top of "how it runs →", so the tap that advances the wizard
 * silently switched tabs instead. Reserving padding was not enough on its own,
 * because the collision happens mid-scroll rather than at the bottom.
 *
 * Sticky with an explicit offset clears the dock at every scroll position, and
 * has the side benefit that the way forward is always on screen.
 */
function Nav({ back, next, nextLabel }: { back: () => void; next: () => void; nextLabel: string }) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 22, position: "sticky",
      bottom: "max(5.75rem, calc(env(safe-area-inset-bottom) + 5.25rem))", zIndex: 5,
      background: "linear-gradient(to top, #0d0418 62%, transparent)", paddingTop: 14, paddingBottom: 4 }}>
      <button onClick={back} style={{ ...CARD, flex: "0 0 auto", padding: "15px 20px", color: "rgba(240,232,255,.7)", fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>back</button>
      <button onClick={next} style={{ flex: 1, padding: "15px 0", borderRadius: 14, background: ACCENT, color: "#0d0418", fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit" }}>{nextLabel}</button>
    </div>
  )
}
