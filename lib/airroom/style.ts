// User communication-style profile — collected once, shapes all future AI replies.
// NOT topic preferences. Pure signal on HOW the AI should talk to this specific user:
// register, pace, directness, profanity comfort, humor. Stored in localStorage.

export interface StyleProfile {
  choices: Record<string, string>   // question key → chosen word
  done: boolean
}

const LS_KEY = "airraw_style"

export const STYLE_QUESTIONS = [
  { key: "language", a: "say it raw",       b: "keep it clean"    },
  { key: "pace",     a: "short and sharp",  b: "tell me more"     },
  { key: "tone",     a: "be real with me",  b: "ease into it"     },
  { key: "energy",   a: "match my energy",  b: "stay easy"        },
  { key: "humor",    a: "make me laugh",    b: "keep it straight" },
] as const

export type StyleQuestion = typeof STYLE_QUESTIONS[number]

export function getStyle(): StyleProfile {
  try {
    const s = typeof localStorage !== "undefined" ? localStorage.getItem(LS_KEY) : null
    if (s) return JSON.parse(s) as StyleProfile
  } catch {}
  return { choices: {}, done: false }
}

export function saveStyle(profile: StyleProfile) {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(profile)) } catch {}
}

export function nextStyleQuestion(profile: StyleProfile): StyleQuestion | null {
  if (profile.done) return null
  return (STYLE_QUESTIONS.find(q => !profile.choices[q.key]) as StyleQuestion) ?? null
}

export function stylePromptLine(profile: StyleProfile): string {
  const c = profile.choices
  if (!Object.keys(c).length) return ""
  const notes: string[] = []
  if (c.language === "say it raw")       notes.push("raw language and profanity are welcome")
  else if (c.language)                   notes.push("keep language clean — no profanity")
  if (c.pace === "short and sharp")      notes.push("brief replies only, get to the point fast")
  else if (c.pace)                       notes.push("can go deeper — user enjoys more detail")
  if (c.tone === "be real with me")      notes.push("direct and unfiltered — no softening")
  else if (c.tone)                       notes.push("ease in gently, warm approach")
  // NEVER the word "mirror": this line lands at the END of the system prompt —
  // after every anti-mirroring rule — so it won the recency contest and literally
  // instructed the model to echo the user. That was the "AI just repeats what I
  // say / feels like an interview" bug. Match INTENSITY, never content.
  if (c.energy === "match my energy")    notes.push("match their intensity — but with your OWN material, never by repeating their words")
  else if (c.energy)                     notes.push("relaxed steady pace regardless of their energy")
  if (c.humor === "make me laugh")       notes.push("humor and jokes land — use them")
  else if (c.humor)                      notes.push("genuine over funny — skip the jokes")
  return notes.length
    ? `\nThis user's communication style (calibrate your tone exactly to this, never mention it): ${notes.join("; ")}.`
    : ""
}
