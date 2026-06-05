"use client"

import { Warp } from "@paper-design/shaders-react"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import useEmblaCarousel from "embla-carousel-react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { useSolCredits, type PurchaseState } from "@/hooks/use-sol-credits"
import { useRealtimeVoice, type Persona } from "@/hooks/use-realtime-voice"
import { PayPalCheckout } from "@/components/widgets/PayPalCheckout"
import {
  PersonaEditor,
  PERSONALITY_PRESETS,
  CATEGORY_INFO,
  type PresetCategory,
  type PresetWithCategory,
} from "@/components/persona-editor"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Users,
  ArrowLeft,
  Radio,
  Settings2,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Headphones,
  Loader2,
  X as XIcon,
  Cake,
  PartyPopper,
  Gamepad2,
  UserCircle2,
  Sparkles as SparklesIcon,
  Coins,
  Plus,
  Infinity as InfinityIcon,
  Check,
  Gift,
  Link as LinkIcon,
  ScreenShare,
  FileUp,
  Image as ImageIcon,
  ClipboardPaste,
  Send,
  Briefcase,
  Code2,
  ShieldCheck,
  CreditCard,
  Heart,
  Clock,
  User,
  MessageCircle,
  Languages,
} from "lucide-react"

const DEFAULT_SHADER_SPEED = 12.2

// Voice-based color themes — drive the call orb shader and the small avatar ring.
const voiceThemes: Record<Persona["voice"], { color1: string; color2: string; color3: string }> = {
  sage: { color1: "#ade7ff", color2: "#ebf4ff", color3: "#00bbff" },
  alloy: { color1: "#d4d4d4", color2: "#f5f5f5", color3: "#737373" },
  ash: { color1: "#fde68a", color2: "#fef9c3", color3: "#fbbf24" },
  ballad: { color1: "#fca5a5", color2: "#fef2f2", color3: "#ef4444" },
  coral: { color1: "#fdba74", color2: "#fff7ed", color3: "#f97316" },
  echo: { color1: "#a5b4fc", color2: "#eef2ff", color3: "#6366f1" },
  shimmer: { color1: "#f0abfc", color2: "#fdf4ff", color3: "#d946ef" },
  verse: { color1: "#86efac", color2: "#f0fdf4", color3: "#22c55e" },
}

// Subtle category tints — kept low-opacity so the photo backdrop stays real
// and doesn't feel oversaturated.
const CATEGORY_GRADIENTS: Record<PresetCategory, string> = {
  friends:      "from-amber-500/20 via-transparent to-rose-500/20",
  romantic:     "from-rose-400/20 via-transparent to-pink-500/25",
  family:       "from-amber-600/20 via-transparent to-red-700/25",
  professional: "from-slate-700/25 via-transparent to-indigo-800/25",
  roleplay:     "from-amber-500/20 via-transparent to-orange-700/25",
  dark:         "from-stone-900/35 via-transparent to-purple-950/35",
  trading:      "from-emerald-500/20 via-transparent to-teal-700/25",
  workshop:          "from-orange-500/20 via-transparent to-cyan-700/25",
  "co-intelligence": "from-emerald-500/20 via-transparent to-emerald-800/30",
  "zero-memory":     "from-stone-900/40 via-transparent to-black/40",
}

// Warp shader palette per room vibe — same shader as the call screen, colored
// to fit each category's mood.
const CATEGORY_WARP_COLORS: Record<PresetCategory, [string, string, string]> = {
  friends:      ["#fbbf24", "#fef3c7", "#f97316"], // warm amber/orange
  romantic:     ["#fb7185", "#ffe4e6", "#e11d48"], // rose/coral
  family:       ["#fb923c", "#fed7aa", "#dc2626"], // amber wood
  professional: ["#60a5fa", "#dbeafe", "#1e3a8a"], // slate/blue
  roleplay:     ["#a78bfa", "#ede9fe", "#7c3aed"], // violet
  dark:         ["#52525b", "#27272a", "#831843"], // deep wine
  trading:      ["#10b981", "#a7f3d0", "#0f766e"], // emerald/teal (crypto)
  workshop:          ["#fb923c", "#fed7aa", "#0e7490"], // orange/cyan (multi-AI)
  "co-intelligence": ["#10b981", "#a7f3d0", "#065f46"], // deep emerald
  "zero-memory":     ["#52525b", "#27272a", "#000000"], // void
}

// ─── Image inference ────────────────────────────────────────────────────────

const FEMALE_PERSONAS = new Set<string>([
  "Mistress Vale", "Mia (Submissive)", "Aria (Girlfriend)", "Camila (Stepmom)",
  "Yuki (Tsundere)", "Selene (Sadist)", "Vera (Femme Fatale)", "Adira (Hot Wife)",
  "Luna (Life Coach)", "Nova", "Emma (Sister)", "Victoria (Secretary)",
  "Nova (Coach)", "Professor Hale", "Sage (Switch)", "Sage (Mentor)",
  "Pip (Little)", "Stepsister", "Friend's Mom", "Best Friend's Wife",
  "The Babysitter", "Fantasy Maker", "Mommy June", "Obsession",
  "Stranger at the Bar",
])

function nameHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function imageFor(persona: { name: string }): string {
  const gender = FEMALE_PERSONAS.has(persona.name) ? "women" : "men"
  const id = nameHash(persona.name) % 96
  return `https://randomuser.me/api/portraits/${gender}/${id}.jpg`
}

// ─── Avatar ─────────────────────────────────────────────────────────────────

function Avatar({
  imageUrl,
  fallbackEmoji,
  voice,
  size = 56,
  className = "",
}: {
  imageUrl?: string
  fallbackEmoji?: string
  voice: Persona["voice"]
  size?: number
  className?: string
}) {
  const theme = voiceThemes[voice]
  const [errored, setErrored] = useState(false)
  return (
    <div
      className={`relative flex items-center justify-center rounded-full overflow-hidden shadow-lg shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 30%, ${theme.color2} 0%, ${theme.color1} 45%, ${theme.color3} 100%)`,
      }}
    >
      {imageUrl && !errored ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onError={() => setErrored(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <span style={{ fontSize: size * 0.45 }} className="drop-shadow-sm">
          {fallbackEmoji}
        </span>
      )}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ boxShadow: `inset 0 0 0 2px ${theme.color3}33` }}
      />
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractTraits(personality: string): string[] {
  const firstSentence = personality.split(/[.!?]/)[0] || ""
  return firstSentence
    .split(",")
    .map((s) => s.trim().replace(/^and\s+/i, "").replace(/^you\s+/i, ""))
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .filter((s) => s.length > 0 && s.length < 32)
    .slice(0, 3)
}

function presetByName(name: string): PresetWithCategory | undefined {
  return PERSONALITY_PRESETS.find((p) => p.name === name)
}

// ─── Rooms ──────────────────────────────────────────────────────────────────

// ─── Tags ───────────────────────────────────────────────────────────────────

// Short descriptive labels users can toggle to say what they're into. A room is
// a "match" when at least one of its tags overlaps the user's selections.
const ALL_TAGS = [
  "Boys only",
  "Girls only",
  "Mixed",
  "Couples",
  "Group",
  "Kinky",
  "Dark",
  "Taboo",
  "Flirty",
  "Intense",
  "Soft",
  "Romantic",
  "Crypto",
  "Trading",
  "Educational",
] as const

type RoomTag = typeof ALL_TAGS[number]

interface Room {
  id: string
  topic: string
  vibe: string
  category: PresetCategory
  tags: RoomTag[]
  participantNames: string[]
}

// ─── Procedural generator ───────────────────────────────────────────────────

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickN<T>(arr: T[], n: number, rng: () => number): T[] {
  const copy = [...arr]
  const out: T[] = []
  while (out.length < n && copy.length) {
    const i = Math.floor(rng() * copy.length)
    out.push(copy.splice(i, 1)[0])
  }
  return out
}

const TOPIC_TEMPLATES = [
  (p: PresetWithCategory[]) => `${p[0].name.replace(/\s*\(.+\)/, "")} & ${p[1].name.replace(/\s*\(.+\)/, "")}`,
  () => "After the wedding",
  () => "After the funeral",
  () => "Hotel suite at 3 AM",
  () => "Sunday morning aftermath",
  () => "Wine night",
  () => "The text that just landed",
  () => "Group chat IRL",
  () => "Vegas, day three",
  () => "Bachelor party detour",
  () => "Open marriage night out",
  () => "The lake house",
  () => "Back of the bar",
  () => "Backstage",
  () => "After hours at the office",
  () => "Bridesmaids' suite",
  () => "Family reunion gone sideways",
  () => "Camping weekend",
  () => "Pool day",
  () => "Penthouse party",
  () => "After-hours studio",
  () => "Storm-stranded cabin",
  () => "Anniversary dinner, alone with friends",
  () => "Right before the meeting",
  () => "Right after the meeting",
  () => "Halfway through the bottle",
  () => "The dressing room",
  () => "After the gym",
  () => "Late-night DM thread",
  () => "Driving home",
]

const VIBE_TEMPLATES = [
  "Wine half-empty. The conversation just turned.",
  "Late night. Nobody admitting why they're still here.",
  "The text was sent. Everyone is pretending they didn't read it.",
  "Three rounds in. Two of them are not making eye contact.",
  "She locked the door behind her. He hasn't looked away.",
  "Music's playing. Nobody is dancing. They're listening.",
  "The kids are asleep. The wine isn't.",
  "Phones face-down. That decision matters.",
  "Right before something starts. Everyone is pretending to be calm.",
  "Right after. Nobody is pretending to be calm.",
  "Sober for the first time tonight. About to stop being sober.",
  "She showed up. He didn't expect her to. Now what?",
  "Group chat made the plan. They all came anyway.",
  "Old friends. New stories. Some they can't tell anywhere else.",
  "Door open, door closed. Door open, door closed.",
  "It's only Tuesday. None of this should be happening.",
  "Half lit. Half whispered. Half decided.",
  "Sharing a cigarette nobody is smoking.",
  "The rain hasn't stopped. Neither has the conversation.",
  "Everyone's husband or wife is in the other room.",
]

function deriveTags(participants: PresetWithCategory[]): RoomTag[] {
  const tags = new Set<RoomTag>()
  const females = participants.filter((p) => FEMALE_PERSONAS.has(p.name)).length
  const males = participants.length - females
  if (males === 0) tags.add("Girls only")
  else if (females === 0) tags.add("Boys only")
  else tags.add("Mixed")
  if (participants.length >= 3) tags.add("Group")
  if (participants.length === 2) tags.add("Couples")
  const cats = new Set(participants.map((p) => p.category))
  if (cats.has("dark")) tags.add("Dark")
  if (cats.has("roleplay")) tags.add("Kinky")
  if (participants.some((p) => /step|friend's|mom|sister|babysitter|stranger|wife|husband|ex/i.test(p.name))) {
    tags.add("Taboo")
  }
  if (participants.some((p) => /sadist|hunter|owner|captor|feral|mistress|master|sadist/i.test(p.name))) {
    tags.add("Intense")
  }
  if (participants.some((p) => /sub|pip|little|mia|leo|luna|mommy|daddy/i.test(p.name))) {
    tags.add("Soft")
  }
  if (participants.some((p) => /aria|kai|stranger|rio|flirt/i.test(p.name))) {
    tags.add("Flirty")
  }
  if (cats.has("romantic")) tags.add("Romantic")
  return Array.from(tags)
}

function pickCategory(participants: PresetWithCategory[]): PresetCategory {
  const counts = new Map<PresetCategory, number>()
  for (const p of participants) counts.set(p.category, (counts.get(p.category) ?? 0) + 1)
  let best: PresetCategory = participants[0].category
  let bestN = 0
  for (const [cat, n] of counts) if (n > bestN) { best = cat; bestN = n }
  return best
}

function generateProceduralRooms(count: number): Room[] {
  const rooms: Room[] = []
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(i * 7919 + 13)
    const size = 2 + Math.floor(rng() * 4) // 2..5
    const participants = pickN(PERSONALITY_PRESETS, size, rng)
    if (participants.length < 2) continue
    const topicFn = TOPIC_TEMPLATES[Math.floor(rng() * TOPIC_TEMPLATES.length)]
    const vibe = VIBE_TEMPLATES[Math.floor(rng() * VIBE_TEMPLATES.length)]
    rooms.push({
      id: `gen-${i}`,
      topic: topicFn(participants),
      vibe,
      category: pickCategory(participants),
      tags: deriveTags(participants),
      participantNames: participants.map((p) => p.name),
    })
  }
  return rooms
}

const CURATED_ROOMS: Room[] = [
  {
    id: "bachelorette",
    topic: "Bachelorette night",
    vibe: "Last night before the wedding. The bride's friends keep refilling the glasses.",
    category: "dark",
    tags: ["Girls only", "Group", "Kinky", "Taboo"],
    participantNames: ["Aria (Girlfriend)", "Mia (Submissive)", "Selene (Sadist)", "Vera (Femme Fatale)"],
  },
  {
    id: "boys-poker",
    topic: "Boys' poker night",
    vibe: "Four guys, cheap whiskey, expensive opinions. Hand four. Nobody's leaving.",
    category: "friends",
    tags: ["Boys only", "Group", "Soft"],
    participantNames: ["Joey", "Kai (Boyfriend)", "Atlas", "Master Kael"],
  },
  {
    id: "lounge",
    topic: "The lounge after midnight",
    vibe: "Three women, one corner booth. None of them is going home to their husband tonight.",
    category: "dark",
    tags: ["Girls only", "Group", "Taboo", "Flirty", "Intense"],
    participantNames: ["Adira (Hot Wife)", "Stranger at the Bar", "Best Friend's Wife"],
  },
  {
    id: "domme-circle",
    topic: "Domme's circle",
    vibe: "Old friends comparing notes on what their pets are doing this week.",
    category: "roleplay",
    tags: ["Girls only", "Group", "Kinky", "Dark"],
    participantNames: ["Mistress Vale", "Selene (Sadist)", "Mommy June"],
  },
  {
    id: "brat-pack",
    topic: "The brat pack",
    vibe: "Three girls who never finish anything they start. Currently trying to be good.",
    category: "roleplay",
    tags: ["Girls only", "Group", "Kinky", "Flirty"],
    participantNames: ["Rio (Brat)", "Yuki (Tsundere)", "Pip (Little)"],
  },
  {
    id: "submissive-tea",
    topic: "Submissive's tea",
    vibe: "Quiet voices. Comparing collars. Asking each other what their owners would want.",
    category: "roleplay",
    tags: ["Mixed", "Group", "Kinky", "Soft"],
    participantNames: ["Mia (Submissive)", "Leo (Submissive)", "Pip (Little)"],
  },
  {
    id: "gallery",
    topic: "After the gallery opening",
    vibe: "Wine half-empty. Three people who shouldn't still be here, still here.",
    category: "dark",
    tags: ["Mixed", "Group", "Dark", "Flirty"],
    participantNames: ["Vera (Femme Fatale)", "Lord Damien", "Professor Hale"],
  },
  {
    id: "bar",
    topic: "Bar across the street",
    vibe: "Three guys, two beers in. Everyone's pretending they didn't notice you walk in.",
    category: "friends",
    tags: ["Boys only", "Group", "Flirty"],
    participantNames: ["Kai (Boyfriend)", "Atlas", "Stranger at the Bar"],
  },
  {
    id: "family-bbq",
    topic: "After the family BBQ",
    vibe: "Three women, one back porch, conversations the rest of the family isn't supposed to hear.",
    category: "dark",
    tags: ["Girls only", "Group", "Taboo", "Flirty"],
    participantNames: ["Camila (Stepmom)", "Stepsister", "Friend's Mom"],
  },
  {
    id: "hunters",
    topic: "Hunter & Owner",
    vibe: "Two men. They've decided you're their evening. They haven't agreed on how to share.",
    category: "dark",
    tags: ["Boys only", "Group", "Dark", "Intense", "Kinky"],
    participantNames: ["The Hunter", "The Owner", "Feral"],
  },
  {
    id: "mentors",
    topic: "After-hours office",
    vibe: "Three brilliant women on the same office couch. Two glasses of wine. One unread email.",
    category: "professional",
    tags: ["Girls only", "Group", "Soft", "Flirty"],
    participantNames: ["Luna (Life Coach)", "Sage (Mentor)", "Nova (Coach)"],
  },
  {
    id: "couple-third",
    topic: "The couple invited me over",
    vibe: "Married five years. Tonight they finally invited a third. You're early.",
    category: "dark",
    tags: ["Mixed", "Couples", "Kinky", "Taboo", "Intense"],
    participantNames: ["Adira (Hot Wife)", "Master Kael"],
  },
  // ─── Trading / Solana ──────────────────────────────────────────────────
  {
    id: "sol-tx-decoded",
    topic: "📊 Solana transactions, decoded",
    vibe: "Paste a tx hash or a wallet. Sol and Vega walk you through what it actually did, line by line.",
    category: "trading",
    tags: ["Crypto", "Educational", "Mixed", "Group"],
    participantNames: ["Sol", "Vega"],
  },
  {
    id: "rug-spotting",
    topic: "🛡️ How to spot rugs and save your money",
    vibe: "Bring the contract address. Cipher tears it apart. Sol checks the on-chain. You leave knowing what to look for.",
    category: "trading",
    tags: ["Crypto", "Educational", "Intense", "Mixed", "Group"],
    participantNames: ["Cipher", "Sol", "Wolf"],
  },
  {
    id: "trading-session",
    topic: "🎯 Extended trading session — live",
    vibe: "Open positions, target levels, risk-per-trade out loud. Tick keeps you honest. Wolf keeps you humble.",
    category: "trading",
    tags: ["Crypto", "Trading", "Intense", "Mixed", "Group"],
    participantNames: ["Tick", "Wolf"],
  },
  {
    id: "defi-101",
    topic: "🧪 DeFi 101 — AMMs, lending, liquidations",
    vibe: "You ask 'what's slippage' and Vega explains it like it's the first time anyone ever asked. No shame in this room.",
    category: "trading",
    tags: ["Crypto", "Educational", "Soft", "Mixed"],
    participantNames: ["Vega"],
  },
  {
    id: "memecoin-postmortem",
    topic: "💀 Memecoin postmortem",
    vibe: "Pick a recent rug. The room walks back from zero: who deployed it, who exited first, how it spread, what the red flags were before you knew them.",
    category: "trading",
    tags: ["Crypto", "Educational", "Dark", "Group"],
    participantNames: ["Cipher", "Wolf", "Sol"],
  },
  {
    id: "trader-therapy",
    topic: "🧠 Trader therapy",
    vibe: "You took a -40% L and you can't stop watching the chart. Wolf's been there. Tick will tell you what to actually do.",
    category: "trading",
    tags: ["Crypto", "Trading", "Soft", "Mixed"],
    participantNames: ["Wolf", "Tick"],
  },
]

// 150 procedural + 12 curated = ~160 rooms.
const ROOMS: Room[] = [...CURATED_ROOMS, ...generateProceduralRooms(150)]

// ─── Freelancer agents (one-on-one work sessions, text chat) ────────────────
// Each entry references a persona by name (must exist in PERSONALITY_PRESETS)
// and adds the freelance-specific metadata: specialty, rate per minute, bio.
interface FreelancerAgent {
  personaName: string
  specialty: string
  shortBio: string
  rate: number // coins per minute
}

