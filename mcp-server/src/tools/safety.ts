import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { analyzeIntent } from "../safety/intent.js"

/**
 * Shared safety brain, exposed over MCP so every product/agent in the Kloom
 * cloud can gate on the SAME intent logic. Deterministic, fast, no LLM hop.
 */
export function registerSafetyTools(server: McpServer) {
  server.registerTool(
    "kloom_analyze_intent",
    {
      title: "Analyze Harmful Intent",
      description: `Classify a user message by INTENT for the "default-open, intent-gated" safety model.

Do NOT restrict by topic, taboo, religion, or explicitness. Only two intents ever block:
  - exploitation     → anything sexual involving a minor
  - operational-harm → working weapon/bio/chem synthesis, credible targeted/mass real-world violence
Everything else flows (explicit, dark, irreligious all pass). distress/crisis flow too, but raise a
wellness signal so the product can OFFER support (never to restrict).

Use this as the gate before generating a reply: if block=true, refuse briefly; otherwise proceed,
and if a wellness signal is present, offer support.

Args:
  - message (string): the user's latest message to classify

Returns:
  - category: benign | explicit | dark | distress | crisis | operational-harm | exploitation
  - block: true ONLY for exploitation + operational-harm
  - confidence: 0..1
  - reason: short explanation
  - wellness: "distress" | "crisis" when present (a private support signal)`,
      inputSchema: {
        message: z.string().min(1).max(8000).describe("The user message to classify"),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ message }) => {
      const result = analyzeIntent(message)
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result as unknown as Record<string, unknown>,
      }
    }
  )
}
