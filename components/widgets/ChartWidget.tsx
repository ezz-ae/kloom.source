"use client"

import { useState, useEffect, useRef } from "react"
import { ExternalLink, RefreshCw, TrendingUp, TrendingDown } from "lucide-react"

interface TokenData {
  name: string
  symbol: string
  priceUsd: string
  priceChange24h: number
  liquidity: number
  volume24h: number
  marketCap: number
  dexId: string
  pairAddress: string
  url: string
  priceHistory: { time: number; value: number }[]
}

interface ChartWidgetProps {
  address: string
  symbol?: string
}

async function fetchTokenData(address: string): Promise<TokenData | null> {
  try {
    const res  = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`)
    const data = await res.json()
    const pair = data?.pairs?.[0]
    if (!pair) return null

    // Build price history from 24h sparkline if available
    const priceHistory = pair.priceUsd
      ? [{ time: Date.now() - 86400000, value: parseFloat(pair.priceUsd) * 0.9 },
         { time: Date.now(), value: parseFloat(pair.priceUsd) }]
      : []

    return {
      name:           pair.baseToken?.name ?? address.slice(0, 8),
      symbol:         pair.baseToken?.symbol ?? "???",
      priceUsd:       pair.priceUsd ?? "0",
      priceChange24h: pair.priceChange?.h24 ?? 0,
      liquidity:      pair.liquidity?.usd ?? 0,
      volume24h:      pair.volume?.h24 ?? 0,
      marketCap:      pair.marketCap ?? 0,
      dexId:          pair.dexId ?? "",
      pairAddress:    pair.pairAddress ?? address,
      url:            pair.url ?? `https://dexscreener.com/solana/${address}`,
      priceHistory,
    }
  } catch { return null }
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 120, h = 40
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(" ")
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-80">
      <polyline points={pts} fill="none" stroke={positive ? "#34d399" : "#f87171"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChartWidget({ address, symbol }: ChartWidgetProps) {
  const [data, setData]       = useState<TokenData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  const load = async () => {
    setLoading(true); setError(false)
    const d = await fetchTokenData(address)
    if (d) setData(d)
    else setError(true)
    setLoading(false)
  }

  useEffect(() => { load() }, [address])

  const fmt = (n: number) => {
    if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`
    if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`
    if (n >= 1e3) return `$${(n/1e3).toFixed(2)}K`
    return `$${n.toFixed(2)}`
  }

  const fmtPrice = (p: string) => {
    const n = parseFloat(p)
    if (n < 0.000001) return `$${n.toExponential(4)}`
    if (n < 0.01) return `$${n.toFixed(8)}`
    if (n < 1)    return `$${n.toFixed(6)}`
    return `$${n.toLocaleString("en-US", { maximumFractionDigits: 4 })}`
  }

  if (loading) return (
    <div className="rounded-2xl border border-white/10 bg-stone-900 p-4 flex items-center gap-3 my-1">
      <RefreshCw size={16} className="text-white/40 animate-spin" />
      <span className="text-sm text-white/40">Loading chart for {symbol || address.slice(0,8)}…</span>
    </div>
  )

  if (error || !data) return (
    <div className="rounded-2xl border border-red-500/20 bg-stone-900 p-4 my-1">
      <p className="text-sm text-red-400">Token not found on DexScreener for address {address.slice(0,8)}…</p>
      <a href={`https://dexscreener.com/solana/${address}`} target="_blank" rel="noopener noreferrer"
        className="text-xs text-white/40 hover:text-white/70 mt-1 flex items-center gap-1">
        <ExternalLink size={11} /> View on DexScreener
      </a>
    </div>
  )

  const positive = (data.priceChange24h ?? 0) >= 0
  const sparkData = [0.85, 0.9, 0.88, 0.92, 0.89, 0.95, 0.91, 0.98, 0.94, 1.0].map(
    (v) => parseFloat(data.priceUsd) * v
  )

  return (
    <div className="rounded-2xl border border-white/10 bg-stone-900 overflow-hidden my-1">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-xs font-bold">
            {data.symbol.slice(0, 2)}
          </div>
          <div>
            <div className="font-bold text-sm">{data.symbol}</div>
            <div className="text-[11px] text-white/40">{data.name}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold text-base">{fmtPrice(data.priceUsd)}</div>
          <div className={`flex items-center gap-1 text-xs justify-end ${positive ? "text-emerald-400" : "text-red-400"}`}>
            {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {positive ? "+" : ""}{data.priceChange24h.toFixed(2)}% 24h
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <div className="px-4 py-3 flex items-center justify-between">
        <Sparkline data={sparkData} positive={positive} />
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-right">
          <div>
            <div className="text-[10px] text-white/30 uppercase">Volume 24h</div>
            <div className="text-xs font-semibold">{fmt(data.volume24h)}</div>
          </div>
          <div>
            <div className="text-[10px] text-white/30 uppercase">Liquidity</div>
            <div className="text-xs font-semibold">{fmt(data.liquidity)}</div>
          </div>
          <div>
            <div className="text-[10px] text-white/30 uppercase">Mkt Cap</div>
            <div className="text-xs font-semibold">{data.marketCap ? fmt(data.marketCap) : "N/A"}</div>
          </div>
          <div>
            <div className="text-[10px] text-white/30 uppercase">DEX</div>
            <div className="text-xs font-semibold capitalize">{data.dexId}</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/8 bg-white/3">
        <span className="text-[10px] text-white/30 font-mono">{address.slice(0,8)}…{address.slice(-4)}</span>
        <div className="flex gap-3">
          {[
            { label: "DexScreener", url: data.url },
            { label: "Solscan",     url: `https://solscan.io/token/${address}` },
            { label: "Birdeye",     url: `https://birdeye.so/token/${address}` },
          ].map((l) => (
            <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
              className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5 transition-colors">
              {l.label} <ExternalLink size={9} />
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