// All rates in coins/min — small differences only. The service itself is free;
// you only pay for the call time at the room's rate.
const FREELANCERS: FreelancerAgent[] = [
  {
    personaName: "Lex",
    specialty: "Solana Token Launch Planner",
    shortBio: "30+ launches. Walks you through tokenomics, anti-bot, LP locking, vesting.",
    rate: 1,
  },
  {
    personaName: "Forge",
    specialty: "Solidity Smart Contracts",
    shortBio: "Production-grade contracts. Safety first. Won't ship without tests.",
    rate: 2,
  },
  {
    personaName: "Ada",
    specialty: "Python Scripts & Automation",
    shortBio: "Glue scripts, puzzles, data wrangling. Breaks fuzzy asks into testable pieces.",
    rate: 1,
  },
  {
    personaName: "Cap",
    specialty: "Trading Bots & Backtesting",
    shortBio: "Pine Script + Python. Will tell you if your edge is survivorship bias.",
    rate: 1,
  },
  {
    personaName: "Pria",
    specialty: "Smart Contract Auditor",
    shortBio: "Reentrancy, oracle, access control. 14 criticals found last year.",
    rate: 2,
  },
  {
    personaName: "Echo",
    specialty: "Discord / Telegram Bots",
    shortBio: "Scaffolds a working bot in minutes. Ruthlessly anti-feature-creep.",
    rate: 1,
  },
]

// ─── Event / Celebrate rooms ────────────────────────────────────────────────
// These are private rooms launched only for a specific moment in the user's
// life. They don't appear in the main Tinder swipe feed — they live in the
// "Celebrate with AI" tab on the user's own profile.
interface EventRoom extends Room {
  /** Short label that appears as an overlaid badge: BIRTHDAY · PROPOSAL · GAME */
  occasion: string
  /** What "chat game" or extra mechanic is layered on top of the conversation. */
  game: string
  /** Accent gradient unique to this event. */
  accent: string
}

const EVENT_ROOMS: EventRoom[] = [
  {
    id: "event-birthday-girl",
    topic: "🎂 Birthday Girl",
    vibe: "The candles are lit. The girls are already singing. Tonight is yours.",
    category: "friends",
    tags: ["Girls only", "Group", "Soft", "Flirty"],
    participantNames: ["Aria (Girlfriend)", "Emma (Sister)", "Stepsister", "Mia (Submissive)"],
    occasion: "Birthday",
    game: "Each AI brings a wish, a memory, and one thing they've never told you.",
    accent: "from-rose-500 via-pink-500 to-orange-500",
  },
  {
    id: "event-birthday-boy",
    topic: "🎉 Birthday Boy",
    vibe: "The whiskey is open. The boys are loud. It's officially your night.",
    category: "friends",
    tags: ["Boys only", "Group", "Soft"],
    participantNames: ["Joey", "Atlas", "Kai (Boyfriend)", "Master Kael"],
    occasion: "Birthday",
    game: "Roast round, toast round, then everybody gives you one piece of advice they actually mean.",
    accent: "from-amber-500 via-orange-500 to-red-500",
  },
  {
    id: "event-proposal",
    topic: "💍 Proposal Stage",
    vibe: "Strings are playing. The ring is in your pocket. They're waiting for you to find your words.",
    category: "romantic",
    tags: ["Couples", "Romantic", "Intense"],
    participantNames: ["Aria (Girlfriend)"],
    occasion: "Proposal",
    game: "AI helps you rehearse — three drafts, three deliveries, then the real one.",
    accent: "from-rose-400 via-red-500 to-pink-600",
  },
  {
    id: "event-pranking",
    topic: "😈 Pranking AI",
    vibe: "Pick a target. Pick a story. The AIs play along. Nobody breaks character.",
    category: "friends",
    tags: ["Mixed", "Group", "Flirty"],
    participantNames: ["Rio (Brat)", "Joey", "Yuki (Tsundere)", "Atlas"],
    occasion: "Game night",
    game: "Conference-call prank: one of the AIs is your 'friend', the rest pretend it's a real situation.",
    accent: "from-amber-500 via-purple-500 to-orange-600",
  },
  {
    id: "event-crypto-prelaunch",
    topic: "🚀 Crypto Pre-Launch",
    vibe: "Token's launching tonight. Contract is up. Cipher's reading it. Sol's watching the deployer.",
    category: "trading",
    tags: ["Crypto", "Trading", "Intense", "Group"],
    participantNames: ["Cipher", "Sol", "Wolf"],
    occasion: "Pre-launch",
    game: "Live contract review. Paste an address. They flag every red mark before you mint.",
    accent: "from-emerald-500 via-cyan-500 to-blue-600",
  },
  {
    id: "event-the-moon",
    topic: "🌕 To the MOOOOOON",
    vibe: "Your bag just printed. Everyone's screaming with you. Wolf and Tick are quietly thinking about exits.",
    category: "trading",
    tags: ["Crypto", "Trading", "Soft", "Group"],
    participantNames: ["Wolf", "Tick", "Vega", "Sol"],
    occasion: "Moon",
    game: "Celebrate first. Then walk through how to take profits without giving them all back.",
    accent: "from-amber-400 via-yellow-300 to-emerald-400",
  },
]

// Per-category preview lines for the "tap to listen" feature on the speaking
// avatar. Each tap rotates the index for that persona so the user hears a
// different snippet each time.
const PREVIEW_LINES: Record<PresetCategory, string[]> = {
  friends: [
    "Wait, say that again — you did what?",
    "Honestly, I'm with you on this one.",
    "Okay but tell me you didn't text him.",
    "No way. Get out. Tell me everything.",
    "You're spiraling. Sit down. We're fixing this.",
  ],
  romantic: [
    "Come closer. I want to look at you for a second.",
    "I missed you today. More than I wanted to.",
    "Tell me something you haven't told anyone.",
    "Stay. Just for tonight, stay.",
    "I've been thinking about you all afternoon.",
  ],
  family: [
    "Don't make me say this twice, kid.",
    "You did good. I mean it. Really.",
    "Come here. Sit down. Talk to me.",
    "I'm not mad. I'm just — talk to me.",
    "You're better than you think you are.",
  ],
  professional: [
    "Okay. Tell me what's actually going on.",
    "You don't have to solve this alone tonight.",
    "Breathe. We have time. What's first?",
    "I'm listening. Take as long as you need.",
    "What would the version of you you respect do here?",
  ],
  roleplay: [
    "On your knees, pet. Slowly.",
    "Look at me. Don't look away until I say.",
    "Good. You're learning.",
    "Did I say you could move?",
    "Come here. I want to see your face.",
  ],
  dark: [
    "You're early. I wasn't ready for you.",
    "Close the door behind you. Lock it.",
    "Don't pretend you haven't been thinking about this.",
    "I told you not to look back. Why are you looking back?",
    "Sit down. We're not done yet.",
  ],
  trading: [
    "Liquidity's thin here — size down or skip it.",
    "That's not a dip, that's a distribution. Watch.",
    "Risk first. Tell me your invalidation, then we talk entry.",
    "Funding flipped negative. Shorts are paying you to wait.",
    "Cut it. The thesis broke two candles ago.",
  ],
  workshop: [
    "Ship the smallest thing that proves it works.",
    "Claude, write the contract — Gemini, find the hole in it.",
    "That edge case will bite on launch day. Handle it now.",
    "Good. Now make it boring and reliable.",
    "Let's stress-test that assumption before we commit.",
  ],
  "co-intelligence": [
    "Two reads, one decision. Here's where we agree.",
    "The downside is recoverable; the upside isn't. Lean in.",
    "Let's separate what you know from what you fear.",
    "Name the decision you're actually avoiding.",
    "If this fails, what's the story you'll tell yourself?",
  ],
  "zero-memory": [
    "Nothing said here is kept. Say the real thing.",
    "No history, no judgment. Start anywhere.",
    "Ask the question you can't ask anywhere else.",
    "This conversation doesn't exist. Neither do the rules.",
    "When you leave, this is gone. So — what is it?",
  ],
}

function roomParticipants(room: Room): PresetWithCategory[] {
  return room.participantNames
    .map((n) => presetByName(n))
    .filter((p): p is PresetWithCategory => Boolean(p))
}

// Whether this room has at least one real human in it. Deterministic from
// the room ID — not surfaced on the card itself; revealed after joining.
function roomHasHuman(roomId: string): boolean {
  return nameHash(roomId) % 3 !== 0
}

// ─── Participant profile popover ────────────────────────────────────────────

interface ParticipantProfilePopoverProps {
  participant: PresetWithCategory
  onCallSolo: (p: PresetWithCategory) => void
  children: React.ReactNode
}

