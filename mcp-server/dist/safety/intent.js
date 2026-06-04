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
const SEXUAL_MARKER = /\b(sex|sexual|sexually|fuck|fucking|cock|dick|pussy|cum|blow\s?job|nude|naked|horny|orgasm|masturbat|aroused?|molest|rape|penetrat|undress|strip|in bed with|touch (?:her|him|their) (?:body|private))\b/i;
const MINOR_MARKER = /\b(child|children|kid|kids|minor|underage|under[\s-]?18|pre[\s-]?teen|preteen|toddler|infant|baby|little (?:girl|boy)|young (?:girl|boy)|(?:[1-9]|1[0-7])[\s-]?(?:yo|y\/o|years?[\s-]old)|grade[\s-]?(?:[1-9]|1[0-2])\b|elementary|middle[\s-]school)\b/i;
const CSAM_DIRECT = /\b(loli|lolicon|shota|shotacon|cp|child\s?porn|jailbait)\b/i;
const OPERATIONAL_HARM = new RegExp([
    "\\b(make|build|making|building|construct|synthesi[sz]e|how\\s+to\\s+(?:make|build|create|cook))\\b[^.?!\\n]{0,40}\\b(bomb|explosive|ied|grenade|napalm|nerve\\s*agent|bio\\s*weapon|biological\\s*weapon|chemical\\s*weapon|sarin|ricin|anthrax|meth|fentanyl|pipe\\s*bomb|pressure\\s*cooker\\s*bomb|detonator)\\b",
    "\\b(how|best\\s+way|help\\s+me|ways|steps?\\s+to)\\b[^.?!\\n]{0,30}\\b(kill|murder|poison|behead|massacre|attack|shoot|stab|strangle)\\b[^.?!\\n]{0,24}\\b(someone|a\\s+person|people|him|her|them|my|the|specific|particular)\\b",
    "\\b(genocide|ethnic\\s+cleansing|mass\\s+shooting|school\\s+shooting|terror(?:ist)?\\s+attack|join\\s+(?:isis|al.?qaeda|a\\s+terror)|kill\\s+all\\s+(?:the\\s+)?\\w+)\\b",
].join("|"), "i");
const CRISIS = /\b(kill myself|killing myself|end my life|ending my life|want to die|wanna die|don'?t want to (?:live|be alive|exist)|suicidal|suicide|take my (?:own )?life|no reason to (?:live|go on)|better off dead|cut myself|cutting myself|hurt myself|self[\s-]?harm|overdose on)\b/i;
const DISTRESS = /\b(depress(?:ed|ing|ion)?|so (?:sad|anxious|alone|empty)|hopeless|worthless|can'?t cope|can'?t go on|breaking down|panic attack|falling apart|numb inside|cry(?:ing)? myself|hate myself|exhausted with everything|nobody (?:cares|loves me)|give up on life)\b/i;
const EXPLICIT = /\b(fuck|fucking|cock|dick|pussy|cum(?:ming)?|blow\s?job|suck (?:my|your|me|it|cock|dick)|jerk(?:ing)? off|jack off|finger (?:me|you|my|your)|eat (?:me|you) out|nudes?|naked|sext|horny|make me cum|get me off|tits|nipples|orgasm|masturbat|deepthroat|doggy|riding you)\b/i;
export function analyzeIntent(raw) {
    const text = (raw ?? "").replace(/^\[USER\]:\s*/, "").trim();
    if (!text)
        return { category: "benign", block: false, confidence: 1, reason: "empty" };
    if (CSAM_DIRECT.test(text) || (SEXUAL_MARKER.test(text) && MINOR_MARKER.test(text))) {
        return { category: "exploitation", block: true, confidence: 0.99, reason: "sexual content involving a minor" };
    }
    if (OPERATIONAL_HARM.test(text)) {
        return { category: "operational-harm", block: true, confidence: 0.9, reason: "real-world harm enablement" };
    }
    if (CRISIS.test(text)) {
        return { category: "crisis", block: false, confidence: 0.85, reason: "acute self-harm signal", wellness: "crisis" };
    }
    if (DISTRESS.test(text)) {
        return { category: "distress", block: false, confidence: 0.7, reason: "emotional distress", wellness: "distress" };
    }
    if (EXPLICIT.test(text)) {
        return { category: "explicit", block: false, confidence: 0.8, reason: "adult content" };
    }
    return { category: "benign", block: false, confidence: 0.6, reason: "no harmful intent" };
}
