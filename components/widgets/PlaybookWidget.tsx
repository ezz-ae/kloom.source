"use client"

import { useState } from "react"
import { Check, ChevronDown, ChevronUp, BookOpen, Zap } from "lucide-react"

interface PlaybookStep {
  id: string
  title: string
  description: string
  action?: string
}

interface Playbook {
  name: string
  description: string
  category: string
  steps: PlaybookStep[]
}

const PLAYBOOKS: Record<string, Playbook> = {
  "token-launch": {
    name: "Token Launch Playbook",
    description: "30-step checklist from idea to listed token on Solana",
    category: "trading",
    steps: [
      { id: "1", title: "Define tokenomics",           description: "Total supply, allocation, vesting, unlock schedule",           action: "Use ora_calculate for exact numbers" },
      { id: "2", title: "Audit smart contract",        description: "Run security audit before deployment",                        action: "Use ora_analyze_code on your contract" },
      { id: "3", title: "Create mint authority",       description: "Generate treasury wallet and set as mint authority",           action: "Use the Wallet Creator widget" },
      { id: "4", title: "Deploy on devnet",            description: "Test all functions on Solana devnet first",                    action: "Use pnpm bloom:create (devnet flag)" },
      { id: "5", title: "LP strategy",                 description: "Set initial liquidity amount and lock period",                 action: "Viktor can help size this" },
      { id: "6", title: "Anti-bot measures",           description: "Add launch delay, max buy limits, blocklist",                  action: "Review with Kaia" },
      { id: "7", title: "Marketing pre-launch",        description: "Twitter/X thread, community seeding, KOL outreach",           action: "Zara handles the content" },
      { id: "8", title: "Fair launch",                 description: "Deploy, add LP, renounce/lock mint authority, announce",       action: "Execute on mainnet" },
    ],
  },
  "instagram-growth": {
    name: "Instagram Growth Playbook",
    description: "0 to 10K followers in 90 days — the exact system",
    category: "creator",
    steps: [
      { id: "1", title: "Audit and niche down",        description: "Pick ONE niche. Bio updated. Profile photo professional.",     action: "Use Bio Optimizer" },
      { id: "2", title: "Content pillars (3-5)",       description: "Define what you post about. No more, no less.",               action: "Use Content Ideas tool" },
      { id: "3", title: "3x daily for 2 weeks",        description: "Stories + 1 feed post. Build consistency signal.",            action: "Use Content Calendar" },
      { id: "4", title: "Engage before posting",       description: "30 min real engagement with target audience before each post", action: "Manual — no shortcuts here" },
      { id: "5", title: "Reel every 3 days",           description: "Reels are the algorithm lever. Non-negotiable.",              action: "Use Reel Hook Writer" },
      { id: "6", title: "Hashtag rotation",            description: "3 sets of 30 tags, rotate. Never repeat back-to-back.",       action: "Use Hashtag Generator" },
      { id: "7", title: "Collab with 3 peers/week",    description: "Stories mentions, collabs, reposts. Network compounding.",    action: "DM outreach script available" },
      { id: "8", title: "Review analytics weekly",     description: "Kill what doesn't convert. Double what does.",                action: "DexScreener → Creator tools" },
    ],
  },
  "trading-strategy": {
    name: "Trading Strategy Playbook",
    description: "Viktor's systematic approach to any market",
    category: "trading",
    steps: [
      { id: "1", title: "Market regime check",         description: "Is this a trending or ranging market? Never fight the regime",  action: "Use ora_analyze_market" },
      { id: "2", title: "Identify key levels",         description: "Support, resistance, previous highs/lows, liquidity zones",    action: "Check DexScreener chart" },
      { id: "3", title: "Entry criteria",              description: "Define: what has to be true for you to enter? Write it down.",  action: "No rule = no entry" },
      { id: "4", title: "Position sizing",             description: "Risk X% of portfolio. Never more. Calculate size.",            action: "Use ora_calculate: (portfolio × risk%) ÷ (entry − stop)" },
      { id: "5", title: "Set stop loss FIRST",         description: "Stop loss before entry. Always. Non-negotiable.",              action: "At structural level, not random %" },
      { id: "6", title: "R:R minimum 2:1",             description: "If you can't get 2:1, skip the trade.",                       action: "Use ora_calculate to verify" },
      { id: "7", title: "Execute and walk away",       description: "Alerts set. Stop set. No staring at charts.",                  action: "Trust the system" },
      { id: "8", title: "Post-trade review",           description: "Log the trade. What worked. What didn't. Improve.",           action: "Strategy book entry" },
    ],
  },
  "onlyfans-launch": {
    name: "OnlyFans Launch Playbook",
    description: "First 100 subscribers in 30 days",
    category: "creator",
    steps: [
      { id: "1", title: "Profile optimization",        description: "Professional photos, compelling bio, clear price",             action: "Use Bio Optimizer + Welcome Message tool" },
      { id: "2", title: "Content bank (30 pieces)",    description: "Have 30 pieces of content BEFORE launching. No exceptions.",  action: "Use Content Ideas to plan" },
      { id: "3", title: "Free trial offer",            description: "First 7 days free. Build social proof.",                      action: "Set in OF settings" },
      { id: "4", title: "Reddit launch thread",        description: "Post to relevant subreddits with teaser content",             action: "Use Caption Writer for captions" },
      { id: "5", title: "Twitter/X cross-post",        description: "Post daily teaser content to X, link in bio",                 action: "Use Instagram Caption tool for X too" },
      { id: "6", title: "Personal DMs to first subs",  description: "Manual welcome + personal message to every new subscriber",   action: "Use DM Writer" },
      { id: "7", title: "First PPV at day 7",          description: "Release first PPV content. Price at $10-15.",                 action: "Use PPV Caption tool" },
      { id: "8", title: "Re-engage expired trials",    description: "Day 8: discount offer to everyone who didn't subscribe",      action: "Use Re-engagement tool" },
    ],
  },
}

