/**
 * Room "Live tools" argument layer.
 *
 * A RoomTool only carries an MCP tool id + a label. The MCP tools themselves
 * have real input schemas (a crypto price needs a `symbol`, a search needs a
 * `query`, multi-price needs an ARRAY of symbols, …). Without this, the Tools
 * tab fired every tool with the room's option-sliders as arguments and the MCP
 * server rejected them — dumping a raw "-32602 Input validation error" at the
 * user.
 *
 * This registry maps each MCP tool to the one value we collect from the user
 * (with a sensible default so most tools run on a single click), plus any fixed
 * secondary arguments and list-coercion. Anything not listed runs with no args.
 */

export interface ToolInput {
  /** The primary argument we collect from the user. */
  arg: string
  /** Placeholder for the little input box in the Tools tab. */
  placeholder: string
  /** Default value so the tool runs on one click without typing. */
  default?: string
  /** Extra arguments always sent (defaults for a tool's other required fields). */
  fixed?: Record<string, unknown>
  /** Split the value on commas/space into an array (e.g. multi-price symbols). */
  asList?: boolean
}

export const TOOL_INPUTS: Record<string, ToolInput> = {
  kloom_web_search:         { arg: "query",      placeholder: "Search the web…" },
  kloom_get_crypto_price:   { arg: "symbol",     placeholder: "BTC", default: "BTC" },
  kloom_get_multi_price:    { arg: "symbols",    placeholder: "BTC, ETH, SOL", default: "BTC,ETH,SOL", asList: true },
  kloom_get_token_info:     { arg: "identifier", placeholder: "Token name or contract" },
  kloom_calculate:          { arg: "expression", placeholder: "1500 * 1.2" },
  kloom_analyze_code:       { arg: "code",       placeholder: "Paste code to review…" },
  kloom_analyze_market:     { arg: "pair",       placeholder: "BTC/USD", default: "BTC/USD" },
  kloom_instagram_caption:  { arg: "topic",      placeholder: "Caption about…" },
  kloom_generate_hashtags:  { arg: "topic",      placeholder: "Topic…" },
  kloom_onlyfans_dm:        { arg: "fan_message",placeholder: "Fan's message…" },
  kloom_analyze_profile:    { arg: "url",        placeholder: "Profile URL…" },
  kloom_build_growth_plan:  { arg: "goal",       placeholder: "Goal (e.g. 10k followers)", fixed: { platform: "instagram", niche: "lifestyle" } },
  kloom_content_ideas:      { arg: "niche",      placeholder: "Your niche…" },
  kloom_analyze_token_chart:{ arg: "address",    placeholder: "Token contract address…" },
  kloom_generate_code:      { arg: "task",       placeholder: "Describe what to build…" },
  kloom_build_html:         { arg: "description",placeholder: "Describe the page…" },
  kloom_get_strategy:       { arg: "goal",       placeholder: "Your goal…", fixed: { domain: "business" } },
  kloom_canva_design:       { arg: "content",    placeholder: "What's the design for…", fixed: { type: "instagram-post" } },
  kloom_create_wallet:      { arg: "purpose",    placeholder: "Label (optional)", default: "trading" },
  kloom_build_connector:    { arg: "action",     placeholder: "e.g. Stripe → Slack on new payment", fixed: { from_service: "service A", to_service: "service B" } },
}

/**
 * Build the arguments object for an MCP tool from the user's single input.
 * Returns `needsInput: true` when the tool needs a value and none was given
 * (and there's no default) — the caller prompts instead of firing a bad call.
 */
export function buildToolArgs(toolId: string, rawValue: string): { args: Record<string, unknown>; needsInput: boolean } {
  const spec = TOOL_INPUTS[toolId]
  if (!spec) return { args: {}, needsInput: false }
  const v = (rawValue ?? "").trim() || spec.default || ""
  if (!v) return { args: { ...(spec.fixed ?? {}) }, needsInput: true }
  const value: unknown = spec.asList ? v.split(/[,\s]+/).filter(Boolean) : v
  return { args: { ...(spec.fixed ?? {}), [spec.arg]: value }, needsInput: false }
}

/** Does this raw tool output look like an error rather than a result? */
export function isToolError(s: string): boolean {
  if (!s || !s.trim()) return true
  return /MCP error|Input validation error|invalid_type|Tool .+ failed|"code"\s*:\s*-?\d{3,}/.test(s)
}

/**
 * Turn raw tool output into something a user should see: a friendly line on
 * error, a clean key/value block for JSON results, or the text as-is.
 */
export function formatToolOutput(raw: string, label?: string): string {
  if (isToolError(raw)) {
    return `${label ?? "This tool"} couldn't run with that input — try a different value.`
  }
  const text = raw.trim()
  // Pretty-print a JSON object result as aligned "Key: value" lines.
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const j = JSON.parse(text)
      const obj = Array.isArray(j) ? { results: j } : j
      const lines: string[] = []
      for (const [k, val] of Object.entries(obj)) {
        if (val == null || val === "") continue
        const key = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        const v = typeof val === "object" ? JSON.stringify(val) : String(val)
        lines.push(`${key}: ${v}`)
      }
      if (lines.length) return lines.join("\n")
    } catch { /* not JSON — fall through */ }
  }
  return text
}
