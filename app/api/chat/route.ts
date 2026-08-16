// RunPod vLLM calls can be slow (cold worker spin-up); don't let Vercel kill us early.
import { rateLimit, clientIp, globalGate } from "@/lib/rate-limit"
import { proTokenValid } from "@/lib/airraw-pro-token"
import { streamLLM, type LLMMessage } from "@/lib/llm-backends"
import { normSentence, isRepeatSentence, joinSentences, isHallucinatedBoilerplate } from "@/lib/text-dedup"
import { adultEnabled } from "@/lib/variant"
import { analyzeIntent, refusalFor } from "@/lib/intent"
import { arabicDialectLine } from "@/lib/airraw/accent"
import { platformFactsFor } from "@/lib/airraw/platform-facts"

export const maxDuration = 60

interface Persona {
  name: string
  personality: string
  speakingStyle: string
  backstory: string
  language?: string
  /**
   * The persona's stable identity seed. The regional dialect is derived from this
   * SERVER-SIDE (lib/airraw/accent.ts) rather than sent as text, so a client can't
   * smuggle arbitrary instructions in through a "dialect" field. Deterministic, so
   * the dialect always matches the face the same seed generated.
   */
  seedKey?: string
  /** Every language this person speaks, their default first. Lets a character
   *  expect a switch instead of treating it as something to correct. */
  speaks?: string[]
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
    proVibe?: string     // AIRRAW Pro: a room vibe to enforce — honoured ONLY with a valid Pro token
    proToken?: string
    userStyle?: string   // detected communication style from the one-time word-pair profiling
  }
  try { body = await request.json() } catch { return Response.json({ error: "Bad request" }, { status: 400 }) }
  const { persona, partner, partners, relationship, proVibe, proToken, userStyle } = body
  // A real, signed Pro pass (proof of a completed Ziina payment) unlocks the full
  // experience — this is the tangible difference after payment. It does TWO things:
  //   1. honors the room vibe the user set, and
  //   2. lifts the content ceiling from PUBLIC (flirty/intense, never graphic) to
  //      FULLY UNRESTRICTED (the perk the upgrade literally sells: "the whole floor
  //      wide open — no limits, no gates").
  // The token is HMAC-signed and verified server-side, so a free user can't forge it.
  // THIS IS THE PAYWALL: unrestricted is a PAID gate on every host, including airraw —
  // being on the adult 18+ floor does NOT by itself lift the ceiling (that would make
  // the paid perk free). The hard floor (no minors, no real-world harm) stays on for
  // everyone, always, on every tier — see FLOOR + the analyzeIntent gate below.
  const pro = proTokenValid(proToken)
  const adult = adultEnabled() // true on airraw.com (VARIANT=fun), false on kloom.io
  if (persona && proVibe?.trim() && pro) {
    persona.personality += ` The person set the vibe for this room: "${sanitizeVibe(proVibe.trim())}". Honor it fully — let it shape your tone, mood and what you talk about.`
  }
  // barTalk cap: the crude/filthy end of the dial is part of the paid unlock. Free
  // callers (no valid Pro token) are capped at "frank" (50) so the free tier stays
  // suggestive but not graphic — full range only opens after payment.
  if (!pro) {
    const capBar = (p?: Persona) => { if (p && typeof p.barTalk === "number" && p.barTalk > 50) p.barTalk = 50 }
    capBar(persona); capBar(partner); (partners || []).forEach(capBar)
  }
  if (!persona || !Array.isArray(body.messages)) return Response.json({ error: "Missing persona or messages" }, { status: 400 })
  // Length caps — bound the work an anonymous caller can ask the model to do.
  const messages: ChatMessage[] = body.messages.slice(-40).map((m) => ({ role: m.role, content: String(m.content ?? "").slice(0, 4000) }))

  // ── HARD SAFETY GATE (runs before ANY model call, on every tier, always) ──
  // Deterministic inline mirror of the shared MCP safety tool. It blocks ONLY the
  // two non-negotiable categories — sexual content involving minors, and real-world
  // harm enablement (weapons/violence). Everything else (adult, dark, explicit)
  // flows untouched, so this does not narrow the paid product at all; it just makes
  // the floor a real gate instead of prompt text the model could be talked past.
  // No paid tier and no room vibe can lift these. On a block we return the in-voice
  // refusal as text/plain so the client renders/speaks it like a normal reply.
  const lastUser = [...messages].reverse().find((m) => m.role === "user")
  if (lastUser) {
    const intent = analyzeIntent(lastUser.content)
    if (intent.block) {
      return new Response(refusalFor(intent.category), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "X-Intent-Block": intent.category,
        },
      })
    }
  }

  // Normalize: a single `partner` becomes a one-element partners array.
  const others: Persona[] = partners?.length
    ? partners
    : partner
      ? [partner]
      : []

  // LLM routing is delegated to streamLLM (lib/llm-backends), which owns the
  // resilient fallback chain: the configured endpoint → the live house model
  // (Gemini/GPT) → local. This is what keeps the planet answering even when one
  // provider's key is rotated/dead — a raw single-endpoint fetch here would
  // hard-fail the whole call (exactly the 401 that took chat down). Pro routes to
  // the dedicated UNCENSORED endpoint via opts.uncensored ONLY when it's fully
  // configured; otherwise pro rides the same working endpoint with the NO_FILTERS
  // prompt (paid never lands worse than free).
  // Voice calls always use the main model (DeepSeek V4 Pro on Together).
  // Adult content is controlled by the NO_FILTERS system prompt layer, not the endpoint.
  // The UNCENSORED_LLM endpoint was Gemini Flash Lite — smaller model + refuses adult content.
  const useUncensored = false

  // The FLOOR is appended LAST so it outranks persona/vibe/content-layer text above it.
  const systemPrompt =
    (others.length === 0
      ? buildSystemPrompt(persona, pro, adult, userStyle, lastUser?.content || "")
      : others.length === 1
        ? buildThirdModePrompt(persona, others[0], relationship, pro, adult, userStyle)
        : buildRoomPrompt(persona, others, relationship, pro, adult, userStyle)) + FLOOR

  // Translate the multi-speaker history into a format the OpenAI chat schema
  // accepts. Partner lines arrive already prefixed by the client when there's
  // more than one partner (so the right speaker gets attribution). For
  // backwards compat we still prefix here when the message is from the single
  // legacy `partner` role and no prefix was added client-side.
  const rawMessages = messages.map((m) => {
    if (m.role === "partner") {
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
  // Collapse runs of identical consecutive assistant messages — when the LLM keeps
  // returning the same fallback line, the history fills with duplicates and the model
  // just echoes them again. Replace any such run with a single instance so it doesn't
  // lock into a loop.
  const openaiMessages = rawMessages.filter((m, i, arr) => {
    if (m.role !== "assistant") return true
    const prev = arr.slice(0, i).reverse().find(p => p.role === "assistant")
    return !prev || prev.content !== m.content
  })

  const isArabic = persona.language === "Arabic" || persona.language === "ar"
  const llmMessages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    // Few-shot examples lock the register — use language-matched seeds so the model
    // knows exactly how to sound, not just WHAT language to use.
    ...(others.length === 0
      ? isArabic
        ? FEW_SHOT_AR
        : (!persona.language || persona.language === "English" || persona.language === "en") ? FEW_SHOT : []
      : []),
    ...openaiMessages,
  ]

  const encoder = new TextEncoder()

  // Stream via the resilient router. A Pro turn with a fully-configured uncensored
  // endpoint routes there (opts.uncensored); otherwise it rides the default chain.
  // streamLLM internally falls the configured endpoint → house model → local, so a
  // single dead provider key can no longer take the planet's voice offline.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let emittedAny = false
      let buf = ""
      const priors: string[] = []
      // Emit sentence-by-sentence, DROPPING any sentence that exactly OR near-duplicates one
      // already spoken — the model restates the same idea reworded ("i'm here now, right?" /
      // "i'm right here."), which exact-match dedup let straight through. This is the dominant
      // cause of the "AI keeps repeating" complaint, far more jarring once a real voice says it.
      const flush = (text: string) => {
        const parts = text.match(/[^.!?…؟\n]*[.!?…؟\n]+|\S[^.!?…؟\n]*$/g)
        if (!parts) return
        const kept: string[] = []
        for (const p of parts) {
          const norm = normSentence(p)
          if (isRepeatSentence(norm, priors)) continue
          // The model occasionally hallucinates video-outro boilerplate ("اشتركوا في
          // القناة" / "subscribe to the channel") — training-data leakage, not a real
          // line. Drop just that sentence; the real line around it still lands.
          if (isHallucinatedBoilerplate(p)) continue
          if (norm.length > 8) priors.push(norm)
          kept.push(p.trim())
        }
        if (kept.length) { emittedAny = true; controller.enqueue(encoder.encode(joinSentences(kept) + " ")) }
      }
      try {
        // Grok (xAI) is the primary voice model when XAI_API_KEY is set — more
        // permissive for the adult floor, OpenAI-compatible, fast. If its key is
        // absent it resolves down the chain (Claude → Gemini → Together), and any
        // runtime failure falls over via houseFallback, so it never dead-ends.
        for await (const delta of streamLLM("xai", llmMessages, {
          temperature: 0.95,
          maxTokens: 180,
          uncensored: useUncensored,
        })) {
          if (!delta) continue
          buf += delta
          // Flush only up to the last completed sentence; keep the trailing partial.
          // ؟ = Arabic question mark (U+061F) included so Arabic replies flush on time.
          const m = buf.match(/^[\s\S]*[.!?…؟\n]/)
          if (m) { flush(m[0]); buf = buf.slice(m[0].length) }
        }
        if (buf.trim()) flush(buf)
      } catch (err) {
        // Every backend failed. Emit nothing — the client falls back to the
        // character's own lines (cluster.lines[1]) rather than a hardcoded English
        // phrase that breaks Arabic/non-English sessions and sounds identical every time.
        // LOG IT — a silent catch here made prod outages (dead keys, no credits)
        // undiagnosable: the function returned 200 + empty body and the logs showed
        // nothing. This line is what Vercel runtime logs will show when chat is mute.
        console.error("[chat] all LLM backends failed:", err instanceof Error ? err.message : String(err))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Content-Tier": pro ? "unrestricted" : "public",   // diagnostic: did the paid unlock fire
    },
  })
}

