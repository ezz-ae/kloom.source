import type { Metadata } from "next"

// The floor is a client component, so its metadata lives here on the route segment.
export const metadata: Metadata = {
  title: { absolute: "AIRRAW — walk the floor" },
  description:
    "Drift down the water→fire floor and overhear whoever you're nearest. Stop, listen, join. It's the now.",
  alternates: { canonical: "https://airraw.com/floor" },
  openGraph: {
    title: "AIRRAW — walk the floor",
    description: "Drift the water→fire floor and overhear whoever you're near. Stop, listen, join.",
    url: "https://airraw.com/floor",
    siteName: "AIRRAW",
    type: "website",
  },
}

export default function FloorLayout({ children }: { children: React.ReactNode }) {
  return children
}
