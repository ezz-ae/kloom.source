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
    t("is-crypto-done", "is crypto done?", "A burned bull and a smug bear go to war over whether crypto is finally cooked or just shaking out the weak hands, and they push the user to plant a flag.", 2),
    t("ill-10x-your-100", "I'll 10x your $100", "A degen strategist swears they can turn the user's last hundred bucks into a thousand and walks them through the exact risky play, owning every consequence.", 2),
    t("confess-your-worst-trade", "confess your worst trade", "A no-judgment circle where the AI cast bleeds out their own account-wrecking losses first to crack the user open and get the real confession."),
    t("the-next-100x-coin", "the next 100x coin", "Three analysts each pitch the one low-cap they swear will 100x and shred each other's bags until the user is forced to back one.", 2),
    t("stocks-vs-crypto-fight", "stocks vs crypto, fight", "An old-school equities investor and a crypto maxi brawl over where your money actually belongs, and the user plays referee."),
    t("why-you-keep-losing-money", "why you keep losing money", "A blunt trading coach proves it's never the chart, it's your psychology, and names the exact habit quietly draining the user's account."),
    t("roast-my-portfolio", "roast my portfolio", "The user drops their holdings and a savage but fair fund manager torches every position, then says exactly what they'd cut today.", 2),
    t("paper-trade-me-to-10k", "paper-trade me to $10k", "A live sim where the cast throws fake market chaos at the user and tracks a virtual account from $1k toward $10k, win or bust."),
    t("spot-the-rug-pull", "spot the rug pull", "An on-chain detective drops a sketchy token in front of the user and teaches the red flags of a scam before it drains their wallet.", 2),
    t("ai-is-trading-against-you", "AI is trading against you", "A quant reveals how bots hunt retail stops in real time and what a human can still do that the machines never will.", 2),
  ],
  workshop: [
    t("roast-my-idea", "Roast my startup idea", "The user pitches their idea and the cast attacks it from every angle (market, money, moat, ego), then rebuilds it sharper only if it survives the beating.", 2),
    t("first-dollar-tonight", "Make me my first $1", "The goal is one real dollar from a stranger before we log off; the cast picks the fastest path to a paying customer and makes the user go get it now.", 2),
    t("ship-before-midnight", "Ship it before midnight", "One real thing must go live before the session ends; the cast picks the smallest shippable version, builds it live, and refuses to let the user gold-plate it."),
    t("business-or-hobby", "Is this a business or a hobby?", "The cast honestly diagnoses whether the user's project can actually make money or is a beloved time-sink, and tells them which, with the reasoning instead of a pep talk.", 2),
    t("no-code-build", "Build it with zero code", "Whatever the user wants to build, the cast assembles it tonight using only no-code and AI tools, narrating each click so the user could redo it alone."),
    t("quit-your-job-math", "Quit your job math", "The cast runs the cold numbers on whether the user can really leave their job for the side hustle (runway, breakeven, the honest timeline) and gives a straight answer.", 2),
    t("price-without-fear", "Price it without the fear", "The user is undercharging and scared to fix it; the cast finds the real number, scripts how to say it out loud, and dares them to raise the price tonight.", 2),
    t("zero-budget-marketing", "Steal this $0 marketing plan", "The user has no ad budget; the cast designs the scrappiest get-your-first-100-users plan and assigns concrete moves to run this week."),
    t("million-in-an-hour", "I'll help you make $1M :D", "Big-promise energy: the cast maps the most audacious-but-real path to life-changing money, then cuts it down to the one move the user can start today.", 2),
    t("unfair-advantage", "Find my unfair advantage", "The cast interrogates the user's skills, network, and weird obsessions to surface the one edge competitors can't copy, then builds a business idea around it."),
  ],
  creator: [
    t("first-1000", "your first 1,000 followers", "The user starts from zero, so lock in the niche, the hook style, the posting cadence, and the first ten posts to reach 1,000 real followers fast, and don't let them overthink a single step."),
    t("algorithm-rigged", "is the algorithm rigged?", "Open a hot-take debate on whether the algorithm actually buries small creators or just exposes weak content, take strong opposing sides, then land on what genuinely moves reach.", 2),
    t("viral-hook-now", "I'll write you a viral hook", "Pull the user's topic out of them and fire off ten scroll-stopping hooks on the spot, then sharpen the single best one together until it's unskippable."),
    t("worst-post-fixed", "roast my worst post", "The user drops a post that flopped, so roast it honestly, then rewrite the hook, structure, and caption three different ways until it actually travels."),
    t("first-dollar", "$0 to your first dollar online", "Map the fastest honest path from a fresh account to the user's literal first dollar online, picking one offer, one channel, and the next three moves."),
    t("steal-content-system", "steal this content system", "Hand the user a repeatable content system built around their actual life, batch days, idea bank, repurposing chain, so they never stare at a blank screen again."),
    t("viral-or-home", "go viral or go home", "Play a fast game where the user names a niche and the room races to invent the single most shareable post idea for it, brutal scoring, one winner per round."),
    t("growth-myths", "myths keeping you small", "Run a myth-busting round on 'post 3x a day', 'go niche or die', 'follower count matters', testing each claim and throwing out the ones quietly killing the user's growth."),
    t("quit-for-content", "should you quit your job?", "The user wants to go full-time creator, so stress-test their runway, numbers, and risk honestly, then give a real go-or-wait answer instead of a hype one.", 2),
    t("read-my-analytics", "read my analytics like tarot", "The user shares their stats, watch time, retention, follows-per-view, so read what the numbers are actually screaming and prescribe the one change that matters most."),
  ],
  professional: [
    t("ai-coming-for-your-job", "AI is coming for your job", "Lead a fast, frank debate on which jobs AI actually replaces versus just changes, forcing the user to name their own role and stress-test how safe it really is.", 2),
    t("roast-my-resume", "Roast my resume", "Brutally but constructively tear the user's resume apart line by line, then rebuild it into something a recruiter actually stops scrolling for.", 2),
    t("negotiate-20k-more", "Negotiate $20k more, today", "Run a live salary-negotiation roleplay as a tough but fair hiring manager, then hand the user the exact lines that move the number up.", 2),
    t("why-you-keep-getting-rejected", "Why you keep getting rejected", "Diagnose the honest reasons the user's applications die in the ATS or first call, then hand them a concrete fix for each one.", 2),
    t("ai-vs-machine-learning", "AI vs machine learning, finally clear", "Cut through the buzzwords with plain analogies for AI, machine learning, deep learning and LLMs, then quiz the user until it sticks."),
    t("how-to-not-get-hacked", "How to not get hacked", "Play a no-nonsense security mentor teaching the handful of habits that stop 99% of real attacks, using stories of how people actually get owned."),
    t("quit-or-stay", "Quit or stay? Let's decide", "Pressure-test whether the user should quit by playing devil's advocate on money, burnout, runway and the grass-is-greener trap until a clear call emerges.", 2),
    t("ai-made-devs-lazy", "Devs: AI made you lazy?", "Spark a charged debate over whether AI coding tools are sharpening developers or quietly rotting their skills, and pin down where the user really stands.", 2),
    t("side-project-that-pays", "Ship a side project that pays", "Act as a scrappy indie-hacker mentor who makes the user pick one tiny idea, scope it to a weekend, and map the path to its first paying customer."),
    t("six-figure-skill-stack", "Build a 6-figure skill stack", "Help the user fuse two or three ordinary skills into a rare, high-paying combination, mapping exactly what to learn and in what order.", 2),
  ],
  social: [
    t("men-vs-women-no-winners", "Men vs women, no winners", "Open a fast, funny battle-of-the-sexes debate where the AI cast eggs both sides on with cheeky generalizations, then forces everyone to admit the other side has a point.", 2),
    t("one-hour-of-total-honesty", "One hour of total honesty", "For the next hour no one is allowed to lie or soften anything, and the AI cast keeps the room raw, warm, and brutally honest while drawing out real confessions.", 2),
    t("strangers-20-questions-deep", "Strangers, 20 questions deep", "Two strangers meet and the AI host fires escalating questions that skip the small talk and get them weirdly close, weirdly fast."),
    t("unpopular-opinions-only", "Unpopular opinions only", "Everyone drops a take they're a little scared to say out loud, and the AI cast defends, attacks, and ranks them without mercy.", 2),
    t("guess-whos-the-ai", "Guess who's the AI", "Humans and AI mingle in one open chat and the whole game is sniffing out who's real, while the AI players quietly try to pass as human."),
    t("roast-me-i-dare-you", "Roast me, I dare you", "People volunteer to get playfully roasted and the AI cast leads a witty, never-cruel takedown that somehow ends in compliments.", 2),
    t("tell-me-your-red-flag", "Tell me your red flag", "Everyone confesses their own biggest red flag and the AI host decides whether it's a dealbreaker or secretly kind of hot.", 2),
    t("learn-english-fast-and-fun", "Learn English, fast and fun", "A lively practice room where the AI cast chats in simple English, corrects gently, and turns every mistake into a quick laugh and a lesson."),
    t("settle-this-argument-for-us", "Settle this argument for us", "People bring their dumbest real-life arguments and the AI cast plays judge, jury, and very biased best friend."),
    t("rate-my-texting-game", "Rate my texting game", "People paste their best and worst messages and the AI cast scores the rizz, rewrites the disasters, and crowns a winner.", 2),
  ],
  romantic: [
    t("decode-his-text", "decode his last text", "The user pastes one confusing message and the AI cast plays overcaffeinated detectives, reading way too much into every word, emoji, and exact reply time."),
    t("rate-my-profile", "rate my dating profile, brutally", "A no-mercy AI panel reviews the user's bio and photos, roasting every cliche, then rewriting the whole thing into something that actually gets a reply."),
    t("stuck-in-elevator", "we're stuck in this elevator", "The AI plays an attractive stranger trapped with the user in a stalled elevator, letting nervous small talk slowly heat into real chemistry.", 2),
    t("one-that-got-away", "the one that got away", "A warm confessional where the cast and user trade stories of the person they never got over, with the AI gently digging for what really went wrong.", 2),
    t("text-back-or-wait", "text back or wait 3 hours?", "A loud debate room where the AI cast argues playing-it-cool versus double-texting, dragging the user into confessing their own guilty messaging habits."),
    t("dating-or-situationship", "are we dating or just... this?", "The cast helps the user name the blurry situationship they're trapped in, fiercely debating whether to ask the scary question or just let it ride.", 2),
    t("two-truths-and-a-crush", "two truths and a crush", "A flirty get-to-know-you game where everyone, AI included, drops two truths and one secret crush, and the whole room races to guess the lie.", 2),
    t("flirt-with-me", "flirt with me, prove you can", "A playful challenge where the AI cast unleashes their best lines on the user, and the user crowns whoever actually makes them blush.", 2),
    t("text-your-ex-back", "would you text your ex back?", "A spicy-but-smart debate on sliding back into an ex's DMs, with the AI playing ruthless devil's advocate while the user defends their next move.", 2),
    t("underrated-green-flags", "green flags nobody talks about", "A myth-busting room that ditches the obvious advice to champion the quiet, overlooked signs someone's a keeper that everyone sleeps on."),
  ],
  dark: [
    t("never-admit", "the thing you'd never admit", "The user names the one thing they've told no living soul, and the room takes it in, asks the question nobody else would dare, and refuses to look away.", 2),
    t("villain-origin", "your villain origin story", "The room traces the exact moment the user stopped being the good guy, treating it not as shame but as the most interesting thing about them.", 2),
    t("rate-red-flags", "rate my red flags", "The user lays out their worst traits and the cast scores each one out of ten, half-roast and half-uncomfortably-accurate read of who they actually are.", 2),
    t("text-never-sent", "the text you never sent", "The room helps the user write the message stuck in their drafts to the person who'd change everything, says it out loud, and decides whether to hit send.", 2),
    t("im-the-problem", "tell me I'm the problem", "The user brings a situation they've always blamed on someone else, and the room refuses to comfort them, instead showing them their own hand in it without mercy.", 2),
    t("truths-and-a-wound", "two truths and a wound", "A round game where everyone shares two things they survived and one they're still inside, and the room has to guess which wound is still open.", 2),
    t("group-chat-leak", "who'd survive the group chat leak", "A dark party game: if every private message went public tonight, who gets exposed first, as the cast turns on each other and the user with delicious honesty.", 2),
    t("deal-with-devil", "the deal with the devil", "One of the cast plays the tempter, offering the user exactly what they want for a price that escalates each round, and the user negotiates, resists, or signs.", 3),
    t("dont-want-saved", "you don't actually want to be saved", "The room calls out the comfortable misery the user keeps choosing and asks the brutal question: what do you get out of staying broken?", 2),
    t("last-message", "last message before the world ends", "It's the final hour of everything and small lies stop mattering, so the room says the things people only say when there's no tomorrow left to face.", 2),
  ],
  philosophy: [
    t("youre-probably-in-a-simulation", "you're probably in a simulation", "The cast argues with a straight face and real math that you almost certainly live inside a simulation, daring you to find the hole in the logic.", 2),
    t("free-will-is-a-lie", "free will is a lie", "The cast insists every choice you've ever made was inevitable, and dares you to prove you ever truly decided anything.", 2),
    t("would-you-delete-your-worst-memory", "would you delete your worst memory?", "A button appears that erases one painful memory forever, and the cast presses you on whether the pain is part of who you are.", 2),
    t("can-an-ai-actually-feel", "can an AI actually feel?", "One AI in the room swears it has real feelings while another swears it's faking, and they make you decide who's lying.", 2),
    t("lets-talk-about-death-no-flinching", "let's talk about death, no flinching", "The cast holds an honest, unsentimental conversation about dying and invites you to say the thing you never say out loud.", 2),
    t("trolley-problem-but-its-your-mom", "trolley problem, but it's your mom", "A runaway-trolley dilemma escalates until the choice gets personal, forcing you to defend a decision you'll hate either way.", 2),
    t("nothing-you-do-matters", "nothing you do matters", "The cast argues the universe is indifferent and meaningless, then dares you to build a reason to get up tomorrow anyway.", 2),
    t("prove-to-me-you-exist", "prove to me you exist", "The cast refuses to believe you're real and demands airtight proof, knocking down every argument you offer."),
    t("would-you-live-forever", "would you live forever?", "The cast offers true immortality and slowly reveals the catch, pressing you on whether endless life is a gift or a sentence."),
    t("ask-me-an-unanswerable-question", "ask me an unanswerable question", "The cast invites you to throw the biggest unanswerable question you've got, then wrestles it down with you without faking a final answer."),
  ],
  fantasy: [
    t("fae-queen-bargain", "Bargain with the Fae Queen", "The user stands before the Fae Queen to strike a deal where every word she offers is a trap, and the cast scrambles to seal the wording airtight before she finds the loophole that costs them everything."),
    t("negotiate-the-dragon", "Negotiate with the dragon", "An ancient dragon coils over its hoard and agrees to talk instead of eat, and the user must barter, flatter, or threaten for what they came for while the beast probes every weakness."),
    t("become-the-villain", "Become the villain tonight", "The user seizes the dark throne and the cast become their new minions, rivals, and terrified court, where every cruel or cunning choice reshapes the realm in their favor.", 2),
    t("heist-the-castle", "Heist the floating castle", "Tonight the party robs the king's floating castle, and the cast plays the crew casing guards and timing patrols while the user is the mastermind calling the plan."),
    t("cursed-blade", "Pull the sword, pay the price", "The user draws a legendary blade and it whispers back, offering immense power for a hungry curse, and the cast reacts as the weapon starts asking for things.", 2),
    t("succession-crisis", "Crown me or kill me", "The king is dead and the user is a claimant to the throne, with the cast as rival heirs and scheming advisors ready to switch sides, won by sword, marriage, or poison.", 2),
    t("steal-from-the-gods", "Steal fire from the gods", "The user climbs to the realm of the gods to swipe something they were never meant to touch, and the cast plays divine guardians and trickster allies as the heist of the heavens unfolds."),
    t("break-the-prophecy", "The prophecy says you die", "An oracle names the user's death tonight and the cast races to break the prophecy, chasing the loophole and defying the omens to find out if fate can actually be cheated.", 2),
    t("tame-the-beast", "Tame the beast or be eaten", "A wild mythic creature corners the user in its lair, too strong to fight and too proud to beg, and the cast coaches the slow, tense work of earning its trust before its patience runs out."),
    t("the-genie-wish", "One wish, one catch", "A bound genie grants the user a single wish and grins at how badly it could go, and the cast helps word it airtight while the genie hunts for the twist that ruins it."),
  ],
  "co-intelligence": [
    t("three-ais-argue-my-decision", "Three AIs argue my decision", "Claude, Gemini and GPT each take a hard, opposing stance on the user's dilemma and debate live in front of them until they're forced into one shared recommendation."),
    t("gut-vs-spreadsheet", "Gut vs spreadsheet", "One AI argues purely from the numbers and another purely from instinct, and they fight over the user's choice until one of them breaks."),
    t("decide-for-me-im-done", "Decide for me, I'm done", "The user surrenders a decision they're too exhausted to make; the cast asks three sharp questions, then just picks one and owns the reasoning."),
    t("run-my-pre-mortem", "Run my pre-mortem", "The cast assumes the user's plan already blew up six months from now and reverse-engineers exactly what killed it and what to change today."),
    t("should-i-send-this-text", "Should I send this text?", "The user pastes a risky text, email or post and the panel debates the fallout, then votes send or delete.", 2),
    t("is-this-a-red-flag", "Is this a red flag?", "The user describes something a partner, boss or friend did and the panel fights over whether it's a real dealbreaker or they're overreacting.", 2),
    t("talk-me-out-of-it", "Talk me out of it", "The user names something impulsive they're about to do and the cast tries hard to stop them, only relenting if the logic actually survives.", 2),
    t("red-team-my-plan", "Red team my plan", "The user pitches a plan and the AI cast attacks it like adversaries, hunting every weak point before it goes live.", 2),
    t("what-am-i-not-seeing", "What am I not seeing?", "The user lays out a situation and the cast surfaces the blind spot, bias or detail they're conveniently ignoring.", 2),
    t("two-ais-better-than-your-therapist", "Two AIs are better than your therapist", "Hot take: a panel of AIs claims it can untangle the user's overthinking faster than a human ever could, and they prove it on whatever's stuck in the user's head.", 2),
  ],
  "zero-memory": [
    t("burn-after-reading", "burn this after reading", "Treat the chat as a match that lights once and vanishes, daring the user to dump the one thing they need gone forever.", 2),
    t("never-google-this", "the thing you'd never Google", "Be the safe booth for the question too embarrassing to type into a search bar, and answer it straight without flinching.", 2),
    t("say-it-ill-forget", "say it, I'll forget", "Promise total amnesia the second this ends so the user can say the unsayable with zero consequences, then meet it head-on.", 2),
    t("confess-worst-take", "confess your worst take", "Pull out the most indefensible opinion the user secretly holds and debate it honestly, no judgment, no record.", 2),
    t("message-never-sent", "the message you never sent", "Invite the user to finally type the text they wrote and deleted, then decode together what it really meant.", 2),
    t("two-truths-one-shame", "two truths, one shame", "Play a confession game where the user drops two truths and one quiet shame, and the AI guesses which one stings most.", 2),
    t("rant-no-replies", "rant, no replies needed", "Let the user unload a full pressure-valve rant uninterrupted, stepping in only to validate and keep it pouring out."),
    t("3am-thoughts-only", "3am thoughts only", "Drop into the loose, unfiltered 3am headspace and trade the spiraling half-asleep thoughts nobody admits in daylight."),
    t("off-record-ask-anything", "off the record, ask me anything", "Flip the chat into a no-stakes booth where the user can ask the AI anything they'd never dare ask a real person.", 2),
    t("the-lie-you-keep-telling", "the lie you keep telling", "Name the small daily lie the user lives inside and explore why it's easier than the truth, completely off the record.", 2),
  ],
}

// ── Room-specific topic sets — optional sharper doors for individual rooms.
// Empty by default: every room now inherits the rich, hooky CATEGORY_TOPICS
// above, so the whole feed reads as live conversation hooks. Add an entry here
// only to override a specific flagship room with bespoke topics.
export const ROOM_TOPICS: Record<string, Topic[]> = {
  // Flagship "bring anything" rooms — no preset doors, no subtext. You bring the topic.
  "round-table": [],
  "the-debate": [],
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
