import { ImageResponse } from "next/og"

export const alt = "AIRRAW — tap a face, talk right now"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Asset-free OG card: dark field, the wordmark, the hook, and a water→warm row of
// "faces" echoing the buffet. Rendered at request time by next/og.
export default function OpengraphImage() {
  const dots = ["#6fd6e6", "#7fd6c0", "#cdeef4", "#ffd98a", "#ffce7a", "#ffb27a", "#ff9c73"]
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 28,
          background: "radial-gradient(120% 120% at 50% 0%, #0e1726 0%, #06070e 60%)",
          color: "#eef4f8", fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", gap: 18 }}>
          {dots.map((c, i) => (
            <div key={i} style={{ width: 46, height: 46, borderRadius: 46, background: c, boxShadow: `0 0 26px ${c}` }} />
          ))}
        </div>
        <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: 12, display: "flex" }}>airraw</div>
        <div style={{ fontSize: 38, color: "#aebccb", display: "flex" }}>tap a face. talk right now.</div>
        <div style={{ fontSize: 24, color: "#7fd6c0", letterSpacing: 2, display: "flex" }}>it&apos;s the now</div>
      </div>
    ),
    { ...size }
  )
}
