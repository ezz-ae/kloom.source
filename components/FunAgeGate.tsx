"use client"

/**
 * Site-entry 18+ gate for the adult variant (airraw.com).
 *
 * Kloom.fun is an entirely unrestricted / adult product, so — unlike the per-room
 * AdultGate on .io — a single age confirmation must block the WHOLE site on first
 * visit (landing included), before any content is shown. Remembered per device and
 * shared with the per-room AdultGate via the same `kloom_age_ack` key.
 *
 * INERT on every non-.fun build: adultEnabled() is false on kloom.io / .me, so this
 * returns null and never appears on the SFW ad surface. (adultEnabled() reads the
 * build-time NEXT_PUBLIC_KLOOM_VARIANT, so it's identical on server and client — no
 * hydration drift; the localStorage read happens only in the effect.)
 */
import { useEffect, useState } from "react"
import Link from "next/link"
import { adultEnabled } from "@/lib/variant"
import { hasAgeAck } from "@/components/widgets/AdultGate"
import { ShieldAlert } from "lucide-react"

const ACK_KEY = "kloom_age_ack"

export function FunAgeGate() {
  const [open, setOpen] = useState(false)
  useEffect(() => { if (adultEnabled()) setOpen(!hasAgeAck()) }, [])
  if (!open) return null

  const enter = () => { try { localStorage.setItem(ACK_KEY, "1") } catch { /* */ } setOpen(false) }
  const leave = () => { try { window.location.href = "https://www.google.com" } catch { /* */ } }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-5">
      <div className="max-w-sm w-full rounded-3xl border border-rose-500/25 bg-stone-950 p-7 text-center shadow-[0_24px_80px_-20px_rgba(244,63,94,0.25)]">
        <div className="w-14 h-14 mx-auto rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-5">
          <ShieldAlert size={24} className="text-rose-400" />
        </div>
        <h2 className="text-2xl font-black tracking-tight">Adults only.</h2>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          This is an 18+ space — conversations here are unrestricted and can be
          explicit. By entering you confirm you are <span className="text-foreground font-semibold">18 or older</span> and
          that adult content is legal where you live.
        </p>
        <div className="mt-7 space-y-2.5">
          <button onClick={enter}
            className="w-full brand-gradient text-stone-950 font-black py-3.5 rounded-2xl brand-glow hover:scale-[1.01] active:scale-[0.99] transition-transform">
            I&apos;m 18 or older — enter
          </button>
          <button onClick={leave}
            className="w-full border border-border/50 text-muted-foreground hover:text-foreground font-semibold py-3 rounded-2xl hover:bg-foreground/5 transition-all">
            Leave
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-5">
          Remembered on this device · <Link href="/legal/terms" className="underline hover:text-muted-foreground">Terms</Link>
        </p>
      </div>
    </div>
  )
}
