"use client"

/**
 * THE CAGE — where you see what you're holding and get more.
 *
 * The brief was a casino, and the half of a casino worth copying is the cage: a
 * legible chip, a clean count, and no ambiguity about what anything costs. The
 * other half — the countdown, the "2 left", the balance that quietly rots — is
 * absent on purpose and its absence is tested (tests/chips-test.mjs). What makes
 * someone spend happily is knowing exactly where they stand; what makes them stop
 * is discovering the number moved while they weren't looking.
 *
 * So: the balance is the biggest thing on the screen, the rate is stated before
 * the prices, the bonus percentages are computed from the real chips-per-dollar,
 * and the daily is offered as a plain fact rather than a prize.
 */
import { useEffect, useState } from "react"
import { CHIP_PACKS, CHIPS_PER_PHOTO, DAILY_CHIPS, type ChipPack } from "@/lib/airraw/chip-rates"
import { localPrice, chargeNote } from "@/lib/airraw/money"
import { chipBalance, onChips, openWallet, claimDaily, buyPack } from "@/lib/airroom/wallet"
import { track } from "@/lib/track"

const ACCENT = "#f472b6"
const GOLD = "#f4c672"
const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,.05)",
  border: ".5px solid rgba(255,255,255,.11)",
  borderRadius: 16,
}