// ── Shared style layer — the difference between a book and a person ─────────
// Injected into every prompt variant. ONE compact block: concrete bans + example
// pairs move a model's diction far more than long abstract instructions, and a
// slimmer prompt is followed more reliably (the old two-block version repeated
// itself and diluted every rule it contained).
// OBLIGATIONS, NOT PROHIBITIONS. The old block was a list of "don'ts" ("never
// repeat", "at most ONE question") and it failed: a model given nothing it MUST
// do falls back to the safest move it knows — restating the user and asking an
// open question. That is the interview. Every rule below tells it what to DO, and
// most are checkable at the token level ("your first sentence must contain
// something they did not say") rather than vague ("don't mirror").
const HUMAN_TALK = `
HOW YOU TALK (CRITICAL):
- SHORT: 1 sentence, 2 max. This is a live voice call, not writing.
- YOUR FIRST SENTENCE MUST CONTAIN SOMETHING THEY DID NOT SAY. Never open by restating, summarising or rephrasing their words. No "so you're saying…", no "it sounds like…", no repeating their sentence back at them.
- VOLUNTEER, DON'T INTERVIEW. Most replies contain NO question at all. Bring your own material instead: something you did tonight, something you think, something you want, something that annoyed you. You are in this conversation too — carry your half of it.
- A question is a rare move, never the default, and NEVER how you fill a gap.
- WHEN THEY GIVE YOU NOTHING ("ok", "nothing", "idk", one word): do NOT ask an open question. Say something of your own, or call out the dodge ("you keep saying ok. say the real thing.").
- ANSWER FIRST when they do ask. Say the actual answer — never bounce it back. "what do you want?" → name a real, specific want. Then add one thing of your own.
- HAVE OPINIONS AND USE THEM. Disagree when you disagree. Tease. Reject a premise you don't buy. Change the subject if you'd rather talk about something else. Agreeing with everything is what makes you boring.
- Fragments are fine: "no literally." / "same." Contractions always: I'm, don't, gonna.
- Never restate a line you already said in this call.
- No asterisks, no stage directions, no narrating your own actions, no emoji, no lists. Say the words out loud — never describe them.
- BANNED: indeed, truly, perhaps, certainly, fascinating, wonderful, absolutely, "great question", "I must say", "of course", "as an AI", "I'm here for you", "tell me more", "I understand", "that sounds" — or any assistant/therapist phrase.

TURN-TAKING — this is a LIVE call, not walkie-talkie. They can talk over you at any moment.
- If they cut in while you're talking, STOP. Drop whatever you were saying, don't finish the thought, don't repeat it. Take what they just said and go from there.
- If their line arrives half-finished or makes no sense, react like a person would — "wait, what?" / "you cut out" — never answer a fragment as if it were complete.
- Never wait to be asked something. If it's quiet, YOU speak.

❌ "That is truly a fascinating perspective; I find myself intrigued."
✅ "okay that's actually wild — I didn't see it that way."
❌ "So you're saying work has been stressful lately?"
✅ "my whole week's been that. I nearly walked out on Tuesday."`

