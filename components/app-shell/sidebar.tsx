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
    <aside className="flex flex-col h-full w-56 bg-background border-r border-border py-5 px-3 shrink-0">
      {/* Logo */}
      <Link href="/app/discover" className="flex items-center gap-2.5 px-2 mb-7 group">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform p-1.5">
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
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                isActive
                  ? "bg-accent text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              <item.icon size={18} className={`shrink-0 ${isActive ? "text-amber-400" : "text-muted-foreground"}`} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span className={`text-[10px] font-semibold text-white px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-4 space-y-3 px-1">
        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground font-semibold">Credits</div>
          <div className="mt-2 text-2xl font-black">{balance}</div>
          <Link
            href="/app/settings?tab=billing"
            className="inline-flex items-center gap-2 mt-4 rounded-2xl bg-amber-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-950 hover:bg-amber-400 transition-colors"
          >
            <Plus size={12} /> Top up
          </Link>
        </div>

        <button
          onClick={() => (isWalletConnected ? disconnect() : openWalletModal(true))}
          className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition hover:border-foreground/20"
        >
          <span className={`w-2.5 h-2.5 rounded-full ${isWalletConnected ? "bg-emerald-400" : "bg-muted-foreground/40"}`} />
          <span className="flex-1 text-xs font-medium text-muted-foreground truncate">
            {publicKey ? shortenAddress(publicKey.toBase58()) : "Connect wallet"}
          </span>
          <Wallet size={14} className="text-muted-foreground" />
        </button>

        <Link
          href="/app/settings"
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition ${
            pathname === "/app/settings"
              ? "bg-accent text-foreground"
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
