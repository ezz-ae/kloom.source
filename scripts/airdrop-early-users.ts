/**
 * Airdrop $BLOOM to early users.
 *
 * Reads all wallet addresses from bloom_credits, sends each
 * AIRDROP_AMOUNT $BLOOM from the treasury.
 *
 * Run:  npx tsx scripts/airdrop-early-users.ts
 *
 * Required env vars:
 *   TREASURY_PRIVATE_KEY_HEX
 *   NEXT_PUBLIC_BLOOM_MINT
 *   NEXT_PUBLIC_SOLANA_RPC
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import "dotenv/config"
import { Connection, Keypair, PublicKey } from "@solana/web3.js"
import {
  getOrCreateAssociatedTokenAccount,
  transfer,
  getMint,
} from "@solana/spl-token"
import { createClient } from "@supabase/supabase-js"

const AIRDROP_AMOUNT = 100  // $BLOOM per early user

const RPC          = process.env.NEXT_PUBLIC_SOLANA_RPC!
const MINT_ADDR    = process.env.NEXT_PUBLIC_BLOOM_MINT!
const PRIV_HEX     = process.env.TREASURY_PRIVATE_KEY_HEX!
const SB_URL       = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY       = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function main() {
  if (!MINT_ADDR) { console.error("Set NEXT_PUBLIC_BLOOM_MINT first"); process.exit(1) }

  const connection = new Connection(RPC, "confirmed")
  const treasury   = Keypair.fromSecretKey(Buffer.from(PRIV_HEX, "hex"))
  const mint       = new PublicKey(MINT_ADDR)
  const sb         = createClient(SB_URL, SB_KEY)

  const { data: users, error } = await sb
    .from("bloom_credits")
    .select("wallet_address")
    .eq("bloom_airdropped", false)

  if (error || !users?.length) {
    console.log("No eligible users or error:", error?.message)
    return
  }

  console.log(`Airdropping ${AIRDROP_AMOUNT} $BLOOM to ${users.length} users…\n`)

  const mintInfo = await getMint(connection, mint)
  const raw      = BigInt(Math.round(AIRDROP_AMOUNT * 10 ** mintInfo.decimals))

  const fromATA = await getOrCreateAssociatedTokenAccount(
    connection, treasury, mint, treasury.publicKey
  )

  for (const { wallet_address } of users) {
    try {
      const toATA = await getOrCreateAssociatedTokenAccount(
        connection, treasury, mint, new PublicKey(wallet_address)
      )
      const sig = await transfer(connection, treasury, fromATA.address, toATA.address, treasury, raw)
      await sb.from("bloom_credits").update({ bloom_airdropped: true }).eq("wallet_address", wallet_address)
      await sb.from("bloom_airdrop_queue").insert({
        wallet_address,
        amount: AIRDROP_AMOUNT,
        status: "sent",
        tx_signature: sig,
      })
      console.log(`✅  ${wallet_address.slice(0, 8)}…  sig: ${sig.slice(0, 12)}…`)
    } catch (e) {
      console.error(`❌  ${wallet_address.slice(0, 8)}…  ${(e as Error).message}`)
      await sb.from("bloom_airdrop_queue").insert({
        wallet_address,
        amount: AIRDROP_AMOUNT,
        status: "failed",
      })
    }
  }

  console.log("\nDone.")
}

main().catch((e) => { console.error(e); process.exit(1) })
