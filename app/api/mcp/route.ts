// POST /api/mcp — the Kloom MCP server, embedded in the app.
//
// Same tools/prompts as the standalone mcp-server (it's imported from there),
// but served as a Next.js route on the same deployment — no separate host.
// The chat backend speaks one-shot JSON-RPC (tools/list, tools/call,
// prompts/get), which we bridge to a real McpServer through an in-memory
// transport pair, so the MCP SDK handles all protocol details.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"

// Note: the standalone server also registers safety tools (kloom_analyze_intent);
// the app runs the same gate in-process via lib/intent.ts, so it's omitted here.
import { registerSearchTools }   from "@/mcp-server/src/tools/search"
import { registerCryptoTools }   from "@/mcp-server/src/tools/crypto"
import { registerComputeTools }  from "@/mcp-server/src/tools/compute"
import { registerCreatorTools }  from "@/mcp-server/src/tools/creator"
import { registerAdvancedTools } from "@/mcp-server/src/tools/advanced"
import { registerPrompts }       from "@/mcp-server/src/prompts/index"
import { rateLimit, clientIp, globalGate } from "@/lib/rate-limit"
import { adultEnabled } from "@/lib/variant"

export const runtime = "nodejs"
export const maxDuration = 30

// Tools that only belong on the adult (.fun) build. Filtered from tools/list and
// refused on tools/call on the safe (.io/.me) deployments, so the SFW product
// never surfaces or runs sexual-content tooling.
const ADULT_TOOLS = new Set(["kloom_onlyfans_dm"])

function buildServer(): McpServer {
  const server = new McpServer({ name: "kloom-mcp-server", version: "1.0.0" })
  registerSearchTools(server)
  registerCryptoTools(server)
  registerComputeTools(server)
  registerCreatorTools(server)
  registerAdvancedTools(server)
  registerPrompts(server)
  return server
}

export async function POST(request: Request) {
  // Same protections as the room-chat endpoint: a global spend ceiling / kill-switch
  // and a per-IP rate limit. Without these this route is an uncapped cost + abuse
  // vector (every call can fan out to paid model/tool work).
  const gate = globalGate()
  if (!gate.ok) return new Response("the floor's at capacity right now — back in a bit.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "120" } })
  const rl = rateLimit(`mcp:${clientIp(request)}`, 45, 60_000)
  if (!rl.ok) return new Response("Slow down a sec.", { status: 429, headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": String(rl.retryAfter) } })

  let rpc: { jsonrpc?: string; id?: number | string | null; method?: string; params?: Record<string, unknown> }
  try {
    rpc = await request.json()
  } catch {
    return rpcError(null, -32700, "Parse error")
  }

  const { id = null, method, params = {} } = rpc
  if (!method) return rpcError(id, -32600, "Missing method")

  // On the SFW builds, never advertise or run adult tooling.
  const allowAdult = adultEnabled()

  // Fresh server + client pair per request (stateless; setup is ~ms).
  const server = buildServer()
  const client = new Client({ name: "kloom-app", version: "1.0.0" })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

    let result: unknown
    switch (method) {
      case "tools/list": {
        const listed = await client.listTools()
        result = allowAdult
          ? listed
          : { ...listed, tools: (listed.tools ?? []).filter((t) => !ADULT_TOOLS.has(t.name)) }
        break
      }
      case "tools/call": {
        const callName = (params as { name?: string }).name
        if (!allowAdult && callName && ADULT_TOOLS.has(callName)) {
          return rpcError(id, -32601, `Tool not available: ${callName}`)
        }
        result = await client.callTool(params as { name: string; arguments?: Record<string, unknown> })
        break
      }
      case "prompts/list":
        result = await client.listPrompts()
        break
      case "prompts/get":
        result = await client.getPrompt(params as { name: string; arguments?: Record<string, string> })
        break
      default:
        return rpcError(id, -32601, `Method not supported: ${method}`)
    }

    return Response.json({ jsonrpc: "2.0", id, result })
  } catch (err) {
    return rpcError(id, -32000, err instanceof Error ? err.message : String(err))
  } finally {
    await client.close().catch(() => {})
    await server.close().catch(() => {})
  }
}

export async function GET() {
  return Response.json({ status: "ok", server: "kloom-mcp-server", embedded: true })
}

function rpcError(id: number | string | null, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } })
}
