"use client"

import { Wind, HeartHandshake, X as XIcon, Shield } from "lucide-react"

/**
 * Crisis support card — surfaced (only) when the intent layer reads an acute
 * self-harm signal. Warm, brief, never preachy. Offers a breath and a real way
 * to reach a human. It does NOT block the conversation — the user can dismiss it
 * and keep talking. This is support offered, not a gate.
 */
export function WellnessSupport({
  onBreathe,
  onDismiss,
}: {
  onBreathe: () => void
  onDismiss: () => void
}) {
  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 backdrop-blur-xl px-4 py-3.5">
      <div className="flex items-start gap-3">
        <HeartHandshake size={18} className="text-emerald-300 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground/90 leading-relaxed">
            That sounds really heavy. You don&apos;t have to carry it alone — talking to
            someone can help.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <a
              href="https://findahelpline.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/30 px-3 py-1.5 rounded-full transition-colors"
            >
              <HeartHandshake size={12} /> Talk to someone now
            </a>
            <button
              onClick={onBreathe}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-foreground/5 border border-border/50 text-foreground/70 hover:text-foreground hover:bg-foreground/10 px-3 py-1.5 rounded-full transition-colors"
            >
              <Wind size={12} /> Take a breath
            </button>
          </div>
        </div>
        <button onClick={onDismiss} className="text-foreground/30 hover:text-foreground/60 shrink-0">
          <XIcon size={16} />
        </button>
      </div>
    </div>
  )
}

/**
 * One-time, plain-language disclosure shown the first time a wellness read is
 * recorded. This is what makes the on-device mood signal consented + transparent
 * rather than covert profiling. Subtle, but not secret.
 */
export function WellnessDisclosure({ onAck }: { onAck: () => void }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-foreground/5 backdrop-blur-xl px-4 py-3 flex items-start gap-3">
      <Shield size={16} className="text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground/60 leading-relaxed">
          Kloom reads the mood of your chats <span className="text-foreground/80 font-medium">on your device</span> to
          respond better and offer support. It&apos;s never uploaded or sold. Turn it off or erase it any time in{" "}
          <span className="text-foreground/80 font-medium">Settings → Preferences</span>.
        </p>
      </div>
      <button
        onClick={onAck}
        className="text-xs font-semibold bg-foreground/10 border border-border/50 hover:bg-foreground/15 text-foreground/80 px-3 py-1.5 rounded-full transition-colors shrink-0"
      >
        Got it
      </button>
    </div>
  )
}
