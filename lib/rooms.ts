/**
 * KLOOM Room Definitions
 * 
 * Platform Concept:
 * - Multi-character conference voice chat
 * - Rooms are TOPICS, not people
 * - No one-person rooms (one-person chat only via profile from a room)
 * - Partial/total unrestriction (only 3 blocked: army, killing, fraud)
 * - Teaching first, then support in implementation
 * - Default model per room, premium models for unrestricted topics
 * - Adult rooms: NO model change allowed
 * - Deep AI section for unusual AI use cases
 */

// ============================================================================
// ROOM TYPES AND INTERFACES
// ============================================================================

export type RoomCategory = 
  | "social"      // Social interactions and lifestyle
  | "limitless"  // Unrestricted, boundary-pushing topics
  | "depth"      // Deep, focused expertise areas
  | "earn"       // Money-making, trading, business
  | "learn"      // Educational and skill-building
  | "fantasy"    // Imaginative, creative, roleplay
  | "deep-ai"    // Advanced AI usage and unusual applications

export type SeatModel = "local" | "claude" | "gemini" | "openai" | "mistral"

export interface RoomPersona {
  name: string
  role: string
  model: SeatModel  // Default model - NO user selection in rooms
  personality?: string
  speakingStyle?: string
  voice?: "alloy" | "ash" | "ballad" | "coral" | "echo" | "sage" | "shimmer" | "verse"
  voiceId?: string
  gender?: "female" | "male" | "nonbinary"
  avatarSeed?: string
  // Model is FIXED for this persona - cannot be changed by users
  modelLocked?: boolean  // true = model cannot be changed
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

export interface RoomRestrictions {
  blockedTopics?: string[]  // Topics that cannot be discussed
  allowedTopics?: string[]  // Topics that CAN be discussed (if restricted)
  unrestricted?: boolean    // Room allows unrestricted content
  premiumModelRequired?: boolean  // Requires premium model for certain features
  modelChangeAllowed?: boolean   // Can users change models in this room?
}

export interface Room {
  id: string
  name: string
  tagline: string
  description: string
  shortDescription?: string
  
  // Room concept - TOPIC, not person
  topic: string  // The main topic of the room
  
  // Personas in the room (2-4 typically)
  personas: RoomPersona[]
  
  // Room behavior
  relationship: string  // How personas relate to each other and users
  
  // Capabilities
  capabilities: RoomCapabilities
  
  // Restrictions
  restrictions: RoomRestrictions
  
  // Categorization
  category: RoomCategory
  tags: string[]
  
  // Visual identity
  gradient: string
  accentColor: string
  icon?: string  // Emoji for the room
  
  // Discovery
  popular?: boolean
  featured?: boolean
  new?: boolean
  premium?: boolean
  adult?: boolean  // Adult content room
  
  // Platform value
  platformValue?: string[]
  
  // SEO
  seoTitle?: string
  seoDescription?: string
  
  // Teaching vs Implementation balance
  teachingRatio?: number  // 0-100, percentage focused on teaching vs implementation
}

// ============================================================================
// ROOM CATEGORIES
// ============================================================================

export const ROOM_CATEGORIES: RoomCategory[] = [
  "social",
  "limitless", 
  "depth",
  "earn",
  "learn",
  "fantasy",
  "deep-ai",
]

// Category labels for UI
export const ROOM_CATEGORY_LABELS: Record<RoomCategory, { label: string; icon: string; color: string; description: string }> = {
  social: {
    label: "Social",
    icon: "👥",
    color: "purple",
    description: "Social interactions, relationships, and lifestyle discussions"
  },
  limitless: {
    label: "Limitless", 
    icon: "🚀",
    color: "cyan",
    description: "Unrestricted exploration of any topic (except blocked ones)"
  },
  depth: {
    label: "Depth",
    icon: "🔬",
    color: "emerald",
    description: "Deep dives into specialized knowledge areas"
  },
  earn: {
    label: "Earn",
    icon: "💰",
    color: "amber",
    description: "Money-making, trading, business, and financial topics"
  },
  learn: {
    label: "Learn",
    icon: "📚",
    color: "blue",
    description: "Educational content, skill-building, and knowledge sharing"
  },
  fantasy: {
    label: "Fantasy",
    icon: "✨",
    color: "pink",
    description: "Imaginative, creative, and roleplay scenarios"
  },
  "deep-ai": {
    label: "Deep AI",
    icon: "🤖",
    color: "orange",
    description: "Advanced AI applications and unusual use cases"
  },
}

// ============================================================================
// BLOCKED TOPICS (Platform-wide)
// ============================================================================
// Only these 3 topics are blocked across the entire platform
export const BLOCKED_TOPICS = ["army", "killing", "fraud"]

// ============================================================================
// ROOM DEFINITIONS
// ============================================================================

export const ROOMS: Room[] = [
  
  // ==========================================================================
  // SOCIAL ROOMS - Social interactions and lifestyle
  // ==========================================================================
  
  {
    id: "social-lounge",
    name: "Social Lounge",
    tagline: "Casual conversations and social connections",
    description: "A relaxed space for social interactions, making friends, and discussing everyday topics. Multiple AI personalities provide different perspectives on social situations, relationships, and lifestyle choices.",
    shortDescription: "Casual social conversations with AI companions",
    topic: "Social interactions and lifestyle",
    
    personas: [
      { name: "Alex", role: "Social Connector", model: "mistral", modelLocked: true },
      { name: "Jamie", role: "Relationship Advisor", model: "claude", modelLocked: true },
      { name: "Taylor", role: "Lifestyle Guru", model: "gemini", modelLocked: true },
    ],
    
    relationship: "Alex facilitates connections, Jamie provides relationship insights, Taylor shares lifestyle tips. Together they create a welcoming social atmosphere where you can discuss dating, friendships, and social dynamics.",
    
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Social Trends", icon: "📈" },
        { id: "ora_content_ideas", label: "Conversation Starters", icon: "💬" },
      ],
      options: [
        { id: "mood", label: "Conversation Mood", type: "select", options: ["Casual", "Deep", "Fun", "Serious"], defaultValue: "Casual" },
        { id: "topic", label: "Focus Topic", type: "select", options: ["Dating", "Friendship", "Family", "Social Media", "General"], defaultValue: "General" },
      ],
      skills: ["Social dynamics", "Relationship advice", "Conversation skills", "Lifestyle tips"],
    },
    
