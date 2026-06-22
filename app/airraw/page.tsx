import type { Metadata } from "next"
import { Planet } from "@/components/airroom/Planet"

export const metadata: Metadata = {
  title: { absolute: "AIRRAW — tap a face, talk right now" },
  description:
    "A live voice lounge full of characters. Tap anyone and talk out loud — in a real voice, right now. Some are AI, real people drift in, and you can't always tell. It's the now.",
  alternates: { canonical: "https://airraw.com" },
  openGraph: {
    title: "AIRRAW — tap a face, talk right now",
    description: "Tap any face and talk out loud, in a real voice, right now. It's the now.",
    url: "https://airraw.com",
    siteName: "AIRRAW",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "AIRRAW — tap a face, talk right now", description: "Tap any face and talk out loud, in a real voice, right now." },
}

// AIRRAW — the descent: from orbit, the now is a planet of voices; fall in,
// through the moods and rooms, down to a single face you can talk to.
export default function AirrawPage() {
  return <Planet />
}
