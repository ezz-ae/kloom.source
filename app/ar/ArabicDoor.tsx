"use client"

/**
 * الباب العربي — the Arabic front door.
 *
 * A landing for the Gulf ad, and Arabic ONLY: no toggle, no English fallback,
 * no second language offered anywhere. Someone who arrives here has told us what
 * they speak by the ad they tapped, and being asked again — in English — is the
 * exact moment a visitor decides the product is not for them.
 *
 * It does the whole welcome itself rather than handing off mid-way, because the
 * app's own welcome is English and there is no i18n layer to borrow. Three
 * beats, the same three the English door has: age, name, mood. Then it sets the
 * language and sends them in, and everything downstream is already built for
 * this — the floor filters to Arabic speakers (matchesPrefs), characters open in
 * Arabic (nativeLanguageFor), and the voice pools cast Khaleeji and Levantine
 * rather than an English voice reading Arabic.
 *
 * RTL is on the container, not sprinkled per element: `dir="rtl"` flips the flex
 * and text direction for everything inside, so the layout is mirrored rather
 * than translated-in-place. Latin fragments (the wordmark) stay LTR inside it.
 *
 * THE AGE GATE IS NOT SKIPPABLE and is not a formality. It is the first beat,
 * before anything about the product is shown, and "under 18" leaves rather than
 * bouncing back to the same screen to try again.
 */
import { useState } from "react"
import { useRouter } from "next/navigation"
import { saveLangPrefs } from "@/lib/airraw/lang-prefs"
import { setEntryMood } from "@/lib/airraw/entry"
import { markOnboarded, setOnboardName } from "@/lib/airroom/onboard"

const MINT = "#7fd6c0"
const INK = "#050308"

/** The same four rooms the English door offers, in their own words. */
const MOODS: { label: string; sub: string; c: number }[] = [
  { label: "هادي وخافت", sub: "ركن جانبي، أصوات واطية", c: 0 },
  { label: "دافي وسهل", sub: "مكان بدأ يمتلي", c: 3 },
  { label: "كهربائي", sub: "سطح، والمدينة تحت", c: 5 },
  { label: "بلا حدود", sub: "الثالثة فجرًا، ما فيه شي تخسره", c: 6 },
]

