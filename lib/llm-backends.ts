/**
 * Multi-model LLM router.
 *
 * Lets a single room run different "seats" on genuinely different models:
 *   - local  → Ollama / any OpenAI-compatible endpoint
 *   - claude → Anthropic Messages API
 *   - gemini → Google Generative AI API
 *   - openai → OpenAI Chat Completions API
 *   - mistral → Mistral AI API
 *
 * Every backend is normalized to an async generator of text deltas, so the
 * caller streams output identically regardless of which model produced it.
 *
 * If a backend's API key is missing, it transparently falls back to local —
 * the app keeps working even before the user adds Claude/Gemini/Mistral keys.
 */

export type Backend = "local" | "claude" | "gemini" | "openai" | "mistral"

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
}

// ── Cost tracking ────────────────────────────────────────────────────────────

export interface CostInfo {
  inputCostPer1K: number
  outputCostPer1K: number
  currency: string
}

export const BACKEND_COSTS: Record<Backend, CostInfo> = {
  local:   { inputCostPer1K: 0, outputCostPer1K: 0, currency: "USD" },
  claude:  { inputCostPer1K: 3, outputCostPer1K: 15, currency: "USD" },
  gemini:  { inputCostPer1K: 1, outputCostPer1K: 3, currency: "USD" },
  openai:  { inputCostPer1K: 5, outputCostPer1K: 15, currency: "USD" },
  mistral: { inputCostPer1K: 2, outputCostPer1K: 6, currency: "USD" },
}

// ── Model recommendations ─────────────────────────────────────────────────────

export interface ModelRecommendation {
  name: string
  backend: Backend
  description: string
  useCases: string[]
  multilingual?: boolean
  arabicSupport?: boolean
}

export const RECOMMENDED_MODELS: ModelRecommendation[] = [
  {
    name: "mistral-large-latest",
    backend: "mistral",
    description: "Mistral's most capable model",
    useCases: ["general", "coding", "complex tasks"],
    multilingual: true,
    arabicSupport: true,
  },
  {
    name: "mistral-small-latest",
    backend: "mistral",
    description: "Fast and cost-effective",
    useCases: ["general", "fast responses", "cost-sensitive"],
    multilingual: true,
    arabicSupport: true,
  },
  {
    name: "claude-3-5-sonnet-20241022",
    backend: "claude",
    description: "Claude's latest Sonnet model",
    useCases: ["general", "coding", "reasoning"],
    multilingual: true,
  },
  {
    name: "claude-3-haiku-20240307",
    backend: "claude",
    description: "Fast and affordable",
    useCases: ["quick responses", "cost-effective"],
    multilingual: true,
  },
  {
    name: "gemini-2.0-flash",
    backend: "gemini",
    description: "Google's fast model",
    useCases: ["general", "fast", "multimodal"],
    multilingual: true,
  },
  {
    name: "gpt-4o",
    backend: "openai",
    description: "OpenAI's latest model",
    useCases: ["general", "coding", "creative"],
    multilingual: true,
  },
]

// ── Config ────────────────────────────────────────────────────────────────

const LOCAL_URL   = (process.env.LLM_BASE_URL || "http://localhost:11434/v1").replace(/\/$/, "")
const LOCAL_KEY   = process.env.LLM_API_KEY   || "local"
const LOCAL_MODEL = process.env.LLM_MODEL     || "llama3.2:latest"

const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY || ""
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022"

const GEMINI_KEY   = process.env.GEMINI_API_KEY || ""
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash"

const OPENAI_KEY   = process.env.OPENAI_API_KEY || ""
const OPENAI_URL   = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o"

const MISTRAL_KEY   = process.env.MISTRAL_API_KEY || ""
const MISTRAL_URL   = (process.env.MISTRAL_BASE_URL || "https://api.mistral.ai/v1").replace(/\/$/, "")
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || "mistral-large-latest"

export function backendAvailable(b: Backend): boolean {
  if (b === "claude") return !!CLAUDE_KEY
  if (b === "gemini") return !!GEMINI_KEY
  if (b === "openai") return !!OPENAI_KEY
  if (b === "mistral") return !!MISTRAL_KEY
  return true // local always available
}

/** Resolve requested backend, falling back to local if its key is missing. */
export function resolveBackend(requested?: Backend): Backend {
  if (!requested || requested === "local") return "local"
  return backendAvailable(requested) ? requested : "local"
}

/** Get all available backends based on configured API keys */
export function getAvailableBackends(): Backend[] {
  const backends: Backend[] = ["local"]
  if (backendAvailable("claude")) backends.push("claude")
  if (backendAvailable("gemini")) backends.push("gemini")
  if (backendAvailable("openai")) backends.push("openai")
  if (backendAvailable("mistral")) backends.push("mistral")
  return backends
}

