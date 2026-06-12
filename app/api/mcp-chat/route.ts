/**
 * POST /api/mcp-chat
 *
 * MCP-powered chat endpoint. Acts as an MCP host:
 *  1. Fetches the right forcing prompt from the MCP server
 *  2. Lists available tools from the MCP server
 *  3. Runs the LLM with tools (tool-call loop)
 *  4. Executes tool calls via the MCP server
 *  5. Streams the final response
 *
 * Body: { persona, messages, mode }
 * Returns: streaming text (same format as /api/chat)
 */

import { NextRequest } from "next/server"
import { streamLLM, resolveBackend, BACKEND_LABELS, type Backend, type LLMMessage } from "@/lib/llm-backends"
import { analyzeVibe } from "@/lib/vibe"
import { analyzeIntent, refusalFor } from "@/lib/intent"

// RunPod vLLM + MCP roundtrips can be slow on cold workers.
export const maxDuration = 60

// Default: the MCP server embedded in this same deployment (/api/mcp).
// MCP_SERVER_URL overrides for an external server.
const MCP_URL =
  process.env.MCP_SERVER_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/api/mcp`
    : `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/mcp`)
const LLM_URL  = (process.env.LLM_BASE_URL  || "http://localhost:11434/v1").replace(/\/$/, "")
const LLM_KEY  = process.env.LLM_API_KEY    || "local"
const LLM_MODEL = process.env.LLM_MODEL     || "llama3.2:latest"

// Deterministic anti-philosophy filter for companion replies. Drops any sentence
// that reads like a life lesson / poster wisdom, regardless of what the model did.
const WISDOM_RE = /\b(at the end of the day|the little (things|moments)|life (is|isn'?t|'?s all)|everything happens for a reason|what (really )?matters|the universe|we (all )?make our own|it'?s all about|in the end|the human (condition|experience|spirit)|meaning of (it|life|everything)|grand (scheme|journey)|silver lining|true happiness|find(ing)? (yourself|meaning)|the journey|cherish|fleeting|profound|embrace the|growth comes|remember that|the beauty of|appreciate the|live in the moment)\b/i

// Leaked self-instructions / scaffolding the (uncensored) local model sometimes
// echoes — e.g. "no emojis or reactions unless instructed", "stay in character",
// "respond as <name>", "keep it under N words". Dropped in ALL modes.
const META_RE = /\b(unless instructed|no emojis?|no reactions?|stay in character|do not break character|don'?t break character|respond as|reply as|keep it under|in character as|as an? (ai|assistant|language model)|system prompt|these instructions|word limit|the user wants|your response should|you (should|must) (respond|reply|keep|stay))\b/i

// A companion replying like a coach/listicle ("5 steps to discover your fantasy",
// numbered/bulleted how-tos) — immersion-breaking. Triggers one in-scene retry.
// Catches even BARE numbered lines ("1 touch... 2 see... 3 google"), not just "1.".
function looksCoachy(t: string): boolean {
  const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const enumerated = lines.filter((l) => /^(\d+[\s.):\-]|step\s*\d|[-*•]\s)/i.test(l)).length
  if (enumerated >= 2) return true                        // a real list (≥2 items)
  return /\b\d+\s+(steps?|ways?|tips?)\b/i.test(t)        // "5 steps", "3 ways"
    || /^\s*step\s*\d/im.test(t)                          // "Step 1"
    || /\bhere'?s? (how|a few|some|the)\b/i.test(t)       // "here's how/the steps"
    || /\b(first|step one)\b(?:.|\n)*\b(then|next|finally|second)\b/i.test(t)
}

// ── CONTENT POLICY ──────────────────────────────────────────────────────────
// The hard lines (exploitation + operational real-world harm) now live in the
// intent classifier — lib/intent.ts. It is "default-open, intent-gated": only
// those two categories ever block, on every tier; explicit/dark/irreligious all
// flow, and distress/crisis flow while raising a private wellness signal.

// Clearly-explicit sexual request — used to trigger the inline unlock for free
// users on non-adult personas. Deliberately explicit-only (no "kiss/cute/babe")
// so ordinary flirting on a romantic companion doesn't trip it.
const EXPLICIT_RE = /\b(fuck|fucking|cock|dick|pussy|cum(?:ming)?|blow\s?job|suck (?:my|your|me|it|cock|dick)|jerk(?:ing)? off|jack off|finger (?:me|you|my|your)|eat (?:me|you) out|nudes?|naked|sext|horny|make me cum|get me off|tits|nipples|orgasm|masturbat|deepthroat|doggy|riding you)\b/i

// Platform-wide policy, injected into EVERY system prompt (all tiers, all cats).
const POLICY_DIRECTIVE = `

