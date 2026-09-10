"use client"

/**
 * The chip count, always in the corner, always tappable.
 *
 * A balance you have to go looking for is a balance nobody trusts — the whole
 * argument for chips over an invisible meter is that you can see where you stand
 * without asking. So it sits on the surface and opens the cage in one tap.
 *
 * It renders nothing until the wallet has actually answered. A "0" that is really
 * "not loaded yet" is the one number here that would be a lie, and it would land
 * on exactly the person who just paid.
 */
import { useEffect, useState } from "react"
import { useT } from "@/lib/airraw/i18n"
import { chipBalance, walletLoaded, onChips, openWallet } from "@/lib/airroom/wallet"

const GOLD = "#f4c672"

export function ChipBar({ onOpen }: { onOpen: () => void }) {
  const t = useT()
  const [bal, setBal] = useState(chipBalance())
  const [ready, setReady] = useState(walletLoaded())

  useEffect(() => {
    const off = onChips((n) => { setBal(n); setReady(true) })
    openWallet().catch(() => { /* stay hidden rather than show a number we don't have */ })
    return off
  }, [])

  if (!ready) return null

  return (
    <button onClick={onOpen} aria-label={`${bal} ${t("chips")} — ${t("get more")}`}
      style={{
        position: "absolute", top: "calc(env(safe-area-inset-top) + 12px)",
        right: "max(16px, env(safe-area-inset-right))", zIndex: 26,
        display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 13px",
        borderRadius: 999, background: "rgba(10,6,16,.72)", backdropFilter: "blur(10px)",
        border: `.5px solid ${bal > 0 ? "rgba(244,198,114,.4)" : "rgba(255,255,255,.16)"}`,
        color: bal > 0 ? GOLD : "rgba(240,232,255,.6)", fontSize: 14, fontWeight: 700,
        fontFamily: "inherit", cursor: "pointer", WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation", lineHeight: 1,
      }}>
      <span aria-hidden style={{
        width: 13, height: 13, borderRadius: "50%",
        background: bal > 0 ? `radial-gradient(120% 120% at 32% 28%, ${GOLD}, #b8862f)` : "rgba(255,255,255,.22)",
        boxShadow: bal > 0 ? `0 0 10px -2px ${GOLD}` : "none", flex: "0 0 auto",
      }} />
      {bal}
    </button>
  )
}

/**
 * The same count, sized to sit inside a room's face strip.
 *
 * A room is where chips are actually spent — every line spoken, every photo
 * asked for — so hiding the balance there would hide it exactly where it
 * matters. It is a flex sibling of the faces rather than an overlay, because a
 * badge floating over a horizontally scrolling strip lands on top of whoever
 * happens to be scrolled to that edge.
 */
export function RoomChips({ onOpen }: { onOpen: () => void }) {
  const t = useT()
  const [bal, setBal] = useState(chipBalance())
  const [ready, setReady] = useState(walletLoaded())

  useEffect(() => {
    const off = onChips((n) => { setBal(n); setReady(true) })
    openWallet().catch(() => { /* stay hidden rather than show a number we don't have */ })
    return off
  }, [])

  if (!ready) return null

  return (
    <button onClick={onOpen} aria-label={`${bal} ${t("chips")} — ${t("get more")}`}
      style={{
        flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
        width: 46, padding: "4px 0 0", background: "none", border: "none", cursor: "pointer",
        fontFamily: "inherit", WebkitTapHighlightColor: "transparent",
      }}>
      <span aria-hidden style={{
        width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        background: bal > 0 ? `radial-gradient(120% 120% at 32% 28%, ${GOLD}, #a8761f)` : "rgba(255,255,255,.07)",
        border: `.5px solid ${bal > 0 ? `${GOLD}88` : "rgba(255,255,255,.18)"}`,
        color: bal > 0 ? "#2a1a05" : "rgba(240,232,255,.55)", fontSize: 12.5, fontWeight: 800, lineHeight: 1,
      }}>{bal}</span>
      <span style={{ fontSize: 10.5, color: "rgba(240,232,255,.5)" }}>{t("chips")}</span>
    </button>
  )
}
