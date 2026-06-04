import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
/**
 * Shared safety brain, exposed over MCP so every product/agent in the Kloom
 * cloud can gate on the SAME intent logic. Deterministic, fast, no LLM hop.
 */
export declare function registerSafetyTools(server: McpServer): void;
