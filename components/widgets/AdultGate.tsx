"use client"

/**
 * 18+ assurance gate — blocking overlay shown ONLY on rooms in adult worlds.
 * One explicit confirmation, remembered on the device (localStorage), then
 * never shown again. "Leave" backs out to the worlds directory.
 */
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ShieldAlert } from "lucide-react"

const ACK_KEY = "kloom_age_ack"

export function hasAgeAck(): boolean {
  try { return localStorage.getItem(ACK_KEY) === "1" } catch { return false }
}

export function AdultGate({ worldLabel }: { worldLabel: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(!hasAgeAck()) }, [])
  if (!open) return null

  const confirm = () => {
    try { localStorage.setItem(ACK_KEY, "1") } catch {}
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-md p-5">
      <div className="max-w-sm w-full rounded-3xl border border-rose-500/25 bg-stone-950 p-7 text-center shadow-[0_24px_80px_-20px_rgba(244,63,94,0.25)]">
        <div className="w-14 h-14 mx-auto rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-5">
          <ShieldAlert size={24} className="text-rose-400" />
        </div>
        <h2 className="text-2xl font-black tracking-tight">Adults only.</h2>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          {worldLabel} is an 18+ world — conversations here are unrestricted and may be
          explicit. By continuing you confirm you are <span className="text-foreground font-semibold">18 or older</span>.
        </p>
        <div className="mt-7 space-y-2.5">
          <button onClick={confirm}
            className="w-full brand-gradient text-stone-950 font-black py-3.5 rounded-2xl brand-glow hover:scale-[1.01] active:scale-[0.99] transition-transform">
            I&apos;m 18 or older — enter
          </button>
          <button onClick={() => router.push("/app/rooms")}
            className="w-full border border-border/50 text-muted-foreground hover:text-foreground font-semibold py-3 rounded-2xl hover:bg-foreground/5 transition-all">
            Take me back
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-5">
          Remembered on this device · <Link href="/legal/terms" className="underline hover:text-muted-foreground">Terms</Link>
        </p>
      </div>
    </div>
  )
}
