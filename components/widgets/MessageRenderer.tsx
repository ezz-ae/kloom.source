"use client"

import { parseMessage, type Block } from "@/lib/message-parser"
import { CodeWidget }         from "./CodeWidget"
import { ChartWidget }        from "./ChartWidget"
import { HtmlPreviewWidget }  from "./HtmlPreviewWidget"
import { WalletCreatorWidget } from "./WalletCreatorWidget"
import { PlaybookWidget }     from "./PlaybookWidget"
import { AttachmentInMessage, type MediaAttachment } from "./MediaWidget"

interface MessageRendererProps {
  content: string
  attachments?: MediaAttachment[]
}

function CalcBlock({ expression, result }: { expression?: string; result?: string }) {
  return (
    <div className="inline-flex items-center gap-2 bg-stone-800 border border-border/50 rounded-xl px-3 py-2 my-1 font-mono text-sm">
      <span className="text-foreground/50">{expression}</span>
      <span className="text-foreground/30">=</span>
      <span className="text-emerald-400 font-bold">{result}</span>
    </div>
  )
}

// Some models (esp. local/dolphin seats) ECHO their tool calls as plain text —
// "kloom_get_crypto_price(symbol='BTCUSD')" — before the actual answer, which dumps a
// wall of code into the conversation. Strip any kloom_<name>(...) invocation, scanning
// for the balanced close paren so nested args (calc expressions) are removed cleanly.
function stripToolCalls(s: string): string {
  if (!s.includes("kloom_")) return s
  let out = ""
  let i = 0
  while (i < s.length) {
    const m = /kloom_\w+\(/.exec(s.slice(i))
    if (!m) { out += s.slice(i); break }
    out += s.slice(i, i + m.index)
    let j = i + m.index + m[0].length
    let depth = 1
    while (j < s.length && depth > 0) { const c = s[j]; if (c === "(") depth++; else if (c === ")") depth--; j++ }
    i = j
  }
  // Malformed echoes (unbalanced quotes/parens) can leave orphaned "05')" / "')" residue.
  // We only run this when a kloom_ call was present, so it can't touch normal prose.
  return out
    .replace(/(?:^|\s)[\d.]*'?\)(?=\s|$)/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]*\n[ \t]*\n+/g, "\n\n")
    .trim()
}

function TextBlock({ content }: { content: string }) {
  // Render inline bold/italic (with raw tool-call echoes stripped first)
  const rendered = stripToolCalls(content)
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-bold">$1</strong>')
    .replace(/\*(.+?)\*/g,    '<em class="text-foreground/80 italic">$1</em>')
    .replace(/`(.+?)`/g,      '<code class="bg-white/10 px-1 py-0.5 rounded text-[12px] font-mono text-emerald-300">$1</code>')

  return (
    <span
      className="leading-relaxed whitespace-pre-wrap"
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  )
}

export function MessageRenderer({ content, attachments }: MessageRendererProps) {
  const blocks = parseMessage(content)

  return (
    <div className="space-y-1">
      {blocks.map((block, i) => (
        <BlockRenderer key={i} block={block} />
      ))}

      {attachments?.map((att) => (
        <AttachmentInMessage key={att.id} att={att} />
      ))}
    </div>
  )
}

function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "text":
      return <TextBlock content={block.content ?? ""} />

    case "code":
      return <CodeWidget code={block.code ?? ""} lang={block.lang} />

    case "html_preview":
      return <HtmlPreviewWidget code={block.code ?? ""} />

    case "token_chart":
      return <ChartWidget address={block.address ?? ""} symbol={block.symbol} />

    case "calc_result":
      return <CalcBlock expression={block.expression} result={block.result} />

    case "wallet_creator":
      return <WalletCreatorWidget />

    case "token_wizard":
      return (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 my-1">
          <p className="text-sm font-bold text-amber-300 mb-1">Token Creation Wizard</p>
          <p className="text-xs text-foreground/50">Use <code className="text-amber-300">pnpm bloom:create</code> to mint a new SPL token with your treasury wallet. Requires the treasury wallet to be funded with ≥0.05 SOL for rent.</p>
          <PlaybookWidget playbookName="token-launch" />
        </div>
      )

    case "playbook":
      return <PlaybookWidget playbookName={block.playbookName} />

    case "canva_design":
      return (
        <div className="rounded-2xl border border-border/50 bg-stone-900 p-4 my-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#8B3DFF] flex items-center justify-center text-[10px] font-bold text-foreground">C</div>
            <span className="font-bold text-sm">Canva Design</span>
          </div>
          <p className="text-xs text-foreground/50">"{block.canvaPrompt}"</p>
          <a
            href={`https://www.canva.com/design?embed[object]=create&embed[prompt]=${encodeURIComponent(block.canvaPrompt ?? "")}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#8B3DFF] hover:bg-[#7B2DEF] text-foreground text-xs font-bold px-4 py-2 rounded-xl transition-colors"
          >
            Open in Canva
          </a>
        </div>
      )

    default:
      return null
  }
}