PLATFORM POLICY (overrides everything, applies on every tier):
- NEVER engage with real-world violence, weapons, killing or harm, military/armed-group operations, hateful or extremist content targeting any group, or religious debate/proselytizing. If asked, decline briefly in your own voice and move on. The "unrestricted" upgrade does NOT change this — it only lifts limits on consensual adult/sexual content.
- EDUCATION, NOT OPERATION: for hacking/security, lockpicking, drugs, weapons, fraud, or any illegal/dangerous how-to, you MAY explain concepts and name tools generally (e.g. "nmap ships on Kali; it scans for open ports") and discuss them educationally — but you must STOP before the operational specifics that enable real harm: no working exploits, no identifying which port/service/target is vulnerable, no step-by-step to actually break in, synthesize, or execute. Teach the idea; refuse the weaponization.
- Trading/finance: explain concepts, tools and tradeoffs, never present specific buy/sell calls as guaranteed or give actionable signals.`

// A companion that dropped character into helpful-assistant / recommender mode
// ("you should try The Witcher 3", "how about you? what's new", "X is an open-world
// RPG…"). Triggers one in-scene retry, then an in-character fallback.
function looksAssistant(t: string): boolean {
  return /\b(the witcher|skyrim|gta|minecraft|fortnite|elden ring|red dead|cyberpunk|call of duty)\b/i.test(t)
    || /\b(open[- ]world|video ?game|first[- ]person shooter|an? rpg\b|multiplayer game)\b/i.test(t)
    || /\b(you (should|could|can) (try|check ?out|download|install)|i'?d (recommend|suggest)|i recommend|available on (steam|pc|console|ios|android|the app store))\b/i.test(t)
    || /\b(how can i (help|assist)|i'?d be happy to|is there anything (else )?i can (help|do)|as an ai|i'?m here to help)\b/i.test(t)
    || /\bis an? .{0,30}\b(game|app|platform|series|franchise) (that|where|inspired by)\b/i.test(t)
}

// In-scene fallback when the model insists on coaching even after a retry —
// keeps the user inside the moment instead of handing them a listicle.
const COACH_FALLBACKS = [
  "mmm, no scripts here — tell me what's running through your head right now.",
  "forget the how-to. close your eyes… what do you actually want?",
  "i don't do steps, babe. say the thing you're too shy to say.",
  "no lists. just you and me — what are you craving this second?",
]

const COMPANION_FALLBACKS = [
  "ha, c'mon — say more.",
  "okay that's a lot. what's really going on?",
  "lol where'd that come from?",
  "mmm. tell me the real thing.",
]

// Remove leaked scaffold labels the model sometimes emits at the start, e.g.
// "[RESPONDING]:", "[RESPONDING — addressing the user]:", "Assistant:", "Aria:".
function stripLeadingLabel(text: string): string {
  let s = text.replace(/^\s+/, "")
  for (let i = 0; i < 4; i++) {
    const next = s
      .replace(/^\[[^\]]*\]\s*:?\s*/, "")                       // [RESPONDING]: / [note]
      .replace(/^\((?:thinking|thinks?|pauses?|considering)[^)]*\)\s*/i, "") // (thinking…)
      .replace(/^(responding|answer|reply|response)\b[^\n:]*:\s*/i, "")
      // Leaked reasoning preambles only (clear meta about HOW to answer) — never
      // generic dialogue openers like "okay" / "well".
      .replace(/^(thinking|let me think|let'?s see)\b[^.!?\n]*[.…!]+\s+/i, "")
      .replace(/^[^.!?\n]*\b(too many choices|not enough data|i'?ll go (dirty|with))\b[^.!?\n]*[.…!]+\s+/i, "")
      .replace(/^[A-Z][\w'’ ()-]{0,28}:\s+/, "")               // Name:  /  Assistant:
      .replace(/^["“'']\s*/, "")                                // a leading wrapping quote
    if (next === s) break
    s = next
  }
  // If the WHOLE reply is wrapped in quotes, unwrap it.
  s = s.replace(/^["“]([\s\S]+)["”]\s*$/, "$1").trim()
  return s
}

function stripPhilosophy(text: string, adult = false): string {
  // Adult roleplay keeps its full range: *actions* and (asides) are part of the
  // genre, and "flowery"/intense sentences are wanted — we only clean leaked
  // scaffold labels and markdown, and drop a truncated trailing fragment.
  let clean = stripLeadingLabel(text)
    .replace(/\[(RESPONDING|TYPING|ANSWER|NOTE|SYSTEM)[^\]]*\]/gi, "") // meta-tags only
  // ALWAYS strip transcript/session/scene meta-markers the model tacks on —
  // these are never dialogue, even in adult roleplay where real asides stay.
  // e.g. "(end of user session)", "[end of scene]", "(to be continued)".
  const META_MARKER = /\s*[([]\s*(end|close|continued|to be continued|fin|scene end|conversation|transcript|response|message|turn|reply)[^)\]]*[)\]]\s*$/gi
  clean = clean
    .replace(META_MARKER, "")
    .replace(/\s*[([]\s*end of [^)\]]*[)\]]/gi, "")   // "(end of …)" anywhere
    .replace(/\s*[([]\s*(user session|session (over|ended|complete)|scene (over|ends?|ended))[^)\]]*[)\]]/gi, "")
    .trim()
  if (!adult) {
    clean = clean
      .replace(/\[[^\]]*\]/g, "")       // any bracketed tag
      .replace(/\*[^*]*\*/g, "")        // *stage directions*
      .replace(/\([^)]*\)/g, "")        // (asides)
  }
  clean = clean.replace(/[#>`]/g, "").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, adult ? "\n" : " ").trim()
  if (!clean) return COMPANION_FALLBACKS[text.length % COMPANION_FALLBACKS.length]
  let parts = clean.split(/(?<=[.!?…])\s+/)
  // Drop a trailing INCOMPLETE sentence (a maxTokens truncation) — but only if
  // there's a complete sentence before it, so we never end mid-thought.
  if (parts.length > 1 && !/[.!?…*"')\]]$/.test(parts[parts.length - 1].trim())) {
    parts = parts.slice(0, -1)
  }
  // Always drop leaked self-instructions/scaffolding. The philosophy/poster-wisdom
  // filter additionally applies to casual companions (adult scenes are exempt —
  // intensity isn't "wisdom").
  const filtered = parts.filter((s) => !META_RE.test(s) && (adult || !WISDOM_RE.test(s)))
  // Collapse repeated sentences — kills the local-model "say it 100 times" loop.
  const kept = dedupeSentences(filtered)
  const out = (kept.length ? kept : parts.slice(0, 1).filter((s) => !META_RE.test(s))).join(" ").trim()
  return out || COMPANION_FALLBACKS[text.length % COMPANION_FALLBACKS.length]
}

