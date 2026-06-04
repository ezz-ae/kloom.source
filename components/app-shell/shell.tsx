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
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar — desktop only, in flow */}
      <div className="hidden lg:block shrink-0">
        <Sidebar />
      </div>

      {/* Content — rendered exactly once */}
      <main className="flex-1 min-w-0 flex flex-col overflow-y-auto relative">
        <div className="flex-1">
          {children}
        </div>
        
        {/* Global Branding Footer */}
        <footer className="w-full border-t border-border/20 py-8 px-6 mt-12 bg-background/50 backdrop-blur-sm shrink-0">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <img src="/kloom-icon-192.png" alt="Kloom" className="w-6 h-6 rounded-md" />
              <span className="font-bold text-sm tracking-widest uppercase text-foreground/80">KLOOM.AI</span>
            </div>
            <div className="flex items-center gap-6 text-xs text-muted-foreground font-medium">
              <a href="#" className="hover:text-amber-400 transition-colors">Twitter</a>
              <a href="#" className="hover:text-amber-400 transition-colors">Discord</a>
              <a href="#" className="hover:text-amber-400 transition-colors">Terms</a>
              <a href="#" className="hover:text-amber-400 transition-colors">Privacy</a>
            </div>
            <div className="text-[10px] text-muted-foreground/50">
              © 2026 Kloom.ai. All rights reserved.
            </div>
          </div>
        </footer>
      </main>

      {/* Bottom nav — mobile only, fixed overlay (self-hides on immersive routes) */}
      <MobileNav />
    </div>
  )
}
