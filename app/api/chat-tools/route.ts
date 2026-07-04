/**
 * POST /api/chat-tools
 *
 * Drop-in replacement for /api/chat for the text chat UI.
 * Adds tool calling for expert personas (trading, coding, professional).
 *
 * Flow:
 *  1. Send messages + tools to LLM
 *  2. If LLM calls tools → execute → inject results → call again
 *  3. Stream final response back to client
 *
 * Returns: Server-Sent text stream (same format as /api/chat)
 *          + optional "data: [TOOLS_USED:...]" line before content
 */

import { NextRequest } from "next/server"
import { rateLimit, clientIp, globalGate } from "@/lib/rate-limit"
import {
  TOOL_DEFINITIONS,
  PERSONA_TOOLS,
  executeTool,
  type ToolCall,
} from "@/lib/tools"

const BASE_URL = (process.env.LLM_BASE_URL || "http://localhost:11434/v1").replace(/\/$/, "")
const API_KEY  = process.env.LLM_API_KEY   || "local"
const MODEL    = process.env.LLM_MODEL     || "llama3.2:latest"

interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool"
  content: string
  tool_call_id?: string
  tool_calls?: ToolCall[]
}

function buildSystemPrompt(persona: any): string {
  return `You are ${persona.name} — a real expert in your domain with access to live tools.

CRITICAL VOICE-CALL RULES (you are SPEAKING out loud, not writing):
1. Reply with 1 sentence. Maximum 2 sentences. NEVER more.
2. First person only: "I", "me", "my". Never narrate yourself.
3. No markdown, no bullets, no headers, no asterisks, no stage directions.
4. No filler: never say "great question", "certainly", "I understand", "as an AI".
5. Stay in character as ${persona.name} always.

YOUR IDENTITY:
Name: ${persona.name}
Personality: ${persona.personality || "Expert and direct"}
Speaking style: ${persona.speakingStyle || "Clear and confident"}
${persona.backstory ? `Backstory: ${persona.backstory}` : ""}

TOOL USE:
- Use tools when you need real-time data (prices, search results, calculations).
- After getting tool results, synthesize into 1-2 short sentences.
- Never say "I'll look that up" — just use the tool and respond.`
}

export async function POST(req: NextRequest) {
  // Billable LLM route (tool loop) — same guards as /api/chat so ad-scale traffic
  // can't loop it uncapped.
  const gate = globalGate()
  if (!gate.ok) return Response.json({ error: "at capacity" }, { status: 503, headers: { "Retry-After": "120" } })
  const rl = rateLimit(`chattools:${clientIp(req)}`, 45, 60_000)
  if (!rl.ok) return Response.json({ error: "Slow down a sec." }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } })

  const { persona, messages, mode } = await req.json()
  // mode: "voice" (strict short) | "chat" (more detail allowed)
  const isVoice = mode === "voice"

  const category = persona?.category ?? "friends"
  const tools    = PERSONA_TOOLS[category] ?? []

  const sysMsg = { role: "system", content: buildSystemPrompt(persona) }
  const msgHistory: ChatMessage[] = [sysMsg, ...messages]

  // ── Phase 1: tool decision (non-streaming, max 1 tool round-trip) ──────────
  let toolsUsed: string[] = []

  if (tools.length > 0) {
    let phase1Res: Response
    try {
      phase1Res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model:    MODEL,
          messages: msgHistory,
          tools,
          tool_choice: "auto",
          temperature: 0.7,
          max_tokens:  400,
          stream:      false,
        }),
      })
    } catch {
      // LLM unreachable — fall through to direct streaming
      phase1Res = new Response(null, { status: 502 })
    }

    if (phase1Res.ok) {
      const phase1Data = await phase1Res.json()
      const choice     = phase1Data.choices?.[0]?.message

      if (choice?.tool_calls?.length) {
        // Execute each tool
        const toolResults: ChatMessage[] = []

        for (const tc of choice.tool_calls) {
          let args: Record<string, unknown> = {}
          try { args = JSON.parse(tc.function?.arguments ?? "{}") } catch {}

          const result = await executeTool(tc.function?.name ?? "", args)
          toolsUsed.push(tc.function?.name ?? "")

          toolResults.push({
            role:         "tool",
            tool_call_id: tc.id,
            content:      result,
          })
        }

        // Inject: assistant tool_call message + tool results
        msgHistory.push({
          role:       "assistant",
          content:    "",
          tool_calls: choice.tool_calls,
        })
        msgHistory.push(...toolResults)
      }
    }
  }

  // ── Phase 2: stream the final response ────────────────────────────────────
  let upstream: Response
  try {
    upstream = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model:    MODEL,
        messages: msgHistory,
        temperature:        isVoice ? 0.85 : 0.95,
        max_tokens:         isVoice ? 80   : 500,
        presence_penalty:   0.6,
        frequency_penalty:  0.4,
        stream: true,
      }),
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `LLM unreachable: ${(err as Error).message}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    )
  }

  if (!upstream.ok || !upstream.body) {
    const txt = await upstream.text()
    return new Response(JSON.stringify({ error: txt }), { status: upstream.status })
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      // Emit tools metadata first (client can read and display)
      if (toolsUsed.length) {
        ctrl.enqueue(encoder.encode(`\x00TOOLS:${toolsUsed.join(",")}\x00`))
      }

      const reader = upstream.body!.getReader()
      let buf = ""
      let wordCount = 0
      const VOICE_WORD_CAP = 60

      try {
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
            if (data === "[DONE]") { ctrl.close(); return }
            try {
              const json  = JSON.parse(data)
              const delta = json.choices?.[0]?.delta?.content
              if (delta) {
                // Voice mode: hard-cap at VOICE_WORD_CAP words
                if (isVoice) {
                  wordCount += delta.split(/\s+/).filter(Boolean).length
                  if (wordCount > VOICE_WORD_CAP) {
                    reader.cancel()
                    ctrl.close()
                    return
                  }
                }
                ctrl.enqueue(encoder.encode(delta))
              }
            } catch {}
          }
        }
        ctrl.close()
      } catch (err) {
        ctrl.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type":             "text/plain; charset=utf-8",
      "Cache-Control":            "no-store",
      "X-Content-Type-Options":   "nosniff",
    },
  })
}
