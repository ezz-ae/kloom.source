/**
 * Community rooms directory — Supabase-backed.
 *
 * Publishing a wizard-built room puts it in its world's category page for
 * everyone, and makes plain `/app/rooms/<id>` links resolve from anywhere
 * (no #r= payload needed). The directory lives on its own Supabase project,
 * separate from payments/credits.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Room, RoomCategory } from "@/lib/rooms"
import { decodeRoomPayload, encodeRoomPayload } from "@/lib/room-share"

// Publishable (anon) credentials — safe to ship; RLS limits access to
// public-room reads + inserts.
const ROOMS_DB_URL =
  process.env.NEXT_PUBLIC_ROOMS_SUPABASE_URL || "https://zcglezhtadgwbismlaaf.supabase.co"
const ROOMS_DB_KEY =
  process.env.NEXT_PUBLIC_ROOMS_SUPABASE_ANON_KEY || "sb_publishable_VU1uIaY8q5_AVCzNzwhY9g_JBsOf47Q"

let _client: SupabaseClient | null = null
function db(): SupabaseClient {
  if (!_client) _client = createClient(ROOMS_DB_URL, ROOMS_DB_KEY)
  return _client
}

export interface CommunityRoomRow {
  id: string
  name: string
  category: string
  room: Room
  creator: string | null
  created_at: string
}

/** Publish a room to its world. Returns true on success. */
export async function publishRoom(room: Room, creator?: string): Promise<boolean> {
  try {
    // Round-trip through the share codec — guarantees what we store is exactly
    // what an invitee's client would accept.
    const safe = decodeRoomPayload(encodeRoomPayload(room))
    if (!safe) return false
    const { error } = await db().from("kloom_rooms").insert({
      id: safe.id,
      name: safe.name,
      category: safe.category,
      room: safe,
      creator: creator ?? null,
      is_public: true,
    })
    return !error
  } catch {
    return false
  }
}

/** Latest community rooms in one world. */
export async function fetchCommunityRooms(category: RoomCategory, limit = 24): Promise<Room[]> {
  try {
    const { data, error } = await db()
      .from("kloom_rooms")
      .select("room")
      .eq("category", category)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return (data as { room: Room }[])
      .map((r) => decodeRoomPayload(encodeRoomPayload(r.room)))
      .filter((r): r is Room => r !== null)
  } catch {
    return []
  }
}

/** Resolve one published room by id (final fallback for invite links). */
export async function fetchPublishedRoom(id: string): Promise<Room | null> {
  try {
    const { data, error } = await db()
      .from("kloom_rooms")
      .select("room")
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return null
    return decodeRoomPayload(encodeRoomPayload((data as { room: Room }).room))
  } catch {
    return null
  }
}

/** Count of community rooms per category — for door badges. */
export async function fetchCommunityCounts(): Promise<Record<string, number>> {
  try {
    const { data, error } = await db().from("kloom_rooms").select("category")
    if (error || !data) return {}
    const counts: Record<string, number> = {}
    for (const r of data as { category: string }[]) {
      counts[r.category] = (counts[r.category] ?? 0) + 1
    }
    return counts
  } catch {
    return {}
  }
}
