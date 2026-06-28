import { ImageResponse } from "next/og"

// Favicon — generated, on-brand. A cosmic-gradient tile with a ringed planet.
export const runtime = "edge"
export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          background: "linear-gradient(135deg, #a855f7, #d946ef 50%, #fb923c)",
        }}
      >
        {/* the planet */}
        <div style={{ width: 13, height: 13, borderRadius: "50%", background: "#fff", display: "flex" }} />
        {/* the ring */}
        <div
          style={{
            position: "absolute",
            width: 28,
            height: 12,
            border: "2.5px solid rgba(255,255,255,0.85)",
            borderRadius: "50%",
            transform: "rotate(-25deg)",
          }}
        />
      </div>
    ),
    { ...size }
  )
}
