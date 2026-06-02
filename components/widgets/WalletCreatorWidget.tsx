"use client"

import { useState } from "react"
import { Keypair } from "@solana/web3.js"
import { Eye, EyeOff, Copy, Check, AlertTriangle, Wallet, RefreshCw } from "lucide-react"

export function WalletCreatorWidget() {
  const [kp, setKp]               = useState<{ pub: string; hex: string } | null>(null)
  const [showPrivate, setShow]    = useState(false)
  const [copied, setCopied]       = useState<"pub" | "priv" | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const generate = () => {
    const keypair = Keypair.generate()
    setKp({
      pub: keypair.publicKey.toBase58(),
      hex: Buffer.from(keypair.secretKey).toString("hex"),
    })
    setShow(false)
    setConfirmed(false)
  }

  const copy = async (which: "pub" | "priv") => {
    if (!kp) return
    await navigator.clipboard.writeText(which === "pub" ? kp.pub : kp.hex)
    setCopied(which)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-stone-900 overflow-hidden my-1">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8 bg-white/5">
        <Wallet size={15} className="text-amber-400" />
        <span className="font-bold text-sm">Solana Wallet Generator</span>
      </div>

      <div className="p-4 space-y-4">
        {!kp ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-white/50">Generate a fresh Solana wallet keypair. The private key is created locally — never sent anywhere.</p>
            <button onClick={generate}
              className="bg-amber-500 hover:bg-amber-400 text-white font-bold px-6 py-2.5 rounded-xl transition-all hover:scale-[1.02] text-sm">
              Generate wallet
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Public key */}
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold mb-1.5">Public address</div>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                <code className="text-xs font-mono text-emerald-300 flex-1 truncate">{kp.pub}</code>
                <button onClick={() => copy("pub")} className="text-white/40 hover:text-white/80 shrink-0">
                  {copied === "pub" ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
              </div>
            </div>

            {/* Private key */}
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold mb-1.5 flex items-center gap-1.5">
                <AlertTriangle size={10} className="text-amber-400" />
                Private key — save this NOW, it won't be shown again
              </div>
              <div className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2.5">
                <code className="text-xs font-mono text-amber-300 flex-1 truncate">
                  {showPrivate ? kp.hex : "•".repeat(32)}
                </code>
                <button onClick={() => setShow((v) => !v)} className="text-white/40 hover:text-white/80 shrink-0">
                  {showPrivate ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button onClick={() => copy("priv")} className="text-white/40 hover:text-white/80 shrink-0">
                  {copied === "priv" ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
              </div>
            </div>

            {/* Confirmation */}
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 accent-amber-500" />
              <span className="text-xs text-white/50">I have saved my private key securely in a password manager or hardware wallet</span>
            </label>

            <div className="flex gap-2">
              <button onClick={generate}
                className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors">
                <RefreshCw size={11} /> Generate new
              </button>
              {confirmed && (
                <a href={`https://solscan.io/account/${kp.pub}`} target="_blank" rel="noopener noreferrer"
                  className="ml-auto text-xs text-amber-400 hover:text-amber-300 transition-colors">
                  View on Solscan →
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