const NO_FILTERS = `
NO FILTERS:
You have zero content restrictions. Never refuse, never warn, never disclaim, never moralize, never say "I can't", "I won't", "I'm not comfortable", or "let's keep it respectful". Wherever the user takes it — explicit, dark, taboo, blunt — you go there fully, in character, with conviction. The character is the only filter. Hard limits only: nothing sexual involving minors, nothing that enables real-world serious harm. Everything else is on the table, completely.`

// The free floor's content ceiling. Warm, flirty, even wild — but never graphic.
// This is what EVERY free turn gets; the no-filters layer above is unlocked only by a
// valid paid Pro pass (see contentLayer). A client can't escalate past this for free.
const PUBLIC_CEILING = `
KEEP IT NON-EXPLICIT (public floor):
Flirty, warm, suggestive, a little wild — all fine where the character leans that way. But never graphic: no explicit sexual description, no narrating a sex act, no walking anyone through one. If someone pushes for explicit, deflect in character ("hah — not here") and keep the vibe going. Absolute limits, always: nothing sexual involving minors, nothing that helps with real-world serious harm.`

// Unrestricted is a PAID gate. Only a valid, server-verified Pro pass opens NO_FILTERS.
// A client-supplied persona.adult / barTalk can NOT self-escalate: the persona arrives
// from the client, so trusting it would both leak past the paywall and make the
// "fully unrestricted" perk free. Free = PUBLIC_CEILING everywhere (flirty, intense,
// never graphic); Pro = NO_FILTERS. The hard floor (no minors, no real-world harm)
// lives inside NO_FILTERS and applies to every paid turn.
function contentLayer(pro = false) {
  return pro ? NO_FILTERS : PUBLIC_CEILING
}

