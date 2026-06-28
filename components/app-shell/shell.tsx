"use client"

import { usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"
import { MobileNav } from "./mobile-nav"
import { isAbuseday } from "@/lib/variant"

/**
 * Single-render shell. Children are rendered ONCE — the sidebar (desktop) and
 * bottom nav (mobile) are toggled with responsive visibility around them.
 *
 * Rendering children in two separate blocks (the old approach) double-mounted
 * every page — which for rooms meant two realtime channels + two voice hooks
 * per user. Never do that.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Immersive routes (a live room, the create wizard, expert sessions) own the
  // full viewport — no marketing footer eating phone screen under the chat.
  const immersive =
    pathname === "/app/create" ||
    /^\/app\/rooms\/(?!c\/)[^/]+$/.test(pathname) ||
    /^\/app\/experts\/[^/]+$/.test(pathname)
  return (
    <div className="h-screen flex bg-background overflow-hidden relative">
      {/* Living ambient backdrop — warm amber/rose blobs drifting behind everything */}
      <div className="app-ambient" aria-hidden>
        <div className="blob-3" />
      </div>

      {/* Sidebar — desktop only, in flow */}
      <div className="hidden lg:block shrink-0 relative z-10">
        <Sidebar />
      </div>

      {/* Content — rendered exactly once */}
      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto relative z-10">
        <div className="flex-1">
          {children}
        </div>
        
        {/* Global Branding Footer — hidden on immersive (full-viewport) routes */}
        {!immersive && (
        <footer className="w-full border-t border-border/20 py-8 px-6 mt-12 bg-background/50 backdrop-blur-sm shrink-0">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              {isAbuseday() ? (
                <div className="w-6 h-6 rounded-md brand-gradient" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/kloom-icon-192.png" alt="Kloom" className="w-6 h-6 rounded-md" />
              )}
              <span className="font-bold text-sm tracking-widest uppercase text-foreground/80">{isAbuseday() ? "ABUSEDAY" : "KLOOM.AI"}</span>
            </div>
            <div className="flex items-center gap-6 text-xs text-muted-foreground font-medium">
              <a href="/legal/terms" className="hover:text-amber-400 transition-colors">Terms</a>
              <a href="/legal/privacy" className="hover:text-amber-400 transition-colors">Privacy</a>
              <a href="/legal/cookies" className="hover:text-amber-400 transition-colors">Cookies</a>
              <a href="/legal/payments" className="hover:text-amber-400 transition-colors">Payments</a>
            </div>
            <div className="text-[10px] text-muted-foreground/50">
              © 2026 {isAbuseday() ? "Abuseday" : "Kloom.ai"}. All rights reserved.
            </div>
          </div>
        </footer>
        )}
      </main>

      {/* Bottom nav — mobile only, fixed overlay (self-hides on immersive routes) */}
      <MobileNav />
    </div>
  )
}
