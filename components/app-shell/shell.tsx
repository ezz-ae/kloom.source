"use client"

import { Sidebar } from "./sidebar"
import { MobileNav } from "./mobile-nav"

/**
 * Single-render shell. Children are rendered ONCE — the sidebar (desktop) and
 * bottom nav (mobile) are toggled with responsive visibility around them.
 *
 * Rendering children in two separate blocks (the old approach) double-mounted
 * every page — which for rooms meant two realtime channels + two voice hooks
 * per user. Never do that.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex bg-stone-950 overflow-hidden">
      {/* Sidebar — desktop only, in flow */}
      <div className="hidden lg:block shrink-0">
        <Sidebar />
      </div>

      {/* Content — rendered exactly once */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>

      {/* Bottom nav — mobile only, fixed overlay (self-hides on immersive routes) */}
      <MobileNav />
    </div>
  )
}
