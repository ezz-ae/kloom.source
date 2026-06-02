/**
 * GET /api/ice-servers
 *
 * Returns the ICE server list (STUN + TURN) for WebRTC voice rooms.
 * Resolved server-side so TURN credentials can be dynamic/secret.
 *
 * Priority:
 *   1. Custom static TURN  — TURN_URL / TURN_USERNAME / TURN_CREDENTIAL
 *   2. Twilio NTS          — TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN (short-lived)
 *   3. Metered             — METERED_API_KEY (+ METERED_APP)
 *   4. Open Relay (free)   — public fallback so voice works out of the box
 *
 * Always includes Google STUN.
 */

import { NextResponse } from "next/server"

const STUN: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

// Free public TURN (Open Relay Project) — fine for dev + light production.
const OPEN_RELAY: RTCIceServer[] = [
  { urls: "turn:openrelay.metered.ca:80",  username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
]

export async function GET() {
  const iceServers: RTCIceServer[] = [...STUN]

  try {
    // 1) Custom static TURN
    if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
      iceServers.push({
        urls: process.env.TURN_URL.split(",").map((u) => u.trim()),
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
      })
      return NextResponse.json({ iceServers, source: "custom" })
    }

    // 2) Twilio Network Traversal Service — mints short-lived TURN creds
    const sid = process.env.TWILIO_ACCOUNT_SID
    const tok = process.env.TWILIO_AUTH_TOKEN
    if (sid && tok) {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Tokens.json`, {
        method: "POST",
        headers: {
          "Authorization": "Basic " + Buffer.from(`${sid}:${tok}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.ice_servers)) {
          // Twilio returns {url|urls, username, credential}
          for (const s of data.ice_servers) {
            iceServers.push({ urls: s.urls ?? s.url, username: s.username, credential: s.credential })
          }
          return NextResponse.json({ iceServers, source: "twilio" })
        }
      }
    }

    // 3) Metered TURN API
    const meteredKey = process.env.METERED_API_KEY
    const meteredApp = process.env.METERED_APP // e.g. "yourapp" → yourapp.metered.live
    if (meteredKey && meteredApp) {
      const res = await fetch(`https://${meteredApp}.metered.live/api/v1/turn/credentials?apiKey=${meteredKey}`, {
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const list = await res.json()
        if (Array.isArray(list)) {
          for (const s of list) iceServers.push(s as RTCIceServer)
          return NextResponse.json({ iceServers, source: "metered" })
        }
      }
    }
  } catch {
    // fall through to free TURN
  }

  // 4) Free public fallback
  iceServers.push(...OPEN_RELAY)
  return NextResponse.json({ iceServers, source: "openrelay" })
}
