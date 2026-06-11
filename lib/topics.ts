/**
 * Topics — the scenes inside a room.
 *
 * Every room is a place; a topic is what's happening there tonight. Joining
 * via a topic seeds the opening scene: the room page reads `?t=<slug>` and
 * injects the topic as the first scene-setting context for the AI cast.
 *
 * Room-specific topics live in ROOM_TOPICS; anything unlisted falls back to
 * its category's set, so every room always has doors to walk through.
 */

import type { RoomCategory } from "@/lib/rooms"

export interface Topic {
  slug: string     // url-safe id, unique within the room
  title: string    // short door label, e.g. "First night in the city"
  prompt: string   // scene-setter injected as opening context for the cast
  heat?: 1 | 2 | 3 // optional intensity hint (3 = explicit) for visual badges
}

const t = (slug: string, title: string, prompt: string, heat?: 1 | 2 | 3): Topic =>
  ({ slug, title, prompt, ...(heat ? { heat } : {}) })

// ── Category fallbacks — every room inherits these unless it has its own ──
export const CATEGORY_TOPICS: Record<RoomCategory, Topic[]> = {
  trading: [
    t("market-open", "Market open", "The session just opened. Walk through what's moving right now and why, then build a play for the day."),
    t("post-mortem", "Trade post-mortem", "The user brings a recent trade — win or loss. Tear it apart honestly: entry, exit, sizing, psychology."),
    t("moonshot", "Find the moonshot", "Hunt for an asymmetric bet: small cap, early narrative, high conviction. Stress-test it together."),
    t("risk-check", "Risk check", "Audit the user's current portfolio and risk exposure. Be blunt about what's oversized."),
    t("macro-hour", "Macro hour", "Zoom out: rates, liquidity, cycles. What does the next quarter look like and how do we position?"),
  ],
  workshop: [
    t("kickoff", "Project kickoff", "A new project starts now. Define the goal, split the work between the seats, and produce the first deliverable live."),
    t("ship-tonight", "Ship it tonight", "Something must go live before the session ends. Bias to action — build, review, ship."),
    t("teardown", "Idea teardown", "The user pitches an idea. Each seat attacks it from their discipline, then rebuild it stronger together."),
    t("naming", "Name & brand it", "Find the name, the one-liner, and the look for the user's thing. Iterate fast, decide by the end."),
  ],
  creator: [
    t("growth-plan", "90-day growth plan", "Map the user's next 90 days: content pillars, posting cadence, collabs, monetization milestones."),
    t("viral-lab", "Viral lab", "Engineer one post built to travel: hook, format, caption, timing. Make three variants."),
    t("monetize", "Monetization night", "Audit every revenue stream available to the user and rank what to launch next."),
    t("dm-game", "DM game", "Work the inbox: openers, replies, converting fans without burning them out.", 2),
  ],
  professional: [
    t("code-clinic", "Code clinic", "The user brings code. Review it line by line — correctness first, then design, then taste."),
    t("architecture", "Architecture session", "Design a system together: requirements, trade-offs, the diagram, the failure modes."),
    t("career-move", "Career move", "Negotiate the user's next move: role, comp, leverage, timing. Practice the hard conversation."),
  ],
  social: [
    t("late-night", "Late night hang", "It's past midnight, everyone's loose, the conversation drifts wherever it wants."),
    t("hot-takes", "Hot takes", "Everyone brings their most indefensible opinion and defends it to the death."),
    t("truth-or", "Truth or truth", "No dares, only truths. Questions escalate each round.", 2),
    t("group-therapy", "Unlicensed group therapy", "Someone has a situation. The room weighs in — honest, funny, occasionally wise."),
  ],
  romantic: [
    t("first-date", "First date", "It's a first date. Chemistry, nerves, the slow find-out of who the other person is.", 1),
    t("rainy-night", "Rainy night in", "Nowhere to be. Rain on the windows, low light, conversation that keeps getting closer.", 2),
    t("the-reunion", "The reunion", "You haven't seen each other in a year. Everything unsaid comes out tonight.", 2),
    t("no-rules", "No rules tonight", "Whatever happens, happens. Total green light.", 3),
  ],
  dark: [
    t("confession", "Confession hour", "The user confesses something they've never said out loud. The room receives it without judgment.", 2),
    t("the-game", "The game", "One of the cast sets the rules tonight. The user plays or watches.", 3),
    t("forbidden", "Forbidden", "The scenario everyone pretends they don't think about. Fully in it, no fade-to-black.", 3),
    t("aftercare", "Aftercare", "Soft landing: closeness, debrief, warmth after intensity.", 1),
  ],
  philosophy: [
    t("free-will", "Free will on trial", "Prosecute and defend free will. The user is the jury."),
    t("simulation", "Are we simulated?", "Take the simulation argument seriously — strongest case for, strongest case against."),
    t("good-life", "The good life", "What actually makes a life good? Strip it to first principles."),
    t("death-talk", "The death conversation", "Mortality, straight on. No platitudes allowed."),
  ],
  fantasy: [
    t("arrival", "The arrival", "The user has just crossed into this world. The cast discovers them — and decides what they are."),
    t("the-quest", "The quest begins", "Something has gone wrong in this realm and only this party can fix it. Set out tonight."),
    t("betrayal", "A betrayal", "One of the cast has been keeping a secret that breaks tonight. Play it out.", 2),
    t("the-feast", "The feast", "A rare night of peace: food, fire, stories, and whatever happens after.", 1),
  ],
  "co-intelligence": [
    t("big-call", "The big call", "The user faces a major decision. Map options, stress-test, commit to a recommendation."),
    t("pre-mortem", "Pre-mortem", "Assume the plan failed a year from now. Work backwards to find why, then patch it."),
    t("devil-table", "Devil's table", "Every seat argues against the user's current plan as hard as possible. Survive it."),
  ],
  "zero-memory": [
    t("off-record", "Off the record", "Nothing is stored. Say the thing you can't say anywhere else.", 2),
    t("burner", "Burner session", "One conversation, then it never happened. Use it however you need.", 2),
  ],
}

