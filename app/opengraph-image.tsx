import { BRAND, SITE_URL } from "@/lib/brand"
import { ImageResponse } from "next/og"

export const runtime = "edge"

// AIRRAW (airraw.com) and Kloom share this codebase; AIRRAW_HOME flags the AIRRAW
// deploy. The share/link-preview card MUST match the brand the visitor sees, or a
// paid AIRRAW ad share renders "Kloom" — wrong product, lost trust.
const AIRRAW = process.env.AIRRAW_HOME === "1"

export const alt = AIRRAW
  ? `${BRAND} — a sky of voices. tap anyone and talk, right now.`
  : "Kloom — Every conversation is a room"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
  if (AIRRAW) {
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
            background: "radial-gradient(120% 120% at 70% 10%, #1a2a3a 0%, #0e1622 45%, #080a10 100%)",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ fontSize: 30, letterSpacing: 10, textTransform: "uppercase", color: "#7fd6c0", fontWeight: 700, marginBottom: 24 }}>
            AIRRAW
          </div>
          <div style={{ fontSize: 110, fontWeight: 800, color: "#eef4f8", lineHeight: 1.02, letterSpacing: -2 }}>
            {"it's the now."}
          </div>
          <div style={{ marginTop: 36, fontSize: 34, color: "rgba(238,244,248,0.72)", maxWidth: 880, lineHeight: 1.3 }}>
            {"a whole sky of voices. tap anyone and talk out loud, right now — some are real, some aren't, and you won't always know."}
          </div>
        </div>
      ),
      { ...size }
    )
  }
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
        <div style={{ fontSize: 30, letterSpacing: 8, textTransform: "uppercase", color: "#f59e0b", fontWeight: 700, marginBottom: 24 }}>
          Kloom
        </div>
        <div style={{ fontSize: 92, fontWeight: 800, color: "#f5f3f0", lineHeight: 1.05, letterSpacing: -2 }}>
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
        <div style={{ marginTop: 40, fontSize: 30, color: "rgba(245,243,240,0.6)", fontFamily: "system-ui, sans-serif", maxWidth: 760 }}>
          AI characters with real voices. Friends in the same room with one link. 11 worlds.
        </div>
      </div>
    ),
    { ...size }
  )
}
