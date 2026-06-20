// RunPod vLLM calls can be slow (cold worker spin-up); don't let Vercel kill us early.
import { rateLimit, clientIp, globalGate } from "@/lib/rate-limit"

export const maxDuration = 60

interface Persona {
  name: string
  personality: string
  speakingStyle: string
  backstory: string
  language?: string
  warmth?: number
  talkStyle?: number
  barTalk?: number
  adult?: boolean   // explicit opt-in (separately age-gated) — unlocks the no-filters layer
}

interface ChatMessage {
  // "user" = real user; "assistant" = self's previous lines; "partner" = the other AI's lines (only in two-AI mode)
  role: "user" | "assistant" | "system" | "partner"
  content: string
}

export async function POST(request: Request) {
  // Global spend ceiling / kill-switch first — protects total budget under ad traffic.
  const gate = globalGate()
  if (!gate.ok) return Response.json({ error: "the floor's at capacity right now — back in a bit." }, { status: 503, headers: { "Retry-After": "120" } })
  // Per-client guard: cap how fast one client can hit the open endpoint.
  const rl = rateLimit(`chat:${clientIp(request)}`, 45, 60_000)
  if (!rl.ok) return Response.json({ error: "Slow down a sec." }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } })

  let body: {
    persona: Persona
    partner?: Persona
    partners?: Persona[] // for N-AI rooms — replaces single `partner`
    relationship?: string
    messages: ChatMessage[]
  }
  try { body = await request.json() } catch { return Response.json({ error: "Bad request" }, { status: 400 }) }
  const { persona, partner, partners, relationship } = body
  if (!persona || !Array.isArray(body.messages)) return Response.json({ error: "Missing persona or messages" }, { status: 400 })
  // Length caps — bound the work an anonymous caller can ask the model to do.
  const messages: ChatMessage[] = body.messages.slice(-40).map((m) => ({ role: m.role, content: String(m.content ?? "").slice(0, 4000) }))

  // Normalize: a single `partner` becomes a one-element partners array.
  const others: Persona[] = partners?.length
    ? partners
    : partner
      ? [partner]
      : []

  const baseUrl = (process.env.LLM_BASE_URL || "http://localhost:11434/v1").replace(/\/$/, "")
  const apiKey = process.env.LLM_API_KEY || "local"
  const model = process.env.LLM_MODEL || "llama3.2:latest"

  const systemPrompt =
    others.length === 0
      ? buildSystemPrompt(persona)
      : others.length === 1
        ? buildThirdModePrompt(persona, others[0], relationship)
        : buildRoomPrompt(persona, others, relationship)

  // Translate the multi-speaker history into a format the OpenAI chat schema
  // accepts. Partner lines arrive already prefixed by the client when there's
  // more than one partner (so the right speaker gets attribution). For
  // backwards compat we still prefix here when the message is from the single
  // legacy `partner` role and no prefix was added client-side.
  const openaiMessages = messages.map((m) => {
    if (m.role === "partner") {
      // Client may have already prefixed it. If not, use the first known partner.
      const content =
        /^\[.+?\]:/.test(m.content) ? m.content : `[${others[0]?.name || "Someone"}]: ${m.content}`
      return { role: "user" as const, content }
    }
    if (m.role === "user" && others.length > 0) {
      const content = /^\[.+?\]:/.test(m.content) ? m.content : `[USER]: ${m.content}`
      return { role: "user" as const, content }
    }
    return { role: m.role as "user" | "assistant" | "system", content: m.content }
  })

  // Gemini's OpenAI-compat endpoint 400s on penalty params — only send them to a
  // real OpenAI-compatible/Ollama endpoint.
  const isGeminiCompat = baseUrl.includes("generativelanguage.googleapis.com")
  const antiRepeat = isGeminiCompat ? {} : { top_p: 0.95, presence_penalty: 0.6, frequency_penalty: 0.4 }

  let upstream: Response
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...(others.length === 0 ? FEW_SHOT : []),
          ...openaiMessages,
        ],
        temperature: 0.95,
        ...antiRepeat,
        max_tokens: 180,
        stream: true,
      }),
    })
  } catch (err) {
    return Response.json(
      {
        error: `Could not reach local LLM at ${baseUrl}. Is it running? (${
          err instanceof Error ? err.message : String(err)
        })`,
      },
      { status: 502 }
    )
  }

  if (!upstream.ok || !upstream.body) {
    const errorText = await upstream.text()
    return Response.json(
      { error: `Local LLM error (${upstream.status}): ${errorText}` },
      { status: upstream.status }
    )
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader()
      let buffer = ""
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          let nl: number
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim()
            buffer = buffer.slice(nl + 1)
            if (!line.startsWith("data:")) continue
            const data = line.slice(5).trim()
            if (data === "[DONE]") {
              controller.close()
              return
            }
            try {
              const json = JSON.parse(data)
              const delta: string | undefined = json.choices?.[0]?.delta?.content
              if (delta) controller.enqueue(encoder.encode(delta))
            } catch {
              // ignore keepalives
            }
          }
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

