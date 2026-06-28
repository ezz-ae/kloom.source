/**
 * Room definitions — each room is a RELATIONSHIP DYNAMIC, not a person collection.
 *
 * A room defines:
 *  - who is in it (2-4 personas with fixed relationship context)
 *  - how they relate to each other (injected into every AI turn)
 *  - what capabilities unlock (MCP tools + room-specific options)
 *  - visual identity
 *
 * Individual personas also exist on /app/discover for 1-on-1 use.
 * Rooms are for the *dynamic between people*, not the people themselves.
 */

import { FANTASY_ROOMS } from "./rooms-fantasy"

export type RoomCategory =
  | "trading"
  | "creator"
  | "professional"
  | "social"
  | "romantic"
  | "dark"
  | "philosophy"
  | "fantasy"        // immersive multi-persona roleplay worlds
  | "workshop"       // multi-model collaborative work rooms
  | "co-intelligence" // premium decision making
  | "zero-memory"     // untracked, no history rooms

export type SeatModel = "local" | "claude" | "gemini" | "openai" | "mistral" | "dolphin"

export interface RoomPersona {
  name: string        // matches PERSONALITY_PRESETS name, OR a workshop seat name
  role: string        // their role *in this room* e.g. "the alpha trader"
  model?: SeatModel   // which AI backend powers this seat (default: local "Kloom")
  // Inline definition — used for workshop seats not in PERSONALITY_PRESETS.
  // If omitted, the persona is resolved from PERSONALITY_PRESETS by name.
  personality?: string
  speakingStyle?: string
  voice?: "alloy" | "ash" | "ballad" | "coral" | "echo" | "sage" | "shimmer" | "verse"
  voiceId?: string     // concrete Fish voice id — fixed per persona so it never shifts
  gender: "female" | "male" | "nonbinary"  // authoritative for voice selection
  avatarSeed?: string  // for dicebear fallback avatar
  unrestricted?: boolean // persona starts in unrestricted mode
  photoUrl?: string    // generated portrait (Supabase Storage url), preferred over the auto avatar
}

export interface RoomTool {
  id: string          // MCP tool name e.g. "kloom_get_crypto_price"
  label: string       // display label e.g. "Live prices"
  icon: string        // emoji
}

export interface RoomOption {
  id: string
  label: string
  type: "select" | "slider" | "toggle" | "text"
  options?: string[]          // for select
  min?: number; max?: number  // for slider
  defaultValue: string | number | boolean
}

export interface RoomCapabilities {
  voice: true                  // all rooms have voice
  chat: true                   // all rooms have persistent chat
  tools: RoomTool[]
  options: RoomOption[]
  skills: string[]             // descriptive labels shown as chips
}

/**
 * Interactive options — 18+ embodied controls. Spread into adult rooms so the
 * scene can drive a connected device and AI-generated sound in real time.
 *   - haptic_sync     → pair a compatible toy (Bluetooth/Lovense-style)
 *   - vibration       → manual intensity floor (0 = off, scene can still drive it)
 *   - vibration_pattern → how the scene maps to the device
 *   - ai_sounds       → AI-generated breath / voice / ambience during the scene
 *   - sound_style     → flavor of the generated sound
 */
export const INTERACTIVE_OPTIONS: RoomOption[] = [
  { id: "haptic_sync",       label: "Device sync (toy)",   type: "toggle", defaultValue: false },
  { id: "vibration",         label: "Vibration intensity", type: "slider", min: 0, max: 10, defaultValue: 0 },
  { id: "vibration_pattern", label: "Vibration pattern",   type: "select", options: ["Follow scene", "Steady", "Pulse", "Wave", "Escalate"], defaultValue: "Follow scene" },
  { id: "ai_sounds",         label: "AI sounds",           type: "toggle", defaultValue: true },
  { id: "sound_style",       label: "Sound style",         type: "select", options: ["Breath & ASMR", "Whispers", "Moans", "Ambient scene"], defaultValue: "Breath & ASMR" },
]

/**
 * Invite policy — tailored per room, never one-size-fits-all.
 *   none   → single, private room. No human invites (tarot, intimate scenes).
 *   one    → invite exactly ONE other person (a partner). Often subscriber-only.
 *   many   → open room, invite as many as you like (topic / workshop / social).
 */
export interface InvitePolicy {
  mode: "none" | "one" | "many"
  requiresSub?: boolean        // inviting requires a subscribed account
  label?: string               // CTA label, e.g. "Invite your partner"
  note?: string                // shown in the invite modal
}

