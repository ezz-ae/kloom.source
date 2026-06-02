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
} from "lucide-react"
import { useSolCredits } from "@/hooks/use-sol-credits"

const NAV = [
  {
    label: "Discover",
    href: "/app/discover",
    icon: Compass,
  },
  {
    label: "Rooms",
    href: "/app/rooms",
    icon: Users,
    badge: "New",
    badgeColor: "bg-emerald-600",
  },
  {
    label: "Build a room",
    href: "/app/create",
    icon: Plus,
  },
  {
    label: "Experts",
    href: "/app/experts",
    icon: GraduationCap,
    badge: "New",
    badgeColor: "bg-emerald-600",
    children: [
      { label: "Lifestyle & Coaching", href: "/app/experts?cat=guidance", icon: Compass },
      { label: "Creative & Critique",  href: "/app/experts?cat=creative", icon: Palette },
      { label: "Health & Wellness",    href: "/app/experts?cat=wellness", icon: Heart },
      { label: "Mind & Games",         href: "/app/experts?cat=mind",     icon: Brain },
      { label: "Business & Hustle",    href: "/app/experts?cat=business", icon: Briefcase },
      { label: "Future Reading",       href: "/app/experts?cat=future",   icon: Moon },
      { label: "Intimacy · 18+",       href: "/app/experts?cat=intimacy", icon: Flame },
    ],
  },
  {
    label: "Chat",
    href: "/app/chat",
    icon: MessageSquare,
    badge: "Pro",
    badgeColor: "bg-amber-500",
  },
  {
    label: "Creator Suite",
    href: "/app/creator",
    icon: Sparkles,
    badge: "Hot",
    badgeColor: "bg-rose-500",
    children: [
      { label: "Instagram", href: "/app/creator?tab=instagram", icon: Instagram },
      { label: "OnlyFans", href: "/app/creator?tab=onlyfans", icon: Flame },
      { label: "Content", href: "/app/creator?tab=content", icon: FileText },
      { label: "Calendar", href: "/app/creator?tab=calendar", icon: Calendar },
    ],
  },
]

function shortenAddress(addr: string) {
  return addr.slice(0, 4) + "…" + addr.slice(-4)
}

export function Sidebar() {
  const pathname = usePathname()
  // Each expandable nav item toggles independently (Experts + Creator Suite).
  const [openMenus, setOpenMenus] = useState<Set<string>>(
    new Set([
      ...(pathname.startsWith("/app/creator") ? ["Creator Suite"] : []),
      ...(pathname.startsWith("/app/experts") ? ["Experts"] : []),
    ])
  )
  const toggleMenu = (label: string) =>
    setOpenMenus((s) => { const n = new Set(s); n.has(label) ? n.delete(label) : n.add(label); return n })
  const { balance, isWalletConnected } = useSolCredits()
  const { publicKey, disconnect } = useWallet()
  const { setVisible: openWalletModal } = useWalletModal()

  return (
    <aside className="flex flex-col h-full w-56 bg-stone-950 border-r border-white/8 py-5 px-3 shrink-0">
      {/* Logo */}
      <Link href="/app/discover" className="flex items-center gap-2.5 px-2 mb-7 group">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
          <Zap size={16} className="text-white" />
        </div>
        <span className="font-black text-lg tracking-tight text-white">Ora</span>
        <span className="text-[9px] font-bold bg-amber-500/20 border border-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded-full ml-auto">
          BETA
        </span>
      </Link>

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
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-white/55 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <item.icon size={16} className="shrink-0" />
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
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-white/55 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <item.icon size={16} className="shrink-0" />
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
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/8 pl-3">
                  {item.children!.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                        pathname === child.href
                          ? "text-white bg-white/5"
                          : "text-white/45 hover:text-white/80 hover:bg-white/5"
                      }`}
                    >
                      <child.icon size={13} className="shrink-0" />
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-4 space-y-2">
        {/* Credits */}
        <div className="flex items-center justify-between bg-white/5 border border-white/8 rounded-xl px-3 py-2.5">
          <div>
            <div className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Credits</div>
            <div className="text-sm font-bold text-white">{balance}</div>
          </div>
          <Link
            href="/app/settings?tab=billing"
            className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={11} />
            Top up
          </Link>
        </div>

        {/* Wallet */}
        <button
          onClick={() => isWalletConnected ? disconnect() : openWalletModal(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors group"
        >
          <div className={`w-2 h-2 rounded-full shrink-0 ${isWalletConnected ? "bg-emerald-400" : "bg-white/20"}`} />
          <span className="text-xs text-white/50 group-hover:text-white/80 transition-colors truncate flex-1 text-left font-mono">
            {publicKey ? shortenAddress(publicKey.toBase58()) : "Connect wallet"}
          </span>
          <Wallet size={12} className="text-white/30 group-hover:text-white/60 transition-colors shrink-0" />
        </button>

        {/* Settings */}
        <Link
          href="/app/settings"
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
            pathname === "/app/settings"
              ? "bg-white/10 text-white"
              : "text-white/45 hover:text-white hover:bg-white/5"
          }`}
        >
          <Settings size={16} />
          Settings
        </Link>
      </div>
    </aside>
  )
}