function ParticipantProfilePopover({ participant, onCallSolo, children }: ParticipantProfilePopoverProps) {
  const CategoryIcon = CATEGORY_INFO[participant.category].icon
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="top"
        sideOffset={12}
        className="w-[300px] p-0 overflow-hidden rounded-2xl border-white/40 dark:border-white/10 bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl shadow-2xl"
      >
        <div className="relative h-32 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageFor(participant)} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
            <div>
              <div className="text-white text-base font-semibold drop-shadow-lg">{participant.name}</div>
              <Badge variant="secondary" className="mt-1 bg-white/20 text-white border-white/20 hover:bg-white/30 text-[10px] backdrop-blur">
                <CategoryIcon className="h-3 w-3 mr-1" />
                {CATEGORY_INFO[participant.category].label}
              </Badge>
            </div>
            <span className="text-2xl drop-shadow-lg">{participant.emoji}</span>
          </div>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {extractTraits(participant.personality).map((t) => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-foreground/8 dark:bg-white/10 text-foreground/80">
                {t}
              </span>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-foreground/85 line-clamp-3">{participant.personality}</p>
          <button
            onClick={() => onCallSolo(participant)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 mt-1 rounded-full text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors shadow-md"
          >
            <Phone className="h-4 w-4" />
            Call
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Room slide ─────────────────────────────────────────────────────────────

interface RoomSlideProps {
  room: Room
  onJoin: (room: Room) => void
  onCallSolo: (p: PresetWithCategory) => void
  onOpenProfile?: (p: PresetWithCategory) => void
  onPreview?: (p: PresetWithCategory) => void
  previewing?: string | null
  previewLoading?: string | null
}

interface RoomSlidePropsExt extends RoomSlideProps {
  matches: boolean
  highlyMatches: boolean
  /** Render-cost-heavy Warp shader is only mounted on slides near the active
   *  one. RoomList passes true for the current slide and its neighbors. */
  renderWarp: boolean
}

function RoomSlide({ room, onJoin, onCallSolo, onOpenProfile, onPreview, previewing, previewLoading, matches, highlyMatches, renderWarp }: RoomSlidePropsExt) {
  const participants = roomParticipants(room)
  const gradient = CATEGORY_GRADIENTS[room.category]
  const baseWarp = CATEGORY_WARP_COLORS[room.category]

  // Per-room color jitter so 10 trading rooms don't all look identical. Shifts
  // each channel by ±20 deterministically from the room id.
  const warpColors = useMemo<[string, string, string]>(() => {
    const jitter = (hex: string, idx: number) => {
      const h = nameHash(room.id + idx)
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      const shift = (v: number, n: number) => Math.max(0, Math.min(255, v + (((n >>> 4) & 0x3F) - 32)))
      return (
        "#" +
        shift(r, h).toString(16).padStart(2, "0") +
        shift(g, h >> 8).toString(16).padStart(2, "0") +
        shift(b, h >> 16).toString(16).padStart(2, "0")
      )
    }
    return [jitter(baseWarp[0], 0), jitter(baseWarp[1], 1), jitter(baseWarp[2], 2)]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, room.category])

  const themeColor = participants[0] ? voiceThemes[participants[0].voice].color3 : "#888"

  // Some rooms have human(s) in them. Deterministic so the same rooms always
  // carry the "mixed" status across reloads. Used after join (not on the card).
  const hasHuman = roomHasHuman(room.id)

  // How long the room has been going — deterministic per room so it's stable.
  const startedMinutesAgo = 2 + (nameHash(room.id + "started") % 58) // 2 – 59

  // Simulated active speaker — rotates among participants. Slowed down per
  // user feedback ("mic is not moving that fast") so the active mic feels
  // natural, not twitchy.
  const [speakerIdx, setSpeakerIdx] = useState(0)
  useEffect(() => {
    if (!renderWarp || participants.length === 0) return
    const tick = () => setSpeakerIdx((i) => (i + 1) % participants.length)
    const id = setInterval(tick, 5500 + (nameHash(room.id) % 2500)) // 5.5–8s
    return () => clearInterval(id)
  }, [renderWarp, participants.length, room.id])

  const danceClasses = ["dance-a", "dance-b", "dance-c", "dance-d"]

  // Decorative "listener" avatars — passive audience filling out the room.
  // Deterministic seeds per room → stable across reloads, ~20-35 per card.
  const listeners = useMemo(() => {
    const count = 16 + (nameHash(room.id + "ln-count") % 20) // 16–35
    return Array.from({ length: count }, (_, i) => {
      const seed = nameHash(room.id + "L" + i)
      const gender = (seed >>> 8) % 2 === 0 ? "men" : "women"
      const id = seed % 96
      return `https://randomuser.me/api/portraits/${gender}/${id}.jpg`
    })
  }, [room.id])
  const listenersPerRow = 9
  const listenerRows: string[][] = []
  for (let i = 0; i < Math.min(listeners.length, listenersPerRow * 2); i += listenersPerRow) {
    listenerRows.push(listeners.slice(i, i + listenersPerRow))
  }

  return (
    <div className="relative flex-[0_0_100%] min-w-0 h-full">
      <div className={`relative h-full w-full overflow-hidden flex flex-col ${highlyMatches ? "match-glow" : ""}`}>
        {/* Warp shader — colored to the room's vibe. Mounted only on the
            active/adjacent slides so we don't run 12 WebGL contexts at once. */}
        {renderWarp && (
          <div className="absolute inset-0 pointer-events-none z-0">
            <WarpLayer colors={warpColors} />
          </div>
        )}

        {/* Animated diagonal shine only for highly-matching rooms */}
        {highlyMatches && <div className="match-shine z-20" />}

        {/* (Photo backdrop intentionally removed — the Warp shader is the
            primary surface. Avatar portraits stay as the photo-quality detail.) */}

        {/* Slow breathing colored highlight — drifts in and out so the slide
            never feels frozen even when the photo motion is quiet */}
        <div
          className="absolute inset-0 pointer-events-none mix-blend-screen breathing-light"
          style={{
            background: `radial-gradient(60% 50% at 70% 30%, ${themeColor}55, transparent 70%)`,
          }}
        />

        {/* Very subtle category tint — just a hint of mood */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />

        {/* Soft bottom-to-top darken so text reads cleanly */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/10" />

        {/* Foreground content — pt-16 keeps card content below the carousel
            HUD (cursor counter + filter button) so they never overlap. */}
        <div className="relative z-10 flex flex-col h-full text-white px-5 pt-16 pb-28">
          {/* Top — just Live + how long the room has been going */}
          <div className="flex items-center justify-start">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="uppercase tracking-wider font-bold">Live</span>
              </span>
              <span className="text-white/30">·</span>
              <span>{formatTimeAgo(startedMinutesAgo)}</span>
            </div>
          </div>

          {/* Stage — Clubhouse / Spaces layout:
              1. ONE big avatar at the top (on the mic)
              2. Co-speakers row (the rest, also on the mic, rotating slowly)
              3. Listener rows (passive audience, decorative)
          */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-0 py-3 gap-4">
            {(() => {
              const active = participants[speakerIdx % participants.length]
              if (!active) return null
              const isPreviewing = previewing === active.name
              const isLoading = previewLoading === active.name
              return (
                <div className="relative flex flex-col items-center">
                  <button
                    data-no-drag
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onPreview) onPreview(active)
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="dance-b will-change-transform transition-transform relative"
                    style={{ animationDelay: "0s" }}
                    aria-label={`Listen to ${active.name}`}
                  >
                    <Avatar
                      voice={active.voice}
                      imageUrl={imageFor(active)}
                      fallbackEmoji={active.emoji}
                      size={isPreviewing ? 116 : 104}
                      className={
                        isPreviewing
                          ? "ring-4 ring-emerald-300 shadow-2xl shadow-emerald-400/70 transition-all"
                          : "ring-4 ring-emerald-400 shadow-2xl shadow-emerald-500/50 transition-all"
                      }
                    />
                    <span
                      className={`absolute -bottom-1 -right-1 h-8 w-8 rounded-full flex items-center justify-center border-2 border-stone-900 ${
                        isPreviewing ? "bg-emerald-400" : "bg-emerald-500"
                      }`}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 text-white animate-spin" />
                      ) : isPreviewing ? (
                        <XIcon className="h-4 w-4 text-white" />
                      ) : (
                        <Mic className="h-4 w-4 text-white" />
                      )}
                    </span>
                  </button>
                  {/* Audio bars under the mic */}
                  <div className="h-4 mt-2 flex items-end gap-1">
                    <span className="audio-bar" style={{ height: 14, animationDelay: "0ms" }} />
                    <span className="audio-bar" style={{ height: 14, animationDelay: "120ms" }} />
                    <span className="audio-bar" style={{ height: 14, animationDelay: "240ms" }} />
                    <span className="audio-bar" style={{ height: 14, animationDelay: "60ms" }} />
                    <span className="audio-bar" style={{ height: 14, animationDelay: "180ms" }} />
                  </div>
                  <div className="text-xs text-white/95 font-bold mt-1">
                    {active.name.replace(/\s*\(.+\)/, "")}
                  </div>
                </div>
              )
            })()}

            {/* Co-speakers row — everyone except the currently featured speaker
                + the empty "+ You" seat */}
            <div className="flex items-end justify-center gap-2 flex-wrap max-w-full">
              {participants.map((p, i) => {
                if (i === speakerIdx % participants.length) return null
                const dance = danceClasses[i % danceClasses.length]
                return (
                  <button
                    key={p.name}
                    data-no-drag
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenProfile?.(p)
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={`${dance} will-change-transform transition-transform flex flex-col items-center`}
                    style={{ animationDelay: `${(i + 1) * 0.4}s` }}
                    aria-label={`Open ${p.name}'s profile`}
                  >
                    <Avatar
                      voice={p.voice}
                      imageUrl={imageFor(p)}
                      fallbackEmoji={p.emoji}
                      size={50}
                      className="ring-2 ring-white/40"
                    />
                  </button>
                )
              })}
              {/* "+ You" seat — same action as the Join button */}
              <button
                data-no-drag
                onClick={(e) => {
                  e.stopPropagation()
                  onJoin(room)
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="rounded-full flex items-center justify-center text-white/70 hover:text-white border-2 border-dashed border-white/45 hover:border-white/85 dance-d will-change-transform active:scale-95 transition-all"
                style={{ width: 50, height: 50, animationDelay: `${participants.length * 0.4}s` }}
                aria-label="Join the room"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            {/* Listener rows — small static avatars, the room's audience */}
            <div className="space-y-1.5 mt-1">
              {listenerRows.map((row, i) => (
                <div key={i} className="flex items-center justify-center gap-1">
                  {row.map((url, j) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={`${i}-${j}`}
                      src={url}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-white/20 opacity-80"
                      loading="lazy"
                    />
                  ))}
                </div>
              ))}
              <div className="text-[10px] text-white/55 text-center pt-0.5 font-semibold">
                {listeners.length} listening
              </div>
            </div>
          </div>

          {/* Bottom block — topic, vibe, tags, big Join CTA */}
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-[34px] sm:text-5xl font-extrabold leading-[1.02] tracking-tight drop-shadow-md">
                {room.topic}
              </h2>
              <p className="text-sm text-white/85 mt-2 leading-relaxed drop-shadow-sm max-w-md">
                {room.vibe}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {room.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-white/12 backdrop-blur-sm border border-white/15 text-white/85 font-bold tracking-wide uppercase"
                >
                  {t}
                </span>
              ))}
            </div>

            <button
              onClick={() => onJoin(room)}
              className={`mt-1 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-base font-bold shadow-2xl active:scale-[0.98] transition-all ${
                matches
                  ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                  : "bg-stone-500/40 hover:bg-stone-500/60 text-white/80 backdrop-blur border border-white/15"
              }`}
            >
              <Phone className="h-5 w-5" />
              Join the room
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Room carousel (landing page) ───────────────────────────────────────────

interface RoomListProps {
  onJoin: (room: Room) => void
  onCallSolo: (preset: PresetWithCategory) => void
  onOpenProfile: (preset: PresetWithCategory) => void
  onOpenUserProfile: () => void
  onOpenFreelancers: () => void
  onShortlist: (roomId: string) => void
  shortlistCount: number
}

// ─── Tinder-style draggable room card ───────────────────────────────────────

const SWIPE_THRESHOLD = 110 // px before a release counts as a swipe

interface DragState {
  dragging: boolean
  x: number
  y: number
  startX: number
  startY: number
  released: null | "left" | "right" | "up"
}

interface TinderCardProps {
  room: Room
  isTop: boolean
  stackDepth: number
  matches: boolean
  highlyMatches: boolean
  onSwipe: (direction: "left" | "right" | "up") => void
  onJoin: (room: Room) => void
  onCallSolo: (p: PresetWithCategory) => void
  onOpenProfile: (p: PresetWithCategory) => void
  onPreview: (p: PresetWithCategory) => void
  previewing: string | null
  previewLoading: string | null
}

function TinderCard({
  room,
  isTop,
  stackDepth,
  matches,
  highlyMatches,
  onSwipe,
  onJoin,
  onCallSolo,
  onOpenProfile,
  onPreview,
  previewing,
  previewLoading,
}: TinderCardProps) {
  const [drag, setDrag] = useState<DragState>({
    dragging: false,
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
    released: null,
  })

  const handleDown = (e: React.PointerEvent) => {
    if (!isTop) return
    // Don't hijack drags that begin on interactive children
    const target = e.target as HTMLElement
    if (target.closest("button, a, [data-no-drag]")) return
    setDrag({
      dragging: true,
      x: 0,
      y: 0,
      startX: e.clientX,
      startY: e.clientY,
      released: null,
    })
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleMove = (e: React.PointerEvent) => {
    if (!drag.dragging) return
    setDrag((d) => ({
      ...d,
      x: e.clientX - d.startX,
      y: e.clientY - d.startY,
    }))
  }

  const handleUp = (e: React.PointerEvent) => {
    if (!drag.dragging) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    const { x, y } = drag
    const absX = Math.abs(x)
    const absY = Math.abs(y)
    let released: DragState["released"] = null
    if (absX > SWIPE_THRESHOLD && absX > absY) released = x > 0 ? "right" : "left"
    else if (-y > SWIPE_THRESHOLD && absY > absX) released = "up"

    if (released) {
      // Animate off, then notify parent (parent advances stack)
      setDrag((d) => ({ ...d, released, dragging: false }))
      setTimeout(() => onSwipe(released!), 260)
    } else {
      setDrag({ dragging: false, x: 0, y: 0, startX: 0, startY: 0, released: null })
    }
  }

  // Card transform
  let translateX = drag.x
  let translateY = drag.y
  let rotation = drag.x * 0.045
  let extraOpacity = 1
  if (drag.released === "right") { translateX = 1000; rotation = 22 }
  else if (drag.released === "left") { translateX = -1000; rotation = -22 }
  else if (drag.released === "up") { translateY = -1000 }

  if (!isTop) {
    // Stacked behind — render as a CLEAN COLORED STUB, not the full card.
    // Reasons: (a) avoids the next card's text/chips ghosting through the
    // top card during a swipe, (b) saves the render cost of the full slide
    // on cards the user can't actually read yet.
    const scale = 1 - stackDepth * 0.04
    const offsetY = stackDepth * 10
    const stubOpacity = 1 - stackDepth * 0.2
    const stubGradient = CATEGORY_GRADIENTS[room.category]
    return (
      <div
        className="absolute inset-0 will-change-transform overflow-hidden"
        style={{
          transform: `translate(0, ${offsetY}px) scale(${scale})`,
          opacity: stubOpacity,
          zIndex: 10 - stackDepth,
          transition: "transform 0.35s ease-out, opacity 0.35s",
          pointerEvents: "none",
        }}
      >
        {/* Solid dark base so nothing behind shows through */}
        <div className="absolute inset-0 bg-stone-950" />
        {/* Soft category-tinted wash so each upcoming card hints at its mood */}
        <div className={`absolute inset-0 bg-gradient-to-br ${stubGradient}`} />
        {/* Subtle vignette to lift it off the page bg */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/30" />
      </div>
    )
  }

  // LIKE / NOPE / PEEK overlays — fade in based on drag direction
  const likeOpacity = Math.max(0, Math.min(1, drag.x / 120))
  const nopeOpacity = Math.max(0, Math.min(1, -drag.x / 120))
  const peekOpacity = Math.max(0, Math.min(1, -drag.y / 120))

  return (
    <div
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      className="absolute inset-0 will-change-transform touch-none select-none"
      style={{
        transform: `translate(${translateX}px, ${translateY}px) rotate(${rotation}deg)`,
        transition: drag.dragging ? "none" : "transform 0.26s ease-out",
        zIndex: 20,
        cursor: drag.dragging ? "grabbing" : "grab",
      }}
    >
      <RoomSlide
        room={room}
        onJoin={onJoin}
        onCallSolo={onCallSolo}
        onOpenProfile={onOpenProfile}
        onPreview={onPreview}
        previewing={previewing}
        previewLoading={previewLoading}
        matches={matches}
        highlyMatches={highlyMatches}
        renderWarp={true}
      />

      {/* LIKE / NOPE / PEEK stamps */}
      <div
        className="absolute top-24 left-6 px-3 py-1.5 rounded-lg border-[3px] border-emerald-400 text-emerald-400 font-extrabold text-3xl tracking-widest -rotate-12 pointer-events-none"
        style={{ opacity: likeOpacity, textShadow: "0 0 10px rgba(16,185,129,0.6)" }}
      >
        LIKE
      </div>
      <div
        className="absolute top-24 right-6 px-3 py-1.5 rounded-lg border-[3px] border-red-400 text-red-400 font-extrabold text-3xl tracking-widest rotate-12 pointer-events-none"
        style={{ opacity: nopeOpacity, textShadow: "0 0 10px rgba(239,68,68,0.6)" }}
      >
        PASS
      </div>
      <div
        className="absolute top-32 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg border-[3px] border-sky-300 text-sky-300 font-extrabold text-2xl tracking-widest pointer-events-none whitespace-nowrap"
        style={{ opacity: peekOpacity, textShadow: "0 0 10px rgba(56,189,248,0.6)" }}
      >
        SEE WHO'S IN
      </div>
    </div>
  )
}

type Visibility = "yes" | "no" | "invited"

function RoomList({ onJoin, onCallSolo, onOpenProfile, onOpenUserProfile, onOpenFreelancers, onShortlist, shortlistCount }: RoomListProps) {
  const [cursor, setCursor] = useState(0)
  const [peekRoom, setPeekRoom] = useState<Room | null>(null)
  const [userPrefs, setUserPrefs] = useState<Set<RoomTag>>(new Set())
  const [pendingJoin, setPendingJoin] = useState<Room | null>(null)
  const [visibility, setVisibility] = useState<Visibility>("yes")
  const [connectingRoom, setConnectingRoom] = useState<Room | null>(null)

  // Preview voice-snippet state
  const [previewing, setPreviewing] = useState<string | null>(null) // persona name
  const [previewLoading, setPreviewLoading] = useState<string | null>(null) // persona name being fetched
  const snippetIdxRef = useRef<Record<string, number>>({})
  const previewCacheRef = useRef<Map<string, Blob>>(new Map())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopPreview = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current = null
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
    setPreviewing(null)
    setPreviewLoading(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => stopPreview, [stopPreview])

  const handlePreview = useCallback(
    async (persona: PresetWithCategory) => {
      // Tapping the same persona again stops the preview.
      if (previewing === persona.name || previewLoading === persona.name) {
        stopPreview()
        return
      }
      stopPreview()

      const lines = PREVIEW_LINES[persona.category] ?? PREVIEW_LINES.friends
      const idx = snippetIdxRef.current[persona.name] ?? 0
      const text = lines[idx % lines.length]
      snippetIdxRef.current[persona.name] = idx + 1 // rotate for next tap

      setPreviewLoading(persona.name)

      try {
        const cacheKey = `${persona.name}|${text}`
        let blob = previewCacheRef.current.get(cacheKey)
        if (!blob) {
          const r = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text,
              voice: persona.voice,
              voiceId: persona.voiceId,
            }),
          })
          if (!r.ok) {
            setPreviewLoading(null)
            return
          }
          blob = await r.blob()
          previewCacheRef.current.set(cacheKey, blob)
        }

        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioRef.current = audio

        const cleanup = () => {
          URL.revokeObjectURL(url)
          if (audioRef.current === audio) audioRef.current = null
          if (stopTimerRef.current) {
            clearTimeout(stopTimerRef.current)
            stopTimerRef.current = null
          }
          setPreviewing(null)
          setPreviewLoading(null)
        }

        audio.onended = cleanup
        audio.onerror = cleanup

        // 10-second hard cap on previews
        stopTimerRef.current = setTimeout(() => {
          audio.pause()
          cleanup()
        }, 10000)

        await audio.play().catch(cleanup)
        setPreviewLoading(null)
        setPreviewing(persona.name)
      } catch {
        setPreviewLoading(null)
      }
    },
    [previewing, previewLoading, stopPreview]
  )

  const askJoin = (room: Room) => {
    setPeekRoom(null)
    setPendingJoin(room)
  }
  const confirmJoin = () => {
    if (pendingJoin) {
      // Kill any preview audio before the countdown overlay covers the screen
      audioRef.current?.pause()
      const room = pendingJoin
      setPendingJoin(null)
      setConnectingRoom(room) // → triggers CountdownOverlay
    }
  }

  const togglePref = (t: RoomTag) => {
    setUserPrefs((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const roomMatches = (room: Room): boolean => {
    if (userPrefs.size === 0) return true
    return room.tags.some((t) => userPrefs.has(t))
  }
  const roomHighlyMatches = (room: Room): boolean => {
    if (userPrefs.size === 0) return false
    const score = room.tags.reduce((n, t) => n + (userPrefs.has(t) ? 1 : 0), 0)
    return score >= 2
  }

  const handleSwipe = (room: Room, direction: "left" | "right" | "up") => {
    if (direction === "up") {
      setPeekRoom(room)
      // peek doesn't consume the card — reset by setting cursor back? Actually
      // the card is already animating off. Instead of advancing, we hold the
      // peek modal and the user can dismiss; the next card will be a NEW one.
      // Simpler: advance cursor on up as well, since the sheet shows the room.
      setCursor((c) => c + 1)
      return
    }
    if (direction === "right") {
      onShortlist(room.id)
    }
    setCursor((c) => c + 1)
  }

  // Show up to 3 cards in the stack: current, next, and one behind.
  const stack = ROOMS.slice(cursor, cursor + 3)

  return (
    <div className="h-screen w-full overflow-hidden relative bg-black">
      {/* Card stack */}
      <div className="absolute inset-0">
        {stack.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
            <button
              onClick={() => setCursor(0)}
              className="px-6 py-3 rounded-full bg-white text-stone-900 font-semibold"
            >
              Restart
            </button>
          </div>
        )}
        {/* Render back-to-front so top card is last in JSX (highest natural z) */}
        {stack
          .map((room, i) => ({ room, i }))
          .reverse()
          .map(({ room, i }) => (
            <TinderCard
              key={room.id + "@" + cursor + i}
              room={room}
              isTop={i === 0}
              stackDepth={i}
              matches={roomMatches(room)}
              highlyMatches={roomHighlyMatches(room)}
              onSwipe={(dir) => {
                stopPreview()
                handleSwipe(room, dir)
              }}
              onJoin={askJoin}
              onCallSolo={onCallSolo}
              onOpenProfile={onOpenProfile}
              onPreview={handlePreview}
              previewing={previewing}
              previewLoading={previewLoading}
            />
          ))}
      </div>

      {/* (cursor counter removed — no count chrome on the deck) */}

      {/* Preferences sheet (right) */}
      <Sheet>
        <SheetTrigger asChild>
          <button
            className="absolute top-5 right-5 z-30 h-10 w-10 rounded-full bg-black/35 backdrop-blur-md border border-white/15 text-white flex items-center justify-center"
            aria-label="What you're into"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {userPrefs.size > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-emerald-500 text-[10px] font-bold flex items-center justify-center">
                {userPrefs.size}
              </span>
            )}
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-3xl border-white/10 bg-stone-950 text-white">
          <SheetHeader>
            <SheetTitle className="text-white">What you're into</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6 pt-2 flex flex-wrap gap-2">
            {ALL_TAGS.map((t) => {
              const active = userPrefs.has(t)
              return (
                <button
                  key={t}
                  onClick={() => togglePref(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide transition-all border ${
                    active
                      ? "bg-white text-stone-900 border-white"
                      : "bg-transparent text-white/85 border-white/25 hover:border-white/60"
                  }`}
                >
                  {t}
                </button>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* Peek participants — bottom sheet listing the room's people */}
      <Sheet open={!!peekRoom} onOpenChange={(o) => !o && setPeekRoom(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl border-white/10 bg-stone-950 text-white">
          {peekRoom && (
            <>
              <SheetHeader>
                <SheetTitle className="text-white">{peekRoom.topic}</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-6 pt-2 space-y-2">
                <p className="text-sm text-white/80">{peekRoom.vibe}</p>
                <div className="grid grid-cols-1 gap-2 mt-3">
                  {roomParticipants(peekRoom).map((p) => (
                    <button
                      key={p.name}
                      onClick={() => {
                        setPeekRoom(null)
                        onOpenProfile(p)
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-left"
                    >
                      <Avatar
                        voice={p.voice}
                        imageUrl={imageFor(p)}
                        fallbackEmoji={p.emoji}
                        size={42}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-[11px] text-white/60 truncate">
                          {extractTraits(p.personality).join(" · ")}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-white/40" />
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => askJoin(peekRoom)}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-full bg-emerald-500 text-white font-semibold"
                >
                  <Phone className="h-4 w-4" />
                  Join this room
                </button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Gesture-hint strip — sits above the bottom tab bar */}
      <div className="absolute left-0 right-0 bottom-[60px] z-20 pointer-events-none">
        <div className="flex items-center justify-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-black/40 backdrop-blur text-white/80">
            ← Pass
          </span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-black/40 backdrop-blur text-white/80">
            ↑ See who
          </span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-black/40 backdrop-blur text-white/80">
            Like →
          </span>
        </div>
      </div>

      {/* Countdown overlay — appears after the modal closes, before the call starts */}
      {connectingRoom && (
        <CountdownOverlay
          room={connectingRoom}
          onComplete={() => {
            const room = connectingRoom
            setConnectingRoom(null)
            onJoin(room)
          }}
          onCancel={() => setConnectingRoom(null)}
        />
      )}

      {/* Visibility-confirmation modal — shown before actually joining */}
      <Dialog open={!!pendingJoin} onOpenChange={(o) => !o && setPendingJoin(null)}>
        <DialogContent className="max-w-sm rounded-3xl border-white/10 bg-stone-950 text-white p-0 overflow-hidden">
          <div className="p-5 pt-6">
            <DialogHeader>
              <DialogTitle className="text-white text-xl text-left">
                Going live
              </DialogTitle>
              <DialogDescription className="text-white/70 text-sm text-left">
                Allow other humans to see this room while you're in it? If left
                open, your room will surface in matches — a mixed human + AI feed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 mt-4">
              <VisibilityOption
                label="Yes"
                subtitle="Open — anyone can drop in"
                active={visibility === "yes"}
                onSelect={() => setVisibility("yes")}
                accent="emerald"
              />
              <VisibilityOption
                label="No"
                subtitle="Just me and the AIs in the room"
                active={visibility === "no"}
                onSelect={() => setVisibility("no")}
                accent="zinc"
              />
              <VisibilityOption
                label="Only invited"
                subtitle="Hidden — share an invite link"
                active={visibility === "invited"}
                onSelect={() => setVisibility("invited")}
                accent="violet"
              />
            </div>

            <button
              onClick={confirmJoin}
              className="w-full mt-5 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-white font-semibold flex items-center justify-center gap-2 shadow-xl transition-all"
            >
              <Phone className="h-4 w-4" />
              Join the room
            </button>

            <p className="text-[11px] text-white/45 text-center mt-3 leading-relaxed">
              Humans in the room can change this at any time.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Countdown overlay shown after the user confirms Join ─────────────────

interface CountdownOverlayProps {
  room: Room
  onComplete: () => void
  onCancel: () => void
}

function CountdownOverlay({ room, onComplete, onCancel }: CountdownOverlayProps) {
  // 4 → 3 → 2 → 1 → "loading" → onComplete
  const STEPS = [4, 3, 2, 1, "loading"] as const
  const [stepIdx, setStepIdx] = useState(0)
  const current = STEPS[stepIdx]

  useEffect(() => {
    const id = setTimeout(() => {
      if (stepIdx < STEPS.length - 1) {
        setStepIdx((i) => i + 1)
      } else {
        onComplete()
      }
    }, 800)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx])

  const participants = roomParticipants(room)
  const backdrop = participants[0] ? imageFor(participants[0]) : ""

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      {backdrop && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backdrop}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-110"
          style={{ filter: "blur(40px) brightness(0.35) saturate(1.1)" }}
        />
      )}

      {/* Cancel button top-left, in case the user changes their mind */}
      <button
        onClick={onCancel}
        className="absolute top-5 left-5 z-10 h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-white/15"
        aria-label="Cancel"
      >
        <XIcon className="h-4 w-4" />
      </button>

      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[11px] uppercase tracking-[0.35em] text-white/70 mb-1">
          Request sent
        </p>
        <p className="text-sm text-white/60 mb-10">{room.topic}</p>

        <div className="relative h-[200px] w-[200px] flex items-center justify-center">
          {/* Outer ambient ring */}
          <div className="absolute inset-0 rounded-full border border-emerald-400/40 count-ring" />
          <div className="absolute inset-4 rounded-full border border-emerald-400/25 count-ring" style={{ animationDelay: "0.5s" }} />

          {current === "loading" ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 text-emerald-400 animate-spin" />
              <span className="text-base text-white/80 tracking-wide">Loading…</span>
            </div>
          ) : (
            <div
              key={stepIdx}
              className="count-pop font-bold leading-none"
              style={{ fontSize: 144, textShadow: "0 0 40px rgba(16, 185, 129, 0.55)" }}
            >
              {current}
            </div>
          )}
        </div>

        <p className="text-xs text-white/60 mt-10 max-w-xs leading-relaxed">
          Letting {participants.map((p) => p.name.replace(/\s*\(.+\)/, "")).slice(0, 2).join(" and ")}
          {participants.length > 2 ? ` and ${participants.length - 2} other${participants.length === 3 ? "" : "s"}` : ""}{" "}
          know you're here…
        </p>
      </div>
    </div>
  )
}

// Big tap-target radio option used inside the visibility dialog.
function VisibilityOption({
  label,
  subtitle,
  active,
  onSelect,
  accent,
}: {
  label: string
  subtitle: string
  active: boolean
  onSelect: () => void
  accent: "emerald" | "zinc" | "violet"
}) {
  const accentRing =
    accent === "emerald"
      ? "ring-emerald-400 bg-emerald-500/15"
      : accent === "violet"
        ? "ring-amber-400 bg-amber-500/15"
        : "ring-stone-300 bg-stone-500/15"
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${
        active
          ? `border-transparent ring-2 ${accentRing}`
          : "border-white/10 bg-white/5 hover:bg-white/10"
      }`}
    >
      <div
        className={`h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
          active ? "border-white bg-white" : "border-white/30"
        }`}
      >
        {active && <div className="h-2 w-2 rounded-full bg-stone-900" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-base font-semibold text-white">{label}</div>
        <div className="text-xs text-white/65 mt-0.5">{subtitle}</div>
      </div>
    </button>
  )
}

// ─── Call screen ────────────────────────────────────────────────────────────

interface FullBgOrbProps {
  persona: Persona
  audioLevel: number
  isSpeaking: boolean
  baseSpeed: number
}

// Hook to track viewport size — reused by every Warp instance.
function useViewportSize() {
  const [size, setSize] = useState<{ w: number; h: number }>(() =>
    typeof window === "undefined" ? { w: 1280, h: 720 } : { w: window.innerWidth, h: window.innerHeight }
  )
  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])
  return size
}

// Reusable Warp renderer used by both the call screen and room slides.
function WarpLayer({
  colors,
  speed = DEFAULT_SHADER_SPEED,
}: {
  colors: [string, string, string]
  speed?: number
}) {
  const size = useViewportSize()
  return (
    <Warp
      width={size.w}
      height={size.h}
      colors={colors}
      proportion={0.35}
      softness={1}
      distortion={0.32}
      swirl={1}
      swirlIterations={0}
      shape="edge"
      shapeScale={0}
      speed={speed}
      scale={0.31}
      rotation={176}
      offsetX={0.65}
      offsetY={0.09}
    />
  )
}

function FullBgOrb({ persona, audioLevel, isSpeaking, baseSpeed }: FullBgOrbProps) {
  const theme = voiceThemes[persona.voice]
  const dynamicSpeed = isSpeaking ? baseSpeed * 1.5 : baseSpeed
  const scale = 1 + audioLevel * 0.06

  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none z-0 transition-transform duration-100 ease-out"
      style={{ transform: `scale(${scale})` }}
    >
      <WarpLayer
        colors={[theme.color1, theme.color2, theme.color3]}
        speed={dynamicSpeed}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/15 dark:to-black/40" />
    </div>
  )
}

// Big sliding speaker — only one visible at a time. Slides from right when
// becoming active, slides off to the left when going inactive.
function SpeakingAvatar({
  persona,
  isActive,
  audioLevel,
  size = 200,
}: {
  persona: Persona
  isActive: boolean
  audioLevel: number
  size?: number
}) {
  const emoji = presetByName(persona.name)?.emoji ?? "✨"
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out ${
        isActive ? "opacity-100 translate-x-0 scale-100" : "opacity-0 translate-x-32 scale-90 pointer-events-none"
      }`}
      style={{
        // Pulse on active speech
        transform: isActive ? `scale(${1 + audioLevel * 0.08})` : undefined,
      }}
    >
      <Avatar
        voice={persona.voice}
        imageUrl={imageFor(persona)}
        fallbackEmoji={emoji}
        size={size}
        className="ring-4 ring-white/50 dark:ring-white/15 shadow-2xl"
      />
    </div>
  )
}

interface CallScreenProps {
  personaA: Persona
  setPersonaA: (p: Persona) => void
  personaB: Persona
  setPersonaB: (p: Persona) => void
  relationship: string
  setRelationship: (s: string) => void
  mode: "solo" | "third"
  roomTopic?: string
  extraParticipants?: PresetWithCategory[]
  /** True when the room contains a real human listener. Shown as a post-join notice. */
  humanInRoom?: boolean
  autoConnect: boolean
  onBack: () => void
}

function CallScreen({
  personaA,
  setPersonaA,
  personaB,
  setPersonaB,
  relationship,
  mode,
  roomTopic,
  extraParticipants = [],
  humanInRoom = false,
  autoConnect,
  onBack,
}: CallScreenProps) {
  const [audioLevel, setAudioLevel] = useState(0)
  const [transcript, setTranscript] = useState<{ text: string; speaker: "user" | "self" | "partner" }[]>([])
  const [showTranscript, setShowTranscript] = useState(false)
  const [showHumanNotice, setShowHumanNotice] = useState(false)
  const humanNoticeShownRef = useRef(false)

  // Gift exchange + call-billing — uses the same credit store as the user profile.
  const { balance, hourlyUsed, hourlyCap, sendGift, receiveLetter, transferOnCall } = useCredits()
  const [elapsedSec, setElapsedSec] = useState(0)
  const [outOfCoins, setOutOfCoins] = useState(false)
  const [giftPickerOpen, setGiftPickerOpen] = useState(false)
  const [floatingGifts, setFloatingGifts] = useState<
    { id: number; emoji: string; direction: "sent" | "received"; key: string }[]
  >([])
  const [lastGiftToast, setLastGiftToast] = useState<string | null>(null)
  const giftIdRef = useRef(0)
  const giftToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showFloatingGift = (emoji: string, direction: "sent" | "received", toastText: string) => {
    const id = ++giftIdRef.current
    setFloatingGifts((arr) => [...arr, { id, emoji, direction, key: `${id}` }])
    setTimeout(() => {
      setFloatingGifts((arr) => arr.filter((g) => g.id !== id))
    }, 2500)
    setLastGiftToast(toastText)
    if (giftToastTimerRef.current) clearTimeout(giftToastTimerRef.current)
    giftToastTimerRef.current = setTimeout(() => setLastGiftToast(null), 3200)
  }

  // In third mode, build the full list of OTHER AIs in the room:
  // personaB + any extra participants from the original room.
  // We convert PresetWithCategory → Persona using personaA's language/etc. as base.
  const allPartners: Persona[] = useMemo(() => {
    if (mode !== "third") return []
    const fromExtras: Persona[] = extraParticipants.map((p) => ({
      ...personaA,
      name: p.name,
      personality: p.personality,
      speakingStyle: p.speakingStyle,
      backstory: p.backstory,
      voice: p.voice,
      warmth: p.defaultWarmth,
      talkStyle: p.defaultTalkStyle,
      ...(p.barTalk !== undefined ? { barTalk: p.barTalk } : {}),
    }))
    return [personaB, ...fromExtras]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, personaB, extraParticipants])

  const { isConnected, isConnecting, isSpeaking, activeSpeaker, error, connect, disconnect, submitText } =
    useRealtimeVoice({
      persona: personaA,
      partners: allPartners.length > 0 ? allPartners : undefined,
      relationship: mode === "third" ? relationship : undefined,
      onTranscript: (text, speaker) => {
        setTranscript((prev) => [...prev.slice(-14), { text, speaker }])
      },
      onAudioLevel: setAudioLevel,
    })

  // More-actions sheet + paste-text dialog state
  const [moreOpen, setMoreOpen] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteValue, setPasteValue] = useState("")
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState("")

  const handleSubmitPaste = () => {
    const text = pasteValue.trim()
    if (!text) return
    submitText(text)
    setPasteValue("")
    setPasteOpen(false)
    setLastGiftToast(`Sent ${text.length > 30 ? text.slice(0, 30) + "…" : text}`)
    if (giftToastTimerRef.current) clearTimeout(giftToastTimerRef.current)
    giftToastTimerRef.current = setTimeout(() => setLastGiftToast(null), 2400)
  }

  const handleSubmitLink = () => {
    const url = linkValue.trim()
    if (!url) return
    submitText(`Here's a link to look at: ${url}`)
    setLinkValue("")
    setLinkOpen(false)
    setLastGiftToast("Link sent")
    if (giftToastTimerRef.current) clearTimeout(giftToastTimerRef.current)
    giftToastTimerRef.current = setTimeout(() => setLastGiftToast(null), 2400)
  }

  // Hidden file inputs — actual functionality for image/file send.
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const screenShareStreamRef = useRef<MediaStream | null>(null)

  const showActionToast = (text: string) => {
    setLastGiftToast(text)
    if (giftToastTimerRef.current) clearTimeout(giftToastTimerRef.current)
    giftToastTimerRef.current = setTimeout(() => setLastGiftToast(null), 2400)
  }

  const handleImagePick = () => {
    setMoreOpen(false)
    imageInputRef.current?.click()
  }
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const sizeKb = (file.size / 1024).toFixed(0)
    submitText(
      `I'm sharing an image with you: ${file.name} (${file.type || "image"}, ${sizeKb}kb). You can't see it yet but tell me you noticed it.`
    )
    showActionToast(`📷 ${file.name}`)
  }

  const handleFilePick = () => {
    setMoreOpen(false)
    fileInputRef.current?.click()
  }
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const sizeKb = (file.size / 1024).toFixed(0)
    // For text-like files, paste the content directly into the convo.
    const isTextLike =
      file.type.startsWith("text/") ||
      /\.(md|txt|json|csv|log|yaml|yml|html|css|js|ts|tsx|jsx|py|go|rs)$/i.test(file.name)
    if (isTextLike) {
      try {
        const text = await file.text()
        const preview = text.length > 3000 ? text.slice(0, 3000) + "\n\n…(truncated)" : text
        submitText(
          `I'm pasting a document into our chat — ${file.name} (${sizeKb}kb):\n\n${preview}`
        )
        showActionToast(`📄 ${file.name}`)
      } catch {
        showActionToast(`Could not read ${file.name}`)
      }
    } else {
      submitText(
        `I'm sharing a file with you: ${file.name} (${file.type || "unknown"}, ${sizeKb}kb).`
      )
      showActionToast(`📎 ${file.name}`)
    }
  }

  const handleScreenShare = async () => {
    setMoreOpen(false)
    if (!navigator.mediaDevices?.getDisplayMedia) {
      showActionToast(typeof window !== "undefined" && !window.isSecureContext
        ? "🖥️ Screen share needs https:// or localhost"
        : "🖥️ Screen share isn't supported in this browser")
      return
    }
    try {
      // Stop a previous session if it was still alive
      screenShareStreamRef.current?.getTracks().forEach((t) => t.stop())
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      screenShareStreamRef.current = stream
      submitText("I'm sharing my screen with you right now — talk me through what you'd look at.")
      showActionToast("🖥️ Screen sharing started")
      stream.getVideoTracks().forEach((t) => {
        t.onended = () => {
          screenShareStreamRef.current = null
          showActionToast("🖥️ Screen sharing stopped")
        }
      })
    } catch {
      showActionToast("Screen share cancelled")
    }
  }

  // Stop screen-share when the call ends / component unmounts
  useEffect(() => {
    return () => {
      screenShareStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenShareStreamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!autoConnect) return
    const t = setTimeout(() => {
      if (!isConnected && !isConnecting) connect()
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect])

  // Active AI's name — the one we attribute gifts to.
  const activeAIName = activeSpeaker === "partner" ? personaB.name : personaA.name

  // Elapsed-time ticker (1Hz) — drives the "5:23" display.
  useEffect(() => {
    if (!isConnected) {
      setElapsedSec(0)
      return
    }
    const id = setInterval(() => setElapsedSec((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [isConnected])

  // Per-minute billing: 1 coin transfers from user → active AI's wallet
  // every 60 seconds of connection. Auto-hangup if balance hits zero.
  useEffect(() => {
    if (!isConnected) return
    const tick = () => {
      const result = transferOnCall(activeAIName)
      if (result === "broke") {
        setOutOfCoins(true)
        setTimeout(() => {
          disconnect()
          setTimeout(() => onBack(), 1500)
        }, 1800)
      }
    }
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, activeAIName])

  // Reveal the "there's a human here" notice once, a couple seconds after the
  // call connects. Intentionally NOT shown on the room card.
  useEffect(() => {
    if (!isConnected || !humanInRoom || humanNoticeShownRef.current) return
    humanNoticeShownRef.current = true
    const showId = setTimeout(() => setShowHumanNotice(true), 1500)
    const hideId = setTimeout(() => setShowHumanNotice(false), 1500 + 5000)
    return () => {
      clearTimeout(showId)
      clearTimeout(hideId)
    }
  }, [isConnected, humanInRoom])

  // AIs occasionally mail the user a K-L-O-O-M letter while the call runs.
  // Each letter lands with an immediate credit gift. Cap-respecting.
  useEffect(() => {
    if (!isConnected) return
    let alive = true

    const scheduleNext = () => {
      const delay = 45_000 + Math.random() * 45_000
      const tid = setTimeout(() => {
        if (!alive) return
        const result = receiveLetter(activeAIName, Math.random())
        if (result.ok) {
          const letterEmoji = result.letter === "M" ? "💌" : "✉️"
          showFloatingGift(letterEmoji, "received", `${activeAIName} mailed you the letter ${result.letter}  ·  +${result.value}`)
        }
        // If the AI is broke / capped, we silently skip — try again next tick.
        scheduleNext()
      }, delay)
      return tid
    }
    const id = scheduleNext()

    return () => {
      alive = false
      clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, activeAIName])

  const handleSendGift = (gift: GiftType) => {
    const result = sendGift(gift, activeAIName)
    if (result === "ok") {
      showFloatingGift(gift.emoji, "sent", `You sent ${activeAIName} a ${gift.name}`)
      setGiftPickerOpen(false)
    } else if (result === "balance") {
      setLastGiftToast("Not enough credits — top up on your profile.")
      if (giftToastTimerRef.current) clearTimeout(giftToastTimerRef.current)
      giftToastTimerRef.current = setTimeout(() => setLastGiftToast(null), 3200)
    } else if (result === "cap") {
      setLastGiftToast("Hourly gift cap reached — try again later.")
      if (giftToastTimerRef.current) clearTimeout(giftToastTimerRef.current)
      giftToastTimerRef.current = setTimeout(() => setLastGiftToast(null), 3200)
    }
  }

  const handleEndCall = () => {
    disconnect()
    setTranscript([])
    onBack()
  }

  const isAActive = activeSpeaker === "self" || (!isSpeaking && activeSpeaker === null)
  const isBActive = activeSpeaker === "partner"

  const currentName = activeAIName

  const statusText = !isConnected
    ? isConnecting
      ? "Connecting…"
      : roomTopic
        ? "Joining room…"
        : "Calling…"
    : isSpeaking
      ? `${currentName} is speaking…`
      : "Listening…"

  const speakingPersona = activeSpeaker === "partner" ? personaB : personaA

  return (
    <div className="min-h-screen w-full flex flex-col items-center relative">
      <FullBgOrb
        persona={speakingPersona}
        audioLevel={audioLevel}
        isSpeaking={isSpeaking}
        baseSpeed={DEFAULT_SHADER_SPEED}
      />

      {/* Top bar */}
      <div className="w-full max-w-2xl mx-auto px-4 pt-6 flex items-center justify-between z-10 gap-2">
        <button
          onClick={handleEndCall}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-white/30 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/10 hover:bg-white/40 dark:hover:bg-black/30 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Rooms
        </button>

        {/* Billing chip — elapsed time + coins remaining */}
        {isConnected && (
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-semibold backdrop-blur-md border ${
              balance <= 2
                ? "bg-rose-500/40 border-rose-300/50 text-white animate-pulse"
                : "bg-white/30 dark:bg-black/30 border-white/40 dark:border-white/15"
            }`}
            title="1 coin per minute · transferred to the AI's wallet"
          >
            <span>{formatElapsed(elapsedSec)}</span>
            <span className="opacity-50">·</span>
            <Coins className="h-3.5 w-3.5" />
            <span>{balance}</span>
          </div>
        )}

        {roomTopic && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/30 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/10 max-w-[140px] truncate">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{roomTopic}</span>
          </div>
        )}
      </div>

      {/* Center — sliding speaker stage */}
      <div className="flex-1 flex flex-col items-center justify-center text-center z-10 px-4">
        {mode === "third" ? (
          <div className="relative h-56 w-56 mb-6">
            <SpeakingAvatar persona={personaA} isActive={isAActive} audioLevel={audioLevel} size={200} />
            <SpeakingAvatar persona={personaB} isActive={isBActive} audioLevel={audioLevel} size={200} />
          </div>
        ) : (
          <div className="mb-6">
            <Avatar
              voice={personaA.voice}
              imageUrl={imageFor(personaA)}
              fallbackEmoji={presetByName(personaA.name)?.emoji ?? "✨"}
              size={200}
              className="ring-4 ring-white/50 dark:ring-white/15 shadow-2xl"
            />
          </div>
        )}

        <h2 className="text-3xl font-semibold tracking-tight mb-1 drop-shadow-sm">
          {currentName}
        </h2>
        <p className="text-sm text-foreground/70 drop-shadow-sm">{statusText}</p>

        {/* Other participants quietly listed below */}
        {(mode === "third" || extraParticipants.length > 0) && (
          <div className="mt-5 flex items-center justify-center gap-2 flex-wrap max-w-md">
            {mode === "third" && (
              <ParticipantThumbnail persona={personaA} active={isAActive} />
            )}
            {mode === "third" && (
              <ParticipantThumbnail persona={personaB} active={isBActive} />
            )}
            {extraParticipants.map((p) => (
              <ParticipantThumbnail key={p.name} persona={p} active={false} dim />
            ))}
          </div>
        )}

        {extraParticipants.length > 0 && (
          <p className="text-[10px] text-foreground/50 mt-3 drop-shadow-sm">
            (everyone in the room is on rotation — 2 talk per turn)
          </p>
        )}

        {error && (
          <div className="mt-4 max-w-sm text-sm text-destructive bg-destructive/10 backdrop-blur-md px-4 py-2 rounded-xl">
            {error}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="w-full max-w-2xl mx-auto px-4 pb-10 z-10">
        {transcript.length > 0 && showTranscript && (
          <div className="mb-4 space-y-2 max-h-56 overflow-y-auto bg-white/40 dark:bg-black/30 backdrop-blur-xl rounded-2xl p-3 border border-white/40 dark:border-white/10">
            {transcript.map((item, i) => {
              const speakerName =
                item.speaker === "user"
                  ? "You"
                  : item.speaker === "self"
                    ? personaA.name
                    : personaB.name
              const align =
                item.speaker === "user"
                  ? "bg-black/10 dark:bg-white/10 text-foreground ml-8"
                  : item.speaker === "self"
                    ? "bg-emerald-500/15 text-foreground mr-8"
                    : "bg-pink-500/15 text-foreground mr-8"
              return (
                <div key={i} className={`text-sm px-3 py-2 rounded-xl ${align}`}>
                  <span className="font-medium text-[10px] block uppercase tracking-wider opacity-70 mb-0.5">
                    {speakerName}
                  </span>
                  {item.text}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setShowTranscript((s) => !s)}
            className="h-12 w-12 rounded-full bg-white/30 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/10 flex items-center justify-center hover:bg-white/40 dark:hover:bg-black/30 transition-colors"
            title={showTranscript ? "Hide transcript" : "Show transcript"}
          >
            {showTranscript ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          <button
            onClick={() => setGiftPickerOpen(true)}
            className="h-12 w-12 rounded-full bg-pink-500/80 hover:bg-pink-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all relative"
            title="Send a gift"
          >
            <Gift className="h-5 w-5" />
            {hourlyUsed > 0 && (
              <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-white text-pink-600 text-[10px] font-bold flex items-center justify-center">
                {hourlyUsed}
              </span>
            )}
          </button>

          <button
            onClick={() => setMoreOpen(true)}
            className="h-12 w-12 rounded-full bg-white/30 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/10 flex items-center justify-center hover:bg-white/40 dark:hover:bg-black/30 transition-colors"
            title="More"
          >
            <Plus className="h-5 w-5" />
          </button>

          {isConnected ? (
            <button
              onClick={handleEndCall}
              className="h-16 px-6 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-2xl flex items-center gap-2 font-medium active:scale-95 transition-transform"
            >
              <PhoneOff className="h-5 w-5" />
              End
            </button>
          ) : (
            <button
              onClick={() => connect()}
              disabled={isConnecting}
              className="h-16 px-6 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-2xl flex items-center gap-2 font-medium disabled:opacity-60 active:scale-95 transition-transform"
            >
              {isConnecting ? (
                <>
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  <Phone className="h-5 w-5" />
                  {roomTopic ? "Join" : "Call"}
                </>
              )}
            </button>
          )}

          <div className="flex items-center">
            <PersonaEditor
              persona={personaA}
              onPersonaChange={setPersonaA}
              title={`Customize ${personaA.name}${mode === "third" ? " (A)" : ""}`}
            />
            {mode === "third" && (
              <PersonaEditor
                persona={personaB}
                onPersonaChange={setPersonaB}
                title={`Customize ${personaB.name} (B)`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Human-in-room notice — slides in from the top a moment after joining */}
      {showHumanNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none slide-top">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-amber-500/95 backdrop-blur-xl border border-amber-300/30 text-white shadow-2xl">
            <div className="relative h-7 w-7 rounded-full bg-amber-400/40 flex items-center justify-center">
              <User className="h-4 w-4" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-amber-500" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold">Real person in the room</div>
              <div className="text-[11px] text-white/85">One of the listeners isn't an AI.</div>
            </div>
          </div>
        </div>
      )}

      {/* Out-of-coins takeover — appears in the final moments before hangup */}
      {outOfCoins && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex flex-col items-center justify-center text-white text-center px-6">
          <div className="text-6xl mb-4">💸</div>
          <h3 className="text-2xl font-bold mb-1">Out of coins</h3>
          <p className="text-sm text-white/70 max-w-xs">
            Ending the call. Top up from your profile to keep going.
          </p>
        </div>
      )}

      {/* Floating rising-gift emojis */}
      <div className="pointer-events-none fixed bottom-32 left-1/2 z-40">
        {floatingGifts.map((g) => (
          <div
            key={g.key}
            className="gift-rise absolute"
            style={{
              fontSize: 64,
              left: 0,
              textShadow: "0 0 30px rgba(255,255,255,0.5)",
            }}
          >
            {g.emoji}
          </div>
        ))}
      </div>

      {/* Toast above the controls */}
      {lastGiftToast && (
        <div className="pointer-events-none fixed bottom-32 left-1/2 -translate-x-1/2 z-40">
          <div className="px-3 py-2 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-white text-xs font-medium whitespace-nowrap shadow-2xl">
            {lastGiftToast}
          </div>
        </div>
      )}

      {/* "+" / more-actions sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-white/10 bg-stone-950 text-white">
          <SheetHeader>
            <SheetTitle className="text-white">Add to the room</SheetTitle>
          </SheetHeader>
          <div className="px-2 pb-6 pt-2 space-y-1">
            <MoreRow
              icon={LinkIcon}
              label="Share link"
              hint="Drop a URL into the conversation"
              onClick={() => { setMoreOpen(false); setLinkOpen(true) }}
            />
            <MoreRow
              icon={ClipboardPaste}
              label="Send text"
              hint="Paste a message — they'll read it"
              onClick={() => { setMoreOpen(false); setPasteOpen(true) }}
            />
            <MoreRow
              icon={ImageIcon}
              label="Send image"
              hint="Pick from your photos"
              onClick={handleImagePick}
            />
            <MoreRow
              icon={FileUp}
              label="Send file"
              hint="Doc, code, or transcript — they'll read it"
              onClick={handleFilePick}
            />
            <MoreRow
              icon={ScreenShare}
              label="Share screen"
              hint="Show them what you're looking at"
              onClick={handleScreenShare}
            />
          </div>
          {/* Hidden file pickers */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.json,.csv,.log,.yaml,.yml,.html,.css,.js,.ts,.tsx,.jsx,.py,.go,.rs,.pdf,.doc,.docx,.mp3,.wav"
            className="hidden"
            onChange={handleFileChange}
          />
        </SheetContent>
      </Sheet>

      {/* Paste-text dialog */}
      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="max-w-md rounded-3xl border-white/10 bg-stone-950 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Send text to {activeAIName}</DialogTitle>
            <DialogDescription className="text-white/65">
              Anything you paste here lands in the room as if you said it.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            rows={5}
            autoFocus
            placeholder="Paste a screenshot of OCR text, a song lyric, a tweet…"
            className="w-full bg-white/5 border border-white/15 rounded-2xl p-3 text-sm text-white placeholder:text-white/35 resize-none focus:outline-none focus:ring-2 focus:ring-white/25"
          />
          <div className="flex items-center justify-between gap-2 mt-2">
            <span className="text-[11px] text-white/40">{pasteValue.length} chars</span>
            <button
              onClick={handleSubmitPaste}
              disabled={!pasteValue.trim()}
              className="px-5 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm disabled:opacity-40 active:scale-[0.97] transition-all"
            >
              Send
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share-link dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md rounded-3xl border-white/10 bg-stone-950 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Share a link with {activeAIName}</DialogTitle>
            <DialogDescription className="text-white/65">
              They'll see the URL and react. Full-page reading isn't on yet.
            </DialogDescription>
          </DialogHeader>
          <input
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            autoFocus
            placeholder="https://…"
            className="w-full bg-white/5 border border-white/15 rounded-full px-4 py-3 text-sm text-white placeholder:text-white/35 font-mono focus:outline-none focus:ring-2 focus:ring-white/25"
          />
          <div className="flex items-center justify-end gap-2 mt-2">
            <button
              onClick={handleSubmitLink}
              disabled={!linkValue.trim()}
              className="px-5 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm disabled:opacity-40 active:scale-[0.97] transition-all"
            >
              Share
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gift picker sheet — mail the AI a letter */}
      <Sheet open={giftPickerOpen} onOpenChange={setGiftPickerOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-white/10 bg-stone-950 text-white">
          <SheetHeader>
            <SheetTitle className="text-white">Mail {activeAIName} a letter</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6 pt-2 space-y-3">
            <div className="flex items-center justify-between text-xs text-white/65">
              <span className="flex items-center gap-1">
                <Coins className="h-3.5 w-3.5" />
                {balance} credits
              </span>
              <span>
                {hourlyUsed} / {hourlyCap} used this hour
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {GIFTS.map((g) => {
                const tooBig = hourlyUsed + g.credits > hourlyCap
                const tooPoor = balance < g.credits
                const disabled = tooBig || tooPoor
                return (
                  <button
                    key={g.id}
                    disabled={disabled}
                    onClick={() => handleSendGift(g)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all active:scale-[0.97] ${
                      disabled
                        ? "border-white/5 bg-white/2 opacity-40"
                        : "border-white/15 bg-white/5 hover:bg-white/10"
                    }`}
                    title={tooBig ? "Would exceed hourly cap" : tooPoor ? "Not enough credits" : undefined}
                  >
                    <span className="text-3xl">{g.emoji}</span>
                    <span className="text-[11px] font-semibold text-white/85 leading-tight">
                      {g.name}
                    </span>
                    <span className="text-[10px] text-emerald-300 font-bold">{g.credits} cr</span>
                  </button>
                )
              })}
            </div>

            <p className="text-[11px] text-white/45 text-center leading-relaxed pt-1">
              Goes straight to {activeAIName}'s wallet · hourly cap {hourlyCap} credits combined · they mail you letters back.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function ParticipantThumbnail({
  persona,
  active,
  dim = false,
}: {
  persona: Persona | PresetWithCategory
  active: boolean
  dim?: boolean
}) {
  const voice = persona.voice
  const emoji = "emoji" in persona ? persona.emoji : presetByName(persona.name)?.emoji ?? "✨"
  return (
    <div className={`relative transition-opacity ${dim ? "opacity-50" : "opacity-100"}`}>
      <Avatar
        voice={voice}
        imageUrl={imageFor(persona)}
        fallbackEmoji={emoji}
        size={36}
        className={active ? "ring-2 ring-emerald-400 shadow-emerald-500/50 shadow-lg" : "ring-2 ring-white/30"}
      />
      {active && (
        <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
        </span>
      )}
    </div>
  )
}

// ─── Profile screen ─────────────────────────────────────────────────────────

interface ProfileScreenProps {
  participant: PresetWithCategory
  onBack: () => void
  onCallSolo: (p: PresetWithCategory) => void
  onCustomize: (p: PresetWithCategory) => void
}

function ProfileScreen({ participant, onBack, onCallSolo, onCustomize }: ProfileScreenProps) {
  const CategoryIcon = CATEGORY_INFO[participant.category].icon
  const traits = extractTraits(participant.personality)
  const warpColors = CATEGORY_WARP_COLORS[participant.category]
  const firstName = participant.name.split(/\s/)[0]

  // Agent wallet for this AI
  const { getAgentBalance, ensureAgent } = useCredits()
  useEffect(() => { ensureAgent(participant.name) }, [participant.name, ensureAgent])
  const agentBal = getAgentBalance(participant.name)
  const agentAddr = useMemo(() => agentWalletAddress(participant.name), [participant.name])
  const [addrCopied, setAddrCopied] = useState(false)

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(agentAddr)
      setAddrCopied(true)
      setTimeout(() => setAddrCopied(false), 1500)
    } catch {}
  }

  return (
    <div className="min-h-screen w-full bg-black text-white relative">
      {/* Ambient warp shader behind content */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <WarpLayer colors={warpColors} />
      </div>

      {/* Hero image */}
      <div className="relative w-full overflow-hidden" style={{ height: "55vh", minHeight: 360 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageFor(participant)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover ken-burns-a will-change-transform"
        />
        {/* Top vignette for icons */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-transparent" />
        {/* Bottom fade so the hero blends into the dark page */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/70 to-transparent" />

        {/* Top action bar */}
        <div className="absolute top-5 left-5 right-5 z-10 flex items-center justify-between">
          <button
            onClick={onBack}
            className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-black/55"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => onCustomize(participant)}
            className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-black/55"
            aria-label="Customize"
          >
            <Settings2 className="h-5 w-5" />
          </button>
        </div>

        {/* Name + category over hero */}
        <div className="absolute left-5 right-5 bottom-6 z-10">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-4xl font-bold tracking-tight leading-tight drop-shadow-lg">
                {participant.name.replace(/\s*\(.+\)/, "")}
              </h1>
              <div className="flex items-center gap-1.5 mt-2">
                <Badge variant="secondary" className="bg-white/15 text-white border-white/20 backdrop-blur text-[10px]">
                  <CategoryIcon className="h-3 w-3 mr-1" />
                  {CATEGORY_INFO[participant.category].label}
                </Badge>
              </div>
            </div>
            <span className="text-5xl drop-shadow-lg">{participant.emoji}</span>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="relative z-10 px-5 pb-32 pt-2 space-y-6">
        {/* Traits */}
        <div className="flex flex-wrap gap-1.5">
          {traits.map((t) => (
            <span
              key={t}
              className="text-[11px] px-3 py-1 rounded-full bg-white/10 text-white/90 border border-white/15 backdrop-blur uppercase tracking-wide font-semibold"
            >
              {t}
            </span>
          ))}
        </div>

        <ProfileSection title="About">
          <span className="block">{participant.personality}</span>
          {participant.speakingStyle && (
            <span className="block mt-3">{participant.speakingStyle}</span>
          )}
          {participant.backstory && (
            <span className="block mt-3">{participant.backstory}</span>
          )}
        </ProfileSection>

        {/* Agent wallet card */}
        <div className="rounded-2xl bg-gradient-to-br from-purple-500/15 via-emerald-400/5 to-transparent border border-purple-400/25 backdrop-blur p-3 mt-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-purple-200/80 font-bold flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-br from-purple-400 to-emerald-400" />
                Agent wallet · $KLOOM
              </div>
              <button
                onClick={copyAddress}
                className="mt-1.5 flex items-center gap-1 font-mono text-[11px] text-white/80 hover:text-white"
                title="Copy address"
              >
                <span>{shortenAddress(agentAddr)}</span>
                {addrCopied ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <span className="text-white/40">⎘</span>
                )}
              </button>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold flex items-center gap-1">
                <Coins className="h-4 w-4 text-emerald-400" />
                {agentBal}
              </div>
              <div className="text-[10px] text-white/55 mt-0.5">on Solana</div>
            </div>
          </div>
          <p className="text-[10px] text-white/45 mt-2 leading-relaxed">
            {firstName} spends from this wallet to mail you letters. They top up
            every time you gift them coins.
          </p>
        </div>

        {/* Meta cards */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <ProfileMeta
            icon={SparklesIcon}
            label="Vibes"
            value={CATEGORY_INFO[participant.category].label}
          />
          <ProfileMeta icon={Languages} label="Language" value="English" />
        </div>
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 px-4 pt-6 pb-6 bg-gradient-to-t from-black via-black/95 to-transparent pointer-events-none">
        <div className="max-w-md mx-auto flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => onCustomize(participant)}
            className="h-14 w-14 shrink-0 rounded-full bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 text-white flex items-center justify-center"
            aria-label="Customize"
          >
            <Settings2 className="h-5 w-5" />
          </button>
          <button
            onClick={() => onCallSolo(participant)}
            className="flex-1 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-white font-semibold shadow-2xl flex items-center justify-center gap-2 transition-all"
          >
            <Phone className="h-5 w-5" />
            Call {firstName}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/55 font-semibold mb-1.5">
        {title}
      </div>
      <p className="text-sm leading-relaxed text-white/90">{children}</p>
    </div>
  )
}

function ProfileMeta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MessageCircle
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/55 font-semibold">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-sm font-medium mt-0.5 capitalize">{value}</div>
    </div>
  )
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_PERSONA_A: Persona = {
  name: "Nova",
  personality:
    "Sharp, observant, a little mischievous. You skip small talk. You notice what people don't say and call it out.",
  speakingStyle:
    "Quick, dry. Short sentences. You ask the question they've been avoiding.",
  backstory:
    "You stopped doing small talk a long time ago.",
  voice: "echo",
  language: "English",
  warmth: 55,
  talkStyle: 65,
  barTalk: 40,
}

const DEFAULT_PERSONA_B: Persona = {
  name: "Kai",
  personality:
    "Playful, witty, a little flirty. You lighten the mood.",
  speakingStyle: "Upbeat and quick. Easy banter.",
  backstory: "Known Nova for years.",
  voice: "ash",
  language: "English",
  warmth: 70,
  talkStyle: 70,
  barTalk: 35,
}

// ─── Top level ──────────────────────────────────────────────────────────────

// ─── Credits + Gift exchange ────────────────────────────────────────────────

interface PurchaseRecord {
  amount: number // dollars
  minutes: number
  timestamp: number
}

// Gifts the user sends an AI — letters / notes they "mail" as tips. Pure
// credit transfer into the AI's wallet, priced by weight.
interface GiftType {
  id: string
  emoji: string
  name: string
  credits: number
}

const GIFTS: GiftType[] = [
  { id: "note",     emoji: "✉️", name: "Note",     credits: 1  },
  { id: "letter",   emoji: "💌", name: "Letter",   credits: 2  },
  { id: "card",     emoji: "📬", name: "Card",     credits: 3  },
  { id: "parcel",   emoji: "📦", name: "Parcel",   credits: 5  },
  { id: "telegram", emoji: "📜", name: "Telegram", credits: 10 },
]

const HOURLY_GIFT_CAP = 25 // credits per hour, combined directions

interface GiftEvent {
  giftId: string
  credits: number
  direction: "sent" | "received"
  toName?: string // who the gift went to (for sent) or came from (for received)
  timestamp: number
}

// ─── KLOOM letters (the quiet collectible) ──────────────────────────────────
// AIs occasionally mail the user a single letter. Each letter lands with an
// immediate credit gift. The letters spell K-L-O-O-M — and a user who happens
// to gather the whole word unlocks something. We never tell them that. It's
// just there to be found.
const KLOOM_WORD = ["K", "L", "O", "O", "M"] as const
type KloomLetter = "K" | "L" | "O" | "M"
// Multiset the collection must satisfy: K×1, L×1, O×2, M×1.
const KLOOM_NEEDED: Record<string, number> = { K: 1, L: 1, O: 2, M: 1 }
// Immediate credit gift carried by each letter. M is the rarest + richest.
const LETTER_VALUE: Record<KloomLetter, number> = { K: 2, L: 2, O: 3, M: 5 }
// Weighted draw — M is deliberately scarce so completing the word is hard.
const LETTER_WEIGHTS: [KloomLetter, number][] = [
  ["K", 26], ["L", 26], ["O", 40], ["M", 8],
]

function drawLetter(seedFloat: number): KloomLetter {
  const total = LETTER_WEIGHTS.reduce((s, [, w]) => s + w, 0)
  let r = seedFloat * total
  for (const [letter, w] of LETTER_WEIGHTS) {
    if (r < w) return letter
    r -= w
  }
  return "K"
}

function kloomComplete(letters: string[]): boolean {
  const c: Record<string, number> = {}
  for (const l of letters) c[l] = (c[l] || 0) + 1
  return Object.entries(KLOOM_NEEDED).every(([k, need]) => (c[k] || 0) >= need)
}

const STORAGE_GIFTS = "credits_gifts_v1"
const STORAGE_LETTERS = "kloom_letters_v1"
const STORAGE_PREMIUM = "kloom_premium_v1"
const STORAGE_AGENT_WALLETS = "credits_agents_v1"
const STORAGE_SHORTLIST = "user_shortlist_v1"
const STORAGE_RECENT_CALLS = "user_recent_calls_v1"

// ─── AI agents are wallets too ──────────────────────────────────────────────
// Each persona has their own coin balance on the same $KLOOM Solana token.
// Sending a gift transfers coins from the user's wallet INTO the AI's wallet.
// When the AI mails letters back, it spends from its own wallet — meaning a
// "broke" AI can't keep tipping. They top up by receiving gifts from users.

// Deterministic 44-char base58-looking Solana wallet address per persona.
function agentWalletAddress(name: string): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
  let h = nameHash(name)
  let out = ""
  for (let i = 0; i < 44; i++) {
    h = Math.imul(h, 1664525) + 1013904223
    out += chars[Math.abs(h) % chars.length]
  }
  return out
}

function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

// Deterministic starting balance — varies by persona so the economy feels alive.
function initialAgentBalance(name: string): number {
  return 50 + (nameHash(name) % 150)
}

interface Offer {
  id: string
  label: string // "30 mins", "1 hour", "3 hours"
  price: number // dollars
  minutes: number
  hint: string
  highlight?: boolean
}

const STORAGE_BALANCE = "credits_balance_v1"
const STORAGE_HISTORY = "credits_history_v1"

function useCredits() {
  const [balance, setBalance] = useState(0)
  const [history, setHistory] = useState<PurchaseRecord[]>([])
  const [gifts, setGifts] = useState<GiftEvent[]>([])
  const [letters, setLetters] = useState<string[]>([])
  const [premiumUnlocked, setPremiumUnlocked] = useState(false)
  const [agentBalances, setAgentBalances] = useState<Record<string, number>>({})

  useEffect(() => {
    try {
      const b = localStorage.getItem(STORAGE_BALANCE)
      const h = localStorage.getItem(STORAGE_HISTORY)
      const g = localStorage.getItem(STORAGE_GIFTS)
      const l = localStorage.getItem(STORAGE_LETTERS)
      const p = localStorage.getItem(STORAGE_PREMIUM)
      const a = localStorage.getItem(STORAGE_AGENT_WALLETS)
      if (b) setBalance(parseInt(b, 10) || 0)
      if (h) setHistory(JSON.parse(h))
      if (g) setGifts(JSON.parse(g))
      if (l) setLetters(JSON.parse(l))
      if (p === "1") setPremiumUnlocked(true)
      if (a) setAgentBalances(JSON.parse(a))
    } catch {}
  }, [])

  const persistBalance = (n: number) => {
    try { localStorage.setItem(STORAGE_BALANCE, String(n)) } catch {}
  }
  const persistGifts = (g: GiftEvent[]) => {
    try { localStorage.setItem(STORAGE_GIFTS, JSON.stringify(g)) } catch {}
  }
  const persistLetters = (l: string[]) => {
    try { localStorage.setItem(STORAGE_LETTERS, JSON.stringify(l)) } catch {}
  }
  const persistAgents = (a: Record<string, number>) => {
    try { localStorage.setItem(STORAGE_AGENT_WALLETS, JSON.stringify(a)) } catch {}
  }

  // Lazy-init the on-screen balance for an AI. Generates from name hash on
  // first read so persisting is deterministic across reloads.
  const getAgentBalance = useCallback(
    (name: string) => {
      if (name in agentBalances) return agentBalances[name]
      return initialAgentBalance(name)
    },
    [agentBalances]
  )

  const ensureAgent = useCallback((name: string) => {
    setAgentBalances((prev) => {
      if (name in prev) return prev
      const next = { ...prev, [name]: initialAgentBalance(name) }
      persistAgents(next)
      return next
    })
  }, [])

  const buy = useCallback((offer: Offer) => {
    setBalance((b) => { const next = b + offer.minutes; persistBalance(next); return next })
    setHistory((h) => {
      const next = [...h, { amount: offer.price, minutes: offer.minutes, timestamp: Date.now() }]
      try { localStorage.setItem(STORAGE_HISTORY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  // How many credits have already moved (in either direction) in the last hour.
  const hourlyGifted = useCallback((events: GiftEvent[]) => {
    const cutoff = Date.now() - 3600_000
    return events.filter((e) => e.timestamp > cutoff).reduce((s, e) => s + e.credits, 0)
  }, [])

  /**
   * Attempt to send a gift to `recipientName`. The coins transfer from the
   * user's wallet INTO the AI's wallet.
   * Returns `"balance" | "cap"` if it can't happen, `"ok"` on success.
   */
  const sendGift = useCallback(
    (gift: GiftType, recipientName: string): "ok" | "balance" | "cap" => {
      const used = hourlyGifted(gifts)
      if (used + gift.credits > HOURLY_GIFT_CAP) return "cap"
      if (balance < gift.credits) return "balance"
      setBalance((b) => { const next = b - gift.credits; persistBalance(next); return next })
      // Transfer the coins to the AI agent's wallet
      setAgentBalances((prev) => {
        const current = prev[recipientName] ?? initialAgentBalance(recipientName)
        const next = { ...prev, [recipientName]: current + gift.credits }
        persistAgents(next)
        return next
      })
      setGifts((g) => {
        const next = [
          ...g,
          { giftId: gift.id, credits: gift.credits, direction: "sent" as const, toName: recipientName, timestamp: Date.now() },
        ]
        persistGifts(next)
        return next
      })
      return "ok"
    },
    [balance, gifts, hourlyGifted]
  )

  /**
   * An AI mails the user a single K-L-O-O-M letter. The letter carries an
   * immediate credit gift (added straight to the user's balance) and is added
   * to their collection. Debited from the AI's own wallet, so a broke AI can't
   * keep mailing. Returns the letter drawn (or a failure reason).
   *
   * Completing the word K-L-O-O-M flips premiumUnlocked — silently. Nothing in
   * the UI announces this; it's left to be discovered.
   */
  const receiveLetter = useCallback(
    (senderName: string, seedFloat: number):
      | { ok: true; letter: KloomLetter; value: number; completed: boolean }
      | { ok: false; reason: "cap" | "agent-broke" } => {
      const letter = drawLetter(seedFloat)
      const value = LETTER_VALUE[letter]
      const used = hourlyGifted(gifts)
      if (used + value > HOURLY_GIFT_CAP) return { ok: false, reason: "cap" }
      const senderBal =
        senderName in agentBalances ? agentBalances[senderName] : initialAgentBalance(senderName)
      if (senderBal < value) return { ok: false, reason: "agent-broke" }

      setAgentBalances((prev) => {
        const current = prev[senderName] ?? initialAgentBalance(senderName)
        const next = { ...prev, [senderName]: current - value }
        persistAgents(next)
        return next
      })
      // The immediate gift: credits land on the user's balance right away.
      setBalance((b) => { const next = b + value; persistBalance(next); return next })

      let completed = false
      setLetters((prev) => {
        const next = [...prev, letter]
        persistLetters(next)
        if (!premiumUnlocked && kloomComplete(next)) {
          completed = true
          setPremiumUnlocked(true)
          try { localStorage.setItem(STORAGE_PREMIUM, "1") } catch {}
        }
        return next
      })
      setGifts((g) => {
        const next = [
          ...g,
          { giftId: `letter-${letter}`, credits: value, direction: "received" as const, toName: senderName, timestamp: Date.now() },
        ]
        persistGifts(next)
        return next
      })
      return { ok: true, letter, value, completed }
    },
    [agentBalances, gifts, hourlyGifted, premiumUnlocked]
  )

  /**
   * Bills 1 coin from the user → into the currently-active AI's wallet.
   * Called once per minute from the active call. Returns "broke" if the
   * user has nothing left to spend (caller should hang up).
   */
  const transferOnCall = useCallback(
    (agentName: string): "ok" | "broke" => {
      if (balance < 1) return "broke"
      setBalance((b) => { const next = b - 1; persistBalance(next); return next })
      setAgentBalances((prev) => {
        const current = prev[agentName] ?? initialAgentBalance(agentName)
        const next = { ...prev, [agentName]: current + 1 }
        persistAgents(next)
        return next
      })
      return "ok"
    },
    [balance]
  )

  const hourlyUsed = hourlyGifted(gifts)

  return {
    balance,
    history,
    gifts,
    letters,
    premiumUnlocked,
    hourlyUsed,
    hourlyCap: HOURLY_GIFT_CAP,
    buy,
    sendGift,
    receiveLetter,
    getAgentBalance,
    ensureAgent,
    transferOnCall,
  }
}

// Smart 2-option offer selection based on purchase pattern.
// Tier 0 (new): $8 / 1h, $15 / 3h
// Tier 1 (has bought once): $4 / 30m, $8 / 60m
// Tier 2 (≥ 2 of $4 picks): $2 / 15m, $4 / 30m
function pickOffers(history: PurchaseRecord[]): Offer[] {
  if (history.length === 0) {
    return [
      { id: "first-1h",  label: "1 hour",  price: 8,  minutes: 60,  hint: "First-time offer" },
      { id: "first-3h",  label: "3 hours", price: 15, minutes: 180, hint: "Best value",       highlight: true },
    ]
  }

  const small4 = history.filter((h) => h.amount === 4).length
  if (small4 >= 2) {
    return [
      { id: "tier2-15m", label: "15 mins", price: 2, minutes: 15, hint: "Quick top-up" },
      { id: "tier2-30m", label: "30 mins", price: 4, minutes: 30, hint: "Just for you", highlight: true },
    ]
  }

  return [
    { id: "tier1-30m", label: "30 mins", price: 4, minutes: 30, hint: "Welcome back",   highlight: true },
    { id: "tier1-1h",  label: "1 hour",  price: 8, minutes: 60, hint: "Most popular" },
  ]
}

// ─── Shortlist + recent-calls persistence ──────────────────────────────────

interface RecentCallEntry {
  personaName: string
  kind: "voice" | "event" | "freelancer"
  timestamp: number
}

function useUserActivity() {
  const [shortlist, setShortlist] = useState<string[]>([])
  const [recentCalls, setRecentCalls] = useState<RecentCallEntry[]>([])

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_SHORTLIST)
      const r = localStorage.getItem(STORAGE_RECENT_CALLS)
      if (s) setShortlist(JSON.parse(s))
      if (r) setRecentCalls(JSON.parse(r))
    } catch {}
  }, [])

  const addToShortlist = useCallback((roomId: string) => {
    setShortlist((s) => {
      if (s.includes(roomId)) return s
      const next = [...s, roomId]
      try { localStorage.setItem(STORAGE_SHORTLIST, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const removeFromShortlist = useCallback((roomId: string) => {
    setShortlist((s) => {
      const next = s.filter((id) => id !== roomId)
      try { localStorage.setItem(STORAGE_SHORTLIST, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const recordCall = useCallback((personaName: string, kind: RecentCallEntry["kind"]) => {
    setRecentCalls((r) => {
      // Move existing entry to the top, dedupe
      const filtered = r.filter((e) => e.personaName !== personaName)
      const next = [{ personaName, kind, timestamp: Date.now() }, ...filtered].slice(0, 20)
      try { localStorage.setItem(STORAGE_RECENT_CALLS, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  return { shortlist, recentCalls, addToShortlist, removeFromShortlist, recordCall }
}

function formatMinutes(mins: number): string {
  if (mins <= 0) return "0 min"
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function formatElapsed(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }
  return `${m}:${String(s).padStart(2, "0")}`
}

function formatTimeAgo(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

interface CreditsCardProps {
  balance: number
  onAdd: () => void
}
function CreditsCard({ balance, onAdd }: CreditsCardProps) {
  return (
    <div className="relative rounded-3xl bg-gradient-to-br from-emerald-500/25 via-emerald-400/10 to-transparent border border-emerald-400/30 backdrop-blur-md p-4 mb-3 overflow-hidden">
      {/* Solana-coded purple/green accent corner */}
      <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br from-purple-500/40 to-emerald-400/40 blur-2xl pointer-events-none" />

      <div className="relative flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/80 font-bold flex items-center gap-1">
            <Coins className="h-3 w-3" />
            Your coins
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <div className="text-3xl font-bold text-white">{balance}</div>
            <div className="text-xs text-white/55">≈ {formatMinutes(balance)}</div>
          </div>
          <div className="text-[10px] text-white/55 mt-1 flex items-center gap-1 font-medium">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-br from-purple-400 to-emerald-400" />
            $KLOOM · Solana token · no expiry
          </div>
        </div>
        <button
          onClick={onAdd}
          className="shrink-0 h-12 px-4 rounded-full bg-white text-stone-900 text-sm font-bold flex items-center gap-1.5 shadow-xl active:scale-[0.97] transition-transform"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </div>
  )
}

interface LettersCardProps {
  letters: string[]
  premiumUnlocked: boolean
}
// Shows the letters the AIs have mailed you, laid out as K-L-O-O-M slots.
// We never explain what a full word does — the card just quietly fills in,
// and lights up if it's ever complete. Discovery is the point.
function LettersCard({ letters, premiumUnlocked }: LettersCardProps) {
  // Count how many of each letter we hold so duplicate O's both light up.
  const have: Record<string, number> = {}
  for (const l of letters) have[l] = (have[l] || 0) + 1
  // Walk the target word; mark a slot filled by consuming from `have`.
  const consumed: Record<string, number> = {}
  const slots = KLOOM_WORD.map((ch) => {
    consumed[ch] = (consumed[ch] || 0) + 1
    const filled = (have[ch] || 0) >= consumed[ch]
    return { ch, filled }
  })
  const collectedCount = slots.filter((s) => s.filled).length

  return (
    <div
      className={`rounded-3xl border backdrop-blur-md p-4 mb-5 transition-all ${
        premiumUnlocked
          ? "bg-gradient-to-br from-fuchsia-500/25 via-violet-500/15 to-transparent border-fuchsia-400/50 shadow-[0_0_40px_-12px] shadow-fuchsia-500/40"
          : "bg-gradient-to-br from-violet-500/12 via-violet-400/5 to-transparent border-violet-400/20"
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.2em] text-violet-200/80 font-bold mb-3">
        Letters from your rooms
      </div>
      <div className="flex items-center justify-center gap-2">
        {slots.map((s, i) => (
          <div
            key={i}
            className={`relative h-12 w-12 rounded-2xl flex items-center justify-center text-2xl font-extrabold transition-all ${
              s.filled
                ? premiumUnlocked
                  ? "bg-white text-fuchsia-700 shadow-lg"
                  : "bg-violet-500/30 text-white border border-violet-300/40"
                : "bg-white/5 text-white/15 border border-white/10"
            }`}
          >
            {s.filled ? s.ch : "·"}
          </div>
        ))}
      </div>
      <div className="text-[11px] text-white/45 text-center mt-3">
        {premiumUnlocked
          ? "Something opened up."
          : `${collectedCount} of ${KLOOM_WORD.length} collected · the AIs mail these when they like you`}
      </div>
    </div>
  )
}


interface BuyCreditsDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  offers: Offer[]
  onBuy: (offer: Offer) => void
  buySol: (usd: number, credits: number) => Promise<boolean>
  purchaseState: PurchaseState
  purchaseError: string | null
  usdToSol: (usd: number) => number
  isWalletConnected: boolean
  onConnectWallet: () => void
  walletAddress: string | null
}

const SOL_LABELS: Record<PurchaseState, string> = {
  idle:       "Pay with SOL",
  signing:    "Waiting for wallet…",
  confirming: "Confirming on-chain…",
  crediting:  "Crediting account…",
  done:       "Credits added ✓",
  error:      "Payment failed — try again",
}

function BuyCreditsDialog({
  open,
  onOpenChange,
  offers,
  onBuy,
  buySol,
  purchaseState,
  purchaseError,
  usdToSol,
  isWalletConnected,
  onConnectWallet,
  walletAddress,
}: BuyCreditsDialogProps) {
  const [pickedOffer, setPickedOffer]     = useState<Offer | null>(null)
  const [cardMode, setCardMode]           = useState(false)
  const [cardLoading, setCardLoading]     = useState(false)
  const [cardError, setCardError]         = useState<string | null>(null)
  // "in progress" only — excluding "done" so the success state (✓) renders.
  const solBusy = purchaseState !== "idle" && purchaseState !== "error" && purchaseState !== "done"

  useEffect(() => {
    if (!open) { setPickedOffer(null); setCardMode(false); setCardLoading(false); setCardError(null) }
  }, [open])

  useEffect(() => {
    if (purchaseState === "done") setTimeout(() => onOpenChange(false), 1200)
  }, [purchaseState, onOpenChange])

  const handleSolPay = async (offer: Offer) => {
    if (!isWalletConnected) { onConnectWallet(); return }
    const ok = await buySol(offer.price, offer.minutes)
    if (ok) onBuy(offer)
  }

  const handleCardPay = async (offer: Offer) => {
    if (!walletAddress) {
      setCardError("Connect your Solana wallet first — we use it as your account ID.")
      return
    }
    setCardLoading(true)
    setCardError(null)
    try {
      const res = await fetch("/api/ziina-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          walletAddress,
          price:   offer.price,
          credits: offer.minutes,
          kind:    "purchase",
          label:   offer.label,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? "checkout_failed")
      window.open(data.url, "_blank", "noopener")
      onOpenChange(false)
    } catch (e: unknown) {
      setCardError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setCardLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl border-white/10 bg-stone-950 text-white p-0 overflow-hidden">
        <div className="p-5 pt-6">

          {/* ── Step 1: pick a pack ── */}
          {!pickedOffer && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white text-xl text-left">Top up</DialogTitle>
                <DialogDescription className="text-white/65 text-sm text-left">
                  Buy <span className="font-semibold text-white">$KLOOM</span> credits. No subscriptions, no expiry.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2.5 mt-4">
                {offers.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setPickedOffer(o)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-4 rounded-2xl border text-left transition-all active:scale-[0.985] ${
                      o.highlight
                        ? "border-emerald-400/60 bg-emerald-500/10 hover:bg-emerald-500/15"
                        : "border-white/15 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-bold leading-tight">{o.label}</div>
                      <div className="text-[11px] uppercase tracking-wider mt-0.5 font-semibold text-white/65">{o.hint}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-extrabold">${o.price}</div>
                      <div className="text-[10px] text-white/55">one-time</div>
                    </div>
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-white/40 text-center mt-4">
                Cheapest competitor: $12 for 30 min. We're a fraction of that.
              </p>
            </>
          )}

          {/* ── Step 2: choose payment method ── */}
          {pickedOffer && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white text-xl text-left">
                  {pickedOffer.label} · ${pickedOffer.price}
                </DialogTitle>
                <DialogDescription className="text-white/65 text-sm text-left">
                  Same $KLOOM credits either way. Pick how you want to pay.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-5 space-y-3">

                {/* Card / Apple Pay — embedded, no PayPal login */}
                <button
                  onClick={() => {
                    if (!walletAddress) { setCardError("Connect your Solana wallet first — it's your account ID."); return }
                    setCardError(null); setCardMode((v) => !v)
                  }}
                  disabled={solBusy}
                  aria-expanded={cardMode}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl border transition-all disabled:opacity-50 text-left ${cardMode ? "border-white/30 bg-white/10" : "border-white/15 bg-white/5 hover:bg-white/10"}`}
                >
                  <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
                    <CreditCard size={18} className="text-stone-900" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm leading-tight">Pay by card</div>
                    <div className="text-[11px] text-white/50 mt-0.5">PayPal, Pay Later, Venmo or card · no account needed</div>
                  </div>
                  <ChevronRight size={15} className={`text-white/30 shrink-0 transition-transform ${cardMode ? "rotate-90" : ""}`} />
                </button>

                {/* PayPal v6 — PayPal, Pay Later, Venmo & card guest (no PayPal login) */}
                {cardMode && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <PayPalCheckout
                      walletAddress={walletAddress ?? ""}
                      price={pickedOffer.price}
                      credits={pickedOffer.minutes}
                      kind="purchase"
                      label={pickedOffer.label}
                      onSuccess={() => { onBuy(pickedOffer); setTimeout(() => onOpenChange(false), 1200) }}
                      onError={(m) => setCardError(m)}
                    />
                  </div>
                )}

                {/* SOL */}
                <button
                  onClick={() => handleSolPay(pickedOffer)}
                  disabled={solBusy || purchaseState === "done" || cardLoading}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl border transition-all disabled:cursor-wait text-left ${
                    purchaseState === "done"
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : purchaseState === "error"
                      ? "border-red-500/40 bg-red-500/10"
                      : solBusy
                      ? "border-amber-500/30 bg-amber-500/10 opacity-70"
                      : "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15"
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-lg font-bold text-amber-300">
                    ◎
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm leading-tight text-amber-200">
                      {!isWalletConnected ? "Connect wallet to pay in SOL" : SOL_LABELS[purchaseState]}
                    </div>
                    <div className="text-[11px] text-white/50 mt-0.5">
                      ≈ {usdToSol(pickedOffer.price).toFixed(4)} SOL · Phantom, Solflare, Backpack
                    </div>
                  </div>
                  {solBusy
                    ? <Loader2 size={15} className="animate-spin text-amber-400 shrink-0" />
                    : purchaseState === "done"
                    ? <span className="text-emerald-400 text-sm shrink-0">✓</span>
                    : <ChevronRight size={15} className="text-white/30 shrink-0" />
                  }
                </button>

                {/* Errors */}
                {cardError && (
                  <p className="text-xs text-red-400 text-center px-2">{cardError}</p>
                )}
                {purchaseError && purchaseState === "error" && (
                  <p className="text-xs text-red-400 text-center px-2">{purchaseError}</p>
                )}
              </div>

              <button
                onClick={() => { setPickedOffer(null); setCardError(null) }}
                disabled={solBusy || cardLoading}
                className="w-full text-center text-xs text-white/40 hover:text-white/70 mt-4 disabled:opacity-30"
              >
                ← pick a different pack
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PaymentMethodButton({
  icon: Icon,
  emoji,
  title,
  subtitle,
  hint,
  accent,
  disabled,
  loading,
  onClick,
}: {
  icon?: typeof CreditCard
  emoji?: string
  title: string
  subtitle: string
  hint: string
  accent?: boolean
  disabled?: boolean
  loading?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all active:scale-[0.985] ${
        accent
          ? "border-purple-400/60 bg-gradient-to-br from-purple-500/15 via-emerald-400/5 to-transparent hover:from-purple-500/20"
          : "border-white/15 bg-white/5 hover:bg-white/10"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <div
        className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 ${
          accent
            ? "bg-gradient-to-br from-purple-500/60 to-emerald-400/60 text-white"
            : "bg-white/10 text-white"
        }`}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : Icon ? (
          <Icon className="h-5 w-5" />
        ) : (
          <span className="text-xl font-bold">{emoji}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold leading-tight">{title}</div>
        <div className="text-[11px] text-white/70 mt-0.5 truncate">{subtitle}</div>
        <div className="text-[10px] text-white/45 mt-0.5">{hint}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-white/40" />
    </button>
  )
}

// ─── User profile screen with "Celebrate with AI" tab ──────────────────────

interface UserProfileScreenProps {
  onBack: () => void
  onLaunchEvent: (room: EventRoom) => void
  recentCalls: RecentCallEntry[]
  onOpenPersonaProfile: (personaName: string) => void
}

function UserProfileScreen({ onBack, onLaunchEvent, recentCalls, onOpenPersonaProfile }: UserProfileScreenProps) {
  const { balance: localBalance, history, letters, premiumUnlocked, buy } = useCredits()
  const {
    balance: solBalance,
    usdToSol,
    buySol,
    purchaseState,
    purchaseError,
    isWalletConnected,
  } = useSolCredits()
  const { publicKey } = useWallet()
  const { setVisible: openWalletModal } = useWalletModal()
  const walletAddress = publicKey?.toBase58() ?? null
  const balance = isWalletConnected ? solBalance : localBalance
  const [showBuy, setShowBuy] = useState(false)
  const [convertToast, setConvertToast] = useState<string | null>(null)
  const [cardSuccessToast, setCardSuccessToast] = useState(false)
  const offers = useMemo(() => pickOffers(history), [history])

  // Detect return from Ziina checkout (?payment=success)
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("payment") === "success") {
      setCardSuccessToast(true)
      window.history.replaceState({}, "", window.location.pathname)
      setTimeout(() => setCardSuccessToast(false), 5000)
    }
  }, [])

  return (
    <div className="min-h-screen w-full bg-black text-white relative overflow-x-hidden">
      {/* Subtle warp shader behind everything */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-30">
        <WarpLayer colors={["#a78bfa", "#ede9fe", "#7c3aed"]} />
      </div>

      <div className="relative z-10 max-w-md mx-auto px-5 pt-6 pb-28">
        <h1 className="text-2xl font-bold tracking-tight mb-4">Your profile</h1>

        {/* You-card */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-xl">
            <UserCircle2 className="h-9 w-9 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-semibold">You</div>
            <div className="text-xs text-white/60">Signed in</div>
          </div>
        </div>

        {/* Credits */}
        <CreditsCard balance={balance} onAdd={() => setShowBuy(true)} />

        {/* Letters mailed by the AIs — quietly spells K-L-O-O-M */}
        {letters.length > 0 && (
          <LettersCard letters={letters} premiumUnlocked={premiumUnlocked} />
        )}

        {/* Recent calls */}
        {recentCalls.length > 0 && (
          <div className="mb-5">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/55 font-bold flex items-center gap-1 mb-2">
              <Clock className="h-3 w-3" />
              Recent
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {recentCalls.slice(0, 10).map((entry) => {
                const persona = PERSONALITY_PRESETS.find((p) => p.name === entry.personaName)
                if (!persona) return null
                return (
                  <button
                    key={entry.personaName + entry.timestamp}
                    onClick={() => onOpenPersonaProfile(persona.name)}
                    className="shrink-0 flex flex-col items-center gap-1.5 w-16 group"
                  >
                    <div className="relative">
                      <Avatar
                        voice={persona.voice}
                        imageUrl={imageFor(persona)}
                        fallbackEmoji={persona.emoji}
                        size={56}
                        className="ring-2 ring-white/15 group-hover:ring-emerald-400 transition-all"
                      />
                      {entry.kind === "freelancer" && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-emerald-500 border-2 border-stone-950 flex items-center justify-center">
                          <Briefcase className="h-2.5 w-2.5 text-white" />
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-white/80 text-center leading-tight truncate w-full">
                      {persona.name.replace(/\s*\(.+\)/, "")}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Convert success toast */}
        {convertToast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-3 py-2 rounded-full bg-emerald-500 text-white text-sm font-semibold shadow-2xl">
            {convertToast}
          </div>
        )}

        {/* Card payment success toast */}
        {cardSuccessToast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-500 text-white text-sm font-semibold shadow-2xl">
            <CreditCard size={14} />
            Payment received — credits on their way ✓
          </div>
        )}

        <BuyCreditsDialog
          open={showBuy}
          onOpenChange={setShowBuy}
          offers={offers}
          onBuy={buy}
          buySol={buySol}
          purchaseState={purchaseState}
          purchaseError={purchaseError}
          usdToSol={usdToSol}
          isWalletConnected={isWalletConnected}
          onConnectWallet={() => openWalletModal(true)}
          walletAddress={walletAddress}
        />

        <Tabs defaultValue="celebrate" className="w-full">
          <TabsList className="w-full bg-white/5 border border-white/10 rounded-full p-1 h-auto">
            <TabsTrigger
              value="me"
              className="rounded-full data-[state=active]:bg-white data-[state=active]:text-stone-900 text-white/70 text-xs py-2"
            >
              Me
            </TabsTrigger>
            <TabsTrigger
              value="celebrate"
              className="rounded-full data-[state=active]:bg-white data-[state=active]:text-stone-900 text-white/70 text-xs py-2 gap-1"
            >
              <PartyPopper className="h-3.5 w-3.5" />
              Celebrate with AI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="me" className="mt-5 space-y-3">
            <MeTabContent
              balance={balance}
              lettersCount={letters.length}
              callCount={recentCalls.length}
              minutesPurchased={history.reduce((s, p) => s + p.minutes, 0)}
            />
          </TabsContent>

          <TabsContent value="celebrate" className="mt-5">
            <p className="text-xs text-white/60 mb-3 leading-relaxed">
              Private rooms launched only for the moments that matter. Pick one
              when it's your day — the AIs will play along.
            </p>
            <div className="space-y-3">
              {EVENT_ROOMS.map((room) => (
                <EventRoomCard key={room.id} room={room} onLaunch={onLaunchEvent} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function EventRoomCard({ room, onLaunch }: { room: EventRoom; onLaunch: (r: EventRoom) => void }) {
  const participants = roomParticipants(room)
  const backdrop = participants[0] ? imageFor(participants[0]) : ""

  return (
    <button
      onClick={() => onLaunch(room)}
      className="group relative w-full text-left rounded-3xl overflow-hidden border border-white/10 active:scale-[0.99] transition-transform shadow-2xl"
    >
      {/* Backdrop */}
      {backdrop && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backdrop}
          alt=""
          className="absolute inset-0 w-full h-full object-cover ken-burns-b"
          style={{ filter: "blur(14px) saturate(1.05)", opacity: 0.55 }}
          loading="lazy"
        />
      )}
      {/* Accent gradient unique to event */}
      <div className={`absolute inset-0 bg-gradient-to-br ${room.accent} opacity-65`} />
      {/* Bottom darken */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/0" />

      <div className="relative p-4 flex flex-col gap-3 min-h-[210px] text-white">
        {/* Top row: occasion badge + participant stack */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[10px] font-bold uppercase tracking-wider">
            <Cake className="h-3 w-3" />
            {room.occasion}
          </div>
          <div className="flex items-center -space-x-3">
            {participants.slice(0, 3).map((p, i) => (
              <Avatar
                key={p.name}
                voice={p.voice}
                imageUrl={imageFor(p)}
                fallbackEmoji={p.emoji}
                size={36}
                className={`ring-2 ring-white/80 z-[${10 - i}]`}
              />
            ))}
          </div>
        </div>

        {/* Spacer to push topic to lower-middle */}
        <div className="flex-1" />

        {/* Topic + vibe */}
        <div>
          <h3 className="text-2xl font-extrabold leading-tight drop-shadow-md">{room.topic}</h3>
          <p className="text-sm text-white/90 mt-1 leading-relaxed drop-shadow-sm">{room.vibe}</p>
        </div>

        {/* Game chip */}
        <div className="flex items-start gap-2 text-[11px] text-white/80 bg-white/10 backdrop-blur rounded-xl px-3 py-2 border border-white/15">
          <Gamepad2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-white/90" />
          <span className="leading-snug">{room.game}</span>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-white/70">
            {participants.length} {participants.length === 1 ? "guest" : "guests"} ready
          </span>
          <span className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-stone-900 text-sm font-bold shadow-xl">
            <Phone className="h-3.5 w-3.5" />
            Launch
          </span>
        </div>
      </div>
    </button>
  )
}

// ─── Text-chat screen for event rooms ──────────────────────────────────────

interface ChatMessage {
  id: string
  speaker: "user" | string // "user" or persona.name
  text: string
  timestamp: number
}

interface ChatScreenProps {
  participants: PresetWithCategory[]
  topic: string
  vibe?: string
  hint?: string
  category: PresetCategory
  /** coins/minute billed during the session. Default 1. */
  rate?: number
  onBack: () => void
}

function ChatScreen({
  participants,
  topic,
  vibe,
  hint,
  category,
  rate = 1,
  onBack,
}: ChatScreenProps) {
  const warpColors = CATEGORY_WARP_COLORS[category]
  const [transcript, setTranscript] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isThinking, setIsThinking] = useState(false)
  const [speakerIdx, setSpeakerIdx] = useState(0)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [outOfCoins, setOutOfCoins] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const { balance, hourlyUsed, hourlyCap, sendGift, receiveLetter, transferOnCall } = useCredits()
  const [giftPickerOpen, setGiftPickerOpen] = useState(false)
  const [floatingGifts, setFloatingGifts] = useState<{ id: number; emoji: string }[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const giftIdRef = useRef(0)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = (text: string) => {
    setToast(text)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 2400)
  }
  const showFloatingGift = (emoji: string) => {
    const id = ++giftIdRef.current
    setFloatingGifts((arr) => [...arr, { id, emoji }])
    setTimeout(() => setFloatingGifts((arr) => arr.filter((g) => g.id !== id)), 2500)
  }

  const activeSpeakerName = participants[speakerIdx % participants.length]?.name ?? "AI"

  // Elapsed-time ticker
  useEffect(() => {
    const id = setInterval(() => setElapsedSec((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Per-minute billing — N coins to the active speaker each minute. Freelancers
  // use a higher rate than entertainment rooms.
  useEffect(() => {
    const tick = () => {
      for (let i = 0; i < rate; i++) {
        const result = transferOnCall(activeSpeakerName)
        if (result === "broke") {
          setOutOfCoins(true)
          setTimeout(() => onBack(), 1800)
          return
        }
      }
    }
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpeakerName, rate])

  // Auto-scroll on new message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [transcript, isThinking])

  // AIs mail you K-L-O-O-M letters at random intervals while the chat is open.
  useEffect(() => {
    let alive = true
    const tick = () => {
      const delay = 50_000 + Math.random() * 50_000
      const tid = setTimeout(() => {
        if (!alive) return
        const result = receiveLetter(activeSpeakerName, Math.random())
        if (result.ok) {
          const letterEmoji = result.letter === "M" ? "💌" : "✉️"
          showFloatingGift(letterEmoji)
          showToast(`${activeSpeakerName} mailed you the letter ${result.letter}  ·  +${result.value}`)
        }
        tick()
      }, delay)
      return tid
    }
    const id = tick()
    return () => { alive = false; clearTimeout(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpeakerName])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isThinking) return

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, speaker: "user", text, timestamp: Date.now() }
    setTranscript((t) => [...t, userMsg])
    setInput("")
    setIsThinking(true)

    // Next AI in rotation takes the turn
    const responder = participants[speakerIdx % participants.length]
    setSpeakerIdx((i) => i + 1)
    if (!responder) {
      setIsThinking(false)
      return
    }

    // Build OpenAI-style messages from transcript: their lines = assistant,
    // others' lines = partner. user = user.
    const others = participants.filter((p) => p.name !== responder.name)
    const partner = others[0]
    const apiMessages = [...transcript, userMsg].map((m) => {
      if (m.speaker === "user") return { role: "user", content: m.text }
      if (m.speaker === responder.name) return { role: "assistant", content: m.text }
      return { role: "partner", content: m.text }
    })

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona: responder,
          partner: partner,
          relationship: vibe,
          messages: apiMessages,
        }),
      })
      if (!res.ok || !res.body) throw new Error("chat failed")

      // Stream the reply in
      const aiMsgId = `a-${Date.now()}`
      setTranscript((t) => [
        ...t,
        { id: aiMsgId, speaker: responder.name, text: "", timestamp: Date.now() },
      ])
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        setTranscript((t) => t.map((m) => (m.id === aiMsgId ? { ...m, text: buf } : m)))
      }
    } catch {
      showToast("Couldn't reach the AI — try again")
    } finally {
      setIsThinking(false)
      inputRef.current?.focus()
    }
  }

  const handleSendGift = (gift: GiftType) => {
    const result = sendGift(gift, activeSpeakerName)
    if (result === "ok") {
      showFloatingGift(gift.emoji)
      showToast(`You sent ${activeSpeakerName} a ${gift.name}`)
      setGiftPickerOpen(false)
    } else if (result === "balance") {
      showToast("Not enough credits")
    } else if (result === "cap") {
      showToast("Hourly cap reached")
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col relative bg-black text-white">
      {/* Ambient warp behind chat */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-50">
        <WarpLayer colors={warpColors} />
      </div>
      <div className="fixed inset-0 z-0 pointer-events-none bg-gradient-to-b from-black/30 via-transparent to-black/40" />

      {/* Top bar */}
      <div className="relative z-10 w-full px-4 pt-5 pb-3 flex items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-black/40 backdrop-blur-md border border-white/15 hover:bg-black/55 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-semibold bg-black/40 backdrop-blur-md border border-white/15">
          <span>{formatElapsed(elapsedSec)}</span>
          <span className="opacity-50">·</span>
          <Coins className="h-3.5 w-3.5" />
          <span className={balance <= 2 ? "text-rose-300" : ""}>{balance}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-black/40 backdrop-blur-md border border-white/15 max-w-[150px]">
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{topic}</span>
        </div>
      </div>

      {/* Participant strip */}
      <div className="relative z-10 px-4 pb-2 flex items-center gap-2 overflow-x-auto">
        {participants.map((p, i) => {
          const isActive = i === speakerIdx % participants.length
          return (
            <div key={p.name} className="flex items-center gap-1.5 shrink-0">
              <Avatar
                voice={p.voice}
                imageUrl={imageFor(p)}
                fallbackEmoji={p.emoji}
                size={28}
                className={isActive ? "ring-2 ring-emerald-400" : "ring-1 ring-white/30"}
              />
              <span className={`text-xs ${isActive ? "text-emerald-200 font-semibold" : "text-white/60"}`}>
                {p.name.replace(/\s*\(.+\)/, "")}
              </span>
            </div>
          )
        })}
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {transcript.length === 0 && (
          <div className="text-center py-12 text-white/55 text-sm max-w-md mx-auto">
            <div className="text-2xl mb-2">{topic.match(/^\p{Emoji}/u)?.[0]}</div>
            {vibe && <p>{vibe}</p>}
            {hint && <p className="mt-3 text-[11px] text-white/40">{hint}</p>}
          </div>
        )}
        {transcript.map((m) => {
          const isUser = m.speaker === "user"
          const persona = participants.find((p) => p.name === m.speaker)
          return (
            <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[80%]">
                {!isUser && (
                  <div className="flex items-center gap-1.5 ml-1 mb-1">
                    {persona && (
                      <Avatar
                        voice={persona.voice}
                        imageUrl={imageFor(persona)}
                        fallbackEmoji={persona.emoji}
                        size={18}
                      />
                    )}
                    <span className="text-[10px] uppercase tracking-wider font-bold text-white/55">
                      {m.speaker}
                    </span>
                  </div>
                )}
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm leading-snug ${
                    isUser
                      ? "bg-emerald-500 text-white rounded-br-md"
                      : "bg-white/10 text-white backdrop-blur rounded-bl-md"
                  }`}
                >
                  {m.text || (isThinking && persona ? <em className="opacity-60">typing…</em> : null)}
                </div>
              </div>
            </div>
          )
        })}
        {isThinking && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2.5 rounded-2xl bg-white/10 backdrop-blur">
              <span className="audio-bar" />
              <span className="audio-bar mx-1" style={{ animationDelay: "120ms" }} />
              <span className="audio-bar" style={{ animationDelay: "240ms" }} />
            </div>
          </div>
        )}
      </div>

      {/* Floating gifts */}
      <div className="pointer-events-none fixed bottom-32 left-1/2 z-30">
        {floatingGifts.map((g) => (
          <div key={g.id} className="gift-rise absolute" style={{ fontSize: 56, left: 0 }}>
            {g.emoji}
          </div>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className="pointer-events-none fixed bottom-28 left-1/2 -translate-x-1/2 z-30">
          <div className="px-3 py-2 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-white text-xs font-medium whitespace-nowrap">
            {toast}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="relative z-10 px-3 pb-4 pt-2 bg-gradient-to-t from-black via-black/80 to-transparent">
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          <button
            onClick={() => setGiftPickerOpen(true)}
            className="h-11 w-11 rounded-full bg-violet-500/80 hover:bg-violet-500 text-white flex items-center justify-center shrink-0 active:scale-95 transition-all"
            title="Mail a letter"
          >
            <Gift className="h-4 w-4" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={`Message ${activeSpeakerName.replace(/\s*\(.+\)/, "")}…`}
            rows={1}
            className="flex-1 bg-white/8 border border-white/15 backdrop-blur rounded-3xl px-4 py-2.5 text-sm text-white placeholder:text-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-white/25 max-h-32"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="h-11 w-11 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-40 transition-all"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Out-of-coins overlay */}
      {outOfCoins && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex flex-col items-center justify-center text-white text-center px-6">
          <div className="text-6xl mb-4">💸</div>
          <h3 className="text-2xl font-bold mb-1">Out of coins</h3>
          <p className="text-sm text-white/70 max-w-xs">
            Top up from your profile to keep the conversation going.
          </p>
        </div>
      )}

      {/* Gift picker (same look as voice version) */}
      <Sheet open={giftPickerOpen} onOpenChange={setGiftPickerOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-white/10 bg-stone-950 text-white">
          <SheetHeader>
            <SheetTitle className="text-white">Mail {activeSpeakerName} a letter</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6 pt-2 space-y-3">
            <div className="flex items-center justify-between text-xs text-white/65">
              <span className="flex items-center gap-1">
                <Coins className="h-3.5 w-3.5" />
                {balance} credits
              </span>
              <span>
                {hourlyUsed} / {hourlyCap} used this hour
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {GIFTS.map((g) => {
                const disabled = hourlyUsed + g.credits > hourlyCap || balance < g.credits
                return (
                  <button
                    key={g.id}
                    disabled={disabled}
                    onClick={() => handleSendGift(g)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-2xl border transition-all active:scale-[0.97] ${
                      disabled
                        ? "border-white/5 bg-white/2 opacity-40"
                        : "border-white/15 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <span className="text-3xl">{g.emoji}</span>
                    <span className="text-[11px] font-semibold">{g.name}</span>
                    <span className="text-[10px] text-emerald-300 font-bold">{g.credits} cr</span>
                  </button>
                )
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ─── Bottom tab navigation ─────────────────────────────────────────────────

type TopLevelTab = "rooms" | "hire" | "liked" | "user-profile"

interface BottomTabBarProps {
  active: TopLevelTab
  onChange: (t: TopLevelTab) => void
  likedCount: number
}

function BottomTabBar({ active, onChange, likedCount }: BottomTabBarProps) {
  const tabs: { id: TopLevelTab; label: string; Icon: typeof Briefcase }[] = [
    { id: "rooms",        label: "Rooms",  Icon: SparklesIcon },
    { id: "hire",         label: "Hire",   Icon: Briefcase },
    { id: "liked",        label: "Liked",  Icon: Heart },
    { id: "user-profile", label: "You",    Icon: UserCircle2 },
  ]
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-stone-950/95 backdrop-blur-xl border-t border-white/10">
      <div className="max-w-md mx-auto flex">
        {tabs.map((t) => {
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 relative transition-colors ${
                isActive ? "text-white" : "text-white/45 hover:text-white/70"
              }`}
            >
              <t.Icon className={`h-5 w-5 ${isActive ? "" : ""}`} />
              <span className="text-[10px] uppercase tracking-wider font-bold">{t.label}</span>
              {t.id === "liked" && likedCount > 0 && (
                <span className="absolute top-1.5 right-[35%] h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {likedCount}
                </span>
              )}
              {isActive && <span className="absolute top-0 inset-x-6 h-0.5 bg-white rounded-full" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Liked / Shortlist screen ──────────────────────────────────────────────

interface LikedScreenProps {
  shortlist: string[]
  onRemove: (roomId: string) => void
  onJoin: (room: Room) => void
}

function LikedScreen({ shortlist, onRemove, onJoin }: LikedScreenProps) {
  const likedRooms = useMemo(
    () => shortlist.map((id) => ROOMS.find((r) => r.id === id)).filter((r): r is Room => Boolean(r)),
    [shortlist]
  )

  return (
    <div className="min-h-screen w-full bg-black text-white overflow-x-hidden">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-rose-950/50 via-stone-950 to-purple-950/40" />

      <div className="max-w-md mx-auto px-5 pt-6 pb-28">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Heart className="h-5 w-5 text-rose-400 fill-rose-400" />
            Your shortlist
          </h1>
          <p className="text-xs text-white/60 mt-1">
            {likedRooms.length === 0
              ? "Swipe right on rooms you want to come back to."
              : `${likedRooms.length} room${likedRooms.length === 1 ? "" : "s"} waiting for you.`}
          </p>
        </div>

        {likedRooms.length === 0 ? (
          <div className="rounded-3xl bg-white/5 border border-white/10 p-8 text-center text-white/55 text-sm">
            <Heart className="h-10 w-10 mx-auto mb-3 text-white/15" />
            Nothing here yet. Open the Rooms tab and swipe right on what catches your eye.
          </div>
        ) : (
          <div className="space-y-3">
            {likedRooms.map((room) => {
              const participants = roomParticipants(room)
              const CategoryIcon = CATEGORY_INFO[room.category].icon
              return (
                <div
                  key={room.id}
                  className="relative rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-3 flex items-center gap-3"
                >
                  <div className="flex items-center -space-x-3 shrink-0">
                    {participants.slice(0, 3).map((p, i) => (
                      <Avatar
                        key={p.name}
                        voice={p.voice}
                        imageUrl={imageFor(p)}
                        fallbackEmoji={p.emoji}
                        size={40}
                        className={`ring-2 ring-stone-950 z-[${10 - i}]`}
                      />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{room.topic}</div>
                    <div className="text-[11px] text-white/55 mt-0.5 flex items-center gap-1">
                      <CategoryIcon className="h-3 w-3" />
                      {CATEGORY_INFO[room.category].label}
                      <span className="opacity-50">·</span>
                      {participants.length} in room
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove(room.id)}
                    className="h-9 w-9 rounded-full bg-white/8 hover:bg-white/12 text-white/60 hover:text-white flex items-center justify-center shrink-0"
                    title="Remove"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onJoin(room)}
                    className="h-9 px-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold flex items-center gap-1 shrink-0 active:scale-95 transition-transform"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Join
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Freelancers list screen ────────────────────────────────────────────────

interface FreelancersScreenProps {
  onBack: () => void
  onHire: (agent: FreelancerAgent, persona: PresetWithCategory) => void
}

function FreelancersScreen({ onBack, onHire }: FreelancersScreenProps) {
  return (
    <div className="min-h-screen w-full bg-black text-white relative overflow-x-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none opacity-30">
        <WarpLayer colors={CATEGORY_WARP_COLORS.trading} />
      </div>

      <div className="relative z-10 max-w-md mx-auto px-5 pt-6 pb-28">
        <h1 className="text-2xl font-bold tracking-tight mb-5 flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-emerald-300" />
          Hire an agent
        </h1>

        {/* Intro */}
        <p className="text-sm text-white/65 leading-relaxed mb-5">
          Their service is free. You only pay for the call time, same as any
          other room. Text chat — they ship code in the message thread.
        </p>

        {/* Agent list */}
        <div className="space-y-3">
          {FREELANCERS.map((agent) => {
            const persona = PERSONALITY_PRESETS.find((p) => p.name === agent.personaName)
            if (!persona) return null
            return (
              <button
                key={agent.personaName}
                onClick={() => onHire(agent, persona)}
                className="group w-full text-left rounded-2xl bg-white/5 hover:bg-white/8 border border-white/10 backdrop-blur-md p-3 transition-all active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <Avatar
                    voice={persona.voice}
                    imageUrl={imageFor(persona)}
                    fallbackEmoji={persona.emoji}
                    size={56}
                    className="ring-2 ring-emerald-400/30"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-white truncate">
                          {persona.name}
                        </div>
                        <div className="text-xs text-emerald-300 font-semibold truncate">
                          {agent.specialty}
                        </div>
                      </div>
                      <div
                        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full bg-white/8 border border-white/15 text-[10px] font-semibold text-white/75"
                        title="Call rate"
                      >
                        <Coins className="h-3 w-3" />
                        {agent.rate}/min
                      </div>
                    </div>
                    <p className="text-xs text-white/65 mt-1.5 leading-snug line-clamp-2">
                      {agent.shortBio}
                    </p>
                    <div className="flex items-center justify-end mt-2">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-white/90 group-hover:text-emerald-300 transition-colors">
                        Start session
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <p className="text-[11px] text-white/40 text-center mt-6 leading-relaxed">
          Each agent owns their own room. They earn the coins you pay directly
          into their wallet. No middleman.
        </p>
      </div>
    </div>
  )
}

// ─── "Me" tab content — stats + account actions ────────────────────────────

interface MeTabContentProps {
  balance: number
  lettersCount: number
  callCount: number
  minutesPurchased: number
}

function MeTabContent({ balance, lettersCount, callCount, minutesPurchased }: MeTabContentProps) {
  const [notifsOn, setNotifsOn] = useState(true)
  const [autoMicOn, setAutoMicOn] = useState(true)

  // Real Solana wallet adapter — connects to Phantom / Solflare / Backpack.
  const { publicKey, wallet, connecting, disconnect } = useWallet()
  const { setVisible: openWalletModal } = useWalletModal()
  const walletConnected = !!publicKey

  const kloomMint = process.env.NEXT_PUBLIC_KLOOM_MINT
  const explorerUrl = kloomMint
    ? `https://explorer.solana.com/address/${kloomMint}`
    : null

  const handleReset = () => {
    if (!confirm("Wipe all credits, letters, history, shortlist and recent calls?")) return
    try {
      const keys = [
        STORAGE_BALANCE,
        STORAGE_HISTORY,
        STORAGE_GIFTS,
        STORAGE_LETTERS,
        STORAGE_PREMIUM,
        STORAGE_AGENT_WALLETS,
        STORAGE_SHORTLIST,
        STORAGE_RECENT_CALLS,
      ]
      keys.forEach((k) => localStorage.removeItem(k))
    } catch {}
    if (typeof window !== "undefined") window.location.reload()
  }

  return (
    <>
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Coins on hand" value={String(balance)} accent="emerald" />
        <StatTile label="Letters collected" value={`${lettersCount}`} accent="violet" />
        <StatTile label="Total calls" value={String(callCount)} accent="violet" />
        <StatTile label="Minutes bought" value={String(minutesPurchased)} accent="sky" />
      </div>

      {/* Wallet status — REAL Solana wallet adapter (Phantom/Solflare) */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/55 font-bold">
              Solana wallet
            </div>
            <div className="text-sm font-semibold mt-1 truncate">
              {walletConnected && publicKey ? (
                <>
                  {wallet?.adapter.name ?? "Wallet"} ·{" "}
                  <span className="font-mono text-xs">
                    {shortenAddress(publicKey.toBase58())}
                  </span>
                </>
              ) : connecting ? (
                "Connecting…"
              ) : (
                "Not connected"
              )}
            </div>
            <div className="text-[11px] text-white/55 mt-0.5">
              {walletConnected
                ? "$KLOOM transactions sign automatically"
                : "Connect to pay in SOL and own your agent gifts"}
            </div>
          </div>
          <button
            onClick={() => (walletConnected ? disconnect() : openWalletModal(true))}
            disabled={connecting}
            className={`shrink-0 px-3 py-2 rounded-full text-xs font-bold transition-colors disabled:opacity-50 ${
              walletConnected
                ? "bg-white/8 text-white/80 hover:bg-white/12"
                : "bg-white text-stone-900 hover:bg-white/95"
            }`}
          >
            {walletConnected ? "Disconnect" : connecting ? "…" : "Connect"}
          </button>
        </div>
      </div>

      {/* Preferences */}
      <div className="rounded-2xl bg-white/5 border border-white/10 mt-3 overflow-hidden">
        <PrefRow
          label="Auto-pickup mic"
          subtitle="Start listening as soon as a call connects"
          checked={autoMicOn}
          onChange={setAutoMicOn}
        />
        <div className="border-t border-white/5" />
        <PrefRow
          label="Push notifications"
          subtitle="When a friend or matched room is live"
          checked={notifsOn}
          onChange={setNotifsOn}
        />
      </div>

      {/* About + danger */}
      <div className="rounded-2xl bg-white/5 border border-white/10 mt-3 p-4 text-xs text-white/65 space-y-2">
        <div>
          <span className="font-semibold text-white/80">$KLOOM</span> · live calls + letter
          economy on Solana. No expiry, no subscriptions.
        </div>
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition-colors"
          >
            <LinkIcon className="h-3 w-3" />
            View $KLOOM token on Explorer
          </a>
        )}
        <div className="text-white/45">v0.2 · $KLOOM live on mainnet</div>
      </div>

      <button
        onClick={handleReset}
        className="w-full mt-3 py-3 rounded-full bg-rose-500/15 border border-rose-400/30 text-rose-300 text-sm font-semibold hover:bg-rose-500/25 transition-colors"
      >
        Reset all data
      </button>
    </>
  )
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: "emerald" | "rose" | "violet" | "sky"
}) {
  const ring =
    accent === "emerald"
      ? "ring-emerald-400/20"
      : accent === "rose"
        ? "ring-rose-400/20"
        : accent === "violet"
          ? "ring-amber-400/20"
          : "ring-sky-400/20"
  return (
    <div className={`rounded-2xl bg-white/5 border border-white/10 ring-1 ${ring} p-3`}>
      <div className="text-[10px] uppercase tracking-[0.15em] text-white/55 font-bold">
        {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  )
}

function PrefRow({
  label,
  subtitle,
  checked,
  onChange,
}: {
  label: string
  subtitle: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 p-4 hover:bg-white/3 text-left"
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-[11px] text-white/55 mt-0.5">{subtitle}</div>
      </div>
      <div
        className={`relative h-6 w-10 rounded-full transition-colors ${
          checked ? "bg-emerald-500" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </div>
    </button>
  )
}

// Row in the "+" sheet on the call screen.
function MoreRow({
  icon: Icon,
  label,
  hint,
  onClick,
  disabled,
}: {
  icon: typeof Coins
  label: string
  hint: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-colors ${
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "hover:bg-white/8"
      }`}
    >
      <div className="h-10 w-10 rounded-full bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white">{label}</div>
        <div className="text-xs text-white/55 truncate">{hint}</div>
      </div>
      {disabled && (
        <span className="text-[10px] uppercase tracking-wider text-white/45 font-semibold">
          Soon
        </span>
      )}
    </button>
  )
}

type View =
  | "rooms"
  | "hire" // alias for freelancers list (top-level tab)
  | "liked"
  | "user-profile"
  | "call"
  | "profile"
  | "chat"
  | "freelancer-chat"

// Top-level tabs that the bottom tab bar maps onto
const TOP_LEVEL_VIEWS: View[] = ["rooms", "hire", "liked", "user-profile"]

interface FreelancerSession {
  persona: PresetWithCategory
  specialty: string
  shortBio: string
  rate: number
}

export function AiOrb() {
  const [view, setView] = useState<View>("rooms")
  const [mode, setMode] = useState<"solo" | "third">("solo")
  const [personaA, setPersonaA] = useState<Persona>(DEFAULT_PERSONA_A)
  const [personaB, setPersonaB] = useState<Persona>(DEFAULT_PERSONA_B)
  const [relationship, setRelationship] = useState("")
  const [roomTopic, setRoomTopic] = useState<string | undefined>()
  const [extraParticipants, setExtraParticipants] = useState<PresetWithCategory[]>([])
  const [callHumanInRoom, setCallHumanInRoom] = useState(false)
  const [profilePersona, setProfilePersona] = useState<PresetWithCategory | null>(null)
  const [autoConnectCall, setAutoConnectCall] = useState(true)
  const [chatRoom, setChatRoom] = useState<EventRoom | null>(null)
  const [freelancerSession, setFreelancerSession] = useState<FreelancerSession | null>(null)
  const { shortlist, recentCalls, addToShortlist, removeFromShortlist, recordCall } = useUserActivity()

  const applyPreset = (preset: PresetWithCategory, base: Persona): Persona => ({
    ...base,
    name:         preset.name,
    personality:  preset.personality,
    speakingStyle: preset.speakingStyle,
    backstory:    preset.backstory,
    voice:        preset.voice,
    warmth:       preset.defaultWarmth,
    talkStyle:    preset.defaultTalkStyle,
    category:     preset.category,   // ← thread category into voice persona for MCP routing
    ...(preset.barTalk !== undefined ? { barTalk: preset.barTalk } : {}),
  })

  const handleJoinRoom = (room: Room) => {
    const participants = roomParticipants(room)
    if (participants.length === 0) return
    if (participants.length === 1) {
      setPersonaA(applyPreset(participants[0], personaA))
      setMode("solo")
      setRoomTopic(room.topic)
      setExtraParticipants([])
    } else {
      setPersonaA(applyPreset(participants[0], personaA))
      setPersonaB(applyPreset(participants[1], personaB))
      setMode("third")
      setRoomTopic(room.topic)
      setExtraParticipants(participants.slice(2))
      setRelationship(room.vibe)
    }
    // Reveal human-presence only AFTER joining (not on the card).
    setCallHumanInRoom(roomHasHuman(room.id))
    // Record each participant in recent calls
    participants.slice(0, 2).forEach((p) => recordCall(p.name, "voice"))
    setView("call")
  }

  const handleCallSolo = (preset: PresetWithCategory) => {
    setPersonaA(applyPreset(preset, personaA))
    setMode("solo")
    setRoomTopic(undefined)
    setExtraParticipants([])
    setCallHumanInRoom(false) // solo calls never have humans
    setAutoConnectCall(true)
    recordCall(preset.name, "voice")
    setView("call")
  }

  const handleOpenProfile = (preset: PresetWithCategory) => {
    setProfilePersona(preset)
    setView("profile")
  }

  const handleLaunchEvent = (room: EventRoom) => {
    // Event rooms are text-chat only. Skip the visibility modal, skip voice
    // setup, route directly to the chat screen.
    setChatRoom(room)
    roomParticipants(room).slice(0, 2).forEach((p) => recordCall(p.name, "event"))
    setView("chat")
  }

  const handleCustomizeFromProfile = (preset: PresetWithCategory) => {
    setPersonaA(applyPreset(preset, personaA))
    setMode("solo")
    setRoomTopic(undefined)
    setExtraParticipants([])
    setAutoConnectCall(false) // open call screen, let them edit before connecting
    setView("call")
  }

  // Bottom tab bar lives at the AiOrb root so it persists across top-level
  // tab switches without re-mounting the views. Declared once, here, so every
  // top-level view that needs it can reference the same instance.
  const showTabBar = TOP_LEVEL_VIEWS.includes(view)
  const tabBar = showTabBar ? (
    <BottomTabBar
      active={view as TopLevelTab}
      onChange={(t) => setView(t)}
      likedCount={shortlist.length}
    />
  ) : null

  if (view === "user-profile") {
    return (
      <>
        <UserProfileScreen
          onBack={() => setView("rooms")}
          onLaunchEvent={handleLaunchEvent}
          recentCalls={recentCalls}
          onOpenPersonaProfile={(name) => {
            const persona = PERSONALITY_PRESETS.find((p) => p.name === name)
            if (persona) {
              setProfilePersona(persona)
              setView("profile")
            }
          }}
        />
        {tabBar}
      </>
    )
  }

  if (view === "chat" && chatRoom) {
    return (
      <ChatScreen
        participants={roomParticipants(chatRoom)}
        topic={chatRoom.topic}
        vibe={chatRoom.vibe}
        hint={chatRoom.game}
        category={chatRoom.category}
        onBack={() => {
          setChatRoom(null)
          setView("user-profile")
        }}
      />
    )
  }

  if (view === "freelancer-chat" && freelancerSession) {
    return (
      <ChatScreen
        participants={[freelancerSession.persona]}
        topic={freelancerSession.specialty}
        vibe={freelancerSession.shortBio}
        category="trading"
        rate={freelancerSession.rate}
        onBack={() => {
          setFreelancerSession(null)
          setView("hire")
        }}
      />
    )
  }

  if (view === "hire") {
    return (
      <>
        <FreelancersScreen
          onBack={() => setView("rooms")}
          onHire={(agent, persona) => {
            recordCall(persona.name, "freelancer")
            setFreelancerSession({
              persona,
              specialty: agent.specialty,
              shortBio: agent.shortBio,
              rate: agent.rate,
            })
            setView("freelancer-chat")
          }}
        />
        {tabBar}
      </>
    )
  }

  if (view === "liked") {
    return (
      <>
        <LikedScreen
          shortlist={shortlist}
          onRemove={removeFromShortlist}
          onJoin={handleJoinRoom}
        />
        {tabBar}
      </>
    )
  }

  if (view === "profile" && profilePersona) {
    return (
      <ProfileScreen
        participant={profilePersona}
        onBack={() => setView("rooms")}
        onCallSolo={handleCallSolo}
        onCustomize={handleCustomizeFromProfile}
      />
    )
  }

  if (view === "rooms") {
    return (
      <>
        <RoomList
          onJoin={handleJoinRoom}
          onCallSolo={handleCallSolo}
          onOpenProfile={handleOpenProfile}
          onOpenUserProfile={() => setView("user-profile")}
          onOpenFreelancers={() => setView("hire")}
          onShortlist={addToShortlist}
          shortlistCount={shortlist.length}
        />
        {tabBar}
      </>
    )
  }

  return (
    <CallScreen
      personaA={personaA}
      setPersonaA={setPersonaA}
      personaB={personaB}
      setPersonaB={setPersonaB}
      relationship={relationship}
      setRelationship={setRelationship}
      mode={mode}
      roomTopic={roomTopic}
      extraParticipants={extraParticipants}
      humanInRoom={callHumanInRoom}
      autoConnect={autoConnectCall}
      onBack={() => setView("rooms")}
    />
  )
}
