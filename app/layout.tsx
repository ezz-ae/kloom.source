import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { isFun, SITE } from '@/lib/variant'
import { PixelScripts } from '@/components/airroom/PixelScripts'
import { ProClaim } from '@/components/ProClaim'
import { FunAgeGate } from '@/components/FunAgeGate'
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

// AIRRAW deploy is a distinct brand at the head level (server-only env, so no
// hydration concern). Everything below falls back to Kloom when AIRRAW_HOME unset.
const AIRRAW = process.env.AIRRAW_HOME === "1"
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || `https://${AIRRAW ? "airraw.com" : SITE.domain}`
const NAME = AIRRAW ? "AIRRAW" : SITE.name
const TITLE = AIRRAW
  ? "AIRRAW — tap a face, talk right now"
  : isFun()
    ? "Kloom.fun — No rules. No signup. Just fun."
    : "Kloom — Every conversation is a room"
const DESC = AIRRAW
  ? "A live voice lounge full of characters. Tap anyone and talk out loud — in a real voice, right now. Some are AI, real people drift in, and you can't always tell. It's the now."
  : isFun()
    ? "Anonymous AI voice rooms — no signup, no memory, no limits. Build a cast of AI characters with real voices and jump straight in."
    : "Multi-AI voice rooms with Claude, Gemini and GPT. Build a cast of AI characters with real voices, or clone any voice from a video, and drop friends into the same room with one link — voice and chat, live, across worlds from the trading floor to deep talk."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s · ${NAME}` },
  description: DESC,
  applicationName: NAME,
  generator: NAME,
  // Meta Business domain verification (paste the code from Business Settings →
  // Brand Safety → Domains). No-op until NEXT_PUBLIC_FB_DOMAIN_VERIFY is set.
  ...(process.env.NEXT_PUBLIC_FB_DOMAIN_VERIFY
    ? { other: { "facebook-domain-verification": process.env.NEXT_PUBLIC_FB_DOMAIN_VERIFY } }
    : {}),
  keywords: AIRRAW
    ? ["live voice chat", "AI voice", "talk to AI", "voice lounge", "AI characters", "voice AI", "AIRRAW", "it's the now"]
    : [
        "AI voice rooms", "talk to AI out loud", "AI voice chat", "AI voice call",
        "Claude voice", "Gemini voice", "GPT voice", "talk to Claude Gemini GPT",
        "multi-AI chat", "multiple AI models", "AI characters", "character AI",
        "AI roleplay", "AI companion", "group AI chat", "real-time AI voice",
        "voice cloning", "clone a voice from YouTube", "AI conversation app",
        "free AI chat", "Kloom", "kloom.io",
      ],
  authors: [{ name: NAME }],
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
  // Airraw has no Kloom-branded favicon, so omit icons there (falls back to the
  // default) rather than serving a Kloom icon on airraw.com.
  icons: AIRRAW ? undefined : {
    icon: [
      { url: '/kloom-icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/kloom-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/kloom-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/kloom-apple-icon.png',
  },
}

// Rich results. On AIRRAW, a clean WebSite/Organization for airraw.com (no Kloom
// search action, logo, or software-offer). On Kloom, the full graph.
// Mobile: cover the notch so safe-area insets resolve, and let dvh-based layouts
// account for the browser toolbar (the call/send buttons were hiding under it).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#06070e",
}

const JSON_LD = AIRRAW ? {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: NAME, url: SITE_URL, description: DESC },
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: NAME, description: DESC, publisher: { "@id": `${SITE_URL}/#organization` } },
  ],
} : {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/kloom-icon-512.png`,
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
        <FunAgeGate />
        <ProClaim />
        <Toaster theme="system" richColors position="bottom-right" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
        <PixelScripts />
      </body>
    </html>
  )
}
