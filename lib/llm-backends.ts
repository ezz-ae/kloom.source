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

export type Backend = "local" | "claude" | "gemini" | "openai"

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

// ── Config ────────────────────────────────────────────────────────────────

const LOCAL_URL   = (process.env.LLM_BASE_URL || "http://localhost:11434/v1").replace(/\/$/, "")
const LOCAL_KEY   = process.env.LLM_API_KEY   || "local"
const LOCAL_MODEL = process.env.LLM_MODEL     || "llama3.2:latest"

const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY || ""
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-5"

const GEMINI_KEY   = process.env.GEMINI_API_KEY || ""
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash"

const OPENAI_KEY   = process.env.OPENAI_API_KEY || ""
const OPENAI_URL   = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o"

export function backendAvailable(b: Backend): boolean {
  if (b === "claude") return !!CLAUDE_KEY
  if (b === "gemini") return !!GEMINI_KEY
  if (b === "openai") return !!OPENAI_KEY
  return true // local always available
}

/** Resolve requested backend, falling back to local if its key is missing. */
export function resolveBackend(requested?: Backend): Backend {
  if (!requested || requested === "local") return "local"
  return backendAvailable(requested) ? requested : "local"
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
  // resolveBackend already downgrades claude/gemini → local when the key is missing.
  const backend = resolveBackend(requested)

  if (backend === "local") {
    yield* streamLocal(messages, opts)
    return
  }

  // Claude / Gemini / GPT with an Ollama (local) safety net. We only fall back if
  // the primary failed BEFORE emitting anything — otherwise we'd duplicate output.
  const primary = backend === "claude" ? streamClaude
                : backend === "gemini" ? streamGemini
                : streamOpenAI
  let emitted = false
  try {
    for await (const chunk of primary(messages, opts)) {
      emitted = true
      yield chunk
    }
  } catch (err) {
    if (emitted) throw err              // mid-stream failure — don't restart/duplicate
    // Clean failure (bad key, network, rate limit) → fall back to Ollama.
    yield* streamLocal(messages, opts)
  }
}

export const BACKEND_LABELS: Record<Backend, string> = {
  local:  "Kloom",
  claude: "Claude",
  gemini: "Gemini",
  openai: "GPT",
}
