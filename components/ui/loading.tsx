"use client"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

export function LoadingSpinner({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizeClasses = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8", xl: "w-12 h-12" }
  return <Loader2 className={cn("animate-spin text-current", sizeClasses[size], className)} />
}

export function LoadingOverlay({ message = "Loading...", className }: { message?: string; className?: string }) {
  return (
    <div className={cn("fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm", className)}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-stone-800 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
          <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
        </div>
        <p className="text-white/80 text-sm">{message}</p>
      </div>
    </div>
  )
}

export function LoadingSkeleton({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 rounded-full bg-stone-800/50 animate-pulse" style={{ width: `${Math.max(40, 100 - i * 15)}%`, animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  )
}

export function MessageSkeleton() {
  return (
    <div className="flex gap-3 p-4">
      <div className="w-8 h-8 rounded-full bg-stone-800/50 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 rounded-full bg-stone-800/50 animate-pulse w-3/4" />
        <div className="h-3 rounded-full bg-stone-800/50 animate-pulse w-1/2" style={{ animationDelay: "0.1s" }} />
      </div>
    </div>
  )
}

export function ChatLoadingIndicator() {
  return (
    <div className="flex justify-start gap-2 p-4">
      <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "0s" }} />
      <div className="w-2 h-2 rounded-full bg-amber-500/70 animate-bounce" style={{ animationDelay: "0.15s" }} />
      <div className="w-2 h-2 rounded-full bg-amber-500/40 animate-bounce" style={{ animationDelay: "0.3s" }} />
    </div>
  )
}

export function AIThinkingIndicator() {
  return <div className="flex items-center gap-2 text-amber-400 text-xs"><Loader2 className="w-3 h-3 animate-spin" /><span>AI is thinking...</span></div>
}

export function ProgressBar({ value, max = 100, className, showLabel = false }: { value: number; max?: number; className?: string; showLabel?: boolean }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className={cn("w-full", className)}>
      {showLabel && <div className="flex justify-between text-xs text-stone-400 mb-1"><span>0%</span><span>100%</span></div>}
      <div className="h-2 rounded-full bg-stone-800 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

export function CircularProgress({ value, max = 100, size = "md", showValue = true, className }: { value: number; max?: number; size?: "sm" | "md" | "lg" | "xl"; showValue?: boolean; className?: string }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  const sizeClasses = { sm: "w-8 h-8", md: "w-12 h-12", lg: "w-16 h-16", xl: "w-24 h-24" }
  return (
    <div className={cn("relative inline-flex items-center justify-center", sizeClasses[size], className)}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="8" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="url(#gradient)" strokeWidth="8" strokeLinecap="round" strokeDasharray="282.743" strokeDashoffset={`${282.743 - (282.743 * percentage) / 100}`} transform="rotate(-90 50 50)" />
        <defs><linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#d97706" /></linearGradient></defs>
      </svg>
      {showValue && <span className="text-xs font-medium text-white">{Math.round(percentage)}%</span>}
    </div>
  )
}

export function CardSkeleton() {
  return <div className="rounded-xl border border-stone-800 bg-stone-900/50 p-4 animate-pulse"><div className="h-4 rounded bg-stone-800/50 w-3/4 mb-3" /><div className="space-y-2"><div className="h-3 rounded bg-stone-800/50 w-full" /><div className="h-3 rounded bg-stone-800/50 w-5/6" /></div></div></div>
}

export function AvatarSkeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-full bg-stone-800/50 animate-pulse", className)} />
}

export function RoomCardSkeleton() {
  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900/50 p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3"><AvatarSkeleton className="w-10 h-10" /><div className="flex-1 space-y-1"><div className="h-3 rounded bg-stone-800/50 w-3/4" /><div className="h-2 rounded bg-stone-800/50 w-1/2" /></div></div></div>
      <div className="h-2 rounded bg-stone-800/50 w-1/3" />
    </div>
  )
}

