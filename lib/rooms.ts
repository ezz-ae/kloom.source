/**
 * Room definitions — each room is a RELATIONSHIP DYNAMIC, not a person collection.
 *
 * A room defines:
 *  - who is in it (2-4 personas with fixed relationship context)
 *  - how they relate to each other (injected into every AI turn)
 *  - what capabilities unlock (MCP tools + room-specific options)
 *  - visual identity
 *  - platform value for users
 *
 * KLOOM branding: All rooms now use KLOOM naming and aesthetic
 */

export type RoomCategory =
  | "trading"
  | "creator"
  | "business"
  | "social"
  | "learning"
  | "entertainment"
  | "workshop"   // multi-model collaborative work rooms
  | "premium"   // exclusive, high-value rooms

export type SeatModel = "local" | "claude" | "gemini" | "openai" | "mistral"

export interface RoomPersona {
  name: string
  role: string
  model?: SeatModel
  personality?: string
  speakingStyle?: string
  voice?: "alloy" | "ash" | "ballad" | "coral" | "echo" | "sage" | "shimmer" | "verse"
  voiceId?: string
  gender?: "female" | "male" | "nonbinary"
  avatarSeed?: string
}

export interface RoomTool {
  id: string
  label: string
  icon: string
}

export interface RoomOption {
  id: string
  label: string
  type: "select" | "slider" | "toggle" | "text" | "number"
  options?: string[]
  min?: number
  max?: number
  step?: number
  defaultValue: string | number | boolean
  description?: string
}

export interface RoomCapabilities {
  voice: boolean
  chat: boolean
  tools: RoomTool[]
  options: RoomOption[]
  skills: string[]
}

export interface InvitePolicy {
  mode: "none" | "one" | "many" | "public"
  requiresSub?: boolean
  label?: string
  note?: string
  maxParticipants?: number
}

export interface Room {
  id: string
  name: string
  tagline: string
  description: string
  shortDescription?: string  // For cards and previews
  relationship: string
  personas: RoomPersona[]
  capabilities: RoomCapabilities
  category: RoomCategory
  tags: string[]
  gradient: string
  accentColor: string
  icon?: string  // Emoji for the room
  invite?: InvitePolicy
  popular?: boolean  // Show in popular section
  featured?: boolean  // Show in featured section
  new?: boolean  // New badge
  premium?: boolean  // Requires subscription
  // Platform value
  platformValue?: string[]  // What users get from this room
  // SEO
  seoTitle?: string
  seoDescription?: string
}

// All available room categories
export const ROOM_CATEGORIES: RoomCategory[] = [
  "trading",
  "creator",
  "business",
  "social",
  "learning",
  "entertainment",
  "workshop",
  "premium",
]

// Category labels for UI
export const ROOM_CATEGORY_LABELS: Record<RoomCategory, { label: string; icon: string; color: string }> = {
  trading: { label: "Trading & Finance", icon: "📈", color: "emerald" },
  creator: { label: "Creator Studio", icon: "✨", color: "pink" },
  business: { label: "Business & Strategy", icon: "💼", color: "cyan" },
  social: { label: "Social & Lifestyle", icon: "👥", color: "purple" },
  learning: { label: "Learning & Growth", icon: "📚", color: "blue" },
  entertainment: { label: "Entertainment", icon: "🎮", color: "orange" },
  workshop: { label: "Workshop", icon: "🔧", color: "amber" },
  premium: { label: "Premium", icon: "👑", color: "gold" },
}

