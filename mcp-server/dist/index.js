import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { registerSearchTools } from "./tools/search.js";
import { registerCryptoTools } from "./tools/crypto.js";
import { registerComputeTools } from "./tools/compute.js";
import { registerCreatorTools } from "./tools/creator.js";
import { registerAdvancedTools } from "./tools/advanced.js";
import { registerPrompts } from "./prompts/index.js";
const PORT = Number(process.env.MCP_PORT ?? 3001);
function createServer() {
    const server = new McpServer({
        name: "ora-mcp-server",
        version: "1.0.0",
    });
    // Register all tools
    registerSearchTools(server);
    registerCryptoTools(server);
    registerComputeTools(server);
    registerCreatorTools(server);
    registerAdvancedTools(server);
    // Register all forcing prompts
    registerPrompts(server);
    return server;
}
// ── Express HTTP server ──────────────────────────────────────────────────────
const app = express();
app.use(express.json());
// Stateless streamable HTTP — new transport per request (no session state)
app.post("/mcp", async (req, res) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
        enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
});
// Health check
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        server: "ora-mcp-server",
        version: "1.0.0",
        tools: [
            "ora_web_search", "ora_get_crypto_price", "ora_get_multi_price",
            "ora_get_token_info", "ora_calculate", "ora_analyze_code",
            "ora_analyze_market", "ora_instagram_caption", "ora_generate_hashtags",
            "ora_onlyfans_dm", "ora_content_ideas",
            "ora_analyze_token_chart", "ora_generate_code", "ora_build_html",
            "ora_get_strategy", "ora_canva_design", "ora_create_wallet",
            "ora_build_connector", "ora_financial_calc",
        ],
        prompts: [
            "ora_trading_expert",
            "ora_coding_expert",
            "ora_creator_expert",
            "ora_companion",
            "ora_professional",
        ],
    });
});
app.listen(PORT, () => {
    console.error(`[ora-mcp-server] running on http://localhost:${PORT}`);
    console.error(`[ora-mcp-server] MCP endpoint: http://localhost:${PORT}/mcp`);
});