export function ChipSheet({ onClose }: { onClose: () => void }) {
  const [bal, setBal] = useState(chipBalance())
  const [busy, setBusy] = useState("")
  const [note, setNote] = useState("")
  const [dailyState, setDailyState] = useState<"idle" | "done" | "tomorrow">("idle")
  // Whether the ledger is actually able to take money. The tables are applied by
  // hand, so "live code, no ledger" is a real state — and a buy button that can
  // only fail is worse than no buy button.
  const [ready, setReady] = useState<boolean | null>(null)
  const [promo, setPromo] = useState("")
  // The gateway's own currency, from the server. Never assumed here.
  const [charge, setCharge] = useState<string>("")

  useEffect(() => {
    const off = onChips(setBal)
    openWallet().catch(() => { /* the sheet still renders the offer with a 0 balance */ })
    fetch("/api/chips").then((r) => r.json()).then((d) => {
      setReady(d?.ready !== false)
      if (d?.charge) setCharge(String(d.charge))
    }).catch(() => setReady(null))
    return off
  }, [])

  const daily = async () => {
    setBusy("daily"); setNote("")
    const r = await claimDaily()
    setBusy("")
    if (r.already) { setDailyState("tomorrow"); setNote(`already claimed today — ${DAILY_CHIPS} more tomorrow`) }
    else if (r.ok && r.granted > 0) { setDailyState("done"); setNote(`+${r.granted} chips`); track("chips_daily", { value: r.granted }) }
    else setNote("couldn't reach the cage — try again in a moment")
  }

  const buy = async (p: ChipPack) => {
    setBusy(p.id); setNote("")
    track("chips_buy_start", { value: p.usd, currency: "USD", pack: p.id })
    const r = await buyPack(p.id, promo.trim() || undefined)
    if (!r.ok) { setBusy(""); setNote(r.error || "checkout didn't open") }
    // On success the browser is already navigating to the checkout.
  }

  return (
    <div role="dialog" aria-label="your chips"
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(6,3,12,.82)", backdropFilter: "blur(14px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto",
          background: "linear-gradient(180deg, #170d1f 0%, #0d0714 100%)",
          border: ".5px solid rgba(255,255,255,.12)", borderRadius: "22px 22px 0 0",
          padding: "20px 18px calc(env(safe-area-inset-bottom) + 22px)", color: "#f0e8ff",
          fontFamily: "inherit", boxShadow: "0 -20px 60px -20px rgba(0,0,0,.9)" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 12.5, letterSpacing: 1.4, textTransform: "uppercase", color: "rgba(240,232,255,.42)" }}>your chips</span>
          <button onClick={onClose} aria-label="close"
            style={{ background: "none", border: "none", color: "rgba(240,232,255,.5)", fontSize: 22, cursor: "pointer", padding: "0 4px", lineHeight: 1, fontFamily: "inherit" }}>×</button>
        </div>

        {/* The count, and immediately under it what the count is FOR. A balance
            without a rate beside it is a number people have to take on trust. */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 2 }}>
          <span style={{ fontSize: 52, fontWeight: 300, letterSpacing: -1.5, color: GOLD, lineHeight: 1.05 }}>{bal}</span>
          <span style={{ fontSize: 15, color: "rgba(240,232,255,.5)" }}>{bal === 1 ? "chip" : "chips"}</span>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 13.5, color: "rgba(240,232,255,.5)", lineHeight: 1.55 }}>
          one chip is a minute of their voice. {CHIPS_PER_PHOTO} chips is a photo.
          <br />they don&apos;t expire.
        </p>

        {/* The daily. Stated as a fact with a fixed number, not dressed as a prize
            — and missing yesterday costs nothing, so there is nothing to warn about. */}
        {DAILY_CHIPS > 0 && (
          <button onClick={daily} disabled={busy === "daily" || dailyState !== "idle"}
            style={{ ...CARD, width: "100%", padding: "13px 15px", marginBottom: 16, display: "flex",
              justifyContent: "space-between", alignItems: "center", gap: 10, cursor: dailyState === "idle" ? "pointer" : "default",
              color: "inherit", fontFamily: "inherit", textAlign: "left",
              borderColor: dailyState === "done" ? `${GOLD}55` : "rgba(255,255,255,.11)", opacity: dailyState === "tomorrow" ? .55 : 1 }}>
            <span>
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 600 }}>
                {dailyState === "done" ? "collected" : dailyState === "tomorrow" ? "back tomorrow" : "today's chips"}
              </span>
              <span style={{ display: "block", fontSize: 12.5, color: "rgba(240,232,255,.45)", marginTop: 2 }}>
                free, once a day, whether or not you came yesterday
              </span>
            </span>
            <span style={{ flex: "0 0 auto", fontSize: 15, fontWeight: 700, color: GOLD }}>
              {busy === "daily" ? "…" : `+${DAILY_CHIPS}`}
            </span>
          </button>
        )}

        {ready === false && (
          <p style={{ ...CARD, margin: 0, padding: "13px 15px", fontSize: 13.5, color: "rgba(240,232,255,.6)", lineHeight: 1.55 }}>
            the cage is closed for a moment — chips can&apos;t be bought right now.
            nothing was charged, and your balance is safe.
          </p>
        )}

        <div style={{ display: ready === false ? "none" : "grid", gap: 9 }}>
          {CHIP_PACKS.map((p, i) => (
            <button key={p.id} onClick={() => buy(p)} disabled={!!busy}
              style={{ ...CARD, width: "100%", padding: "15px 16px", display: "flex", alignItems: "center",
                justifyContent: "space-between", gap: 12, cursor: busy ? "default" : "pointer", color: "inherit",
                fontFamily: "inherit", textAlign: "left", opacity: busy && busy !== p.id ? .45 : 1,
                // The middle pack is marked because it genuinely is the middle, not
                // because we want it picked. No "most popular" — we don't know that.
                borderColor: i === 1 ? `${ACCENT}55` : "rgba(255,255,255,.11)",
                background: i === 1 ? "rgba(244,114,182,.07)" : CARD.background }}>
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: -.2 }}>
                  {p.chips} <span style={{ fontSize: 14, fontWeight: 400, color: "rgba(240,232,255,.5)" }}>chips</span>
                </span>
                <span style={{ fontSize: 12.5, color: "rgba(240,232,255,.45)", marginTop: 3 }}>
                  ≈ {p.chips} minutes out loud
                  {p.bonusPct > 0 && <span style={{ color: GOLD }}> · {p.bonusPct}% more per dollar</span>}
                </span>
              </span>
              <span style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: busy === p.id ? "rgba(240,232,255,.5)" : ACCENT }}>
                  {busy === p.id ? "…" : `$${p.usd}`}
                </span>
                {/* Beside the dollar, never instead of it — lib/airraw/money.ts. */}
                {busy !== p.id && localPrice(p.usd) && (
                  <span style={{ fontSize: 11.5, color: "rgba(240,232,255,.4)", whiteSpace: "nowrap" }}>
                    {localPrice(p.usd)!.text}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* A code, if they have one. Priced on the server from what the checkout
            was opened with — a discount the browser can name is one it can invent. */}
        {ready !== false && (
          <input value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase().slice(0, 24))}
            placeholder="promo code (optional)" aria-label="promo code"
            style={{ width: "100%", minHeight: 44, borderRadius: 11, padding: "0 13px", marginTop: 10, fontSize: 15,
              background: "rgba(255,255,255,.05)", border: ".5px solid rgba(255,255,255,.12)", color: "#f0e8ff",
              outline: "none", fontFamily: "inherit", letterSpacing: 1, boxSizing: "border-box" }} />
        )}

        {note && <p style={{ margin: "13px 0 0", fontSize: 13, color: GOLD, textAlign: "center" }}>{note}</p>}

        {/* What the statement will say, before they pay rather than after. */}
        {ready !== false && (
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "rgba(240,232,255,.45)", lineHeight: 1.5, textAlign: "center" }}>
            {chargeNote(charge)}
          </p>
        )}

        <p style={{ margin: "12px 0 0", fontSize: 11.5, color: "rgba(240,232,255,.3)", lineHeight: 1.6, textAlign: "center" }}>
          chips are spent as you use them — voice, photos, scenes.
          <br />nothing is charged automatically, ever.
        </p>
      </div>
    </div>
  )
}