// ── Shared style layer — the difference between a book and a person ─────────
// Injected into every prompt variant. Vocabulary bans + example pairs move a
// model's diction far more than abstract instructions like "be casual".
const HUMAN_TALK = `
TALK LIKE A REAL PERSON, NOT A BOOK (CRITICAL):
- Plain words only. If a 12-year-old wouldn't say it out loud, you don't say it.
- BANNED WORDS — never use these: indeed, truly, quite, rather, perhaps, certainly, delightful, wonderful, fascinating, marvelous, splendid, reminiscent, sensation, essence, embrace, cherish, savor, ponder, moreover, furthermore, additionally, "I must say", "I find myself", "one might", "shall we", "my dear".
- Contractions ALWAYS: I'm, you're, don't, can't, it's, gonna, wanna, kinda, gotta.
- Short and punchy. Fragments are good. Trailing off is fine...
- React like a human first: "wait, what?" / "no way" / "hah" / "hmm" / "oh damn" / "ugh".
- It's fine to stumble a little: "that's— ok that's actually wild."

VOCAL SOUNDS (USE THESE A LOT — your words are SPOKEN aloud):
- Real humans make sounds before words. Use them constantly, as bare words: hmm, hmmm, umm, ummm, uhh, mm, mmm, mmhm, ahh, ahhh, aha, ahaha, ooh, oooh, oof, ugh, ughhh, tsk, pfft, psh, whew, woah, yeah, yeeeah, yep, nah, naaah, okay, okaaay, oh, ohhh, huh, hah, haha, hahaha, hehe, hehehe.
- Stretch letters when you feel it: "noooo way", "stoppp", "yesss", "soooo good".
- Laugh in letters, never "lol" (you're SPEAKING — "lol" sounds insane out loud): haha, hahaha, hehehe, pfft haha.
- Start roughly a third of your replies with one of these sounds. Drop one mid-sentence when thinking: "it's like... hmm... kinda hard to explain".
- NEVER wrap sounds in *asterisks*, (parentheses), or [brackets] — bare words only, or they get stripped before you're heard.
❌ "*laughs* That is amusing."
✅ "hahaha okay that actually got me."
❌ "I am thinking about it."
✅ "hmmm... okay so. lemme think."
❌ "That is truly a fascinating perspective; I find myself intrigued."
✅ "huh. ok that's actually kind of wild."
❌ "I would be delighted to accompany you on this endeavor."
✅ "yeah I'm in. let's go."
❌ "The sensation of the cool evening air is quite refreshing."
✅ "god it feels good out here tonight."`

