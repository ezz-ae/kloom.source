"use client"

/**
 * AIRROOM — the descent.
 *
 * From orbit, "the now" is a glowing planet of voices. You fall toward it — through
 * the atmosphere, past the continents (the moods), down over the rooms, onto a
 * street, until you're close enough to a single face that you just… talk. One
 * continuous plunge through scale, like dropping from space onto Earth.
 *
 * Proximity is voice: whoever is nearest the centre of your view murmurs aloud
 * (Fish TTS), and hands off as you drift. Canvas level-of-detail: a glittering
 * crowd of points from space, real human faces once you reach the rooftops. The
 * fifth continent — "the deep" — is 18+: its faces stay anonymous lights until you
 * confirm your age by opening one.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { makeCharacter, type Cluster } from "@/lib/airroom/roster"
import { imageFor } from "@/lib/persona-utils"
import { faceUrl, cachedFace } from "@/lib/airraw/face"
import { AirBubble } from "@/components/airroom/AirBubble"
import { GroupRoom } from "@/components/airroom/GroupRoom"
import { isPro, getPendingIntent, setProToken, clearPendingIntent, fbCookies } from "@/lib/airroom/pro"
import { ProSheet } from "@/components/airroom/ProSheet"
import { ProfileSheet } from "@/components/airroom/ProfileSheet"
import { getProfile, type Profile } from "@/lib/airroom/profile"
import { getCredits, spendCredits } from "@/lib/airroom/credits"
import { detectLanguage, LANGUAGES } from "@/lib/languages"
import { track } from "@/lib/airraw/track"

// `v` is the full vibe (feeds the AI persona + deeper HUD); `label` is the single
// word the world wears at orbit — one word, not three, so the sky stays quiet.
interface Continent { n: string; v: string; label: string; h: number; f: number; adult?: boolean }
// Worlds are situations, not categories. No labels — the color IS the language.
// Hues run water (202 cool-blue) → fire (2 deep-red) so the planet is a visual gradient.
const CONTINENTS: Continent[] = [
  { n: "a quiet corner", v: "late café · still · no one talking", label: "", h: 202, f: 0.12 },
  { n: "the side street", v: "3 people standing outside · city noise · waiting", label: "", h: 168, f: 0.24 },
  { n: "the office, late", v: "few left · heads down · something building", label: "", h: 132, f: 0.33 },
  { n: "a bar, early", v: "just filling up · easy · not loud yet", label: "", h: 58, f: 0.40 },
  { n: "a restaurant", v: "close table · it's a date · someone just laughed", label: "", h: 26, f: 0.46 },
  { n: "a rooftop, late", v: "city below · drinks · strangers feel close tonight", label: "", h: 10, f: 0.52 },
  { n: "3am", v: "last call · no one going home · nothing to lose", label: "", h: 2, f: 0.62 },
  { n: "the deep", v: "raw · 18+", label: "raw", h: 300, f: 0.86, adult: true },
]

// Every room in a world carries its own TOPIC — what the people in it are on
// about tonight. Deterministic per room seed, themed per continent, so the map
// reads as a network of distinct situations instead of identical bubbles.
// Indexed to match CONTINENTS.
const TOPICS: string[][] = [
  ["first coffee", "the quiet type", "eye contact", "the corner table", "rainy window", "two introverts", "a familiar stranger", "slow morning", "the bookshop", "same order again"],
  ["waiting for the same cab", "cigarette break", "lost tourists", "the after-party walk", "neon small talk", "who's got a lighter", "shortcut home", "street musician"],
  ["deadline together", "the last two here", "elevator moment", "overtime confessions", "the new hire", "boss is gone", "coffee machine talk", "one desk over"],
  ["happy hour", "first round", "the regulars", "new in town", "the bartender knows", "two seats left", "cheap wine, big plans", "watch the game"],
  ["first date", "blind date", "sharing dessert", "wine and truth", "the anniversary", "table for three", "the ex walks in", "dessert first"],
  ["city lights", "someone's birthday", "last drink", "stars over traffic", "the slow dance", "strangers feel close", "midnight plans", "the edge of the roof"],
  ["last call", "nothing to lose", "truth or dare", "the confession hour", "one more song", "no one's going home", "the walk home", "sunrise bet"],
  ["no rules tonight", "say it out loud", "whispers only", "the dare room", "midnight confessional", "the velvet room", "after dark", "skin deep", "rough edges", "forbidden"],
]

// the cold-open: a few lines drift up the sky before the worlds appear, then it
// opens into the write box. Plays once per browser (skippable by a tap).
const INTRO_LINES = ["it’s the now.", "a whole sky of voices.", "some real — some not.", "you won’t always know."]
const INTRO_LINE_MS = 1900   // each line's on-screen slot (kept in sync with the CSS)
const CITIES = 8
const FACES = 14
const PR = 0.40, CX = 0.5, CY = 0.5

const rnd = (s: number) => { const x = Math.sin(s * 127.1) * 43758.5453; return x - Math.floor(x) }
function tempLabel(f: number) { if (f < 0.3) return "💧"; if (f < 0.48) return "〜"; if (f < 0.64) return "🔶"; return "🔥" }

// The zoom IS the group-size dial: the group you'd join shrinks as you descend.
// Per-location jitter gives rooms their own sizes (one is 39, the next 52, …).
function joinSize(camS: number, locSeed: number): number {
  let base: number
  if (camS < 11) base = 52
  else if (camS < 24) base = 26
  else if (camS < 60) base = 9
  else return 1
  const j = (rnd(locSeed * 1.7 + 3) * 2 - 1) * base * 0.38
  return Math.max(3, Math.round(base + j))
}
interface Join { n: number; seed: number; f: number; adult: boolean; c: number }

// Procedural infinity: the planet surface is an INFINITE grid of rooms. Each grid
// cell is a room, deterministically themed by its nearest continent — so you can
// drift forever and rooms keep appearing, never repeating, always stable (pan back
// and the same room is there). ihash → a stable int per cell; ifrac → 0..1 from it.
const RCELL = 0.055
function ihash(a: number, b: number): number { let h = ((a | 0) * 73856093) ^ ((b | 0) * 19349663); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0 }
function ifrac(h: number): number { return (h % 100003) / 100003 }


const btn: React.CSSProperties = { width: 44, height: 44, color: "#dfeaf2", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.2)", borderRadius: 12, cursor: "pointer", fontSize: 20, lineHeight: "1", display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }

export function Planet() {
  const cvRef = useRef<HTMLCanvasElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const zoomFnRef = useRef<(f: number) => void>(() => {})

  const [selected, setSelected] = useState<Cluster | null>(null)
  const [group, setGroup] = useState<{ seed: number; f: number; count: number } | null>(null)
  const [pending, setPending] = useState<Cluster | null>(null)   // deep voice awaiting 18+ confirm
  const [pendingJoin, setPendingJoin] = useState<Join | null>(null) // deep group awaiting 18+ confirm
  const [nearDeep, setNearDeep] = useState(false)   // you're descending toward the deep → age screen
  const nearDeepRef = useRef(false)
  const [verified, setVerified] = useState(false)
  const [hud, setHud] = useState<{ crumb: string; alt: string; hearing: string; join: Join | null }>({ crumb: "from orbit · the whole now", alt: "orbit", hearing: "the hum of the whole now", join: null })

  const verifiedRef = useRef(false)
  const inCallRef = useRef(false)
  // Raw entry: the very first view is just the sky + one way in — no marketing copy,
  // no input that promises routing it can't deliver. The blocks appear once you begin
  // (tap to fall in, or scroll/drag/zoom the sky).
  const [started, setStarted] = useState(false)
  // One-time navigation hint after falling in — the descent has no chrome, so a
  // first-timer needs one line telling them the gesture language. Fades on its own.
  const [navHint, setNavHint] = useState(false)
  useEffect(() => {
    if (!started) return
    setNavHint(true)
    const t = setTimeout(() => setNavHint(false), 6500)
    return () => clearTimeout(t)
  }, [started])
  const [opening, setOpening] = useState("")     // handed to the first room you enter as your first line
  const [intro, setIntro] = useState(false)      // cold-open is opt-in (?intro=1); default lands on the write box
  const skipIntro = () => { try { localStorage.setItem("airraw_intro_seen", "1") } catch { /* */ } setIntro(false) }
  // drive the cold-open: the lines animate via staggered CSS (below), so JS only
  // needs ONE timeout to open the sky when the sequence ends — no per-line state,
  // no interval to compound under Strict Mode. Returning visitors skip it; ?intro=1
  // forces a replay.
  useEffect(() => {
    // The cold-open rendered blank on real iOS and blocked the payment return, so it's
    // OPT-IN for now: visitors land straight on the write box (proven to render); add
    // ?intro=1 to replay/test it. Once it's verified on a device we can re-enable.
    let force = false
    try { force = new URLSearchParams(window.location.search).get("intro") === "1" } catch { /* */ }
    if (!force) { setIntro(false); return }
    setIntro(true)
    const total = INTRO_LINES.length * INTRO_LINE_MS + 700
    const timer = setTimeout(() => setIntro(false), total)
    return () => clearTimeout(timer)
  }, [])
  const startedRef = useRef(false)
  const startFnRef = useRef<() => void>(() => {})
  const openingRef = useRef("")
  const [pro, setPro] = useState(() => isPro())   // paid: the AIR pulse lights up your best matches
  const [showPro, setShowPro] = useState(false)   // the paywall
  const [proMsg, setProMsg] = useState("")         // "you're pro" / payment toast
  const airTrig = useRef(0)
  // who you are on the floor + your credit balance (anonymous, local)
  const [showProfile, setShowProfile] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [credits, setCredits] = useState(0)
  useEffect(() => { setProfile(getProfile()); setCredits(getCredits()) }, [])
  // Grant the pass on return from Ziina — but reconcile on EVERY load, not just the
  // redirect: if Ziina doesn't bounce the buyer back (or marks the intent completed a
  // beat later), the pending intent is claimed next time they open airraw.com.
  useEffect(() => {
    try {
      const u = new URLSearchParams(window.location.search)
      const justPaid = u.get("pro_ok") === "1"
      if (u.get("pro_fail") === "1") setProMsg("payment didn't go through — you weren't charged.")
      if (justPaid || u.get("pro_fail")) window.history.replaceState({}, "", "/airraw")
      const id = getPendingIntent()
      if (!id || isPro()) return
      fetch("/api/airraw-pro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "claim", intentId: id, ...fbCookies() }) })
        .then((r) => r.json())
        .then((d) => {
          if (d?.paid && d?.token) { const eid = id; setProToken(d.token); clearPendingIntent(); setPro(true); setProMsg("you're AIRRAW Pro ✦ enjoy the floor."); try { track("purchase", { value: 9, currency: "USD", method: "ziina", kind: "pass" }, eid) } catch { /* */ }; track("airraw_pro_paid", { surface: "planet" }) }
          else if (["failed", "canceled", "cancelled", "expired"].includes(String(d?.status))) clearPendingIntent()
          else if (justPaid) setProMsg("payment is still processing — reopen airraw in a moment and your Pro will appear.")
        })
        .catch(() => {})
    } catch { /* */ }
  }, [])
  useEffect(() => { if (!proMsg) return; const t = setTimeout(() => setProMsg(""), 5000); return () => clearTimeout(t) }, [proMsg])
  // the planet speaks your language — detect the visitor's, let them change it
  const [lang, setLang] = useState("English")
  const langRef = useRef("English")
  useEffect(() => { const d = detectLanguage(); setLang(d); langRef.current = d }, [])
  useEffect(() => { langRef.current = lang }, [lang])
  useEffect(() => { verifiedRef.current = verified }, [verified])
  useEffect(() => { inCallRef.current = !!selected || !!group }, [selected, group])

  useEffect(() => { try { if (localStorage.getItem("airroom_18") === "1") setVerified(true) } catch { /* */ } }, [])
  useEffect(() => { track("airraw_land", { surface: "planet" }) }, [])

  // Live-voices counter — seeded from wall-clock hour so visitors see the same ballpark,
  // plus a slow local jitter so it feels alive. No server needed.
  const [liveCount, setLiveCount] = useState(0)
  useEffect(() => {
    const compute = () => {
      const h = Math.floor(Date.now() / 3600000)
      const base = 24 + (((h * 1234567 + 890123) % 100003) % 52)   // 24–75, stable per hour
      const tick = Math.floor(Date.now() / 28000)                    // changes every ~28 s
      const jitter = ((tick * 31337) % 17) - 8                       // −8 to +8
      return Math.max(14, base + jitter)
    }
    setLiveCount(compute())
    const iv = setInterval(() => setLiveCount(compute()), 28000)
    return () => clearInterval(iv)
  }, [])

  // Only the 8 continent anchors are fixed; rooms + faces are generated procedurally
  // for whatever's on screen (see the loop), so the world is infinite.
  // The 8 worlds, unboxed: spread across a tall ellipse so they fill the sky on a
  // phone (narrow x, tall y) instead of clustering in one block.
  const conCentres = useMemo(() => CONTINENTS.map((_, c) => {
    const cang = (c / CONTINENTS.length) * 6.283 + 0.6
    return { x: CX + Math.cos(cang) * 0.235, y: CY + Math.sin(cang) * 0.375 }
  }), [])
  // Characters are minted lazily per face-seed and cached — only the ones you
  // actually drift near or open are ever built.
  const charCache = useRef(new Map<number, Cluster>())
  const charFor = useCallback((seed: number, c: number): Cluster => {
    let ch = charCache.current.get(seed)
    if (!ch) { ch = makeCharacter((seed >>> 0) + 7, CONTINENTS[c].f); ch.vibe = CONTINENTS[c].v; charCache.current.set(seed, ch) }
    return ch
  }, [])

  // ── proximity voice — the nearest face murmurs, like leaning toward someone ──
  const speakTok = useRef(0)
  const speak = useCallback(async (char: Cluster) => {
    const tok = ++speakTok.current
    try {
      const res = await fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: char.lines[0], personaName: char.host, gender: char.gender, language: langRef.current, voiceId: char.voiceId }),
      })
      if (!res.ok || speakTok.current !== tok) return
      const url = URL.createObjectURL(await res.blob())
      if (speakTok.current !== tok) { URL.revokeObjectURL(url); return }
      const a = audioRef.current
      if (a) { a.src = url; a.volume = 0.9; a.onended = () => URL.revokeObjectURL(url); await a.play().catch(() => {}) }
    } catch { /* a quiet sky is fine */ }
  }, [])

  const takeOpening = () => { const o = openingRef.current; openingRef.current = ""; setOpening(o); return o }
  // TAP = ENTER. The descent already showed you the place — the zoom is the door,
  // so a tap opens the room DIRECTLY, no interstitial card, no "step in" button.
  // Only two things may interrupt, and only when they must: the AIR paywall when
  // you're out of credits, and the one-time 18+ confirm on adult ground.
  const gateAir = () => {
    // Out of AIR is never a dead end: a warm nudge + the pass sheet, never "you can't".
    if (!isPro() && getCredits() <= 0) {
      setProMsg("✦ out of AIR for now — unlock the pass and dive into anyone")
      setShowPro(true)
      return false
    }
    return true
  }
  const openVoice = useCallback((c: number, seed: number) => {
    const co = CONTINENTS[c]
    if (!gateAir()) return
    if (co.adult && !verifiedRef.current) { setPending(charFor(seed, c)); return }
    if (!isPro()) { spendCredits(1); setCredits(getCredits()) }
    takeOpening()
    setSelected(charFor(seed, c))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charFor])
  const joinGroup = useCallback((j: Join) => {
    if (CONTINENTS[j.c]?.n === "the arena") { window.location.href = "/airraw/chess"; return }   // games room → the board
    if (j.n === 1) { openVoice(j.c, j.seed); return }   // a 1:1 join IS the call
    if (!gateAir()) return
    if (j.adult && !verifiedRef.current) { setPendingJoin(j); return }
    if (!isPro()) { spendCredits(1); setCredits(getCredits()) }
    takeOpening()
    setGroup({ seed: j.seed, f: j.f, count: j.n })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openVoice])
  const confirm18 = () => {
    setVerified(true); try { localStorage.setItem("airroom_18", "1") } catch { /* */ }
    setNearDeep(false); nearDeepRef.current = false
    const p = pending, pj = pendingJoin; setPending(null); setPendingJoin(null)
    if ((p || pj) && !isPro()) { spendCredits(1); setCredits(getCredits()) }
    if (p) { takeOpening(); setSelected(p) } else if (pj) { takeOpening(); setGroup({ seed: pj.seed, f: pj.f, count: pj.n }) }
  }
  // ── the engine ──
  useEffect(() => {
    const cv = cvRef.current; if (!cv) return
    const ctx = cv.getContext("2d"); if (!ctx) return
    const DPR = Math.min(2, window.devicePixelRatio || 1)
    const FF = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif"
    const cam = { x: 0.5, y: 0.5, s: 0.85 }, tgt = { x: 0.5, y: 0.5, s: 0.85 }
    let vel = { x: 0, y: 0, s: 0 }   // spring velocity for fluffy drag feel
    const imgs = new Map<string, HTMLImageElement | null>()
    const stars = Array.from({ length: 160 }, (_, s) => ({ x: rnd(s * 3 + 1), y: rnd(s * 7 + 2), r: rnd(s * 5) * 1.1 + 0.2, ph: rnd(s) * 6.28 }))
    let t = 0, raf = 0, audioStarted = false, frameN = 0
    let pickedNode: { c: number; x: number; y: number; seed: number } | null = null, candId = -1, candAt = 0, spokenId = -1
    // ARM-THEN-ENTER: a first tap on the network arms a room (ring + glide toward
    // it); only a second tap on the same room enters. Exploring taps never open
    // anything by accident — moving around stays completely free.
    let armedRh = 0, armedAt = -999
    let lastMoveT = -999   // updated on any pan/zoom; ring only draws after user settles
    // Screen rects of the world-balls this frame, so a tap at orbit can drop you in.
    const contHit: { c: number; x: number; y: number; half: number }[] = []
    let airEnd = 0, lastAirTrig = 0   // AIR pulse: lights your best matches for a few seconds
    let lastHud = ""

    const resize = () => { const r = cv.getBoundingClientRect(); cv.width = Math.max(1, r.width * DPR); cv.height = Math.max(1, r.height * DPR) }
    resize(); window.addEventListener("resize", resize)
    const vm = () => Math.min(cv.width, cv.height)
    const w2s = (wx: number, wy: number): [number, number] => { const m = vm(); return [(wx - cam.x) * cam.s * m + cv.width / 2, (wy - cam.y) * cam.s * m + cv.height / 2] }
    const zoomAt = (px: number, py: number, f: number) => {
      const m = vm()
      const wx = (px - cv.width / 2) / (tgt.s * m) + tgt.x, wy = (py - cv.height / 2) / (tgt.s * m) + tgt.y
      tgt.s = Math.max(0.6, Math.min(190, tgt.s * f))
      tgt.x = wx - (px - cv.width / 2) / (tgt.s * m); tgt.y = wy - (py - cv.height / 2) / (tgt.s * m)
    }
    zoomFnRef.current = (f: number) => zoomAt(cv.width / 2, cv.height / 2, f)
    const startAudio = () => { audioStarted = true }   // unlocks the proximity voice; no background ambience
    // begin the descent: reveal the blocks and drift inward so the world opens up
    const markStarted = () => { if (!startedRef.current) { startedRef.current = true; setStarted(true); tgt.s = Math.max(tgt.s, 1.6) } }
    startFnRef.current = markStarted

    const onWheel = (e: WheelEvent) => { e.preventDefault(); startAudio(); markStarted(); lastMoveT = t; const r = cv.getBoundingClientRect(); zoomAt((e.clientX - r.left) * DPR, (e.clientY - r.top) * DPR, e.deltaY < 0 ? 1.16 : 1 / 1.16) }
    cv.addEventListener("wheel", onWheel, { passive: false })

    const pts = new Map<number, { x: number; y: number }>()
    let drag: { x: number; y: number; cx: number; cy: number } | null = null, moved = 0, pinchD = 0
    const onDown = (e: PointerEvent) => {
      startAudio(); markStarted(); pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pts.size === 1) { drag = { x: e.clientX, y: e.clientY, cx: tgt.x, cy: tgt.y }; moved = 0 }
      else if (pts.size === 2) { const p = [...pts.values()]; pinchD = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); drag = null }
      try { cv.setPointerCapture(e.pointerId) } catch { /* */ }
    }
    const onMove = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pts.size === 2) {
        const p = [...pts.values()], d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)
        if (pinchD > 0) { lastMoveT = t; const r = cv.getBoundingClientRect(); zoomAt(((p[0].x + p[1].x) / 2 - r.left) * DPR, ((p[0].y + p[1].y) / 2 - r.top) * DPR, d / pinchD) }
        pinchD = d; return
      }
      if (!drag) return
      const m = vm(), ddx = e.clientX - drag.x, ddy = e.clientY - drag.y; moved += Math.abs(ddx) + Math.abs(ddy)
      lastMoveT = t
      tgt.x = drag.cx - ddx * DPR / (tgt.s * m); tgt.y = drag.cy - ddy * DPR / (tgt.s * m)
    }
    const onUp = (e: PointerEvent) => {
      const wasDrag = drag && moved > 12   // finger jitter on a phone is not a tap
      pts.delete(e.pointerId); if (pts.size < 2) pinchD = 0; if (pts.size === 0) drag = null
      if (wasDrag || pts.size !== 0) return
      const r = cv.getBoundingClientRect()
      const px = (e.clientX - r.left) * DPR, py = (e.clientY - r.top) * DPR
      // Tap directly ON a face up close → a short push into them, then the call.
      // HIT-TESTED: the tap must actually land on that person — a tap on empty
      // space is just a tap, so you can browse without falling into calls.
      if (pickedNode && cam.s > 24) {
        const nps = w2s(pickedNode.x, pickedNode.y)
        if (Math.hypot(nps[0] - px, nps[1] - py) < Math.max(40 * DPR, cam.s * vm() * 0.007)) {
          const n = pickedNode
          zoomAt(px, py, 1.7); lastMoveT = t
          setTimeout(() => openVoice(n.c, n.seed), 550)
          return
        }
      }
      // Tap a world-ball at orbit → DIVE onto that world's ROOM NETWORK: you land
      // among its rooms (each with its own topic and people) and pick one. The
      // descent is the navigation — no interstitials anywhere on the way down.
      if (cam.s < 4.4 && contHit.length) {
        for (const h of contHit) if (Math.abs(px - h.x) <= h.half && Math.abs(py - h.y) <= h.half) {
          const m = vm()
          tgt.x = (h.x - cv.width / 2) / (cam.s * m) + cam.x
          tgt.y = (h.y - cv.height / 2) / (cam.s * m) + cam.y
          tgt.s = Math.max(6.5, Math.min(8.5, tgt.s * 4.5))
          lastMoveT = t
          return
        }
      }
      // On the network: FIRST tap arms the room under your finger — it glides to
      // center, gets a ring and a "tap again to enter" hint. SECOND tap on the same
      // room enters it. Exploring never opens anything by accident.
      if (cam.s >= 4.4) {
        const m = vm()
        const wx = (px - cv.width / 2) / (cam.s * m) + cam.x, wy = (py - cv.height / 2) / (cam.s * m) + cam.y
        const gx = Math.floor(wx / RCELL), gy = Math.floor(wy / RCELL)
        const rh = ihash(gx, gy)
        const rx = (gx + 0.5) * RCELL + (ifrac(rh) - 0.5) * RCELL * 0.45
        const ry = (gy + 0.5) * RCELL + (ifrac(ihash(gx + 7, gy * 3 + 1)) - 0.5) * RCELL * 0.45
        if (armedRh === rh && t - armedAt < 6) {
          armedRh = 0
          let bc2 = 0, bd2 = 1e9
          for (let k = 0; k < conCentres.length; k++) { const ddx = conCentres[k].x - rx, ddy = conCentres[k].y - ry, d = ddx * ddx + ddy * ddy; if (d < bd2) { bd2 = d; bc2 = k } }
          const co2 = CONTINENTS[bc2]
          zoomAt(px, py, 1.3); lastMoveT = t
          setTimeout(() => joinGroup({ n: joinSize(cam.s, rh), seed: rh, f: co2.f, adult: !!co2.adult, c: bc2 }), 450)
          return
        }
        armedRh = rh; armedAt = t
        tgt.x = rx; tgt.y = ry   // glide the armed room under your thumb
        tgt.s = Math.min(190, tgt.s * 1.12)
        lastMoveT = t
        return
      }
    }
    cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointermove", onMove)
    cv.addEventListener("pointerup", onUp); cv.addEventListener("pointercancel", onUp)

    // Each face shows the cheap fallback instantly, then swaps to its live, diverse,
    // generated photo once it resolves (generated-once, cached forever server-side).
    // Key by cell seed (fh), not character name — name pool is ~122, planet has thousands
    // of cells so many cells share a name → same face. Seed is unique per grid position.
    const faceFor = (fh: number, ch: { host: string; gender?: string }): HTMLImageElement | null => {
      const key = String(fh)
      if (imgs.has(key)) return imgs.get(key) || null
      if (imgs.size > 320) return null
      imgs.set(key, null)
      const setImg = (url: string) => { const im = new Image(); im.onload = () => imgs.set(key, im); im.src = url }
      const cached = cachedFace({ name: ch.host, gender: ch.gender, seed: key })
      if (cached) { setImg(cached) }
      else {
        setImg(imageFor({ name: ch.host }))   // monogram fallback while portrait generates
        faceUrl({ name: ch.host, gender: ch.gender, seed: key }).then((u) => { if (u) setImg(u) })
      }
      return null
    }
    // A room card opens into individual faces only past this screen size. Raised
    // from 168 so the ROOM NETWORK (topic cards + face previews + threads) is a real
    // browsable layer of the world (zoom ~4.4→12), not a sliver you blow through —
    // the old value flipped to the anonymous dot-field almost immediately, which is
    // what made the map feel like identical robotic bubbles.
    const ROOM_OPEN = 420 * DPR
    const rrect = (x: number, y: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath() }

    const loop = () => {
      raf = requestAnimationFrame(loop); t += 0.016; frameN++
      if (airTrig.current !== lastAirTrig) { lastAirTrig = airTrig.current; airEnd = t + 4.5 }
      const airOn = t < airEnd
      const SPRING = 0.13, DAMP = 0.73
      vel.x = (vel.x + (tgt.x - cam.x) * SPRING) * DAMP
      vel.y = (vel.y + (tgt.y - cam.y) * SPRING) * DAMP
      vel.s = (vel.s + (tgt.s - cam.s) * SPRING) * DAMP
      cam.x += vel.x; cam.y += vel.y; cam.s = Math.max(0.6, cam.s + vel.s)
      const W = cv.width, H = cv.height
      ctx.fillStyle = "#04050b"; ctx.fillRect(0, 0, W, H)
      for (const st of stars) { let sx = (st.x * W + cam.x * -12) % W; if (sx < 0) sx += W; let sy = (st.y * H + cam.y * -12) % H; if (sy < 0) sy += H; ctx.globalAlpha = (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.3 + st.ph))) * 0.7; ctx.fillStyle = "#cdd9e3"; ctx.beginPath(); ctx.arc(sx, sy, st.r * DPR, 0, 6.283); ctx.fill() }
      ctx.globalAlpha = 1
      // The SKY itself is the big box now — no drawn container. The 8 worlds float
      // and drift inside it. Until you begin, it's just stars + the write box.
      const begun = startedRef.current
      const roomHalf = 0.044 * cam.s * vm()
      const facesVisible = roomHalf * 2 >= ROOM_OPEN
      // ── BLOCKS: continents are the bigger blocks; rooms are the blocks; the
      // users only appear once you're INSIDE a room block. ──
      if (begun && cam.s < 10) {
        contHit.length = 0
        // the "hovered" world = whichever sits nearest the centre of your view — only it
        // wears a crisp frame; the rest are soft glows, so the sky reads as nebulae not boxes.
        const wdrift = (c: number): [number, number] => [
          Math.sin(t * 0.27 + c * 1.7) * 0.024 + Math.sin(t * 0.11 + c) * 0.008,
          Math.cos(t * 0.21 + c * 2.3) * 0.022 + Math.cos(t * 0.09 + c * 1.4) * 0.008,
        ]
        let nearestC = -1, nearestCD = Infinity
        for (let c = 0; c < CONTINENTS.length; c++) { const [ax, ay] = wdrift(c); const p = w2s(conCentres[c].x + ax, conCentres[c].y + ay); const d = Math.hypot(p[0] - W / 2, p[1] - H / 2); if (d < nearestCD) { nearestCD = d; nearestC = c } }
        for (let c = 0; c < CONTINENTS.length; c++) {
          const co = CONTINENTS[c]
          const [dx, dy] = wdrift(c)
          const cp = w2s(conCentres[c].x + dx, conCentres[c].y + dy), ch = 0.12 * cam.s * vm()
          if (cp[0] + ch < 0 || cp[0] - ch > W || cp[1] + ch < 0 || cp[1] - ch > H) continue
          contHit.push({ c, x: cp[0], y: cp[1], half: ch })
          const active = c === nearestC
          const rad = Math.min(ch * 0.34, 22 * DPR)
          const breathe = 0.5 + 0.5 * Math.sin(t * 0.85 + c * 1.3)   // a slow, alive pulse
          // a world is a glowing place, not a wireframe: soft bloom + a core that
          // fades to the sky, so the block reads as somewhere with depth inside.
          // Bokeh: extra radius at orbit that fades away as you zoom in — each blob
          // gets a stable size jitter so they're not all the same (like real bokeh).
          const bokeBoost = Math.max(0, Math.min(W, H) * 0.28 * Math.max(0, (2.5 - cam.s) / 2.0))
          const bokeR = ch + bokeBoost * (0.82 + ifrac(ihash(c, 53)) * 0.36)
          // Outer soft glow — the big circular bokeh orb (circle, not box)
          const bokeGrd = ctx.createRadialGradient(cp[0], cp[1], bokeR * 0.04, cp[0], cp[1], bokeR)
          bokeGrd.addColorStop(0,    `hsla(${co.h},78%,74%,${0.72 + 0.18 * breathe})`)
          bokeGrd.addColorStop(0.35, `hsla(${co.h},70%,62%,${0.38 + 0.12 * breathe})`)
          bokeGrd.addColorStop(0.68, `hsla(${co.h},62%,50%,${0.12 + 0.05 * breathe})`)
          bokeGrd.addColorStop(1,    `hsla(${co.h},55%,42%,0)`)
          ctx.fillStyle = bokeGrd
          ctx.beginPath(); ctx.arc(cp[0], cp[1], bokeR, 0, 6.283); ctx.fill()
          // Inner core — tighter glow on top for the bright centre bokeh feel
          ctx.save()
          ctx.shadowColor = `hsla(${co.h},84%,68%,${0.62 + 0.28 * breathe})`
          ctx.shadowBlur = (22 + 16 * breathe) * DPR
          const coreGrd = ctx.createRadialGradient(cp[0], cp[1] - ch * 0.12, ch * 0.06, cp[0], cp[1], ch)
          coreGrd.addColorStop(0,    `hsla(${co.h},76%,68%,${0.62 + 0.16 * breathe})`)
          coreGrd.addColorStop(0.60, `hsla(${co.h},66%,54%,${0.24 + 0.08 * breathe})`)
          coreGrd.addColorStop(1,    `hsla(${co.h},58%,44%,0)`)
          ctx.fillStyle = coreGrd
          ctx.beginPath(); ctx.arc(cp[0], cp[1], ch, 0, 6.283); ctx.fill()
          ctx.restore()
          // Crisp ring: only shows on the centred world, only once zoomed in enough
          if (active && cam.s > 1.8) {
            const ringA = Math.min(1, (cam.s - 1.8) / 1.4) * (0.48 + 0.28 * breathe)
            ctx.strokeStyle = `hsla(${co.h},82%,80%,${ringA})`
            ctx.lineWidth = 1.6 * DPR
            ctx.beginPath(); ctx.arc(cp[0], cp[1], ch * 0.94, 0, 6.283); ctx.stroke()
          }
          // people inside — animated orbs that read as a crowd, not a label
          const pn = 16
          for (let i = 0; i < pn; i++) {
            const ph = ihash(c * 137 + i, i * 29 + c * 11)
            const baseA = (i / pn) * 6.283 + c * 0.9
            const driftPh = ifrac(ihash(ph, 3)) * 6.283
            const radFrac = 0.16 + 0.56 * ifrac(ph)
            const rr = ch * radFrac
            const spd = 0.10 + ifrac(ihash(ph, 7)) * 0.16
            const vx = cp[0] + Math.cos(baseA + t * spd + driftPh) * rr
            const vy = cp[1] + Math.sin(baseA * 1.27 + t * (spd * 0.85) + driftPh * 0.7) * rr * 0.86
            const orbR = (3.2 + ifrac(ihash(ph, 17)) * 5.2) * DPR
            const phue = co.h + (ifrac(ihash(ph, 5)) * 38 - 19)
            const pulse = 0.52 + 0.48 * Math.sin(t * (1.5 + ifrac(ihash(ph, 13)) * 1.3) + i * 0.85 + c)
            ctx.fillStyle = `hsla(${phue},80%,72%,${pulse})`
            ctx.beginPath(); ctx.arc(vx, vy, orbR, 0, 6.283); ctx.fill()
          }
          // world label: subtle hint at the bottom of the blob, not a title card
          if (cam.s < 8) {
            ctx.textAlign = "center"
            if (co.adult) { ctx.fillStyle = `hsla(${co.h},80%,76%,.72)`; ctx.font = `700 ${8.5 * DPR}px ${FF}`; ctx.fillText("18+", cp[0], cp[1] - ch * 0.58) }
            ctx.fillStyle = `hsla(${co.h},52%,88%,.42)`; ctx.font = `500 ${10.5 * DPR}px ${FF}`
            ctx.fillText(co.label, cp[0], cp[1] + ch * 0.72)
            ctx.textAlign = "left"
          }
        }
      }
      // ── procedural rooms + faces for the viewport — the world is infinite ──
      const contOf = (x: number, y: number) => { let bc = 0, bd = 1e9; for (let k = 0; k < conCentres.length; k++) { const dx = conCentres[k].x - x, dy = conCentres[k].y - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; bc = k } } return bc }
      let nearestRoom: { c: number; x: number; y: number; seed: number; count: number; adult: boolean } | null = null, nrBest = 1e9
      let best = 1e9, act: { c: number; x: number; y: number; seed: number } | null = null
      let actChar: Cluster | null = null
      if (cam.s > 4.4) {
        const m2 = cam.s * vm(), hw = (W / 2) / m2, hh = (H / 2) / m2
        let gx0 = Math.floor((cam.x - hw) / RCELL) - 1, gx1 = Math.ceil((cam.x + hw) / RCELL) + 1
        let gy0 = Math.floor((cam.y - hh) / RCELL) - 1, gy1 = Math.ceil((cam.y + hh) / RCELL) + 1
        if ((gx1 - gx0) * (gy1 - gy0) > 1400) { gx1 = gx0 + 36; gy1 = gy0 + 36 }   // safety cap
        for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
          const rh = ihash(gx, gy)
          const rx = (gx + 0.5) * RCELL + (ifrac(rh) - 0.5) * RCELL * 0.45
          const ry = (gy + 0.5) * RCELL + (ifrac(ihash(gx + 7, gy * 3 + 1)) - 0.5) * RCELL * 0.45
          const c = contOf(rx, ry), co = CONTINENTS[c], s = w2s(rx, ry)
          const dc = Math.hypot(s[0] - W / 2, s[1] - H / 2), count = 5 + (rh % 60)
          if (dc < nrBest) { nrBest = dc; nearestRoom = { c, x: rx, y: ry, seed: rh, count, adult: !!co.adult } }
          if (s[0] + roomHalf < 0 || s[0] - roomHalf > W || s[1] + roomHalf < 0 || s[1] - roomHalf > H) continue
          const locked = co.adult && !verifiedRef.current
          if (facesVisible) {
            ctx.strokeStyle = `hsla(${co.h},60%,62%,0.14)`; ctx.lineWidth = DPR; rrect(s[0] - roomHalf, s[1] - roomHalf, roomHalf * 2, roomHalf * 2, 16 * DPR); ctx.stroke()
            // armed at depth too — same second-tap contract everywhere on the surface
            if (rh === armedRh && t - armedAt < 6) {
              const pulse = 0.72 + 0.28 * Math.sin(t * 5)
              ctx.strokeStyle = `hsla(${co.h},88%,74%,${pulse})`; ctx.lineWidth = 2.5 * DPR
              rrect(s[0] - roomHalf, s[1] - roomHalf, roomHalf * 2, roomHalf * 2, 16 * DPR); ctx.stroke()
              ctx.fillStyle = `hsla(${co.h},70%,88%,.9)`; ctx.textAlign = "center"
              ctx.font = `500 ${10.5 * DPR}px ${FF}`
              ctx.fillText("tap again to enter", s[0], s[1] - roomHalf - 8 * DPR)
              ctx.textAlign = "left"
            }
            const fn = 9 + (rh % 7)
            // Grid-slot the faces instead of pure random jitter: random points in a box this
            // small ALWAYS clump (every room overlapped). Give each face its own cell + a small
            // organic offset so they read as distinct, tappable people. fh is derived exactly as
            // before, so charFor/faceFor caching is unchanged — only the x/y placement moves.
            const cols = Math.ceil(Math.sqrt(fn)), rows = Math.ceil(fn / cols)
            const BOX = RCELL * 0.82, cw = BOX / cols, chh = BOX / rows
            for (let i = 0; i < fn; i++) {
              const fh = ihash(gx * 131 + i + 3, gy * 197 + i * 7 + 5)
              const cxi = i % cols, cyi = Math.floor(i / cols)
              const fx = rx + ((cxi + 0.5) * cw - BOX / 2) + (ifrac(fh) - 0.5) * cw * 0.3
              const fy = ry + ((cyi + 0.5) * chh - BOX / 2) + (ifrac(ihash(fh, i + 11)) - 0.5) * chh * 0.3
              const fs = w2s(fx, fy)
              if (fs[0] < -40 || fs[1] < -40 || fs[0] > W + 40 || fs[1] > H + 40) continue
              const r = Math.max(2.5, Math.min(m2 * 0.0058, Math.min(cw, chh) * m2 * 0.50)), fdc = Math.hypot(fs[0] - W / 2, fs[1] - H / 2)
              if (r > 2.2 && fdc < best) { best = fdc; act = { c, x: fx, y: fy, seed: fh } }
              const fhue = co.h + (ifrac(fh) * 26 - 13)
              const ball = () => { ctx.beginPath(); ctx.arc(fs[0], fs[1], r, 0, 6.283) }   // faces are round balls — no name labels
              if (r > 17 && !locked) {
                const ch = charFor(fh, c), im = faceFor(fh, ch)
                if (im) { ctx.save(); ball(); ctx.clip(); ctx.drawImage(im, fs[0] - r, fs[1] - r, r * 2, r * 2); ctx.restore(); ctx.strokeStyle = `hsla(${fhue},70%,62%,.5)`; ctx.lineWidth = 1.5 * DPR; ball(); ctx.stroke() }
                else { ctx.fillStyle = `hsl(${fhue},70%,60%)`; ball(); ctx.fill() }
                // AIR: a gold pulse rings your best matches
                if (airOn && ifrac(ihash(fh, 99)) > 0.82) {
                  const g = 4 * DPR, pulse = 0.5 + 0.5 * Math.sin(t * 4.5 + fh)
                  ctx.strokeStyle = `rgba(255,206,122,${0.5 + 0.45 * pulse})`; ctx.lineWidth = 3 * DPR
                  ctx.beginPath(); ctx.arc(fs[0], fs[1], r + g, 0, 6.283); ctx.stroke()
                }
              } else { ctx.fillStyle = `hsl(${fhue},72%,62%)`; ball(); ctx.fill() }
            }
          } else {
            // ROOM NETWORK — each cell is a distinct place: its own topic, a peek at
            // its people, and faint threads to its neighbours. This replaces the old
            // identical "N here" bubbles that made the map feel robotic.
            if (roomHalf * 2 > 30) {
              const nx = w2s((gx + 1.5) * RCELL + (ifrac(ihash(gx + 1, gy)) - 0.5) * RCELL * 0.45, (gy + 0.5) * RCELL)
              const ny = w2s((gx + 0.5) * RCELL, (gy + 1.5) * RCELL + (ifrac(ihash(gx + 7, (gy + 1) * 3 + 1)) - 0.5) * RCELL * 0.45)
              ctx.strokeStyle = `hsla(${co.h},50%,62%,.09)`; ctx.lineWidth = DPR
              ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(nx[0], nx[1]); ctx.moveTo(s[0], s[1]); ctx.lineTo(ny[0], ny[1]); ctx.stroke()
            }
            ctx.fillStyle = `hsla(${co.h},55%,${cam.s < 8 ? 24 : 32}%,${cam.s < 8 ? 0.20 : 0.36})`
            rrect(s[0] - roomHalf, s[1] - roomHalf, roomHalf * 2, roomHalf * 2, Math.min(roomHalf * 0.28, 14 * DPR)); ctx.fill()
            ctx.strokeStyle = `hsla(${co.h},66%,64%,0.45)`; ctx.lineWidth = DPR; ctx.stroke()
            // the ARMED room — first tap ringed it; the hint asks for the second
            if (rh === armedRh && t - armedAt < 6) {
              const pulse = 0.72 + 0.28 * Math.sin(t * 5)
              ctx.strokeStyle = `hsla(${co.h},88%,74%,${pulse})`; ctx.lineWidth = 2.5 * DPR
              rrect(s[0] - roomHalf, s[1] - roomHalf, roomHalf * 2, roomHalf * 2, Math.min(roomHalf * 0.28, 14 * DPR)); ctx.stroke()
              ctx.fillStyle = `hsla(${co.h},70%,88%,.9)`; ctx.textAlign = "center"
              ctx.font = `500 ${10.5 * DPR}px ${FF}`
              ctx.fillText("tap again to enter", s[0], s[1] + roomHalf * 0.62)
              ctx.textAlign = "left"
            }
            const big = roomHalf * 2 > 76
            // a peek at who's inside — three real faces (same seed derivation as the
            // deep-zoom view, so they ARE the people you'll find in there)
            if (big && !locked) {
              const fr = Math.min(roomHalf * 0.24, 22 * DPR)
              for (let i = 0; i < 3; i++) {
                const fh = ihash(gx * 131 + i + 3, gy * 197 + i * 7 + 5)
                const fx0 = s[0] + (i - 1) * fr * 2.3, fy0 = s[1] - roomHalf * 0.34
                const im = faceFor(fh, charFor(fh, c))
                ctx.save(); ctx.beginPath(); ctx.arc(fx0, fy0, fr, 0, 6.283); ctx.clip()
                if (im) ctx.drawImage(im, fx0 - fr, fy0 - fr, fr * 2, fr * 2)
                else { ctx.fillStyle = `hsl(${co.h + i * 11},68%,58%)`; ctx.fillRect(fx0 - fr, fy0 - fr, fr * 2, fr * 2) }
                ctx.restore()
                ctx.strokeStyle = `hsla(${co.h},70%,68%,.55)`; ctx.lineWidth = 1.2 * DPR
                ctx.beginPath(); ctx.arc(fx0, fy0, fr, 0, 6.283); ctx.stroke()
              }
            }
            if (roomHalf * 2 > 48) {
              const topic = locked ? "the deep · 18+" : TOPICS[c][rh % TOPICS[c].length]
              ctx.textAlign = "center"
              ctx.fillStyle = `hsla(${co.h},60%,88%,.95)`
              ctx.font = `600 ${Math.min(13.5, roomHalf * 0.21) * DPR}px ${FF}`
              ctx.fillText(topic, s[0], s[1] + (big ? roomHalf * 0.3 : 4 * DPR))
              if (big && !locked) {
                ctx.fillStyle = `hsla(${co.h},45%,76%,.6)`
                ctx.font = `500 ${Math.min(10.5, roomHalf * 0.15) * DPR}px ${FF}`
                ctx.fillText(`${count} here`, s[0], s[1] + roomHalf * 0.3 + Math.min(15, roomHalf * 0.24) * DPR)
              }
              ctx.textAlign = "left"
            }
          }
        }
      }
      pickedNode = act
      if (act) {
        actChar = charFor(act.seed, act.c)
        const s = w2s(act.x, act.y), hr = Math.max(8, cam.s * vm() * 0.0042 + 6 * DPR)
        // Only show selection ring when settled (>0.4s since last pan/zoom) — suppresses
        // the constant flashing ring as it jumps face-to-face during active movement.
        if (t - lastMoveT > 0.4) {
          ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 1.5 * DPR
          rrect(s[0] - hr, s[1] - hr, hr * 2, hr * 2, hr * 0.3); ctx.stroke()
        }
        const id = act.seed
        if (id !== candId) { candId = id; candAt = t }
        else if (audioStarted && !inCallRef.current && id !== spokenId && t - candAt > 0.45 && cam.s > 14) { spokenId = id; speak(actChar) }
      }
      const baseRm = act || nearestRoom
      const bc = baseRm ? baseRm.c : 0, co = CONTINENTS[bc], loc = baseRm ? baseRm.seed : 0
      // Approaching the deep unverified → raise the age screen before they arrive.
      if (cam.s > 8.5 && co.adult && !verifiedRef.current) { if (!nearDeepRef.current) { nearDeepRef.current = true; setNearDeep(true) } }
      else if (cam.s < 6 && nearDeepRef.current) { nearDeepRef.current = false; setNearDeep(false) }
      const join: Join | null = (baseRm && cam.s > 3.2) ? { n: joinSize(cam.s, loc), seed: loc, f: co.f, adult: !!co.adult, c: bc } : null
      // crumb/altl are kept as internal state only (no longer painted as HUD chrome);
      // the ONE line we still surface is the live overhear of a specific nearby voice —
      // a real teaser of a real line, not atmospheric flavor.
      let crumb: string, altl: string, hear = ""
      if (cam.s < 3.2) { crumb = "the whole now"; altl = "orbit" }
      else if (cam.s < 11) { crumb = co.v; altl = "region" }
      else if (!facesVisible) { crumb = co.v; altl = "block" }
      else { crumb = co.v; altl = "floor"; if (actChar) hear = `${actChar.host} · “${actChar.lines[0]}”` }
      const sig = crumb + "|" + altl + "|" + hear + "|" + (join ? `${join.n}:${join.seed}` : "0")
      if (sig !== lastHud) { lastHud = sig; setHud({ crumb, alt: altl, hearing: hear, join }) }
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf); window.removeEventListener("resize", resize)
      cv.removeEventListener("wheel", onWheel); cv.removeEventListener("pointerdown", onDown); cv.removeEventListener("pointermove", onMove); cv.removeEventListener("pointerup", onUp); cv.removeEventListener("pointercancel", onUp)
      speakTok.current++
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conCentres, charFor, speak, openVoice, joinGroup])

  return (
    <div className="airraw-ui" style={{ position: "fixed", inset: 0, background: "#04050b", overflow: "hidden", touchAction: "none" }}>
      {/* THE FEEL — one shared interaction layer for every surface inside the planet
          (rooms, calls, sheets are all children of this node). Every button gets the
          same press physics and eased state changes; every full-screen surface rises
          in instead of popping. This is what makes it read as one piece of high-end
          hardware instead of a pile of web buttons. */}
      <style>{`
        .airraw-ui button{transition:transform .16s cubic-bezier(.2,.8,.3,1),opacity .22s ease,background .28s ease,box-shadow .3s ease,border-color .28s ease,color .22s ease}
        .airraw-ui button:active{transform:scale(.94)}
        .airraw-ui input{transition:border-color .25s ease,background .25s ease,box-shadow .3s ease}
        .airraw-ui input:focus{box-shadow:0 0 0 3px rgba(199,179,255,.12)}
        @keyframes airrise{from{opacity:0;transform:translateY(18px) scale(.985)}to{opacity:1;transform:none}}
        @keyframes airfade{from{opacity:0}to{opacity:1}}
        @keyframes airmsg{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .air-rise{animation:airrise .42s cubic-bezier(.2,.8,.3,1) both}
        .air-fade{animation:airfade .3s ease both}
        .air-msg{animation:airmsg .3s cubic-bezier(.2,.8,.3,1) both}
        @media (prefers-reduced-motion: reduce){.air-rise,.air-fade,.air-msg{animation:none}.airraw-ui button{transition:none}}
      `}</style>
      <canvas ref={cvRef} style={{ display: "block", width: "100%", height: "100%", cursor: "grab" }} />

      {/* you, on the floor — avatar + a peek at your credits; opens the profile.
          Hidden while inside a room/call: rooms own their whole screen, and this
          was floating OVER their header (avatar colliding with the room title). */}
      {profile && !intro && !selected && !group && (
        <button onClick={() => setShowProfile(true)} aria-label="your profile" style={{ position: "absolute", top: "calc(env(safe-area-inset-top) + 12px)", left: "max(16px, env(safe-area-inset-left))", zIndex: 26, width: 40, height: 40, borderRadius: "50%", border: "none", background: `radial-gradient(120% 120% at 30% 25%, hsl(${profile.hue},78%,64%), hsl(${(profile.hue + 40) % 360},70%,40%))`, color: "rgba(255,255,255,.96)", fontSize: 18, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: `0 6px 18px -6px hsla(${profile.hue},80%,50%,.7)`, WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
          {profile.glyph}
          <span style={{ position: "absolute", bottom: -4, right: -4, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 9, background: "#0a0c12", border: `.5px solid ${pro ? "rgba(255,217,138,.55)" : "rgba(127,214,192,.5)"}`, color: pro ? "#ffd98a" : "#7fd6c0", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>{pro ? "∞" : credits}</span>
        </button>
      )}

      {/* the planet speaks your language — pick it any time ON THE SURFACE. Hidden
          inside rooms/calls: it floated over their top bars (the header collision). */}
      <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top) + 12px)", left: "50%", transform: "translateX(-50%)", zIndex: 25, display: (intro || selected || group) ? "none" : "flex", alignItems: "center", gap: 5, background: "rgba(4,5,11,.55)", border: ".5px solid rgba(255,255,255,.14)", borderRadius: 999, padding: "4px 6px 4px 11px", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
        <span style={{ fontSize: 12 }} aria-hidden>🌐</span>
        <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="language" style={{ appearance: "none", WebkitAppearance: "none", background: "transparent", color: "#cfe0ee", border: "none", fontSize: 12.5, fontFamily: "inherit", padding: "2px 2px 2px 4px", cursor: "pointer", outline: "none" }}>
          {LANGUAGES.map((l) => <option key={l.name} value={l.name} style={{ color: "#06121e" }}>{l.name}</option>)}
        </select>
        <span style={{ fontSize: 9, color: "#8aa0b3", marginRight: 4 }} aria-hidden>▾</span>
      </div>

      {/* Cold-open: a line at a time drifts up the sky, then it opens to the write box. */}
      {!started && intro && (
        <div onClick={skipIntro} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 28px", zIndex: 22, cursor: "pointer", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
          <style>{`@keyframes introScroll{0%{opacity:0;transform:translateY(44px)}26%{opacity:1;transform:translateY(5px)}74%{opacity:1;transform:translateY(-5px)}100%{opacity:0;transform:translateY(-44px)}}@keyframes skyOpen{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@keyframes skipFade{0%,70%{opacity:0}100%{opacity:.7}}`}</style>
          <div style={{ position: "relative", width: "100%", maxWidth: 520, height: "1.4em", fontSize: "clamp(24px, 7vw, 40px)" }}>
            {INTRO_LINES.map((ln, i) => (
              <div key={i} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontWeight: 500, lineHeight: 1.2, color: "#eef4f8", letterSpacing: 0.2, textShadow: "0 2px 34px rgba(127,214,192,.28)", opacity: 0, animation: `introScroll ${INTRO_LINE_MS}ms ease-in-out ${i * INTRO_LINE_MS}ms both` }}>{ln}</div>
            ))}
          </div>
          <div style={{ position: "absolute", bottom: "calc(env(safe-area-inset-bottom) + 30px)", left: 0, right: 0, textAlign: "center", fontSize: 12, color: "#5f7080", letterSpacing: 1, opacity: 0, animation: "skipFade 2.4s ease both" }}>tap to skip</div>
        </div>
      )}

      {/* The very first view: raw. The sky is already live behind this. The name, one
          line that says what this IS (ad traffic decides in seconds), and one way in. */}
      {!started && !intro && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom))", pointerEvents: "none", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
          <style>{`@keyframes livepulse{0%,100%{opacity:.45}50%{opacity:1}}`}</style>
          <div style={{ pointerEvents: "auto", textAlign: "center", color: "#eef4f8", animation: "skyOpen .8s ease both" }}>
            <div style={{ fontSize: 12, letterSpacing: 4, color: "#7fd6c0", textTransform: "uppercase" }}>airraw</div>
            <div style={{ fontSize: "clamp(26px, 8vw, 38px)", fontWeight: 500, lineHeight: 1.15, margin: "13px 0 10px" }}>it&apos;s the now.</div>
            {/* the value prop — an ad visitor has ~3s to learn what this IS */}
            <div style={{ fontSize: 14.5, lineHeight: 1.55, color: "rgba(238,244,248,.72)", maxWidth: 300, margin: "0 auto 20px" }}>
              live voice calls with a sky full of characters. tap a face, talk out loud — it answers in a real voice, in your language. 18+.
            </div>
            {liveCount > 0 && <div style={{ fontSize: 12, color: "rgba(127,214,192,.55)", letterSpacing: 0.5, marginBottom: 20 }}><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#7fd6c0", marginRight: 6, verticalAlign: "middle", animation: "livepulse 2.6s ease-in-out infinite" }} />{liveCount} voices live now</div>}
            {/* water → fire gradient — no label, the color teaches itself */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 22 }}>
              <span style={{ fontSize: 14, opacity: 0.55 }}>💧</span>
              <div style={{ width: 120, height: 3, borderRadius: 2, background: "linear-gradient(90deg, hsl(202,68%,60%), hsl(168,62%,56%), hsl(132,60%,52%), hsl(58,72%,58%), hsl(26,82%,58%), hsl(10,88%,56%), hsl(2,88%,52%))", opacity: 0.45 }} />
              <span style={{ fontSize: 14, opacity: 0.55 }}>🔥</span>
            </div>
            <button onClick={() => { openingRef.current = ""; startFnRef.current() }} style={{ fontSize: 16, fontWeight: 600, minHeight: 56, color: "#06121e", background: "#7fd6c0", border: "none", borderRadius: 16, padding: "0 32px", cursor: "pointer", boxShadow: "0 12px 32px -8px rgba(127,214,192,.6)", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>tap to fall in →</button>
            <div style={{ fontSize: 11.5, color: "rgba(127,214,192,.6)", letterSpacing: 0.5, marginTop: 12 }}>free to start · no signup</div>
          </div>
          <div style={{ position: "absolute", bottom: "calc(env(safe-area-inset-bottom) + 18px)", left: 0, right: 0, textAlign: "center", pointerEvents: "auto", fontSize: 11, color: "#5f7080", letterSpacing: 0.5 }}>
            <a href="/airraw/privacy" style={{ color: "#6b7d8e", textDecoration: "none" }}>privacy</a>
            <span style={{ opacity: 0.4, margin: "0 9px" }}>·</span>
            <a href="/airraw/terms" style={{ color: "#6b7d8e", textDecoration: "none" }}>terms</a>
          </div>
        </div>
      )}

      {/* one-time gesture hint — fades in, holds, fades out on its own */}
      {started && navHint && !selected && !group && (
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: "calc(env(safe-area-inset-top) + 64px)", zIndex: 24, fontSize: 12.5, letterSpacing: 0.6, color: "rgba(238,244,248,.62)", background: "rgba(4,5,11,.5)", border: ".5px solid rgba(255,255,255,.1)", borderRadius: 999, padding: "8px 16px", pointerEvents: "none", whiteSpace: "nowrap", fontFamily: "var(--font-geist), system-ui, sans-serif", animation: "navhint 6.5s ease both" }}>
          <style>{`@keyframes navhint{0%{opacity:0;transform:translateX(-50%) translateY(6px)}8%,80%{opacity:1;transform:translateX(-50%) translateY(0)}100%{opacity:0}}`}</style>
          scroll to go closer · drag to drift
        </div>
      )}

      {/* The main act: join the group at this scale. The number shrinks as you descend. */}
      {started && hud.join && !selected && !group && (
        <button onClick={() => joinGroup(hud.join!)}
          style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: "calc(env(safe-area-inset-bottom) + 92px)", minHeight: 44, fontSize: 14, fontWeight: 600, color: "#06121e", background: "#7fd6c0", border: "none", borderRadius: 16, padding: "12px 20px", cursor: "pointer", boxShadow: "0 8px 28px -8px rgba(127,214,192,.55)", fontFamily: "var(--font-geist), system-ui, sans-serif", whiteSpace: "nowrap", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
          {CONTINENTS[hud.join.c]?.n === "the arena" ? "♟ play chess →" : hud.join.n === 1 ? `Call ${charFor(hud.join.seed, hud.join.c).host} →` : "Enter →"}
        </button>
      )}

      {started && hud.hearing && <div style={{ position: "absolute", left: 16, bottom: "calc(env(safe-area-inset-bottom) + 16px)", fontSize: 12.5, lineHeight: 1.35, color: "#cfe0ee", background: "rgba(4,5,11,.55)", padding: "8px 13px", borderRadius: 12, maxWidth: "min(64vw, 250px)", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden", pointerEvents: "none", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>{hud.hearing}</div>}

      {selected && <AirBubble cluster={selected} opening={opening} lang={lang} tempLabel={tempLabel(selected.f)} onClose={() => { setSelected(null); setOpening(""); zoomFnRef.current(0.55) }} onTalked={() => track("airraw_talk", { surface: "planet" })} />}

      {group && <GroupRoom seed={group.seed} f={group.f} count={group.count} opening={opening} lang={lang} tempLabel={tempLabel(group.f)} onClose={() => { setGroup(null); setOpening(""); zoomFnRef.current(0.55) }}
        onCall={(m) => {
          // from the room's people sheet: leave the crowd, call this one directly.
          // Same AIR gate as any conversation; 18+ was already confirmed to be here.
          if (!gateAir()) return
          if (!isPro()) { spendCredits(1); setCredits(getCredits()) }
          setGroup(null); setOpening("")
          setSelected(m)
        }} />}

      {(pending || pendingJoin || nearDeep) && !verified && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(20,6,30,.9)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto", paddingTop: "max(26px, env(safe-area-inset-top))", paddingBottom: "max(26px, env(safe-area-inset-bottom))", paddingLeft: "max(26px, env(safe-area-inset-left))", paddingRight: "max(26px, env(safe-area-inset-right))", zIndex: 30 }}>
          <div style={{ maxWidth: 340, textAlign: "center", color: "#f3e8fb" }}>
            <div style={{ fontSize: 12, letterSpacing: 1, color: "#c69cff" }}>you&apos;re approaching the deep</div>
            <div style={{ fontSize: 21, fontWeight: 500, margin: "8px 0 10px" }}>18+ only past here</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "#d7c3ea" }}>flirty, explicit, late-night. tap below to confirm you&apos;re 18 or older.</div>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 9 }}>
              <button onClick={confirm18} style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.2, minHeight: 44, color: "#1a0d2a", background: "#c69cff", border: "none", borderRadius: 14, padding: "12px 14px", cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>i&apos;m 18 or older — enter</button>
              <button onClick={() => { setPending(null); setPendingJoin(null); setNearDeep(false); zoomFnRef.current(0.18) }} style={{ fontSize: 14, lineHeight: 1.2, minHeight: 44, color: "#d7c3ea", background: "transparent", border: "1px solid rgba(198,156,255,.4)", borderRadius: 14, padding: "12px 14px", cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>no — take me back</button>
            </div>
          </div>
        </div>
      )}

      {showPro && <ProSheet onClose={() => setShowPro(false)} />}
      {showProfile && <ProfileSheet onClose={() => { setShowProfile(false); setProfile(getProfile()); setCredits(getCredits()) }} onUpgrade={() => { setShowProfile(false); setShowPro(true) }} />}
      {proMsg && (
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: "calc(env(safe-area-inset-bottom) + 150px)", zIndex: 35, maxWidth: "86vw", textAlign: "center", fontSize: 13, fontWeight: 600, color: "#1a0d2a", background: "linear-gradient(180deg,#ffe1a0,#e9b6ff)", padding: "11px 18px", borderRadius: 14, boxShadow: "0 12px 32px -8px rgba(0,0,0,.55)", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>{proMsg}</div>
      )}

      <audio ref={audioRef} style={{ display: "none" }} />
    </div>
  )
}
