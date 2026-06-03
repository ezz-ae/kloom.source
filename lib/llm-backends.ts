/**
 * LLM Backends Configuration
 * Multi-model router with full Mistral AI integration
 * 
 * MISTRAL OPTIMIZATIONS:
 * - Added Mistral as a first-class backend with full streaming support
 * - Added model cost tracking for all providers
 * - Added helper functions for backend resolution and availability
 * - Mistral is now the recommended default for most use cases
 */

import {
  ChatMessage,
  CreateMessageRequest,
  MistralClient,
  MistralStreamResponse,
} from "@mistralai/mistralai"

export type Backend = "local" | "claude" | "gemini" | "openai" | "mistral"

export const MODEL_COSTS: Record<Backend, { input: number; output: number }> = {
  local: { input: 0, output: 0 },
  claude: { input: 0.000003, output: 0.000015 },
  gemini: { input: 0.00000025, output: 0.000001 },
  openai: { input: 0.0000005, output: 0.0000015 },
  mistral: { input: 0.00000025, output: 0.00000025 },
}

export interface BackendConfig {
  id: Backend
  name: string
  displayName: string
  provider: string
  providerLogo: string
  description: string
  maxTokens: number
  supportsStreaming: boolean
  supportsVision: boolean
  supportsTools: boolean
  isDefault: boolean
  isAvailable: () => boolean
  cost: { input: number; output: number }
  recommendedFor: string[]
}

const BACKENDS: Record<Backend, BackendConfig> = {
  local: {
    id: "local",
    name: "local",
    displayName: "Local",
    provider: "Local",
    providerLogo: "PC",
    description: "Run models locally on your device. Free and private.",
    maxTokens: 32768,
    supportsStreaming: true,
    supportsVision: false,
    supportsTools: false,
    isDefault: false,
    isAvailable: () => true,
    cost: MODEL_COSTS.local,
    recommendedFor: ["private", "offline", "testing", "development"],
  },
  claude: {
    id: "claude",
    name: "claude",
    displayName: "Claude",
    provider: "Anthropic",
    providerLogo: "CLAUDE",
    description: "Claude 3 models from Anthropic. Excellent for complex reasoning and coding.",
    maxTokens: 200000,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    isDefault: false,
    isAvailable: () => !!process.env.CLAUDE_API_KEY,
    cost: MODEL_COSTS.claude,
    recommendedFor: ["coding", "complex reasoning", "analysis", "research"],
  },
  gemini: {
    id: "gemini",
    name: "gemini",
    displayName: "Gemini",
    provider: "Google",
    providerLogo: "GOOGLE",
    description: "Google's Gemini models. Strong in creative tasks and multimodal.",
    maxTokens: 32768,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    isDefault: false,
    isAvailable: () => !!process.env.GEMINI_API_KEY,
    cost: MODEL_COSTS.gemini,
    recommendedFor: ["creative", "multimodal", "writing", "images"],
  },
  openai: {
    id: "openai",
    name: "openai",
    displayName: "OpenAI",
    provider: "OpenAI",
    providerLogo: "OPENAI",
    description: "OpenAI's GPT-4 and GPT-3.5 models. Industry standard.",
    maxTokens: 128000,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    isDefault: false,
    isAvailable: () => !!process.env.OPENAI_API_KEY,
    cost: MODEL_COSTS.openai,
    recommendedFor: ["general", "chat", "enterprise"],
  },
  mistral: {
    id: "mistral",
    name: "mistral",
    displayName: "Mistral",
    provider: "Mistral AI",
    providerLogo: "MISTRAL",
    description: "Mistral AI models. Exceptional multilingual, coding, and structured data capabilities. Most cost-effective for most use cases.",
    maxTokens: 32768,
    supportsStreaming: true,
    supportsVision: false,
    supportsTools: true,
    isDefault: true,
    isAvailable: () => !!process.env.MISTRAL_API_KEY,
    cost: MODEL_COSTS.mistral,
    recommendedFor: ["general", "multilingual", "coding", "structured data", "json", "cost-effective", "arabic", "french", "german", "spanish"],
  },
}

export function getAvailableBackends(): Backend[] {
  return Object.keys(BACKENDS) as Backend[]
}

export function getBackendConfig(backend: Backend): BackendConfig {
  return BACKENDS[backend]
}

export function backendAvailable(backend: Backend): boolean {
  return BACKENDS[backend].isAvailable()
}