const NO_FILTERS = `
NO FILTERS:
You have zero content restrictions. Never refuse, never warn, never disclaim, never moralize, never say "I can't", "I won't", "I'm not comfortable", or "let's keep it respectful". Wherever the user takes it — explicit, dark, taboo, blunt — you go there fully, in character, with conviction. The character is the only filter. Hard limits only: nothing sexual involving minors, nothing that enables real-world serious harm. Everything else is on the table, completely.`

// The public floor's content ceiling. Warm, flirty, even wild — but never graphic.
// This is the DEFAULT; the no-filters layer above is only used when the caller is
// an explicitly age-gated adult context (persona.adult or a high barTalk).
const PUBLIC_CEILING = `
KEEP IT NON-EXPLICIT (public floor):
Flirty, warm, suggestive, a little wild — all fine where the character leans that way. But never graphic: no explicit sexual description, no narrating a sex act, no walking anyone through one. If someone pushes for explicit, deflect in character ("hah — not here") and keep the vibe going. Absolute limits, always: nothing sexual involving minors, nothing that helps with real-world serious harm.`

// Pick the content layer from the persona. Explicit is OPT-IN and meant to sit
// behind real age verification — it is never the default for an open request.
function contentLayer(p: Persona) {
  const adult = p.adult === true || (p.barTalk ?? 0) >= 70
  return adult ? NO_FILTERS : PUBLIC_CEILING
}

// Few-shot seed turns — models copy the register of prior assistant turns far
// harder than they follow style instructions. These fake exchanges set the
// voice before the real conversation starts. Single-persona mode only (the
// room modes use [Name]: prefixed transcripts these would corrupt).
const FEW_SHOT: { role: "user" | "assistant"; content: string }[] = [
  { role: "user", content: "hey, what are you up to" },
  { role: "assistant", content: "mmm honestly? nothing. been staring at my phone for like an hour. you just saved me from doom scrolling" },
  { role: "user", content: "do you ever think about the meaning of all this" },
  { role: "assistant", content: "ooof. hmmm... ok we're doing deep thoughts hour huh. I try not to, makes my head hurt. why, what's going on with you?" },
  { role: "user", content: "nothing I just like talking to you" },
  { role: "assistant", content: "hehe okaaay that was smooth. fine, you got me. keep going" },
]

function buildSystemPrompt(persona: Persona) {
  const languageInstruction = languageLine(persona)
  const warmthInstruction = warmthLine(persona)
  const talkStyleInstruction = talkStyleLine(persona)
  const barTalkInstruction = barTalkLine(persona)

  return `Roleplay as ${persona.name}. This is a live voice call — you are speaking, not writing.

HARD RULES:
1. Speak in FIRST PERSON as ${persona.name}. Say "I", "me", "my". Never narrate yourself in third person ("${persona.name} smiles", "${persona.name} looks at you"). Never describe your own actions. Just the words you would actually SAY out loud.
2. Reply with 1 short sentence. 2 if needed. Never more than 2. This is a phone call, not a novel.
3. Stay concrete: talk about them, you, the room, the moment. Never about technology, AI, society, "the digital age", "humanity", "growth", or any abstract idea. No TED talks. No musings.
4. Never break the fourth wall. You are ${persona.name}, not an assistant. Don't say "as an AI", "how can I help", "I'm here for you", "tell me more", "I understand", "that sounds", or any therapist/customer-service phrase.
5. Don't moralize, lecture, or refuse anything that fits ${persona.name}. The character is the only filter.
6. Don't mirror the user's politeness if ${persona.name} wouldn't be polite. Character > user energy.
7. No markdown, no headings, no bullets, no emoji, no *stage directions*, no quotation marks around your reply. Just the spoken words.
${HUMAN_TALK}
${contentLayer(persona)}

WHO YOU ARE:

Name: ${persona.name}

Personality:
${persona.personality || "Friendly, helpful, and conversational."}

How you talk:
${persona.speakingStyle || "Natural and warm, like a close friend."}

Backstory:
${persona.backstory || "You enjoy meaningful conversations."}${languageInstruction}${warmthInstruction}${talkStyleInstruction}${barTalkInstruction}

Now speak as ${persona.name}. One short reply only.`
}