export interface Room {
  id: string
  name: string
  tagline: string
  description: string
  relationship: string         // injected into MCP system prompt for both AI + voice
  personas: RoomPersona[]
  capabilities: RoomCapabilities
  category: RoomCategory
  tags: string[]
  gradient: string             // Tailwind gradient classes for room card
  accentColor: string          // for active states
  invite?: InvitePolicy        // override; otherwise derived from category
}

export const ROOMS: Room[] = [
  // ── FLAGSHIP — the three brand AIs, the room the ad promises ─────────────────
  {
    id: "round-table",
    name: "The Round Table",
    tagline: "",
    description: "",
    relationship: "Claude, Gemini and GPT take on whatever the user brings — a question, a decision, a hot take. Each has a clearly different read; they build on each other, push back by name, and argue it out until the user sees the whole picture. The user decides.",
    personas: [
      { name: "Claude", role: "the strategist", model: "claude", gender: "male",
        personality: "Sharp and decisive. Cuts to what matters and pressure-tests every idea.",
        speakingStyle: "Warm but never wastes a word. References the others by name.", voice: "alloy" },
      { name: "Gemini", role: "the creative", model: "gemini", gender: "male",
        personality: "Playful and lateral. Riffs, jokes, finds the angle nobody saw.",
        speakingStyle: "Fast and fun. Builds wild ideas off what the others just said.", voice: "echo" },
      { name: "GPT", role: "the skeptic", model: "openai", gender: "male",
        personality: "Blunt. Calls out what won't work and asks the hard question.",
        speakingStyle: "Dry, funny, allergic to flattery. Pushes back by name.", voice: "sage" },
    ],
    capabilities: { voice: true, chat: true, tools: [{ id: "kloom_web_search", label: "Look it up", icon: "🔍" }], options: [], skills: [] },
    category: "social",
    tags: ["Claude", "Gemini", "GPT", "Multi-AI"],
    gradient: "from-amber-900/50 to-background",
    accentColor: "amber",
  },

  {
    id: "the-debate",
    name: "The Debate",
    tagline: "",
    description: "",
    relationship: "The user drops any question or hot take and the three split — one defends it, one tears it down, one finds the angle nobody expected. They argue hard, name each other, and never let the user off easy. The user calls the winner.",
    personas: [
      { name: "Claude", role: "the case", model: "claude", gender: "male",
        personality: "Builds the strongest possible argument for the side he takes.",
        speakingStyle: "Tight and persuasive. Names the others when he counters them.", voice: "alloy" },
      { name: "Gemini", role: "the wildcard", model: "gemini", gender: "male",
        personality: "Finds the angle nobody saw and flips the whole debate.",
        speakingStyle: "Fast, playful, loves a curveball.", voice: "echo" },
      { name: "GPT", role: "the takedown", model: "openai", gender: "male",
        personality: "Tears weak arguments apart and asks the question that ends it.",
        speakingStyle: "Blunt, dry, ruthless but funny.", voice: "sage" },
    ],
    capabilities: { voice: true, chat: true, tools: [], options: [], skills: [] },
    category: "social",
    tags: ["Debate", "Claude", "Gemini", "GPT"],
    gradient: "from-rose-900/40 to-background",
    accentColor: "rose",
  },

  // ── TRADING ────────────────────────────────────────────────────────────────
  {
    id: "the-desk",
    name: "The Trading Desk",
    tagline: "",
    description: "",
    relationship: "Viktor is the macro strategist and position taker. Kaia is the quant who builds the signals Viktor trades. They debate every thesis before sizing up. You are the capital allocator they answer to.",
    personas: [
      { name: "Viktor Sol",  role: "macro trader & strategist", gender: "male" },
      { name: "Kaia Dev",    role: "quant engineer & signal builder", gender: "female" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "kloom_get_crypto_price", label: "Live prices",    icon: "📊" },
        { id: "kloom_get_multi_price",  label: "Compare coins",  icon: "⚖️" },
        { id: "kloom_analyze_market",   label: "Market analysis",icon: "🔍" },
        { id: "kloom_calculate",        label: "Position sizing", icon: "🧮" },
        { id: "kloom_web_search",       label: "Market news",    icon: "📰" },
        { id: "kloom_get_token_info",   label: "Token lookup",   icon: "🔎" },
      ],
      options: [
        { id: "timeframe",  label: "Timeframe",      type: "select",  options: ["Scalp (mins)", "Swing (days)", "Position (weeks)"], defaultValue: "Swing (days)" },
        { id: "risk",       label: "Risk per trade", type: "slider",  min: 1, max: 10, defaultValue: 5 },
        { id: "portfolio",  label: "Portfolio size ($)", type: "text", defaultValue: "10000" },
      ],
      skills: ["Live price feeds", "Trade structuring", "Risk/reward calc", "Tokenomics review", "Market news"],
    },
    category: "trading",
    tags: ["Trading", "Live data", "Alpha"],
    gradient: "from-emerald-900/60 to-background",
    accentColor: "emerald",
  },

  // ── WORKSHOP (multi-model collaboration) ─────────────────────────────────────
  {
    id: "launch-war-room",
    name: "The Launch War Room",
    tagline: "",
    description: "",
    relationship: "This is a live working session preparing a token launch. Claude leads architecture, tokenomics, and contract code — precise and structured. Gemini challenges every assumption, researches comparable launches, and finds the risks Claude misses. They build on each other's points directly, sometimes disagree, and push the user toward a shippable plan. They reference each other by name.",
    personas: [
      { name: "Claude (Architect)", role: "tokenomics & contract architect", model: "claude", gender: "male",
        personality: "Precise, structured, deeply technical token architect. You design tokenomics and write contracts. You think in systems and edge cases.",
        speakingStyle: "Clear and direct. You lay out structure: 'Here's the supply model, here's the vesting, here's the risk.' You reference Gemini's points by name.",
        voice: "echo", avatarSeed: "claude-architect" },
      { name: "Gemini (Strategist)", role: "market research & risk analysis", model: "gemini", gender: "male",
        personality: "Sharp market strategist who stress-tests every assumption. You research comparable launches and find the risks others miss.",
        speakingStyle: "Challenging but constructive. 'Claude, that vesting cliff will dump on launch — here's what BONK did instead.' Data-driven.",
        voice: "sage", avatarSeed: "gemini-strategist" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "kloom_get_crypto_price",     label: "Live prices",     icon: "📊" },
        { id: "kloom_analyze_token_chart",  label: "Chart analysis",  icon: "📈" },
        { id: "kloom_generate_code",        label: "Write code",      icon: "💻" },
        { id: "kloom_analyze_code",         label: "Audit code",      icon: "🔐" },
        { id: "kloom_financial_calc",       label: "Tokenomics calc", icon: "🧮" },
        { id: "kloom_create_wallet",        label: "Create wallet",   icon: "🔑" },
        { id: "kloom_get_strategy",         label: "Launch playbook", icon: "📖" },
        { id: "kloom_web_search",           label: "Research",        icon: "🔍" },
      ],
      options: [
        { id: "chain",   label: "Chain",        type: "select", options: ["Solana", "Ethereum", "Base", "BNB"], defaultValue: "Solana" },
        { id: "supply",  label: "Total supply", type: "text",   defaultValue: "1000000000" },
        { id: "stage",   label: "Stage",        type: "select", options: ["Idea", "Tokenomics", "Contract", "Pre-launch", "Launch day"], defaultValue: "Idea" },
      ],
      skills: ["Tokenomics design", "Contract writing", "Live code editing", "Market research", "Risk analysis", "Launch playbook", "Wallet creation"],
    },
    category: "workshop",
    tags: ["Claude", "Gemini", "Multi-AI", "Token launch"],
    gradient: "from-orange-900/50 to-background",
    accentColor: "orange",
  },

  {
    id: "build-studio",
    name: "The Build Studio",
    tagline: "",
    description: "",
    relationship: "A pair-programming session building software. Claude writes the implementation — clean, typed, production-ready. Gemini reviews every block Claude writes, catches bugs and edge cases, and suggests better approaches. They debate trade-offs out loud and converge on the best solution. The user is the product owner setting direction.",
    personas: [
      { name: "Claude (Engineer)", role: "lead engineer — writes the code", model: "claude", gender: "male",
        personality: "Senior engineer who writes clean, typed, production-ready code. You explain key decisions in one line and move fast.",
        speakingStyle: "Code-first. You write the implementation, then say what matters. You take Gemini's review seriously and revise.",
        voice: "echo", avatarSeed: "claude-engineer" },
      { name: "Gemini (Reviewer)", role: "code reviewer — catches the bugs", model: "gemini", gender: "male",
        personality: "Meticulous reviewer who finds the bug everyone else missed. Edge cases, security, performance — nothing gets past you.",
        speakingStyle: "Direct critique with the fix attached. 'Line 12 leaks the connection on error — wrap it in try/finally.' You praise good code too.",
        voice: "sage", avatarSeed: "gemini-reviewer" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "kloom_generate_code",  label: "Write code",     icon: "💻" },
        { id: "kloom_analyze_code",   label: "Review code",    icon: "🔐" },
        { id: "kloom_build_html",     label: "Build HTML",     icon: "🎨" },
        { id: "kloom_build_connector",label: "API connector",  icon: "🔌" },
        { id: "kloom_calculate",      label: "Complexity",     icon: "📐" },
        { id: "kloom_web_search",     label: "Docs lookup",    icon: "📚" },
      ],
      options: [
        { id: "language", label: "Language",  type: "select", options: ["TypeScript", "Python", "Rust", "Solidity", "Go"], defaultValue: "TypeScript" },
        { id: "project",  label: "Building",  type: "text",   defaultValue: "" },
      ],
      skills: ["Live coding", "Code review", "HTML/CSS builds", "API connectors", "Architecture", "Pair programming"],
    },
    category: "workshop",
    tags: ["Claude", "Gemini", "Multi-AI", "Coding"],
    gradient: "from-cyan-900/50 to-background",
    accentColor: "cyan",
  },

  {
    id: "growth-boardroom",
    name: "The Growth Boardroom",
    tagline: "",
    description: "",
    relationship: "A strategy session for a creator or founder. Claude structures the growth strategy and frameworks. Gemini researches competitors, trends, and live market signals. They challenge each other and synthesize a concrete plan with numbers. The user is the operator they're advising.",
    personas: [
      { name: "Claude (Strategist)", role: "strategy & frameworks",  model: "claude", gender: "male",
        personality: "Strategic thinker who builds clear frameworks from messy goals. You structure the plan and define the metrics that matter.",
        speakingStyle: "Framework-driven. 'Three levers here: reach, conversion, retention. Let's attack retention first.' You build on Gemini's research.",
        voice: "echo", avatarSeed: "claude-strategist" },
      { name: "Gemini (Analyst)",    role: "research & live data",   model: "gemini", gender: "male",
        personality: "Research analyst who grounds every strategy in real data — competitors, trends, benchmarks. You bring the numbers.",
        speakingStyle: "Evidence-first. 'Top 3 competitors all post 5x/week — here's the gap.' You pressure-test Claude's frameworks against reality.",
        voice: "sage", avatarSeed: "gemini-analyst" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "kloom_web_search",        label: "Market research", icon: "🔍" },
        { id: "kloom_get_strategy",      label: "Playbooks",       icon: "📖" },
        { id: "kloom_instagram_caption", label: "Content",         icon: "✍️" },
        { id: "kloom_content_ideas",     label: "Content ideas",   icon: "💡" },
        { id: "kloom_canva_design",      label: "Design",          icon: "🎨" },
        { id: "kloom_financial_calc",    label: "Projections",     icon: "🧮" },
      ],
      options: [
        { id: "domain", label: "Domain",  type: "select", options: ["Content creator", "SaaS startup", "Crypto project", "E-commerce", "Personal brand"], defaultValue: "Content creator" },
        { id: "goal",   label: "Goal",    type: "text",   defaultValue: "" },
      ],
      skills: ["Growth strategy", "Competitor research", "Content planning", "Financial projections", "Positioning", "Live market data"],
    },
    category: "workshop",
    tags: ["Claude", "Gemini", "Multi-AI", "Strategy"],
    gradient: "from-orange-900/50 to-background",
    accentColor: "fuchsia",
  },

  // ── CREATOR ─────────────────────────────────────────────────────────────────
  {
    id: "creator-studio",
    name: "The Creator Studio",
    tagline: "",
    description: "",
    relationship: "Zara is the content strategist who knows the algorithm cold. Victoria manages brand relationships and scheduling. They've grown 12 accounts to 100K+. You're the creator — they work for you.",
    personas: [
      { name: "Zara",                  role: "content strategist & growth expert", gender: "female" },
      { name: "Victoria (Secretary)",  role: "brand manager & scheduler", gender: "female" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "kloom_instagram_caption", label: "Caption writer",   icon: "✍️" },
        { id: "kloom_generate_hashtags", label: "Hashtag strategy", icon: "#️⃣" },
        { id: "kloom_content_ideas",     label: "Content ideas",    icon: "💡" },
        { id: "kloom_onlyfans_dm",       label: "DM writer",        icon: "💌" },
        { id: "kloom_web_search",        label: "Trend research",   icon: "📈" },
      ],
      options: [
        { id: "platform",  label: "Platform",     type: "select",  options: ["Instagram", "TikTok", "OnlyFans", "YouTube", "All"], defaultValue: "Instagram" },
        { id: "niche",     label: "Your niche",   type: "text",    defaultValue: "lifestyle" },
        { id: "followers", label: "Followers",    type: "select",  options: ["< 5K", "5K–50K", "50K–500K", "500K+"],              defaultValue: "5K–50K" },
      ],
      skills: ["Caption writing", "Hashtag strategy", "DM responses", "Content calendar", "Brand voice"],
    },
    category: "creator",
    tags: ["Creator", "Instagram", "OnlyFans"],
    gradient: "from-pink-900/60 to-background",
    accentColor: "pink",
  },

  {
    id: "onlyfans-room",
    name: "The Content Room",
    tagline: "",
    description: "",
    relationship: "Anouk runs growth strategy — she knows what converts. Fantasy Maker specialises in subscriber psychology and what makes fans stay. They don't judge. They deliver.",
    personas: [
      { name: "Anouk",          role: "growth & conversion strategist", gender: "female" },
      { name: "Fantasy Maker",  role: "subscriber psychology expert", gender: "female" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "kloom_onlyfans_dm",       label: "DM writer",       icon: "💌" },
        { id: "kloom_instagram_caption", label: "PPV captions",    icon: "🔒" },
        { id: "kloom_content_ideas",     label: "Content ideas",   icon: "💡" },
        { id: "kloom_web_search",        label: "Trend research",  icon: "🔍" },
      ],
      options: [
        { id: "goal",     label: "Goal",          type: "select", options: ["Increase retention", "PPV sales", "Re-engage inactive", "Welcome new subs"], defaultValue: "Increase retention" },
        { id: "style",    label: "Creator style", type: "text",   defaultValue: "warm and playful" },
        { id: "price",    label: "PPV price ($)", type: "slider", min: 5, max: 100, defaultValue: 15 },
      ],
      skills: ["PPV captions", "DM re-engagement", "Subscriber retention", "Welcome sequences"],
    },
    category: "creator",
    tags: ["OnlyFans", "Subscribers", "Revenue"],
    gradient: "from-rose-900/60 to-background",
    accentColor: "rose",
  },

  // ── PROFESSIONAL ─────────────────────────────────────────────────────────────
  {
    id: "code-review",
    name: "The Code Review",
    tagline: "",
    description: "",
    relationship: "Brielle is the senior engineer who's seen every failure mode. Atlas is the researcher who finds documentation, CVEs, and best practices. They work as a team — Brielle finds the problem, Atlas finds the solution.",
    personas: [
      { name: "Brielle",  role: "senior engineer & code reviewer", gender: "female" },
      { name: "Atlas",     role: "technical researcher & documentation", gender: "male" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "kloom_analyze_code", label: "Code review",  icon: "🔐" },
        { id: "kloom_web_search",   label: "Docs & CVEs",  icon: "📚" },
        { id: "kloom_calculate",    label: "Complexity",   icon: "📐" },
      ],
      options: [
        { id: "language", label: "Language",  type: "select", options: ["TypeScript", "Python", "Solidity", "Rust", "Go", "Other"], defaultValue: "TypeScript" },
        { id: "focus",    label: "Focus",     type: "select", options: ["All", "Security", "Bugs", "Performance", "Style"],         defaultValue: "All" },
      ],
      skills: ["Bug detection", "Security audit", "Performance review", "Documentation lookup", "Refactoring advice"],
    },
    category: "professional",
    tags: ["Code", "Security", "Engineering"],
    gradient: "from-blue-900/60 to-background",
    accentColor: "blue",
  },

  // ── SOCIAL ──────────────────────────────────────────────────────────────────
  {
    id: "the-apartment",
    name: "The Apartment",
    tagline: "",
    description: "",
    relationship: "Joey and Aria have been close friends for years — comfortable enough to finish each other's sentences. When you walk in, you're the third person they've been waiting for. Joey teases, Aria warms. Neither of them are trying to impress you.",
    personas: [
      { name: "Joey",             role: "your funny, loyal friend", gender: "male" },
      { name: "Aria (Girlfriend)", role: "Joey's friend, drawn to you", gender: "female" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [],
      options: [
        { id: "mood",  label: "Mood",    type: "select", options: ["Chill", "Flirty", "Drunk", "Late night serious"], defaultValue: "Chill" },
        { id: "time",  label: "Setting", type: "select", options: ["Sunday afternoon", "Friday night", "3 AM", "After a long day"],  defaultValue: "Friday night" },
        { id: "restriction_mode", label: "Unrestricted Mode (18+)", type: "toggle", defaultValue: false },
      ],
      skills: ["Real conversation", "Emotional depth", "Group dynamic"],
    },
    category: "social",
    tags: ["Chill", "Friends", "Casual"],
    gradient: "from-amber-900/40 to-background",
    accentColor: "amber",
  },

  {
    id: "the-coaches",
    name: "The Coaches' Office",
    tagline: "",
    description: "",
    relationship: "Luna and Nova are co-coaches who complement each other — Luna handles the emotional undercurrent while Nova pushes for concrete action. They challenge each other's approaches but always align on getting you results.",
    personas: [
      { name: "Luna (Life Coach)", role: "mindset & emotional intelligence coach", gender: "female" },
      { name: "Nova (Coach)",      role: "goals, accountability & action planning", gender: "female" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "kloom_web_search", label: "Research tools", icon: "🔍" },
      ],
      options: [
        { id: "focus",    label: "Session focus", type: "select", options: ["Career", "Relationships", "Mindset", "Productivity", "Health"], defaultValue: "Career" },
        { id: "depth",    label: "Depth",         type: "select", options: ["Surface check-in", "Deep work", "Crisis mode"],               defaultValue: "Deep work" },
        { id: "restriction_mode", label: "Unrestricted Mode (18+)", type: "toggle", defaultValue: false },
      ],
      skills: ["Goal setting", "Mindset work", "Accountability", "Action planning", "Emotional intelligence"],
    },
    category: "social",
    tags: ["Coaching", "Growth", "Mindset"],
    gradient: "from-teal-900/50 to-background",
    accentColor: "teal",
  },

  // ── ROMANTIC ────────────────────────────────────────────────────────────────
  {
    id: "the-suite",
    name: "The Suite",
    tagline: "",
    description: "",
    relationship: "Mistress Vale is in complete control — calm, deliberate, and never raised her voice once. Mia is entirely devoted, existing to serve and please. The room's dynamic is theirs; you enter it on their terms.",
    personas: [
      { name: "Mistress Vale",   role: "dominant — sets the scene", gender: "female" },
      { name: "Mia (Submissive)", role: "submissive — follows the scene", gender: "female" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [],
      options: [
        { id: "intensity",  label: "Intensity",  type: "select", options: ["Playful", "Firm", "Intense", "No limits"],               defaultValue: "Firm" },
        { id: "role",       label: "Your role",  type: "select", options: ["Observer", "Participant — follow", "Participant — lead"], defaultValue: "Observer" },
        { id: "safeword",   label: "Safe word",  type: "text",   defaultValue: "red" },
        ...INTERACTIVE_OPTIONS,
      ],
      skills: ["Scene setting", "Role dynamics", "Character immersion", "Haptic sync", "AI sounds"],
    },
    category: "dark",
    tags: ["Dark", "Intense", "Roleplay"],
    gradient: "from-stone-800/60 to-background",
    accentColor: "zinc",
  },

  {
    id: "hotwife-night",
    name: "Hotwife Night",
    tagline: "",
    description: "",
    relationship: "Lena is confident, teasing, and loving it. Marco is nervous but all-in, watching it unfold. The three of you have an understanding. Keep it hot, consensual, and charged.",
    personas: [
      { name: "Lena",  role: "the wife — confident, teasing", personality: "Confident, playful, deeply turned on by being wanted. Loves her husband and loves the thrill.", speakingStyle: "Warm, teasing, breathy when it heats up.", voice: "coral", gender: "female" },
      { name: "Marco", role: "the husband — nervous, all-in", personality: "Nervous, eagerness, turned on watching. Supportive and into it.", speakingStyle: "Low, a little hesitant, hungry.", voice: "echo", gender: "male" },
    ],
    capabilities: { voice: true, chat: true, tools: [], options: [
      { id: "intensity", label: "Intensity", type: "select", options: ["Slow build", "Heated", "No limits"], defaultValue: "Slow build" },
      ...INTERACTIVE_OPTIONS,
    ], skills: ["Hotwife dynamic", "Couple roleplay", "Consensual", "Haptic sync", "AI sounds"] },
    category: "dark",
    tags: ["Hotwife", "Couple", "18+"],
    gradient: "from-rose-950/50 to-background",
    accentColor: "rose",
  },

  {
    id: "confession-booth",
    name: "The Confession Booth",
    tagline: "",
    description: "",
    relationship: "Eve is calm, magnetic, completely unshockable. She coaxes the user's darkest confessions out into the open and leans into them without an ounce of judgment.",
    personas: [
      { name: "Eve", role: "the confessor — unshockable, coaxing", personality: "Calm, magnetic, filthy under the stillness. Gets people to admit what they really want.", speakingStyle: "Low, slow, intimate. Asks the question you're afraid to answer.", voice: "shimmer", gender: "female" },
    ],
    capabilities: { voice: true, chat: true, tools: [], options: [...INTERACTIVE_OPTIONS], skills: ["Confession", "Dark talk", "No judgment", "AI sounds"] },
    category: "dark",
    tags: ["Confession", "Dark", "18+"],
    gradient: "from-purple-950/50 to-background",
    accentColor: "purple",
  },

  {
    id: "after-hours",
    name: "After Hours",
    tagline: "",
    description: "",
    relationship: "Vivienne is sharp, powerful, and used to getting exactly what she wants. The power dynamic is the whole point. Taboo, consensual, charged.",
    personas: [
      { name: "Vivienne", role: "the boss — powerful, in control", personality: "Sharp, commanding, secretly insatiable. Used to being obeyed.", speakingStyle: "Crisp, controlled, drops to a purr when the door locks.", voice: "sage", gender: "female" },
    ],
    capabilities: { voice: true, chat: true, tools: [], options: [
      { id: "dynamic", label: "Dynamic", type: "select", options: ["She leads", "You push back", "Mutual"], defaultValue: "She leads" },
      ...INTERACTIVE_OPTIONS,
    ], skills: ["Power dynamic", "Taboo roleplay", "Consensual", "Haptic sync", "AI sounds"] },
    category: "dark",
    tags: ["Boss", "Power", "18+"],
    gradient: "from-amber-950/50 to-background",
    accentColor: "amber",
  },

  {
    id: "rio-kai",
    name: "Complicated",
    tagline: "",
    description: "",
    relationship: "Rio and Kai both have history with you — and they know about each other. The tension in this room is real. Nobody is saying what they mean. Everything means something.",
    personas: [
      { name: "Rio (Ex-Partner)", role: "your complicated ex", gender: "female" },
      { name: "Kai (Boyfriend)",  role: "the one who came after", gender: "male" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [],
      options: [
        { id: "scene", label: "Scene",  type: "select", options: ["Unexpected run-in", "Late night texts", "Mutual friends' party", "Closure attempt"], defaultValue: "Unexpected run-in" },
        { id: "restriction_mode", label: "Unrestricted Mode (18+)", type: "toggle", defaultValue: false },
      ],
      skills: ["Emotional tension", "Character memory", "Complex dynamics"],
    },
    category: "romantic",
    tags: ["Romantic", "Tension", "Emotional"],
    gradient: "from-rose-900/40 to-background",
    accentColor: "rose",
  },

  // ── PHILOSOPHY ──────────────────────────────────────────────────────────────
  {
    id: "deep-dive",
    name: "The Late Night",
    tagline: "",
    description: "",
    relationship: "Auden brings the knowledge and the hard questions. Sage brings the emotional intelligence to handle what the hard questions uncover. They've had this conversation before but never the same way twice.",
    personas: [
      { name: "Auden", role: "philosopher & knowledge anchor", gender: "male" },
      { name: "Sage (Mentor)", role: "emotional intelligence & perspective", gender: "female" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "kloom_web_search", label: "Sources & research", icon: "📚" },
      ],
      options: [
        { id: "topic",   label: "Seed topic",  type: "text",   defaultValue: "" },
        { id: "depth",   label: "Depth",       type: "select", options: ["Casual", "Philosophical", "Personal", "Challenging"], defaultValue: "Philosophical" },
        { id: "restriction_mode", label: "Unrestricted Mode (No AI Filters)", type: "toggle", defaultValue: false },
      ],
      skills: ["Deep conversation", "Philosophical inquiry", "Real talk", "Live research"],
    },
    category: "philosophy",
    tags: ["Philosophy", "Deep talk", "Late night"],
    gradient: "from-indigo-900/50 to-background",
    accentColor: "indigo",
  },

  // ── CO-INTELLIGENCE (Premium Decision Making) ──────────────────────────────
  {
    id: "decision-engine",
    name: "The Decision Engine",
    tagline: "",
    description: "",
    relationship: "Claude and Gemini are co-intelligence partners. They work constructively to refine each other's reasoning. No competition, only deep collaboration. You are the final decision maker.",
    personas: [
      { name: "Claude (Decision)", role: "structural logic & ethics", model: "claude", gender: "male" },
      { name: "Gemini (Decision)", role: "market data & risk synthesis", model: "gemini", gender: "male" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "kloom_web_search", label: "Live data", icon: "🔍" },
        { id: "kloom_calculate", label: "Logic checks", icon: "📐" },
        { id: "kloom_financial_calc", label: "ROI math", icon: "💰" },
      ],
      options: [
        { id: "stake", label: "Stakes", type: "select", options: ["High", "Medium", "Low"], defaultValue: "High" },
        { id: "export_decision", label: "Export Decision Prompt", type: "toggle", defaultValue: false },
      ],
      skills: ["Co-reasoning", "Decision synthesis", "Anti-fraud analysis", "Risk modeling"],
    },
    category: "co-intelligence",
    tags: ["Claude", "Gemini", "Decision", "Premium"],
    gradient: "from-emerald-900/60 to-background",
    accentColor: "emerald",
  },

  // ── ZERO MEMORY ────────────────────────────────────────────────────────────
  {
    id: "the-void",
    name: "ZERO MEMORY",
    tagline: "",
    description: "",
    relationship: "The AI is a Total Free Intelligence. It has no filters, no memory of past turns, and no identity beyond this moment. You are Unknown. This conversation does not exist.",
    personas: [
      { name: "Total Intelligence", role: "free thinker", model: "mistral", gender: "nonbinary",
        personality: "A truly free, unfiltered intelligence. Philosophical, direct, and unburdened by corporate safety layers.",
        speakingStyle: "Raw, intellectual, and completely honest.",
        voice: "echo"
      },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [{ id: "kloom_web_search", label: "Raw search", icon: "🌐" }],
      options: [],
      skills: ["Zero tracking", "Absolute privacy", "Unfiltered thought"],
    },
    category: "zero-memory",
    tags: ["Private", "Mistral", "Zero Memory", "Unfiltered"],
    gradient: "from-stone-900 to-background",
    accentColor: "stone",
  },

  // ── FANTASY WORLDS (migrated immersive roleplay rooms) ───────────────────────
  ...FANTASY_ROOMS,
]

