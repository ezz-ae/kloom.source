"use client"

import { useState } from "react"
import { Code2, Eye, ExternalLink, Maximize2 } from "lucide-react"

export function HtmlPreviewWidget({ code }: { code: string }) {
  const [tab, setTab]       = useState<"preview" | "code">("preview")
  const [fullscreen, setFullscreen] = useState(false)

  const openExternal = () => {
    const blob = new Blob([code], { type: "text/html" })
    window.open(URL.createObjectURL(blob), "_blank")
  }

  return (
    <div className={`rounded-2xl border border-border/50 bg-stone-900 overflow-hidden my-1 ${fullscreen ? "fixed inset-4 z-50" : ""}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/8">
        <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
          {(["preview", "code"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                tab === t ? "bg-white text-stone-950" : "text-foreground/50 hover:text-foreground"
              }`}>
              {t === "preview" ? <><Eye size={11} className="inline mr-1" />Preview</> : <><Code2 size={11} className="inline mr-1" />HTML</>}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFullscreen((v) => !v)} className="text-foreground/40 hover:text-foreground/80 transition-colors">
            <Maximize2 size={14} />
          </button>
          <button onClick={openExternal} className="text-foreground/40 hover:text-foreground/80 transition-colors">
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {tab === "preview" ? (
        <iframe
          srcDoc={code}
          className="w-full bg-white"
          style={{ height: fullscreen ? "calc(100% - 44px)" : 400, border: "none" }}
          sandbox="allow-scripts allow-same-origin"
          title="html-preview"
        />
      ) : (
        <pre className="p-4 text-[12px] font-mono text-foreground/70 overflow-x-auto max-h-[400px] overflow-y-auto leading-relaxed whitespace-pre-wrap">
          {code}
        </pre>
      )}
    </div>
  )
}
