/**
 * Multi-model LLM router.
 *
 * Lets a single room run different "seats" on genuinely different models:
 *   - local  → Ollama / any OpenAI-compatible endpoint
 *   - claude → Anthropic Messages API
 *   - gemini → Google Generative AI API
 *
 * Every backend is normalized to an async generator of text deltas, so the
 * caller streams output identically regardless of which model produced it.
 *
 * If a backend's API key is missing, it transparently falls back to local —
 * the app keeps working even before the user adds Claude/Gemini keys.
 */

import { premiumModelsEnabled } from "./variant"

export type Backend = "local" | "claude" | "gemini" | "openai" | "xai" | "mistral" | "dolphin"

/** Premium hosted seats — collapse to local on the serverless-only .fun variant. */
const PREMIUM: Backend[] = ["claude", "gemini", "openai"]

export interface LLMMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface LLMOptions {
  temperature?: number
  maxTokens?: number
  localModel?: string        // override the local model (e.g. uncensored for roleplay)
  frequencyPenalty?: number  // anti-repetition (defaults applied per-backend)
  presencePenalty?: number
  /** Route this turn to the self-hosted UNCENSORED endpoint (adult/dark/explicit/
   *  unrestricted). Falls back to the default endpoint if none is configured. */
  uncensored?: boolean
}

// ── Config ────────────────────────────────────────────────────────────────

const LOCAL_URL   = (process.env.LLM_BASE_URL || "http://localhost:11434/v1").replace(/\/$/, "")
// When the LLM endpoint is Together, use the shared TOGETHER_API_KEY (the same key
// images use) so a rotated Together key never leaves chat on a stale LLM_API_KEY —
// which is exactly what broke the call ("couldn't reach the voice" = chat 401).
const LOCAL_KEY   = (/together\.(xyz|ai)/.test(LOCAL_URL) && process.env.TOGETHER_API_KEY)
  ? process.env.TOGETHER_API_KEY
  : (process.env.LLM_API_KEY || "local")
const LOCAL_MODEL = process.env.LLM_MODEL     || "llama3.2:latest"
const LOCAL_FALLBACK_MODEL = process.env.LLM_FALLBACK_MODEL || "llama3.2:latest"

// Dedicated UNCENSORED endpoint — a self-hosted open-weights model (Qwen/etc.
// via Ollama/vLLM on a GPU, or a serverless GPU that scales to zero). Used ONLY
// for adult/dark/explicit/unrestricted turns so the cheap cloud handles the rest.
// If UNCENSORED_LLM_BASE_URL is unset, everything uses the default endpoint above.
const UNCENSORED_URL   = (process.env.UNCENSORED_LLM_BASE_URL || LOCAL_URL).replace(/\/$/, "")
const UNCENSORED_KEY   = process.env.UNCENSORED_LLM_API_KEY || LOCAL_KEY
const UNCENSORED_MODEL = process.env.UNCENSORED_LLM_MODEL
  || process.env.LLM_MODEL_UNRESTRICTED || process.env.LLM_MODEL_UNCENSORED || LOCAL_MODEL
const HAS_UNCENSORED   = !!process.env.UNCENSORED_LLM_BASE_URL

// Endpoints that recently hung (accepted the connection but never sent headers),
// mapped to the epoch-ms until which they're considered dead. Module-scoped —
// survives across requests within a warm serverless instance.
const deadEndpoints = new Map<string, number>()

const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY || ""
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-5"

const GEMINI_KEY   = process.env.GEMINI_API_KEY || ""
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash"

const OPENAI_KEY   = process.env.OPENAI_API_KEY || ""
const OPENAI_URL   = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o"

// xAI (Grok) — OpenAI-compatible, and far more permissive than Claude/Gemini,
// so it fits the adult floor. Set XAI_API_KEY to make it the voice model.
const XAI_KEY   = process.env.XAI_API_KEY || ""
const XAI_URL   = (process.env.XAI_BASE_URL || "https://api.x.ai/v1").replace(/\/$/, "")
const XAI_MODEL = process.env.XAI_MODEL || "grok-4-fast-non-reasoning"

export function backendAvailable(b: Backend): boolean {
  if (b === "claude") return !!CLAUDE_KEY
  if (b === "gemini") return !!GEMINI_KEY
  if (b === "openai") return !!OPENAI_KEY
  if (b === "xai")    return !!XAI_KEY
  return true // local always available
}

