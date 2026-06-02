"use client"

import { useState, useEffect, useCallback } from "react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { PublicKey } from "@solana/web3.js"
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token"

const MINT_ADDR = process.env.NEXT_PUBLIC_BLOOM_MINT

export function useBloomBalance() {
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!publicKey || !MINT_ADDR) return
    setLoading(true)
    try {
      const mint = new PublicKey(MINT_ADDR)
      const ata  = await getAssociatedTokenAddress(mint, publicKey)
      const acct = await getAccount(connection, ata)
      // 6 decimals
      setBalance(Number(acct.amount) / 1_000_000)
    } catch {
      setBalance(0)
    } finally {
      setLoading(false)
    }
  }, [publicKey, connection])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { balance, loading, refresh, mintConfigured: !!MINT_ADDR }
}
