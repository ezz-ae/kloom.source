"use client"

import { SolanaWalletProvider } from "@/components/solana-wallet-provider"
import { AppShell } from "@/components/app-shell/shell"
import "@solana/wallet-adapter-react-ui/styles.css"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SolanaWalletProvider>
      <AppShell>{children}</AppShell>
    </SolanaWalletProvider>
  )
}
