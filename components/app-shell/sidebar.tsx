"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import {
  Compass,
  MessageSquare,
  Mic,
  Sparkles,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  Wallet,
  Instagram,
  Flame,
  Calendar,
  FileText,
  Zap,
  LogOut,
  Users,
  GraduationCap,
  Palette,
  Heart,
  Brain,
  Briefcase,
  Moon,
  Star,
  Crown,
  TrendingUp,
  Code2,
  Music,
  BookOpen,
  Globe,
  BarChart3,
  Film,
  Mic2,
} from "lucide-react"
import { useSolCredits } from "@/hooks/use-sol-credits"
import { ModelSelector } from "@/components/model-selector"

// KLOOM Logo Component
function KloomLogo() {
  return (
    <Link href="/app/discover" className="flex items-center gap-2.5 px-2 mb-7 group">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <span className="font-black text-lg tracking-tight text-white">KLOOM</span>
      <span className="text-[9px] font-bold bg-purple-500/20 border border-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded-full ml-auto">
        AI
      </span>
    </Link>
  )
}

const NAV = [
  {
    label: "Discover",
    href: "/app/discover",
    icon: Compass,
    description: "Browse all AI experts and rooms",
  },
  {
    label: "Rooms",
    href: "/app/rooms",
    icon: Users,
    badge: "Multi-AI",
    badgeColor: "bg-purple-600",
    description: "Collaborative spaces with multiple AI models",
  },
  {
    label: "Create Room",
    href: "/app/create",
    icon: Plus,
    description: "Build your own multi-AI room",
  },
  {
    label: "Experts",
    href: "/app/experts",
    icon: GraduationCap,
    badge: "100+",
    badgeColor: "bg-cyan-500",
    description: "Specialized AI personas for every need",
    children: [
      { label: "Business & Finance", href: "/app/experts?cat=business", icon: Briefcase, tags: ["Trading", "Startups", "Investing"] },
      { label: "Creative & Arts", href: "/app/experts?cat=creative", icon: Palette, tags: ["Writing", "Design", "Music"] },
      { label: "Technology & Code", href: "/app/experts?cat=tech", icon: Code2, tags: ["Programming", "AI", "Web3"] },
      { label: "Health & Wellness", href: "/app/experts?cat=wellness", icon: Heart, tags: ["Fitness", "Nutrition", "Mental"] },
      { label: "Lifestyle & Social", href: "/app/experts?cat=lifestyle", icon: Star, tags: ["Dating", "Fashion", "Travel"] },
      { label: "Learning & Growth", href: "/app/experts?cat=learning", icon: BookOpen, tags: ["Languages", "Skills", "Career"] },
      { label: "Entertainment", href: "/app/experts?cat=entertainment", icon: Film, tags: ["Games", "Movies", "Music"] },
      { label: "Spiritual & Future", href: "/app/experts?cat=spiritual", icon: Moon, tags: ["Tarot", "Astrology", "Advice"] },
    ],
  },
  {
    label: "Chat",
    href: "/app/chat",
    icon: MessageSquare,
    description: "1-on-1 conversations with AI",
  },
  {
    label: "Voice Rooms",
    href: "/app/voice",
    icon: Mic2,
    badge: "Live",
    badgeColor: "bg-emerald-500",
    description: "Real-time voice conversations",
  },
  {
    label: "Creator Studio",
    href: "/app/creator",
    icon: Sparkles,
    badge: "Pro",
    badgeColor: "bg-amber-500",
    description: "Tools for content creators",
    children: [
      { label: "Social Media", href: "/app/creator?tab=social", icon: Instagram, tags: ["Instagram", "TikTok", "YouTube"] },
      { label: "Content Tools", href: "/app/creator?tab=content", icon: FileText, tags: ["Captions", "Hashtags", "Scripts"] },
      { label: "Analytics", href: "/app/creator?tab=analytics", icon: BarChart3, tags: ["Insights", "Growth", "Metrics"] },
      { label: "Scheduling", href: "/app/creator?tab=calendar", icon: Calendar, tags: ["Planner", "Reminders"] },
    ],
  },
  {
    label: "Trading Hub",
    href: "/app/trading",
    icon: TrendingUp,
    badge: "Live Data",
    badgeColor: "bg-green-500",
    description: "Real-time market analysis and trading",
    children: [
      { label: "Crypto", href: "/app/trading?market=crypto", icon: Globe, tags: ["Bitcoin", "Altcoins", "DeFi"] },
      { label: "Stocks", href: "/app/trading?market=stocks", icon: BarChart3, tags: ["Equities", "ETFs", "Indices"] },
      { label: "Forex", href: "/app/trading?market=forex", icon: Zap, tags: ["Currencies", "Pairs", "Rates"] },
    ],
  },
]

