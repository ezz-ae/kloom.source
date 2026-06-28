import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Abuseday — A galaxy of planets. Pick yours."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "radial-gradient(120% 120% at 75% 15%, #2a1530 0%, #14101a 45%, #0c0a10 100%)",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            fontSize: 30,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "#f59e0b",
            fontWeight: 700,
            marginBottom: 24,
          }}
        >
          Abuseday
        </div>
        <div
          style={{
            fontSize: 92,
            fontWeight: 800,
            color: "#f5f3f0",
            lineHeight: 1.05,
            letterSpacing: -2,
          }}
        >
          A galaxy of
        </div>
        <div
          style={{
            fontSize: 92,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -2,
            background: "linear-gradient(90deg, #fbbf24, #f97316 55%, #fb7185)",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          planets.
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 30,
            color: "rgba(245,243,240,0.6)",
            fontFamily: "system-ui, sans-serif",
            maxWidth: 760,
          }}
        >
          Each one its own world. Go solo, or beam your friends onto the same planet with one link.
        </div>
      </div>
    ),
    { ...size }
  )
}
