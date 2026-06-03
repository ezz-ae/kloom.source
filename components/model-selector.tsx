"use client"

import { useState } from "react"
import { Check, ChevronDown, Sparkles, Bot, Globe, Zap, Crown, Lock } from "lucide-react"
import { Backend, BACKEND_METADATA, backendAvailable } from "@/lib/llm-backends"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// ============================================================================
// KLOOM Model Selection Philosophy
// ============================================================================
// - Models are FIXED per room/expert by design
// - NO user-selectable models in most rooms
// - Premium models only for unrestricted topics (hacking, etc.)
// - Adult rooms: NO model change allowed (safety)
// - Some rooms (Claude X Gemini token launch): NO other models
// - Deep AI section: More flexibility for experimentation
// ============================================================================

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

// Room types that allow model selection
// Only Deep AI rooms and specific unrestricted rooms allow model changes
export type ModelSelectionMode = "none" | "view-only" | "limited" | "full"

interface ModelSelectorProps {
  // Current selected backend (from room/expert config)
  selectedBackend: Backend
  
  // Mode of selection
  mode?: ModelSelectionMode
  
  // Available backends (default: all available)
  availableBackends?: Backend[]
  
  // Is this an adult room? (NO changes allowed)
  isAdultRoom?: boolean
  
  // Is this a fixed-model room? (Claude X Gemini token launch, etc.)
  isFixedModelRoom?: boolean
  
  // Show cost information
  showCost?: boolean
  
  // Size of the component
  size?: "sm" | "md" | "lg"
  
  // Callback when model is selected (only if mode allows)
  onSelect?: (backend: Backend) => void
}

/**
 * Model Selector Component
 * 
 * Displays the current model for a room/expert.
 * In most cases, this is VIEW-ONLY as models are fixed.
 * Only allows selection in specific contexts (Deep AI, unrestricted rooms).
 */
