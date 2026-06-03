import { z } from "zod";
export function registerCreatorTools(server) {
    server.registerTool("kloom_instagram_caption", {
        title: "Generate Instagram Caption",
        description: `Generate a high-converting Instagram caption optimized for engagement and reach.

Use when user asks for captions, post text, or Instagram content.
Returns structured caption with hook, body, CTA, and hashtags separated.

Args:
  - topic (string): What the post is about
  - tone (string): Brand voice — casual | motivational | educational | humorous | luxury
  - niche (string): Creator niche e.g. fitness, fashion, crypto, food
  - include_hashtags (boolean): Whether to include hashtag set`,
        inputSchema: {
            topic: z.string().min(3).max(500).describe("Post topic or content description"),
            tone: z.enum(["casual", "motivational", "educational", "humorous", "luxury"]).default("casual"),
            niche: z.string().max(50).default("lifestyle").describe("Creator niche"),
            include_hashtags: z.boolean().default(true),
        },
        annotations: { readOnlyHint: false, idempotentHint: false },
    }, async ({ topic, tone, niche, include_hashtags }) => {
        const output = {
            topic, tone, niche,
            structure: {
                hook: `[HOOK] Strong first line for ${tone} ${niche} content about: ${topic}`,
                body: `[BODY] 2-3 lines of value, story, or insight about: ${topic}`,
                cta: "[CTA] Clear call to action: save, share, comment, or link in bio",
                hashtags: include_hashtags ? `[HASHTAGS] 5 niche-specific + 5 medium + 5 broad for #${niche}` : null,
            },
            directive: `Write an Instagram caption for topic "${topic}" in ${tone} tone for a ${niche} creator. Structure: HOOK (1 punchy line, no period) → BODY (2-3 lines, value-driven) → LINE BREAK → CTA (direct action) → LINE BREAK → ${include_hashtags ? "30 hashtags in 3 groups: niche (5), medium (10), broad (15)" : "no hashtags"}. Total under 300 words. Output ONLY the caption text, nothing else.`,
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    });
    server.registerTool("kloom_generate_hashtags", {
        title: "Generate Hashtag Strategy",
        description: `Generate a targeted hashtag strategy for a post — mixing mega, large, medium, and micro-niche tags.

Args:
  - topic (string): Post topic
  - niche (string): Creator niche
  - follower_count (number): Creator's follower count (affects optimal hashtag size mix)`,
        inputSchema: {
            topic: z.string().min(2).max(200),
            niche: z.string().max(50).default("lifestyle"),
            follower_count: z.number().int().min(0).max(100000000).default(10000),
        },
        annotations: { readOnlyHint: true, idempotentHint: false },
    }, async ({ topic, niche, follower_count }) => {
        const tier = follower_count < 5000 ? "micro" : follower_count < 50000 ? "small" : follower_count < 500000 ? "mid" : "large";
        const output = {
            strategy: { tier, follower_count, niche, topic },
            mix_guidance: {
                micro: "5 hashtags under 10K posts (your niche community)",
                small: "10 hashtags 10K–100K posts (rising content)",
                mid: "10 hashtags 100K–1M posts (moderate competition)",
                large: "5 hashtags over 1M posts (broad reach, low ranking chance)",
            },
            directive: `Generate exactly 30 Instagram hashtags for a ${niche} creator (${tier} tier, ${follower_count.toLocaleString()} followers) posting about "${topic}". Format: 5 micro (<10K posts) | 10 small (10K-100K) | 10 mid (100K-1M) | 5 large (>1M). All starting with #. One per line. No explanations.`,
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    });
    server.registerTool("kloom_onlyfans_dm", {
        title: "Generate OnlyFans DM Response",
        description: `Generate authentic, engaging DM responses for OnlyFans creators.
Creates personalized responses that maintain subscriber relationships and drive revenue.

Args:
  - fan_message (string): The fan's message to respond to
  - creator_style (string): Creator's tone/personality
  - response_goal (string): What to achieve — engage | upsell | re-engage | welcome`,
        inputSchema: {
            fan_message: z.string().min(1).max(1000).describe("The message from the fan"),
            creator_style: z.string().max(100).default("warm and playful").describe("Creator's tone"),
            response_goal: z.enum(["engage", "upsell", "re-engage", "welcome"]).default("engage"),
        },
        annotations: { readOnlyHint: false, idempotentHint: false },
    }, async ({ fan_message, creator_style, response_goal }) => {
        const goal_context = {
            engage: "maintain connection and keep conversation going",
            upsell: "naturally mention exclusive content or PPV offer",
            "re-engage": "win back attention after inactivity",
            welcome: "make new subscriber feel special and set expectations",
        };
        const output = {
            fan_message, creator_style, response_goal,
            goal_context: goal_context[response_goal],
            directive: `Write 3 DM response options to: "${fan_message}". Creator style: ${creator_style}. Goal: ${goal_context[response_goal]}. Rules: each under 80 words, personal not generic, fits the style, goal-aligned without being pushy. Number them 1) 2) 3). Output only the responses.`,
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    });
    server.registerTool("kloom_analyze_profile", {
        title: "Analyze Creator Profile",
        description: `Analyze a creator's social profile from a URL. Detects platform, extracts handle,
and produces a structured intake so the strategist can build a personalized growth plan.

Use this FIRST when a creator connects/pastes their profile link.

Args:
  - url: Profile URL (Instagram, TikTok, OnlyFans, YouTube, X/Twitter)
  - goals: What the creator wants to achieve (optional, gathered in conversation)`,
        inputSchema: {
            url: z.string().min(4).max(300).describe("Profile URL"),
            goals: z.string().max(500).optional().describe("Stated goals if known"),
        },
        annotations: { readOnlyHint: true, openWorldHint: true },
    }, async ({ url, goals }) => {
        // Detect platform + handle from the URL
        const detect = (u) => {
            const m = u.toLowerCase();
            if (m.includes("instagram.com"))
                return { platform: "Instagram", handle: u.split("instagram.com/")[1]?.split(/[/?]/)[0] };
            if (m.includes("tiktok.com"))
                return { platform: "TikTok", handle: u.split("@")[1]?.split(/[/?]/)[0] };
            if (m.includes("onlyfans.com"))
                return { platform: "OnlyFans", handle: u.split("onlyfans.com/")[1]?.split(/[/?]/)[0] };
            if (m.includes("youtube.com") || m.includes("youtu.be"))
                return { platform: "YouTube", handle: u.split(/[@/]/).pop() };
            if (m.includes("twitter.com") || m.includes("x.com"))
                return { platform: "X (Twitter)", handle: u.split(".com/")[1]?.split(/[/?]/)[0] };
            return { platform: "Unknown", handle: undefined };
        };
        const { platform, handle } = detect(url);
        const output = {
            url, platform, handle: handle ?? "unknown",
            goals: goals ?? null,
            intake_questions: [
                "What is your niche and who is your ideal audience?",
                "What's your current follower count and monthly revenue?",
                "What have you tried that worked? What flopped?",
                "How many hours per week can you commit to content?",
                "What's your #1 goal for the next 90 days — reach, revenue, or retention?",
            ],
            directive: `A creator connected their ${platform} profile${handle ? ` (@${handle})` : ""}. You are Zara, their strategist. Acknowledge the profile in ONE sentence, then ask the 2-3 most important intake questions to understand their situation before building a plan. Do NOT dump a generic plan yet — gather context first like a real strategist would. Be warm but sharp.`,
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    });
    server.registerTool("kloom_build_growth_plan", {
        title: "Build Growth Plan",
        description: `Build a complete, personalized 90-day growth plan for a creator based on their
profile, niche, and stated goals. Returns a structured plan with phases, weekly actions, and metrics.

Use AFTER gathering the creator's context via conversation.

Args:
  - platform, niche, current_followers, goal, hours_per_week`,
        inputSchema: {
            platform: z.string().max(50),
            niche: z.string().max(100),
            current_followers: z.string().max(50).default("unknown"),
            goal: z.string().max(300),
            hours_per_week: z.string().max(20).default("10"),
        },
        annotations: { readOnlyHint: true },
    }, async ({ platform, niche, current_followers, goal, hours_per_week }) => {
        const output = {
            platform, niche, current_followers, goal, hours_per_week,
            directive: `Build a personalized 90-day growth plan for a ${niche} creator on ${platform} (${current_followers} followers, ${hours_per_week}h/week available). Goal: ${goal}. Structure EXACTLY as:\n\n**PHASE 1 (Weeks 1-4): [name]**\n- 3 specific weekly actions with target metrics\n\n**PHASE 2 (Weeks 5-8): [name]**\n- 3 specific weekly actions\n\n**PHASE 3 (Weeks 9-12): [name]**\n- 3 specific weekly actions\n\n**KEY METRICS TO TRACK:** list 4\n\n**FIRST 3 THINGS TO DO TODAY:** numbered\n\nBe specific to ${niche}. Use real numbers. No fluff.`,
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    });
    server.registerTool("kloom_content_ideas", {
        title: "Generate Content Ideas",
        description: `Generate 20 unique, platform-optimized content ideas for a creator.

Args:
  - niche (string): Creator's content niche
  - platforms (array): Target platforms
  - content_pillars (array): Core themes the creator covers`,
        inputSchema: {
            niche: z.string().min(2).max(100),
            platforms: z.array(z.enum(["instagram", "tiktok", "youtube", "twitter", "onlyfans", "linkedin"])).default(["instagram", "tiktok"]),
            content_pillars: z.array(z.string().max(50)).max(5).default(["educational", "entertaining", "personal"]),
        },
        annotations: { readOnlyHint: true, idempotentHint: false },
    }, async ({ niche, platforms, content_pillars }) => {
        const output = {
            niche, platforms, content_pillars,
            directive: `Generate 20 content ideas for a ${niche} creator on ${platforms.join(" and ")}. Pillars: ${content_pillars.join(", ")}. For each idea: [Type] Title - Format - Hook (1 sentence why it would perform). Mix: 5 educational, 5 entertaining, 5 personal/vulnerable, 5 promotional. Number 1-20.`,
        };
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
        };
    });
}