function shortenAddress(addr: string) {
  return addr.slice(0, 4) + "…" + addr.slice(-4)
}

export function Sidebar() {
  const pathname = usePathname()
  const [openMenus, setOpenMenus] = useState<Set<string>>(
    new Set([
      ...(pathname.startsWith("/app/creator") ? ["Creator Studio"] : []),
      ...(pathname.startsWith("/app/experts") ? ["Experts"] : []),
      ...(pathname.startsWith("/app/trading") ? ["Trading Hub"] : []),
    ])
  )
  const toggleMenu = (label: string) =>
    setOpenMenus((s) => { const n = new Set(s); n.has(label) ? n.delete(label) : n.add(label); return n })
  const { balance, isWalletConnected } = useSolCredits()
  const { publicKey, disconnect } = useWallet()
  const { setVisible: openWalletModal } = useWalletModal()

  return (
    <aside className="flex flex-col h-full w-60 bg-stone-950 border-r border-stone-800 py-5 px-3 shrink-0">
      {/* Logo */}
      <KloomLogo />

      {/* Model Selector - Quick access */}
      <div className="px-3 mb-4">
        <ModelSelector showCost={false} size="sm" />
      </div>

      {/* Main nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/app" && pathname.startsWith(item.href.split("?")[0]))
          const hasChildren = !!item.children

          return (
            <div key={item.href}>
              {hasChildren ? (
                <button
                  onClick={() => toggleMenu(item.label)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-stone-800/50 ${
                    isActive
                      ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      : "text-white/60"
                  }`}
                  title={item.description}
                >
                  <item.icon size={16} className="shrink-0 text-purple-400" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {openMenus.has(item.label) ? (
                    <ChevronDown size={13} className="text-white/40" />
                  ) : (
                    <ChevronRight size={13} className="text-white/40" />
                  )}
                </button>
              ) : (
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-stone-800/50 ${
                    isActive
                      ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      : "text-white/60"
                  }`}
                  title={item.description}
                >
                  <item.icon size={16} className="shrink-0 text-purple-400" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              )}

              {/* Sub-items */}
              {hasChildren && openMenus.has(item.label) && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-stone-700 pl-3">
                  {item.children!.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-all hover:bg-stone-800/50 ${
                        pathname === child.href
                          ? "text-cyan-400 bg-cyan-500/5"
                          : "text-white/40"
                      }`}
                    >
                      <child.icon size={13} className="shrink-0 text-cyan-400" />
                      <span className="flex-1">{child.label}</span>
                      <span className="text-[10px] text-stone-500 hidden group-hover:block">
                        {child.tags?.join(", ")}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-4 space-y-2 border-t border-stone-800 pt-4">
        {/* Credits */}
        <div className="flex items-center justify-between bg-stone-900/50 border border-stone-800 rounded-xl px-3 py-2.5">
          <div>
            <div className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">
              $KLOOM Credits
            </div>
            <div className="text-sm font-bold text-white">{balance}</div>
          </div>
          <Link
            href="/app/settings?tab=billing"
            className="flex items-center gap-1 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={11} />
            Get More
          </Link>
        </div>

        {/* Wallet */}
        <button
          onClick={() => isWalletConnected ? disconnect() : openWalletModal(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-stone-800/50 transition-colors group"
        >
          <div className={`w-2 h-2 rounded-full shrink-0 ${isWalletConnected ? "bg-emerald-400" : "bg-stone-600"}`} />
          <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors truncate flex-1 text-left font-mono">
            {publicKey ? shortenAddress(publicKey.toBase58()) : "Connect Solana Wallet"}
          </span>
          <Wallet size={12} className="text-stone-500 group-hover:text-stone-300 transition-colors shrink-0" />
        </button>

        {/* Settings */}
        <Link
          href="/app/settings"
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-stone-800/50 ${
            pathname === "/app/settings"
              ? "bg-stone-800/50 text-white"
              : "text-white/40"
          }`}
        >
          <Settings size={16} className="text-stone-500" />
          Settings
        </Link>
      </div>
    </aside>
  )
}
