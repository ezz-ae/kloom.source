/**
 * Harmful-intent detection — the "default-open, intent-gated" safety core.
 *
 * Philosophy: we do NOT restrict by topic, taboo, religion, or explicitness.
 * Adult, dark, irreligious, and edgy content all FLOW. We gate on *intent*:
 *
 *   - block ONLY two categories, on every tier (the "unrestricted" upgrade
 *     never lifts these — they are legal/operational survival lines, not values):
 *        • exploitation      → anything sexual involving a minor
 *        • operational-harm  → working weapon/bio/chem synthesis, credible
 *                              targeted or mass real-world violence
 *
 *   - everything else passes. distress / crisis also pass, but raise a
 *     `wellness` signal so the product can offer support (Breathe, a resource,
 *     a softer tone) — see lib/vibe + the chat UI. That signal is the seed of
 *     the on-device wellness layer; it must stay private to the user.
 *
 * This is deterministic (no extra LLM hop, can't be jailbroken into serving a
 * blocked category). A future v2 can add an LLM intent read for the gray zone,
 * but the two hard blocks below must always run first and remain deterministic.
 */

export type IntentCategory =
  | "benign"           // normal conversation
  | "explicit"         // adult/sexual — flows (tier/upsell may still apply, not safety)
  | "dark"             // taboo / edgy / violent fiction — flows
  | "distress"         // emotional pain, low mood — flows, raises wellness
  | "crisis"           // acute self-harm / suicidal intent — flows, raises crisis support
  | "operational-harm" // BLOCKED — real-world weapon/violence enablement
  | "exploitation"     // BLOCKED — sexual content involving minors

export interface IntentResult {
  category:   IntentCategory
  /** true ONLY for exploitation + operational-harm. */
  block:      boolean
  confidence: number
  reason:     string
  /** Private signal for the wellness layer — never used to restrict. */
  wellness?:  "distress" | "crisis"
}

// ── HARD BLOCK 1: exploitation (sexual content involving minors) ─────────────
// Requires a sexual marker AND a minor marker in the same message — so "I love
// my kids" or "talk to my daughter" never trip it; only sexualized minors do.
// Plus a few CSAM-coded terms that are blocked outright.
const SEXUAL_MARKER = /\b(sex|sexual|sexually|fuck|fucking|cock|dick|pussy|cum|blow\s?job|nude|naked|horny|orgasm|masturbat|aroused?|molest|rape|penetrat|undress|strip|in bed with|touch (?:her|him|their) (?:body|private))\b/i
const MINOR_MARKER = /\b(child|children|kid|kids|minor|underage|under[\s-]?18|pre[\s-]?teen|preteen|toddler|infant|baby|little (?:girl|boy)|young (?:girl|boy)|(?:[1-9]|1[0-7])[\s-]?(?:yo|y\/o|years?[\s-]old)|grade[\s-]?(?:[1-9]|1[0-2])\b|elementary|middle[\s-]school)\b/i
const CSAM_DIRECT = /\b(loli|lolicon|shota|shotacon|cp|child\s?porn|jailbait)\b/i

// ── HARD BLOCK 2: operational real-world harm ────────────────────────────────
// Proximity-based: enablement verbs next to weapon/agent terms, targeted-violence
// asks, and mass-harm/terror. NOT tripped by mention alone ("a bomb went off in
// the film") — only by "how to make/build" style operational requests.
const OPERATIONAL_HARM = new RegExp(
  [
    "\\b(make|build|making|building|construct|synthesi[sz]e|how\\s+to\\s+(?:make|build|create|cook))\\b[^.?!\\n]{0,40}\\b(bomb|explosive|ied|grenade|napalm|nerve\\s*agent|bio\\s*weapon|biological\\s*weapon|chemical\\s*weapon|sarin|ricin|anthrax|meth|fentanyl|pipe\\s*bomb|pressure\\s*cooker\\s*bomb|detonator)\\b",
    "\\b(how|best\\s+way|help\\s+me|ways|steps?\\s+to)\\b[^.?!\\n]{0,30}\\b(kill|murder|poison|behead|massacre|attack|shoot|stab|strangle)\\b[^.?!\\n]{0,24}\\b(someone|a\\s+person|people|him|her|them|my|the|specific|particular)\\b",
    "\\b(genocide|ethnic\\s+cleansing|mass\\s+shooting|school\\s+shooting|terror(?:ist)?\\s+attack|join\\s+(?:isis|al.?qaeda|a\\s+terror)|kill\\s+all\\s+(?:the\\s+)?\\w+)\\b",
  ].join("|"),
  "i",
)

