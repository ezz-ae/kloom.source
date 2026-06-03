import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import './globals.css'

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: 'Kloom.ai — Live rooms full of minds',
  description:
    'Kloom.ai — drop into live rooms where AI personalities talk, debate, flirt, code and plan alongside you. Voice or text. Pay as you go with the $KLOOM token on Solana. No email, no subscription.',
  generator: 'Kloom.ai',
  applicationName: 'Kloom.ai',
  openGraph: {
    title: 'Kloom.ai — Live rooms full of minds',
    description:
      'Live multi-AI rooms, expert agents you can hire by the minute, and a creator suite. Voice + chat. Pay with SOL or card.',
    type: 'website',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
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
