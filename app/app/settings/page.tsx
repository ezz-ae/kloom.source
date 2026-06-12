"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { useSolCredits } from "@/hooks/use-sol-credits"
import { TopUpSlider } from "@/components/widgets/TopUpSlider"
import { PayPalCheckout } from "@/components/widgets/PayPalCheckout"
import { hasUnlimited } from "@/lib/voice-credits"
import { setSubscribed, setUnrestricted } from "@/lib/account"
import { AuthGate } from "@/components/widgets/AuthGate"
import { completePassPurchase, hydrateEntitlement } from "@/lib/auth"
import { isWellnessEnabled, setWellnessEnabled, clearWellnessData } from "@/lib/wellness"
import {
  CreditCard, Wallet, Bell, Shield, Trash2,
  ExternalLink, Check, Plus, Zap, HeartHandshake,
  User, Globe, Loader2, X as XIcon, Infinity as InfinityIcon,
} from "lucide-react"

type Tab = "billing" | "wallet" | "account" | "preferences"

const TABS: Array<{ id: Tab; label: string; icon: typeof CreditCard }> = [
  { id: "billing",     label: "Billing & Credits", icon: CreditCard },
  { id: "wallet",      label: "Wallet",            icon: Wallet },
  { id: "account",     label: "Account",           icon: User },
  { id: "preferences", label: "Preferences",       icon: Bell },
]

// Chat is free for everyone. Passes unlock unlimited voice + Unrestricted.
const PLANS = [
  {
    id: "dayuse",
    name: "Dayuse",
    price: 7.93,
    period: "24h",
    features: ["Unlimited voice calls", "Unrestricted — no filters (18+)", "1 invitation", "Full access to every world"],
    highlight: false,
  },
  {
    id: "holyweek",
    name: "Holyweek",
    price: 13.32,
    period: "7 days",
    features: ["Unlimited voice calls", "Unrestricted — no filters (18+)", "3 invitations", "Full access to every world"],
    highlight: false,
  },
  {
    id: "super30",
    name: "Super30",
    price: 21,
    period: "mo",
    features: ["Unlimited voice calls", "Unrestricted — no filters (18+)", "Unlimited invitations", "Full access to every world"],
    highlight: true,
  },
]

function shortenAddress(a: string) { return a.slice(0, 6) + "…" + a.slice(-6) }

