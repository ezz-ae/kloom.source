"use client"

import { useState } from "react"
import { Check, ChevronDown, Sparkles, Bot, Globe, Zap, Crown } from "lucide-react"
import { Backend, BACKEND_METADATA, getAvailableBackends, backendAvailable } from "@/lib/llm-backends"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Backend icons mapping
const BACKEND_ICONS: Record<Backend, React.ReactNode> = {
  local: <Bot size={14} />,
  claude: <Crown size={14} />,
  gemini: <Sparkles size={14} />,
  openai: <Globe size={14} />,
  mistral: <Zap size={14} />,
}

// Backend color mapping for KLOOM theme
const BACKEND_COLORS: Record<Backend, string> = {
  local: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  claude: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  gemini: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  openai: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  mistral: "bg-purple-500/10 text-purple-400 border-purple-500/20",
}

interface ModelSelectorProps {
  showCost?: boolean
  size?: "sm" | "md" | "lg"
  onSelect?: (backend: Backend) => void
}

export function ModelSelector({ showCost = true, size = "md", onSelect }: ModelSelectorProps) {
  const [selectedBackend, setSelectedBackend] = useState<Backend>("local")
  const availableBackends = getAvailableBackends()

  const handleSelect = (backend: Backend) => {
    setSelectedBackend(backend)
    onSelect?.(backend)
  }

  const selectedMetadata = BACKEND_METADATA[selectedBackend]

  // Button size classes
  const sizeClasses = {
    sm: "h-8 text-xs px-2",
    md: "h-9 text-sm px-3",
    lg: "h-10 text-base px-4",
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={`
            ${sizeClasses[size]}
            w-full justify-between
            border-0 bg-stone-900/50 hover:bg-stone-800/50
            ${BACKEND_COLORS[selectedBackend]}
            transition-colors
          `}
        >
          <div className="flex items-center gap-2">
            {BACKEND_ICONS[selectedBackend]}
            <span className="font-medium">{selectedMetadata.name}</span>
            {showCost && selectedBackend !== "local" && (
              <span className="text-[10px] text-white/40 hidden sm:inline">
                ${selectedMetadata.cost.inputCostPer1K}/${selectedMetadata.cost.outputCostPer1K}
              </span>
            )}
          </div>
          <ChevronDown size={14} className="text-white/40" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56 bg-stone-900 border border-stone-800 text-white">
        <div className="px-3 py-2 text-xs text-white/40 border-b border-stone-800">
          Select AI Model
        </div>

        {availableBackends.map((backend) => {
          const metadata = BACKEND_METADATA[backend]
          const isSelected = selectedBackend === backend

          return (
            <DropdownMenuItem
              key={backend}
              onSelect={() => handleSelect(backend)}
              className={`
                flex items-center gap-2 px-3 py-2 text-sm
                cursor-pointer hover:bg-stone-800/50
                ${isSelected ? "bg-stone-800/50" : ""}
                focus:bg-stone-800/50
              `}
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${BACKEND_COLORS[backend]}`}>
                {BACKEND_ICONS[backend]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{metadata.name}</div>
                <div className="text-xs text-white/40 truncate">{metadata.description}</div>
              </div>
              {showCost && backend !== "local" && (
                <div className="text-right text-xs text-white/40">
                  <div>${metadata.cost.inputCostPer1K}/</div>
                  <div>${metadata.cost.outputCostPer1K}</div>
                </div>
              )}
              {isSelected && <Check size={14} className="text-purple-400" />}
            </DropdownMenuItem>
          )
        })}

        {!backendAvailable("mistral") && (
          <div className="px-3 py-2 text-xs text-cyan-400 border-t border-stone-800">
            Add MISTRAL_API_KEY to enable Mistral
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Model Badge component for displaying selected model
interface ModelBadgeProps {
  backend: Backend
  size?: "sm" | "md"
}

export function ModelBadge({ backend, size = "md" }: ModelBadgeProps) {
  const metadata = BACKEND_METADATA[backend]
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
  }

  return (
    <div className={`
      inline-flex items-center gap-1.5 rounded-full border
      ${BACKEND_COLORS[backend]}
      ${sizeClasses[size]}
    `}>
      {BACKEND_ICONS[backend]}
      <span className="font-medium">{metadata.name}</span>
    </div>
  )
}

// Model Comparison Table component
export function ModelComparisonTable() {
  const allBackends = ["local", "mistral", "claude", "gemini", "openai"] as Backend[]

  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900/50 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-800">
            <th className="px-4 py-3 text-left text-white/40 text-xs font-medium uppercase">Model</th>
            <th className="px-4 py-3 text-left text-white/40 text-xs font-medium uppercase">Input</th>
            <th className="px-4 py-3 text-left text-white/40 text-xs font-medium uppercase">Output</th>
            <th className="px-4 py-3 text-left text-white/40 text-xs font-medium uppercase">Streaming</th>
            <th className="px-4 py-3 text-left text-white/40 text-xs font-medium uppercase">Multilingual</th>
            <th className="px-4 py-3 text-left text-white/40 text-xs font-medium uppercase">Best For</th>
          </tr>
        </thead>
        <tbody>
          {allBackends.map((backend) => {
            const metadata = BACKEND_METADATA[backend]
            return (
              <tr key={backend} className="border-b border-stone-800/50 hover:bg-stone-800/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${BACKEND_COLORS[backend]}`}>
                      {BACKEND_ICONS[backend]}
                    </div>
                    <span className="font-medium">{metadata.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-white/60">${metadata.cost.inputCostPer1K}/1K</td>
                <td className="px-4 py-3 text-white/60">${metadata.cost.outputCostPer1K}/1K</td>
                <td className="px-4 py-3">
                  {metadata.supportsStreaming ? (
                    <Check size={14} className="text-emerald-400" />
                  ) : (
                    <span className="text-white/40">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {metadata.multilingual ? (
                    <Check size={14} className="text-emerald-400" />
                  ) : (
                    <span className="text-white/40">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-white/60 text-xs">
                  {metadata.recommendedFor.join(", ")}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Quick Model Switcher component
export function QuickModelSwitcher({ onSelect }: { onSelect?: (backend: Backend) => void }) {
  const [selected, setSelected] = useState<Backend>("local")
  const availableBackends = getAvailableBackends()

  const handleSelect = (backend: Backend) => {
    setSelected(backend)
    onSelect?.(backend)
  }

  return (
    <div className="flex gap-1 p-1 rounded-xl bg-stone-900/50 border border-stone-800">
      {availableBackends.map((backend) => {
        const isSelected = selected === backend
        return (
          <button
            key={backend}
            onClick={() => handleSelect(backend)}
            className={`
              p-2 rounded-lg transition-all
              ${isSelected ? BACKEND_COLORS[backend] : "text-white/40 hover:text-white"}
            `}
            title={BACKEND_METADATA[backend].name}
          >
            {BACKEND_ICONS[backend]}
          </button>
        )
      })}
    </div>
  )
}
