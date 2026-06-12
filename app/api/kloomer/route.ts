// POST /api/kloomer — instant character synthesis.
//
// Input: a name ("Elon Musk"), a description ("a sarcastic VC who's seen it
// all"), or a social/media link. Output: a fully-formed cast member ready to
// drop into a room — name, gender, personality, speaking style, backstory,
// role, and a matched voice. If a YouTube link is given we also clone its
// voice (via /api/voice-clone) so the character sounds like the source.

import { resolveVoiceId } from "@/lib/voices"

export const runtime = "nodejs"
export const maxDuration = 60

const LLM_URL   = (process.env.LLM_BASE_URL || "http://localhost:11434/v1").replace(/\/$/, "")
const LLM_KEY   = process.env.LLM_API_KEY || "local"
const LLM_MODEL = process.env.LLM_MODEL || "llama3.2:latest"

interface KloomerPersona {
  name: string
  gender: "female" | "male" | "nonbinary"
  personality: string
  speakingStyle: string
  backstory: string
  relation: string
  tagline: string
}

function isUrl(s: string) { return /^https?:\/\//i.test(s.trim()) }
function isYouTube(s: string) { return /(?:youtube\.com|youtu\.be)/i.test(s) }

// Pull a usable handle/name from a social URL path, e.g.
// instagram.com/the.rock → "the rock"; x.com/elonmusk → "elonmusk".
function handleFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const seg = u.pathname.split("/").filter(Boolean)[0] || u.hostname.replace(/^www\./, "")
    return decodeURIComponent(seg).replace(/[._-]+/g, " ").replace(/^@/, "").trim()
  } catch { return url }
}

const SYNTH_SYSTEM = `You are a character designer. Given a name, description, or person, you output ONE vivid, believable character as STRICT JSON — nothing else, no prose, no markdown fences.

The JSON shape (all fields required):
{
  "name": "first name or short stage name, no titles",
  "gender": "female" | "male" | "nonbinary",
  "personality": "2-3 rich sentences in second person ('You are...'). Specific, opinionated, alive — quirks, what they care about, how they treat people.",
  "speakingStyle": "1-2 sentences. Concrete: rhythm, slang, verbal tics, energy.",
  "backstory": "2 sentences of lived life that explain who they are.",
  "relation": "their role in the room in a few words (host, rival, mentor, your date, the interviewer...)",
  "tagline": "<= 8 words, their hook"
}

If given a real public figure, capture their known persona and speech. If given a vague description, invent someone concrete and interesting. Output ONLY the JSON object.`

function extractJson(text: string): KloomerPersona | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const o = JSON.parse(m[0])
    if (!o.name || !o.personality) return null
    const gender = ["female", "male", "nonbinary"].includes(o.gender) ? o.gender : "nonbinary"
    return {
      name: String(o.name).slice(0, 40),
      gender,
      personality: String(o.personality || "").slice(0, 600),
      speakingStyle: String(o.speakingStyle || "Natural and present.").slice(0, 300),
      backstory: String(o.backstory || "").slice(0, 400),
      relation: String(o.relation || "member of the room").slice(0, 80),
      tagline: String(o.tagline || "").slice(0, 60),
    }
  } catch { return null }
}

export async function POST(request: Request) {
  let input = ""
  try { input = String((await request.json()).input || "").trim() } catch { /* noop */ }
  if (!input) return Response.json({ error: "Give a name, a description, or a link." }, { status: 400 })

  const url = isUrl(input) ? input : ""
  const subject = url ? handleFromUrl(url) : input
  const userMsg = url
    ? `Create a character based on the person known online as "${subject}" (from ${url}). Use what's publicly known about them; if little is known, build a plausible, vivid persona around the handle.`
    : `Create a character: ${subject}`

  // ── Synthesize the persona with the LLM ──
  let persona: KloomerPersona | null = null
  try {
    const res = await fetch(`${LLM_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${LLM_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: "system", content: SYNTH_SYSTEM },
          { role: "user", content: userMsg },
        ],
        temperature: 0.9,
        max_tokens: 500,
        stream: false,
      }),
      signal: AbortSignal.timeout(45000),
    })
    if (res.ok) {
      const data = await res.json()
      persona = extractJson(data?.choices?.[0]?.message?.content ?? "")
    }
  } catch { /* fall through to fallback */ }

  // Fallback if the model misbehaved — still return a usable character.
  if (!persona) {
    persona = {
      name: subject.split(/\s+/).slice(0, 2).join(" ") || "Someone",
      gender: "nonbinary",
      personality: `You are ${subject} — present, real, with strong opinions and a distinct way of seeing things.`,
      speakingStyle: "Natural, direct, a little unpredictable.",
      backstory: "",
      relation: "member of the room",
      tagline: "",
    }
  }

  // ── Voice: clone from YouTube if given, else a matched pool voice ──
  let voiceId: string | undefined = resolveVoiceId(persona.name, persona.gender)
  let voiceCloned = false
  if (url && isYouTube(url)) {
    try {
      const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
      const vc = await fetch(`${origin}/api/voice-clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, name: persona.name }),
        signal: AbortSignal.timeout(50000),
      })
      const vcData = await vc.json().catch(() => ({}))
      if (vc.ok && vcData.voiceId) { voiceId = vcData.voiceId; voiceCloned = true }
    } catch { /* keep pool voice */ }
  }

  return Response.json({ ...persona, voiceId, voiceCloned })
}
