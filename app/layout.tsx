import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { isFun, SITE } from '@/lib/variant'
import './globals.css'

// Self-hosted Geist (variable woff2) — no build-time Google Fonts fetch, so the
// build never depends on fonts.gstatic.com being reachable. Same typeface.
const geist = localFont({
  src: "./fonts/Geist.woff2",
  variable: "--font-geist",
  display: "swap",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMono.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || `https://${SITE.domain}`
const NAME = SITE.name
const TITLE = isFun()
  ? "Abuseday.fun — No rules. No signup. No limits."
  : "Abuseday — A galaxy of planets. Pick yours."
const DESC = isFun()
  ? "Anonymous AI voice planets — no signup, no memory, no limits. Build a cast of AI characters with real voices and land on a planet of your own."
  : "A galaxy of unique AI planets — each one its own world, cast and vibe. Go solo one-on-one, or beam your friends onto the same planet with one link. Live voice and chat with Claude, Gemini and GPT, from the trading floor to deep space."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s · ${NAME}` },
  description: DESC,
  applicationName: NAME,
  generator: NAME,
  keywords: [
    "AI chat", "AI voice planets", "AI characters", "voice AI", "character AI",
    "AI roleplay", "voice cloning", "AI companion", "multiplayer AI",
    "group AI chat", "Abuseday",
  ],
  authors: [{ name: "Abuseday" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: NAME,
    title: TITLE,
    description: DESC,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  // Favicon + apple-touch icon are generated on-brand by app/icon.tsx and
  // app/apple-icon.tsx (Next file-convention) — no stale PNGs to maintain.
}

// Rich results: Organization + WebSite (with a sitelinks search box) +
// SoftwareApplication. One JSON-LD graph, emitted on every page.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/apple-icon`,
      description: DESC,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: NAME,
      description: DESC,
      publisher: { "@id": `${SITE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/app/rooms?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "SoftwareApplication",
      name: NAME,
      url: SITE_URL,
      applicationCategory: "CommunicationApplication",
      operatingSystem: "Web, iOS, Android",
      description: DESC,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free to chat — pay only for live voice." },
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`bg-background dark ${geist.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
        {children}
        <Toaster theme="system" richColors position="bottom-right" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
