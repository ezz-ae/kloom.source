import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { registerSearchTools } from "./tools/search.js";
import { registerCryptoTools } from "./tools/crypto.js";
import { registerComputeTools } from "./tools/compute.js";
import { registerCreatorTools } from "./tools/creator.js";
import { registerAdvancedTools } from "./tools/advanced.js";
import { registerSafetyTools } from "./tools/safety.js";
import { registerPrompts } from "./prompts/index.js";
const PORT = Number(process.env.MCP_PORT ?? 3001);
function createServer() {
    const server = new McpServer({
        name: "kloom-mcp-server",
        version: "1.0.0",
    });
    // Register all tools
    registerSearchTools(server);
    registerCryptoTools(server);
    registerComputeTools(server);
    registerCreatorTools(server);
    registerAdvancedTools(server);
    registerSafetyTools(server);
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
        server: "kloom-mcp-server",
        version: "1.0.0",
        tools: [
            "kloom_web_search", "kloom_get_crypto_price", "kloom_get_multi_price",
            "kloom_get_token_info", "kloom_calculate", "kloom_analyze_code",
            "kloom_analyze_market", "kloom_instagram_caption", "kloom_generate_hashtags",
            "kloom_onlyfans_dm", "kloom_content_ideas",
            "kloom_analyze_token_chart", "kloom_generate_code", "kloom_build_html",
            "kloom_get_strategy", "kloom_canva_design", "kloom_create_wallet",
            "kloom_build_connector", "kloom_financial_calc",
            "kloom_analyze_intent",
        ],
        prompts: [
            "kloom_trading_expert",
            "kloom_coding_expert",
            "kloom_creator_expert",
            "kloom_companion",
            "kloom_professional",
        ],
    });
});
app.listen(PORT, () => {
    console.error(`[kloom-mcp-server] running on http://localhost:${PORT}`);
    console.error(`[kloom-mcp-server] MCP endpoint: http://localhost:${PORT}/mcp`);
});
