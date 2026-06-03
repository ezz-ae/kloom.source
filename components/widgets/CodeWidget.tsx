"use client"

import { useState, useEffect, useRef } from "react"
import { Copy, Check, Play, ExternalLink, ChevronDown, ChevronUp } from "lucide-react"

interface CodeWidgetProps {
  code: string
  lang?: string
}

// Simple token-based highlighter (no external dep at runtime)
function highlight(code: string, lang: string): string {
  const esc = code.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  if (!lang || lang === "text" || lang === "plain") return esc

  const kw = {
    typescript: /\b(const|let|var|function|return|if|else|for|while|class|interface|type|async|await|import|export|from|default|new|typeof|instanceof|extends|implements|void|never|any|string|number|boolean|null|undefined)\b/g,
    javascript: /\b(const|let|var|function|return|if|else|for|while|class|async|await|import|export|from|default|new|typeof|instanceof|extends|void|null|undefined|true|false)\b/g,
    python:     /\b(def|class|return|if|elif|else|for|while|import|from|as|with|try|except|finally|lambda|None|True|False|and|or|not|in|is)\b/g,
    solidity:   /\b(contract|function|returns|public|private|external|internal|view|pure|payable|mapping|address|uint256|uint|int|bool|string|bytes|event|emit|modifier|require|revert|storage|memory|calldata)\b/g,
    rust:       /\b(fn|let|mut|pub|use|mod|struct|enum|impl|trait|match|if|else|for|while|loop|return|async|await|move|ref|where|type|const|static|self|Self|true|false|Some|None|Ok|Err)\b/g,
    html:       /<\/?[\w-]+([\s][^>]*)?\/?>/g,
    css:        /(\.[a-zA-Z][\w-]*|#[a-zA-Z][\w-]*|[a-zA-Z-]+\s*:|@\w+)/g,
    bash:       /\b(echo|cd|ls|mkdir|rm|cp|mv|cat|grep|curl|export|source|if|then|fi|for|done|while|do|case|esac|function)\b/g,
  }
  const re = kw[lang as keyof typeof kw]
  if (!re) return esc
  return esc.replace(re, '<span class="text-amber-300 font-semibold">$&</span>')
    .replace(/(["'`])(.*?)\1/g, '<span class="text-emerald-300">$1$2$1</span>')
    .replace(/(\/\/[^\n]*|#[^\n]*)/g, '<span class="text-foreground/35 italic">$1</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="text-amber-300">$1</span>')
}

const RUNNABLE = ["html", "javascript", "js", "typescript", "ts"]

export function CodeWidget({ code, lang = "text" }: CodeWidgetProps) {
  const [copied, setCopied]       = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [running, setRunning]     = useState(false)
  const iframeRef                 = useRef<HTMLIFrameElement>(null)
  const isRunnable = RUNNABLE.includes(lang.toLowerCase())
  const lineCount  = code.split("\n").length

  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const runInPlayground = () => {
    setRunning(true)
    const html = lang === "html" ? code : `<!DOCTYPE html>
<html><head><style>
  body { background: #09090b; color: #fff; font-family: system-ui; padding: 1rem; }
  * { box-sizing: border-box; }
</style></head><body>
<script type="module">
${code}
</script></body></html>`
    if (iframeRef.current) {
      iframeRef.current.srcdoc = html
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-border/50 bg-stone-900 my-1">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/8">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-[11px] text-foreground/40 font-mono ml-2">{lang} · {lineCount} lines</span>
        </div>
        <div className="flex items-center gap-2">
          {isRunnable && !running && (
            <button onClick={runInPlayground}
              className="flex items-center gap-1 text-[11px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-lg hover:bg-emerald-500/30 transition-colors">
              <Play size={10} /> Run
            </button>
          )}
          {running && (
            <button onClick={() => setRunning(false)}
              className="flex items-center gap-1 text-[11px] bg-red-500/20 border border-red-500/30 text-red-300 px-2.5 py-1 rounded-lg hover:bg-red-500/30 transition-colors">
              Close preview
            </button>
          )}
          <button onClick={copy} className="flex items-center gap-1 text-[11px] text-foreground/40 hover:text-foreground/80 px-2 py-1 rounded transition-colors">
            {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            {copied ? "Copied" : "Copy"}
          </button>
          {lineCount > 20 && (
            <button onClick={() => setCollapsed((v) => !v)} className="text-foreground/40 hover:text-foreground/80">
              {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* Code */}
      {!collapsed && (
        <div className="overflow-x-auto">
          <pre className="p-4 text-[13px] font-mono leading-relaxed text-foreground/80 max-h-[400px] overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: highlight(code, lang.toLowerCase()) }}
          />
        </div>
      )}
      {collapsed && (
        <div className="px-4 py-2 text-[11px] text-foreground/30 italic">
          {lineCount} lines hidden — click ↓ to expand
        </div>
      )}

      {/* Live preview */}
      {running && (
        <div className="border-t border-white/8">
          <div className="px-4 py-2 text-[11px] text-foreground/40 bg-white/3">Live preview</div>
          <iframe
            ref={iframeRef}
            className="w-full bg-background"
            style={{ height: 320, border: "none" }}
            sandbox="allow-scripts allow-same-origin"
            title="code-preview"
          />
        </div>
      )}
    </div>
  )
}
