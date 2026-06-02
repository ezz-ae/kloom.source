/**
 * Tool system for expert AI personas.
 * Each tool has: name, description, parameters schema, and an executor.
 * Used by /api/chat-tools — injected into the LLM tool_calls loop.
 */

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResult {
  tool_call_id: string
  content: string
}

// ── Tool definitions (OpenAI format) ─────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description: "Search the web for current news, prices, docs, or any real-time information.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_crypto_price",
      description: "Get the current price and 24h change for any cryptocurrency by symbol (BTC, ETH, SOL, etc.).",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Coin symbol e.g. BTC, ETH, SOL" },
        },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "calculate",
      description: "Evaluate a mathematical expression. Use for ROI, P&L, tokenomics math, position sizing.",
      parameters: {
        type: "object",
        properties: {
          expression: { type: "string", description: "A safe math expression, e.g. (1000 * 0.05) / 100" },
        },
        required: ["expression"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "analyze_code",
      description: "Analyze code for bugs, security issues, or quality. Returns a structured critique.",
      parameters: {
        type: "object",
        properties: {
          code:     { type: "string", description: "The code to analyze" },
          language: { type: "string", description: "Programming language" },
          focus:    { type: "string", description: "What to focus on: bugs | security | performance | style" },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_token_info",
      description: "Look up a Solana token by mint address or name — price, market cap, holders, liquidity.",
      parameters: {
        type: "object",
        properties: {
          identifier: { type: "string", description: "Token mint address or name" },
        },
        required: ["identifier"],
      },
    },
  },
]

// ── Executors ─────────────────────────────────────────────────────────────────

async function webSearch(query: string): Promise<string> {
  try {
    // DuckDuckGo Instant Answer API — free, no key needed
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    const res  = await fetch(url, { signal: AbortSignal.timeout(5000) })
    const data = await res.json()

    const results: string[] = []

    if (data.AbstractText) results.push(`Summary: ${data.AbstractText}`)

    if (data.RelatedTopics?.length) {
      const top = data.RelatedTopics.slice(0, 4)
        .filter((t: any) => t.Text)
        .map((t: any) => `• ${t.Text}`)
      if (top.length) results.push("Related:\n" + top.join("\n"))
    }

    if (data.Answer) results.push(`Answer: ${data.Answer}`)

    return results.length
      ? results.join("\n\n")
      : `No direct answer found for "${query}". Suggest a more specific query.`
  } catch {
    return `Search failed. Provide answer from training knowledge instead.`
  }
}

async function getCryptoPrice(symbol: string): Promise<string> {
  try {
    const id = COIN_ID_MAP[symbol.toUpperCase()] ?? symbol.toLowerCase()
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
    const res  = await fetch(url, { signal: AbortSignal.timeout(5000) })
    const data = await res.json()
    const coin = data[id]
    if (!coin) return `Price for ${symbol} not found. It may not be listed on CoinGecko.`

    const change = coin.usd_24h_change?.toFixed(2)
    const cap    = coin.usd_market_cap
      ? `$${(coin.usd_market_cap / 1e9).toFixed(2)}B`
      : "N/A"
    const sign   = change >= 0 ? "+" : ""

    return `${symbol.toUpperCase()}: $${coin.usd.toLocaleString("en-US", { maximumFractionDigits: 6 })} | 24h: ${sign}${change}% | MCap: ${cap}`
  } catch {
    return `Could not fetch price for ${symbol}. Network error.`
  }
}

function calculate(expression: string): string {
  try {
    // Safe eval: only allow math operators and numbers
    if (/[^0-9+\-*/.() %\s]/.test(expression)) {
      return "Invalid expression — only numbers and math operators allowed."
    }
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expression})`)()
    if (typeof result !== "number" || !isFinite(result)) return "Result is not a finite number."
    return `${expression} = ${result.toLocaleString("en-US", { maximumFractionDigits: 10 })}`
  } catch {
    return "Could not evaluate expression."
  }
}

function analyzeCode(code: string, language = "auto", focus = "bugs"): string {
  // This returns a structured prompt for the LLM to fill — the LLM itself does the analysis
  const lines = code.split("\n").length
  return `[Code submitted for analysis: ${lines} lines of ${language} code, focus: ${focus}. Analyze inline.]`
}

async function getTokenInfo(identifier: string): Promise<string> {
  try {
    // Try CoinGecko search first
    const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(identifier)}`
    const searchRes  = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) })
    const searchData = await searchRes.json()
    const coin       = searchData.coins?.[0]
    if (!coin) return `Token "${identifier}" not found on CoinGecko.`

    const priceUrl  = `https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
    const priceRes  = await fetch(priceUrl, { signal: AbortSignal.timeout(5000) })
    const priceData = await priceRes.json()
    const price     = priceData[coin.id]

    if (!price) return `${coin.name} (${coin.symbol.toUpperCase()}) found but price unavailable.`

    const change = price.usd_24h_change?.toFixed(2) ?? "N/A"
    const cap    = price.usd_market_cap ? `$${(price.usd_market_cap / 1e9).toFixed(3)}B` : "N/A"

    return `${coin.name} (${coin.symbol.toUpperCase()}): $${price.usd} | 24h: ${change}% | MCap: ${cap} | Rank: #${coin.market_cap_rank ?? "N/A"}`
  } catch {
    return `Could not fetch token info. Try using get_crypto_price instead.`
  }
}

// ── Coin ID lookup table ──────────────────────────────────────────────────────

const COIN_ID_MAP: Record<string, string> = {
  BTC:  "bitcoin",
  ETH:  "ethereum",
  SOL:  "solana",
  BNB:  "binancecoin",
  USDT: "tether",
  USDC: "usd-coin",
  XRP:  "ripple",
  ADA:  "cardano",
  AVAX: "avalanche-2",
  DOT:  "polkadot",
  MATIC: "matic-network",
  LINK:  "chainlink",
  UNI:   "uniswap",
  ATOM:  "cosmos",
  LTC:   "litecoin",
  DOGE:  "dogecoin",
  SHIB:  "shiba-inu",
  PEPE:  "pepe",
  JTO:   "jito-governance-token",
  JUP:   "jupiter-exchange-solana",
  BONK:  "bonk",
  WIF:   "dogwifcoin",
  PYTH:  "pyth-network",
  RAY:   "raydium",
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "web_search":
      return webSearch(String(args.query ?? ""))
    case "get_crypto_price":
      return getCryptoPrice(String(args.symbol ?? ""))
    case "calculate":
      return calculate(String(args.expression ?? ""))
    case "analyze_code":
      return analyzeCode(String(args.code ?? ""), String(args.language ?? "auto"), String(args.focus ?? "bugs"))
    case "get_token_info":
      return getTokenInfo(String(args.identifier ?? ""))
    default:
      return `Unknown tool: ${name}`
  }
}

// ── Which tool set to give each persona category ──────────────────────────────

export const PERSONA_TOOLS: Record<string, typeof TOOL_DEFINITIONS> = {
  trading:      TOOL_DEFINITIONS, // all tools
  professional: [TOOL_DEFINITIONS[0], TOOL_DEFINITIONS[2]], // search + calculate
  friends:      [],
  romantic:     [],
  family:       [],
  roleplay:     [],
  dark:         [],
}
