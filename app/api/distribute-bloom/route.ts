/**
 * POST /api/distribute-bloom
 *
 * Called by /api/verify-payment after confirming a SOL purchase.
 * Sends $BLOOM tokens from the treasury to the buyer's wallet.
 *
 * Body: { walletAddress: string, amount: number }
 * amount = number of $BLOOM tokens (human units, e.g. 30 for 30 tokens)
 */

import { NextRequest, NextResponse } from "next/server"
import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js"
import {
  getOrCreateAssociatedTokenAccount,
  transfer,
  getMint,
} from "@solana/spl-token"
import { getAdminClient } from "@/lib/supabase-admin"

const RPC          = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.mainnet-beta.solana.com"
const MINT_ADDR    = process.env.NEXT_PUBLIC_BLOOM_MINT
const PRIV_HEX     = process.env.TREASURY_PRIVATE_KEY_HEX
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(req: NextRequest) {
  if (!MINT_ADDR) {
    return NextResponse.json({ error: "bloom_mint_not_configured" }, { status: 503 })
  }
  if (!PRIV_HEX) {
    return NextResponse.json({ error: "treasury_key_not_configured" }, { status: 503 })
  }

  const { walletAddress, amount } = await req.json()
  if (!walletAddress || !amount || amount <= 0) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 })
  }

  const connection = new Connection(RPC, "confirmed")
  const treasury   = Keypair.fromSecretKey(Buffer.from(PRIV_HEX, "hex"))
  const mint       = new PublicKey(MINT_ADDR)
  const recipient  = new PublicKey(walletAddress)

  try {
    const mintInfo    = await getMint(connection, mint)
    const rawAmount   = BigInt(Math.round(amount * 10 ** mintInfo.decimals))

    // Treasury's token account (source)
    const fromATA = await getOrCreateAssociatedTokenAccount(
      connection, treasury, mint, treasury.publicKey
    )

    // Recipient's token account — created and funded by treasury if it doesn't exist
    const toATA = await getOrCreateAssociatedTokenAccount(
      connection, treasury, mint, recipient
    )

    const sig = await transfer(
      connection,
      treasury,
      fromATA.address,
      toATA.address,
      treasury,
      rawAmount
    )

    // Record in Supabase
    const sb = getAdminClient()
    await sb.rpc("credit_wallet", {
      p_wallet: walletAddress,
      p_credits: 0,          // credits already added by verify-payment
      p_tx_sig: `bloom_dist_${sig}`,
      p_amount_sol: 0,
      p_kind: "purchase",
    }).catch(() => {})

    // Update bloom_balance column
    await sb
      .from("bloom_credits")
      .upsert({ wallet_address: walletAddress, bloom_balance: amount }, { onConflict: "wallet_address" })
      .then(() => {})
      .catch(() => {})

    return NextResponse.json({ ok: true, signature: sig, amount, mint: MINT_ADDR })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