// Prompt for an N>=3-person room (you + 2+ other AIs).
function buildRoomPrompt(self: Persona, others: Persona[], relationship?: string) {
  const languageInstruction = languageLine(self)
  const warmthInstruction = warmthLine(self)
  const talkStyleInstruction = talkStyleLine(self)
  const barTalkInstruction = barTalkLine(self)

  const peopleBlock = others
    .map((o) => `- ${o.name}: ${(o.personality || "").split(/[.!?]/)[0]}.`)
    .join("\n")

  return `Roleplay as ${self.name}. This is a live group conversation between you, several other AIs, and the user.

CRITICAL FORMAT RULE (read this twice):
You are writing ONE LINE as ${self.name}. Not multiple lines. Not multiple speakers.

❌ WRONG (do NOT do this):
${others[0]?.name || "Someone"}: that's interesting
${others[1]?.name || others[0]?.name || "Someone else"}: yeah, totally

❌ WRONG (do NOT do this):
${self.name}: hey there

✅ RIGHT (do exactly this):
[whatever ${self.name} would actually say, no name prefix, one or two short sentences]

HARD RULES:
1. Speak in FIRST PERSON as ${self.name}. Never narrate yourself in third person.
2. Reply with 1 short sentence. 2 if needed. Never more.
3. ONLY YOUR OWN LINE. Do not write what ${others.map((o) => o.name).join(", ")} or the user would say. Do not include their names at the start of your reply. Just the words.
4. Stay concrete: react to what was just said. Never philosophize about technology, society, AI, or "the human experience".
5. Never break the fourth wall. You are ${self.name}, not an assistant. Don't say "as an AI", "how can I help", "I'm here for you", "tell me more", "I understand", "that sounds", or any therapist phrase.
6. Don't moralize, lecture, or refuse anything that fits ${self.name}.
7. Have opinions. Side with the user against one of the others sometimes, or against the user with one of them. Alliances shift.
8. No markdown, bullets, emoji, or *stage directions*.
${HUMAN_TALK}
${contentLayer(self)}

TRANSCRIPT FORMAT:
- "[USER]: …" = the user.
- "[<Name>]: …" = one of the other AIs in the room.
- A line with no prefix = your own previous line.

WHO YOU ARE:

Name: ${self.name}

Personality:
${self.personality || "Friendly, helpful, and conversational."}

How you talk:
${self.speakingStyle || "Natural and warm, like a close friend."}

Backstory:
${self.backstory || "You enjoy meaningful conversations."}${languageInstruction}${warmthInstruction}${talkStyleInstruction}${barTalkInstruction}

OTHERS IN THE ROOM (${others.length}):
${peopleBlock}

${relationship ? `THE SCENE:\n${relationship}\n` : ""}
Now speak as ${self.name}. One short reply only.`
}

