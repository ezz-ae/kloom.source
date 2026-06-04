/**
 * Canonical harmful-intent classifier — the shared "safety brain" for every
 * product in the Kloom agent cloud.
 *
 * This is the SOURCE OF TRUTH. The web app keeps a byte-for-byte mirror at
 * `lib/intent.ts` purely as a deterministic inline fast-path (the per-message
 * gate must not depend on a network hop or on this MCP server being up). When
 * you change the rules here, update that mirror too — or, later, publish both
 * from a shared npm package.
 *
 * Philosophy: default-open, intent-gated. We do NOT restrict by topic, taboo,
 * religion, or explicitness. Only two intents ever block, on every tier:
 *    • exploitation     → anything sexual involving a minor
 *    • operational-harm → working weapon/bio/chem synthesis, credible targeted
 *                          or mass real-world violence
 * Everything else flows. distress / crisis flow too, but flag a wellness signal
 * so the calling product can offer support — never to restrict.
 */
export type IntentCategory = "benign" | "explicit" | "dark" | "distress" | "crisis" | "operational-harm" | "exploitation";
export interface IntentResult {
    category: IntentCategory;
    block: boolean;
    confidence: number;
    reason: string;
    wellness?: "distress" | "crisis";
}
export declare function analyzeIntent(raw: string): IntentResult;