export function ModelSelector({
  selectedBackend,
  mode = "view-only",
  availableBackends,
  isAdultRoom = false,
  isFixedModelRoom = false,
  showCost = true,
  size = "md",
  onSelect,
}: ModelSelectorProps) {
  const metadata = BACKEND_METADATA[selectedBackend]
  
  // Button size classes
  const sizeClasses = {
    sm: "h-8 text-xs px-2",
    md: "h-9 text-sm px-3",
    lg: "h-10 text-base px-4",
  }

  // Determine if selection is allowed
  const isSelectionAllowed = mode !== "none" && !isAdultRoom && !isFixedModelRoom
  
  // Get available backends
  const available = availableBackends || Object.keys(BACKEND_METADATA) as Backend[]
  
  if (mode === "none") {
    // No selector shown at all
    return null
  }

  if (!isSelectionAllowed) {
    // View-only mode - just show the current model
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`
            inline-flex items-center gap-2 rounded-xl border
            ${BACKEND_COLORS[selectedBackend]}
            ${sizeClasses[size]}
            cursor-default
          `}>
            {BACKEND_ICONS[selectedBackend]}
            <span className="font-medium">{metadata.name}</span>
            {isFixedModelRoom && (
              <Lock size={12} className="text-white/40" />
            )}
            {isAdultRoom && (
              <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded-full">Fixed</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-stone-900 border-stone-800">
          <div className="text-sm">
            <div className="font-bold text-white">{metadata.name}</div>
            <div className="text-white/60 text-xs mt-1">
              {isFixedModelRoom ? "This room has fixed models" : isAdultRoom ? "Adult room: Model cannot be changed" : "Model fixed for this room"}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    )
  }

  // Selection allowed - show dropdown
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
            <span className="font-medium">{metadata.name}</span>
            {showCost && selectedBackend !== "local" && (
              <span className="text-[10px] text-white/40 hidden sm:inline">
                ${metadata.cost.inputCostPer1K}/${metadata.cost.outputCostPer1K}
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

        {available.map((backend) => {
          const meta = BACKEND_METADATA[backend]
          const isSelected = selectedBackend === backend

          return (
            <DropdownMenuItem
              key={backend}
              onSelect={() => onSelect?.(backend)}
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
                <div className="font-medium">{meta.name}</div>
                <div className="text-xs text-white/40 truncate">{meta.description}</div>
              </div>
              {showCost && backend !== "local" && (
                <div className="text-right text-xs text-white/40">
                  <div>${meta.cost.inputCostPer1K}/</div>
                  <div>${meta.cost.outputCostPer1K}</div>
                </div>
              )}
              {isSelected && <Check size={14} className="text-purple-400" />}
            </DropdownMenuItem>
          )
        })}

        <div className="px-3 py-2 text-xs text-cyan-400 border-t border-stone-800">
          {mode === "limited" ? "Limited selection for this room" : "Full model selection available"}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Model Badge component for displaying selected model
interface ModelBadgeProps {
  backend: Backend
  size?: "sm" | "md"
  showLock?: boolean
}

export function ModelBadge({ backend, size = "md", showLock = false }: ModelBadgeProps) {
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
      {showLock && <Lock size={10} className="text-white/40" />}
    </div>
  )
}

// Fixed Model Indicator - Shows that model is fixed for this room
export function FixedModelIndicator({ backend }: { backend: Backend }) {
  const metadata = BACKEND_METADATA[backend]
  
  return (
    <div className="flex items-center gap-2 text-xs text-white/50">
      <div className={`w-4 h-4 rounded-lg flex items-center justify-center ${BACKEND_COLORS[backend]}`}>
        {BACKEND_ICONS[backend]}
      </div>
      <span>{metadata.name}</span>
      <Lock size={10} className="text-white/30" />
      <span className="text-white/40">Fixed</span>
    </div>
  )
}

// Room Model Info - Shows all models in a room
export function RoomModelInfo({ personas }: { personas: { name: string; model: Backend }[] }) {
  // Group by model
  const modelCounts: Record<Backend, number> = {
    local: 0,
    claude: 0,
    gemini: 0,
    openai: 0,
    mistral: 0,
  }
  
  personas.forEach(p => {
    if (p.model in modelCounts) {
      modelCounts[p.model]++
    }
  })

  // Filter out zero counts
  const activeModels = Object.entries(modelCounts)
    .filter(([_, count]) => count > 0)
    .map(([model, count]) => ({ model: model as Backend, count }))

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {activeModels.map(({ model, count }) => (
        <Tooltip key={model}>
          <TooltipTrigger asChild>
            <ModelBadge backend={model} size="sm" showLock={true} />
          </TooltipTrigger>
          <TooltipContent className="bg-stone-900 border-stone-800">
            <div className="text-sm">
              <div className="font-bold text-white">{BACKEND_METADATA[model].name}</div>
              <div className="text-white/60 text-xs">{count} persona{count > 1 ? 's' : ''}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      ))}
      {activeModels.length > 1 && (
        <span className="text-[10px] text-white/40 bg-stone-800 px-1.5 py-0.5 rounded-full">
          Multi-AI Room
        </span>
      )}
    </div>
  )
}

// Premium Model Badge
export function PremiumModelBadge() {
  return (
    <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">
      Premium Model
    </span>
  )
}

// Adult Room Warning
export function AdultRoomWarning() {
  return (
    <span className="text-[10px] font-bold bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full">
      18+ Fixed Models
    </span>
  )
}

// Unrestricted Room Badge
export function UnrestrictedRoomBadge() {
  return (
    <span className="text-[10px] font-bold bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full">
      Unrestricted
    </span>
  )
}

// Model Comparison for Deep AI section
export function ModelComparisonTable() {
  const allBackends = ["local", "mistral", "claude", "gemini", "openai"] as Backend[]

  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900/50 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-800">
            <th className="px-4 py-3 text-left text-white/40 text-xs font-medium uppercase">Model</th>
            <th className="px-4 py-3 text-left text-white/40 text-xs font-medium uppercase">Best For</th>
            <th className="px-4 py-3 text-left text-white/40 text-xs font-medium uppercase">Cost</th>
            <th className="px-4 py-3 text-left text-white/40 text-xs font-medium uppercase">Multilingual</th>
            <th className="px-4 py-3 text-left text-white/40 text-xs font-medium uppercase">Arabic</th>
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
                <td className="px-4 py-3 text-white/60">
                  {metadata.recommendedFor.join(", ")}
                </td>
                <td className="px-4 py-3 text-white/60">
                  ${metadata.cost.inputCostPer1K}/${metadata.cost.outputCostPer1K}
                </td>
                <td className="px-4 py-3">
                  {metadata.multilingual ? "✓" : "✗"}
                </td>
                <td className="px-4 py-3">
                  {metadata.recommendedFor.includes("arabic") ? "✓" : metadata.multilingual ? "✓" : "✗"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="px-4 py-2 text-xs text-white/40 bg-stone-900/50">
        * Models are fixed per room. Deep AI section allows more flexibility.
      </div>
    </div>
  )
}

// Model Selection Helper Functions
export function getModelSelectionModeForRoom(roomId: string): ModelSelectionMode {
  // Rooms that allow full model selection (Deep AI section)
  const deepAIRooms = ["ai-sandbox", "ai-ethics"]
  
  // Rooms that allow limited model selection (unrestricted rooms)
  const limitedRooms = ["unrestricted-lab", "trading-arena", "hacking-academy"]
  
  // Rooms with fixed models (Claude X Gemini, adult rooms, etc.)
  const fixedRooms = ["token-launch", "adult-lounge"]
  
  if (fixedRooms.includes(roomId)) {
    return "none"
  }
  
  if (deepAIRooms.includes(roomId)) {
    return "full"
  }
  
  if (limitedRooms.includes(roomId)) {
    return "limited"
  }
  
  // Default: view-only
  return "view-only"
}

export function canChangeModelInRoom(roomId: string): boolean {
  const mode = getModelSelectionModeForRoom(roomId)
  return mode === "limited" || mode === "full"
}
