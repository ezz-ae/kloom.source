"use client"

// THE PAGE ITSELF FACES THE WAY THE LANGUAGE READS.
//
// AirShell set `dir` on its own container, so the tabs mirrored — and nothing
// else did. The front door, the onboarding gate, the call screen and every
// sheet live OUTSIDE that container, on the planet's own full-screen layer, and
// they were laid out left-to-right for an Arabic visitor: the back button on
// the left of a call, the hint row reading away from the text it belongs to,
// and mixed Arabic/Latin lines ("AIRRAW هلا") ordered by the browser's bidi
// guess rather than by the page.
//
// One write on the document element fixes all of them at once, because `dir` is
// inherited. Kloom never mounts this: adultEnabled() is false there.
import { useEffect } from "react"
import { adultEnabled } from "@/lib/variant"
import { currentLocale, isRTL } from "@/lib/airraw/i18n"

export function PageDirection() {
  useEffect(() => {
    if (!adultEnabled() || typeof document === "undefined") return
    const apply = () => {
      try {
        const l = currentLocale()
        const el = document.documentElement
        el.dir = isRTL(l) ? "rtl" : "ltr"
        el.lang = l
      } catch { /* never let a direction break the page */ }
    }
    apply()
    // The language is choosable from inside the product (the pass sheet, the You
    // page), and a choice that only takes effect on the next reload reads as a
    // control that does nothing.
    window.addEventListener("airraw:langs", apply)
    window.addEventListener("focus", apply)
    return () => { window.removeEventListener("airraw:langs", apply); window.removeEventListener("focus", apply) }
  }, [])
  return null
}