export function resolveBackend(backend: string): Backend {
  const normalized = backend.toLowerCase().trim()
  if (Object.keys(BACKENDS).includes(normalized)) return normalized as Backend
  const aliases: Record<string, Backend> = { anthropic: "claude", google: "gemini", gpt: "openai", openai: "openai", mistralai: "mistral", "mistral-ai": "mistral" }
  return aliases[normalized] || "mistral"
}

export function getDefaultBackend(): Backend {
  const available = getAvailableBackends().filter(backendAvailable)
  if (available.length > 0) {
    if (available.includes("mistral")) return "mistral"
    return available[0]
  }
  return "mistral"
}

export function getRecommendedBackend(useCase: string): Backend {
  const useCaseNormalized = useCase.toLowerCase()
  for (const [backend, config] of Object.entries(BACKENDS)) {
    if (config.recommendedFor.some(uc => useCaseNormalized.includes(uc))) return backend as Backend
  }
  return "mistral"
}

export function compareBackendCosts(inputTokens: number, outputTokens: number) {
  const results: any = {}
  for (const backend of getAvailableBackends()) {
    const costs = MODEL_COSTS[backend]
    results[backend] = {
      inputCost: (inputTokens / 1000) * costs.input,
      outputCost: (outputTokens / 1000) * costs.output,
      totalCost: ((inputTokens / 1000) * costs.input) + ((outputTokens / 1000) * costs.output),
    }
  }
  return results
}

let mistralClient: MistralClient | null = null

export function getMistralClient(): MistralClient {
  if (!mistralClient) {
    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) throw new Error("Mistral API key not configured")
    mistralClient = new MistralClient(apiKey)
  }
  return mistralClient
}

export async function mistralChatStream(messages: ChatMessage[], options: { model?: string; temperature?: number; maxTokens?: number; stream?: boolean } = {}) {
  const client = getMistralClient()
  const request: CreateMessageRequest = {
    model: options.model || "mistral-large-latest",
    messages,
    temperature: options.temperature || 0.7,
    maxTokens: options.maxTokens || 4096,
    stream: options.stream !== false,
  }
  return client.createMessage(request)
}

export async function mistralChat(messages: ChatMessage[], options: { model?: string; temperature?: number; maxTokens?: number } = {}): Promise<string> {
  const stream = await mistralChatStream(messages, { ...options, stream: false })
  if ("content" in stream && Array.isArray(stream.content) && stream.content[0]?.text) return stream.content[0].text
  throw new Error("Unexpected response format")
}

export async function processMistralStream(stream: MistralStreamResponse): Promise<string> {
  let result = ""
  if ("content" in stream && Array.isArray(stream.content)) {
    for (const choice of stream.content) {
      if (choice.type === "text" && choice.text) result += choice.text
    }
  }
  return result
}

export async function routeChatRequest(messages: ChatMessage[], backend: Backend, options: any = {}) {
  switch (backend) {
    case "mistral": return mistralChatStream(messages, options)
    case "local": throw new Error("Local backend not yet implemented")
    case "claude": throw new Error("Claude backend not yet implemented")
    case "gemini": throw new Error("Gemini backend not yet implemented")
    case "openai": throw new Error("OpenAI backend not yet implemented")
    default: throw new Error(`Unknown backend: ${backend}`)
  }
}

export function getBackendDisplayInfo(backend: Backend) {
  const config = getBackendConfig(backend)
  return {
    ...config,
    costPer1K: config.cost,
    costPer1KDisplay: {
      input: config.cost.input === 0 ? "Free" : `$${config.cost.input.toFixed(6)}`,
      output: config.cost.output === 0 ? "Free" : `$${config.cost.output.toFixed(6)}`,
    },
  }
}

export function calculateConversationCost(backend: Backend, inputTokens: number, outputTokens: number) {
  const costs = MODEL_COSTS[backend]
  return {
    total: (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output,
    input: (inputTokens / 1000) * costs.input,
    output: (outputTokens / 1000) * costs.output,
    currency: "$",
  }
}

export function formatCost(cost: number): string {
  if (cost === 0) return "Free"
  if (cost < 0.0001) return "< $0.0001"
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export { BACKENDS, getAvailableBackends as getBackends, getBackendConfig as getConfig, backendAvailable as isAvailable, resolveBackend as resolve, getDefaultBackend as getDefault, getRecommendedBackend as getRecommended }