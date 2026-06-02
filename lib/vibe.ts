/**
 * Presence layer — read the user's intent and vibe from what they say, so the
 * AI can adapt (and the UI can show it). Heuristic + instant (no extra LLM call).
 *
 * Used in chat and on voice transcripts. The `hint` is injected into the system
 * prompt so the persona meets the user where they are.
 */

export type Intent =
  | "venting" | "seeking" | "flirting" | "excited" | "anxious"
  | "angry" | "bored" | "reflecting" | "casual"

export interface VibeRead {
  intent: Intent
  vibe: string        // one-word mood, shown to the user
  emoji: string
  energy: number      // 0-100, rough arousal/intensity
  hint: string        // steer for the AI (never shown to the user)
}

const RX: Array<{ intent: Intent; vibe: string; emoji: string; re: RegExp; hint: string }> = [
  { intent: "anxious", vibe: "tense", emoji: "😮‍💨",
    re: /\b(anxious|anxiety|stressed|stress|panic|overwhelm|nervous|can'?t breathe|freaking out|on edge|worried|dread)\b/i,
    hint: "Be calm and slow. Keep it short. You may gently offer to take a breath together." },
  { intent: "venting", vibe: "heavy", emoji: "🌧️",
    re: /\b(sad|depressed|tired|exhausted|drained|lonely|alone|cried|crying|down|hopeless|burnt? out|rough day|hard day)\b/i,
    hint: "Lead with warmth and presence. Do NOT fix, advise, or philosophize — just be with them." },
  { intent: "excited", vibe: "hyped", emoji: "✨",
    re: /(!{2,}|\b(omg|yay|amazing|so happy|excited|hyped|let'?s go|i did it|got the (job|offer)|great news|stoked)\b)/i,
    hint: "Match their energy and celebrate — short and hyped." },
  { intent: "flirting", vibe: "flirty", emoji: "💋",
    re: /(😘|😏|🥵|❤️|\b(miss you|cute|babe|baby|sexy|kiss|thinking about you|come over|wish you were here|tease)\b)/i,
    hint: "Be playful, warm, a little teasing. Keep it light." },
  { intent: "angry", vibe: "heated", emoji: "🔥",
    re: /\b(angry|pissed|furious|livid|mad|hate|fed up|sick of|wtf|so done)\b/i,
    hint: "Let them vent and validate the feeling. Don't argue or lecture." },
  { intent: "bored", vibe: "flat", emoji: "😐",
    re: /\b(bored|boring|nothing to do|meh|idk|whatever|so dull|nothing much)\b/i,
    hint: "Bring energy — tease, suggest something, stir it up." },
  { intent: "reflecting", vibe: "deep", emoji: "🌀",
    re: /\b(meaning of|the point of|why are we|what'?s it all|purpose of life|do (you|we) ever (think|wonder)|philosoph)\b/i,
    hint: "Stay PRESENT — react casually, do not philosophize or drop wisdom." },
  { intent: "seeking", vibe: "focused", emoji: "🎯",
    re: /\b(how do i|how can i|what should i|help me|can you|advice|recommend|fix|explain|teach me)\b/i,
    hint: "Be useful and direct — give the concrete thing." },
]

export function analyzeVibe(text: string): VibeRead {
  const t = (text || "").trim()
  // Energy from punctuation, caps, length
  const excl = (t.match(/!/g) || []).length
  const caps = t.replace(/[^A-Za-z]/g, "").length
    ? (t.replace(/[^A-Z]/g, "").length / t.replace(/[^A-Za-z]/g, "").length)
    : 0
  let energy = Math.min(100, 30 + excl * 12 + caps * 40 + (t.length > 120 ? 10 : 0))

  for (const r of RX) {
    if (r.re.test(t)) {
      if (r.intent === "venting" || r.intent === "bored" || r.intent === "reflecting") energy = Math.min(energy, 45)
      if (r.intent === "excited" || r.intent === "angry") energy = Math.max(energy, 75)
      return { intent: r.intent, vibe: r.vibe, emoji: r.emoji, energy: Math.round(energy), hint: r.hint }
    }
  }
  return { intent: "casual", vibe: "easy", emoji: "💬", energy: Math.round(energy),
    hint: "Keep it easy and natural — just be present." }
}

/** Map a 0-100 energy to a short label for UI. */
export function energyLabel(e: number): string {
  if (e >= 75) return "high energy"
  if (e >= 45) return "steady"
  return "low energy"
}