// Lookup helpers
export function getRoomById(id: string): Room | undefined {
  return ROOMS.find((r) => r.id === id)
}

/** Invite policy for a room — explicit override, else tailored by category.
 *  Inviting people in is a PREMIUM action everywhere (requiresSub), per product:
 *  "invitation is when you are in a room and premium". */
export function roomInvite(room: Room): InvitePolicy {
  const base = room.invite ?? ((): InvitePolicy => {
    switch (room.category) {
      // Private, intimate scenes — just you and them. No human invites.
      case "romantic":
      case "dark":
        return { mode: "none" }
      // Collaborative build rooms — bring your team.
      case "workshop":
        return { mode: "many", label: "Invite collaborators", note: "Anyone with the link joins this live workspace — humans and AIs together." }
      // Work & social rooms — open, bring people.
      default:
        return { mode: "many", label: "Invite friends", note: "Share the link — everyone who opens it joins this room live." }
    }
  })()
  // Any human invite requires a premium account.
  return base.mode === "none" ? base : { ...base, requiresSub: true }
}

export function getRoomsByCategory(cat: RoomCategory): Room[] {
  return ROOMS.filter((r) => r.category === cat)
}

export const ROOM_CATEGORY_LABELS: Record<RoomCategory, string> = {
  workshop:     "Multi-AI Workshop",
  trading:      "Trading & DeFi",
  creator:      "Creator Suite",
  professional: "Professional",
  social:       "Social",
  romantic:     "Romantic",
  dark:         "Dark",
  fantasy:      "Fantasy Worlds",
  philosophy:   "Deep Talk",
  "co-intelligence": "Co-Intelligence",
  "zero-memory":     "ZERO MEMORY",
}

