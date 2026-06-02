import { NextResponse } from "next/server"

let cache: { price: number; ts: number } | null = null
const TTL = 60_000 // 60s

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) {
    return NextResponse.json({ price: cache.price })
  }
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { next: { revalidate: 60 } }
    )
    const data = await res.json()
    const price: number = data?.solana?.usd ?? 150
    cache = { price, ts: Date.now() }
    return NextResponse.json({ price })
  } catch {
    return NextResponse.json({ price: cache?.price ?? 150 })
  }
}