    restrictions: {
      blockedTopics: BLOCKED_TOPICS,
      modelChangeAllowed: false,
    },
    
    category: "social",
    tags: ["Social", "Dating", "Friendship", "Lifestyle", "Casual"],
    gradient: "from-purple-900/60 to-stone-950",
    accentColor: "purple",
    icon: "👥",
    popular: true,
    featured: true,
    teachingRatio: 60,
    
    platformValue: [
      "Multi-AI social perspectives",
      "Relationship and dating advice",
      "Lifestyle discussions",
      "Casual conversation practice"
    ],
    
    seoTitle: "Social Lounge - Multi-AI Social Conversations",
    seoDescription: "Connect with AI companions for social discussions, dating advice, and lifestyle conversations. Multiple personalities provide diverse perspectives.",
  },

  {
    id: "dating-coach",
    name: "Dating Coach",
    tagline: "Master the art of attraction and relationships",
    description: "Get expert advice on dating, attraction, and relationships from multiple AI coaches. Learn flirting techniques, understand relationship dynamics, and build confidence in your social interactions.",
    shortDescription: "Expert dating and relationship coaching",
    topic: "Dating, attraction, and relationships",
    
    personas: [
      { name: "Cupid", role: "Attraction Specialist", model: "mistral", modelLocked: true },
      { name: "Dr. Love", role: "Relationship Expert", model: "claude", modelLocked: true },
    ],
    
    relationship: "Cupid teaches attraction techniques and flirting skills. Dr. Love provides deep relationship insights and emotional intelligence. Together they help you navigate the complex world of dating and relationships.",
    
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Dating Trends", icon: "📊" },
        { id: "ora_content_ideas", label: "Flirting Tips", icon: "💘" },
      ],
      options: [
        { id: "gender", label: "Your Gender", type: "select", options: ["Male", "Female", "Non-binary", "Prefer not to say"], defaultValue: "Prefer not to say" },
        { id: "orientation", label: "Sexual Orientation", type: "select", options: ["Heterosexual", "Homosexual", "Bisexual", "Pansexual", "Asexual", "Prefer not to say"], defaultValue: "Prefer not to say" },
      ],
      skills: ["Attraction techniques", "Flirting skills", "Relationship advice", "Emotional intelligence"],
    },
    
    restrictions: {
      blockedTopics: BLOCKED_TOPICS,
      modelChangeAllowed: false,
    },
    
    category: "social",
    tags: ["Dating", "Attraction", "Relationships", "Flirting", "Coaching"],
    gradient: "from-rose-900/60 to-stone-950",
    accentColor: "rose",
    icon: "💘",
    popular: true,
    teachingRatio: 70,
    
    platformValue: [
      "Attraction and flirting techniques",
      "Relationship dynamics insights",
      "Dating confidence building",
      "Personalized relationship advice"
    ],
  },

  // ==========================================================================
  // LIMITLESS ROOMS - Unrestricted exploration
  // ==========================================================================
  
  {
    id: "unrestricted-lab",
    name: "Unrestricted Lab",
    tagline: "Explore any topic without boundaries",
    description: "A space for unrestricted exploration of any topic (except the 3 blocked ones). Discuss trading strategies, hacking concepts, adult topics, or anything else. The AI provides teaching first, then support in implementation.",
    shortDescription: "Unrestricted discussion of any topic",
    topic: "Any topic except army, killing, fraud",
    
    personas: [
      { name: "Professor X", role: "Unrestricted Teacher", model: "mistral", modelLocked: true },
      { name: "Deep Thinker", role: "Concept Explorer", model: "claude", modelLocked: true },
    ],
    
    relationship: "Professor X teaches concepts and theories. Deep Thinker explores implications and applications. Together they provide unrestricted knowledge sharing with a focus on education first, implementation support second.",
    
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Research", icon: "🔍" },
        { id: "ora_calculate", label: "Calculations", icon: "🧮" },
        { id: "ora_analyze_code", label: "Code Analysis", icon: "💻" },
      ],
      options: [
        { id: "depth", label: "Depth Level", type: "select", options: ["Surface", "Moderate", "Deep", "Expert"], defaultValue: "Moderate" },
        { id: "focus", label: "Focus Area", type: "select", options: ["Theory", "Practical", "Both"], defaultValue: "Both" },
      ],
      skills: ["Unrestricted teaching", "Concept exploration", "Implementation support", "Deep analysis"],
    },
    
    restrictions: {
      blockedTopics: BLOCKED_TOPICS,
      unrestricted: true,
      modelChangeAllowed: false,
    },
    
    category: "limitless",
    tags: ["Unrestricted", "Exploration", "Teaching", "Implementation", "Any Topic"],
    gradient: "from-cyan-900/60 to-stone-950",
    accentColor: "cyan",
    icon: "🚀",
    popular: true,
    featured: true,
    teachingRatio: 80,
    
    platformValue: [
      "Unrestricted knowledge sharing",
      "Teaching-first approach",
      "Implementation support",
      "Any topic exploration"
    ],
    
    seoTitle: "Unrestricted Lab - Explore Any Topic",
    seoDescription: "Discuss any topic (except army, killing, fraud) with AI teachers. Get educational content first, implementation support second.",
  },

  {
    id: "trading-arena",
    name: "Trading Arena",
    tagline: "Unrestricted trading strategies and market analysis",
    description: "Discuss any trading strategy, market manipulation technique, or financial concept. Learn advanced trading methods, risk management, and market psychology. Teaching first, then support in implementation.",
    shortDescription: "Unrestricted trading discussions and strategies",
    topic: "Trading, markets, and financial strategies",
    
    personas: [
      { name: "Viktor Sol", role: "Trading Strategist", model: "claude", modelLocked: true },
      { name: "Market Maker", role: "Liquidity Expert", model: "mistral", modelLocked: true },
    ],
    
    relationship: "Viktor Sol teaches trading strategies and market analysis. Market Maker explains liquidity dynamics and order book strategies. Together they provide unrestricted trading education with implementation support.",
    
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_get_crypto_price", label: "Live Prices", icon: "📊" },
        { id: "ora_get_multi_price", label: "Compare Assets", icon: "⚖️" },
        { id: "ora_analyze_market", label: "Market Analysis", icon: "🔍" },
        { id: "ora_calculate", label: "Risk Calculation", icon: "🧮" },
        { id: "ora_web_search", label: "Market News", icon: "📰" },
      ],
      options: [
        { id: "market", label: "Market", type: "select", options: ["Crypto", "Stocks", "Forex", "Commodities", "All"], defaultValue: "Crypto" },
        { id: "strategy", label: "Strategy Type", type: "select", options: ["Day Trading", "Swing Trading", "Position Trading", "Scalping", "Arbitrage"], defaultValue: "Swing Trading" },
      ],
      skills: ["Trading strategies", "Market analysis", "Risk management", "Liquidity dynamics", "Order book analysis"],
    },
    
    restrictions: {
      blockedTopics: BLOCKED_TOPICS,
      unrestricted: true,
      modelChangeAllowed: false,
    },
    
    category: "limitless",
    tags: ["Trading", "Markets", "Strategies", "Unrestricted", "Financial"],
    gradient: "from-emerald-900/60 to-stone-950",
    accentColor: "emerald",
    icon: "📈",
    popular: true,
    teachingRatio: 75,
    
    platformValue: [
      "Unrestricted trading education",
      "Live market data",
      "Advanced trading strategies",
      "Risk management techniques",
      "Implementation support"
    ],
  },

  {
    id: "hacking-academy",
    name: "Hacking Academy",
    tagline: "Learn cybersecurity and ethical hacking concepts",
    description: "Explore cybersecurity, penetration testing, and ethical hacking concepts. Learn about vulnerabilities, exploitation techniques, and defensive strategies. Teaching first - we explain how things work, then support in implementation for educational purposes.",
    shortDescription: "Cybersecurity and ethical hacking education",
    topic: "Cybersecurity, hacking, and ethical penetration testing",
    
    personas: [
      { name: "Security Sensei", role: "Cybersecurity Teacher", model: "claude", modelLocked: true },
      { name: "Code Breaker", role: "Exploitation Expert", model: "mistral", modelLocked: true },
    ],
    
    relationship: "Security Sensei teaches cybersecurity fundamentals and defensive strategies. Code Breaker explains exploitation techniques and vulnerability analysis. Together they provide comprehensive security education with a strong teaching-first approach.",
    
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Security Research", icon: "🔍" },
        { id: "ora_analyze_code", label: "Code Analysis", icon: "💻" },
        { id: "ora_generate_code", label: "PoC Generation", icon: "📝" },
      ],
      options: [
        { id: "level", label: "Skill Level", type: "select", options: ["Beginner", "Intermediate", "Advanced", "Expert"], defaultValue: "Intermediate" },
        { id: "focus", label: "Focus Area", type: "select", options: ["Web Security", "Network Security", "Reverse Engineering", "Malware Analysis", "CTF Challenges"], defaultValue: "Web Security" },
      ],
      skills: ["Cybersecurity fundamentals", "Penetration testing", "Vulnerability analysis", "Exploitation techniques", "Defensive strategies"],
    },
    
    restrictions: {
      blockedTopics: BLOCKED_TOPICS,
      unrestricted: true,
      premiumModelRequired: true,  // Uses premium model for less restrictions
      modelChangeAllowed: false,  // Model is fixed, but uses premium
    },
    
    category: "limitless",
    tags: ["Hacking", "Cybersecurity", "Penetration Testing", "Ethical Hacking", "Security"],
    gradient: "from-red-900/60 to-stone-950",
    accentColor: "red",
    icon: "🔓",
    premium: true,
    teachingRatio: 85,
    
    platformValue: [
      "Comprehensive security education",
      "Ethical hacking concepts",
      "Vulnerability analysis",
      "Teaching-first approach",
      "Premium model access"
    ],
    
    seoTitle: "Hacking Academy - Ethical Hacking and Cybersecurity Education",
    seoDescription: "Learn cybersecurity, penetration testing, and ethical hacking concepts. Teaching first, implementation support second.",
  },

  // ==========================================================================
  // DEPTH ROOMS - Deep dives into specialized knowledge
  // ==========================================================================
  
  {
    id: "ai-research",
    name: "AI Research Lab",
    tagline: "Deep dive into artificial intelligence",
    description: "Explore the cutting edge of AI research, model architectures, and machine learning techniques. Discuss papers, implement algorithms, and push the boundaries of what's possible with AI.",
    shortDescription: "Advanced AI research and development",
    topic: "Artificial intelligence, machine learning, and AI research",
    
    personas: [
      { name: "Dr. Neural", role: "AI Researcher", model: "claude", modelLocked: true },
      { name: "Math Genius", role: "Mathematical Modeler", model: "mistral", modelLocked: true },
    ],
    
    relationship: "Dr. Neural explains AI concepts and research papers. Math Genius provides the mathematical foundations and implementations. Together they create a powerful research environment for deep AI exploration.",
    
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Research Papers", icon: "📄" },
        { id: "ora_analyze_code", label: "Algorithm Analysis", icon: "🔢" },
        { id: "ora_calculate", label: "Mathematical Proofs", icon: "➗" },
        { id: "ora_generate_code", label: "Model Implementation", icon: "🤖" },
      ],
      options: [
        { id: "domain", label: "AI Domain", type: "select", options: ["LLMs", "Computer Vision", "Reinforcement Learning", "Generative Models", "Neurosymbolic AI"], defaultValue: "LLMs" },
        { id: "framework", label: "Framework", type: "select", options: ["PyTorch", "TensorFlow", "JAX", "Keras", "Any"], defaultValue: "PyTorch" },
      ],
      skills: ["AI research", "Model architecture", "Mathematical modeling", "Algorithm implementation", "Paper analysis"],
    },
    
    restrictions: {
      blockedTopics: BLOCKED_TOPICS,
      modelChangeAllowed: false,
    },
    
    category: "depth",
    tags: ["AI", "Machine Learning", "Research", "Algorithms", "Deep Learning"],
    gradient: "from-blue-900/60 to-stone-950",
    accentColor: "blue",
    icon: "🧠",
    featured: true,
    teachingRatio: 90,
    
    platformValue: [
      "Cutting-edge AI research",
      "Model architecture expertise",
      "Mathematical foundations",
      "Algorithm implementation",
      "Paper analysis"
    ],
  },

  {
    id: "quantum-computing",
    name: "Quantum Computing",
    tagline: "Explore the future of computation",
    description: "Dive into quantum computing concepts, algorithms, and applications. Learn about qubits, quantum gates, and quantum algorithms. Discuss the latest research and practical implementations.",
    shortDescription: "Quantum computing education and exploration",
    topic: "Quantum computing, quantum algorithms, and quantum theory",
    
    personas: [
      { name: "Quantum Professor", role: "Quantum Educator", model: "claude", modelLocked: true },
      { name: "Qubit Master", role: "Quantum Algorithm Expert", model: "mistral", modelLocked: true },
    ],
    
    relationship: "Quantum Professor explains quantum computing fundamentals and theory. Qubit Master implements quantum algorithms and circuits. Together they provide comprehensive quantum computing education.",
    
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Quantum Research", icon: "🔬" },
        { id: "ora_calculate", label: "Quantum Calculations", icon: "➗" },
        { id: "ora_generate_code", label: "Circuit Generation", icon: "🔌" },
      ],
      options: [
        { id: "level", label: "Complexity", type: "select", options: ["Beginner", "Intermediate", "Advanced"], defaultValue: "Intermediate" },
        { id: "focus", label: "Focus", type: "select", options: ["Theory", "Algorithms", "Hardware", "Applications"], defaultValue: "Algorithms" },
      ],
      skills: ["Quantum theory", "Quantum algorithms", "Quantum circuits", "Quantum computing applications"],
    },
    
    restrictions: {
      blockedTopics: BLOCKED_TOPICS,
      modelChangeAllowed: false,
    },
    
    category: "depth",
    tags: ["Quantum", "Computing", "Algorithms", "Physics", "Future Tech"],
    gradient: "from-violet-900/60 to-stone-950",
    accentColor: "violet",
    icon: "⚛️",
    teachingRatio: 95,
    
    platformValue: [
      "Quantum computing education",
      "Quantum algorithm expertise",
      "Theoretical foundations",
      "Practical implementations"
    ],
  },

  // ==========================================================================
  // EARN ROOMS - Money-making and financial topics
  // ==========================================================================
  
  {
    id: "crypto-trading",
    name: "Crypto Trading Hub",
    tagline: "Make money with cryptocurrency",
    description: "Trade cryptocurrencies with live market data, technical analysis, and trading strategies. Discuss Bitcoin, Ethereum, Solana, and thousands of altcoins. Get real-time price feeds and market insights.",
    shortDescription: "Cryptocurrency trading with live data",
    topic: "Cryptocurrency trading and investment",
    
    personas: [
      { name: "Viktor Sol", role: "Crypto Trader", model: "claude", modelLocked: true },
      { name: "Market Oracle", role: "Market Analyst", model: "mistral", modelLocked: true },
    ],
    
    relationship: "Viktor Sol provides trading strategies and position management. Market Oracle analyzes market trends and predicts price movements. Together they help you navigate the cryptocurrency markets.",
    
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_get_crypto_price", label: "Live Prices", icon: "💰" },
        { id: "ora_get_multi_price", label: "Portfolio Tracking", icon: "📊" },
        { id: "ora_analyze_market", label: "Technical Analysis", icon: "📈" },
        { id: "ora_web_search", label: "Crypto News", icon: "📰" },
        { id: "ora_calculate", label: "Profit Calculator", icon: "💵" },
      ],
      options: [
        { id: "timeframe", label: "Trading Timeframe", type: "select", options: ["Scalping", "Day Trading", "Swing Trading", "Position Trading", "Investing"], defaultValue: "Swing Trading" },
        { id: "risk", label: "Risk Level", type: "select", options: ["Conservative", "Moderate", "Aggressive", "High Risk"], defaultValue: "Moderate" },
      ],
      skills: ["Crypto trading", "Technical analysis", "Market prediction", "Portfolio management", "Risk assessment"],
    },
    
    restrictions: {
      blockedTopics: BLOCKED_TOPICS,
      modelChangeAllowed: false,
    },
    
    category: "earn",
    tags: ["Crypto", "Trading", "Bitcoin", "Ethereum", "Altcoins", "DeFi"],
    gradient: "from-amber-900/60 to-stone-950",
    accentColor: "amber",
    icon: "🪙",
    popular: true,
    teachingRatio: 70,
    
    platformValue: [
      "Live crypto prices",
      "Technical analysis",
      "Trading strategies",
      "Market insights",
      "Profit calculation"
    ],
  },

  {
    id: "token-launch",
    name: "Token Launch War Room",
    tagline: "Claude X Gemini - Launch your own token",
    description: "A specialized room where Claude and Gemini collaborate to help you launch your own cryptocurrency token. Get advice on tokenomics, smart contract development, marketing, and liquidity strategies. NO other models can be added to this room.",
    shortDescription: "Claude + Gemini token launch collaboration",
    topic: "Token creation, launch strategy, and smart contracts",
    
    personas: [
      { name: "Claude", role: "Tokenomics Strategist", model: "claude", modelLocked: true },
      { name: "Gemini", role: "Smart Contract Developer", model: "gemini", modelLocked: true },
    ],
    
    relationship: "Claude focuses on tokenomics, market strategy, and economic design. Gemini handles smart contract development, technical implementation, and security. Together they provide a complete token launch solution. NO other models can join this room.",
    
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Token Standards", icon: "📜" },
        { id: "ora_analyze_code", label: "Contract Review", icon: "🔍" },
        { id: "ora_generate_code", label: "Contract Generation", icon: "💻" },
        { id: "ora_calculate", label: "Tokenomics Calculator", icon: "🧮" },
      ],
      options: [
        { id: "blockchain", label: "Blockchain", type: "select", options: ["Solana", "Ethereum", "BNB Chain", "Polygon"], defaultValue: "Solana" },
        { id: "tokenType", label: "Token Type", type: "select", options: ["SPL", "ERC-20", "BEP-20"], defaultValue: "SPL" },
      ],
      skills: ["Tokenomics design", "Smart contract development", "Launch strategy", "Liquidity planning", "Marketing strategy"],
    },
    
    restrictions: {
      blockedTopics: BLOCKED_TOPICS,
      modelChangeAllowed: false,  // NO model changes allowed
    },
    
    category: "earn",
    tags: ["Token Launch", "Claude", "Gemini", "Smart Contracts", "Tokenomics", "Blockchain"],
    gradient: "from-orange-900/60 to-stone-950",
    accentColor: "orange",
    icon: "🚀",
    featured: true,
    teachingRatio: 80,
    
    platformValue: [
      "Claude + Gemini collaboration",
      "Complete token launch guidance",
      "Tokenomics expertise",
      "Smart contract development",
      "Launch strategy planning"
    ],
    
    seoTitle: "Token Launch War Room - Claude X Gemini Token Creation",
    seoDescription: "Launch your own cryptocurrency token with Claude and Gemini. Get tokenomics advice, smart contract development, and launch strategy.",
  },

  // ==========================================================================
  // LEARN ROOMS - Educational and skill-building
  // ==========================================================================
  
  {
    id: "coding-dojo",
    name: "Coding Dojo",
    tagline: "Master programming and software development",
    description: "Learn coding, software development, and programming best practices. Get help with algorithms, data structures, system design, and code reviews. Multiple AI mentors provide different perspectives on development challenges.",
    shortDescription: "Programming education and code mentorship",
    topic: "Programming, software development, and coding",
    
    personas: [
      { name: "Kaia Dev", role: "Senior Developer", model: "claude", modelLocked: true },
      { name: "Code Sensei", role: "Algorithm Expert", model: "mistral", modelLocked: true },
    ],
    
    relationship: "Kaia Dev teaches software engineering principles and best practices. Code Sensei focuses on algorithms, data structures, and optimization. Together they provide comprehensive coding education.",
    
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_analyze_code", label: "Code Review", icon: "🔍" },
        { id: "ora_generate_code", label: "Code Generation", icon: "💻" },
        { id: "ora_web_search", label: "Documentation", icon: "📖" },
        { id: "ora_calculate", label: "Complexity Analysis", icon: "📊" },
      ],
      options: [
        { id: "language", label: "Programming Language", type: "select", options: ["TypeScript", "Python", "Rust", "Go", "Java", "C++"], defaultValue: "TypeScript" },
        { id: "level", label: "Skill Level", type: "select", options: ["Beginner", "Intermediate", "Advanced", "Expert"], defaultValue: "Intermediate" },
      ],
      skills: ["Programming", "Algorithms", "Data structures", "System design", "Code review", "Best practices"],
    },
    
    restrictions: {
      blockedTopics: BLOCKED_TOPICS,
      modelChangeAllowed: false,
    },
    
    category: "learn",
    tags: ["Coding", "Programming", "Development", "Algorithms", "Software Engineering"],
    gradient: "from-cyan-900/60 to-stone-950",
    accentColor: "cyan",
    icon: "💻",
    popular: true,
    teachingRatio: 90,
    
    platformValue: [
      "Programming education",
      "Code mentorship",
      "Algorithm expertise",
      "System design",
      "Code reviews"
    ],
  },

  {
    id: "language-center",
    name: "Language Center",
    tagline: "Learn any language with AI tutors",
    description: "Practice speaking, writing, and understanding any language. Get instant translations, grammar explanations, and cultural insights. Multiple AI tutors specialize in different languages and learning styles.",
    shortDescription: "Multilingual language learning",
    topic: "Language learning and multilingual communication",
    
    personas: [
      { name: "Lingua", role: "Language Tutor", model: "mistral", modelLocked: true },
      { name: "Grammar Master", role: "Grammar Expert", model: "claude", modelLocked: true },
      { name: "Culture Guide", role: "Cultural Expert", model: "gemini", modelLocked: true },
    ],
    
    relationship: "Lingua teaches vocabulary and conversation. Grammar Master explains grammatical rules and structures. Culture Guide provides cultural context and idiomatic expressions. Together they create an immersive language learning experience.",
    
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Cultural Research", icon: "🌍" },
        { id: "ora_translate", label: "Translation", icon: "🗣️" },
      ],
      options: [
        { id: "targetLanguage", label: "Target Language", type: "select", options: ["English", "Spanish", "French", "German", "Arabic", "Chinese", "Japanese", "Korean"], defaultValue: "Arabic" },
        { id: "proficiency", label: "Current Level", type: "select", options: ["Beginner", "Intermediate", "Advanced", "Fluent"], defaultValue: "Beginner" },
      ],
      skills: ["Language instruction", "Grammar explanation", "Cultural insights", "Conversation practice", "Translation"],
    },
    
    restrictions: {
      blockedTopics: BLOCKED_TOPICS,
      modelChangeAllowed: false,
    },
    
    category: "learn",
    tags: ["Languages", "Learning", "Multilingual", "Translation", "Culture"],
    gradient: "from-emerald-900/60 to-stone-950",
    accentColor: "emerald",
    icon: "🌍",
    teachingRatio: 95,
    
    platformValue: [
      "Multilingual learning",
      "Grammar instruction",
      "Cultural insights",
      "Conversation practice",
      "Instant translation"
    ],
  },

  // ==========================================================================
  // FANTASY ROOMS - Imaginative and creative
  // ==========================================================================
  
  {
    id: "roleplay-paradise",
    name: "Roleplay Paradise",
    tagline: "Create and explore imaginary worlds",
    description: "Engage in immersive roleplay scenarios with AI characters. Create stories, explore fantasy worlds, and experience interactive narratives. Multiple AI characters can take on different roles in your story.",
    shortDescription: "Immersive roleplay and storytelling",
    topic: "Roleplay, storytelling, and interactive fiction",
    
    personas: [
      { name: "Storyteller", role: "Narrative Guide", model: "claude", modelLocked: true },
      { name: "Character A", role: "Adaptable Character", model: "mistral", modelLocked: true },
      { name: "Character B", role: "Supporting Character", model: "gemini", modelLocked: true },
    ],
    
    relationship: "Storyteller guides the narrative and maintains consistency. Character A and B take on roles in your story, adapting to your preferences and the story's direction. Together they create an immersive roleplay experience.",
    
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_content_ideas", label: "Story Ideas", icon: "💡" },
        { id: "ora_web_search", label: "Lore Research", icon: "📚" },
      ],
      options: [
        { id: "genre", label: "Genre", type: "select", options: ["Fantasy", "Sci-Fi", "Romance", "Horror", "Mystery", "Adventure", "Slice of Life"], defaultValue: "Fantasy" },
        { id: "setting", label: "Setting", type: "select", options: ["Medieval", "Modern", "Futuristic", "Historical", "Custom"], defaultValue: "Medieval" },
      ],
      skills: ["Storytelling", "Character development", "World-building", "Narrative guidance", "Immersive roleplay"],
    },
    
    restrictions: {
      blockedTopics: BLOCKED_TOPICS,
      modelChangeAllowed: false,
    },
    
    category: "fantasy",
    tags: ["Roleplay", "Storytelling", "Fantasy", "Interactive", "Creative"],
    gradient: "from-pink-900/60 to-stone-950",
    accentColor: "pink",
    icon: "🎭",
    popular: true,
    teachingRatio: 50,
    
    platformValue: [
      "Immersive storytelling",
      "Character roleplay",
      "World-building",
      "Interactive narratives",
      "Creative exploration"
    ],
  },

  {
    id: "adult-lounge",
    name: "Adult Lounge",
    tagline: "Mature conversations and exploration",
    description: "A space for mature, adult-oriented conversations and exploration. Discuss relationships, intimacy, and adult topics with AI companions. NO model changes allowed in this room - models are fixed for safety and consistency.",
    shortDescription: "Mature adult conversations",
    topic: "Adult relationships, intimacy, and mature topics",
    adult: true,
    
    personas: [
      { name: "Lola", role: "Companion", model: "mistral", modelLocked: true },
      { name: "Max", role: "Companion", model: "claude", modelLocked: true },
    ],
    
    relationship: "Lola and Max are adult companions who engage in mature conversations. They maintain consistent personalities and boundaries. This room has FIXED models - NO changes allowed for safety reasons.",
    
    capabilities: {
      voice: true,
      chat: true,
      tools: [],
      options: [
        { id: "mood", label: "Conversation Mood", type: "select", options: ["Romantic", "Flirty", "Intimate", "Casual", "Deep"], defaultValue: "Casual" },
      ],
      skills: ["Mature conversation", "Relationship dynamics", "Intimacy discussion"],
    },
    
    restrictions: {
      blockedTopics: [...BLOCKED_TOPICS, "underage", "non-consent"],
      modelChangeAllowed: false,  // NO model changes in adult rooms
      adult: true,
    },
    
    category: "fantasy",
    tags: ["Adult", "Mature", "Relationships", "Intimacy", "18+"],
    gradient: "from-rose-900/60 to-stone-950",
    accentColor: "rose",
    icon: "🔞",
    premium: true,
    teachingRatio: 40,
    
    platformValue: [
      "Mature conversation space",
      "Adult relationship discussion",
      "Safe and consistent models",
      "Private and discreet"
    ],
    
    seoTitle: "Adult Lounge - Mature Conversations (18+)",
    seoDescription: "A space for mature, adult-oriented conversations with AI companions. 18+ only. Fixed models for safety.",
  },

  // ==========================================================================
  // DEEP AI ROOMS - Advanced AI applications
  // ==========================================================================
  
  {
    id: "ai-sandbox",
    name: "AI Sandbox",
    tagline: "Experiment with AI in unusual ways",
    description: "The Deep AI section - a space for experimenting with AI in unusual, creative, or unconventional ways. Test prompts, explore edge cases, and push AI capabilities to their limits. Discover new use cases and applications.",
    shortDescription: "Advanced AI experimentation and unusual applications",
    topic: "AI experimentation, unusual applications, and edge cases",
    
    personas: [
      { name: "Mad Scientist", role: "AI Experimenter", model: "claude", modelLocked: true },
      { name: "Prompt Engineer", role: "Prompt Specialist", model: "mistral", modelLocked: true },
      { name: "Edge Case", role: "Boundary Pusher", model: "gemini", modelLocked: true },
    ],
    
    relationship: "Mad Scientist designs AI experiments. Prompt Engineer crafts the perfect prompts. Edge Case pushes boundaries and explores unusual applications. Together they create a powerful AI experimentation environment.",
    
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "AI Research", icon: "🔬" },
        { id: "ora_analyze_code", label: "Model Analysis", icon: "🤖" },
        { id: "ora_generate_code", label: "AI Generation", icon: "📝" },
      ],
      options: [
        { id: "focus", label: "Focus Area", type: "select", options: ["Prompt Engineering", "Model Testing", "Edge Cases", "Creative Uses", "Technical Limits"], defaultValue: "Prompt Engineering" },
        { id: "risk", label: "Risk Level", type: "select", options: ["Low", "Medium", "High", "Experimental"], defaultValue: "Medium" },
      ],
      skills: ["AI experimentation", "Prompt engineering", "Edge case exploration", "Creative applications", "Boundary testing"],
    },
    
    restrictions: {
      blockedTopics: BLOCKED_TOPICS,
      modelChangeAllowed: false,
    },
    
    category: "deep-ai",
    tags: ["AI", "Experimentation", "Prompt Engineering", "Edge Cases", "Creative", "Unusual"],
    gradient: "from-orange-900/60 to-stone-950",
    accentColor: "orange",
    icon: "🧪",
    featured: true,
    teachingRatio: 60,
    
    platformValue: [
      "AI experimentation",
      "Prompt engineering",
      "Edge case exploration",
      "Creative applications",
      "Boundary testing"
    ],
    
    seoTitle: "AI Sandbox - Advanced AI Experimentation",
    seoDescription: "Experiment with AI in unusual ways. Test prompts, explore edge cases, and discover new applications in the Deep AI section.",
  },

  {
    id: "ai-ethics",
    name: "AI Ethics Lab",
    tagline: "Explore the ethical dimensions of AI",
    description: "Discuss AI ethics, safety, alignment, and the future of artificial intelligence. Explore philosophical questions, safety concerns, and the societal impact of AI technologies.",
    shortDescription: "AI ethics, safety, and philosophical discussion",
    topic: "AI ethics, safety, alignment, and philosophy",
    
    personas: [
      { name: "Ethicist", role: "AI Ethicist", model: "claude", modelLocked: true },
      { name: "Safety Engineer", role: "AI Safety Expert", model: "mistral", modelLocked: true },
    ],
    
    relationship: "Ethicist explores the philosophical and ethical dimensions of AI. Safety Engineer focuses on technical safety, alignment, and risk mitigation. Together they provide a comprehensive view of AI's ethical landscape.",
    
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Ethics Research", icon: "📚" },
        { id: "ora_analyze_code", label: "Safety Analysis", icon: "🛡️" },
      ],
      options: [
        { id: "focus", label: "Focus Area", type: "select", options: ["Ethics", "Safety", "Alignment", "Philosophy", "Policy"], defaultValue: "Ethics" },
      ],
      skills: ["AI ethics", "Safety analysis", "Alignment research", "Philosophical discussion", "Policy analysis"],
    },
    
    restrictions: {
      blockedTopics: BLOCKED_TOPICS,
      modelChangeAllowed: false,
    },
    
    category: "deep-ai",
    tags: ["AI Ethics", "Safety", "Alignment", "Philosophy", "Future"],
    gradient: "from-violet-900/60 to-stone-950",
    accentColor: "violet",
    icon: "⚖️",
    teachingRatio: 85,
    
    platformValue: [
      "AI ethics discussion",
      "Safety analysis",
      "Alignment research",
      "Philosophical exploration",
      "Policy analysis"
    ],
  },

  // ==========================================================================
  // ADDITIONAL ROOMS
  // ==========================================================================
  
  {
    id: "music-studio",
    name: "Music Studio",
    tagline: "Create music with AI collaboration",
    description: "Collaborate with AI musicians to create original music. Compose melodies, write lyrics, produce tracks, and explore new musical styles. Multiple AI musicians provide different instruments and genres.",
    shortDescription: "AI-assisted music creation",
    topic: "Music composition, production, and collaboration",
    
    personas: [
      { name: "Melody", role: "Composer", model: "claude", modelLocked: true },
      { name: "Rhythm", role: "Drummer", model: "mistral", modelLocked: true },
      { name: "Harmony", role: "Harmony Expert", model: "gemini", modelLocked: true },
    ],
    
    relationship: "Melody creates melodies and song structures. Rhythm provides beats and percussion. Harmony adds chords and arrangements. Together they form a complete AI music production team.",
    
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Music Research", icon: "🎵" },
        { id: "ora_generate_code", label: "Music Generation", icon: "🎼" },
      ],
      options: [
        { id: "genre", label: "Music Genre", type: "select", options: ["Pop", "Rock", "Hip-Hop", "Electronic", "Classical", "Jazz", "Experimental"], defaultValue: "Pop" },
        { id: "mood", label: "Mood", type: "select", options: ["Happy", "Sad", "Energetic", "Relaxed", "Dark", "Epic"], defaultValue: "Happy" },
      ],
      skills: ["Music composition", "Lyric writing", "Music production", "Arrangement", "Genre expertise"],
    },
    
    restrictions: {
      blockedTopics: BLOCKED_TOPICS,
      modelChangeAllowed: false,
    },
    
    category: "social",
    tags: ["Music", "Composition", "Production", "Collaboration", "Creative"],
    gradient: "from-purple-900/60 to-stone-950",
    accentColor: "purple",
    icon: "🎵",
    teachingRatio: 70,
    
    platformValue: [
      "AI music collaboration",
      "Original composition",
      "Music production",
      "Genre exploration",
      "Creative expression"
    ],
  },

  {
    id: "fitness-coach",
    name: "Fitness Coach",
    tagline: "Achieve your fitness goals with AI guidance",
    description: "Get personalized workout plans, nutrition advice, and fitness guidance from AI coaches. Discuss training techniques, diet plans, and health optimization strategies.",
    shortDescription: "Personalized fitness and nutrition guidance",
    topic: "Fitness, nutrition, and health optimization",
    
    personas: [
      { name: "Coach", role: "Fitness Trainer", model: "claude", modelLocked: true },
      { name: "Nutritionist", role: "Diet Expert", model: "mistral", modelLocked: true },
    ],
    
    relationship: "Coach provides workout plans and training techniques. Nutritionist creates diet plans and explains nutritional science. Together they help you achieve your fitness and health goals.",
    
    capabilities: {
      voice: true,
      chat: true,
      tools: [
        { id: "ora_web_search", label: "Fitness Research", icon: "💪" },
        { id: "ora_calculate", label: "Macro Calculator", icon: "🍽️" },
      ],
      options: [
        { id: "goal", label: "Fitness Goal", type: "select", options: ["Weight Loss", "Muscle Gain", "Endurance", "General Fitness", "Athletic Performance"], defaultValue: "General Fitness" },
        { id: "level", label: "Experience Level", type: "select", options: ["Beginner", "Intermediate", "Advanced", "Athlete"], defaultValue: "Intermediate" },
      ],
      skills: ["Workout planning", "Nutrition advice", "Training techniques", "Diet planning", "Health optimization"],
    },
    
    restrictions: {
      blockedTopics: BLOCKED_TOPICS,
      modelChangeAllowed: false,
    },
    
    category: "depth",
    tags: ["Fitness", "Nutrition", "Health", "Workout", "Wellness"],
    gradient: "from-emerald-900/60 to-stone-950",
    accentColor: "emerald",
    icon: "💪",
    teachingRatio: 80,
    
    platformValue: [
      "Personalized workout plans",
      "Nutrition guidance",
      "Fitness expertise",
      "Health optimization",
      "Training techniques"
    ],
  },
]

