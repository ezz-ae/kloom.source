import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Kloom — Every conversation is a room"
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
          Kloom
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
          Every conversation
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
          is a room.
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
          AI characters with real voices. Friends in the same room with one link. 11 worlds.
        </div>
      </div>
    ),
    { ...size }
  )
}
