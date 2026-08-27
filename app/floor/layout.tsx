import { BRAND, SITE_URL } from "@/lib/brand"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

// The floor is the AIRRAW (airraw.com) ad surface and carries a placeholder 18+
// gate. It must NEVER be reachable on the Kloom (kloom.io / .fun / .me) deployments,
// where it would expose an adult-implying page with no real age check on the SFW
// ad domain. AIRRAW_HOME is the server-only brand env, set only on the AIRRAW deploy.
const IS_AIRRAW = process.env.AIRRAW_HOME === "1"

// The floor is a client component, so its metadata lives here on the route segment.
export const metadata: Metadata = {
  title: { absolute: `${BRAND} — walk the floor` },
  description:
    "Drift down the water→fire floor and overhear whoever you're nearest. Stop, listen, join. It's the now.",
  // The floor is the live 18+ chat surface — keep it out of search indexes.
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/floor` },
  openGraph: {
    title: `${BRAND} — walk the floor`,
    description: "Drift the water→fire floor and overhear whoever you're near. Stop, listen, join.",
    url: `${SITE_URL}/floor`,
    siteName: BRAND,
    type: "website",
  },
}

export default function FloorLayout({ children }: { children: React.ReactNode }) {
  if (!IS_AIRRAW) notFound()   // 404 on every Kloom deployment — AIRRAW-only surface
  return children
}
