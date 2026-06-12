import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import './globals.css'

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://untitled-chat-2-eight.vercel.app"
const TITLE = "Kloom — Every conversation is a room"
const DESC =
  "Build a cast of AI characters with real voices, or clone any voice from a video. Drop friends into the same room with one link — voice and chat, live, across 11 worlds from the trading floor to after dark."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · Kloom" },
  description: DESC,
  applicationName: "Kloom",
  generator: "Kloom",
  keywords: [
    "AI chat", "AI voice rooms", "AI characters", "voice AI", "character AI",
    "AI roleplay", "voice cloning", "AI companion", "multiplayer AI",
    "group AI chat", "Kloom",
  ],
  authors: [{ name: "Kloom" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Kloom",
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
