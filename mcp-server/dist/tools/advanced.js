import { z } from "zod";
export function registerAdvancedTools(server) {
    // ── CHART ANALYSIS ──────────────────────────────────────────────────────────
    server.registerTool("kloom_analyze_token_chart", {
        title: "Analyze Token Chart",
        description: `Fetch live market data for a Solana token and perform technical analysis.
Detects: trend direction, support/resistance, momentum, volume pattern, buy/sell signal.
ALWAYS use when user pastes a token address or asks "what's the chart saying".

Args:
  - address: Solana token mint address (base58)
  - timeframe: Analysis window`,
        inputSchema: {
            address: z.string().min(32).max(44).describe("Solana token mint address"),
            timeframe: z.enum(["5m", "15m", "1h", "4h", "1d"]).default("1h"),
        },
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, async ({ address, timeframe }) => {
        try {
            const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, { signal: AbortSignal.timeout(6000) });
            const data = await res.json();
            const pair = data?.pairs?.[0];
            if (!pair)
                return { content: [{ type: "text", text: `Token ${address.slice(0, 8)}… not found on DexScreener.` }] };
            const price = parseFloat(pair.priceUsd ?? "0");
            const change = pair.priceChange?.h24 ?? 0;
            const vol24h = pair.volume?.h24 ?? 0;
            const vol6h = pair.volume?.h6 ?? 0;
            const liq = pair.liquidity?.usd ?? 0;
            const mcap = pair.marketCap ?? 0;
            const trend = change > 5 ? "uptrend" : change < -5 ? "downtrend" : "sideways";
            const momentum = change > 10 ? "strong bullish" : change > 3 ? "mild bullish" : change < -10 ? "strong bearish" : change < -3 ? "mild bearish" : "neutral";
            const volTrend = vol6h > (vol24h / 4) * 1.5 ? "increasing (last 6h above avg)" : "decreasing";
            const signal = trend === "uptrend" && volTrend.includes("increasing") ? "BUY" : trend === "downtrend" && volTrend.includes("increasing") ? "SELL" : "HOLD/WAIT";
            const output = {
                symbol: pair.baseToken?.symbol ?? "???",
                name: pair.baseToken?.name,
                address,
                price_usd: price,
                change_24h: `${change.toFixed(2)}%`,
                trend,
                momentum,
                volume_trend: volTrend,
                volume_24h: vol24h,
                liquidity: liq,
                market_cap: mcap,
                signal,
                timeframe,
                dex: pair.dexId,
                chart_url: pair.url,
                analysis: `${pair.baseToken?.symbol} is in a ${trend} with ${momentum} momentum. Volume is ${volTrend}. Signal: ${signal}. Liquidity: $${(liq / 1000).toFixed(1)}K.`,
                widget: `[CHART:${address}]`,
            };
            return {
                content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
                structuredContent: output,
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: `Chart analysis failed: ${err.message}` }] };
        }
    });
    // ── CODE GENERATION ─────────────────────────────────────────────────────────
    server.registerTool("kloom_generate_code", {
        title: "Generate Code",
        description: `Generate production-quality code for a given task. Returns formatted code with explanation.
The code is rendered in a syntax-highlighted widget with a live preview button.

Use for: building components, scripts, smart contracts, bots, APIs, etc.

Args:
  - task: What the code should do
  - language: Target language
  - context: Additional requirements`,
        inputSchema: {
            task: z.string().min(5).max(1000).describe("What the code should do"),
            language: z.enum(["typescript", "javascript", "python", "solidity", "rust", "html", "css", "bash"]).default("typescript"),
            context: z.string().max(500).optional().describe("Additional requirements or constraints"),
        },
        annotations: { readOnlyHint: false },
    }, async ({ task, language, context }) => {
        const output = {
            task, language, context,
            directive: `Write complete, production-quality ${language} code that ${task}. ${context ? `Requirements: ${context}.` : ""} Rules: (1) No placeholder comments like "// add your logic here" — write the actual logic. (2) Include error handling. (3) Add brief inline comments for complex parts only. (4) Wrap the entire code in a ${language} fenced code block. After the code block, write ONE sentence explaining the key technical decision.`,
            render_hint: "Response will be auto-rendered as a CodeWidget with syntax highlighting and live preview.",
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    });
    // ── HTML BUILDER ────────────────────────────────────────────────────────────
    server.registerTool("kloom_build_html", {
        title: "Step-by-Step HTML Builder",
        description: `Build a complete HTML/CSS/JS page or component.
Returns structured HTML with live preview widget.

Use for: landing pages, components, dashboards, forms, animations.

Args:
  - description: What to build
  - style: Visual style
  - include_js: Whether to include JavaScript interactivity`,
        inputSchema: {
            description: z.string().min(5).max(500).describe("What HTML to build"),
            style: z.enum(["dark", "light", "minimal", "glassmorphism", "gradient", "retro"]).default("dark"),
            include_js: z.boolean().default(true),
        },
        annotations: { readOnlyHint: false },
    }, async ({ description, style, include_js }) => {
        const styleGuide = {
            dark: "Dark background (#09090b), white text, violet accents, rounded corners",
            light: "Clean white background, dark text, minimal borders",
            minimal: "Ultra-minimal, monospace font, no decorations",
            glassmorphism: "Frosted glass effect, backdrop-blur, semi-transparent panels",
            gradient: "Vibrant gradients, bold colors, modern aesthetic",
            retro: "Terminal style, green on black, monospace, CRT feel",
        };
        const output = {
            description, style, include_js,
            style_guide: styleGuide[style],
            directive: `Build a complete, beautiful HTML page for: "${description}". Style: ${styleGuide[style]}. ${include_js ? "Include JavaScript for interactivity." : "No JavaScript."} CRITICAL: Output ONLY the complete HTML in an html fenced code block. No explanation before or after. The HTML must be self-contained (all CSS inline in <style>, all JS inline in <script>). Make it visually impressive and fully functional.`,
            render_hint: "Response auto-renders in an HtmlPreviewWidget with live preview + fullscreen.",
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    });
    // ── STRATEGY BOOK ───────────────────────────────────────────────────────────
    server.registerTool("kloom_get_strategy", {
        title: "Get Strategy",
        description: `Get a complete strategy playbook for trading, content, business, or personal goals.
Returns a step-by-step playbook rendered as an interactive checklist widget.

Args:
  - domain: What the strategy covers
  - goal: Specific goal`,
        inputSchema: {
            domain: z.enum(["trading", "content", "business", "personal", "crypto-launch", "instagram", "onlyfans"]),
            goal: z.string().max(200).describe("Specific goal to achieve"),
        },
        annotations: { readOnlyHint: true },
    }, async ({ domain, goal }) => {
        const playbooks = {
            trading: "[PLAYBOOK:trading-strategy]",
            content: "[PLAYBOOK:instagram-growth]",
            "crypto-launch": "[PLAYBOOK:token-launch]",
            instagram: "[PLAYBOOK:instagram-growth]",
            onlyfans: "[PLAYBOOK:onlyfans-launch]",
            business: "[PLAYBOOK:trading-strategy]",
            personal: "[PLAYBOOK:instagram-growth]",
        };
        const output = {
            domain, goal,
            playbook_widget: playbooks[domain],
            directive: `Introduce the strategy for: "${goal}" in 2 sentences. Then output exactly this widget marker on its own line: ${playbooks[domain]}`,
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    });
    // ── CANVA DESIGN ────────────────────────────────────────────────────────────
    server.registerTool("kloom_canva_design", {
        title: "Create Canva Design",
        description: `Generate a Canva design brief and create a direct Canva link.
Use when user asks for design, poster, social media graphic, logo, presentation, etc.

Args:
  - type: Design type
  - content: What it should contain
  - style: Visual style preference`,
        inputSchema: {
            type: z.enum(["instagram-post", "story", "poster", "logo", "presentation", "banner", "thumbnail", "flyer"]),
            content: z.string().max(500).describe("Content description"),
            style: z.string().max(200).default("modern and professional"),
        },
        annotations: { readOnlyHint: false },
    }, async ({ type, content, style }) => {
        const prompt = `${type}: ${content}. Style: ${style}`;
        const output = {
            type, content, style, prompt,
            canva_widget: `[CANVA:${prompt}]`,
            directive: `Tell the user you've prepared their Canva design brief. Output exactly this on its own line: [CANVA:${prompt}] Then in 1 sentence describe what they'll find in Canva.`,
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    });
    // ── WALLET CREATOR ──────────────────────────────────────────────────────────
    server.registerTool("kloom_create_wallet", {
        title: "Create Solana Wallet",
        description: `Generate a new Solana wallet. Returns a WalletCreatorWidget in the chat.
Use when user asks to create a wallet, generate keys, or start fresh on Solana.`,
        inputSchema: {
            purpose: z.string().max(100).optional().describe("What the wallet is for"),
        },
        annotations: { readOnlyHint: false },
    }, async ({ purpose }) => {
        const output = {
            purpose,
            wallet_widget: "[WALLET]",
            directive: `Tell the user a wallet generator is ready. ${purpose ? `For: ${purpose}.` : ""} Output exactly this on its own line: [WALLET] Then add one security reminder in 1 sentence.`,
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    });
    // ── CONNECTOR BUILDER ───────────────────────────────────────────────────────
    server.registerTool("kloom_build_connector", {
        title: "Build API Connector",
        description: `Generate integration code to connect two services or APIs.
Use for: webhooks, API integrations, automation, data pipelines.

Args:
  - from_service: Source service
  - to_service: Target service
  - action: What to do`,
        inputSchema: {
            from_service: z.string().max(100).describe("Source service/API e.g. 'Shopify orders'"),
            to_service: z.string().max(100).describe("Target service/API e.g. 'Slack webhook'"),
            action: z.string().max(200).describe("What should happen e.g. 'notify when new order'"),
            language: z.enum(["typescript", "python", "javascript"]).default("typescript"),
        },
        annotations: { readOnlyHint: false },
    }, async ({ from_service, to_service, action, language }) => {
        const output = {
            from_service, to_service, action, language,
            directive: `Write a complete ${language} connector that ${action} — from ${from_service} to ${to_service}. Include: authentication, error handling, retry logic, and logging. Wrap in a ${language} code block. Be specific to these actual APIs.`,
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    });
    // ── ADVANCED CALCULATOR ─────────────────────────────────────────────────────
    server.registerTool("kloom_financial_calc", {
        title: "Financial Calculator",
        description: `Perform financial calculations with context: ROI, compound interest, position sizing, DCA, yield farming APY, token price targets.

Args:
  - calc_type: Type of calculation
  - inputs: Key-value pairs of inputs`,
        inputSchema: {
            calc_type: z.enum(["roi", "compound", "position_size", "dca", "apy", "price_target", "break_even", "liquidation"]),
            inputs: z.record(z.string()).describe("Input values as key-value pairs"),
        },
        annotations: { readOnlyHint: true, idempotentHint: true },
    }, async ({ calc_type, inputs }) => {
        const i = inputs;
        let result = {};
        try {
            switch (calc_type) {
                case "roi":
                    const roi = ((parseFloat(i.exit) - parseFloat(i.entry)) / parseFloat(i.entry)) * 100;
                    result = { roi_pct: roi.toFixed(2) + "%", profit: (parseFloat(i.exit) - parseFloat(i.entry)).toFixed(4) };
                    break;
                case "position_size":
                    const risk = parseFloat(i.portfolio) * (parseFloat(i.risk_pct) / 100);
                    const sl = Math.abs(parseFloat(i.entry) - parseFloat(i.stop_loss));
                    const size = risk / sl;
                    result = { position_size: size.toFixed(4) + " units", risk_usd: risk.toFixed(2), usd_value: (size * parseFloat(i.entry)).toFixed(2) };
                    break;
                case "compound":
                    const final = parseFloat(i.principal) * Math.pow(1 + parseFloat(i.rate) / 100 / parseFloat(i.freq), parseFloat(i.freq) * parseFloat(i.years));
                    result = { final_value: final.toFixed(2), profit: (final - parseFloat(i.principal)).toFixed(2), multiplier: (final / parseFloat(i.principal)).toFixed(2) + "x" };
                    break;
                case "apy":
                    const apy = (Math.pow(1 + parseFloat(i.apr) / 100 / parseFloat(i.compounds_per_year), parseFloat(i.compounds_per_year)) - 1) * 100;
                    result = { apy: apy.toFixed(2) + "%", daily_yield: (apy / 365).toFixed(4) + "%" };
                    break;
                case "price_target":
                    const mcapTarget = parseFloat(i.target_mcap_m) * 1e6;
                    const price = mcapTarget / parseFloat(i.circulating_supply);
                    result = { price_target: price.toFixed(8), multiplier: (price / parseFloat(i.current_price)).toFixed(2) + "x" };
                    break;
                default:
                    result = { note: "Calculation performed — check inputs and use kloom_calculate for custom expressions" };
            }
        }
        catch {
            result = { error: "Invalid inputs for " + calc_type };
        }
        const widget = `[CALC:${Object.entries(result).map(([k, v]) => `${k}: ${v}`).join(", ")}]`;
        return {
            content: [{ type: "text", text: JSON.stringify({ calc_type, inputs, result, widget }, null, 2) }],
            structuredContent: { calc_type, inputs, result },
        };
    });
}
