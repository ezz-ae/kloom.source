"use client"

/**
 * AIRRAW Pro paywall. Self-contained: pitches Pro, then opens a real Ziina hosted
 * checkout (POST /api/airraw-pro). We stash the intent id before redirecting so the
 * planet can claim the pass when the buyer returns (?pro_ok=1).
 */
import { useState, useEffect } from "react"
import { setPendingIntent, setProToken, isPro, clearPro, fbCookies } from "@/lib/airroom/pro"
import { track } from "@/lib/track"
import { LANGUAGES } from "@/lib/languages"
import { getLangPrefs, saveLangPrefs, langPrefsPersist, type LangPrefs } from "@/lib/airraw/lang-prefs"

function perks(minutes: number, days: number): [string, string][] {
  const months = Math.max(1, Math.round(days / 30))
  return [
    ["✦  fully unrestricted", "the whole floor wide open — no limits, no gates, nothing held back"],
    [`✦  ${minutes.toLocaleString()} voice minutes`, `${months === 1 ? "a month" : months === 3 ? "three months" : `${months} months`} of talking out loud — across every room`],
    ["✦  best matches, lit up", "tap once and the people most worth your night light up across the whole floor"],
    ["✦  FAI twice as fast", "FAI still cannot be bought — the pass just lets you earn far more of it in a day"],
    ["✦  set the vibe", "steer any room — flirty, hyped, brutally honest — and the voices follow"],
    ["✦  your languages, kept", "your default sticks between visits, and the floor fills with people who actually open in it"],
  ]
}

// Display fallback only — the real offer comes from GET /api/airraw-pro (the same
// env the checkout charges from), so UI and charge can't drift apart.
const DEFAULT_OFFER = { price: 9, days: 90, minutes: 6000 }