function SettingsContent() {
  const params    = useSearchParams()
  const router    = useRouter()
  const rawTab    = params.get("tab") as Tab | null
  const activeTab: Tab = rawTab && TABS.find((t) => t.id === rawTab) ? rawTab : "billing"

  const { publicKey, disconnect, connecting } = useWallet()
  const { setVisible: openWalletModal }        = useWalletModal()
  const { balance, solPrice }                  = useSolCredits()
  const bloomMint = process.env.NEXT_PUBLIC_BLOOM_MINT

  const [notifs, setNotifs]       = useState(true)
  const [autoMic, setAutoMic]     = useState(true)
  const [wellnessOn, setWellnessOn] = useState(true)
  const [wellnessErased, setWellnessErased] = useState(false)
  useEffect(() => { setWellnessOn(isWellnessEnabled()) }, [])
  const toggleWellness = () => {
    const next = !wellnessOn
    setWellnessOn(next)
    setWellnessEnabled(next)        // off also erases history (privacy by default)
    if (!next) setWellnessErased(false)
  }
  const [subLoading, setSubLoading] = useState<string | null>(null)
  const [subSuccess, setSubSuccess] = useState(false)
  const [payPlan, setPayPlan]       = useState<string | null>(null)
  const [topUpOpen, setTopUpOpen]   = useState(false)
  const unlimited = hasUnlimited()

  // Detect return from subscription checkout
  useEffect(() => {
    if (params.get("subscribed") === "1") {
      setSubSuccess(true)
      router.replace("/app/settings?tab=billing")
      setTimeout(() => setSubSuccess(false), 6000)
    }
  }, [params, router])

  // Reveal the inline account + card form for a plan (no wallet, no redirect).
  const handleSubscribe = (planId: string) => {
    setPayPlan((p) => (p === planId ? null : planId))
  }

  // Re-sync any pass owned by the signed-in account on load.
  useEffect(() => { hydrateEntitlement() }, [])

  return (
    <div className="min-h-full bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/30 px-5 lg:px-8 py-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-black tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your account, billing, and preferences</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 lg:px-8 py-6 flex flex-col md:flex-row gap-5 md:gap-8 pb-28">

        {/* Tabs — horizontal scroll strip on phones, sidebar on desktop */}
        <div className="md:w-48 shrink-0 flex md:flex-col gap-1 overflow-x-auto scrollbar-hide -mx-5 px-5 md:mx-0 md:px-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => router.push(`/app/settings?tab=${tab.id}`)}
              className={`shrink-0 md:w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-foreground/10 text-foreground"
                  : "text-foreground/45 hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              <tab.icon size={15} className="shrink-0" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* ── Billing ── */}
          {activeTab === "billing" && (
            <>
              {/* Free chat banner */}
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-sm font-semibold px-4 py-3 rounded-2xl">
                <Check size={15} className="shrink-0" />
                Text chat is free — rooms, experts, and inviting friends. You only pay for live voice calls.
              </div>

              {/* Voice credits balance */}
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-amber-300 uppercase tracking-widest mb-1">Voice call credits</div>
                    {unlimited ? (
                      <div className="flex items-center gap-2 text-4xl font-black text-emerald-400">
                        <InfinityIcon size={32} /> Unlimited
                      </div>
                    ) : (
                      <div className="text-4xl font-black">{balance}<span className="text-lg text-muted-foreground"> min</span></div>
                    )}
                    <div className="text-sm text-foreground/50 mt-1">
                      {unlimited ? "Unlimited voice calls · active" : "1 credit ≈ 1 minute · first 5 min free · never expires"}
                    </div>
                  </div>
                  {!unlimited && (
                    <button onClick={() => setTopUpOpen(true)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-foreground font-bold px-5 py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] text-sm">
                      <Plus size={16} />
                      Top up
                    </button>
                  )}
                </div>
              </div>

              {/* Live SOL price */}
              {solPrice > 0 && (
                <div className="text-xs text-muted-foreground/60 -mt-3">
                  Top up with SOL or card · live rate: 1 SOL ≈ ${solPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </div>
              )}

              {/* Subscription success */}
              {subSuccess && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-semibold px-4 py-3 rounded-xl">
                  <Check size={15} /> Subscription activated — welcome to Pro!
                </div>
              )}

              {/* Subscription plans — Creator tools (optional) */}
              <div>
                <h3 className="font-bold mb-1">Full-access passes</h3>
                <p className="text-xs text-muted-foreground mb-4">Unlimited voice + Unrestricted, time-boxed. Text chat stays free either way.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {PLANS.map((plan) => (
                    <div
                      key={plan.id}
                      className={`relative rounded-2xl p-5 border ${
                        plan.highlight
                          ? "border-amber-500/40 bg-amber-500/10"
                          : "border-border/50 bg-foreground/5"
                      }`}
                    >
                      {plan.highlight && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-foreground text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                          Best value
                        </div>
                      )}
                      <div className="mb-4">
                        <div className="font-bold text-sm text-foreground">{plan.name}</div>
                        <div className="text-3xl font-black mt-1">
                          ${plan.price}
                          <span className="text-sm font-normal text-muted-foreground">/{plan.period}</span>
                        </div>
                      </div>
                      <ul className="space-y-2 mb-5">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <Check size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => handleSubscribe(plan.id)}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] ${
                          plan.highlight
                            ? "bg-amber-500 hover:bg-amber-400 text-foreground"
                            : "bg-foreground/8 hover:bg-foreground/12 text-foreground"
                        }`}
                      >
                        {payPlan === plan.id ? "Close" : plan.id === "super30" ? "Subscribe" : "Get the pass"}
                      </button>

                      {payPlan === plan.id && (
                        <div className="mt-4 rounded-2xl border border-border/50 bg-foreground/5 p-4">
                          <AuthGate intent="to get this pass">
                            <PayPalCheckout
                              walletAddress={publicKey?.toBase58() ?? ""}
                              price={plan.price}
                              credits={0}
                              kind={plan.id}
                              label={`${plan.name} pass`}
                              onSuccess={() => {
                                setSubscribed(true); setUnrestricted(true)
                                completePassPurchase(plan.id as "dayuse" | "holyweek" | "super30")
                                setSubSuccess(true); setPayPlan(null)
                              }}
                            />
                          </AuthGate>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground/60 text-center mt-4">
                  Powered by PayPal · pay by card, no PayPal account needed
                </p>
              </div>
            </>
          )}

          {/* ── Wallet ── */}
          {activeTab === "wallet" && (
            <div className="space-y-4">
              {/* Connection status */}
              <div className="bg-foreground/5 border border-border/50 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Solana wallet</div>
                    {publicKey ? (
                      <div className="font-mono text-sm text-foreground">{publicKey.toBase58()}</div>
                    ) : (
                      <div className="text-sm text-foreground/50">Not connected</div>
                    )}
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full ${publicKey ? "bg-emerald-400" : "bg-white/20"}`} />
                </div>
                <button
                  onClick={() => publicKey ? disconnect() : openWalletModal(true)}
                  disabled={connecting}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    publicKey
                      ? "bg-foreground/5 border border-border/50 hover:bg-foreground/10 text-foreground"
                      : "bg-white text-stone-950 hover:bg-white/90"
                  }`}
                >
                  <Wallet size={15} />
                  {publicKey ? "Disconnect wallet" : connecting ? "Connecting…" : "Connect wallet"}
                </button>
              </div>

              {/* $BLOOM token */}
              <div className="bg-foreground/5 border border-border/50 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <Zap size={14} className="text-foreground" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">$BLOOM Token</div>
                    <div className="text-xs text-muted-foreground">Solana SPL · 6 decimals</div>
                  </div>
                </div>
                {bloomMint ? (
                  <a
                    href={`https://explorer.solana.com/address/${bloomMint}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <ExternalLink size={11} />
                    View on Solana Explorer
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground/60">Token mint not configured yet.</p>
                )}
              </div>

              {/* Supported wallets */}
              <div className="bg-foreground/5 border border-border/50 rounded-2xl p-5">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Supported wallets</div>
                {["Phantom", "Solflare", "Backpack"].map((w) => (
                  <div key={w} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <span className="text-sm text-foreground">{w}</span>
                    <Check size={14} className="text-emerald-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Account ── */}
          {activeTab === "account" && (
            <div className="space-y-4">
              <div className="bg-foreground/5 border border-border/50 rounded-2xl p-6">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Identity</div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <User size={20} className="text-foreground" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">
                      {publicKey ? shortenAddress(publicKey.toBase58()) : "Anonymous"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {publicKey ? "Identified by Solana wallet" : "Connect wallet to save account"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-foreground/5 border border-border/50 rounded-2xl p-6">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Privacy</div>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2"><Shield size={14} className="text-emerald-400" /> No email required</div>
                  <div className="flex items-center gap-2"><Shield size={14} className="text-emerald-400" /> No tracking or analytics on conversations</div>
                  <div className="flex items-center gap-2"><Shield size={14} className="text-emerald-400" /> Wallet address is your only identifier</div>
                  <div className="flex items-center gap-2"><Globe size={14} className="text-amber-400" /> Credits stored on Solana mainnet</div>
                </div>
              </div>

              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
                <div className="text-xs font-semibold text-red-400/60 uppercase tracking-widest mb-3">Danger zone</div>
                <p className="text-xs text-muted-foreground mb-4">Wipe all local data including chat history, settings, and cached credits. This cannot be undone.</p>
                <button
                  onClick={() => {
                    if (!confirm("Wipe all local data? This cannot be undone.")) return
                    localStorage.clear()
                    window.location.reload()
                  }}
                  className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  <Trash2 size={14} />
                  Clear all local data
                </button>
              </div>
            </div>
          )}

          {/* ── Preferences ── */}
          {activeTab === "preferences" && (
            <div className="space-y-4">
              <div className="bg-foreground/5 border border-border/50 rounded-2xl divide-y divide-white/5">
                {[
                  {
                    label: "Push notifications",
                    sub: "Get notified when a friend or matched room is live",
                    state: notifs,
                    set: setNotifs,
                    icon: Bell,
                  },
                  {
                    label: "Auto-pickup microphone",
                    sub: "Start listening as soon as a call connects",
                    state: autoMic,
                    set: setAutoMic,
                    icon: Globe,
                  },
                ].map((pref) => (
                  <div key={pref.label} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <pref.icon size={16} className="text-muted-foreground shrink-0" />
                      <div>
                        <div className="text-sm font-medium">{pref.label}</div>
                        <div className="text-xs text-foreground/35 mt-0.5">{pref.sub}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => pref.set((v: boolean) => !v)}
                      className={`w-10 h-6 rounded-full transition-colors relative ${
                        pref.state ? "bg-amber-500" : "bg-white/15"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          pref.state ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              {/* Wellness & privacy — the consented, on-device mood signal */}
              <div className="bg-foreground/5 border border-border/50 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <HeartHandshake size={16} className="text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-sm font-medium">Wellness check-ins</div>
                      <div className="text-xs text-foreground/35 mt-0.5">
                        Reads the mood of your chats <span className="text-foreground/60">on your device</span> to
                        offer support (Breathe, a resource). Never uploaded, never sold.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={toggleWellness}
                    className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${wellnessOn ? "bg-amber-500" : "bg-white/15"}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${wellnessOn ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
                {wellnessOn && (
                  <button
                    onClick={() => { clearWellnessData(); setWellnessErased(true) }}
                    className="flex items-center gap-2 text-xs font-semibold text-foreground/60 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} /> {wellnessErased ? "Wellness data erased" : "Erase my wellness data"}
                  </button>
                )}
              </div>

              <div className="bg-foreground/5 border border-border/50 rounded-2xl p-5">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">App version</div>
                <div className="text-sm text-foreground/50">v0.2 · $BLOOM on Solana mainnet</div>
                <div className="text-xs text-muted-foreground/60 mt-1">Built with Next.js · Supabase · Solana</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top-up modal — $1 → $60 unlimited */}
      {topUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setTopUpOpen(false)}>
          <div className="bg-stone-900 border border-border/50 rounded-3xl p-6 max-w-sm w-full max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-lg flex items-center gap-2"><CreditCard size={18} className="text-amber-400" /> FlexiCalls &amp; passes</h3>
              <button onClick={() => setTopUpOpen(false)} className="text-muted-foreground hover:text-foreground"><XIcon size={18} /></button>
            </div>
            <p className="text-sm text-foreground/50 mb-5">Slide for minutes — or grab a pass and forget the meter.</p>
            <TopUpSlider onDone={() => setTopUpOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  )
}
