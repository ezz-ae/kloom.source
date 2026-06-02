"use client"

import { useMemo, type ReactNode } from "react"
import { clusterApiUrl } from "@solana/web3.js"
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react"
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui"
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets"

// Pull from .env.local if set, else fall back to public devnet endpoint so
// the connect flow still works for testing without a paid RPC.
const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("mainnet-beta")

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  )

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