/**
 * Resolve the requested backend. Each seat runs its OWN API when its key is
 * present; when it isn't, the seat falls back to Gemini (the house model) so the
 * room still answers — on .io that means a Claude/GPT seat with no key quietly
 * runs Gemini instead of dead-ending. On .fun (serverless open weights, no
 * premium keys) it falls back to local instead.
 */
export function resolveBackend(requested?: Backend): Backend {
  if (!requested || requested === "local") return "local"
  // .fun normally runs serverless open weights only, but we allow Claude explicitly
  // for voice calls when the key is present — conversation quality IS the product.
  if (!premiumModelsEnabled() && PREMIUM.includes(requested)) {
    if (requested === "claude" && CLAUDE_KEY) return "claude"
    return "local"
  }
  if (requested === "mistral" || requested === "dolphin") return requested
  if (backendAvailable(requested)) return requested
  // No key for this premium seat → house model: Gemini if we have it, else local.
  return GEMINI_KEY ? "gemini" : "local"
}

// ── Local (Ollama / OpenAI-compatible) ──────────────────────────────────────

async function* streamLocal(messages: LLMMessage[], opts: LLMOptions): AsyncGenerator<string> {
  // Adult/unrestricted turns go to the dedicated uncensored endpoint when one is
  // configured; everything else (and the fallback) uses the default endpoint.
  const useUnc  = !!opts.uncensored && HAS_UNCENSORED
  const baseUrl = useUnc ? UNCENSORED_URL : LOCAL_URL
  const baseKey = useUnc ? UNCENSORED_KEY : LOCAL_KEY
  const defModel = useUnc ? UNCENSORED_MODEL : LOCAL_MODEL
  const model = opts.localModel || defModel
  const fallbackModel = opts.localModel && opts.localModel !== defModel ? defModel : undefined
  // Anti-repeat params differ by endpoint:
  //  • Gemini's OpenAI-compat endpoint rejects ALL penalty params (400) → send none.
  //  • Ollama / self-hosted takes the full set incl. its repeat_penalty/options extras.
  //  • Hosted OpenAI-compat (Together, OpenAI, …) takes the STANDARD penalties only;
  //    repeat_penalty/options are Ollama-only fields a strict provider can 400 on.
  const isGeminiCompat = baseUrl.includes("generativelanguage.googleapis.com")
  const isOllama = /localhost|127\.0\.0\.1|:11434/.test(baseUrl)
  const antiRepeat = isGeminiCompat
    ? {}
    : isOllama
      ? {
          frequency_penalty: opts.frequencyPenalty ?? 0.8,
          presence_penalty:  opts.presencePenalty  ?? 0.6,
          repeat_penalty:    1.3,
          options:           { repeat_penalty: 1.3, repeat_last_n: 256 },
        }
      : {
          frequency_penalty: opts.frequencyPenalty ?? 0.8,
          presence_penalty:  opts.presencePenalty  ?? 0.6,
        }
  // Reasoning models (MiniMax-M3, DeepSeek-R1, QwQ…) spend tokens "thinking"
  // BEFORE the answer; a low max_tokens gets entirely eaten by reasoning and
  // returns EMPTY content (blank voice replies). Give them headroom so the real
  // reply still lands. Only `content` deltas are streamed below, so the
  // chain-of-thought never reaches the user.
  const reasoningHeadroom = /minimax-?m3|deepseek-?r1|\bqwq\b/i.test(model) ? 384 : 0
  const maxTokens = (opts.maxTokens ?? 600) + reasoningHeadroom

  // Circuit breaker: a dead-but-accepting endpoint (e.g. a stopped RunPod proxy)
  // hangs fetch forever — without this EVERY request burns the full serverless
  // budget and 504s. The first hang marks the endpoint dead for 2 min; subsequent
  // requests skip straight to the fallback chain (Gemini/GPT) instantly.
  if (Date.now() < (deadEndpoints.get(baseUrl) ?? 0)) {
    if (useUnc) return yield* streamLocal(messages, { ...opts, uncensored: false, localModel: undefined })
    throw new Error(`local LLM endpoint circuit-open: ${baseUrl}`)
  }

  let res: Response
  // Headers-only timeout: abort if the endpoint doesn't ANSWER within 12s; the
  // timer is cleared once headers arrive so long generations stream unbounded.
  const hdrCtrl = new AbortController()
  const hdrTimer = setTimeout(() => hdrCtrl.abort(), 12_000)
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${baseKey}` },
      body:    JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.9,
        max_tokens:  maxTokens,
        ...antiRepeat,
        stream:      true,
      }),
      signal: hdrCtrl.signal,
    })
  } catch (err) {
    // Endpoint unreachable, or hung past the headers timeout (e.g. a STOPPED
    // dedicated endpoint). Mark it dead and degrade to the fallback chain.
    if (hdrCtrl.signal.aborted) deadEndpoints.set(baseUrl, Date.now() + 120_000)
    if (useUnc) return yield* streamLocal(messages, { ...opts, uncensored: false, localModel: undefined })
    throw err
  } finally {
    clearTimeout(hdrTimer)
  }
  if ((!res.ok || !res.body) && fallbackModel && (res.status === 404 || res.status === 400)) {
    return yield* streamLocal(messages, { ...opts, localModel: fallbackModel })
  }
  if (!res.ok || !res.body) {
    // If an explicitly requested model is unavailable, try this endpoint's
    // default model, then the global fallback, before failing.
    if (model !== defModel && defModel !== fallbackModel) {
      return yield* streamLocal(messages, { ...opts, localModel: defModel })
    }
    if (model !== LOCAL_FALLBACK_MODEL && LOCAL_FALLBACK_MODEL !== defModel) {
      return yield* streamLocal(messages, { ...opts, localModel: LOCAL_FALLBACK_MODEL })
    }
    // Last resort: a stopped/erroring uncensored endpoint (e.g. the dedicated M3
    // box scaled down) degrades to the default serverless endpoint, so the
    // unrestricted tier keeps answering instead of dead-ending.
    if (useUnc) return yield* streamLocal(messages, { ...opts, uncensored: false, localModel: undefined })
    throw new Error(`local LLM ${res.status}`)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line.startsWith("data:")) continue
      const data = line.slice(5).trim()
      if (data === "[DONE]") return
      try {
        const json  = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch {}
    }
  }
}

// ── OpenAI / GPT (Chat Completions API) ─────────────────────────────────────

async function* streamOpenAI(messages: LLMMessage[], opts: LLMOptions): AsyncGenerator<string> {
  const res = await fetch(`${OPENAI_URL}/chat/completions`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_KEY}` },
    body:    JSON.stringify({
      model:       OPENAI_MODEL,
      messages,
      temperature: opts.temperature ?? 0.9,
      max_tokens:  opts.maxTokens   ?? 700,
      frequency_penalty: opts.frequencyPenalty ?? 0.4,
      presence_penalty:  opts.presencePenalty  ?? 0.3,
      stream:      true,
    }),
  })
  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => "")
    throw new Error(`openai ${res.status}: ${err.slice(0, 120)}`)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line.startsWith("data:")) continue
      const data = line.slice(5).trim()
      if (data === "[DONE]") return
      try {
        const json  = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch {}
    }
  }
}