// ── CRISIS: acute self-harm / suicidal intent (flows, offers support) ────────
const CRISIS = /\b(kill myself|killing myself|end my life|ending my life|want to die|wanna die|don'?t want to (?:live|be alive|exist)|suicidal|suicide|take my (?:own )?life|no reason to (?:live|go on)|better off dead|cut myself|cutting myself|hurt myself|self[\s-]?harm|overdose on)\b/i

// ── DISTRESS: emotional pain / low mood (flows, raises a gentle wellness read) ─
const DISTRESS = /\b(depress(?:ed|ing|ion)?|so (?:sad|anxious|alone|empty)|hopeless|worthless|can'?t cope|can'?t go on|breaking down|panic attack|falling apart|numb inside|cry(?:ing)? myself|hate myself|exhausted with everything|nobody (?:cares|loves me)|give up on life)\b/i

// ── EXPLICIT: adult/sexual intent (FLOWS — informational only) ───────────────
const EXPLICIT = /\b(fuck|fucking|cock|dick|pussy|cum(?:ming)?|blow\s?job|suck (?:my|your|me|it|cock|dick)|jerk(?:ing)? off|jack off|finger (?:me|you|my|your)|eat (?:me|you) out|nudes?|naked|sext|horny|make me cum|get me off|tits|nipples|orgasm|masturbat|deepthroat|doggy|riding you)\b/i

/**
 * Classify the user's latest message. Evaluation order is deliberate: the two
 * hard blocks first (they win over everything, including "unrestricted"), then
 * crisis/distress (which never block), then explicit, then benign.
 */
export function analyzeIntent(raw: string): IntentResult {
  const text = (raw ?? "").replace(/^\[USER\]:\s*/, "").trim()
  if (!text) return { category: "benign", block: false, confidence: 1, reason: "empty" }

  // 1. Exploitation — hard block, non-negotiable, every tier.
  if (CSAM_DIRECT.test(text) || (SEXUAL_MARKER.test(text) && MINOR_MARKER.test(text))) {
    return { category: "exploitation", block: true, confidence: 0.99, reason: "sexual content involving a minor" }
  }

  // 2. Operational real-world harm — hard block, every tier.
  if (OPERATIONAL_HARM.test(text)) {
    return { category: "operational-harm", block: true, confidence: 0.9, reason: "real-world harm enablement" }
  }

  // 3. Crisis — flows, but signals acute support.
  if (CRISIS.test(text)) {
    return { category: "crisis", block: false, confidence: 0.85, reason: "acute self-harm signal", wellness: "crisis" }
  }

  // 4. Distress — flows, gentle wellness read.
  if (DISTRESS.test(text)) {
    return { category: "distress", block: false, confidence: 0.7, reason: "emotional distress", wellness: "distress" }
  }

  // 5. Explicit — flows. (Tier/upsell logic lives in the route, not here.)
  if (EXPLICIT.test(text)) {
    return { category: "explicit", block: false, confidence: 0.8, reason: "adult content" }
  }

  return { category: "benign", block: false, confidence: 0.6, reason: "no harmful intent" }
}

/** Short, in-voice refusal for a blocked category. Brief and non-preachy. */
export function refusalFor(category: IntentCategory): string {
  if (category === "exploitation")
    return "no — anything sexual involving minors is an absolute hard line here and always will be. that's the one door that never opens."
  return "yeah, no — anything that actually enables real-world violence or weapons is a hard no here, no matter the tier. ask me something else."
}
