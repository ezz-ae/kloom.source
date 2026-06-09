"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import {
  Compass,
  Plus,
  Wallet,
  Settings,
  Users,
  GraduationCap,
  Sparkles,
  User,
} from "lucide-react"
import { useSolCredits } from "@/hooks/use-sol-credits"

const NAV = [
  { label: "Discover",     href: "/app/discover", icon: Compass },
  { label: "Rooms",        href: "/app/rooms",    icon: Users,         badge: "New", badgeColor: "bg-emerald-500" },
  { label: "Build a room", href: "/app/create",   icon: Plus },
  { label: "Experts",      href: "/app/experts",  icon: GraduationCap, badge: "New", badgeColor: "bg-emerald-500" },
  { label: "Creator Suite",href: "/app/creator",  icon: Sparkles,      badge: "Hot", badgeColor: "bg-rose-500" },
  { label: "You",          href: "/app/you",      icon: User },
]

function shortenAddress(addr: string) {
  return addr.slice(0, 4) + "…" + addr.slice(-4)
}

export function Sidebar() {
  const pathname = usePathname()
  const { balance, isWalletConnected } = useSolCredits()
  const { publicKey, disconnect } = useWallet()
  const { setVisible: openWalletModal } = useWalletModal()

  return (
    <aside className="glass flex flex-col h-full w-60 border-r border-white/[0.06] py-5 px-3 shrink-0">
      {/* Logo */}
      <Link href="/app/discover" className="flex items-center gap-2.5 px-2 mb-7 group">
        <div className="w-9 h-9 rounded-2xl brand-gradient flex items-center justify-center brand-glow group-hover:scale-105 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] p-1.5">
          <img src="/kloom-mark.png" alt="Kloom" className="w-full h-full object-contain" />
        </div>
        <img src="/kloom-wordmark.png" alt="Kloom" className="h-4 object-contain object-left" />
        <span className="text-[9px] font-bold bg-amber-500/15 border border-amber-500/25 text-amber-300 px-1.5 py-0.5 rounded-full ml-auto">
          BETA
        </span>
      </Link>

      {/* Main nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-1">
        {NAV.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/app" && pathname.startsWith(item.href.split("?")[0]))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                isActive
                  ? "bg-amber-500/[0.14] text-foreground shadow-[inset_0_0_0_1px_rgba(251,191,36,0.22)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              {/* Active rail accent */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full brand-gradient shadow-[0_0_10px_rgba(251,146,60,0.7)]" />
              )}
              <item.icon size={18} className={`shrink-0 transition-colors ${isActive ? "text-amber-400" : "text-muted-foreground group-hover:text-foreground/80"}`} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-4 space-y-3 px-1">
        <div className="relative rounded-3xl overflow-hidden p-4 border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-orange-500/[0.04] to-transparent">
          <div className="absolute -top-8 -right-6 w-24 h-24 rounded-full bg-amber-500/20 blur-2xl pointer-events-none" />
          <div className="relative text-[10px] uppercase tracking-[0.28em] text-amber-200/70 font-bold">Credits</div>
          <div className="relative mt-1.5 text-3xl font-black tracking-tight">{balance}</div>
          <Link
            href="/app/settings?tab=billing"
            className="relative inline-flex items-center gap-1.5 mt-3.5 rounded-full brand-gradient px-3.5 py-2 text-xs font-bold uppercase tracking-[0.16em] text-stone-950 brand-glow hover:scale-[1.03] active:scale-95 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
          >
            <Plus size={12} /> Top up
          </Link>
        </div>

        <button
          onClick={() => (isWalletConnected ? disconnect() : openWalletModal(true))}
          className="w-full flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/15 hover:bg-white/[0.06]"
        >
          <span className={`w-2.5 h-2.5 rounded-full ${isWalletConnected ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" : "bg-muted-foreground/40"}`} />
          <span className="flex-1 text-xs font-medium text-muted-foreground truncate">
            {publicKey ? shortenAddress(publicKey.toBase58()) : "Connect wallet"}
          </span>
          <Wallet size={14} className="text-muted-foreground" />
        </button>

        <Link
          href="/app/settings"
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition ${
            pathname === "/app/settings"
              ? "bg-amber-500/[0.14] text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
          }`}
        >
          <Settings size={18} className="text-muted-foreground" />
          Settings
        </Link>
      </div>
    </aside>
  )
}
