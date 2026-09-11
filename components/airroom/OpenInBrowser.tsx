"use client"

// One line at the top of the front door — the planet, which is what "/" renders
// — for visitors inside the Facebook / Instagram / TikTok in-app browser: voice
// needs their real browser, here is the way there. See lib/airraw/in-app.ts for
// the measurement behind it. Fixed to the top of the viewport (the planet's UI is
// a fixed full-screen layer), under the sheets (zIndex 40) so it never covers a
// checkout.
//
// Shown once per browser (dismissed is remembered). Never on a real browser.
// It does not block anything — the page underneath works as far as a webview
// lets it (she still talks; you can still type).
import { useEffect, useState } from "react"
import { useT } from "@/lib/airraw/i18n"
import { inAppBrowser, openInBrowserUrl, type InApp } from "@/lib/airraw/in-app"
import { track } from "@/lib/airraw/track"

const KEY = "airraw_inapp_dismissed"

export function OpenInBrowser() {
  const t = useT()
  const [app, setApp] = useState<InApp>(null)
  const [href, setHref] = useState<string | null>(null)
  useEffect(() => {
    const a = inAppBrowser()
    if (!a) return
    try { if (localStorage.getItem(KEY) === "1") return } catch { /* private mode: show it */ }
    setApp(a); setHref(openInBrowserUrl())
    track("inapp_shown", { app: a, android: !!openInBrowserUrl() })
  }, [])
  if (!app) return null
  const dismiss = () => { setApp(null); try { localStorage.setItem(KEY, "1") } catch { /* */ } }
  return (
    <div role="status" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 35, display: "flex", alignItems: "center", gap: 10, padding: "max(10px, env(safe-area-inset-top)) 14px 10px", background: "rgba(255,217,138,.96)", color: "#1a0d2a", fontSize: 13, lineHeight: 1.35, fontFamily: "system-ui, sans-serif" }}>
      <span aria-hidden>🎙</span>
      <span style={{ flex: 1 }}>
        {href
          ? t("voice needs your real browser.")
          : t("voice needs your real browser — tap ⋯ at the top, then “open in browser”.")}
      </span>
      {href && (
        <a href={href} onClick={() => track("inapp_open_tap", { app })} style={{ flexShrink: 0, background: "#1a0d2a", color: "#ffd98a", textDecoration: "none", fontWeight: 600, padding: "7px 12px", borderRadius: 999, fontSize: 13 }}>{t("open in Chrome")}</a>
      )}
      <button onClick={dismiss} aria-label={t("dismiss")} style={{ flexShrink: 0, background: "transparent", border: "none", color: "#1a0d2a", fontSize: 18, lineHeight: 1, padding: "2px 4px", cursor: "pointer" }}>×</button>
    </div>
  )
}
