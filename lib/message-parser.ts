/**
 * Message parser — turns raw AI/user text into a list of typed blocks.
 *
 * Supported auto-detections:
 *  - Fenced code blocks  → CodeBlock
 *  - HTML strings        → HtmlPreview
 *  - Solana addresses    → TokenChart
 *  - Token explorer URLs → TokenChart
 *  - [CHART:…]           → TokenChart
 *  - [CALC:…]            → CalcResult
 *  - [WALLET]            → WalletCreator
 *  - [TOKEN_WIZARD]      → TokenWizard
 *  - [PLAYBOOK:name]     → Playbook
 *  - [CANVA:prompt]      → CanvaDesign
 *  - plain text          → Text
 */

export type BlockType =
  | "text"
  | "code"
  | "html_preview"
  | "token_chart"
  | "calc_result"
  | "wallet_creator"
  | "token_wizard"
  | "playbook"
  | "canva_design"
  | "media"

export interface Block {
  type: BlockType
  // For text
  content?: string
  // For code
  lang?: string
  code?: string
  // For token_chart
  address?: string
  symbol?: string
  // For calc_result
  expression?: string
  result?: string
  // For playbook
  playbookName?: string
  // For canva_design
  canvaPrompt?: string
  // For media
  url?: string
  mimeType?: string
  fileName?: string
}

const SOL_ADDRESS_RE = /\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/g
const ETH_ADDRESS_RE = /\b(0x[a-fA-F0-9]{40})\b/g
const DEXSCREENER_RE = /https?:\/\/dexscreener\.com\/[^\s]+\/([1-9A-HJ-NP-Za-km-z]{32,44})/g
const BIRDEYE_RE     = /https?:\/\/birdeye\.so\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/g
const SOLSCAN_RE     = /https?:\/\/solscan\.io\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/g
const EXPLORER_RE    = /https?:\/\/explorer\.solana\.com\/address\/([1-9A-HJ-NP-Za-km-z]{32,44})/g

const KNOWN_NON_TOKEN_ADDRESSES = new Set([
  "ATwss5yaDyyn1gPkndehaFhEtzNiV1U8KodFFbraLXQf", // our treasury
])

export function parseMessage(raw: string): Block[] {
  const blocks: Block[] = []

  // 1. Extract fenced code blocks first
  const CODE_FENCE_RE = /```(\w*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let m: RegExpExecArray | null

  while ((m = CODE_FENCE_RE.exec(raw)) !== null) {
    const before = raw.slice(lastIndex, m.index).trim()
    if (before) blocks.push(...parsePlainText(before))
    const lang = m[1] || "text"
    const code = m[2].trim()
    // Special case: if lang is "html" and looks like a full page → html_preview
    if ((lang === "html" || lang === "HTML") && code.includes("<html") || code.includes("<!DOCTYPE")) {
      blocks.push({ type: "html_preview", code, content: code })
    } else {
      blocks.push({ type: "code", lang, code })
    }
    lastIndex = m.index + m[0].length
  }

  const remaining = raw.slice(lastIndex).trim()
  if (remaining) blocks.push(...parsePlainText(remaining))

  return blocks.filter((b) => {
    if (b.type === "text") return (b.content ?? "").trim().length > 0
    return true
  })
}

function parsePlainText(text: string): Block[] {
  const blocks: Block[] = []

  // 2. Extract widget markers [CALC:…] [CHART:…] [WALLET] [TOKEN_WIZARD] [PLAYBOOK:name] [CANVA:prompt]
  const WIDGET_RE = /\[(CHART|CALC|WALLET|TOKEN_WIZARD|PLAYBOOK|CANVA):?([^\]]*)\]/g
  let last = 0
  let wm: RegExpExecArray | null

  while ((wm = WIDGET_RE.exec(text)) !== null) {
    const before = text.slice(last, wm.index).trim()
    if (before) blocks.push(...extractTokenAddresses(before))

    const tag = wm[1]
    const arg = wm[2].trim()

    if (tag === "CHART")        blocks.push({ type: "token_chart",   address: arg })
    if (tag === "CALC")         blocks.push({ type: "calc_result",   expression: arg, result: safeCalc(arg) })
    if (tag === "WALLET")       blocks.push({ type: "wallet_creator" })
    if (tag === "TOKEN_WIZARD") blocks.push({ type: "token_wizard"  })
    if (tag === "PLAYBOOK")     blocks.push({ type: "playbook",      playbookName: arg })
    if (tag === "CANVA")        blocks.push({ type: "canva_design",  canvaPrompt: arg })

    last = wm.index + wm[0].length
  }

  const tail = text.slice(last).trim()
  if (tail) blocks.push(...extractTokenAddresses(tail))

  return blocks
}

function extractTokenAddresses(text: string): Block[] {
  // Collect all addresses from explorer URLs first
  const addresses = new Set<string>()
  for (const re of [DEXSCREENER_RE, BIRDEYE_RE, SOLSCAN_RE, EXPLORER_RE]) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      if (!KNOWN_NON_TOKEN_ADDRESSES.has(m[1])) addresses.add(m[1])
    }
  }

  if (addresses.size > 0) {
    // Strip explorer URLs from text
    let cleaned = text
      .replace(DEXSCREENER_RE, "").replace(BIRDEYE_RE, "")
      .replace(SOLSCAN_RE, "").replace(EXPLORER_RE, "").trim()

    const result: Block[] = []
    if (cleaned) result.push({ type: "text", content: cleaned })
    for (const addr of addresses) {
      result.push({ type: "token_chart", address: addr })
    }
    return result
  }

  return [{ type: "text", content: text }]
}

function safeCalc(expr: string): string {
  try {
    if (/[^0-9+\-*/.() %\s]/.test(expr)) return "?"
    // eslint-disable-next-line no-new-func
    const r = Function(`"use strict"; return (${expr})`)()
    if (!isFinite(r)) return "?"
    return r.toLocaleString("en-US", { maximumFractionDigits: 8 })
  } catch { return "?" }
}
