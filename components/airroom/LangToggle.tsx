"use client"

// عربي / English, where someone who cannot read the screen can still find it.
//
// The interface language used to follow the conversation language with no way
// to set it, so a visitor from an Arab country whose phone is in English got an
// English app and no visible way to change that — and the setting that would
// have fixed it was itself in English. Two words, in their own scripts, are
// readable to both.
//
// Shown only where Arabic is plausibly theirs (lib/airraw/ui-lang.ts), so an
// American visitor never meets a language picker they have no use for.
import { useEffect, useState } from "react"
import { offerArabic, setUiLang, type UiLang } from "@/lib/airraw/ui-lang"
import { useT } from "@/lib/airraw/i18n"

export function LangToggle({ style }: { style?: React.CSSProperties }) {
  const t = useT()
  const [show, setShow] = useState(false)
  useEffect(() => { setShow(offerArabic()) }, [])
  if (!show) return null
  const pick = (l: UiLang) => { setUiLang(l); if (typeof window !== "undefined") window.location.reload() }
  const active = t.locale
  const btn = (l: UiLang, label: string) => (
    <button
      key={l}
      onClick={() => pick(l)}
      aria-pressed={active === l}
      lang={l}
      style={{
        minHeight: 34, padding: "0 14px", borderRadius: 999, cursor: "pointer",
        fontSize: 13, fontWeight: 600, fontFamily: "inherit",
        color: active === l ? "#06121e" : "rgba(240,232,255,.72)",
        background: active === l ? "#7fd6c0" : "rgba(255,255,255,.07)",
        border: active === l ? "none" : ".5px solid rgba(255,255,255,.16)",
        WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
      }}
    >
      {label}
    </button>
  )
  return (
    <div role="group" aria-label={t("app language")} style={{ display: "flex", gap: 8, justifyContent: "center", ...style }}>
      {/* Each label is written in its own language on purpose: whichever one you
          read, one of these two words is readable to you. */}
      {btn("ar", "عربي")}
      {btn("en", "English")}
    </div>
  )
}
