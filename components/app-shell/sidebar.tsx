"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Plus,
  Settings,
  DoorOpen,
  User,
} from "lucide-react"

const NAV: Array<{ label: string; href: string; icon: typeof Home; badge?: string; badgeColor?: string }> = [
  { label: "Home",          href: "/app",        icon: Home },
  { label: "Rooms",         href: "/app/rooms",  icon: DoorOpen },
  { label: "Create", href: "/app/create", icon: Plus },
  { label: "You",           href: "/app/you",    icon: User },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="bg-black flex flex-col h-full w-60 border-r border-white/[0.06] py-5 px-3 shrink-0">
      {/* Logo */}
      <Link href="/app" className="flex items-center gap-2.5 px-2 mb-7 group">
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
        <Link
          href="/app/settings?tab=billing"
          className="flex items-center justify-center gap-1.5 rounded-2xl brand-gradient px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-stone-950 brand-glow hover:scale-[1.02] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]">
          <Plus size={13} /> Get a pass
        </Link>

        <Link
          href="/app/settings"
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition ${
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