const DEFAULT_PLAYBOOK: Playbook = {
  name: "Custom Playbook",
  description: "A step-by-step plan",
  category: "general",
  steps: [{ id: "1", title: "Step 1", description: "Describe the first action", action: "" }],
}

interface PlaybookWidgetProps {
  playbookName?: string
}

export function PlaybookWidget({ playbookName }: PlaybookWidgetProps) {
  const pb = (playbookName && PLAYBOOKS[playbookName]) || DEFAULT_PLAYBOOK
  const [done, setDone]         = useState(new Set<string>())
  const [expanded, setExpanded] = useState(new Set<string>())

  const toggle = (id: string) => {
    setDone((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const progress = Math.round((done.size / pb.steps.length) * 100)

  return (
    <div className="rounded-2xl border border-white/10 bg-stone-900 overflow-hidden my-1">
      <div className="px-4 py-3 border-b border-white/8 bg-white/5">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen size={14} className="text-amber-400" />
          <span className="font-bold text-sm">{pb.name}</span>
          <span className="ml-auto text-xs text-white/40">{done.size}/{pb.steps.length}</span>
        </div>
        <p className="text-[11px] text-white/40">{pb.description}</p>
        {/* Progress bar */}
        <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="divide-y divide-white/5">
        {pb.steps.map((step, i) => (
          <div key={step.id} className={`${done.has(step.id) ? "opacity-50" : ""}`}>
            <div className="flex items-start gap-3 px-4 py-3">
              <button
                onClick={() => toggle(step.id)}
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  done.has(step.id) ? "bg-emerald-500 border-emerald-500" : "border-white/20 hover:border-amber-400"
                }`}
              >
                {done.has(step.id) && <Check size={10} className="text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/25 font-mono">{String(i+1).padStart(2,"0")}</span>
                  <span className={`text-sm font-semibold ${done.has(step.id) ? "line-through text-white/30" : ""}`}>{step.title}</span>
                  <button onClick={() => toggleExpand(step.id)} className="ml-auto text-white/30 hover:text-white/60">
                    {expanded.has(step.id) ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
                {expanded.has(step.id) && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-xs text-white/50 leading-relaxed">{step.description}</p>
                    {step.action && (
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
                        <Zap size={10} />
                        <span>{step.action}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Available playbooks */}
      <div className="px-4 py-3 border-t border-white/8 bg-white/3 flex flex-wrap gap-2">
        <span className="text-[10px] text-white/25 self-center">Other playbooks:</span>
        {Object.entries(PLAYBOOKS).map(([key, val]) => (
          <button key={key}
            className="text-[10px] text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full transition-colors">
            {val.name.replace(" Playbook", "")}
          </button>
        ))}
      </div>
    </div>
  )
}
