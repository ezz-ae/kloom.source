"use client"

/**
 * BOOKING THE GOLDEN ROOM.
 *
 * You do not enter it from here — you buy sessions here and spend one later,
 * from inside a conversation, on whoever you are already talking to. So this
 * sheet sells a thing you hold, and says plainly what holding it means.
 *
 * The length is on the screen before the price is. Eleven dollars for "as long
 * as you like" would be the pass's mistake again, and the honest version costs
 * nothing to say: ninety minutes is longer than any call anyone actually has.
 */
import { useEffect, useState } from "react"
import { GOLDEN_USD, GOLDEN_MINUTES, GOLDEN_MAX_BOOKED, GOLDEN_GAMES } from "@/lib/airraw/golden"
import { goldHeld, onGold, refreshGold, buyGold } from "@/lib/airroom/golden-client"
import { localPrice, priceFootnote } from "@/lib/airraw/money"
import { useT } from "@/lib/airraw/i18n"
import { track } from "@/lib/track"

const GOLD_PALE = "#f7e3a1", GOLD = "#e8c46a", GOLD_DEEP = "#a97c24", INK = "#0a0805"
const METAL = `linear-gradient(135deg, ${GOLD_PALE} 0%, ${GOLD} 42%, ${GOLD_DEEP} 100%)`

