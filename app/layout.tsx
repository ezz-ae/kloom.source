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
  ? "Kloom.fun — No rules. No signup. Just fun."
  : "Kloom — Every conversation is a room"
const DESC = isFun()
  ? "Anonymous AI voice rooms — no signup, no memory, no limits. Build a cast of AI characters with real voices and jump straight in."
  : "Multi-AI voice rooms with Claude, Gemini and GPT. Build a cast of AI characters with real voices, or clone any voice from a video, and drop friends into the same room with one link — voice and chat, live, across worlds from the trading floor to deep talk."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s · ${NAME}` },
  description: DESC,
  applicationName: NAME,
  generator: NAME,
  keywords: [
    "AI chat", "AI voice rooms", "AI characters", "voice AI", "character AI",
    "AI roleplay", "voice cloning", "AI companion", "multiplayer AI",
    "group AI chat", "Kloom",
  ],
  authors: [{ name: "Kloom" }],
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
  icons: {
    icon: [
      { url: '/kloom-icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/kloom-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/kloom-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/kloom-apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`bg-background dark ${geist.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster theme="system" richColors position="bottom-right" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