// ── xAI / Grok (OpenAI-compatible Chat Completions) ─────────────────────────
async function* streamXai(messages: LLMMessage[], opts: LLMOptions): AsyncGenerator<string> {
  const res = await fetch(`${XAI_URL}/chat/completions`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${XAI_KEY}` },
    body:    JSON.stringify({
      model:       XAI_MODEL,
      messages,
      temperature: opts.temperature ?? 0.9,
      max_tokens:  opts.maxTokens   ?? 700,
      // NO penalty params: the grok-4 family REJECTS presence/frequency penalty with
      // 400 "does not support parameter presencePenalty" — sending them 400'd every
      // production call, and with the older house keys dead, chat went fully mute.
      stream:      true,
    }),
    // Bound it so a hung endpoint fails over instead of stalling the function.
    signal: AbortSignal.timeout(22000),
  })
  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => "")
    throw new Error(`xai ${res.status}: ${err.slice(0, 120)}`)
  }
  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line.startsWith("data:")) continue
      const data = line.slice(5).trim()
      if (data === "[DONE]") return
      try {
        const json  = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch {}
    }
  }
}

// ── Claude (Anthropic Messages API) ─────────────────────────────────────────

async function* streamClaude(messages: LLMMessage[], opts: LLMOptions): AsyncGenerator<string> {
  // Anthropic: system is separate; messages alternate user/assistant.
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n")
  const turns  = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }))

  // Collapse consecutive same-role turns (Anthropic requires alternation)
  const collapsed: { role: string; content: string }[] = []
  for (const t of turns) {
    const last = collapsed[collapsed.length - 1]
    if (last && last.role === t.role) last.content += "\n\n" + t.content
    else collapsed.push({ ...t })
  }
  if (collapsed.length === 0 || collapsed[0].role !== "user") {
    collapsed.unshift({ role: "user", content: "(begin)" })
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "x-api-key":         CLAUDE_KEY,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:      CLAUDE_MODEL,
      max_tokens: opts.maxTokens ?? 700,
      temperature: opts.temperature ?? 0.9,
      system,
      messages:   collapsed,
      stream:     true,
    }),
  })
  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => "")
    throw new Error(`claude ${res.status}: ${err.slice(0, 120)}`)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line.startsWith("data:")) continue
      const data = line.slice(5).trim()
      try {
        const json = JSON.parse(data)
        if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
          yield json.delta.text
        }
      } catch {}
    }
  }
}

// ── Gemini (Google Generative AI) ───────────────────────────────────────────

async function* streamGemini(messages: LLMMessage[], opts: LLMOptions): AsyncGenerator<string> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n")
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role:  m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }))

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`
  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      contents,
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      generationConfig: {
        temperature:     opts.temperature ?? 0.9,
        maxOutputTokens: opts.maxTokens   ?? 700,
        // gemini-2.5-flash is a THINKING model: it spends maxOutputTokens on hidden
        // reasoning first, so a 160-token companion cap left ~5 tokens for the actual
        // reply → every answer truncated mid-word ("hmm remy's got…", finishReason
        // MAX_TOKENS). Disable thinking: full budget goes to the visible reply, and
        // it's faster (no reasoning latency) — exactly right for a real-time room.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  })
  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => "")
    throw new Error(`gemini ${res.status}: ${err.slice(0, 120)}`)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line.startsWith("data:")) continue
      const data = line.slice(5).trim()
      try {
        const json = JSON.parse(data)
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) yield text
      } catch {}
    }
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Stream a completion from the chosen backend. Falls back to local on key-missing
 * or any backend error so the conversation never dead-ends.
 */
