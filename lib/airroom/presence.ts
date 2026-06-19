/**
 * AIRROOM presence — who's actually HERE, right now.
 *
 * The substrate for the whole "oh, you're human?" vision: it tracks every real
 * visitor's position in the universe (buffet / a world / a room / a group) on a
 * Supabase Realtime channel — the same proven mechanism the room engine already
 * uses (lib/room-session.ts: channel.track + presenceState). From it we know how
 * many people are live, where they are, and who's standing in the same spot as
 * you — which is exactly what chance-meetings and humans-in-rooms are built on.
 */
"use client"
import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"

let _id = ""
function myId(): string {
  if (!_id) {
    try { _id = sessionStorage.getItem("airroom_uid") || "" } catch { /* */ }
    if (!_id) { _id = "u" + Math.random().toString(36).slice(2, 9); try { sessionStorage.setItem("airroom_uid", _id) } catch { /* */ } }
  }
  return _id
}

export interface PresenceState {
  me: string
  total: number                          // real people live in the universe right now
  here: number                           // people at your exact spot (incl. you)
  others: { id: string; loc: string }[]  // everyone else, with their location
}

export function usePresence(loc: string): PresenceState {
  const [state, setState] = useState<PresenceState>({ me: "", total: 0, here: 0, others: [] })
  const chRef = useRef<RealtimeChannel | null>(null)
  const locRef = useRef(loc)
  locRef.current = loc

  useEffect(() => {
    const id = myId()
    setState((s) => ({ ...s, me: id }))
    const ch = supabase.channel("airroom-presence", { config: { presence: { key: id } } })
    chRef.current = ch
    const sync = () => {
      const ps = ch.presenceState() as Record<string, Array<{ loc?: string }>>
      const all: { id: string; loc: string }[] = []
      for (const k in ps) for (const m of ps[k]) all.push({ id: k, loc: m.loc || "" })
      setState({
        me: id,
        total: all.length,
        here: all.filter((a) => a.loc === locRef.current).length,
        others: all.filter((a) => a.id !== id),
      })
    }
    ch.on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status) => { if (status === "SUBSCRIBED") ch.track({ id, loc: locRef.current }) })
    return () => { try { supabase.removeChannel(ch) } catch { /* */ } }
  }, [])

  // re-broadcast position as the visitor moves through the universe
  useEffect(() => { chRef.current?.track({ id: myId(), loc }) }, [loc])

  return state
}
