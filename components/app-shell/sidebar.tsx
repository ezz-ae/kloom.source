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
  Zap,
  Users,
  GraduationCap,
  Sparkles,
  User,
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
    badgeColor: "bg-emerald-500",
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
    badgeColor: "bg-emerald-500",
  },
  {
    label: "Creator Suite",
    href: "/app/creator",
    icon: Sparkles,
    badge: "Hot",
    badgeColor: "bg-rose-500",
  },
  {
    label: "You",
    href: "/app/you",
    icon: User,
  },
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
    <aside className="flex flex-col h-full w-56 bg-slate-950 border-r border-slate-800 py-5 px-3 shrink-0">
      {/* Logo */}
      <Link href="/app/discover" className="flex items-center gap-2.5 px-2 mb-7 group">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-500 via-sky-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-slate-950/30 group-hover:scale-105 transition-transform">
          <Zap size={16} className="text-white" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-black text-lg tracking-tight text-white">Kloom</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200">Creator Lab</span>
        </div>
        <span className="text-[9px] font-bold bg-amber-500/20 border border-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded-full ml-auto">
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
                  ? "bg-slate-800 text-white shadow-[0_0_0_1px_rgba(148,163,184,0.12)]"
                  : "text-slate-300 hover:text-white hover:bg-slate-900/70"
              }`}
            >
              <item.icon size={18} className="shrink-0 text-cyan-300" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span
                  className={`text-[10px] font-semibold text-white px-2 py-1 rounded-full ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-4 space-y-3 px-1">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="text-[10px] uppercase tracking-[0.28em] text-slate-400 font-semibold">Credits</div>
          <div className="mt-2 text-2xl font-black text-white">{balance}</div>
          <Link
            href="/app/settings?tab=billing"
            className="inline-flex items-center gap-2 mt-4 rounded-2xl bg-cyan-500 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950 hover:bg-cyan-400 transition-colors"
          >
            <Plus size={12} />
            Top up
          </Link>
        </div>

        <button
          onClick={() => (isWalletConnected ? disconnect() : openWalletModal(true))}
          className="w-full flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-left transition hover:border-slate-700"
        >
          <span className={`w-2.5 h-2.5 rounded-full ${isWalletConnected ? "bg-emerald-400" : "bg-slate-600"}`} />
          <span className="flex-1 text-xs font-medium text-slate-300 truncate">
            {publicKey ? shortenAddress(publicKey.toBase58()) : "Connect wallet"}
          </span>
          <Wallet size={14} className="text-slate-400" />
        </button>

        <Link
          href="/app/settings"
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition ${
            pathname === "/app/settings"
              ? "bg-slate-800 text-white"
              : "text-slate-400 hover:text-white hover:bg-slate-900/70"
          }`}
        >
          <Settings size={18} className="text-cyan-300" />
          Settings
        </Link>
      </div>
    </aside>
  )
}
