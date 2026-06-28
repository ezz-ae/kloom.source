import { ImageResponse } from "next/og"

// Apple touch icon — generated, on-brand. Same ringed-planet mark, scaled up.
export const runtime = "edge"
export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #a855f7, #d946ef 50%, #fb923c)",
        }}
      >
        {/* the planet */}
        <div style={{ width: 74, height: 74, borderRadius: "50%", background: "#fff", display: "flex" }} />
        {/* the ring */}
        <div
          style={{
            position: "absolute",
            width: 156,
            height: 66,
            border: "13px solid rgba(255,255,255,0.85)",
            borderRadius: "50%",
            transform: "rotate(-25deg)",
          }}
        />
      </div>
    ),
    { ...size }
  )
}
