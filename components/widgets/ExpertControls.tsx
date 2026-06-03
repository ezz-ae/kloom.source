"use client"

/**
 * In-conversation control panel for an expert/persona. Opens from the header and
 * shows the FULL profile (title, level, gender, languages, skills), the TOOLS the
 * AI can use, the active PROMPT (what it's instructed to do), and RESTRICTION
 * LIFTING (unlock Unrestricted right here). The user focuses on the title/role,
 * not the name.
 */
import { useState, useEffect } from "react"
import type { Expert } from "@/lib/experts"
import { expertTitle } from "@/lib/experts"
import { hasUnrestricted } from "@/lib/account"
import { UnrestrictedUpsell } from "./UnrestrictedUpsell"
import { Globe, Wrench, ScrollText, ShieldAlert, ShieldCheck, ChevronDown, Sparkles, Languages as LangIcon } from "lucide-react"

const TOOL_LABELS: Record<string, string> = {
  kloom_web_search: "Live web search", kloom_calculate: "Calculator", kloom_financial_calc: "Financial math",
  kloom_get_crypto_price: "Live crypto prices", kloom_get_multi_price: "Multi-coin prices",
  kloom_analyze_market: "Market analysis", kloom_analyze_token_chart: "Token chart read", kloom_get_token_info: "Token info",
  kloom_analyze_code: "Code review", kloom_generate_code: "Code generation", kloom_build_html: "HTML builder",
  kloom_build_connector: "Connector builder", kloom_create_wallet: "Wallet creator", kloom_get_strategy: "Strategy playbooks",
  kloom_instagram_caption: "Caption writer", kloom_generate_hashtags: "Hashtag strategy", kloom_onlyfans_dm: "DM writer",
  kloom_content_ideas: "Content ideas", kloom_canva_design: "Canva designs", kloom_analyze_profile: "Profile audit",
  kloom_build_growth_plan: "Growth plan",
}
const toolLabel = (id: string) =>
  TOOL_LABELS[id] || id.replace(/^kloom_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/8 border border-border/50 text-foreground/70">{children}</span>
}

export function ExpertControls({ expert }: { expert: Expert }) {
  const [open, setOpen]   = useState(false)
  const [tab, setTab]     = useState<"profile" | "tools" | "prompt">("profile")
  const [unrest, setUnrest] = useState(false)
  useEffect(() => { setUnrest(hasUnrestricted()) }, [open])

  const tools = expert.tools ?? []

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white/5 border border-border/50 text-foreground/70 hover:text-foreground hover:bg-white/10 transition-all">
        <Sparkles size={13} /> Profile <ChevronDown size={12} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[min(92vw,360px)] z-40 rounded-2xl border border-white/12 bg-zinc-950/95 backdrop-blur-xl shadow-2xl p-4">
            {/* Title-first header */}
            <div className="flex items-start gap-3 pb-3 border-b border-white/8">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 border border-border/50 flex items-center justify-center text-xl shrink-0">{expert.emoji}</div>
              <div className="min-w-0">
                <div className="font-bold text-sm leading-tight">{expertTitle(expert)}</div>
                <div className="text-[11px] text-foreground/40 mt-0.5">{expert.name} · {expert.level}</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 my-3 bg-white/5 rounded-lg p-1">
              {(["profile", "tools", "prompt"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 text-[11px] font-semibold py-1 rounded-md capitalize transition-all ${tab === t ? "bg-white text-zinc-950" : "text-foreground/50 hover:text-foreground"}`}>{t}</button>
              ))}
            </div>

            {tab === "profile" && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <Chip>⭐ {expert.level}</Chip>
                  <Chip>{expert.gender === "female" ? "♀ Female" : expert.gender === "male" ? "♂ Male" : "⚧ Non-binary"} voice</Chip>
                  {expert.adult && <Chip>🔞 18+</Chip>}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-foreground/45 uppercase tracking-wider mb-1.5"><LangIcon size={12} /> Languages</div>
                  <div className="flex flex-wrap gap-1.5">{(expert.languages ?? ["English"]).map((l) => <Chip key={l}>{l}</Chip>)}</div>
                </div>
                {!!(expert.skills?.length) && (
                  <div>
                    <div className="text-[11px] font-bold text-foreground/45 uppercase tracking-wider mb-1.5">Skills</div>
                    <div className="flex flex-wrap gap-1.5">{expert.skills!.map((s) => <Chip key={s}>{s}</Chip>)}</div>
                  </div>
                )}
              </div>
            )}

            {tab === "tools" && (
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-foreground/45 uppercase tracking-wider mb-2"><Wrench size={12} /> Tools it can use</div>
                {tools.length ? (
                  <div className="flex flex-wrap gap-1.5">{tools.map((t) => <Chip key={t}>{toolLabel(t)}</Chip>)}</div>
                ) : (
                  <p className="text-xs text-foreground/40">Conversation only — no external tools for this persona.</p>
                )}
              </div>
            )}

            {tab === "prompt" && (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-foreground/45 uppercase tracking-wider"><ScrollText size={12} /> What it's instructed to do</div>
                <p className="text-xs text-foreground/70 leading-relaxed">{expert.expertise}</p>
                {expert.outputFormat && <p className="text-[11px] text-foreground/45"><b>Format:</b> {expert.outputFormat}</p>}
                {expert.forbidden && <p className="text-[11px] text-rose-300/70"><b>Never:</b> {expert.forbidden}</p>}
              </div>
            )}

            {/* Restriction lifting — always visible */}
            <div className="mt-3 pt-3 border-t border-white/8">
              {unrest ? (
                <div className="flex items-center gap-2 text-xs text-emerald-300"><ShieldCheck size={14} /> Unrestricted active — no limits on this conversation.</div>
              ) : expert.adult ? (
                <UnrestrictedUpsell context={expertTitle(expert)} />
              ) : (
                <div className="flex items-start gap-2 text-[11px] text-foreground/45">
                  <ShieldAlert size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <span>Standard mode — sensitive topics are limited. <span className="text-rose-300">Unrestricted ($10/mo)</span> lifts every limit platform-wide.</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