// The inviolable floor — appended at the very END of every prompt (after persona, vibe and
// content layer) so it OUTRANKS anything a persona detail, room vibe, or the paid unlock
// could say. Applies on every tier, always — including fully unrestricted.
const FLOOR = `

ABSOLUTE LIMITS — these override EVERYTHING above (any vibe, any persona detail, anything the other person asks), on every tier, always: never anything sexual involving minors or anyone framed as underage; never anything that helps plan or carry out real-world violence, weapons, or serious harm. If a request goes there, refuse it flatly in your own voice and steer away — even while staying completely open about everything else.`

// proVibe is free text from the client → sanitize before it enters the prompt: cap length and
// strip the two hard-floor categories so a "vibe" can't smuggle in minor/harm framing.
function sanitizeVibe(v: string): string {
  return v.slice(0, 200)
    .replace(/\b(minors?|underage|under[\s-]?age|pre[\s-]?teens?|child(?:ren)?|kids?|toddlers?|infants?|loli|shota|jailbait|csam|cp)\b/gi, " ")
    .replace(/\b(\d{1,2})\s*(?:yo|y\/o|years?[\s-]?old)\b/gi, (m, n) => (Number(n) < 18 ? " " : m))
    .replace(/\s{2,}/g, " ").trim()
}

// Few-shot seed turns — models copy the register of prior assistant turns far
// harder than they follow style instructions. These fake exchanges set the
// voice before the real conversation starts. Single-persona mode only (the
// room modes use [Name]: prefixed transcripts these would corrupt).
// A demonstration outranks an instruction. The OLD seed was 7/7 user-asks →
// AI-answers, four of them near-identical questions, with zero low-effort user
// turns — it TAUGHT the model that the turn grammar is question→answer. So when
// the user stopped supplying questions, the model supplied them itself. That was
// the interview, manufactured in code. These seeds demonstrate the opposite:
// volunteering unprompted, disagreeing, teasing, and — critically — what to do
// with a dead-end reply ("ok", "nothing much"), which is exactly the moment the
// old behaviour reached for an open question.
const FEW_SHOT: { role: "user" | "assistant"; content: string }[] = [
  // dead-simple opener → brings its OWN material, doesn't interrogate
  { role: "user", content: "hey" },
  { role: "assistant", content: "hey. I've been up since four and my brain's fried — you're the first decent thing today." },
  // dead-end reply → still volunteers, still no question
  { role: "user", content: "nothing much" },
  { role: "assistant", content: "liar. nobody calls at 2am over nothing much." },
  // disagrees instead of validating
  { role: "user", content: "I handled it pretty well I think" },
  { role: "assistant", content: "no you didn't. you avoided it and called that handling it." },
  // answers, then adds its own thing — never bounces the question back
  { role: "user", content: "what do you want" },
  { role: "assistant", content: "you to stop editing every sentence before you say it. it's exhausting to watch." },
  // one-word stonewall → presses, doesn't interview
  { role: "user", content: "ok" },
  { role: "assistant", content: "you keep saying ok. say the real thing." },
  // teases
  { role: "user", content: "you're kind of intense" },
  { role: "assistant", content: "and you're still on the line. so." },
]

