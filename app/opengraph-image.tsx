import { ImageResponse } from "next/og"
import { isAbuseday } from "@/lib/variant"

export const runtime = "edge"
export const alt = isAbuseday()
  ? "Abuseday — A galaxy of planets"
  : "Kloom — Every conversation is a room"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Variant-aware brand art: Kloom keeps its amber "is a room" card; Abuseday
// gets the cosmic "galaxy of planets" card. Kloom's image is byte-identical.
const AD = isAbuseday()
const WORDMARK = AD ? "Abuseday" : "Kloom"
const LINE1 = AD ? "A galaxy of" : "Every conversation"
const LINE2 = AD ? "planets." : "is a room."
const SUBTITLE = AD
  ? "Each one its own world. Go solo, or beam your friends onto the same planet with one link."
  : "AI characters with real voices. Friends in the same room with one link. 11 worlds."
const GRAD = AD
  ? "linear-gradient(90deg, #c084fc, #e879f9 55%, #fbbf24)"
  : "linear-gradient(90deg, #fbbf24, #f97316 55%, #fb7185)"

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
          {WORDMARK}
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
          {LINE1}
        </div>
        <div
          style={{
            fontSize: 92,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -2,
            background: GRAD,
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {LINE2}
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
          {SUBTITLE}
        </div>
      </div>
    ),
    { ...size }
  )
}