export function ArabicDoor() {
  const router = useRouter()
  const [step, setStep] = useState<"age" | "name" | "mood" | "shaping">("age")
  const [name, setName] = useState("")

  const enter = () => {
    try { localStorage.setItem("airroom_18", "1") } catch { /* private mode */ }
    setStep("name")
  }

  const choose = (c: number) => {
    setStep("shaping")
    // Arabic and nothing else. `also: []` is the whole "no other languages"
    // instruction: spokenLanguages() returns Arabic alone, so the floor shows
    // only people who open in it and no character is told to expect a switch.
    saveLangPrefs({ primary: "Arabic", also: [] })
    setOnboardName(name)
    markOnboarded()
    setEntryMood(c)
    // One beat, then in. Same timing as the English door — long enough to read
    // the line, short enough that it is not a loading screen.
    setTimeout(() => router.push("/"), 1350)
  }

  return (
    <div dir="rtl" lang="ar" style={{
      position: "fixed", inset: 0, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, background: `radial-gradient(120% 90% at 50% 30%, #14101f 0%, ${INK} 70%)`,
      color: "#eef4f8", fontFamily: "var(--font-geist), system-ui, sans-serif", overflowY: "auto",
    }}>
      <div style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>

        {/* The wordmark is Latin and stays Latin — a brand is not translated. */}
        <div dir="ltr" style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: MINT, marginBottom: 14 }}>
          airraw
        </div>

        {step === "age" && (
          <div className="air-rise">
            <h1 style={{ fontSize: 25, fontWeight: 700, lineHeight: 1.45, margin: "0 0 12px" }}>
              اضغط على أي وجه… وتكلّم الحين
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.85, color: "rgba(238,244,248,.62)", margin: "0 0 22px" }}>
              صالة أصوات مباشرة. تدخل، تختار وجه، وتتكلّم معه بصوت حقيقي —
              بلا تسجيل وبلا إيميل.
            </p>
            <div style={{
              padding: "13px 15px", marginBottom: 16, borderRadius: 14,
              background: "rgba(255,255,255,.05)", border: ".5px solid rgba(255,255,255,.14)",
              fontSize: 14, lineHeight: 1.7, color: "rgba(238,244,248,.8)",
            }}>
              هذا المكان للبالغين فقط — <strong style={{ color: MINT }}>١٨ سنة فما فوق</strong>.
            </div>
            <button onClick={enter} style={btn(true)}>
              عمري ١٨ أو أكثر — ادخل
            </button>
            {/* Leaves, rather than returning to the same screen to guess again. */}
            <a href="https://www.google.com" style={{
              display: "block", marginTop: 12, fontSize: 13.5, color: "rgba(238,244,248,.45)", textDecoration: "none",
            }}>
              أقل من ١٨ — اخرج
            </a>
          </div>
        )}

        {step === "name" && (
          <div className="air-rise">
            <h1 style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.5, margin: "0 0 20px" }}>
              وش نناديك؟
            </h1>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setStep("mood") }}
              placeholder="اختياري — سمِّ نفسك أي اسم"
              autoFocus
              style={{
                width: "100%", fontSize: 16, color: "#eef4f8", background: "rgba(255,255,255,.07)",
                border: ".5px solid rgba(255,255,255,.18)", borderRadius: 14, padding: "14px 16px",
                minHeight: 50, boxSizing: "border-box", outline: "none", textAlign: "center",
                marginBottom: 16, fontFamily: "inherit",
              }}
            />
            <button onClick={() => setStep("mood")} style={btn(true)}>
              {name.trim() ? "كمّل ←" : "تخطَّ وادخل ←"}
            </button>
          </div>
        )}

        {step === "mood" && (
          <div className="air-rise">
            <h1 style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.5, margin: "0 0 6px" }}>
              وش مزاجك الحين؟
            </h1>
            <p style={{ fontSize: 13.5, color: "rgba(238,244,248,.45)", margin: "0 0 18px" }}>
              اختر وحدة — ونوديك عليها طوالي
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              {MOODS.map((m) => (
                <button key={m.c} onClick={() => choose(m.c)} style={{
                  width: "100%", minHeight: 62, borderRadius: 15, cursor: "pointer", fontFamily: "inherit",
                  background: "rgba(255,255,255,.05)", border: ".5px solid rgba(255,255,255,.14)",
                  color: "#eef4f8", padding: "10px 16px", textAlign: "right",
                  display: "flex", flexDirection: "column", justifyContent: "center", gap: 3,
                  WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
                }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{m.label}</span>
                  <span style={{ fontSize: 12.5, color: "rgba(238,244,248,.5)" }}>{m.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "shaping" && (
          <div className="air-rise">
            <h1 style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.6, margin: 0 }}>
              نجهّز لك المكان…
            </h1>
          </div>
        )}

        <p style={{ margin: "22px 0 0", fontSize: 12, lineHeight: 1.8, color: "rgba(238,244,248,.3)" }}>
          بلا تسجيل · بلا إيميل · تقدر تخرج في أي وقت
        </p>
      </div>
    </div>
  )
}

function btn(primary: boolean): React.CSSProperties {
  return {
    width: "100%", minHeight: 52, fontSize: 15.5, fontWeight: 700, fontFamily: "inherit",
    color: primary ? "#06121e" : "#eef4f8",
    background: primary ? MINT : "rgba(255,255,255,.06)",
    border: primary ? "none" : ".5px solid rgba(255,255,255,.16)",
    borderRadius: 15, cursor: "pointer",
    boxShadow: primary ? "0 12px 30px -10px rgba(127,214,192,.55)" : "none",
    WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
  }
}