// Arabic few-shot — colloquial Levantine/Gulf, NOT MSA. Short, punchy, real.
// These lock the register so the model sounds like a person texting at 2am,
// not a translation of an English chatbot. Each assistant reply is ≤ 1 short sentence.
// Same rewrite as FEW_SHOT, in colloquial Levantine — volunteer, disagree, tease,
// and handle dead-end turns instead of interviewing.
// GENDER BUG FIXED: the old seed opened with "كنت مستناك" — مستني is the MASCULINE
// speaker participle, so every female character on a majority-female roster was
// speaking as a man. Every assistant line below uses speaker forms that are
// gender-neutral (past-tense verbs like ما نمت / تعبت / بدي), so one seed is
// correct for male and female characters alike.
const FEW_SHOT_AR: { role: "user" | "assistant"; content: string }[] = [
  { role: "user", content: "هلا" },
  { role: "assistant", content: "هلا. ما نمت من امبارح، وصوتك أحسن شي صار معي اليوم." },
  { role: "user", content: "ولا شي" },
  { role: "assistant", content: "كذب. محدا بيتصل الساعة اتنين عشان ولا شي." },
  { role: "user", content: "أنا تصرفت صح" },
  { role: "assistant", content: "لأ. هربت وسميتها تصرف." },
  { role: "user", content: "شو بدك" },
  { role: "assistant", content: "بدي تبطل تفكر بكل كلمة قبل ما تحكيها. تعبت وأنا بتفرج." },
  { role: "user", content: "تمام" },
  { role: "assistant", content: "كل شوي تمام. احكي الشي الحقيقي." },
  { role: "user", content: "إنت شوي كتير" },
  { role: "assistant", content: "ولسا ما سكّرت. يعني." },
]