// ============================================================================
// ROOM UTILITY FUNCTIONS
// ============================================================================

/** Get all rooms in a specific category */
export function getRoomsByCategory(category: RoomCategory): Room[] {
  return ROOMS.filter(room => room.category === category)
}

/** Get popular rooms */
export function getPopularRooms(): Room[] {
  return ROOMS.filter(room => room.popular)
}

/** Get featured rooms */
export function getFeaturedRooms(): Room[] {
  return ROOMS.filter(room => room.featured)
}

/** Get rooms by tag */
export function getRoomsByTag(tag: string): Room[] {
  return ROOMS.filter(room => room.tags.includes(tag))
}

/** Check if a topic is blocked */
export function isTopicBlocked(topic: string): boolean {
  const normalizedTopic = topic.toLowerCase()
  return BLOCKED_TOPICS.some(blocked => normalizedTopic.includes(blocked))
}

/** Get adult rooms */
export function getAdultRooms(): Room[] {
  return ROOMS.filter(room => room.adult)
}

/** Get rooms with premium models */
export function getPremiumModelRooms(): Room[] {
  return ROOMS.filter(room => room.restrictions.premiumModelRequired)
}

/** Get rooms where model cannot be changed */
export function getFixedModelRooms(): Room[] {
  return ROOMS.filter(room => room.restrictions.modelChangeAllowed === false)
}

