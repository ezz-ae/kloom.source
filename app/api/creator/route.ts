import { NextRequest, NextResponse } from "next/server"

const LLM_BASE_URL = process.env.LLM_BASE_URL || "http://localhost:11434/v1"
const LLM_API_KEY  = process.env.LLM_API_KEY   || "local"
const LLM_MODEL    = process.env.LLM_MODEL      || "llama3.2"

const SYSTEM_PROMPTS: Record<string, (inputs: Record<string, string>) => string> = {
  "instagram-caption": (i) =>
    `You are an expert Instagram content strategist. Write a compelling, authentic Instagram caption for: "${i.topic}".
Tone: ${i.tone || "engaging and conversational"}.
Include a strong hook in the first line, storytelling in the middle, and a clear CTA at the end.
Add 3-5 relevant emojis naturally. Keep it under 300 words. Output only the caption, no explanations.`,

  "instagram-hashtags": (i) =>
    `You are an Instagram SEO expert. Generate 30 highly targeted hashtags for: "${i.topic}" in the "${i.niche || "lifestyle"}" niche.
Mix: 5 mega (1M+ posts), 10 large (100K-1M), 10 medium (10K-100K), 5 small (1K-10K).
Format: one hashtag per line starting with #. No explanations.`,

  "instagram-bio": (i) =>
    `You are an Instagram profile optimization expert. Rewrite this bio to be more compelling:
Current bio: "${i.bio}"
Niche: ${i.niche || "content creator"}
Goal: ${i.goal || "grow following and get DMs"}
Output: 3 bio variations, each under 150 characters. Number them 1, 2, 3. No other text.`,

  "instagram-story": (i) =>
    `You are a viral Instagram Stories strategist. Create a 5-frame story script for: "${i.topic}".
Format each frame as:
Frame 1: [Visual description] | [Text overlay] | [Interactive element]
Be specific and actionable. Make it engaging and shareable.`,

  "instagram-reel": (i) =>
    `You are a viral Reels expert. Write 5 different hook options for a Reel about: "${i.topic}".
Each hook must: stop the scroll in 0-3 seconds, create instant curiosity, be under 10 words.
Format: numbered list. Make them punchy and pattern-interrupting.`,

  "of-dm": (i) =>
    `You are a content creator assistant helping write authentic, personalized DM responses.
Fan message: "${i.message}"
Creator's tone/style: ${i.style || "warm, flirty, appreciative"}
Write 3 different reply options that: feel personal, encourage engagement, subtly promote content.
Keep each under 100 words. Number them 1, 2, 3.`,

  "of-ppv": (i) =>
    `You are an expert at writing pay-per-view content captions that convert.
Content type: "${i.contentType}"
Price: $${i.price || "15"}
Write a PPV caption that: creates anticipation, describes without revealing, makes it irresistible.
Under 150 words. Tasteful but enticing. Output only the caption.`,

  "of-welcome": (i) =>
    `You are a content creator writing a welcome message for new subscribers.
Creator niche: ${i.niche || "lifestyle"}
Personality: ${i.style || "warm and personal"}
Write a welcome message that: makes them feel special, sets expectations, encourages engagement, mentions your content schedule.
Under 200 words. Personal and authentic.`,

  "of-reengagement": (i) =>
    `You are an expert at re-engaging inactive subscribers.
Days inactive: ${i.days || "30"}
Last content type they engaged with: ${i.lastContent || "photos"}
Write 3 re-engagement messages that: feel personal not spammy, create FOMO, offer value.
Keep each under 80 words. Number them 1, 2, 3.`,

  "content-ideas": (i) =>
    `You are a content strategist. Generate 20 unique content ideas for a ${i.niche || "lifestyle"} creator.
Platform: ${i.platform || "Instagram & TikTok"}
Current follower count: ${i.followers || "10K"}
Mix: educational (5), entertaining (5), personal/vulnerable (5), promotional (5).
Format: numbered list with format [Type] Title - one sentence description.`,

  "brand-voice": (i) =>
    `You are a brand strategist. Analyze these sample posts and extract the creator's unique brand voice:
Sample posts:
${i.samples}
Output:
1. Voice descriptors (5 adjectives)
2. Signature phrases/expressions they use
3. Topics they own
4. What to NEVER say (anti-brand)
5. Template for future posts in their voice`,

  "content-calendar": (i) =>
    `You are a content calendar expert. Create a 4-week content calendar for a ${i.niche || "lifestyle"} creator.
Posting frequency: ${i.frequency || "5x per week"}
Platforms: ${i.platforms || "Instagram, TikTok"}
Include: post theme, content format, caption angle, best posting time.
Format as a table: Week | Day | Theme | Format | Angle | Time`,
}

export async function POST(req: NextRequest) {
  const { tool, inputs } = await req.json()

  if (!tool || !SYSTEM_PROMPTS[tool]) {
    return NextResponse.json({ error: "unknown_tool" }, { status: 400 })
  }

  const systemPrompt = SYSTEM_PROMPTS[tool](inputs || {})

  const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model:    LLM_MODEL,
      messages: [
        { role: "system",  content: systemPrompt },
        { role: "user",    content: "Generate the output now. Be specific, actionable, and high-quality." },
      ],
      temperature: 0.85,
      max_tokens:  1200,
    }),
  })

  if (!res.ok) {
    return NextResponse.json({ error: "llm_error" }, { status: 502 })
  }

  const data = await res.json()
  const output = data?.choices?.[0]?.message?.content ?? ""
  return NextResponse.json({ output })
}