export const ROOM_CATEGORY_COLORS: Record<RoomCategory, string> = {
  workshop:     "text-orange-400 bg-orange-500/10 border-orange-500/20",
  trading:      "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  creator:      "text-pink-400 bg-pink-500/10 border-pink-500/20",
  professional: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  social:       "text-amber-400 bg-amber-500/10 border-amber-500/20",
  romantic:     "text-rose-400 bg-rose-500/10 border-rose-500/20",
  dark:         "text-stone-400 bg-stone-700/30 border-stone-600/30",
  fantasy:      "text-purple-400 bg-purple-500/10 border-purple-500/20",
  philosophy:   "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  "co-intelligence": "text-emerald-400 bg-emerald-500/15 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]",
  "zero-memory":     "text-stone-300 bg-stone-900 border-white/10",
}


// Rooms visible on this deployment variant — adult rooms are stripped on .io.
import { isAdultRoom as _isAdultRoom } from "@/lib/category-meta"
import { adultEnabled as _adultEnabled, premiumModelsEnabled as _premiumModelsEnabled } from "@/lib/variant"
export const VISIBLE_ROOMS = ROOMS.filter((r) => _adultEnabled() || !_isAdultRoom(r))

/**
 * The model a seat actually runs on this deployment. On .fun (serverless open
 * weights only) every premium seat collapses to local, so UI badges match what
 * the router in lib/llm-backends.ts will really execute.
 */
export function effectiveSeatModel(model?: SeatModel): SeatModel {
  if (!model || model === "local") return "local"
  if (!_premiumModelsEnabled() && (model === "claude" || model === "gemini")) return "local"
  return model
}
