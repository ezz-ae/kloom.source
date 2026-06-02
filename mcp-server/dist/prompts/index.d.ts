import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
/**
 * FORCING PROMPTS — not soft suggestions.
 *
 * These are structural constraints that leave the model almost no escape routes.
 * Each prompt:
 * 1. Declares IMMUTABLE role (model cannot negotiate this)
 * 2. Lists MANDATORY tool calls before answering
 * 3. Defines EXACT output format — structure enforced at character level
 * 4. Lists FORBIDDEN outputs that constitute failure
 * 5. Provides domain-specific expert knowledge the model must use
 */
export declare function registerPrompts(server: McpServer): void;