export function GoldenSheet({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [held, setHeld] = useState(goldHeld())
  const [qty, setQty] = useState(1)
  const [promo, setPromo] = useState("")
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState("")
  const [ready, setReady] = useState<boolean | null>(null)
  // The gateway's own currency, from the server. Never assumed here.
  const [charge, setCharge] = useState<string>("")

  useEffect(() => {
    const off = onGold(setHeld)
    refreshGold().catch(() => { /* the offer still renders */ })
    fetch("/api/golden").then((r) => r.json()).then((d) => {
      setReady(d?.ready !== false)
      if (d?.charge) setCharge(String(d.charge))
    }).catch(() => setReady(null))
    return off
  }, [])

  const total = (GOLDEN_USD * qty).toFixed(2).replace(/\.00$/, "")
  // Shown beside the dollar, never instead of it — see lib/airraw/money.ts.
  const near = localPrice(GOLDEN_USD * qty)
  const nearOne = localPrice(GOLDEN_USD)
  const buy = async () => {
    setBusy(true); setNote("")
    track("golden_buy_start", { value: GOLDEN_USD * qty, currency: "USD", qty })
    const r = await buyGold(qty, promo.trim() || undefined)
    if (!r.ok) { setBusy(false); setNote(r.error || t("checkout didn't open")) }
  }

  return (
    <div role="dialog" aria-label={t("the golden room")} onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 85, background: "rgba(4,3,1,.86)", backdropFilter: "blur(14px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, maxHeight: "94vh", overflowY: "auto", color: "#f6efe0",
          background: `linear-gradient(180deg, #17120a 0%, ${INK} 100%)`, borderTop: `1px solid ${GOLD}66`,
          borderRadius: "22px 22px 0 0", padding: "20px 18px calc(env(safe-area-inset-bottom) + 22px)",
          fontFamily: "inherit", boxShadow: `0 -24px 70px -20px rgba(0,0,0,.95)` }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11.5, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: 700,
            background: METAL, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{t(t("the golden room"))}</span>
          <button onClick={onClose} aria-label={t("close")}
            style={{ background: "none", border: "none", color: "rgba(246,239,224,.5)", fontSize: 21, cursor: "pointer", padding: "0 3px", lineHeight: 1, fontFamily: "inherit" }}>×</button>
        </div>

        <p style={{ margin: "10px 0 4px", fontSize: 20, fontWeight: 700, letterSpacing: -.3, lineHeight: 1.25 }}>
          {t("Take someone somewhere better.")}
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 13.5, lineHeight: 1.6, color: "rgba(246,239,224,.6)" }}>
          {t("You don't walk into it — you bring someone with you. Whoever you're already talking to comes exactly as they are: same voice, same face, same conversation.")}
          <br />
          <strong style={{ color: GOLD, fontWeight: 600 }}>{t("${usd} a session · {min} minutes", { usd: `${GOLDEN_USD}${nearOne ? ` (${nearOne.text})` : ""}`, min: GOLDEN_MINUTES })}</strong>{t(", however you use it.")}
        </p>

        {held > 0 && (
          <p style={{ ...panel(), margin: "0 0 14px", padding: "11px 13px", fontSize: 13.5 }}>
            {t("you're holding {n} — open one from inside any conversation.", { n: held })}
          </p>
        )}

        <div style={{ display: "grid", gap: 7, marginBottom: 14 }}>
          {GOLDEN_GAMES.map((g) => (
            <span key={g.id} style={{ ...panel(), padding: "9px 12px", fontSize: 12.5, color: "rgba(246,239,224,.75)" }}>
              <strong style={{ color: GOLD, fontWeight: 700 }}>{g.name}</strong> — {g.blurb}
            </span>
          ))}
        </div>

        {/* how many to hold */}
        <span style={{ display: "block", fontSize: 11.5, letterSpacing: 1.2, textTransform: "uppercase", color: "rgba(246,239,224,.4)", marginBottom: 7 }}>
          {t("book ahead")}
        </span>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 12 }}>
          {Array.from({ length: GOLDEN_MAX_BOOKED }, (_, i) => i + 1).map((n) => (
            <button key={n} onClick={() => setQty(n)} aria-label={`${n} ${n === 1 ? "session" : "sessions"}`} aria-pressed={qty === n}
              style={{ flex: "0 0 auto", width: 42, height: 42, borderRadius: 11, cursor: "pointer", fontFamily: "inherit",
                fontSize: 15, fontWeight: 700, background: qty === n ? METAL : "rgba(255,255,255,.05)",
                border: `.5px solid ${qty === n ? GOLD : `${GOLD}30`}`, color: qty === n ? INK : "rgba(246,239,224,.7)" }}>{n}</button>
          ))}
        </div>

        <input value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase().slice(0, 24))}
          placeholder={t("promo code (optional)")} aria-label={t("promo code")}
          style={{ width: "100%", minHeight: 44, borderRadius: 11, padding: "0 13px", marginBottom: 10, fontSize: 15,
            background: "rgba(255,255,255,.05)", border: `.5px solid ${GOLD}30`, color: "#f6efe0", outline: "none",
            fontFamily: "inherit", letterSpacing: 1 }} />

        {ready === false ? (
          <p style={{ ...panel(), margin: 0, padding: "13px 14px", fontSize: 13.5, color: "rgba(246,239,224,.6)" }}>
            {t("the golden room is closed for a moment — nothing was charged.")}
          </p>
        ) : (
          <button onClick={buy} disabled={busy}
            aria-label={`buy ${qty} golden ${qty === 1 ? "session" : "sessions"} for $${total}${near ? `, about ${near.text}` : ""}`}
            style={{ width: "100%", minHeight: 54, borderRadius: 14, border: "none", cursor: busy ? "default" : "pointer",
              background: METAL, color: INK, fontSize: 16.5, fontWeight: 800, fontFamily: "inherit", opacity: busy ? .6 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {busy ? "…" : t("hold {n} · ${total}", { n: qty, total })}
          </button>
        )}

        {note && <p style={{ margin: "11px 0 0", fontSize: 13, color: GOLD, textAlign: "center" }}>{note}</p>}
        {/* Both true things, before they pay: roughly what it is in their money,
            and what their statement will actually say. */}
        <p style={{ margin: "9px 0 0", fontSize: 12, lineHeight: 1.5, color: "rgba(246,239,224,.5)", textAlign: "center" }}>
          {priceFootnote(GOLDEN_USD * qty, charge)}
        </p>
        <p style={{ margin: "10px 0 0", fontSize: 11.5, lineHeight: 1.6, color: "rgba(246,239,224,.32)", textAlign: "center" }}>
          {t("a session starts when you open it, not when you buy it.")}
          <br />{t("nothing is charged automatically, ever.")}
        </p>
      </div>
    </div>
  )
}

function panel(): React.CSSProperties {
  return {
    display: "block",
    background: "linear-gradient(180deg, rgba(232,196,106,.09), rgba(232,196,106,.03))",
    border: `.5px solid ${GOLD}33`,
    borderRadius: 13,
  }
}