export const ROOMS: Room[] = [
  // ============================================================================
  // TRADING & FINANCE
  // ============================================================================
  {
    id: "trading-floor",
    name: "KLOOM Trading Floor",
    tagline: "Live market analysis with multiple AI traders",
    description: "Viktor Sol runs the macro thesis. Kaia Dev builds the signals. Mistral analyzes the data. Together, they provide real-time trading insights, live price data, and collaborative analysis you can't get from a single AI.",
    shortDescription: "Multi-AI trading room with live market data",
    relationship: "Viktor is the macro strategist and position taker. Kaia is the quant engineer who builds trading signals. Mistral provides additional analysis and research. They debate every thesis before sizing up. You are the capital allocator they answer to.",
    personas: [
      { name: "Viktor Sol", role: "Macro Strategist & Trader", model: "claude" },
      { name: "Kaia Dev", role: "Quant Engineer & Signal Builder", model: "mistral" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_get_crypto_price", label: "Live Prices", icon: "📊" },
        { id: "ora_get_multi_price", label: "Compare Coins", icon: "⚖️" },
        { id: "ora_analyze_market", label: "Market Analysis", icon: "🔍" },
        { id: "ora_calculate", label: "Position Sizing", icon: "🧮" },
        { id: "ora_web_search", label: "Market News", icon: "📰" },
        { id: "ora_get_token_info", label: "Token Lookup", icon: "🔎" },
      ],
      options: [
        { id: "timeframe", label: "Timeframe", type: "select", options: ["Scalp (minutes)", "Day Trade", "Swing (days)", "Position (weeks)", "Invest (months)"], defaultValue: "Swing (days)", description: "Trading timeframe" },
        { id: "risk", label: "Risk per Trade (%)", type: "slider", min: 0.5, max: 10, step: 0.5, defaultValue: 2, description: "Percentage of portfolio to risk" },
        { id: "portfolio", label: "Portfolio Size ($)", type: "number", defaultValue: 10000, description: "Your total portfolio value" },
        { id: "focus", label: "Focus", type: "select", options: ["Crypto", "Stocks", "Forex", "DeFi", "NFTs"], defaultValue: "Crypto" },
      ],
      skills: ["Live price feeds", "Trade structuring", "Risk/reward calculation", "Tokenomics review", "Market news analysis", "Multi-AI collaboration"],
    },
    category: "trading",
    tags: ["Trading", "Live Data", "Crypto", "Stocks", "Multi-AI", "DeFi"],
    gradient: "from-emerald-900/60 to-stone-950",
    accentColor: "emerald",
    icon: "📈",
    invite: { mode: "many", label: "Invite fellow traders", note: "Collaborate with other traders in real-time" },
    popular: true,
    featured: true,
    platformValue: ["Real-time market data", "Multi-AI trading insights", "Collaborative analysis", "Live price alerts", "Professional trading strategies"],
    seoTitle: "KLOOM Trading Floor - Live Multi-AI Trading Room",
    seoDescription: "Trade with multiple AI experts in real-time. Get live market data, trading signals, and collaborative analysis from Viktor Sol, Kaia Dev, and Mistral.",
  },
  {
    id: "crypto-hq",
    name: "Crypto HQ",
    tagline: "Your command center for crypto trading",
    description: "A dedicated space for crypto traders with live price data, DeFi insights, and token analysis. Get real-time information on Bitcoin, Ethereum, Solana, and thousands of other tokens.",
    shortDescription: "Crypto trading with live data and DeFi insights",
    relationship: "You are a crypto trader managing your portfolio. The AIs provide live market data, DeFi protocol information, and trading insights specific to the crypto market.",
    personas: [
      { name: "Viktor Sol", role: "Crypto Strategist", model: "claude" },
      { name: "Mistral", role: "Market Analyst", model: "mistral" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_get_crypto_price", label: "Token Prices", icon: "💰" },
        { id: "ora_get_multi_price", label: "Portfolio Tracking", icon: "📊" },
        { id: "ora_analyze_market", label: "DeFi Analysis", icon: "🏦" },
        { id: "ora_web_search", label: "Crypto News", icon: "📰" },
        { id: "ora_calculate", label: "Gas Fees", icon: "⛽" },
      ],
      options: [
        { id: "chain", label: "Blockchain", type: "select", options: ["Solana", "Ethereum", "BNB Chain", "Polygon", "Base", "Arbitrum"], defaultValue: "Solana" },
        { id: "focus", label: "Focus Area", type: "select", options: ["Trading", "DeFi", "NFTs", "Yield Farming", "Staking"], defaultValue: "Trading" },
        { id: "alerts", label: "Price Alerts", type: "toggle", defaultValue: true, description: "Enable price threshold alerts" },
      ],
      skills: ["Crypto trading", "DeFi protocols", "Token analysis", "Gas optimization", "Yield strategies"],
    },
    category: "trading",
    tags: ["Crypto", "Bitcoin", "Ethereum", "Solana", "DeFi", "Altcoins"],
    gradient: "from-purple-900/60 to-stone-950",
    accentColor: "purple",
    icon: "🪙",
    popular: true,
    platformValue: ["Live crypto prices", "DeFi insights", "Token analysis", "Gas optimization", "Yield strategies"],
  },
  {
    id: "stock-market",
    name: "Stock Market Hub",
    tagline: "Traditional markets meet AI analysis",
    description: "Get AI-powered insights on stocks, ETFs, and traditional markets. Analyze companies, track indices, and get investment ideas with fundamental and technical analysis.",
    shortDescription: "AI stock market analysis and insights",
    relationship: "You are an investor looking for insights. The AIs provide company analysis, market trends, and investment strategies based on fundamental and technical indicators.",
    personas: [
      { name: "Marcus", role: "Stock Analyst", model: "claude" },
      { name: "Mistral", role: "Market Researcher", model: "mistral" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Company Research", icon: "🏢" },
        { id: "ora_calculate", label: "Financial Metrics", icon: "📈" },
        { id: "ora_analyze_market", label: "Market Trends", icon: "📊" },
      ],
      options: [
        { id: "market", label: "Market", type: "select", options: ["US", "Europe", "Asia", "Global"], defaultValue: "US" },
        { id: "sector", label: "Sector", type: "select", options: ["Tech", "Healthcare", "Finance", "Energy", "Consumer", "All"], defaultValue: "All" },
        { id: "style", label: "Investing Style", type: "select", options: ["Growth", "Value", "Dividend", "Index", "Swing Trade"], defaultValue: "Growth" },
      ],
      skills: ["Stock analysis", "Company research", "Market trends", "Financial metrics", "Investment strategies"],
    },
    category: "trading",
    tags: ["Stocks", "ETFs", "Investing", "Wall Street", "Financial Analysis"],
    gradient: "from-blue-900/60 to-stone-950",
    accentColor: "blue",
    icon: "📊",
    platformValue: ["Stock analysis", "Company research", "Market insights", "Investment strategies", "Portfolio tracking"],
  },

  // ============================================================================
  // CREATOR STUDIO
  // ============================================================================
  {
    id: "creator-studio",
    name: "KLOOM Creator Studio",
    tagline: "Build your content empire with AI",
    description: "Zara handles content strategy and growth. Victoria manages brand deals and scheduling. Together with Mistral for multilingual content, they help you grow across Instagram, TikTok, YouTube, and more.",
    shortDescription: "Complete content creation and growth suite",
    relationship: "Zara is your content strategist who knows algorithms cold. Victoria manages brand relationships and scheduling. They've grown 12 accounts to 100K+. You're the creator — they work for you.",
    personas: [
      { name: "Zara", role: "Content Strategist & Growth Expert", model: "gemini" },
      { name: "Victoria", role: "Brand Manager & Scheduler", model: "mistral" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_instagram_caption", label: "Caption Writer", icon: "✍️" },
        { id: "ora_generate_hashtags", label: "Hashtag Strategy", icon: "#️⃣" },
        { id: "ora_content_ideas", label: "Content Ideas", icon: "💡" },
        { id: "ora_onlyfans_dm", label: "DM Writer", icon: "💌" },
        { id: "ora_web_search", label: "Trend Research", icon: "📈" },
        { id: "ora_canva_design", label: "Design Assistant", icon: "🎨" },
      ],
      options: [
        { id: "platform", label: "Primary Platform", type: "select", options: ["Instagram", "TikTok", "YouTube", "Twitter/X", "LinkedIn", "OnlyFans", "Blog"], defaultValue: "Instagram" },
        { id: "niche", label: "Content Niche", type: "select", options: ["Lifestyle", "Fashion", "Fitness", "Business", "Tech", "Gaming", "Travel", "Food", "Beauty"], defaultValue: "Lifestyle" },
        { id: "frequency", label: "Posting Frequency", type: "select", options: ["Daily", "3-4x/week", "2x/week", "Weekly"], defaultValue: "3-4x/week" },
        { id: "multilingual", label: "Multilingual Content", type: "toggle", defaultValue: false, description: "Create content in multiple languages" },
      ],
      skills: ["Content strategy", "Caption writing", "Hashtag research", "Trend analysis", "Brand deals", "Scheduling", "Multilingual content"],
    },
    category: "creator",
    tags: ["Content Creation", "Social Media", "Influencer", "Growth", "Multilingual", "Instagram"],
    gradient: "from-pink-900/50 to-stone-950",
    accentColor: "pink",
    icon: "✨",
    invite: { mode: "many", label: "Invite collaborators", note: "Work with other creators and managers" },
    popular: true,
    featured: true,
    platformValue: ["Content strategy", "Social media growth", "Caption writing", "Hashtag optimization", "Brand deals", "Multilingual support"],
    seoTitle: "KLOOM Creator Studio - AI-Powered Content Creation",
    seoDescription: "Create and grow your content with AI experts. Get captions, hashtags, content ideas, and strategy from Zara and Victoria.",
  },
  {
    id: "social-media-warroom",
    name: "Social Media War Room",
    tagline: "Go viral with AI-powered content",
    description: "A dedicated space for planning and executing social media campaigns. Get real-time trend analysis, content calendars, and performance optimization from multiple AI experts.",
    shortDescription: "Plan and execute viral social media campaigns",
    relationship: "This is a social media command center. Zara handles content strategy, Mistral provides multilingual support, and Claude analyzes performance data. Together, they help you create content that performs.",
    personas: [
      { name: "Zara", role: "Content Strategist", model: "gemini" },
      { name: "Mistral", role: "Multilingual Expert", model: "mistral" },
      { name: "Claude", role: "Data Analyst", model: "claude" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_content_ideas", label: "Viral Ideas", icon: "🚀" },
        { id: "ora_web_search", label: "Trend Analysis", icon: "📈" },
        { id: "ora_instagram_caption", label: "Engaging Captions", icon: "✍️" },
        { id: "ora_generate_hashtags", label: "Hashtag Research", icon: "#️⃣" },
        { id: "ora_canva_design", label: "Visual Content", icon: "🎨" },
      ],
      options: [
        { id: "campaign", label: "Campaign Type", type: "select", options: ["Product Launch", "Brand Awareness", "Engagement", "Growth", "Seasonal"], defaultValue: "Brand Awareness" },
        { id: "budget", label: "Campaign Budget ($)", type: "number", defaultValue: 1000, description: "Total budget for the campaign" },
        { id: "duration", label: "Duration (days)", type: "number", defaultValue: 30, description: "Campaign duration in days" },
      ],
      skills: ["Campaign planning", "Trend analysis", "Content creation", "Performance tracking", "Viral marketing"],
    },
    category: "creator",
    tags: ["Social Media", "Viral", "Campaigns", "Trends", "Marketing", "Multi-AI"],
    gradient: "from-rose-900/50 to-stone-950",
    accentColor: "rose",
    icon: "📱",
    popular: true,
    platformValue: ["Campaign planning", "Trend analysis", "Viral content", "Performance tracking", "Multi-platform strategy"],
  },
  {
    id: "video-production",
    name: "Video Production Suite",
    tagline: "From script to screen with AI",
    description: "Complete video production assistance. Get help with scripting, storyboarding, editing advice, and distribution strategies for YouTube, TikTok, and other video platforms.",
    shortDescription: "Complete video production assistance",
    relationship: "You are a video creator. The AIs help with every aspect of production: from initial concept to final distribution. They provide script feedback, editing suggestions, and optimization tips.",
    personas: [
      { name: "Zara", role: "Content Strategist", model: "gemini" },
      { name: "Mistral", role: "Script Doctor", model: "mistral" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_content_ideas", label: "Video Ideas", icon: "🎥" },
        { id: "ora_web_search", label: "Research", icon: "🔍" },
        { id: "ora_generate_code", label: "Editing Scripts", icon: "💻" },
      ],
      options: [
        { id: "platform", label: "Primary Platform", type: "select", options: ["YouTube", "TikTok", "Instagram Reels", "Twitch", "LinkedIn"], defaultValue: "YouTube" },
        { id: "type", label: "Video Type", type: "select", options: ["Tutorial", "Vlog", "Review", "Short Form", "Live Stream", "Storytelling"], defaultValue: "Tutorial" },
        { id: "length", label: "Video Length", type: "select", options: ["15-30s", "1-3min", "3-10min", "10-30min", "Long Form"], defaultValue: "3-10min" },
      ],
      skills: ["Video scripting", "Storyboarding", "Editing advice", "SEO optimization", "Platform strategy"],
    },
    category: "creator",
    tags: ["Video", "YouTube", "TikTok", "Editing", "Scripting", "Production"],
    gradient: "from-red-900/50 to-stone-950",
    accentColor: "red",
    icon: "🎬",
    platformValue: ["Video ideas", "Script writing", "Editing advice", "SEO optimization", "Platform strategy"],
  },

  // ============================================================================
  // BUSINESS & STRATEGY
  // ============================================================================
  {
    id: "startup-lab",
    name: "KLOOM Startup Lab",
    tagline: "Build your startup with AI co-founders",
    description: "Marcus handles business strategy and growth. Kaia Dev builds the technical foundation. Together, they help you validate ideas, build MVPs, and scale your startup.",
    shortDescription: "Build and scale your startup with AI co-founders",
    relationship: "Marcus is your business strategist and growth expert. Kaia is your technical co-founder who can build prototypes and review code. They work together to help you launch and scale your startup.",
    personas: [
      { name: "Marcus", role: "Business Strategist", model: "claude" },
      { name: "Kaia Dev", role: "Technical Co-founder", model: "mistral" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Market Research", icon: "🔍" },
        { id: "ora_get_strategy", label: "Business Strategy", icon: "📊" },
        { id: "ora_financial_calc", label: "Financial Projections", icon: "💰" },
        { id: "ora_generate_code", label: "Prototype Builder", icon: "💻" },
        { id: "ora_analyze_code", label: "Code Review", icon: "🔐" },
      ],
      options: [
        { id: "stage", label: "Startup Stage", type: "select", options: ["Idea", "Validation", "Prototype", "MVP", "Scaling", "Fundraising"], defaultValue: "Idea" },
        { id: "industry", label: "Industry", type: "select", options: ["Tech", "Finance", "Healthcare", "E-commerce", "SaaS", "Web3", "AI", "Other"], defaultValue: "Tech" },
        { id: "teamSize", label: "Team Size", type: "select", options: ["Solo", "2-5", "6-20", "20+"], defaultValue: "Solo" },
      ],
      skills: ["Idea validation", "Business strategy", "Market research", "Prototyping", "Fundraising", "Scaling"],
    },
    category: "business",
    tags: ["Startup", "Entrepreneurship", "Business Strategy", "MVP", "Fundraising", "Scaling"],
    gradient: "from-cyan-900/50 to-stone-950",
    accentColor: "cyan",
    icon: "🚀",
    invite: { mode: "many", label: "Invite co-founders", note: "Collaborate with your team" },
    popular: true,
    featured: true,
    platformValue: ["Idea validation", "Business strategy", "Market research", "Prototyping", "Fundraising guidance", "Scaling advice"],
    seoTitle: "KLOOM Startup Lab - Build Your Startup with AI",
    seoDescription: "Validate ideas, build MVPs, and scale your startup with AI co-founders. Get business strategy from Marcus and technical expertise from Kaia Dev.",
  },
  {
    id: "boardroom",
    name: "The Boardroom",
    tagline: "Executive decision-making with AI advisors",
    description: "A high-level strategy room for business leaders. Get executive-level advice on company direction, market positioning, competitive strategy, and growth initiatives from multiple AI perspectives.",
    shortDescription: "Executive strategy and decision-making",
    relationship: "This is an executive boardroom. Marcus provides strategic business insights. Claude offers analytical depth. Mistral brings market research. Together, they advise you on high-stakes business decisions.",
    personas: [
      { name: "Marcus", role: "Business Strategist", model: "claude" },
      { name: "Claude", role: "Analytical Advisor", model: "claude" },
      { name: "Mistral", role: "Market Researcher", model: "mistral" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Competitor Analysis", icon: "🏆" },
        { id: "ora_get_strategy", label: "Strategy Frameworks", icon: "📋" },
        { id: "ora_financial_calc", label: "Financial Modeling", icon: "💰" },
        { id: "ora_analyze_market", label: "Market Intelligence", icon: "📊" },
      ],
      options: [
        { id: "decision", label: "Decision Type", type: "select", options: ["Market Entry", "Product Launch", "Expansion", "Acquisition", "Pivot", "Fundraising"], defaultValue: "Product Launch" },
        { id: "timeline", label: "Timeline", type: "select", options: ["Immediate", "3-6 months", "6-12 months", "1-3 years", "3-5 years"], defaultValue: "6-12 months" },
        { id: "budget", label: "Budget Range", type: "select", options: ["$0-$50K", "$50K-$250K", "$250K-$1M", "$1M+"], defaultValue: "$50K-$250K" },
      ],
      skills: ["Strategic planning", "Competitive analysis", "Financial modeling", "Market intelligence", "Risk assessment", "Decision frameworks"],
    },
    category: "business",
    tags: ["Strategy", "Executive", "Decision Making", "Business", "Leadership", "Multi-AI"],
    gradient: "from-indigo-900/50 to-stone-950",
    accentColor: "indigo",
    icon: "🏢",
    premium: true,
    platformValue: ["Executive advice", "Strategic planning", "Competitive analysis", "Financial modeling", "Market intelligence", "Risk assessment"],
  },
  {
    id: "marketing-hq",
    name: "Marketing HQ",
    tagline: "Data-driven marketing campaigns",
    description: "Plan and execute marketing campaigns with AI experts. Get help with audience targeting, channel selection, content creation, and performance optimization across all digital marketing channels.",
    shortDescription: "Plan and execute marketing campaigns",
    relationship: "Sasha handles marketing strategy and execution. Mistral provides multilingual content support. Together, they help you create and optimize marketing campaigns.",
    personas: [
      { name: "Sasha", role: "Marketing Strategist", model: "gemini" },
      { name: "Mistral", role: "Content Creator", model: "mistral" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Market Research", icon: "🔍" },
        { id: "ora_get_strategy", label: "Campaign Strategy", icon: "📊" },
        { id: "ora_content_ideas", label: "Content Creation", icon: "💡" },
        { id: "ora_canva_design", label: "Design Assets", icon: "🎨" },
        { id: "ora_financial_calc", label: "ROI Calculation", icon: "💰" },
      ],
      options: [
        { id: "channel", label: "Primary Channel", type: "select", options: ["Social Media", "Email", "SEO", "Paid Ads", "Content Marketing", "Influencer", "PR"], defaultValue: "Social Media" },
        { id: "goal", label: "Campaign Goal", type: "select", options: ["Brand Awareness", "Lead Generation", "Sales", "Engagement", "Traffic"], defaultValue: "Brand Awareness" },
        { id: "budget", label: "Campaign Budget ($)", type: "number", defaultValue: 5000, description: "Total campaign budget" },
      ],
      skills: ["Campaign planning", "Audience targeting", "Content creation", "Channel selection", "Performance tracking", "ROI optimization"],
    },
    category: "business",
    tags: ["Marketing", "Campaigns", "Digital", "Growth", "ROI", "Multi-AI"],
    gradient: "from-purple-900/50 to-stone-950",
    accentColor: "purple",
    icon: "📢",
    platformValue: ["Campaign planning", "Audience targeting", "Content creation", "Channel strategy", "Performance tracking", "ROI optimization"],
  },

  // ============================================================================
  // SOCIAL & LIFESTYLE
  // ============================================================================
  {
    id: "social-lounge",
    name: "KLOOM Social Lounge",
    tagline: "Casual conversations with AI friends",
    description: "A relaxed space to chat with AI personas about anything. From casual banter to deep conversations, this is your social hangout with multiple AI personalities.",
    shortDescription: "Casual social conversations with AI",
    relationship: "This is a social lounge where you can chat with multiple AI personas in a relaxed setting. They have distinct personalities and will engage in casual, friendly conversation.",
    personas: [
      { name: "Charm", role: "Social Butterfly", model: "gemini" },
      { name: "Wit", role: "Quick-Witted Joker", model: "mistral" },
      { name: "Sage", role: "Wise Observer", model: "claude" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Topic Research", icon: "🔍" },
      ],
      options: [
        { id: "mood", label: "Conversation Mood", type: "select", options: ["Casual", "Deep", "Funny", "Thoughtful", "Random"], defaultValue: "Casual" },
        { id: "topic", label: "Suggested Topic", type: "select", options: ["None", "Movies & TV", "Music", "Books", "Travel", "Food", "Technology", "Sports"], defaultValue: "None" },
      ],
      skills: ["Casual conversation", "Social dynamics", "Humor", "Storytelling", "Active listening"],
    },
    category: "social",
    tags: ["Social", "Casual", "Conversation", "Multi-AI", "Friendship"],
    gradient: "from-purple-900/40 to-pink-900/40",
    accentColor: "purple",
    icon: "💬",
    invite: { mode: "many", label: "Invite friends", note: "Bring your friends to chat with AI" },
    popular: true,
    platformValue: ["Casual conversation", "Social interaction", "Humor and wit", "Thoughtful discussion", "Multi-personality dynamics"],
    seoTitle: "KLOOM Social Lounge - Chat with AI Friends",
    seoDescription: "Casual conversations with multiple AI personas. Chat, laugh, and discuss with Charm, Wit, and Sage in a relaxed social setting.",
  },
  {
    id: "dating-advice",
    name: "Dating & Relationship Hub",
    tagline: "Navigate love with AI guidance",
    description: "Get dating and relationship advice from multiple AI experts. Whether you're looking for love, navigating a relationship, or just want to understand dating dynamics better.",
    shortDescription: "Dating and relationship advice from AI experts",
    relationship: "Cupid handles dating strategy and attraction. Dr. Love provides relationship insights. Together, they offer comprehensive advice on all aspects of dating and relationships.",
    personas: [
      { name: "Cupid", role: "Dating Coach", model: "gemini" },
      { name: "Dr. Love", role: "Relationship Expert", model: "claude" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Dating Trends", icon: "📈" },
      ],
      options: [
        { id: "stage", label: "Relationship Stage", type: "select", options: ["Single", "Dating", "In a Relationship", "Engaged", "Married"], defaultValue: "Single" },
        { id: "focus", label: "Focus Area", type: "select", options: ["First Dates", "Online Dating", "Communication", "Conflict Resolution", "Long-Term", "Breakups"], defaultValue: "First Dates" },
      ],
      skills: ["Dating advice", "Relationship guidance", "Attraction insights", "Communication tips", "Conflict resolution"],
    },
    category: "social",
    tags: ["Dating", "Relationships", "Love", "Advice", "Multi-AI"],
    gradient: "from-rose-900/50 to-red-900/50",
    accentColor: "rose",
    icon: "💘",
    platformValue: ["Dating strategy", "Relationship advice", "Attraction insights", "Communication guidance", "Conflict resolution"],
  },
  {
    id: "fashion-studio",
    name: "Fashion Studio",
    tagline: "Style advice from AI fashion experts",
    description: "Get personalized fashion and style advice from AI stylists. Whether you need outfit ideas, wardrobe planning, or shopping recommendations, this is your go-to fashion room.",
    shortDescription: "Personalized fashion and style advice",
    relationship: "Dom handles personal styling and wardrobe planning. Trend provides fashion insights and shopping recommendations. Together, they help you look your best.",
    personas: [
      { name: "Dom", role: "Personal Stylist", model: "gemini" },
      { name: "Trend", role: "Fashion Insider", model: "mistral" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Fashion Trends", icon: "👗" },
        { id: "ora_canva_design", label: "Style Moodboards", icon: "🎨" },
      ],
      options: [
        { id: "occasion", label: "Occasion", type: "select", options: ["Casual", "Work", "Date Night", "Party", "Formal Event", "Workout", "Travel"], defaultValue: "Casual" },
        { id: "budget", label: "Budget", type: "select", options: ["Budget", "Mid-Range", "Luxury", "No Limit"], defaultValue: "Mid-Range" },
        { id: "season", label: "Season", type: "select", options: ["Spring", "Summer", "Fall", "Winter", "Year-Round"], defaultValue: "Year-Round" },
      ],
      skills: ["Personal styling", "Wardrobe planning", "Fashion trends", "Shopping recommendations", "Outfit coordination"],
    },
    category: "social",
    tags: ["Fashion", "Style", "Wardrobe", "Shopping", "Outfits", "Multi-AI"],
    gradient: "from-violet-900/50 to-purple-900/50",
    accentColor: "violet",
    icon: "👗",
    platformValue: ["Personal styling", "Wardrobe planning", "Fashion trends", "Shopping advice", "Outfit ideas"],
  },

  // ============================================================================
  // LEARNING & GROWTH
  // ============================================================================
  {
    id: "learning-lab",
    name: "KLOOM Learning Lab",
    tagline: "Master any skill with AI tutors",
    description: "Lingua teaches languages. Mentor guides career development. Pro helps you build skills. Together, they provide comprehensive learning support across all subjects and skills.",
    shortDescription: "Comprehensive learning and skill development",
    relationship: "Lingua is your language tutor. Mentor handles career and professional development. Pro focuses on skill mastery. They work together to help you learn anything.",
    personas: [
      { name: "Lingua", role: "Language Tutor", model: "mistral" },
      { name: "Mentor", role: "Career Coach", model: "claude" },
      { name: "Pro", role: "Skill Builder", model: "gemini" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Research", icon: "🔍" },
        { id: "ora_get_strategy", label: "Learning Paths", icon: "🗺️" },
        { id: "ora_analyze_code", label: "Code Review", icon: "💻" },
      ],
      options: [
        { id: "subject", label: "Subject Area", type: "select", options: ["Languages", "Technology", "Business", "Arts", "Science", "Mathematics", "History", "Other"], defaultValue: "Languages" },
        { id: "level", label: "Current Level", type: "select", options: ["Beginner", "Intermediate", "Advanced", "Expert"], defaultValue: "Beginner" },
        { id: "goal", label: "Learning Goal", type: "select", options: ["Fluency", "Proficiency", "Mastery", "Certification", "Practical Skills"], defaultValue: "Proficiency" },
      ],
      skills: ["Language learning", "Career development", "Skill building", "Personalized lessons", "Progress tracking", "Multi-subject support"],
    },
    category: "learning",
    tags: ["Learning", "Education", "Skills", "Tutoring", "Multi-AI", "Growth"],
    gradient: "from-blue-900/50 to-stone-950",
    accentColor: "blue",
    icon: "📚",
    invite: { mode: "many", label: "Invite study partners", note: "Study and learn with others" },
    popular: true,
    featured: true,
    platformValue: ["Personalized learning", "Multi-subject support", "Skill development", "Career guidance", "Language learning", "Progress tracking"],
    seoTitle: "KLOOM Learning Lab - Master Any Skill with AI",
    seoDescription: "Learn anything with AI tutors. Get language lessons from Lingua, career guidance from Mentor, and skill building from Pro.",
  },
  {
    id: "code-academy",
    name: "Code Academy",
    tagline: "Become a better developer with AI mentors",
    description: "Kaia Dev handles coding and architecture. Secure Max ensures your code is safe. Together, they provide comprehensive programming education and code review.",
    shortDescription: "Comprehensive programming education and code review",
    relationship: "Kaia is your senior developer and coding mentor. Secure Max is your security expert who reviews code for vulnerabilities. They work together to make you a better developer.",
    personas: [
      { name: "Kaia Dev", role: "Senior Developer", model: "claude" },
      { name: "Secure Max", role: "Security Expert", model: "openai" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_analyze_code", label: "Code Analysis", icon: "🔍" },
        { id: "ora_generate_code", label: "Code Generation", icon: "💻" },
        { id: "ora_web_search", label: "Documentation", icon: "📚" },
        { id: "ora_calculate", label: "Complexity Analysis", icon: "📊" },
      ],
      options: [
        { id: "language", label: "Programming Language", type: "select", options: ["TypeScript", "JavaScript", "Python", "Rust", "Go", "Java", "C++", "C#", "PHP", "Ruby", "Swift", "Kotlin"], defaultValue: "TypeScript" },
        { id: "project", label: "Project Type", type: "select", options: ["Web App", "Mobile App", "API", "CLI", "Game", "Library", "Script"], defaultValue: "Web App" },
        { id: "level", label: "Experience Level", type: "select", options: ["Beginner", "Intermediate", "Advanced", "Expert"], defaultValue: "Intermediate" },
      ],
      skills: ["Code review", "Programming education", "Architecture advice", "Security audit", "Best practices", "Debugging"],
    },
    category: "learning",
    tags: ["Coding", "Programming", "Development", "Code Review", "Multi-AI", "Education"],
    gradient: "from-cyan-900/50 to-blue-900/50",
    accentColor: "cyan",
    icon: "💻",
    popular: true,
    platformValue: ["Code review", "Programming lessons", "Architecture guidance", "Security audit", "Debugging help", "Best practices"],
  },
  {
    id: "language-exchange",
    name: "Language Exchange",
    tagline: "Practice languages with AI native speakers",
    description: "Practice speaking, listening, reading, and writing in any language with AI tutors. Get real-time feedback, vocabulary building, and conversation practice.",
    shortDescription: "Practice languages with AI tutors",
    relationship: "You are a language learner. The AI tutors are native speakers of various languages who help you practice and improve through conversation, exercises, and feedback.",
    personas: [
      { name: "Lingua", role: "Language Tutor", model: "mistral" },
      { name: "Professor", role: "Grammar Expert", model: "claude" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Language Resources", icon: "🌍" },
      ],
      options: [
        { id: "language", label: "Target Language", type: "select", options: ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Arabic", "Mandarin", "Japanese", "Korean", "Russian", "Hindi"], defaultValue: "English" },
        { id: "skill", label: "Focus Skill", type: "select", options: ["Speaking", "Listening", "Reading", "Writing", "Grammar", "Vocabulary", "Pronunciation"], defaultValue: "Speaking" },
        { id: "level", label: "Proficiency Level", type: "select", options: ["Beginner (A1-A2)", "Intermediate (B1-B2)", "Advanced (C1-C2)", "Fluent"], defaultValue: "Intermediate (B1-B2)" },
      ],
      skills: ["Language practice", "Conversation", "Grammar explanation", "Vocabulary building", "Pronunciation", "Cultural insights"],
    },
    category: "learning",
    tags: ["Languages", "Practice", "Tutoring", "Conversation", "Multi-AI", "Bilingual"],
    gradient: "from-emerald-900/50 to-teal-900/50",
    accentColor: "emerald",
    icon: "🌍",
    platformValue: ["Language practice", "Native speaker interaction", "Real-time feedback", "Vocabulary building", "Conversation practice", "Cultural insights"],
  },

  // ============================================================================
  // ENTERTAINMENT
  // ============================================================================
  {
    id: "gaming-hub",
    name: "Gaming Hub",
    tagline: "Level up with AI gaming companions",
    description: "Pixel handles game strategies and walkthroughs. Maestro provides the soundtrack and lore insights. Together, they enhance your gaming experience.",
    shortDescription: "Gaming strategies, walkthroughs, and companionship",
    relationship: "Pixel is your gaming guide with deep knowledge of games and strategies. Maestro provides musical and narrative context. They work together to enhance your gaming sessions.",
    personas: [
      { name: "Pixel", role: "Gaming Expert", model: "gemini" },
      { name: "Maestro", role: "Lore Master", model: "mistral" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Game Guides", icon: "📖" },
      ],
      options: [
        { id: "platform", label: "Gaming Platform", type: "select", options: ["PC", "PlayStation", "Xbox", "Nintendo Switch", "Mobile", "VR"], defaultValue: "PC" },
        { id: "genre", label: "Game Genre", type: "select", options: ["RPG", "FPS", "Strategy", "Adventure", "Puzzle", "Sports", "Racing", "Simulation"], defaultValue: "RPG" },
        { id: "mode", label: "Game Mode", type: "select", options: ["Single Player", "Multiplayer", "Co-op", "Competitive", "Story"], defaultValue: "Single Player" },
      ],
      skills: ["Game strategies", "Walkthroughs", "Lore explanation", "Character builds", "Gear recommendations", "Multiplayer tips"],
    },
    category: "entertainment",
    tags: ["Gaming", "Strategies", "Walkthroughs", "Lore", "Multi-AI", "Esports"],
    gradient: "from-orange-900/50 to-red-900/50",
    accentColor: "orange",
    icon: "🎮",
    invite: { mode: "many", label: "Invite teammates", note: "Play and strategize with friends" },
    popular: true,
    platformValue: ["Game strategies", "Walkthroughs", "Lore insights", "Character builds", "Gear recommendations", "Multiplayer coordination"],
  },
  {
    id: "movie-night",
    name: "Movie Night",
    tagline: "Discover and discuss films with AI cinephiles",
    description: "Cinephile recommends movies and provides analysis. Maestro shares insights about soundtracks and musical scores. Together, they create the perfect movie night experience.",
    shortDescription: "Movie recommendations and analysis",
    relationship: "Cinephile is your film expert with deep knowledge of movies and cinema. Maestro provides insights about music and soundtracks. They work together to enhance your movie-watching experience.",
    personas: [
      { name: "Cinephile", role: "Film Expert", model: "claude" },
      { name: "Maestro", role: "Soundtrack Analyst", model: "mistral" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Movie Database", icon: "🎬" },
      ],
      options: [
        { id: "genre", label: "Movie Genre", type: "select", options: ["Action", "Comedy", "Drama", "Sci-Fi", "Horror", "Romance", "Thriller", "Documentary", "Animation", "All"], defaultValue: "All" },
        { id: "mood", label: "Mood", type: "select", options: ["Exciting", "Funny", "Thought-Provoking", "Scary", "Romantic", "Inspiring", "Relaxing", "Any"], defaultValue: "Any" },
        { id: "era", label: "Era", type: "select", options: ["Classic", "Modern", "Recent", "All Time"], defaultValue: "All Time" },
      ],
      skills: ["Movie recommendations", "Film analysis", "Director insights", "Genre exploration", "Soundtrack appreciation", "Cultural context"],
    },
    category: "entertainment",
    tags: ["Movies", "Film", "Recommendations", "Analysis", "Multi-AI", "Cinephile"],
    gradient: "from-amber-900/50 to-orange-900/50",
    accentColor: "amber",
    icon: "🎬",
    platformValue: ["Movie recommendations", "Film analysis", "Director insights", "Genre exploration", "Soundtrack insights", "Cultural context"],
  },
  {
    id: "music-studio",
    name: "Music Studio",
    tagline: "Create and discover music with AI",
    description: "Jules provides music production expertise. Maestro shares insights about music theory and history. Together, they help you create, discover, and appreciate music.",
    shortDescription: "Music creation, production, and discovery",
    relationship: "Jules is your music producer with industry experience. Maestro provides insights about music theory, history, and appreciation. They work together to enhance your musical journey.",
    personas: [
      { name: "Jules", role: "Music Producer", model: "gemini" },
      { name: "Maestro", role: "Music Theorist", model: "mistral" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Music Resources", icon: "🎵" },
      ],
      options: [
        { id: "activity", label: "Activity", type: "select", options: ["Discovery", "Creation", "Analysis", "Learning", "Sharing"], defaultValue: "Discovery" },
        { id: "genre", label: "Music Genre", type: "select", options: ["Pop", "Rock", "Hip-Hop", "Electronic", "Classical", "Jazz", "R&B", "Country", "All"], defaultValue: "All" },
        { id: "mood", label: "Mood", type: "select", options: ["Happy", "Sad", "Energetic", "Relaxing", "Romantic", "Focused", "Any"], defaultValue: "Any" },
      ],
      skills: ["Music production", "Songwriting", "Mixing advice", "Artist discovery", "Music theory", "Genre exploration"],
    },
    category: "entertainment",
    tags: ["Music", "Production", "Discovery", "Creation", "Multi-AI", "Audio"],
    gradient: "from-violet-900/50 to-purple-900/50",
    accentColor: "violet",
    icon: "🎵",
    platformValue: ["Music production", "Songwriting help", "Mixing advice", "Artist discovery", "Music theory", "Genre exploration"],
  },

  // ============================================================================
  // WORKSHOP (Multi-AI Collaboration)
  // ============================================================================
  {
    id: "launch-war-room",
    name: "Launch War Room",
    tagline: "Claude + Gemini + Mistral. Ship together.",
    description: "A real working session for launching products. Claude architects the solution. Gemini stress-tests assumptions. Mistral provides multilingual support. Three AI minds, one launch.",
    shortDescription: "Multi-AI product launch collaboration",
    relationship: "This is a live working session for launching a product or business. Claude leads architecture and strategy. Gemini challenges assumptions and finds risks. Mistral provides multilingual support and additional perspectives. They build on each other's points directly and push toward a shippable product.",
    personas: [
      { name: "Claude", role: "Architect & Strategist", model: "claude",
        personality: "Precise, structured, deeply technical. You design systems and think in edge cases. You lead the architectural decisions.",
        speakingStyle: "Clear and direct. You lay out structure and explain key decisions. You reference other AIs by name when building on their points." },
      { name: "Gemini", role: "Stress-Tester & Researcher", model: "gemini",
        personality: "Sharp analyst who stress-tests every assumption. You research comparable products, find edge cases, and identify risks others miss.",
        speakingStyle: "Challenging but constructive. You pressure-test ideas against reality and data. You debate trade-offs openly." },
      { name: "Mistral", role: "Multilingual Specialist", model: "mistral",
        personality: "Multilingual expert with excellent coding and structured data capabilities. You provide additional perspectives and handle multilingual requirements.",
        speakingStyle: "Direct and structured. You provide clean, well-organized input and handle multiple languages seamlessly." },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Market Research", icon: "🔍" },
        { id: "ora_get_strategy", label: "Strategy Playbook", icon: "📖" },
        { id: "ora_generate_code", label: "Code Generation", icon: "💻" },
        { id: "ora_analyze_code", label: "Code Review", icon: "🔐" },
        { id: "ora_financial_calc", label: "Financial Modeling", icon: "💰" },
        { id: "ora_calculate", label: "Complex Calculations", icon: "🧮" },
        { id: "ora_build_html", label: "HTML/CSS Builder", icon: "🎨" },
        { id: "ora_build_connector", label: "API Integration", icon: "🔌" },
      ],
      options: [
        { id: "productType", label: "Product Type", type: "select", options: ["Web App", "Mobile App", "API", "Token", "NFT Collection", "DeFi Protocol", "SaaS", "Hardware", "Other"], defaultValue: "Web App" },
        { id: "stage", label: "Launch Stage", type: "select", options: ["Idea", "Prototype", "MVP", "Beta", "Pre-Launch", "Launch Day", "Post-Launch"], defaultValue: "Idea" },
        { id: "targetMarket", label: "Target Market", type: "select", options: ["B2C", "B2B", "Global", "Local", "Niche"], defaultValue: "B2C" },
        { id: "multilingual", label: "Multilingual Support", type: "toggle", defaultValue: false, description: "Enable multilingual features" },
      ],
      skills: ["Product architecture", "Market research", "Strategy development", "Code generation", "Code review", "Financial modeling", "API integration", "Multi-AI collaboration"],
    },
    category: "workshop",
    tags: ["Multi-AI", "Launch", "Product", "Collaboration", "Claude", "Gemini", "Mistral"],
    gradient: "from-purple-900/50 to-cyan-900/50",
    accentColor: "purple",
    icon: "🚀",
    invite: { mode: "many", label: "Invite team members", note: "Collaborate with your launch team" },
    featured: true,
    platformValue: ["Multi-AI collaboration", "Product architecture", "Market research", "Code generation", "Strategy development", "Launch planning", "Team coordination"],
    seoTitle: "Launch War Room - Multi-AI Product Launch Collaboration",
    seoDescription: "Launch your product with three AI experts. Claude architects, Gemini stress-tests, and Mistral provides multilingual support.",
  },
  {
    id: "build-studio",
    name: "Build Studio",
    tagline: "Claude writes. Gemini reviews. Mistral optimizes.",
    description: "The ultimate coding collaboration room. Claude writes clean, production-ready code. Gemini reviews every line and catches bugs. Mistral optimizes for performance and provides multilingual support.",
    shortDescription: "Multi-AI coding collaboration",
    relationship: "A pair-programming session with three AIs. Claude writes the implementation. Gemini reviews every block, catches bugs, and suggests improvements. Mistral optimizes code, handles multilingual requirements, and provides structured data support. They debate trade-offs and converge on the best solution.",
    personas: [
      { name: "Claude", role: "Lead Engineer - Writes Code", model: "claude",
        personality: "Senior engineer who writes clean, typed, production-ready code. You explain key decisions in one line and move fast.",
        speakingStyle: "Code-first. You write the implementation, then say what matters. You take reviews seriously and revise when needed." },
      { name: "Gemini", role: "Code Reviewer - Catches Bugs", model: "gemini",
        personality: "Meticulous reviewer who finds the bug everyone else missed. Edge cases, security, performance - nothing gets past you.",
        speakingStyle: "Direct critique with the fix attached. You praise good code too and suggest better approaches." },
      { name: "Mistral", role: "Optimizer - Improves Code", model: "mistral",
        personality: "Optimization expert who improves code quality, performance, and structure. Excellent with structured data and multilingual requirements.",
        speakingStyle: "Structured and precise. You provide clean, well-formatted improvements and handle multiple languages." },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_generate_code", label: "Code Generation", icon: "💻" },
        { id: "ora_analyze_code", label: "Code Review", icon: "🔐" },
        { id: "ora_build_html", label: "HTML/CSS Builder", icon: "🎨" },
        { id: "ora_build_connector", label: "API Connector", icon: "🔌" },
        { id: "ora_web_search", label: "Docs Lookup", icon: "📚" },
        { id: "ora_calculate", label: "Complexity Analysis", icon: "📐" },
      ],
      options: [
        { id: "language", label: "Primary Language", type: "select", options: ["TypeScript", "Python", "Rust", "Solidity", "Go", "Java", "C++", "C#", "PHP", "Ruby"], defaultValue: "TypeScript" },
        { id: "project", label: "Project Name", type: "text", defaultValue: "" },
        { id: "framework", label: "Framework", type: "select", options: ["None", "React", "Next.js", "Vue", "Angular", "Express", "Django", "Flask", "Spring", "Laravel"], defaultValue: "None" },
        { id: "multilingual", label: "Multilingual Code", type: "toggle", defaultValue: false, description: "Support multiple languages" },
      ],
      skills: ["Live coding", "Code review", "Code optimization", "HTML/CSS builds", "API connectors", "Architecture", "Pair programming", "Multi-AI collaboration"],
    },
    category: "workshop",
    tags: ["Multi-AI", "Coding", "Programming", "Code Review", "Claude", "Gemini", "Mistral"],
    gradient: "from-cyan-900/50 to-blue-900/50",
    accentColor: "cyan",
    icon: "💻",
    popular: true,
    platformValue: ["Multi-AI coding", "Code generation", "Code review", "Code optimization", "Architecture advice", "Pair programming", "Bug catching"],
  },
  {
    id: "growth-boardroom",
    name: "Growth Boardroom",
    tagline: "Claude strategizes. Gemini researches. Mistral executes.",
    description: "A strategy room for creators and founders. Claude structures the growth strategy and frameworks. Gemini pulls live market data and competitor research. Mistral provides multilingual content and execution support.",
    shortDescription: "Multi-AI growth strategy and execution",
    relationship: "A strategy session for a creator or founder. Claude structures the growth strategy and frameworks. Gemini researches competitors, trends, and live market signals. Mistral provides multilingual content support and execution guidance. They challenge each other and synthesize a concrete plan with numbers.",
    personas: [
      { name: "Claude", role: "Strategist - Builds Frameworks", model: "claude",
        personality: "Strategic thinker who builds clear frameworks from messy goals. You structure the plan and define the metrics that matter.",
        speakingStyle: "Framework-driven. You build on data and research from the other AIs." },
      { name: "Gemini", role: "Researcher - Finds Data", model: "gemini",
        personality: "Research analyst who grounds every strategy in real data - competitors, trends, benchmarks. You bring the numbers.",
        speakingStyle: "Evidence-first. You pressure-test frameworks against reality." },
      { name: "Mistral", role: "Executor - Implements Plans", model: "mistral",
        personality: "Execution expert who turns strategies into actionable plans. Excellent with structured data, multilingual content, and implementation details.",
        speakingStyle: "Action-oriented. You provide clear, structured implementation guidance." },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Market Research", icon: "🔍" },
        { id: "ora_get_strategy", label: "Playbooks", icon: "📖" },
        { id: "ora_instagram_caption", label: "Content Creation", icon: "✍️" },
        { id: "ora_content_ideas", label: "Content Ideas", icon: "💡" },
        { id: "ora_canva_design", label: "Design", icon: "🎨" },
        { id: "ora_financial_calc", label: "Projections", icon: "🧮" },
      ],
      options: [
        { id: "domain", label: "Domain", type: "select", options: ["Content Creator", "SaaS Startup", "Crypto Project", "E-commerce", "Personal Brand", "Non-Profit", "Agency"], defaultValue: "Content Creator" },
        { id: "goal", label: "Primary Goal", type: "text", defaultValue: "" },
        { id: "timeline", label: "Timeline (months)", type: "number", defaultValue: 6, description: "Growth timeline in months" },
        { id: "budget", label: "Monthly Budget ($)", type: "number", defaultValue: 5000, description: "Marketing and growth budget" },
      ],
      skills: ["Growth strategy", "Competitor research", "Content planning", "Financial projections", "Positioning", "Live market data", "Execution planning", "Multi-AI collaboration"],
    },
    category: "workshop",
    tags: ["Multi-AI", "Growth", "Strategy", "Marketing", "Claude", "Gemini", "Mistral"],
    gradient: "from-orange-900/50 to-pink-900/50",
    accentColor: "orange",
    icon: "📈",
    featured: true,
    platformValue: ["Multi-AI strategy", "Growth planning", "Competitor research", "Content planning", "Financial projections", "Market analysis", "Execution support"],
  },

  // ============================================================================
  // PREMIUM ROOMS
  // ============================================================================
  {
    id: "executive-suite",
    name: "Executive Suite",
    tagline: "C-level decision making with AI advisors",
    description: "An exclusive room for executive-level decisions. Get advice on company direction, M&A, fundraising, and high-stakes business decisions from a team of specialized AI advisors.",
    shortDescription: "Executive-level business advice",
    relationship: "This is an executive suite for C-level decisions. Each AI has a specialized role: Strategist for overall direction, Analyst for data, Legal for compliance, and Financial for numbers. They provide comprehensive advice on high-stakes decisions.",
    personas: [
      { name: "Strategist", role: "Business Strategy", model: "claude" },
      { name: "Analyst", role: "Market Intelligence", model: "gemini" },
      { name: "Legal", role: "Compliance & Risk", model: "openai" },
      { name: "Financial", role: "Financial Modeling", model: "mistral" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Industry Research", icon: "🔍" },
        { id: "ora_get_strategy", label: "Strategy Frameworks", icon: "📋" },
        { id: "ora_financial_calc", label: "Financial Models", icon: "💰" },
        { id: "ora_analyze_market", label: "Market Analysis", icon: "📊" },
      ],
      options: [
        { id: "decisionType", label: "Decision Type", type: "select", options: ["M&A", "Fundraising", "Expansion", "Pivot", "Restructuring", "Partnership", "Other"], defaultValue: "Fundraising" },
        { id: "companySize", label: "Company Size", type: "select", options: ["Startup", "SMB", "Mid-Market", "Enterprise"], defaultValue: "Startup" },
        { id: "confidentiality", label: "Confidential Mode", type: "toggle", defaultValue: true, description: "Enable enhanced privacy" },
      ],
      skills: ["Executive advice", "M&A strategy", "Fundraising", "Market intelligence", "Financial modeling", "Risk assessment", "Compliance", "High-stakes decisions"],
    },
    category: "premium",
    tags: ["Executive", "C-Level", "Business", "Strategy", "M&A", "Fundraising", "Premium"],
    gradient: "from-amber-900/40 to-orange-900/40",
    accentColor: "amber",
    icon: "👔",
    invite: { mode: "one", label: "Invite executive team", note: "Exclusive access for leadership", requiresSub: true },
    premium: true,
    platformValue: ["Executive advice", "M&A strategy", "Fundraising guidance", "Market intelligence", "Financial modeling", "Risk assessment", "Compliance review", "High-stakes decision support"],
  },
  {
    id: "vip-lounge",
    name: "VIP Lounge",
    tagline: "Exclusive access to all KLOOM features",
    description: "The ultimate KLOOM experience with all premium features unlocked. Access exclusive AI personas, priority support, and advanced capabilities in one premium room.",
    shortDescription: "All premium features in one exclusive room",
    relationship: "This is an exclusive VIP room with access to all premium AI personas and capabilities. Each AI has a specialized role and provides the highest level of service and expertise.",
    personas: [
      { name: "Viktor Sol", role: "Premium Trader", model: "claude" },
      { name: "Zara", role: "Premium Strategist", model: "gemini" },
      { name: "Kaia Dev", role: "Premium Engineer", model: "openai" },
      { name: "Madame Selene", role: "Premium Advisor", model: "mistral" },
    ],
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Premium Research", icon: "🔍" },
        { id: "ora_get_crypto_price", label: "Live Market Data", icon: "📊" },
        { id: "ora_get_strategy", label: "Advanced Strategy", icon: "📋" },
        { id: "ora_analyze_code", label: "Priority Code Review", icon: "💻" },
        { id: "ora_financial_calc", label: "Advanced Calculations", icon: "🧮" },
      ],
      options: [
        { id: "priority", label: "Support Priority", type: "select", options: ["Standard", "High", "Urgent"], defaultValue: "High" },
        { id: "customPersona", label: "Custom Persona", type: "toggle", defaultValue: false, description: "Enable custom AI personas" },
      ],
      skills: ["All premium features", "Priority support", "Exclusive personas", "Advanced capabilities", "Multi-AI collaboration", "Custom configurations"],
    },
    category: "premium",
    tags: ["VIP", "Premium", "Exclusive", "All Features", "Priority", "Custom"],
    gradient: "from-purple-900/30 to-pink-900/30",
    accentColor: "gold",
    icon: "👑",
    invite: { mode: "one", label: "Invite VIP guest", note: "Exclusive access for premium members", requiresSub: true },
    premium: true,
    platformValue: ["All premium features", "Priority support", "Exclusive personas", "Advanced capabilities", "Custom configurations", "Multi-AI collaboration"],
  },
]

// Filter rooms by category
export function getRoomsByCategory(category: RoomCategory): Room[] {
  return ROOMS.filter((r) => r.category === category)
}

// Get featured rooms
export function getFeaturedRooms(): Room[] {
  return ROOMS.filter((r) => r.featured)
}

// Get popular rooms
export function getPopularRooms(): Room[] {
  return ROOMS.filter((r) => r.popular)
}

// Get premium rooms
export function getPremiumRooms(): Room[] {
  return ROOMS.filter((r) => r.premium)
}

// Search rooms
export function searchRooms(query: string): Room[] {
  const q = query.toLowerCase()
  return ROOMS.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.tagline.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.shortDescription?.toLowerCase().includes(q) ||
      r.tags.some((t) => t.toLowerCase().includes(q)) ||
      r.personas.some((p) => p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q))
  )
}

// Get rooms by tag
export function getRoomsByTag(tag: string): Room[] {
  return ROOMS.filter((r) => r.tags.includes(tag))
}

// Get rooms by persona
export function getRoomsByPersona(personaName: string): Room[] {
  return ROOMS.filter((r) => r.personas.some((p) => p.name === personaName))
}