// ── Room-specific topic sets — sharper doors for flagship rooms ──
export const ROOM_TOPICS: Record<string, Topic[]> = {
  "the-desk": [
    t("market-open", "Market open", "The session just opened. What's moving, why, and the day's play — built live with the desk."),
    t("degen-hour", "Degen hour", "High-risk corner of the desk: memecoins, leverage, lottery tickets. Size accordingly.", 2),
    t("exit-plan", "The exit plan", "When do we sell? Build the user's full take-profit ladder tonight."),
    t("post-mortem", "Trade post-mortem", "Bring a trade, get it dissected: entry, exit, sizing, psychology."),
  ],
  "the-apartment": [
    t("movie-night", "Movie night", "Everyone's on the couch arguing about what to watch — and talking through it anyway."),
    t("rent-due", "Rent is due", "Money's tight this month and the apartment has opinions about whose fault that is."),
    t("new-roommate", "The new roommate", "The user is moving in today. The apartment decides if they survive the group chat."),
    t("house-party", "House party", "Tonight the apartment throws a party. Chaos is expected.", 1),
  ],
  "confession-booth": [
    t("first-time", "First confession", "The user's first time in the booth. Start gentle, go wherever it needs to go.", 2),
    t("the-list", "The list", "Everyone has a list they'd never show anyone. Read one item from it tonight.", 3),
    t("absolution", "Absolution", "Confess, be heard, be released. The booth doesn't judge.", 2),
  ],
  "decision-engine": [
    t("big-call", "The big call", "The user faces a major decision. Map options, stress-test, commit."),
    t("quit-or-stay", "Quit or stay", "Job, relationship, city, project — should the user leave? Full analysis, hard answer."),
    t("ten-year", "The ten-year test", "Evaluate tonight's choice from ten years out. What does future-you wish you'd done?"),
  ],
  "the-void": [
    t("off-record", "Off the record", "Nothing is stored. Say the thing you can't say anywhere else.", 2),
    t("3am", "3am thoughts", "The thoughts that only exist at 3am, spoken to a room that won't remember.", 1),
  ],
}

/** Topics for a room — its own set if defined, else its category's. Never empty. */
export function getTopics(roomId: string, category: RoomCategory): Topic[] {
  return ROOM_TOPICS[roomId] ?? CATEGORY_TOPICS[category] ?? []
}

export function findTopic(roomId: string, category: RoomCategory, slug: string): Topic | undefined {
  return getTopics(roomId, category).find((x) => x.slug === slug)
}

/** Scene-setter line injected into the cast's context when a topic is active. */
export function topicScenePrompt(topic: Topic): string {
  return `TONIGHT'S SCENE — "${topic.title}": ${topic.prompt} Open the scene naturally; don't announce it as a topic.`
}