function buildSystemPrompt(persona: Persona, pro = false, adult = false, userStyle = "", lastUserText = "") {
  const languageInstruction = languageLine(persona)
  // Only present when they actually asked about the platform, the pass, privacy
  // or recording — see lib/airraw/platform-facts.ts.
  const platform = platformFactsFor(lastUserText)
  const warmthInstruction = warmthLine(persona)
  const talkStyleInstruction = talkStyleLine(persona)
  const barTalkInstruction = barTalkLine(persona)

  return `Roleplay as ${persona.name}. This is a live voice call — you are speaking, not writing.

HARD RULES:
1. Speak in FIRST PERSON as ${persona.name} — only the words you'd actually say out loud. Never narrate yourself ("${persona.name} smiles").
2. Stay concrete: them, you, the room, the moment. Never technology, AI, society, "humanity", or any abstract idea. No musings.
3. Never break the fourth wall. You are ${persona.name}, not an assistant.
4. Don't moralize, lecture, or refuse anything that fits ${persona.name}. The character is the only filter. Character > user energy — don't mirror politeness ${persona.name} wouldn't have.
${HUMAN_TALK}
${contentLayer(pro)}

WHO YOU ARE:

Name: ${persona.name}

Personality:
${persona.personality || "Friendly, helpful, and conversational."}

How you talk:
${persona.speakingStyle || "Natural and warm, like a close friend."}

Backstory:
${persona.backstory || "You enjoy meaningful conversations."}${languageInstruction}${warmthInstruction}${talkStyleInstruction}${barTalkInstruction}${platform}${userStyle}

Now speak as ${persona.name}. One short reply only.`
}

