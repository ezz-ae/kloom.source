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

export const runtime = "nodejs"
export const maxDuration = 30

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
  let rpc: { jsonrpc?: string; id?: number | string | null; method?: string; params?: Record<string, unknown> }
  try {
    rpc = await request.json()
  } catch {
    return rpcError(null, -32700, "Parse error")
  }

  const { id = null, method, params = {} } = rpc
  if (!method) return rpcError(id, -32600, "Missing method")

  // Fresh server + client pair per request (stateless; setup is ~ms).
  const server = buildServer()
  const client = new Client({ name: "kloom-app", version: "1.0.0" })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

  try {
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

    let result: unknown
    switch (method) {
      case "tools/list":
        result = await client.listTools()
        break
      case "tools/call":
        result = await client.callTool(params as { name: string; arguments?: Record<string, unknown> })
        break
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
