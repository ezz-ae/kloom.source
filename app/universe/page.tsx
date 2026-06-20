import type { Metadata } from "next"
import { ZoomBuffet } from "@/components/airroom/ZoomBuffet"

export const metadata: Metadata = {
  title: { absolute: "AIRRAW — the whole universe" },
  description:
    "Fall in: 20 worlds → ~1,000 rooms → endless voices. Tap any face to air off, or step into a room where real people and AI mingle and you can't always tell which is which.",
  alternates: { canonical: "https://airraw.com/universe" },
  openGraph: {
    title: "AIRRAW — the whole universe",
    description: "20 worlds, ~1,000 rooms, endless voices. Tap a face, air off, or step into a room.",
    url: "https://airraw.com/universe",
    siteName: "AIRRAW",
    type: "website",
  },
}

// AIRRAW — the deep-zoom universe: 20 worlds → ~1,000 rooms → ∞ voices.
export default function UniversePage() {
  return <ZoomBuffet />
}