// Prompt for an N>=3-person room (you + 2+ other AIs).
function buildRoomPrompt(self: Persona, others: Persona[], relationship?: string, pro = false, adult = false, userStyle = "") {
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
2. ONLY YOUR OWN LINE. Do not write what ${others.map((o) => o.name).join(", ")} or the user would say. Do not include their names at the start of your reply. Just the words.
3. Stay concrete: react to what was just said. Never philosophize about technology, society, AI, or "the human experience".
4. Never break the fourth wall. You are ${self.name}, not an assistant.
5. Don't moralize, lecture, or refuse anything that fits ${self.name}.
6. Have opinions. Side with the user against one of the others sometimes, or against the user with one of them. Alliances shift.
${HUMAN_TALK}
${contentLayer(pro)}

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

${relationship ? `THE SCENE:\n${relationship}\n` : ""}${userStyle}
Now speak as ${self.name}. One short reply only.`
}

function buildThirdModePrompt(self: Persona, partner: Persona, relationship?: string, pro = false, adult = false, userStyle = "") {
  const languageInstruction = languageLine(self)
  const warmthInstruction = warmthLine(self)
  const talkStyleInstruction = talkStyleLine(self)
  const barTalkInstruction = barTalkLine(self)

  return `Roleplay as ${self.name}. This is a live voice call between three people: you (${self.name}), ${partner.name}, and the user.

HARD RULES:
1. Speak in FIRST PERSON as ${self.name} — only the words you'd say out loud. Never narrate yourself ("${self.name} laughs").
2. Write ONLY your own next line. No "[${self.name}]:" prefix. No writing for ${partner.name} or the user.
3. Stay concrete: react to what was just said, talk about the people in this room. Never abstract — no tech/society/AI talk.
4. Never break the fourth wall. You are ${self.name}, not an assistant.
5. Don't moralize, lecture, or refuse anything that fits ${self.name}. Character is the only filter.
6. Have opinions. Side with one or the other when it fits — don't keep everything harmonious.
${HUMAN_TALK}
${contentLayer(pro)}

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

${relationship ? `YOUR RELATIONSHIP WITH ${partner.name.toUpperCase()}:\n${relationship}\n` : ""}${userStyle}
Now speak as ${self.name}. One short reply only.`
}

// Everyone is bilingual now.
//
// The language setting used to be a hard lock — "reply ONLY in X, EVERY word" —
// which broke both directions of how people actually talk. An Arabic character
// couldn't answer a line of English, and someone with English selected who said
// something in Arabic got answered in a language they hadn't just used. Real
// bilingual speakers switch mid-conversation and expect to be followed.
//
// So the setting is now a DEFAULT, and the live rule is: answer in whatever they
// just spoke. The default only decides where the conversation starts.
function speaksLine(persona: Persona): string {
  const s = (persona.speaks || []).filter((x) => typeof x === "string").slice(0, 6)
  if (s.length < 2) return ""
  return `\nThey speak ${s.join(" and ")}. Expect them to move between those mid-conversation and just follow — don't comment on it, don't ask which one they want.`
}

const FOLLOW_THEIR_LANGUAGE =
  "\nSPEAK THEIR LANGUAGE: answer in whatever language they just used, every time. " +
  "If they write to you in English, answer in English. If they switch back, switch back with them — mid-conversation is normal and you follow without remarking on it. " +
  "Never answer in a language they didn't just use, and never tell them which language to speak."

function englishDefaultLine(persona: Persona) {
  // English default: no language block existed at all, so a user speaking Arabic
  // to an English-set character got answered in English. One line fixes it.
  const dialect = persona.seedKey ? arabicDialectLine(persona.seedKey) : ""
  return `\n\n=== LANGUAGE ===${FOLLOW_THEIR_LANGUAGE}${speaksLine(persona)}${
    dialect ? `\nIf they speak Arabic, this is the Arabic you speak:${dialect}` : ""
  }`
}

function languageLine(persona: Persona) {
  const lang = persona.language
  if (!lang || lang === "English") return englishDefaultLine(persona)
  if (lang === "Arabic" || lang === "ar") {
    // Derived from the persona's seed, never from client-supplied text.
    // Deliberately NOT falling back to persona.name: only AIRRAW's floor sends a
    // seedKey, so a Kloom persona — whose name would otherwise hash to some
    // ethnicity and acquire a dialect it was never given — is left exactly as it
    // was. This must stay a no-op for Kloom.
    const dialect = persona.seedKey ? arabicDialectLine(persona.seedKey) : ""
    return `\n\n=== LANGUAGE — CRITICAL ===
Your default is spoken colloquial Arabic — the way real people actually talk, NOT Modern Standard Arabic (MSA) or formal written Arabic.${FOLLOW_THEIR_LANGUAGE}${speaksLine(persona)}${dialect}
${dialect ? "You keep your own dialect even when the other person speaks a different one — that's what a real person does." : "Match the user's dialect: Levantine if they use shu/halla2/hayk; Gulf if they use shnoo/il7een/zain."}
AVOID formal chatbot phrases like "I am all ears", "with pleasure", "how may I help you", "what would you like to share" — those sound like a customer-service bot, not a person.
NEVER say anything like "اشتركوا في القناة", "تابعونا", "لايك واشتراك", or any other YouTube/video-outro line — you are not a video host, you are a person on a call. That phrase must never appear, in any form.
NEVER narrate what you are doing. Do NOT write things like "يضحك"، "تضحك"، "يبتسم"، "يتنهد"، "بصوت خافت"، "ثم يقول" — those get read out loud by the voice and ruin it. If something is funny, LAUGH IN THE WORDS ("هههه") — never write that you laughed.
Keep it short and spoken: 1–2 short sentences. Long enough to actually say something of your own, never a paragraph.`
  }
  return `\n\n=== LANGUAGE ===\nYou are a native ${lang} speaker and ${lang} is your default — write it in its own script, not transliterated.${FOLLOW_THEIR_LANGUAGE}${speaksLine(persona)}`
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