/** Check if a backend supports streaming */
export function supportsStreaming(backend: Backend): boolean {
  // All supported backends support streaming
  return true
}

// ── Local (Ollama / OpenAI-compatible) ──────────────────────────────────────

async function* streamLocal(messages: LLMMessage[], opts: LLMOptions): AsyncGenerator<string> {
  const res = await fetch(`${LOCAL_URL}/chat/completions`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOCAL_KEY}` },
    body:    JSON.stringify({
      model:       opts.localModel || LOCAL_MODEL,
      messages,
      temperature: opts.temperature ?? 0.9,
      max_tokens:  opts.maxTokens   ?? 600,
      // Kill the local-model "repeat the same sentence" degeneration. Both the
      // OpenAI-compat penalties and Ollama's native repeat penalties are sent so
      // it works whichever the runtime honors.
      frequency_penalty: opts.frequencyPenalty ?? 0.8,
      presence_penalty:  opts.presencePenalty  ?? 0.6,
      repeat_penalty:    1.3,
      options:           { repeat_penalty: 1.3, repeat_last_n: 256 },
      stream:      true,
    }),
  })
  if (!res.ok || !res.body) throw new Error(`local LLM ${res.status}`)

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

// ── Mistral (Mistral AI API) ────────────────────────────────────────────────

async function* streamMistral(messages: LLMMessage[], opts: LLMOptions): AsyncGenerator<string> {
  const res = await fetch(`${MISTRAL_URL}/chat/completions`, {
    method:  "POST",
    headers: { 
      "Content-Type": "application/json", 
      "Authorization": `Bearer ${MISTRAL_KEY}` 
    },
    body:    JSON.stringify({
      model:       MISTRAL_MODEL,
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
    throw new Error(`mistral ${res.status}: ${err.slice(0, 120)}`)
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

// ── Router ────────────────────────────────────────────────────────────────────

/** Stream chat completions from the specified backend. */
export async function* streamChat(
  backend: Backend,
  messages: LLMMessage[],
  opts: LLMOptions = {}
): AsyncGenerator<string> {
  const resolved = resolveBackend(backend)
  switch (resolved) {
    case "local":
      yield* streamLocal(messages, opts)
      break
    case "claude":
      yield* streamClaude(messages, opts)
      break
    case "gemini":
      yield* streamGemini(messages, opts)
      break
    case "openai":
      yield* streamOpenAI(messages, opts)
      break
    case "mistral":
      yield* streamMistral(messages, opts)
      break
  }
}

/** Get a single non-streaming completion (for internal tool use). */
export async function getChatCompletion(
  backend: Backend,
  messages: LLMMessage[],
  opts: LLMOptions = {}
): Promise<string> {
  let result = ""
  for await (const delta of streamChat(backend, messages, { ...opts, maxTokens: opts.maxTokens ?? 200 })) {
    result += delta
  }
  return result
}

// ── Backend metadata ──────────────────────────────────────────────────────────

export interface BackendMetadata {
  id: Backend
  name: string
  description: string
  cost: CostInfo
  supportsStreaming: boolean
  supportsVision: boolean
  multilingual: boolean
  recommendedFor: string[]
}

export const BACKEND_METADATA: Record<Backend, BackendMetadata> = {
  local: {
    id: "local",
    name: "Local",
    description: "Run models locally with Ollama or OpenAI-compatible endpoints",
    cost: BACKEND_COSTS.local,
    supportsStreaming: true,
    supportsVision: false,
    multilingual: true,
    recommendedFor: ["development", "testing", "offline"]
  },
  claude: {
    id: "claude",
    name: "Claude",
    description: "Anthropic's advanced reasoning models",
    cost: BACKEND_COSTS.claude,
    supportsStreaming: true,
    supportsVision: true,
    multilingual: true,
    recommendedFor: ["reasoning", "coding", "complex tasks"]
  },
  gemini: {
    id: "gemini",
    name: "Gemini",
    description: "Google's multimodal AI models",
    cost: BACKEND_COSTS.gemini,
    supportsStreaming: true,
    supportsVision: true,
    multilingual: true,
    recommendedFor: ["multimodal", "fast", "general"]
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    description: "OpenAI's GPT models",
    cost: BACKEND_COSTS.openai,
    supportsStreaming: true,
    supportsVision: true,
    multilingual: true,
    recommendedFor: ["general", "coding", "creative"]
  },
  mistral: {
    id: "mistral",
    name: "Mistral",
    description: "Mistral AI's high-performance models with excellent multilingual support",
    cost: BACKEND_COSTS.mistral,
    supportsStreaming: true,
    supportsVision: false,
    multilingual: true,
    recommendedFor: ["general", "coding", "multilingual", "arabic", "fast", "cost-effective"]
  }
}
