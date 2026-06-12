// POST /api/room-architect — turns a raw intent into a room.
//
//   mode "suggest": { text } → 3 distinct ways to frame the idea as a room.
//   mode "cast":    { text, title, category } → a recommended cast of characters.
//
// The whole "describe it → we architect it" flow runs on this. Output is strict
// JSON; we parse defensively and always return something usable.

import type { RoomCategory } from "@/lib/rooms"
import { resolveVoiceId } from "@/lib/voices"

export const runtime = "nodejs"
export const maxDuration = 60

const LLM_URL   = (process.env.LLM_BASE_URL || "http://localhost:11434/v1").replace(/\/$/, "")
const LLM_KEY   = process.env.LLM_API_KEY || "local"
const LLM_MODEL = process.env.LLM_MODEL || "llama3.2:latest"

const CATEGORIES: RoomCategory[] = [
  "fantasy", "romantic", "dark", "social", "trading", "workshop",
  "creator", "professional", "philosophy", "co-intelligence", "zero-memory",
]

async function llm(system: string, user: string, maxTokens = 700): Promise<string> {
  const res = await fetch(`${LLM_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${LLM_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.85,
      max_tokens: maxTokens,
      stream: false,
    }),
    signal: AbortSignal.timeout(48000),
  })
  if (!res.ok) throw new Error(`llm ${res.status}`)
  const data = await res.json()
  return data?.choices?.[0]?.message?.content ?? ""
}

function extractJson<T>(text: string): T | null {
  const m = text.match(/[[{][\s\S]*[\]}]/)
  if (!m) return null
  try { return JSON.parse(m[0]) as T } catch { return null }
}

const SUGGEST_SYSTEM = `You turn a person's rough idea into three sharp, distinct room concepts for a multi-character voice platform. A "room" is a live space with a small cast of AI characters around a purpose.

Return STRICT JSON only — an array of exactly 3 objects, no prose:
[
  { "title": "punchy room name, <= 5 words", "angle": "one sentence on what happens here and why it's worth entering", "category": "<one of: fantasy, romantic, dark, social, trading, workshop, creator, professional, philosophy, co-intelligence, zero-memory>" }
]
Make the three genuinely different takes on the idea (e.g. a serious one, a playful one, a bold one). Choose the category that best fits each.`

const CAST_SYSTEM = `You design the cast for a room — the AI characters a user will pick from. Given the room's title, angle and category, return a roster of 6 vivid characters that belong in it.

Return STRICT JSON only — an array of exactly 6 objects, no prose:
[
  { "name": "first name / short handle", "gender": "female|male|nonbinary", "role": "their job in the room, few words", "personality": "1-2 punchy sentences in second person ('You are...')", "tagline": "<= 6 words hook" }
]
Give a real mix of genders and angles. They should feel like distinct people who'd actually clash and spark in this room.`

export async function POST(request: Request) {
  let body: { mode?: string; text?: string; title?: string; category?: string } = {}
  try { body = await request.json() } catch { /* noop */ }
  const mode = body.mode || "suggest"
  const text = String(body.text || "").trim()
  if (!text) return Response.json({ error: "Describe the room first." }, { status: 400 })

  // ── mode: suggest → 3 room directions ──
  if (mode === "suggest") {
    try {
      const raw = await llm(SUGGEST_SYSTEM, `Idea: ${text}`)
      const arr = extractJson<any[]>(raw)
      if (Array.isArray(arr) && arr.length) {
        const suggestions = arr.slice(0, 3).map((s) => ({
          title: String(s.title || "Untitled room").slice(0, 50),
          angle: String(s.angle || "").slice(0, 160),
          category: (CATEGORIES.includes(s.category) ? s.category : "social") as RoomCategory,
        }))
        return Response.json({ suggestions })
      }
    } catch { /* fall through */ }
    // Fallback: one direction echoing their text.
    return Response.json({
      suggestions: [{ title: text.slice(0, 40), angle: text.slice(0, 150), category: "social" as RoomCategory }],
    })
  }

  // ── mode: cast → recommended roster ──
  const category = (CATEGORIES.includes(body.category as RoomCategory) ? body.category : "social") as RoomCategory
  const title = String(body.title || text).slice(0, 60)
  try {
    const raw = await llm(CAST_SYSTEM, `Room: "${title}"\nAngle: ${text}\nCategory: ${category}`, 900)
    const arr = extractJson<any[]>(raw)
    if (Array.isArray(arr) && arr.length) {
      const cast = arr.slice(0, 6).map((c, i) => {
        const gender = ["female", "male", "nonbinary"].includes(c.gender) ? c.gender : (i % 2 ? "male" : "female")
        const name = String(c.name || `Character ${i + 1}`).slice(0, 32)
        return {
          name, gender,
          role: String(c.role || "member of the room").slice(0, 60),
          personality: String(c.personality || "").slice(0, 400),
          tagline: String(c.tagline || "").slice(0, 60),
          voiceId: resolveVoiceId(name, gender),
        }
      })
      return Response.json({ category, cast })
    }
  } catch { /* fall through */ }
  return Response.json({ category, cast: [] })
}