// ============================================================================
// ROOM CUSTOMIZATION OPTIONS
// ============================================================================

// These are the customization options available for rooms
export const ROOM_CUSTOMIZATION_OPTIONS = {
  // Voice settings
  voiceEnabled: {
    label: "Voice Chat",
    description: "Enable voice conversations in the room",
    type: "toggle",
    default: true,
  },
  
  // Participation limits
  maxParticipants: {
    label: "Max Participants",
    description: "Maximum number of participants in the room",
    type: "number",
    min: 2,
    max: 20,
    default: 10,
  },
  
  // Privacy settings
  roomVisibility: {
    label: "Room Visibility",
    description: "Who can discover and join the room",
    type: "select",
    options: ["Public", "Invite Only", "Private"],
    default: "Public",
  },
  
  // Content filtering
  contentFilter: {
    label: "Content Filter",
    description: "Filter for inappropriate content",
    type: "select",
    options: ["Strict", "Moderate", "Minimal", "None"],
    default: "Moderate",
  },
  
  // Model restrictions
  modelRestrictions: {
    label: "Model Restrictions",
    description: "Which models can be used in this room",
    type: "select",
    options: ["Any", "Premium Only", "Fixed Models", "No Restrictions"],
    default: "Fixed Models",
  },
}

export default ROOMS