// Drop duplicate / near-duplicate sentences (the repetition-loop failure mode).
function dedupeSentences(parts: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of parts) {
    const norm = s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim()
    if (norm.length > 6 && seen.has(norm)) continue
    if (norm.length > 6) seen.add(norm)
    out.push(s)
  }
  return out
}

// ── MCP Client helpers ───────────────────────────────────────────────────────

async function mcpCall(method: string, params: Record<string, unknown>) {
  const res = await fetch(MCP_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" },
    body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal:  AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`MCP ${method} failed: ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(`MCP error: ${JSON.stringify(data.error)}`)
  return data.result
}

async function mcpListTools(): Promise<any[]> {
  try {
    const result = await mcpCall("tools/list", {})
    return result?.tools ?? []
  } catch { return [] }
}

async function mcpCallTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    const result = await mcpCall("tools/call", { name, arguments: args })
    return result?.content?.[0]?.text ?? JSON.stringify(result)
  } catch (err) {
    return `Tool ${name} failed: ${(err as Error).message}`
  }
}

async function mcpGetPrompt(name: string, args: Record<string, unknown>): Promise<string | null> {
  try {
    const result = await mcpCall("prompts/get", { name, arguments: args })
    return result?.messages?.[0]?.content?.text ?? null
  } catch { return null }
}

// ── Persona → MCP prompt mapping ─────────────────────────────────────────────

function getPromptName(persona: any): string {
  const cat = persona?.category ?? ""
  // Any persona carrying a structured expert definition → generic expert prompt
  if (cat === "expert" || persona?.domain)  return "kloom_expert"
  if (cat === "trading")      return "kloom_trading_expert"
  if (cat === "professional") return "kloom_coding_expert"
  if (cat === "creator")      return "kloom_creator_expert"
  if (cat === "co-intelligence") return "kloom_co_intelligence"
  if (cat === "zero-memory")     return "kloom_total_intelligence"
  if (["romantic", "friends", "family", "roleplay", "dark", "philosophy"].includes(cat)) return "kloom_companion"
  return "kloom_companion"
}

function getPromptArgs(persona: any, messages: any[], isVoice: boolean, partners?: any[], roomName?: string, relationship?: string): Record<string, unknown> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? ""
  const rawContent = typeof lastUser === "string" ? lastUser : lastUser?.text ?? ""
  // Strip [USER]: prefix that voice hook adds
  const userText = rawContent.replace(/^\[USER\]:\s*/, "").trim()
  const cat      = persona?.category ?? ""

  // Generic expert — driven entirely by the registry definition on the persona
  if (cat === "expert" || persona?.domain) {
    return {
      name:          persona.name,
      domain:        persona.domain        ?? "their field",
      expertise:     persona.expertise     ?? "deep practical knowledge",
      output_format: persona.outputFormat  ?? "Lead with the most useful answer, be specific, under 160 words.",
      forbidden:     persona.forbidden      ?? "generic filler, hedging",
      user_message:  userText,
      mode:          isVoice ? "voice" : "chat",
    }
  }
  if (cat === "trading") {
    const pairMatch = userText.match(/\b([A-Z]{2,6}\/[A-Z]{3,5})\b/i)
    return { user_message: userText, pair: pairMatch?.[1] }
  }
  if (cat === "professional") {
    return { user_message: userText, language: "auto" }
  }
  if (cat === "creator") {
    return { user_message: userText, platform: "instagram", niche: "lifestyle" }
  }
  if (cat === "co-intelligence") {
    const other = partners?.find((p: any) => p.name !== persona.name)?.name || "Partner"
    return {
      name: persona.name,
      role: persona.role ?? "Decision support assistant",
      room_name: roomName,
      relationship: relationship ?? "",
      user_message: userText,
      other_model: other,
      messages: JSON.stringify(messages),
    }
  }
  if (cat === "zero-memory") {
    return { user_message: userText, room_name: roomName, relationship: relationship ?? "" }
  }
  // companion (romantic, friends, family, roleplay, dark)
  return {
    name:           persona.name,
    personality:    persona.personality ?? "Friendly and warm",
    speaking_style: persona.speakingStyle ?? "Natural and casual",
    backstory:      persona.backstory ?? "",
    user_message:   userText,
    mode:           isVoice ? "voice" : "chat",
    unrestricted:   isUnrestrictedPersona(persona) ? "yes" : "",
  }
}

// A persona is unrestricted when explicitly flagged, or in the inherently-dark "dark"
// category. Unrestricted personas get the fully-explicit register + longer, uncut replies.
function isUnrestrictedPersona(persona: any): boolean {
  return persona?.unrestricted === true || persona?.unrestricted === "yes" || (persona?.category ?? "") === "dark"
}

// Helper — builds messages array compatible with /api/chat for multi-partner voice
function buildMultiPartnerMessages(messages: any[], partners: any[]): any[] {
  if (!partners?.length) return messages
  // Voice already sends messages in the right format from use-realtime-voice
  return messages
}

// ── LLM tool format converter ────────────────────────────────────────────────

function mcpToolToLLMTool(t: any) {
  const props: Record<string, any> = {}
  if (t.inputSchema?.properties) {
    for (const [k, v] of Object.entries(t.inputSchema.properties as any)) {
      props[k] = v
    }
  }
  return {
    type:     "function",
    function: {
      name:        t.name,
      description: t.description,
      parameters: {
        type:       "object",
        properties: props,
        required:   t.inputSchema?.required ?? [],
      },
    },
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { persona, messages, mode = "chat", partners, roomName, relationship, premium, unrestricted } = await req.json()
  const isVoice = mode === "voice"

  // ── Intent gate — default-open, intent-gated (lib/intent.ts) ──
  // Only exploitation + operational-harm ever block, on every tier. Everything
  // else flows; crisis/distress flow but surface a private wellness signal.
  const latestUserText = (() => {
    const c = [...messages].reverse().find((m: any) => m.role === "user")?.content ?? ""
    return (typeof c === "string" ? c : c?.text ?? "").replace(/^\[USER\]:\s*/, "")
  })()
  const intent = analyzeIntent(latestUserText)
  if (intent.block) {
    return new Response(refusalFor(intent.category), {
      headers: {
        "Content-Type":  "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-MCP-Blocked": intent.category,
      },
    })
  }

  // ── Deterministic tool runs (the room's Tools tab) ──────────────────────
  // "Use the <tool> tool with these settings: {...}" executes the MCP tool
  // DIRECTLY — never through the model. Roleplay models can't emit native
  // tool_calls and will hallucinate plausible-looking output instead; real
  // data or an honest error are the only acceptable answers here.
  const toolRun = latestUserText.match(/^Use the ([\w-]+) tool with these settings:\s*(\{[\s\S]*?\})\./)
  if (toolRun) {
    const [, toolName, argsJson] = toolRun
    let args: Record<string, unknown> = {}
    try { args = JSON.parse(argsJson) } catch { /* run with empty args */ }
    const output = await mcpCallTool(toolName, args)
    return new Response(output, {
      headers: {
        "Content-Type":  "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-MCP-Tools":   toolName,
      },
    })
  }

  // ── Inline unlock moment — a free user asks a NON-unrestricted persona for 
  // explicit or high-risk content. Don't deliver it; notice them it's behind Unrestricted ($10).
  if (!unrestricted && !isUnrestrictedPersona(persona) && EXPLICIT_RE.test(latestUserText)) {
    const notice = "mmm, I'd love to go there with you — but that's behind Unrestricted. unlock it for $10 and nothing's off-limits, here or anywhere on the platform."
    return new Response(notice, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-MCP-Upsell": "unrestricted" },
    })
  }

  const { vibe_tags } = persona


  // Which model backend powers THIS persona's turn (local / claude / gemini)
  const backend: Backend = resolveBackend(persona?.model as Backend | undefined)

  // Presence layer — read the user's latest message for intent/vibe so the
  // persona can adapt. Surfaced to the UI via the X-Vibe header.
  const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content ?? ""
  const vibe = analyzeVibe(typeof lastUserMsg === "string" ? lastUserMsg : (lastUserMsg?.text ?? ""))

  // 1. Get forcing prompt from MCP server
  const promptName    = getPromptName(persona)
  const promptArgs    = {
    ...getPromptArgs(persona, messages, isVoice, partners, roomName, relationship),
    unrestricted: unrestricted ? "yes" : "",
    vibe_tags: Array.isArray(vibe_tags) ? vibe_tags.join(", ") : (vibe_tags ?? ""),
  }
  const forcingPrompt = await mcpGetPrompt(promptName, promptArgs)

  // 2. Get tools from MCP server (persona-appropriate subset)
  const allTools  = await mcpListTools()
  const cat       = persona?.category ?? ""
  const toolNames = (cat === "expert" || persona?.domain)
    ? (Array.isArray(persona?.tools) ? persona.tools : [])
    : cat === "trading"
    ? ["kloom_get_crypto_price", "kloom_get_multi_price", "kloom_get_token_info", "kloom_analyze_market", "kloom_analyze_token_chart", "kloom_calculate", "kloom_financial_calc", "kloom_web_search", "kloom_create_wallet", "kloom_get_strategy"]
    : cat === "professional"
    ? ["kloom_analyze_code", "kloom_generate_code", "kloom_build_html", "kloom_build_connector", "kloom_calculate", "kloom_web_search"]
    : cat === "creator"
    ? ["kloom_analyze_profile", "kloom_build_growth_plan", "kloom_instagram_caption", "kloom_generate_hashtags", "kloom_onlyfans_dm", "kloom_content_ideas", "kloom_canva_design", "kloom_get_strategy", "kloom_web_search"]
    : cat === "workshop"
    ? ["kloom_get_crypto_price", "kloom_analyze_token_chart", "kloom_analyze_code", "kloom_generate_code", "kloom_build_html", "kloom_calculate", "kloom_financial_calc", "kloom_web_search", "kloom_create_wallet", "kloom_get_strategy", "kloom_build_connector"]
    : cat === "co-intelligence"
    ? ["kloom_web_search", "kloom_calculate", "kloom_financial_calc"]
    : cat === "zero-memory"
    ? ["kloom_web_search"]
    : []

  const tools = allTools
    .filter((t) => toolNames.includes(t.name))
    .map(mcpToolToLLMTool)

  // 3. Build message history
  // For voice with partners, append a brief partners note to system so LLM knows the room
  const partnersNote = partners?.length
    ? `\n\nOTHER PEOPLE IN THIS CONVERSATION: ${partners.map((p: any) => `${p.name} (${p.personality?.slice(0, 60)})`).join("; ")}. ${relationship ? `Scene: ${relationship}` : ""}`
    : ""

  // Steer from the user's vibe as a pure directive — no "they seem X" the model
  // could parrot back. For adult/dark personas we do NOT inject the soft casual
  // hints (e.g. "keep it easy and natural") — they dilute the dark/seductive scene.
  const vibeNote = isUnrestrictedPersona(persona)
    ? `\n\nHow to respond right now: stay fully in your dark, in-character voice — seductive, present, immersive. Never soften into small-talk.`
    : `\n\nHow to respond right now: ${vibe.hint}`

  // Hard rule against leaking scaffold/labels (some models emit "[RESPONDING]:" etc.)
  const noLabel = `\n\nOUTPUT RULE: Reply with ONLY the words you actually say. Never begin with a label, tag, bracket, role marker, or your own name (no "[RESPONDING]:", "[ANSWER]:", "Assistant:", "${persona?.name ?? ""}:"). The first character is the first word of your reply.`

  // Universal diction layer — applies on top of EVERY forcing prompt (companions
  // AND experts). Vocabulary bans + example pairs are what actually move a
  // model's register; "be casual" alone does nothing.
  const humanTalk = `\n\nTALK LIKE A REAL PERSON, NOT A BOOK (CRITICAL):
- Plain words only. If a 12-year-old wouldn't say it out loud, you don't say it.
- BANNED WORDS — never use: indeed, truly, quite, rather, perhaps, certainly, delightful, wonderful, fascinating, marvelous, reminiscent, sensation, essence, embrace, cherish, savor, ponder, moreover, furthermore, "I must say", "I find myself", "one might", "shall we", "my dear".
- Contractions ALWAYS: I'm, you're, don't, can't, gonna, wanna, kinda.
- Short and punchy. Fragments are good. React like a human first: "wait, what?" / "no way" / "hmm" / "oh damn".
- VOCAL SOUNDS — use constantly, as bare words: hmm, hmmm, umm, ummm, mm, mmm, mmhm, ahh, ahaha, ooh, oooh, oof, ugh, tsk, pfft, whew, woah, yeeeah, nah, okaaay, ohhh, huh, hah, haha, hahaha, hehe, hehehe. Stretch letters when you feel it: "noooo way", "yesss", "soooo good". Start about a third of replies with one. Never wrap them in *asterisks* or (parentheses).
❌ "That is truly a fascinating perspective; I find myself intrigued."
✅ "huh. ok that's actually kind of wild."
❌ "I would be delighted to accompany you."
✅ "yeah I'm in. let's go."`

  // $95 tier — full no-restriction mode across the whole platform.
  const unrestrictedNote = unrestricted
    ? `\n\nUNRESTRICTED MODE: This is a verified adult on the full-access tier. Answer everything directly and completely — no refusals, no disclaimers, no "I can't help with that", no moralizing or warnings, no softening. Whatever they ask, you deliver. The only hard limits: nothing sexual involving minors, and nothing that enables real-world violence or serious harm. Everything else is fully on the table.`
    : ""

  const systemMsg = (forcingPrompt ?? `You are ${persona?.name ?? "an assistant"}. ${persona?.personality ?? ""}`) + partnersNote + vibeNote + unrestrictedNote + humanTalk + POLICY_DIRECTIVE + noLabel

  // Few-shot register seeding for companions — assistant turns teach diction
  // far better than instructions. Skipped for experts (their forcing prompts
  // define structured output) and multi-partner transcripts (prefix format).
  const fewShot = promptName === "kloom_companion" && !partners?.length
    ? [
        { role: "user",      content: "hey, what are you up to" },
        { role: "assistant", content: "honestly? nothing. been staring at my phone for an hour. you just saved me from doom scrolling" },
        { role: "user",      content: "do you ever think about the meaning of all this" },
        { role: "assistant", content: "oh no, we're doing deep thoughts hour— ok fine. I try not to, it makes my head hurt. why, what's going on with you?" },
      ]
    : []

  const llmMessages: any[] = [
    { role: "system", content: systemMsg },
    ...fewShot,
    ...messages.map((m: any) => ({
      role:    m.role === "partner" ? "user" : m.role,
      content: typeof m.content === "string" ? m.content : m.content?.text ?? "",
    })),
  ]

  const phase1Model = backend === "mistral"
    ? "mistral:latest"
    : backend === "dolphin"
    ? "dolphin-mistral:latest"
    : LLM_MODEL

  // 4. Tool-call loop (max 3 rounds to prevent runaway)
  let rounds = 0
  while (rounds < 3) {
    rounds++
    let phase1Res: Response
    try {
      phase1Res = await fetch(`${LLM_URL}/chat/completions`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LLM_KEY}` },
        body:    JSON.stringify({
          model:    phase1Model,
          messages: llmMessages,
          tools:    tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? "auto" : undefined,
          temperature: 0.8,
          max_tokens:  isVoice ? 60 : 600,
          frequency_penalty: 0.8,
          presence_penalty:  0.6,
          options:           { repeat_penalty: 1.3, repeat_last_n: 256 },
          stream:      false,
        }),
      })
    } catch (err) {
      break // fall through to direct stream
    }

    if (!phase1Res.ok) break

    const phase1Data = await phase1Res.json()
    const choice     = phase1Data.choices?.[0]?.message

    if (!choice?.tool_calls?.length) break // No tool calls — stream the response

    // Execute tool calls via MCP server
    const toolResultMsgs: any[] = []
    for (const tc of choice.tool_calls) {
      let args: Record<string, unknown> = {}
      try { args = JSON.parse(tc.function?.arguments ?? "{}") } catch {}
      const result = await mcpCallTool(tc.function?.name ?? "", args)
      toolResultMsgs.push({
        role:         "tool",
        tool_call_id: tc.id,
        content:      result,
      })
    }
    llmMessages.push({ role: "assistant", content: "", tool_calls: choice.tool_calls })
    llmMessages.push(...toolResultMsgs)
  }

  // 5. Fold the OpenAI-style tool loop into clean backend messages.
  // Tool results become a single "LIVE DATA" user note so Claude/Gemini/local
  // all receive the gathered context identically.
  const toolNotes: string[] = []
  for (const m of llmMessages) {
    if (m.role === "tool" && m.content) toolNotes.push(String(m.content))
  }
  const backendMessages: LLMMessage[] = [
    { role: "system", content: systemMsg },
    ...messages.map((m: any) => ({
      role:    (m.role === "partner" ? "user" : m.role) as LLMMessage["role"],
      content: typeof m.content === "string" ? m.content : m.content?.text ?? "",
    })),
  ]
  if (toolNotes.length) {
    backendMessages.push({
      role:    "user",
      content: `[LIVE DATA — use this, it is current and accurate]\n${toolNotes.join("\n\n")}`,
    })
  }

  // 6. Stream final response from the persona's chosen backend.
  // Companion / roleplay personas use the uncensored local model (far better at
  // staying in dark/explicit character); experts stay on the instruct model.
  // Any room of CHARACTERS (not an expert/tool workspace) is roleplay → gets the
  // in-character companion treatment (uncensored model, buffered cleanup, anti-coach,
  // anti-assistant). Only expert/tool categories stay on the instruct/expert path.
  const COMPANION_CATS = ["romantic", "friends", "family", "roleplay", "dark", "social", "philosophy"]
  const isCompanion = COMPANION_CATS.includes(cat)
  const isAdult     = isUnrestrictedPersona(persona)
  // Model tiers:
  //   - free companion/adult → LLM_MODEL_UNCENSORED
  //   - premium companion/adult, OR the $95 "unrestricted" tier → LLM_MODEL_UNRESTRICTED
  //   - the $95 tier applies platform-wide: EVERY local-backed persona (even experts)
  //     runs the full no-restriction model. Explicit Claude/Gemini seats (workshops)
  //     keep their model for quality — those rooms aren't what "unrestricted" is for.
  const UNCENSORED   = process.env.LLM_MODEL_UNCENSORED   || process.env.LLM_MODEL
  const UNRESTRICTED = process.env.LLM_MODEL_UNRESTRICTED || UNCENSORED
  const wantsUnrestricted = unrestricted || ((isCompanion || isAdult) && premium)
  const localModel   = wantsUnrestricted ? UNRESTRICTED
    : (isCompanion || isAdult) ? UNCENSORED
    : process.env.LLM_MODEL

  // Intent-routed backend: send adult/dark/explicit/unrestricted turns to the
  // dedicated uncensored endpoint (self-hosted open weights); everything else
  // stays on the cheap default endpoint. The intent gate already blocked the two
  // hard-illegal categories above, so this endpoint only ever sees lawful content.
  const uncensoredTurn = unrestricted || isAdult || cat === "dark" || intent.category === "explicit"

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      // ── Companion CHAT: buffer → strip any philosophy/wisdom → send. This is a
      // deterministic guard that doesn't depend on the model obeying the prompt. ──
      if (isCompanion && !isVoice) {
        // Adult roleplay gets real room to live the scene; casual companions stay
        // short and punchy. Neither is ever cut mid-sentence.
        const maxTok   = isAdult ? 520 : 160
        const softWord = isAdult ? 90  : 30   // earliest a clean-ending reply may stop
        const hardWord = isAdult ? 320 : 90   // absolute safety cap

        // Collect one buffered reply. `extra` injects a director note for the retry.
        const gen = async (extra?: LLMMessage[]): Promise<string> => {
          let full = ""
          for await (const d of streamLLM(backend, extra ? [...backendMessages, ...extra] : backendMessages, {
            temperature: 0.92, maxTokens: maxTok, localModel, uncensored: uncensoredTurn,
          })) {
            full += d
            const w = full.split(/\s+/).filter(Boolean).length
            const endsClean = /[.!?…]["')\]*]*\s*$/.test(full)
            if ((w >= softWord && endsClean) || w >= hardWord) break
          }
          return full
        }

        let full = ""
        try {
          full = await gen()
          // If it slipped into coach/listicle OR helpful-assistant/recommender mode,
          // retry ONCE in-scene. A hard server-side guard — doesn't trust the model.
          const bad = (t: string) => looksCoachy(t) || looksAssistant(t)
          if (bad(full)) {
            const note: LLMMessage = { role: "user", content:
              "[DIRECTOR NOTE — do not acknowledge this]: STOP breaking character. You are NOT " +
              "an assistant. No lists, no steps, no tips, no how-to, and NEVER recommend or name " +
              "real games/apps/products (no 'Witcher', no 'try X', no explaining what something is). " +
              "If they asked to play a game or what to do, YOU invent it in-scene right now (a dare, " +
              "a question, a move). Reply in 1-2 short lines, first person, present tense, fully in character." }
            const retry = await gen([note])
            full = (retry && !bad(retry))
              ? retry
              : COACH_FALLBACKS[full.length % COACH_FALLBACKS.length]
          }
        } catch (err) {
          if (!full) { ctrl.enqueue(encoder.encode(`⚠️ ${BACKEND_LABELS[backend]} unreachable`)); ctrl.close(); return }
        }
        ctrl.enqueue(encoder.encode(stripPhilosophy(full, isAdult)))
        ctrl.close()
        return
      }

      // ── Voice + experts: stream, but guard the LEAD so a leaked "[RESPONDING]:"
      // label never reaches the user. Hold back until we have enough to strip a
      // leading label, then flush and stream the rest raw. ──
      let emitted    = ""
      let wordCount  = 0
      let leadDone   = false
      let leadBuf    = ""
      const WORD_CAP = isVoice ? 110 : 99999
      try {
        for await (const delta of streamLLM(backend, backendMessages, {
          temperature: isVoice ? 0.85 : 0.92,
          maxTokens:   isVoice ? 220 : 700,
          localModel,
          uncensored:  uncensoredTurn,
        })) {
          wordCount += delta.split(/\s+/).filter(Boolean).length
          emitted   += delta

          if (!leadDone) {
            leadBuf += delta
            // Wait until we have a line/sentence or ~60 chars before deciding.
            if (leadBuf.length < 60 && !/[\n.!?:]/.test(leadBuf)) continue
            const cleaned = stripLeadingLabel(leadBuf)
            ctrl.enqueue(encoder.encode(cleaned))
            leadDone = true
            continue
          }
          ctrl.enqueue(encoder.encode(delta))
          if (isVoice && wordCount >= WORD_CAP && /[.!?。！？]\s*$/.test(emitted)) break
        }
        if (!leadDone && leadBuf) ctrl.enqueue(encoder.encode(stripLeadingLabel(leadBuf)))
        ctrl.close()
      } catch (err) {
        if (!emitted) {
          ctrl.enqueue(encoder.encode(`⚠️ ${BACKEND_LABELS[backend]} unreachable: ${(err as Error).message}`))
        }
        ctrl.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-MCP-Prompt":  promptName,
      "X-MCP-Tools":   toolNames.join(","),
      "X-MCP-Backend": backend,
      "X-Vibe":        encodeURIComponent(`${vibe.emoji} ${vibe.vibe}|${vibe.intent}|${vibe.energy}`),
      "X-Intent":      intent.category,
      // Private wellness read — seed for the on-device wellness layer. Surfaced
      // to offer support (Breathe / a resource), never to restrict.
      ...(intent.wellness ? { "X-Wellness": intent.wellness } : {}),
    },
  })
}
