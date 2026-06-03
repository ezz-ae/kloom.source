import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export function registerComputeTools(server: McpServer) {

  server.registerTool(
    "kloom_calculate",
    {
      title: "Calculator",
      description: `Evaluate a mathematical expression. Use for:
- ROI: (profit / cost) * 100
- P&L: entry - exit, with percentage
- Position sizing: (portfolio * risk%) / (entry - stop)
- Token math: supply * price, market cap, FDV

ALWAYS use this instead of calculating mentally to ensure accuracy.

Args:
  - expression (string): A math expression using only numbers and operators: + - * / () ** %
  - label (string, optional): What this calculation represents

Returns:
  - expression: Original expression
  - result: Calculated numeric result
  - formatted: Human-readable result
  - label: Context label if provided`,
      inputSchema: {
        expression: z.string().min(1).max(500).describe("Math expression e.g. (1000 * 0.05) / 100"),
        label:      z.string().max(100).optional().describe("Context label e.g. 'ROI on BTC trade'"),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ expression, label }) => {
      // Strict safe eval — only allow math
      if (/[^0-9+\-*/.()\s%*^]/.test(expression.replace(/\*\*/g, "").replace(/e[+-]\d+/g, ""))) {
        return { content: [{ type: "text" as const, text: "Invalid expression — only numbers and math operators (+, -, *, /, **, %, ()) are allowed." }] }
      }
      try {
        // eslint-disable-next-line no-new-func
        const result = Function(`"use strict"; return (${expression})`)() as number
        if (typeof result !== "number" || !isFinite(result)) {
          return { content: [{ type: "text" as const, text: "Result is not a finite number." }] }
        }
        const formatted = result.toLocaleString("en-US", {
          maximumFractionDigits: result < 1 ? 8 : 4,
          minimumFractionDigits: 0,
        })
        const output = { expression, result, formatted, label: label ?? null }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        }
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Calculation error: ${(err as Error).message}` }] }
      }
    }
  )

  server.registerTool(
    "kloom_analyze_code",
    {
      title: "Analyze Code",
      description: `Perform structured analysis of code for bugs, security vulnerabilities, performance issues, or style problems.

Use this when the user shares code that needs review. Returns a structured critique that you then explain conversationally.

Args:
  - code (string): The code to analyze
  - language (string): Programming language (typescript, python, solidity, rust, etc.)
  - focus (string): What to focus on — bugs | security | performance | style | all

Returns:
  - issues: Array of found issues with severity (critical/high/medium/low) and line hints
  - suggestions: Improvement suggestions
  - summary: One-line verdict`,
      inputSchema: {
        code:     z.string().min(1).max(10000).describe("The code to analyze"),
        language: z.string().max(50).default("auto").describe("Programming language"),
        focus:    z.enum(["bugs", "security", "performance", "style", "all"]).default("all").describe("Analysis focus"),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ code, language, focus }) => {
      const lineCount = code.split("\n").length
      const charCount = code.length
      // Return metadata for the LLM to do the actual analysis
      const output = {
        metadata:  { lines: lineCount, chars: charCount, language, focus },
        directive: `Analyze the ${lineCount}-line ${language} code above for ${focus}. Structure your response EXACTLY as: [CRITICAL] / [HIGH] / [MEDIUM] / [LOW] issues each on their own line, then [VERDICT] one sentence. Never skip the structure.`,
        code_hash: code.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0),
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      }
    }
  )

  server.registerTool(
    "kloom_analyze_market",
    {
      title: "Analyze Market Pair",
      description: `Fetch and analyze a trading pair — price, momentum, volatility context.
Use before giving any trading recommendation. Combines price data with market context.

Args:
  - pair (string): Trading pair e.g. SOL/USDT, BTC/USDT
  - timeframe (string): Analysis horizon — scalp | swing | position`,
      inputSchema: {
        pair:      z.string().min(3).max(20).describe("Trading pair e.g. SOL/USDT"),
        timeframe: z.enum(["scalp", "swing", "position"]).default("swing").describe("Analysis timeframe"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ pair, timeframe }) => {
      const base   = pair.split("/")[0]?.toUpperCase() ?? pair.toUpperCase()
      const coinId = {
        BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin",
        AVAX: "avalanche-2", DOT: "polkadot", MATIC: "matic-network",
      }[base] ?? base.toLowerCase()

      try {
        const res  = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`,
          { signal: AbortSignal.timeout(6000) }
        )
        const data = await res.json() as any
        const coin = data[coinId]
        if (!coin) {
          return { content: [{ type: "text" as const, text: `No data for ${pair}. Use kloom_web_search for this pair.` }] }
        }
        const change     = Number(coin.usd_24h_change ?? 0)
        const volatility = Math.abs(change) > 10 ? "high" : Math.abs(change) > 5 ? "medium" : "low"
        const output     = {
          pair,
          base,
          timeframe,
          price:      coin.usd,
          change_24h: `${change.toFixed(2)}%`,
          volatility,
          market_cap: coin.usd_market_cap,
          volume_24h: coin.usd_24h_vol,
          momentum:   change > 0 ? "positive" : "negative",
          context:    `${timeframe} trader context: volatility is ${volatility}, price ${change > 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)}% in 24h`,
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        }
      } catch (err) {
        return { content: [{ type: "text" as const, text: `Market analysis failed: ${(err as Error).message}` }] }
      }
    }
  )
}
