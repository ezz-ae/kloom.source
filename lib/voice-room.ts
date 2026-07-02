/**
 * Shared voice rooms — WebRTC mesh over Supabase Realtime signaling.
 *
 * Each human in a room session forms a direct peer connection to every other
 * human, streaming live microphone audio. Supabase broadcast carries the
 * signaling (hello / offer / answer / ICE). Public STUN handles most NATs.
 *
 * CAVEAT: ~10-15% of networks (strict symmetric NAT) need a TURN relay.
 * Add TURN servers to ICE_SERVERS below when you provision one (e.g. Twilio,
 * Cloudflare Calls, coturn). Without TURN those users fall back to chat.
 *
 * Topology: full mesh — ideal for 2-5 participants. Beyond that, an SFU
 * (LiveKit / Cloudflare) would be the upgrade.
 */

import { supabase } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { mediaDevicesUnavailable } from "@/lib/media"
import { phoneMicAudio } from "@/lib/speech-segmenter"

// STUN-only fallback if the ICE endpoint is unreachable.
const FALLBACK_ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

// Fetched from /api/ice-servers at join time — includes TURN (custom / Twilio /
// Metered / free Open Relay). Server-resolved so credentials stay dynamic.
async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch("/api/ice-servers", { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return FALLBACK_ICE
    const data = await res.json()
    return Array.isArray(data.iceServers) && data.iceServers.length ? data.iceServers : FALLBACK_ICE
  } catch {
    return FALLBACK_ICE
  }
}

export type VoiceStatus = "idle" | "requesting-mic" | "connecting" | "live" | "error"

export interface VoiceRoomHandlers {
  onRemoteStream: (peerId: string, stream: MediaStream) => void
  onPeerLeave:    (peerId: string) => void
  onStatus:       (s: VoiceStatus, msg?: string) => void
  onPeerCount:    (n: number) => void
}

export interface VoiceRoomHandle {
  leave: () => void
  setMuted: (muted: boolean) => void
  localStream: MediaStream | null
}

export interface VoiceRoomOptions {
  listenOnly?: boolean
}

export async function joinVoiceRoom(
  roomId: string,
  sessionId: string,
  selfId: string,
  handlers: VoiceRoomHandlers,
  options: VoiceRoomOptions = {}
): Promise<VoiceRoomHandle> {
  if (!options.listenOnly) {
    handlers.onStatus("requesting-mic")
  }

  // Resolve ICE servers (STUN + TURN) from the server before connecting
  const iceServers = await fetchIceServers()

  let localStream: MediaStream | null = null
  if (!options.listenOnly) {
    const micUnavailable = mediaDevicesUnavailable()
    if (micUnavailable) {
      handlers.onStatus("error", micUnavailable)
      throw new Error("mic-unavailable")
    }
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: phoneMicAudio(),
        video: false,
      })
    } catch {
      handlers.onStatus("error", "Microphone access denied")
      throw new Error("mic-denied")
    }
  }

  handlers.onStatus("connecting")

  const peers   = new Map<string, RTCPeerConnection>()
  const iceQueue = new Map<string, RTCIceCandidateInit[]>()
  const topic    = `voice-${roomId}-${sessionId}`

  // Clear any stale signaling channel (Strict Mode remounts)
  for (const ch of supabase.getChannels()) {
    if (ch.topic === topic || ch.topic === `realtime:${topic}`) {
      try { supabase.removeChannel(ch) } catch {}
    }
  }

  const sig: RealtimeChannel = supabase.channel(topic, { config: { broadcast: { self: false } } })

  const announceCount = () => handlers.onPeerCount(peers.size)

  function createPeer(peerId: string, initiator: boolean): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers })
    if (localStream) {
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream!))
    } else {
      // If listen-only, explicitly add a transceiver to receive audio
      pc.addTransceiver('audio', { direction: 'recvonly' })
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sig.send({ type: "broadcast", event: "ice", payload: { to: peerId, from: selfId, candidate: e.candidate.toJSON() } })
      }
    }
    pc.ontrack = (e) => {
      if (e.streams[0]) handlers.onRemoteStream(peerId, e.streams[0])
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") handlers.onStatus("live")
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        peers.delete(peerId); handlers.onPeerLeave(peerId); announceCount()
      }
    }

    peers.set(peerId, pc)
    announceCount()

    if (initiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer).then(() => offer))
        .then((offer) => sig.send({ type: "broadcast", event: "offer", payload: { to: peerId, from: selfId, sdp: offer } }))
        .catch(() => {})
    }
    return pc
  }

  // Deterministic initiator avoids glare: smaller id initiates for each pair.
  function maybeInitiate(peerId: string) {
    if (peers.has(peerId) || peerId === selfId) return
    createPeer(peerId, selfId < peerId)
  }

  async function flushIce(peerId: string, pc: RTCPeerConnection) {
    const q = iceQueue.get(peerId)
    if (q) { for (const c of q) { try { await pc.addIceCandidate(c) } catch {} } iceQueue.delete(peerId) }
  }

  sig
    .on("broadcast", { event: "hello" }, ({ payload }) => {
      if (payload.from === selfId) return
      // Reply so the newcomer learns of us, then connect
      sig.send({ type: "broadcast", event: "hi", payload: { from: selfId, to: payload.from } })
      maybeInitiate(payload.from)
    })
    .on("broadcast", { event: "hi" }, ({ payload }) => {
      if (payload.to !== selfId) return
      maybeInitiate(payload.from)
    })
    .on("broadcast", { event: "offer" }, async ({ payload }) => {
      if (payload.to !== selfId) return
      const pc = peers.get(payload.from) ?? createPeer(payload.from, false)
      try {
        await pc.setRemoteDescription(payload.sdp)
        await flushIce(payload.from, pc)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        sig.send({ type: "broadcast", event: "answer", payload: { to: payload.from, from: selfId, sdp: answer } })
      } catch {}
    })
    .on("broadcast", { event: "answer" }, async ({ payload }) => {
      if (payload.to !== selfId) return
      const pc = peers.get(payload.from)
      if (pc) { try { await pc.setRemoteDescription(payload.sdp); await flushIce(payload.from, pc) } catch {} }
    })
    .on("broadcast", { event: "ice" }, async ({ payload }) => {
      if (payload.to !== selfId) return
      const pc = peers.get(payload.from)
      if (pc?.remoteDescription) { try { await pc.addIceCandidate(payload.candidate) } catch {} }
      else { const q = iceQueue.get(payload.from) ?? []; q.push(payload.candidate); iceQueue.set(payload.from, q) }
    })
    .on("broadcast", { event: "bye" }, ({ payload }) => {
      const pc = peers.get(payload.from)
      if (pc) { pc.close(); peers.delete(payload.from); handlers.onPeerLeave(payload.from); announceCount() }
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        sig.send({ type: "broadcast", event: "hello", payload: { from: selfId } })
      }
    })

  return {
    localStream,
    setMuted: (muted: boolean) => {
      if (localStream) {
        localStream.getAudioTracks().forEach((t) => { t.enabled = !muted })
      }
    },
    leave: () => {
      try { sig.send({ type: "broadcast", event: "bye", payload: { from: selfId } }) } catch {}
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop())
      }
      peers.forEach((pc) => pc.close())
      peers.clear()
      try { supabase.removeChannel(sig) } catch {}
    },
  }
}
