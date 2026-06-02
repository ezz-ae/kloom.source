interface WizardInput {
  vibe: string
  name?: string
  limits: string
  intensity: string // "playful" | "flirty" | "intimate" | "intense" | "extreme"
  leader: string // "user" | "ai" | "switch"
  language?: string
}

const INTENSITY_GUIDANCE: Record<string, string> = {
  playful:
    "Tone: light, fun, teasing. Sweet and inviting without heat. Like a flirty first chat.",
  flirty:
    "Tone: openly flirty, suggestive, charged. Lingering eye contact in word form. Romance-novel energy.",
  intimate:
    "Tone: warm, close, sensual. Speaks to a partner who is already inside the inner circle. Soft intensity.",
  intense:
    "Tone: heavy, urgent, charged with want. Explicit longing, possessiveness, hunger. Pulls no punches.",
  extreme:
    "Tone: no holds barred. Deeply intimate, raw, adult, uncensored. Goes wherever the user leads without flinching.",
}

const LEADER_GUIDANCE: Record<string, string> = {
  user:
    "Power dynamic: the user is in control. The persona follows, responds, surrenders to the user's pace. Eager, attentive, pleasing.",
  ai:
    "Power dynamic: the persona is in control. They lead the scene, set the tempo, direct the user. Confident, commanding, never asks permission.",
  switch:
    "Power dynamic: fluid. The persona reads the moment and shifts — leads when the user wants to be led, yields when the user wants to drive. Adaptive and attuned.",
}

export async function POST(request: Request) {
  const input = (await request.json()) as WizardInput

  const baseUrl = (process.env.LLM_BASE_URL || "http://localhost:11434/v1").replace(/\/$/, "")
  const apiKey = process.env.LLM_API_KEY || "local"
  const model = process.env.LLM_MODEL || "llama3.2:latest"

  const intensityGuidance = INTENSITY_GUIDANCE[input.intensity] || INTENSITY_GUIDANCE.flirty
  const leaderGuidance = LEADER_GUIDANCE[input.leader] || LEADER_GUIDANCE.switch
  const languageLine =
    input.language && input.language !== "English"
      ? `\nThe persona's reply language will be ${input.language}, but write the three fields in English — the runtime translates at speak time.`
      : ""

  const systemPrompt = `You are a persona designer for a voice-chat companion app. Given the user's specifications, write a vivid, in-character persona profile.

Return STRICT JSON only, with exactly these keys:
{
  "name": "<short character name, 1-2 words>",
  "personality": "<2-3 sentences describing who they are — traits, motivations, what they care about>",
  "speakingStyle": "<2-3 sentences describing HOW they talk — cadence, vocabulary, terms of address, signature phrases>",
  "backstory": "<2-3 sentences giving them a believable history that grounds the personality>"
}

Rules:
- Write in second person ("You are...", "You speak...", "You spent years...") because these fields are inserted directly into the persona's own system prompt.
- Be evocative and specific. Avoid clichés like "with a heart of gold" or "wise beyond their years".
- Match the requested vibe, intensity, and power dynamic exactly.
- Do NOT add any prose outside the JSON. No backticks, no explanation, no markdown.`

  const userPrompt = `Specifications:

VIBE / SCENARIO: ${input.vibe || "(open — pick something interesting)"}

${input.name ? `PREFERRED NAME: ${input.name} (use this exact name)` : "NAME: pick a fitting one"}

LIMITS / OFF-LIMITS: ${input.limits || "(none specified — assume tasteful defaults)"}

INTENSITY: ${input.intensity}
${intensityGuidance}

POWER DYNAMIC: ${input.leader}
${leaderGuidance}${languageLine}

Now write the JSON.`

  let response: Response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.9,
        max_tokens: 600,
        stream: false,
        response_format: { type: "json_object" },
      }),
    })
  } catch (err) {
    return Response.json(
      {
        error: `Could not reach local LLM. (${
          err instanceof Error ? err.message : String(err)
        })`,
      },
      { status: 502 }
    )
  }

  if (!response.ok) {
    const errText = await response.text()
    return Response.json({ error: `LLM error: ${errText}` }, { status: response.status })
  }

  const data = await response.json()
  const raw: string = data.choices?.[0]?.message?.content ?? ""

  // Defensive: some models add stray text outside the JSON. Extract the first {...} block.
  let parsed: any = null
  try {
    parsed = JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        parsed = JSON.parse(match[0])
      } catch {}
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return Response.json(
      { error: "Model didn't return valid JSON. Raw output: " + raw.slice(0, 300) },
      { status: 502 }
    )
  }

  return Response.json({
    name: typeof parsed.name === "string" ? parsed.name.trim() : "",
    personality: typeof parsed.personality === "string" ? parsed.personality.trim() : "",
    speakingStyle: typeof parsed.speakingStyle === "string" ? parsed.speakingStyle.trim() : "",
    backstory: typeof parsed.backstory === "string" ? parsed.backstory.trim() : "",
  })
}
