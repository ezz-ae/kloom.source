import { z } from "zod";
export function registerSearchTools(server) {
    server.registerTool("ora_web_search", {
        title: "Web Search",
        description: `Search the web for real-time information, news, documentation, prices, or any current data.

Use this tool when the user asks about:
- Current events or news
- Live prices or market data not covered by other tools
- Documentation or how-to guides
- Any fact that may have changed recently

Args:
  - query (string): Precise search query. Be specific for better results.

Returns:
  - summary: Direct answer extracted from search results
  - results: Top 4 web results with title, snippet, url
  - source_count: Number of sources found

Error handling:
  - Returns partial results if some sources fail
  - Returns empty results with explanation if no results found`,
        inputSchema: {
            query: z.string().min(2).max(300).describe("The search query — be specific and precise"),
        },
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, async ({ query }) => {
        try {
            const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
            const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
            const data = await res.json();
            const results = [];
            if (data.RelatedTopics) {
                for (const t of data.RelatedTopics.slice(0, 4)) {
                    if (t.Text && t.FirstURL) {
                        results.push({ title: t.Text.split(" - ")[0] ?? t.Text, snippet: t.Text, url: t.FirstURL });
                    }
                }
            }
            const output = {
                query,
                summary: data.AbstractText || data.Answer || (results[0]?.snippet ?? "No direct answer found."),
                answer_type: data.Type ?? "general",
                results,
                source_count: results.length,
            };
            return {
                content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
                structuredContent: output,
            };
        }
        catch (err) {
            const msg = `Search failed: ${err.message}. Answer from training knowledge instead.`;
            return { content: [{ type: "text", text: msg }] };
        }
    });
}