export function ExpertCardSkeleton() {
  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900/50 p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3"><AvatarSkeleton className="w-12 h-12" /><div className="flex-1 space-y-1"><div className="h-4 rounded bg-stone-800/50 w-2/3" /><div className="h-3 rounded bg-stone-800/50 w-1/2" /></div></div></div>
      <div className="flex gap-1"><div className="h-2 rounded-full bg-stone-800/50 w-16" /><div className="h-2 rounded-full bg-stone-800/50 w-12" /></div>
    </div>
  )
}

export function DotsLoader() {
  return <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-amber-500 animate-dots-1" /><div className="w-2 h-2 rounded-full bg-amber-500 animate-dots-2" /><div className="w-2 h-2 rounded-full bg-amber-500 animate-dots-3" /></div></div>
}

export function PulseLoader() {
  return <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
}

export function BarLoader() {
  return <div className="w-full h-1 rounded-full overflow-hidden"><div className="h-full bg-amber-500 animate-bar-loader" /></div>
}

export function StreamingText({ text, className, speed = "normal" }: { text: string; className?: string; speed?: "slow" | "normal" | "fast" }) {
  const speedClasses = { slow: "animate-stream-slow", normal: "animate-stream-normal", fast: "animate-stream-fast" }
  return <span className={cn("inline-block", speedClasses[speed], className)}>{text}</span>
}

export function TypingIndicator({ className, dots = 3 }: { className?: string; dots?: number }) {
  return (
    <div className={cn("flex gap-1", className)}>
      {Array.from({ length: dots }).map((_, i) => (
        <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-500" style={{ animation: `typing-bounce 1.4s infinite ease-in-out`, animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  )
}

export function VoiceStreamingIndicator() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-4 h-4"><div className="absolute inset-0 rounded-full border-2 border-amber-500" /><div className="absolute inset-1 rounded-full bg-amber-500 animate-voice-pulse" /></div>
      <span className="text-xs text-amber-400">Listening...</span>
    </div>
  )
}

export function EmptyState({ icon, title, description, action, className }: { icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <div className="w-16 h-16 rounded-2xl bg-stone-800/50 flex items-center justify-center mb-4">{icon}</div>
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      {description && <p className="text-sm text-stone-400 mb-4 max-w-md">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  )
}

export function EmptyRooms() {
  return <EmptyState icon={<div className="text-2xl">🇨</div>} title="No rooms yet" description="Create your first room or join an existing one to start chatting with AI." />
}

export function EmptyMessages() {
  return <EmptyState icon={<div className="text-2xl">💬</div>} title="No messages yet" description="Start a conversation with an AI expert or invite friends to this room." />
}

export function EmptyExperts() {
  return <EmptyState icon={<div className="text-2xl">🎭</div>} title="No experts found" description="Try adjusting your search or filter criteria." />
}

export function LoadingRoom() {
  return <EmptyState icon={<Loader2 className="w-8 h-8 animate-spin text-amber-500" />} title="Loading room..." description="Preparing your AI companions" />
}

export function ErrorState({ icon, title, description, action, className }: { icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-4">{icon}</div>
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      {description && <p className="text-sm text-stone-400 mb-4 max-w-md">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  )
}

export function ConnectionError() {
  return <ErrorState icon={<div className="text-2xl text-rose-500">⚠️</div>} title="Connection lost" description="We are having trouble connecting. Please check your internet connection and try again." />
}

export function ModelError({ model }: { model?: string }) {
  return <ErrorState icon={<div className="text-2xl text-rose-500">🤖</div>} title={`${model ? `${model} unavailable` : 'Model unavailable'}`} description={`The ${model || 'selected'} AI model is currently unavailable. Please try a different model.`} />
}

export function APIError({ message }: { message?: string }) {
  return <ErrorState icon={<div className="text-2xl text-rose-500">📡</div>} title="Something went wrong" description={message || "An unexpected error occurred. Please try again."} />
}