export function ProSheet({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [restoring, setRestoring] = useState(false)
  const [code, setCode] = useState("")
  const [rErr, setRErr] = useState("")
  const [offer, setOffer] = useState(DEFAULT_OFFER)
  // Languages are choosable by everyone — free included. What the pass changes is
  // that the choice sticks between visits and steers who you meet.
  const [langs, setLangs] = useState<LangPrefs>(() => getLangPrefs())
  const [sticky] = useState(() => langPrefsPersist())
  // Collapsed by default. Expanded, this block is ~250px — on a phone that pushed
  // the price and the buy button off the bottom and left the section itself below
  // the fold, so it read as missing entirely.
  const [langOpen, setLangOpen] = useState(false)
  const setPrimary = (name: string) => {
    const next: LangPrefs = { primary: name, also: langs.also.filter((x) => x !== name) }
    setLangs(next); saveLangPrefs(next)
  }
  const toggleAlso = (name: string) => {
    if (name === langs.primary) return
    const next: LangPrefs = {
      primary: langs.primary,
      also: langs.also.includes(name) ? langs.also.filter((x) => x !== name) : [...langs.also, name],
    }
    setLangs(next); saveLangPrefs(next)
  }

  // Restore a pass bought on another device/browser. The pass is a portable signed
  // token, so pasting the saved restore code re-activates it with no account.
  const restore = () => {
    const c = code.trim()
    if (!c) return
    setProToken(c)
    if (isPro()) { onClose(); window.location.reload() }
    else { clearPro(); setRErr("that code looks invalid or expired — copy the whole thing") }
  }
  // Load the real offer, then fire the on-screen signal with the price actually charged
  // (→ Meta AddToCart). Falls back to the default numbers if the fetch hiccups.
  useEffect(() => {
    let live = { ...DEFAULT_OFFER }
    fetch("/api/airraw-pro")
      .then((r) => r.json())
      .then((d) => { if (typeof d?.price === "number") { live = { price: d.price, days: d.days || 90, minutes: d.minutes || 6000 }; setOffer(live) } })
      .catch(() => {})
      .finally(() => { try { track("paywall_view", { value: live.price, currency: "USD", kind: "pass" }) } catch { /* */ } })
  }, [])

  const go = async () => {
    setBusy(true); setErr("")
    try {
      const r = await fetch("/api/airraw-pro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "checkout", ...fbCookies() }) })
      const d = await r.json()
      if (!r.ok || !d.url) { setErr(d.error || "couldn’t start checkout — try again"); setBusy(false); return }
      setPendingIntent(d.intentId, d.t, d.s)
      try { track("initiate_checkout", { value: d.price ?? offer.price, currency: "USD", method: "ziina", kind: "pass" }, d.intentId) } catch { /* never block redirect */ }
      window.location.href = d.url
    } catch { setErr("network hiccup — try again"); setBusy(false) }
  }

  return (
    <div className="air-fade" style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(6,5,16,.82)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto", padding: "max(20px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
      <div className="air-rise" style={{ width: "min(92vw, 420px)", background: "linear-gradient(180deg, rgba(26,20,42,.97), rgba(9,8,16,.97))", border: ".5px solid rgba(199,179,255,.3)", borderRadius: 22, boxShadow: "0 30px 90px -30px rgba(0,0,0,.85)", overflow: "hidden", color: "#eef4f8" }}>
        <div style={{ padding: "22px 22px 6px", textAlign: "center" }}>
          <div style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: "#ffd98a", fontWeight: 600 }}>airraw pro</div>
          <div style={{ fontSize: 24, fontWeight: 600, marginTop: 8 }}>unlock the floor</div>
        </div>
        <div style={{ padding: "10px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          {perks(offer.minutes, offer.days).map(([t, d], i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#e9deff" }}>{t}</div>
              <div style={{ fontSize: 13, lineHeight: 1.45, color: "#9fb2c4" }}>{d}</div>
            </div>
          ))}
        </div>
        {/* Languages — usable right now whether or not they buy. Putting a working
            control in the paywall (rather than a locked preview) is the point: they
            feel it work, and the pass is what makes it persist. */}
        <div style={{ padding: "6px 22px 2px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={() => setLangOpen((o) => !o)}
            aria-expanded={langOpen}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "inherit", fontFamily: "inherit" }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#e9deff" }}>your languages</span>
            <span style={{ fontSize: 11.5, color: "#9fb2c4" }}>
              {langs.primary}{langs.also.length ? ` +${langs.also.length}` : ""} <span style={{ color: "#e9b6ff" }}>{langOpen ? "close" : "change"}</span>
            </span>
          </button>
          {langOpen && (<>
          <label style={{ fontSize: 11.5, color: "#9fb2c4" }}>
            you speak mostly
            <select
              value={langs.primary}
              onChange={(e) => setPrimary(e.target.value)}
              style={{ width: "100%", marginTop: 5, height: 38, borderRadius: 11, fontSize: 13, color: "#eef4f8", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.2)", padding: "0 9px", cursor: "pointer" }}
            >
              {LANGUAGES.map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
            </select>
          </label>
          <div style={{ fontSize: 11.5, color: "#9fb2c4" }}>and also</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {LANGUAGES.filter((l) => l.name !== langs.primary).map((l) => {
              const on = langs.also.includes(l.name)
              return (
                <button
                  key={l.name}
                  onClick={() => toggleAlso(l.name)}
                  aria-pressed={on}
                  style={{ fontSize: 12, padding: "6px 11px", borderRadius: 999, cursor: "pointer", WebkitTapHighlightColor: "transparent", color: on ? "#1a0d2a" : "#9fb2c4", background: on ? "#e9b6ff" : "rgba(255,255,255,.06)", border: on ? "none" : ".5px solid rgba(255,255,255,.16)", fontFamily: "inherit" }}
                >
                  {l.name}
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 11, color: sticky ? "#7fd6c0" : "#6b7d8e", lineHeight: 1.4 }}>
            {sticky
              ? "saved as your default — and the floor is filled with people who open in these."
              : "this works now, for this visit. with the pass it becomes your default and fills the floor with people who open in these."}
          </div>
          </>)}
        </div>

        <div style={{ textAlign: "center", padding: "8px 22px 4px" }}>
          <span style={{ fontSize: 30, fontWeight: 700, color: "#fff" }}>${offer.price}</span>
          <span style={{ fontSize: 14, color: "#9fb2c4" }}> / {offer.days} days</span>
        </div>
        {err && <div style={{ fontSize: 12.5, color: "#ffb59c", textAlign: "center", padding: "2px 22px 6px" }}>{err}</div>}
        <div style={{ padding: "10px 22px 22px", display: "flex", flexDirection: "column", gap: 9 }}>
          <button onClick={go} disabled={busy} style={{ width: "100%", minHeight: 52, fontSize: 16, fontWeight: 600, color: "#1a0d2a", background: "linear-gradient(180deg,#ffe1a0,#e9b6ff)", border: "none", borderRadius: 14, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>{busy ? "opening checkout…" : `unlock — $${offer.price}`}</button>
          <button onClick={onClose} style={{ width: "100%", minHeight: 44, fontSize: 13, color: "#9fb2c4", background: "transparent", border: ".5px solid rgba(255,255,255,.16)", borderRadius: 14, cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>not now</button>
          <div style={{ fontSize: 11, color: "#6b7d8e", textAlign: "center", marginTop: 2 }}>secure checkout · card / apple pay · one-time, {offer.days} days · adults 18+ only</div>
          {/* restore on a new device/browser — paste the code you saved when you bought it */}
          {!restoring ? (
            <button onClick={() => setRestoring(true)} style={{ marginTop: 4, fontSize: 12, color: "#7f93a5", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>already paid? restore it</button>
          ) : (
            <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 7 }}>
              <input value={code} onChange={(e) => { setCode(e.target.value); setRErr("") }} placeholder="paste your restore code" aria-label="restore code" style={{ fontSize: 13, color: "#eef4f8", background: "rgba(255,255,255,.06)", border: ".5px solid rgba(255,255,255,.2)", borderRadius: 12, padding: "11px 13px", outline: "none" }} />
              {rErr && <div style={{ fontSize: 11.5, color: "#ffb59c", textAlign: "center" }}>{rErr}</div>}
              <button onClick={restore} disabled={!code.trim()} style={{ minHeight: 44, fontSize: 14, fontWeight: 600, color: "#06121e", background: "#7fd6c0", border: "none", borderRadius: 12, cursor: code.trim() ? "pointer" : "default", opacity: code.trim() ? 1 : 0.6, WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>restore my pass</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
