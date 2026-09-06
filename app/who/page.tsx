import type { Metadata } from "next"
import Link from "next/link"
import { BRAND, SITE_URL } from "@/lib/brand"
import { publicCast, accentFor } from "@/lib/airraw/public-cast"

// THE FLOOR INDEX — one page that links to every person.
//
// This is the crawl entry point. Without it, page 400 is reachable only through
// a chain of neighbour links and may never be found; with it, every character is
// one hop from a page in the sitemap. It is also the page that ranks for the
// broad queries, where an individual character page never could.
export const dynamic = "force-static"

export const metadata: Metadata = {
  title: { absolute: `Everyone on the floor tonight — ${BRAND}` },
  description: `Hundreds of voices, each one a person with a job, a room they're in tonight, and an opinion they'll argue with you about. Tap anyone and talk out loud. ${BRAND} is 18+.`,
  alternates: { canonical: `${SITE_URL}/who` },
  openGraph: { title: `Everyone on the floor tonight — ${BRAND}`, url: `${SITE_URL}/who`, siteName: BRAND, type: "website" },
  other: { rating: "RTA-5042-1996-1400-1577-RTA" },
}

export default function WhoIndex() {
  const cast = publicCast()
  return (
    <main style={{ minHeight: "100dvh", background: "radial-gradient(130% 90% at 50% 0%, #1a0828 0%, #0d0418 55%, #07040f 100%)", color: "#f0e8ff", fontFamily: "var(--font-geist), system-ui, sans-serif", padding: "28px 20px 64px" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <Link href="/" style={{ color: "rgba(240,232,255,.6)", fontSize: 13, textDecoration: "none" }}>‹ {BRAND}</Link>
        <h1 style={{ fontSize: 36, fontWeight: 700, margin: "24px 0 10px", letterSpacing: -.5 }}>Everyone on the floor tonight</h1>
        <p style={{ fontSize: 16, color: "rgba(240,232,255,.6)", lineHeight: 1.55, margin: "0 0 8px", maxWidth: 620 }}>
          {cast.length} voices. Each one has a job, a room they&rsquo;re sitting in right now, something on their mind, and an opinion they will argue with you about. Tap anyone and talk out loud.
        </p>
        <p style={{ fontSize: 13, color: "rgba(240,232,255,.4)", margin: "0 0 30px" }}>18+ only.</p>

        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 7 }}>
          {cast.map((p) => (
            <li key={p.i}>
              <Link href={`/who/${p.slug}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,.04)", border: ".5px solid rgba(255,255,255,.08)", color: "#f0e8ff", textDecoration: "none" }}>
                <span aria-hidden style={{ width: 30, height: 30, flex: "0 0 auto", borderRadius: "50%", background: `radial-gradient(circle at 32% 28%, ${accentFor(p.c)}, ${accentFor(p.c)}22 70%, transparent)` }} />
                <span style={{ minWidth: 0 }}>
                  <strong style={{ fontWeight: 600 }}>{p.name}</strong>
                  <span style={{ display: "block", fontSize: 13, color: "rgba(240,232,255,.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.work} · {p.where}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
