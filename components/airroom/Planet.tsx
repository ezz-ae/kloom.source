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
import { AirBubble } from "@/components/airroom/AirBubble"
import { GroupRoom } from "@/components/airroom/GroupRoom"
import { RoomCard, type RoomPreview } from "@/components/airroom/RoomCard"
import { startAmbience, setAmbienceDepth, setAmbienceMuted, stopAmbience } from "@/lib/airroom/ambience"
import { track } from "@/lib/airraw/track"

interface Continent { n: string; v: string; h: number; f: number; adult?: boolean }
const CONTINENTS: Continent[] = [
  { n: "still water", v: "study · deep focus", h: 193, f: 0.12 },
  { n: "the workshop", v: "build · make things", h: 150, f: 0.24 },
  { n: "the trading floor", v: "markets · risk · calls", h: 128, f: 0.33 },
  { n: "the arena", v: "games · chess · play", h: 262, f: 0.40 },
  { n: "the playground", v: "dares · chaos · fun", h: 322, f: 0.46 },
  { n: "the commons", v: "social · warm", h: 45, f: 0.52 },
  { n: "the late floor", v: "night · close", h: 18, f: 0.62 },
  { n: "the deep", v: "raw · 18+", h: 300, f: 0.86, adult: true },
]
const CITIES = 8
const FACES = 14
const PR = 0.40, CX = 0.5, CY = 0.5

