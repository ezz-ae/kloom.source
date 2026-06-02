import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

const COIN_IDS: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin",
  USDT: "tether", USDC: "usd-coin", XRP: "ripple", ADA: "cardano",
  AVAX: "avalanche-2", DOT: "polkadot", MATIC: "matic-network", LINK: "chainlink",
  UNI: "uniswap", ATOM: "cosmos", LTC: "litecoin", DOGE: "dogecoin",
  SHIB: "shiba-inu", PEPE: "pepe", JTO: "jito-governance-token",
  JUP: "jupiter-exchange-solana", BONK: "bonk", WIF: "dogwifcoin",
  PYTH: "pyth-network", RAY: "raydium", ORCA: "orca", MNGO: "mango-markets",
  SRM: "serum", FIDA: "bonfida", MSOL: "msol", JITOSOL: "jito-staked-sol",
  BSOL: "blazestake-staked-sol", WBTC: "wrapped-bitcoin",
}

async function fetchCoinGecko(ids: string, extras = ""): Promise<any> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true${extras}`
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
  return res.json()
}

export function registerCryptoTools(server: McpServer) {

  server.registerTool(
    "ora_get_crypto_price",
    {
      title: "Get Crypto Price",
      description: `Get live price, 24h change, market cap, and volume for any cryptocurrency.

ALWAYS use this tool when the user mentions a token symbol or asks about prices.
Do not guess prices from training data — they will be wrong.

Args:
  - symbol (string): Coin ticker symbol (BTC, ETH, SOL, etc.) or full name

Returns:
  - symbol: Uppercase ticker
  - price_usd: Current USD price
  - change_24h: 24-hour percentage change
  - market_cap_usd: Market cap in USD
  - volume_24h_usd: 24h trading volume
  - sentiment: derived from change (bullish / bearish / neutral)

Errors:
  - "Not found" if symbol is unknown — try get_token_info for lesser-known tokens`,
      inputSchema: {
        symbol: z.string().min(1).max(20).describe("Coin symbol e.g. BTC, ETH, SOL, or full name"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ symbol }) => {
      const upper  = symbol.toUpperCase().trim()
      const coinId = COIN_IDS[upper] ?? symbol.toLowerCase()
      try {
        const data = await fetchCoinGecko(coinId)
        const coin = data[coinId]
        if (!coin) {
          return { content: [{ type: "text" as const, text: `Price for "${symbol}" not found. Try ora_get_token_info.` }] }
        }
        const change   = Number(coin.usd_24h_change ?? 0)
        const sentiment = change > 3 ? "bullish 🟢" : change < -3 ? "bearish 🔴" : "neutral 🟡"
        const output   = {
          symbol:         upper,
          coin_id:        coinId,
          price_usd:      coin.usd,
          change_24h:     `${change.toFixed(2)}%`,
          market_cap_usd: coin.usd_market_cap ?? null,
          volume_24h_usd: coin.usd_24h_vol ?? null,
          sentiment,
          timestamp:      new Date().toISOString(),
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        }
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Price fetch failed: ${(err as Error).message}` }] }
      }
    }
  )

  server.registerTool(
    "ora_get_multi_price",
    {
      title: "Get Multiple Crypto Prices",
      description: `Get live prices for multiple cryptocurrencies in a single call. Use for portfolio analysis or comparative views.

Args:
  - symbols (array of strings): Up to 10 coin symbols

Returns: Array of price objects, same schema as ora_get_crypto_price`,
      inputSchema: {
        symbols: z.array(z.string().min(1).max(20)).min(1).max(10).describe("Array of coin symbols, max 10"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ symbols }) => {
      const ids = symbols.map((s) => COIN_IDS[s.toUpperCase()] ?? s.toLowerCase()).join(",")
      try {
        const data = await fetchCoinGecko(ids)
        const results = symbols.map((s) => {
          const coinId = COIN_IDS[s.toUpperCase()] ?? s.toLowerCase()
          const coin   = data[coinId]
          if (!coin) return { symbol: s.toUpperCase(), error: "not found" }
          const change = Number(coin.usd_24h_change ?? 0)
          return {
            symbol:     s.toUpperCase(),
            price_usd:  coin.usd,
            change_24h: `${change.toFixed(2)}%`,
            market_cap: coin.usd_market_cap ?? null,
            sentiment:  change > 3 ? "bullish" : change < -3 ? "bearish" : "neutral",
          }
        })
        return {
          content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
          structuredContent: { prices: results },
        }
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Multi-price fetch failed: ${(err as Error).message}` }] }
      }
    }
  )

  server.registerTool(
    "ora_get_token_info",
    {
      title: "Get Token Info",
      description: `Search for any token by name or mint address and get full market data.
Use when ora_get_crypto_price fails or when user mentions a token by name rather than symbol.

Args:
  - identifier (string): Token name, symbol, or contract/mint address`,
      inputSchema: {
        identifier: z.string().min(1).max(100).describe("Token name, symbol, or mint address"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ identifier }) => {
      try {
        const searchRes  = await fetch(
          `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(identifier)}`,
          { signal: AbortSignal.timeout(6000) }
        )
        const searchData = await searchRes.json() as any
        const coin       = searchData.coins?.[0]
        if (!coin) {
          return { content: [{ type: "text" as const, text: `Token "${identifier}" not found on CoinGecko.` }] }
        }
        const priceData = await fetchCoinGecko(coin.id)
        const price     = priceData[coin.id]
        const change    = Number(price?.usd_24h_change ?? 0)
        const output    = {
          name:        coin.name,
          symbol:      coin.symbol?.toUpperCase(),
          coin_id:     coin.id,
          market_rank: coin.market_cap_rank,
          price_usd:   price?.usd ?? null,
          change_24h:  price ? `${change.toFixed(2)}%` : null,
          market_cap:  price?.usd_market_cap ?? null,
          sentiment:   price ? (change > 3 ? "bullish" : change < -3 ? "bearish" : "neutral") : null,
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        }
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Token lookup failed: ${(err as Error).message}` }] }
      }
    }
  )
}
