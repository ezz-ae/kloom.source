"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useWallet, useConnection } from "@solana/wallet-adapter-react"
import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js"
import { supabase } from "@/lib/supabase"
import { refreshAccountStatus } from "@/lib/account"

const TREASURY = new PublicKey(
  process.env.NEXT_PUBLIC_TREASURY_WALLET || "ATwss5yaDyyn1gPkndehaFhEtzNiV1U8KodFFbraLXQf"
)

export type PurchaseState = "idle" | "signing" | "confirming" | "crediting" | "done" | "error"

export function useSolCredits() {
  const { publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()

  const [balance, setBalance] = useState(0)
  const [solPrice, setSolPrice] = useState(150)
  const [purchaseState, setPurchaseState] = useState<PurchaseState>("idle")
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const priceRef = useRef(150)

  // Fetch live SOL price
  useEffect(() => {
    fetch("/api/sol-price")
      .then((r) => r.json())
      .then((d) => {
        setSolPrice(d.price)
        priceRef.current = d.price
      })
      .catch(() => {})
  }, [])

  // Load credits from Supabase when wallet connects
  useEffect(() => {
    if (!publicKey) return
    const wallet = publicKey.toBase58()
    supabase
      .from("bloom_credits")
      .select("balance")
      .eq("wallet_address", wallet)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setBalance(data.balance)
      })
    // Mirror real premium/subscription status (Ziina) into localStorage so
    // isSubscribed() reflects actual paid state for this wallet.
    refreshAccountStatus(wallet)
  }, [publicKey])

  const usdToSol = useCallback(
    (usd: number) => usd / priceRef.current,
    []
  )

  const buySol = useCallback(
    async (usdAmount: number, credits: number) => {
      if (!publicKey || !sendTransaction) {
        setPurchaseError("Connect your wallet first")
        setPurchaseState("error")
        return false
      }

      setPurchaseState("signing")
      setPurchaseError(null)

      const sol = usdToSol(usdAmount)
      const lamports = Math.round(sol * LAMPORTS_PER_SOL)

      try {
        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: TREASURY,
            lamports,
          })
        )

        const { blockhash } = await connection.getLatestBlockhash()
        tx.recentBlockhash = blockhash
        tx.feePayer = publicKey

        setPurchaseState("confirming")
        const sig = await sendTransaction(tx, connection)

        // Wait for confirmation
        await connection.confirmTransaction(sig, "confirmed")

        setPurchaseState("crediting")
        const res = await fetch("/api/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txSignature: sig,
            walletAddress: publicKey.toBase58(),
            creditsExpected: credits,
            solExpected: sol,
          }),
        })

        const result = await res.json()
        if (!res.ok || !result.ok) {
          throw new Error(result.error || "verification_failed")
        }

        setBalance((b) => b + credits)
        setPurchaseState("done")
        setTimeout(() => setPurchaseState("idle"), 3000)
        return true
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "unknown_error"
        setPurchaseError(msg)
        setPurchaseState("error")
        setTimeout(() => setPurchaseState("idle"), 5000)
        return false
      }
    },
    [publicKey, sendTransaction, connection, usdToSol]
  )

  const spendCredits = useCallback(
    async (amount: number, kind: "call_billing" | "gift_sent") => {
      if (!publicKey) return false
      setBalance((b) => Math.max(0, b - amount))
      // Deduct server-side (service role). The browser never touches credit_wallet
      // directly — that mint path is revoked for anon.
      fetch("/api/spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: publicKey.toBase58(), amount, kind }),
      }).catch(() => {})
      return true
    },
    [publicKey]
  )

  return {
    balance,
    solPrice,
    usdToSol,
    buySol,
    spendCredits,
    purchaseState,
    purchaseError,
    isWalletConnected: !!publicKey,
  }
}
