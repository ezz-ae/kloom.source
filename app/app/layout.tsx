"use client"

import { useEffect } from "react"
import { SolanaWalletProvider } from "@/components/solana-wallet-provider"
import { AppShell } from "@/components/app-shell/shell"
import { consumeSso } from "@/lib/sso"
import "@solana/wallet-adapter-react-ui/styles.css"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // If the user arrived via the .io → .fun "tap", restore their session so the
  // shared account + credits follow them. No-op without a hand-off token.
  useEffect(() => { consumeSso() }, [])
  return (
    <SolanaWalletProvider>
      <AppShell>{children}</AppShell>
    </SolanaWalletProvider>
  )
}
