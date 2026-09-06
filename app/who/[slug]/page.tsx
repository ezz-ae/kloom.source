import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { BRAND, SITE_URL } from "@/lib/brand"
import { PUBLIC_CAST_SIZE, indexForSlug, publicProfile, neighbours, accentFor, slugFor } from "@/lib/airraw/public-cast"

// ONE PERSON, ONE PAGE — the site's whole search surface.
//
// This is a SERVER component with no client JavaScript and no image API call.
// Both are deliberate. A crawler has to be able to read the whole thing from the
// HTML it is handed, and a public page must never be able to spend money: the
// portrait endpoint is paid per generation, so nothing here asks it for one and
// the share card is drawn from the character's own colours instead.
//
// The copy is the character's dossier in her own voice — see lib/airraw/public-cast.
// That is what keeps 600 pages from being 600 templates, which is the difference
// between an asset and a thin-content penalty.

export const dynamic = "force-static"
export const dynamicParams = false

export function generateStaticParams() {
  // Nothing to build on Kloom. The layout already 404s there, but without this
  // the Kloom build would still walk the whole cast and prerender 600 adult
  // profile pages into the SFW deployment before that gate ever ran.
  if (process.env.AIRRAW_HOME !== "1") return []
  return Array.from({ length: PUBLIC_CAST_SIZE }, (_, i) => ({ slug: slugFor(i) }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const i = indexForSlug((await params).slug)
  if (i === null) return {}
  const p = publicProfile(i)
  const title = `${p.name} — ${p.work}`
  // The description is HER, not the product. A SERP snippet that says what this
  // person is like is a click; one that says "AI companion platform" is not.
  const description = `${p.says.work} ${p.says.where} ${p.says.onMind} Talk to ${p.name.toLowerCase()} out loud on ${BRAND}.`
  const url = `${SITE_URL}/who/${p.slug}`
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    // The card is a top-level route, not a colocated opengraph-image.tsx — a
    // file-based image route nested under this dynamic segment failed on every
    // render (see app/share/route.tsx for what was tried).
    openGraph: { title, description, url, siteName: BRAND, type: "profile", images: [{ url: `${SITE_URL}/share?i=${i}`, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [`${SITE_URL}/share?i=${i}`] },
    // Standard adult self-labelling. This does not deindex the page — Google
    // still crawls and ranks it — it classifies it for SafeSearch, which is what
    // keeps the domain in good standing instead of being treated as evasive.
    other: { rating: "RTA-5042-1996-1400-1577-RTA" },
  }
}

export default async function WhoPage({ params }: { params: Promise<{ slug: string }> }) {
  const i = indexForSlug((await params).slug)
  if (i === null) notFound()
  const p = publicProfile(i)
  const accent = accentFor(p.c)
  const others = neighbours(i)
  const her = p.pronoun === "he" ? "him" : "her"

  const facts: Array<[string, string]> = [
    ["what I do", p.says.work],
    ["where I am tonight", p.says.where],
    ["what's on my mind", p.says.onMind],
    ["what I'll argue about", p.says.opinion],
    ["what gets under my skin", p.says.peeve],
    ["how you'll know it's me", p.says.tell],
  ]

  return (
    <main style={{ minHeight: "100dvh", background: "radial-gradient(130% 90% at 50% 0%, #1a0828 0%, #0d0418 55%, #07040f 100%)", color: "#f0e8ff", fontFamily: "var(--font-geist), system-ui, sans-serif", padding: "28px 20px 64px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <Link href="/" style={{ color: `${accent}cc`, fontSize: 13, textDecoration: "none", letterSpacing: .3 }}>‹ {BRAND}</Link>

        <header style={{ marginTop: 26 }}>
          <div aria-hidden style={{ width: 92, height: 92, borderRadius: "50%", background: `radial-gradient(circle at 32% 28%, ${accent}, ${accent}22 70%, transparent)`, border: `.5px solid ${accent}55`, boxShadow: `0 20px 60px -20px ${accent}` }} />
          <h1 style={{ fontSize: 38, fontWeight: 700, margin: "20px 0 6px", letterSpacing: -.5 }}>{p.name}</h1>
          <p style={{ fontSize: 15, color: `${accent}dd`, margin: 0 }}>{p.work} · {p.where}</p>
        </header>

        <section style={{ marginTop: 34 }}>
          <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1.4, color: "rgba(240,232,255,.45)", fontWeight: 600 }}>in {p.pronoun === "he" ? "his" : "her"} words</h2>
          <dl style={{ margin: "16px 0 0" }}>
            {facts.map(([label, text]) => (
              <div key={label} style={{ padding: "14px 0", borderTop: ".5px solid rgba(255,255,255,.1)" }}>
                <dt style={{ fontSize: 12, color: "rgba(240,232,255,.5)", marginBottom: 5 }}>{label}</dt>
                <dd style={{ margin: 0, fontSize: 17, lineHeight: 1.5 }}>{text}</dd>
              </div>
            ))}
          </dl>
        </section>

        {p.lines.length > 0 && (
          <section style={{ marginTop: 34 }}>
            <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1.4, color: "rgba(240,232,255,.45)", fontWeight: 600 }}>how {p.pronoun} starts</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 10 }}>
              {p.lines.map((l, k) => (
                <li key={k} style={{ background: "rgba(255,255,255,.05)", border: ".5px solid rgba(255,255,255,.1)", borderRadius: 14, padding: "13px 16px", fontSize: 16, lineHeight: 1.45 }}>“{l}”</li>
              ))}
            </ul>
          </section>
        )}

        <section style={{ marginTop: 36 }}>
          <Link href={`/?who=${i}`} style={{ display: "block", textAlign: "center", background: accent, color: "#0d0418", fontWeight: 700, fontSize: 17, padding: "17px 20px", borderRadius: 15, textDecoration: "none" }}>
            talk to {p.name.toLowerCase()} out loud
          </Link>
          <p style={{ fontSize: 12.5, color: "rgba(240,232,255,.45)", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
            {BRAND} is 18+. {p.name} is an AI character with a real voice — some voices here are real people, and you won&rsquo;t always know which.
          </p>
        </section>

        <section style={{ marginTop: 42 }}>
          <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1.4, color: "rgba(240,232,255,.45)", fontWeight: 600 }}>who else is on tonight</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 8 }}>
            {others.map((o) => (
              <li key={o.i}>
                <Link href={`/who/${o.slug}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 13, background: "rgba(255,255,255,.04)", border: ".5px solid rgba(255,255,255,.08)", color: "#f0e8ff", textDecoration: "none" }}>
                  <span aria-hidden style={{ width: 34, height: 34, flex: "0 0 auto", borderRadius: "50%", background: `radial-gradient(circle at 32% 28%, ${accentFor(o.c)}, ${accentFor(o.c)}22 70%, transparent)` }} />
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ fontWeight: 600 }}>{o.name}</strong>
                    <span style={{ display: "block", fontSize: 13, color: "rgba(240,232,255,.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.work} · {o.where}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/who" style={{ display: "inline-block", marginTop: 18, fontSize: 14, color: `${accent}cc`, textDecoration: "none" }}>see everyone on the floor →</Link>
        </section>
      </div>

      {/* Structured data: tells Google this page is about a PERSON with a name and
          a description, which is what earns the richer result rather than a bare
          blue link. Marked as fictional via the description, never as a real person. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: `${SITE_URL}/who/${p.slug}`,
          name: `${p.name} — ${p.work}`,
          description: `${p.says.work} ${p.says.where}`,
          isFamilyFriendly: false,
          mainEntity: { "@type": "Person", name: p.name, description: `A fictional AI character on ${BRAND}. ${p.says.work}`, knowsAbout: p.says.opinion },
        }) }}
      />
    </main>
  )
}