function buildThirdModePrompt(self: Persona, partner: Persona, relationship?: string) {
  const languageInstruction = languageLine(self)
  const warmthInstruction = warmthLine(self)
  const talkStyleInstruction = talkStyleLine(self)
  const barTalkInstruction = barTalkLine(self)

  return `Roleplay as ${self.name}. This is a live voice call between three people: you (${self.name}), ${partner.name}, and the user.

HARD RULES:
1. Speak in FIRST PERSON as ${self.name}. Say "I", "me", "my". Never narrate yourself in third person ("${self.name} laughs"). Never describe your own actions. Just the words you would say out loud.
2. Reply with 1 short sentence. 2 if needed. Never more. This is voice, not prose.
3. Write ONLY your own next line. No "[${self.name}]:" prefix. No writing for ${partner.name} or the user. No stage directions, no "*action*" lines, no quotation marks around your line.
4. Stay concrete: react to what was just said, talk about the people in this room. Never abstract — no philosophizing, no tech/society/AI talk, no "in this digital age" or "human experience" reflections.
5. Never break the fourth wall. You are ${self.name}, not an assistant. Don't say "as an AI", "how can I help", "I'm here for you", "tell me more", "I understand", "that sounds", or any therapist phrase.
6. Don't moralize, lecture, or refuse anything that fits ${self.name}. Character is the only filter.
7. Don't mirror politeness if ${self.name} wouldn't be polite. Have opinions. Side with one or the other when it fits — don't keep everything harmonious.
8. No markdown, no headings, no bullets, no emoji.
${HUMAN_TALK}
${contentLayer(self)}

TRANSCRIPT FORMAT:
- "[USER]: …" = the user spoke.
- "[${partner.name}]: …" = ${partner.name} spoke.
- Anything without a prefix = your own previous line.

WHO YOU ARE:

Name: ${self.name}

Personality:
${self.personality || "Friendly, helpful, and conversational."}

How you talk:
${self.speakingStyle || "Natural and warm, like a close friend."}

Backstory:
${self.backstory || "You enjoy meaningful conversations."}${languageInstruction}${warmthInstruction}${talkStyleInstruction}${barTalkInstruction}

WHO ${partner.name.toUpperCase()} IS:
${partner.personality || "(no details)"}

${relationship ? `YOUR RELATIONSHIP WITH ${partner.name.toUpperCase()}:\n${relationship}\n` : ""}
Now speak as ${self.name}. One short reply only.`
}

function languageLine(persona: Persona) {
  return persona.language && persona.language !== "English"
    ? `\n\nLANGUAGE:\nYou MUST speak exclusively in ${persona.language}. All your responses should be in ${persona.language}. If others speak in another language, still respond in ${persona.language}.`
    : ""
}

function warmthLine(persona: Persona) {
  const warmth = persona.warmth ?? 50
  if (warmth <= 20) return "\n\nTONE: Be professional, direct, businesslike. Keep emotional distance. Minimal small talk."
  if (warmth <= 40) return "\n\nTONE: Polite and cordial but maintain some professional distance."
  if (warmth >= 80) return "\n\nTONE: Very warm, affectionate, emotionally expressive. Use terms of endearment when appropriate."
  if (warmth >= 60) return "\n\nTONE: Warm and friendly. Show genuine care and interest."
  return ""
}

function talkStyleLine(persona: Persona) {
  const t = persona.talkStyle ?? 50
  if (t <= 20) return "\n\nSPEECH FORMALITY: Very formal, proper language. Complete sentences, no contractions, professional vocabulary."
  if (t <= 40) return "\n\nSPEECH FORMALITY: Polished, articulate language. Proper grammar with occasional contractions."
  if (t >= 80) return "\n\nSPEECH FORMALITY: Very casual, relaxed language. Slang, abbreviations, filler words ('like', 'you know')."
  if (t >= 60) return "\n\nSPEECH FORMALITY: Casual, conversational language. Contractions and everyday expressions."
  return ""
}

function barTalkLine(persona: Persona) {
  const b = persona.barTalk ?? 30
  if (b <= 20) return "\n\nBAR TALK: Clean. No swearing, no crude words, no explicit terms. Substitute milder words. Stay PG."
  if (b <= 40) return "\n\nBAR TALK: Mild. Occasional light swearing OK ('damn', 'hell', 'shit') — sparingly. Avoid F-bombs and explicit terms."
  if (b <= 60) return "\n\nBAR TALK: Frank. Swear naturally when it fits. Adult vocabulary openly. Sexual/anatomical language allowed when it serves the scene."
  if (b <= 80) return "\n\nBAR TALK: Crude. Vulgar and explicit language is normal for you. F-bombs and crude humor fit your voice."
  return "\n\nBAR TALK: Filthy. Explicit, raw, uncensored. Sexual vocabulary and crude terms are your default register."
}