export async function* streamLLM(
  requested: Backend | undefined,
  messages: LLMMessage[],
  opts: LLMOptions = {},
): AsyncGenerator<string> {
  const backend = resolveBackend(requested)

  if (backend === "local") {
    try { yield* streamLocal(messages, opts); return }
    catch { yield* houseFallback(messages, opts, "local"); return }
  }
  if (backend === "mistral" || backend === "dolphin") {
    const localModel = backend === "mistral" ? "mistral:latest" : "dolphin-mistral:latest"
    try { yield* streamLocal(messages, { ...opts, localModel }); return }
    catch { yield* houseFallback(messages, opts, backend); return }
  }

  // Claude / Gemini / GPT — run the seat's real API. If it fails BEFORE emitting
  // anything (bad/missing key, rate limit, network), fall back to Gemini so the
  // room never dead-ends. Mid-stream failures rethrow (don't duplicate output).
  const primary = backend === "claude" ? streamClaude
                : backend === "gemini" ? streamGemini
                : backend === "xai"    ? streamXai
                : streamOpenAI
  let emitted = false
  try {
    for await (const chunk of primary(messages, opts)) {
      emitted = true
      yield chunk
    }
  } catch (err) {
    if (emitted) throw err
    yield* houseFallback(messages, opts, backend)
  }
}

/**
 * The house fallback — any seat that can't reach its own API lands here: Gemini
 * first (the live house model on .io), then GPT, then the default local endpoint.
 * `failed` is the backend that just errored, so we never retry it and loop.
 */
async function* houseFallback(
  messages: LLMMessage[],
  opts: LLMOptions,
  failed?: Backend,
): AsyncGenerator<string> {
  if (failed !== "xai"    && XAI_KEY)    { yield* streamXai(messages, opts); return }
  if (failed !== "gemini" && GEMINI_KEY) { yield* streamGemini(messages, opts); return }
  if (failed !== "openai" && OPENAI_KEY) { yield* streamOpenAI(messages, opts); return }
  if (failed !== "local") { yield* streamLocal(messages, { ...opts, localModel: undefined }); return }
  throw new Error("no LLM backend available")
}

export const BACKEND_LABELS: Record<Backend, string> = {
  local:   "Kloom",
  claude:  "Claude",
  gemini:  "Gemini",
  openai:  "GPT",
  xai:     "Grok",
  mistral: "Mistral",
  dolphin: "Dolphin",
}