const rnd = (s: number) => { const x = Math.sin(s * 127.1) * 43758.5453; return x - Math.floor(x) }
function tempLabel(f: number) { if (f < 0.2) return "water · calm"; if (f < 0.42) return "teal · focused"; if (f < 0.6) return "warm · social"; if (f < 0.78) return "amber · loud"; return "the deep · 18+" }

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
  const [preview, setPreview] = useState<RoomPreview | null>(null)   // the room card, shown before you enter
  const [pending, setPending] = useState<Cluster | null>(null)   // deep voice awaiting 18+ confirm
  const [pendingJoin, setPendingJoin] = useState<Join | null>(null) // deep group awaiting 18+ confirm
  const [verified, setVerified] = useState(false)
  const [hud, setHud] = useState<{ crumb: string; alt: string; hearing: string; join: Join | null }>({ crumb: "from orbit · the whole now", alt: "orbit", hearing: "the hum of the whole now", join: null })

  const verifiedRef = useRef(false)
  const inCallRef = useRef(false)
  // Sky-first entry: the very first view is just sky + a place to write. The blocks
  // only appear once you begin (type & dive, or scroll/drag/zoom the sky).
  const [started, setStarted] = useState(false)
  const [intent, setIntent] = useState("")      // what you write on the sky
  const [opening, setOpening] = useState("")     // handed to the first room you enter as your first line
  const startedRef = useRef(false)
  const startFnRef = useRef<() => void>(() => {})
  const openingRef = useRef("")
  useEffect(() => { verifiedRef.current = verified }, [verified])
  useEffect(() => { const inCall = !!selected || !!group; inCallRef.current = inCall; try { setAmbienceMuted(inCall) } catch { /* */ } }, [selected, group])

  useEffect(() => { try { if (localStorage.getItem("airroom_18") === "1") setVerified(true) } catch { /* */ } }, [])
  useEffect(() => { track("airraw_land", { surface: "planet" }) }, [])
  useEffect(() => () => { try { stopAmbience() } catch { /* */ } }, [])

  // Only the 8 continent anchors are fixed; rooms + faces are generated procedurally
  // for whatever's on screen (see the loop), so the world is infinite.
  // The 8 worlds, unboxed: spread across a tall ellipse so they fill the sky on a
  // phone (narrow x, tall y) instead of clustering in one block.
  const conCentres = useMemo(() => CONTINENTS.map((_, c) => {
    const cang = (c / CONTINENTS.length) * 6.283 + 0.6
    return { x: CX + Math.cos(cang) * 0.205, y: CY + Math.sin(cang) * 0.345 }
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
        body: JSON.stringify({ text: char.lines[0], personaName: char.host, gender: char.gender, language: "English", voiceId: char.voiceId }),
      })
      if (!res.ok || speakTok.current !== tok) return
      const url = URL.createObjectURL(await res.blob())
      if (speakTok.current !== tok) { URL.revokeObjectURL(url); return }
      const a = audioRef.current
      if (a) { a.src = url; a.volume = 0.9; a.onended = () => URL.revokeObjectURL(url); await a.play().catch(() => {}) }
    } catch { /* a quiet sky is fine */ }
  }, [])

  const takeOpening = () => { const o = openingRef.current; openingRef.current = ""; setOpening(o); return o }
  // Tapping a face or a join CTA now shows the room CARD first (who's here) — the
  // real room only opens when you "step in".
  const openVoice = useCallback((c: number, seed: number) => {
    const co = CONTINENTS[c]
    setPreview({ kind: "voice", c, seed, f: co.f, count: 1, adult: !!co.adult, continent: co.n, vibe: co.v, hue: co.h })
  }, [])
  const joinGroup = useCallback((j: Join) => {
    if (CONTINENTS[j.c]?.n === "the arena") { window.location.href = "/airraw/chess"; return }   // games room → the board
    const co = CONTINENTS[j.c]
    setPreview({ kind: "group", c: j.c, seed: j.seed, f: j.f, count: j.n, adult: !!j.adult, continent: co.n, vibe: co.v, hue: co.h })
  }, [])
  // "step in" from the card → the real room (18+ gate enforced here).
  const enterRoom = (p: RoomPreview) => {
    setPreview(null)
    if (p.adult && !verifiedRef.current) {
      if (p.kind === "voice") setPending(charFor(p.seed, p.c))
      else setPendingJoin({ n: p.count, seed: p.seed, f: p.f, adult: true, c: p.c })
      return
    }
    takeOpening()
    if (p.kind === "voice") setSelected(charFor(p.seed, p.c))
    else setGroup({ seed: p.seed, f: p.f, count: p.count })
  }
  const confirm18 = () => {
    setVerified(true); try { localStorage.setItem("airroom_18", "1") } catch { /* */ }
    const p = pending, pj = pendingJoin; setPending(null); setPendingJoin(null)
    if (p) { takeOpening(); setSelected(p) } else if (pj) { takeOpening(); setGroup({ seed: pj.seed, f: pj.f, count: pj.n }) }
  }
  // write-box "dive": remember what they wrote (seeds their first room), then begin.
  const dive = () => { openingRef.current = intent.trim(); startFnRef.current() }

  // ── the engine ──
  useEffect(() => {
    const cv = cvRef.current; if (!cv) return
    const ctx = cv.getContext("2d"); if (!ctx) return
    const DPR = Math.min(2, window.devicePixelRatio || 1)
    const FF = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif"
    const cam = { x: 0.5, y: 0.5, s: 0.85 }, tgt = { x: 0.5, y: 0.5, s: 0.85 }
    const imgs = new Map<string, HTMLImageElement | null>()
    const stars = Array.from({ length: 160 }, (_, s) => ({ x: rnd(s * 3 + 1), y: rnd(s * 7 + 2), r: rnd(s * 5) * 1.1 + 0.2, ph: rnd(s) * 6.28 }))
    let t = 0, raf = 0, audioStarted = false, frameN = 0
    let pickedNode: { c: number; seed: number } | null = null, candId = -1, candAt = 0, spokenId = -1
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
    const startAudio = () => { if (!audioStarted) { audioStarted = true; try { startAmbience(); setAmbienceDepth(cam.s) } catch { /* */ } } }
    // begin the descent: reveal the blocks and drift inward so the world opens up
    const markStarted = () => { if (!startedRef.current) { startedRef.current = true; setStarted(true); tgt.s = Math.max(tgt.s, 1.6) } }
    startFnRef.current = markStarted

    const onWheel = (e: WheelEvent) => { e.preventDefault(); startAudio(); markStarted(); const r = cv.getBoundingClientRect(); zoomAt((e.clientX - r.left) * DPR, (e.clientY - r.top) * DPR, e.deltaY < 0 ? 1.16 : 1 / 1.16) }
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
        if (pinchD > 0) { const r = cv.getBoundingClientRect(); zoomAt(((p[0].x + p[1].x) / 2 - r.left) * DPR, ((p[0].y + p[1].y) / 2 - r.top) * DPR, d / pinchD) }
        pinchD = d; return
      }
      if (!drag) return
      const m = vm(), ddx = e.clientX - drag.x, ddy = e.clientY - drag.y; moved += Math.abs(ddx) + Math.abs(ddy)
      tgt.x = drag.cx - ddx * DPR / (tgt.s * m); tgt.y = drag.cy - ddy * DPR / (tgt.s * m)
    }
    const onUp = (e: PointerEvent) => {
      const wasDrag = drag && moved > 6
      pts.delete(e.pointerId); if (pts.size < 2) pinchD = 0; if (pts.size === 0) drag = null
      if (!wasDrag && pts.size === 0 && pickedNode && cam.s > 24) openVoice(pickedNode.c, pickedNode.seed)
    }
    cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointermove", onMove)
    cv.addEventListener("pointerup", onUp); cv.addEventListener("pointercancel", onUp)

    const faceFor = (host: string): HTMLImageElement | null => {
      if (imgs.has(host)) return imgs.get(host) || null
      if (imgs.size > 260) return null
      imgs.set(host, null)
      const im = new Image(); im.onload = () => imgs.set(host, im); im.onerror = () => imgs.set(host, null)
      im.src = imageFor({ name: host }); return null
    }
    const ROOM_OPEN = 168 * DPR   // a block's screen size at which it opens to faces
    const rrect = (x: number, y: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath() }

    const loop = () => {
      raf = requestAnimationFrame(loop); t += 0.016; frameN++
      cam.x += (tgt.x - cam.x) * 0.15; cam.y += (tgt.y - cam.y) * 0.15; cam.s += (tgt.s - cam.s) * 0.15
      if (frameN % 18 === 0) { try { setAmbienceDepth(cam.s) } catch { /* */ } }
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
        for (let c = 0; c < CONTINENTS.length; c++) {
          const co = CONTINENTS[c]
          // each world drifts on its own slow orbit — the sky is alive
          const dx = Math.sin(t * 0.18 + c * 1.7) * 0.012, dy = Math.cos(t * 0.13 + c * 2.3) * 0.012
          const cp = w2s(conCentres[c].x + dx, conCentres[c].y + dy), ch = 0.10 * cam.s * vm()
          if (cp[0] + ch < 0 || cp[0] - ch > W || cp[1] + ch < 0 || cp[1] - ch > H) continue
          const rad = Math.min(ch * 0.3, 18 * DPR)
          ctx.fillStyle = `hsla(${co.h},55%,52%,0.10)`
          rrect(cp[0] - ch, cp[1] - ch, ch * 2, ch * 2, rad); ctx.fill()
          ctx.strokeStyle = `hsla(${co.h},66%,64%,0.40)`; ctx.lineWidth = 1.4 * DPR
          rrect(cp[0] - ch, cp[1] - ch, ch * 2, ch * 2, rad); ctx.stroke()
          if (cam.s < 8) {
            ctx.fillStyle = `hsla(${co.h},65%,86%,.95)`; ctx.textAlign = "center"; ctx.font = `500 ${12.5 * DPR}px ${FF}`
            ctx.fillText(co.adult ? co.n + " · 18+" : co.n, cp[0], cp[1] - 2 * DPR)
            ctx.fillStyle = `hsla(${co.h},45%,76%,.7)`; ctx.font = `400 ${10 * DPR}px ${FF}`
            ctx.fillText(co.v, cp[0], cp[1] + 14 * DPR); ctx.textAlign = "left"
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
            const fn = 9 + (rh % 7)
            for (let i = 0; i < fn; i++) {
              const fh = ihash(gx * 131 + i + 3, gy * 197 + i * 7 + 5)
              const fx = rx + (ifrac(fh) - 0.5) * RCELL * 0.66, fy = ry + (ifrac(ihash(fh, i + 11)) - 0.5) * RCELL * 0.66, fs = w2s(fx, fy)
              if (fs[0] < -40 || fs[1] < -40 || fs[0] > W + 40 || fs[1] > H + 40) continue
              const r = Math.max(2, m2 * 0.0040), fdc = Math.hypot(fs[0] - W / 2, fs[1] - H / 2)
              if (r > 2.2 && fdc < best) { best = fdc; act = { c, x: fx, y: fy, seed: fh } }
              const fhue = co.h + (ifrac(fh) * 26 - 13), rad = Math.min(r * 0.3, 10 * DPR)
              if (r > 17 && !locked) {
                const ch = charFor(fh, c), im = faceFor(ch.host)
                if (im) { ctx.save(); rrect(fs[0] - r, fs[1] - r, r * 2, r * 2, rad); ctx.clip(); ctx.drawImage(im, fs[0] - r, fs[1] - r, r * 2, r * 2); ctx.restore(); ctx.strokeStyle = `hsla(${fhue},70%,62%,.5)`; ctx.lineWidth = 1.5 * DPR; rrect(fs[0] - r, fs[1] - r, r * 2, r * 2, rad); ctx.stroke() }
                else { ctx.fillStyle = `hsl(${fhue},70%,60%)`; rrect(fs[0] - r, fs[1] - r, r * 2, r * 2, rad); ctx.fill() }
                if (r > 34) { ctx.fillStyle = "rgba(238,244,248,.92)"; ctx.textAlign = "center"; ctx.font = `500 ${Math.min(13, r * 0.34) * DPR}px ${FF}`; ctx.fillText(ch.host, fs[0], fs[1] + r + 13 * DPR); ctx.textAlign = "left" }
              } else { ctx.fillStyle = `hsl(${fhue},72%,62%)`; rrect(fs[0] - r, fs[1] - r, r * 2, r * 2, Math.max(1, r * 0.3)); ctx.fill() }
            }
          } else {
            ctx.fillStyle = `hsla(${co.h},55%,${cam.s < 8 ? 24 : 32}%,${cam.s < 8 ? 0.20 : 0.36})`
            rrect(s[0] - roomHalf, s[1] - roomHalf, roomHalf * 2, roomHalf * 2, Math.min(roomHalf * 0.28, 14 * DPR)); ctx.fill()
            ctx.strokeStyle = `hsla(${co.h},66%,64%,0.45)`; ctx.lineWidth = DPR; ctx.stroke()
            if (roomHalf * 2 > 48) { ctx.fillStyle = `hsla(${co.h},60%,86%,.92)`; ctx.textAlign = "center"; ctx.font = `500 ${Math.min(13, roomHalf * 0.2) * DPR}px ${FF}`; ctx.fillText(locked ? "the deep · 18+" : `${count} here`, s[0], s[1] + 4 * DPR); ctx.textAlign = "left" }
          }
        }
      }
      pickedNode = act
      if (act) {
        actChar = charFor(act.seed, act.c)
        const s = w2s(act.x, act.y), hr = Math.max(8, cam.s * vm() * 0.0042 + 6 * DPR)
        ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 1.5 * DPR
        rrect(s[0] - hr, s[1] - hr, hr * 2, hr * 2, hr * 0.3); ctx.stroke()
        const id = act.seed
        if (id !== candId) { candId = id; candAt = t }
        else if (audioStarted && !inCallRef.current && id !== spokenId && t - candAt > 0.45 && cam.s > 14) { spokenId = id; speak(actChar) }
      }
      const baseRm = act || nearestRoom
      const bc = baseRm ? baseRm.c : 0, co = CONTINENTS[bc], loc = baseRm ? baseRm.seed : 0
      const join: Join | null = (baseRm && cam.s > 3.2) ? { n: joinSize(cam.s, loc), seed: loc, f: co.f, adult: !!co.adult, c: bc } : null
      let crumb: string, altl: string, hear: string
      if (cam.s < 3.2) { crumb = "from orbit · the whole now"; altl = "orbit"; hear = "the hum of the whole now · thousands of voices" }
      else if (cam.s < 11) { crumb = `${co.n} · a region of the now`; altl = "atmosphere"; hear = `drifting over ${co.n} — ${co.v}` }
      else if (!facesVisible) { crumb = `${co.n} · a block`; altl = "rooftops"; hear = `a block in ${co.n} · ${nearestRoom ? nearestRoom.count : 0} inside · zoom in to land` }
      else { crumb = `${co.n} · on the floor`; altl = "the floor"; hear = actChar ? `hearing · ${actChar.host} — “${actChar.lines[0]}”` : "lean closer" }
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
  }, [conCentres, charFor, speak, openVoice])

  return (
    <div style={{ position: "fixed", inset: 0, background: "#04050b", overflow: "hidden", touchAction: "none" }}>
      <canvas ref={cvRef} style={{ display: "block", width: "100%", height: "100%", cursor: "grab" }} />

      {/* The very first view: only sky + a place to write. No boxes yet. */}
      {!started && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom))", pointerEvents: "none", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
          <div style={{ pointerEvents: "auto", width: "min(88vw, 460px)", textAlign: "center", color: "#eef4f8" }}>
            <div style={{ fontSize: 12, letterSpacing: 4, color: "#7fd6c0", textTransform: "uppercase" }}>airraw</div>
            <div style={{ fontSize: "clamp(25px, 7.5vw, 36px)", fontWeight: 500, lineHeight: 1.18, margin: "14px 0 8px" }}>it&apos;s the now.</div>
            <div style={{ fontSize: 15, lineHeight: 1.5, color: "#9fb2c4", marginBottom: 22 }}>say what&apos;s on your mind — then dive into the sky.</div>
            <form onSubmit={(e) => { e.preventDefault(); dive() }} style={{ display: "flex", gap: 8 }}>
              <input value={intent} onChange={(e) => setIntent(e.target.value)} placeholder="type anything…" aria-label="say something to the now" style={{ flex: 1, minWidth: 0, fontSize: 16, color: "#eef4f8", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.22)", borderRadius: 14, padding: "14px 16px", minHeight: 52, boxSizing: "border-box", outline: "none" }} />
              <button type="submit" style={{ flex: "0 0 auto", fontSize: 15, fontWeight: 600, minHeight: 52, color: "#06121e", background: "#7fd6c0", border: "none", borderRadius: 14, padding: "0 18px", cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>dive →</button>
            </form>
            <button onClick={() => { openingRef.current = ""; startFnRef.current() }} style={{ marginTop: 16, fontSize: 13, color: "#7f93a5", background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>or just look around →</button>
          </div>
        </div>
      )}

      {started && (
      <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top) + 12px)", left: 16, right: 16, display: "flex", justifyContent: "space-between", gap: 10, pointerEvents: "none", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
        <div style={{ flex: "1 1 auto", minWidth: 0, fontSize: 12, color: "#9fb2c4", letterSpacing: 1, background: "rgba(4,5,11,.5)", padding: "5px 10px", borderRadius: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>it&apos;s the now · {hud.crumb}</div>
        <div style={{ flex: "0 0 auto", fontSize: 11, color: "#6b7d8e", background: "rgba(4,5,11,.5)", padding: "5px 10px", borderRadius: 9, whiteSpace: "nowrap" }}>altitude — {hud.alt}</div>
      </div>
      )}

      {/* The main act: join the group at this scale. The number shrinks as you descend. */}
      {started && hud.join && !selected && !group && !preview && (
        <button onClick={() => joinGroup(hud.join!)}
          style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: "calc(env(safe-area-inset-bottom) + 92px)", minHeight: 44, fontSize: 14, fontWeight: 600, color: "#06121e", background: "#7fd6c0", border: "none", borderRadius: 16, padding: "12px 20px", cursor: "pointer", boxShadow: "0 8px 28px -8px rgba(127,214,192,.55)", fontFamily: "var(--font-geist), system-ui, sans-serif", whiteSpace: "nowrap", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
          {CONTINENTS[hud.join.c]?.n === "the arena" ? "♟ play chess →" : hud.join.n === 1 ? "talk 1:1 →" : `join this room · ${hud.join.n} here →`}
        </button>
      )}

      {started && <div style={{ position: "absolute", left: 16, bottom: "calc(env(safe-area-inset-bottom) + 16px)", fontSize: 12.5, lineHeight: 1.35, color: "#cfe0ee", background: "rgba(4,5,11,.55)", padding: "8px 13px", borderRadius: 12, maxWidth: "min(64vw, 250px)", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden", pointerEvents: "none", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>{hud.hearing}</div>}

      {started && (
      <div style={{ position: "absolute", right: 14, bottom: "calc(env(safe-area-inset-bottom) + 14px)", display: "flex", flexDirection: "column", gap: 8 }}>
        <button aria-label="descend" onClick={() => zoomFnRef.current(1.6)} style={btn}>+</button>
        <button aria-label="climb" onClick={() => zoomFnRef.current(1 / 1.6)} style={btn}>−</button>
      </div>
      )}

      {preview && <RoomCard p={preview} onEnter={() => enterRoom(preview)} onClose={() => setPreview(null)} />}

      {selected && <AirBubble cluster={selected} opening={opening} tempLabel={tempLabel(selected.f)} onClose={() => { setSelected(null); setOpening("") }} onTalked={() => track("airraw_talk", { surface: "planet" })} />}

      {group && <GroupRoom seed={group.seed} f={group.f} count={group.count} opening={opening} tempLabel={tempLabel(group.f)} onClose={() => { setGroup(null); setOpening("") }} />}

      {(pending || pendingJoin) && !verified && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(20,6,30,.9)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto", paddingTop: "max(26px, env(safe-area-inset-top))", paddingBottom: "max(26px, env(safe-area-inset-bottom))", paddingLeft: "max(26px, env(safe-area-inset-left))", paddingRight: "max(26px, env(safe-area-inset-right))", zIndex: 30 }}>
          <div style={{ maxWidth: 340, textAlign: "center", color: "#f3e8fb" }}>
            <div style={{ fontSize: 12, letterSpacing: 1, color: "#c69cff" }}>you&apos;re at the edge of the deep</div>
            <div style={{ fontSize: 21, fontWeight: 500, margin: "8px 0 10px" }}>it gets adult down here</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "#d7c3ea" }}>flirty, late-night, 18+. you only go deeper if you&apos;re old enough.</div>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 9 }}>
              <button onClick={confirm18} style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.2, minHeight: 44, color: "#1a0d2a", background: "#c69cff", border: "none", borderRadius: 14, padding: "12px 14px", cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>i&apos;m 18 or older — take me down</button>
              <button onClick={() => { setPending(null); setPendingJoin(null) }} style={{ fontSize: 14, lineHeight: 1.2, minHeight: 44, color: "#d7c3ea", background: "transparent", border: "1px solid rgba(198,156,255,.4)", borderRadius: 14, padding: "12px 14px", cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>keep me up here</button>
            </div>
          </div>
        </div>
      )}

      <audio ref={audioRef} style={{ display: "none" }} />
    </div>
  )
}
