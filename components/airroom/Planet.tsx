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
import { startAmbience, setAmbienceDepth, setAmbienceMuted, stopAmbience } from "@/lib/airroom/ambience"
import { track } from "@/lib/airraw/track"

interface Continent { n: string; v: string; h: number; f: number; adult?: boolean }
const CONTINENTS: Continent[] = [
  { n: "still water", v: "study · calm", h: 193, f: 0.12 },
  { n: "the gardens", v: "grow · heal", h: 150, f: 0.30 },
  { n: "the commons", v: "social · warm", h: 45, f: 0.45 },
  { n: "the late floor", v: "night · close", h: 18, f: 0.60 },
  { n: "the deep", v: "raw · 18+", h: 288, f: 0.86, adult: true },
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
interface Join { n: number; seed: number; f: number; adult: boolean }

interface Node { x: number; y: number; c: number; ci: number; hue: number; ph: number; dr: number; char: Cluster }

const btn: React.CSSProperties = { width: 36, height: 36, color: "#dfeaf2", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.2)", borderRadius: 10, cursor: "pointer", fontSize: 19, lineHeight: "1" }

export function Planet() {
  const cvRef = useRef<HTMLCanvasElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const zoomFnRef = useRef<(f: number) => void>(() => {})

  const [selected, setSelected] = useState<Cluster | null>(null)
  const [group, setGroup] = useState<{ seed: number; f: number; count: number } | null>(null)
  const [pending, setPending] = useState<Cluster | null>(null)   // deep voice awaiting 18+ confirm
  const [pendingJoin, setPendingJoin] = useState<Join | null>(null) // deep group awaiting 18+ confirm
  const [verified, setVerified] = useState(false)
  const [hud, setHud] = useState<{ crumb: string; alt: string; hearing: string; join: Join | null }>({ crumb: "from orbit · the whole now", alt: "orbit", hearing: "the hum of the whole now", join: null })

  const verifiedRef = useRef(false)
  const inCallRef = useRef(false)
  useEffect(() => { verifiedRef.current = verified }, [verified])
  useEffect(() => { const inCall = !!selected || !!group; inCallRef.current = inCall; try { setAmbienceMuted(inCall) } catch { /* */ } }, [selected, group])

  useEffect(() => { try { if (localStorage.getItem("airroom_18") === "1") setVerified(true) } catch { /* */ } }, [])
  useEffect(() => { track("airraw_land", { surface: "planet" }) }, [])
  useEffect(() => () => { try { stopAmbience() } catch { /* */ } }, [])

  // The crowd — deterministic, built once. Every light already knows its face,
  // voice and lines (makeCharacter is cheap + stable per seed).
  const nodes = useMemo<Node[]>(() => {
    const out: Node[] = []
    for (let c = 0; c < CONTINENTS.length; c++) {
      const cang = (c / CONTINENTS.length) * 6.283 + 0.6, cr = 0.07 + rnd(c * 13) * 0.21
      const ccx = CX + Math.cos(cang) * cr, ccy = CY + Math.sin(cang) * cr
      for (let ci = 0; ci < CITIES; ci++) {
        const a1 = rnd(c * 53 + ci) * 6.283, r1 = 0.018 + rnd(c * 7 + ci * 3) * 0.055
        const cityx = ccx + Math.cos(a1) * r1, cityy = ccy + Math.sin(a1) * r1
        for (let i = 0; i < FACES; i++) {
          const a2 = rnd(c * 999 + ci * 131 + i) * 6.283, r2 = 0.004 + rnd(c * 31 + ci * 17 + i * 5) * 0.02
          const seed = (c * 100003 + ci) * 100003 + i + 7
          out.push({
            x: cityx + Math.cos(a2) * r2, y: cityy + Math.sin(a2) * r2, c, ci,
            hue: CONTINENTS[c].h + (rnd(seed) * 26 - 13), ph: rnd(seed + 1) * 6.28, dr: rnd(seed + 9) * 0.5 + 0.3,
            char: makeCharacter(seed, CONTINENTS[c].f),
          })
        }
      }
    }
    return out
  }, [])

  const conCentres = useMemo(() => CONTINENTS.map((_, c) => {
    const cang = (c / CONTINENTS.length) * 6.283 + 0.6, cr = 0.07 + rnd(c * 13) * 0.21
    return { x: CX + Math.cos(cang) * cr, y: CY + Math.sin(cang) * cr }
  }), [])

  // A dense "ocean" of dim voices fills the whole disc so the now reads as a full,
  // glowing, populated planet from orbit — the continents are just the brighter
  // concentrations within it. Ambient texture only: these never resolve into faces
  // or open; they're the felt millions that give the planet its mass.
  const ambient = useMemo(() => {
    const out: { x: number; y: number; hue: number; ph: number; dr: number }[] = []
    for (let i = 0; i < 1300; i++) {
      const a = rnd(i * 1.7 + 3) * 6.283, rr = Math.sqrt(rnd(i * 2.3 + 1)) * PR * 0.98
      const x = CX + Math.cos(a) * rr, y = CY + Math.sin(a) * rr
      let bh = 200, bd = 1e9
      for (let c = 0; c < CONTINENTS.length; c++) { const d = Math.hypot(conCentres[c].x - x, conCentres[c].y - y); if (d < bd) { bd = d; bh = CONTINENTS[c].h } }
      out.push({ x, y, hue: bh + (rnd(i * 3 + 7) * 30 - 15), ph: rnd(i + 5) * 6.28, dr: rnd(i + 2) * 0.4 + 0.2 })
    }
    return out
  }, [conCentres])

  // ── proximity voice — the nearest face murmurs, like leaning toward someone ──
  const speakTok = useRef(0)
  const speak = useCallback(async (node: Node) => {
    const tok = ++speakTok.current
    try {
      const res = await fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: node.char.lines[0], personaName: node.char.host, gender: node.char.gender, language: "English", voiceId: node.char.voiceId }),
      })
      if (!res.ok || speakTok.current !== tok) return
      const url = URL.createObjectURL(await res.blob())
      if (speakTok.current !== tok) { URL.revokeObjectURL(url); return }
      const a = audioRef.current
      if (a) { a.src = url; a.volume = 0.9; a.onended = () => URL.revokeObjectURL(url); await a.play().catch(() => {}) }
    } catch { /* a quiet sky is fine */ }
  }, [])

  const openVoice = useCallback((node: Node) => {
    if (CONTINENTS[node.c].adult && !verifiedRef.current) { setPending(node.char); return }
    setSelected(node.char)
  }, [])
  const joinGroup = useCallback((j: Join) => {
    if (j.adult && !verifiedRef.current) { setPendingJoin(j); return }
    setGroup({ seed: j.seed, f: j.f, count: j.n })
  }, [])
  const confirm18 = () => {
    setVerified(true); try { localStorage.setItem("airroom_18", "1") } catch { /* */ }
    const p = pending, pj = pendingJoin; setPending(null); setPendingJoin(null)
    if (p) setSelected(p); else if (pj) setGroup({ seed: pj.seed, f: pj.f, count: pj.n })
  }

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
    let pickedNode: Node | null = null, candId = -1, candAt = 0, spokenId = -1
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

    const onWheel = (e: WheelEvent) => { e.preventDefault(); startAudio(); const r = cv.getBoundingClientRect(); zoomAt((e.clientX - r.left) * DPR, (e.clientY - r.top) * DPR, e.deltaY < 0 ? 1.16 : 1 / 1.16) }
    cv.addEventListener("wheel", onWheel, { passive: false })

    const pts = new Map<number, { x: number; y: number }>()
    let drag: { x: number; y: number; cx: number; cy: number } | null = null, moved = 0, pinchD = 0
    const onDown = (e: PointerEvent) => {
      startAudio(); pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
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
      if (!wasDrag && pts.size === 0 && pickedNode && cam.s > 24) openVoice(pickedNode)
    }
    cv.addEventListener("pointerdown", onDown); cv.addEventListener("pointermove", onMove)
    cv.addEventListener("pointerup", onUp); cv.addEventListener("pointercancel", onUp)

    const faceFor = (n: Node): HTMLImageElement | null => {
      const key = n.char.host
      if (imgs.has(key)) return imgs.get(key) || null
      if (imgs.size > 220) return null
      imgs.set(key, null)
      const im = new Image(); im.onload = () => imgs.set(key, im); im.onerror = () => imgs.set(key, null)
      im.src = imageFor({ name: n.char.host }); return null
    }

    const loop = () => {
      raf = requestAnimationFrame(loop); t += 0.016; frameN++
      cam.x += (tgt.x - cam.x) * 0.15; cam.y += (tgt.y - cam.y) * 0.15; cam.s += (tgt.s - cam.s) * 0.15
      if (frameN % 18 === 0) { try { setAmbienceDepth(cam.s) } catch { /* */ } }
      const W = cv.width, H = cv.height
      ctx.fillStyle = "#04050b"; ctx.fillRect(0, 0, W, H)
      for (const st of stars) { let sx = (st.x * W + cam.x * -12) % W; if (sx < 0) sx += W; let sy = (st.y * H + cam.y * -12) % H; if (sy < 0) sy += H; ctx.globalAlpha = (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.3 + st.ph))) * 0.7; ctx.fillStyle = "#cdd9e3"; ctx.beginPath(); ctx.arc(sx, sy, st.r * DPR, 0, 6.283); ctx.fill() }
      ctx.globalAlpha = 1
      const pc = w2s(CX, CY), prs = PR * cam.s * vm()
      const fromSpace = prs < Math.max(W, H) * 0.72
      if (fromSpace) {
        const halo = ctx.createRadialGradient(pc[0], pc[1], prs * 0.55, pc[0], pc[1], prs * 1.5)
        halo.addColorStop(0, "rgba(60,150,180,0)"); halo.addColorStop(0.72, "rgba(70,170,200,.10)"); halo.addColorStop(0.92, "rgba(120,210,230,.22)"); halo.addColorStop(1, "rgba(120,210,230,0)")
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(pc[0], pc[1], prs * 1.5, 0, 6.283); ctx.fill()
        const core = ctx.createRadialGradient(pc[0], pc[1], 0, pc[0], pc[1], prs)
        core.addColorStop(0, "rgba(20,40,70,.5)"); core.addColorStop(1, "rgba(8,16,34,.12)")
        ctx.fillStyle = core; ctx.beginPath(); ctx.arc(pc[0], pc[1], prs, 0, 6.283); ctx.fill()
        ctx.strokeStyle = "rgba(150,220,240,.22)"; ctx.lineWidth = DPR; ctx.beginPath(); ctx.arc(pc[0], pc[1], prs, 0, 6.283); ctx.stroke()
      }
      if (cam.s >= 4 && cam.s < 42) {
        for (let c = 0; c < CONTINENTS.length; c++) {
          const co = CONTINENTS[c], cp = w2s(conCentres[c].x, conCentres[c].y), crs = 0.085 * cam.s * vm()
          if (cp[0] < -90 || cp[0] > W + 90 || cp[1] < -90 || cp[1] > H + 90) continue
          ctx.strokeStyle = `hsla(${co.h},62%,60%,${cam.s < 11 ? 0.3 : 0.12})`; ctx.lineWidth = DPR
          ctx.beginPath(); ctx.arc(cp[0], cp[1], crs, 0, 6.283); ctx.stroke()
          if (cam.s < 13) { ctx.fillStyle = `hsla(${co.h},60%,80%,.85)`; ctx.font = `500 ${12 * DPR}px ${FF}`; ctx.textAlign = "center"; ctx.fillText(co.adult ? co.n + " · 18+" : co.n, cp[0], cp[1] - crs - 6 * DPR); ctx.textAlign = "left" }
        }
      }
      // ambient ocean — the planet's mass: dim, faceless, never interactive
      for (const n of ambient) {
        const dx = Math.sin(t * 0.3 + n.ph) * n.dr * 0.0006, dy = Math.cos(t * 0.27 + n.ph) * n.dr * 0.0006
        const s = w2s(n.x + dx, n.y + dy)
        if (s[0] < -20 || s[1] < -20 || s[0] > W + 20 || s[1] > H + 20) continue
        let bright = 1
        if (fromSpace) { const dd = Math.hypot(n.x - CX, n.y - CY) / PR; bright = 1 - Math.min(1, dd * dd) * 0.6 }
        ctx.globalAlpha = Math.max(0.1, bright * 0.5)
        ctx.fillStyle = `hsl(${n.hue},58%,${Math.round(50 + bright * 8)}%)`
        ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(0.5, cam.s * vm() * 0.0026), 0, 6.283); ctx.fill()
      }
      ctx.globalAlpha = 1

      let best = 1e9, act: Node | null = null
      for (const n of nodes) {
        const dx = Math.sin(t * 0.4 + n.ph) * n.dr * 0.0008, dy = Math.cos(t * 0.31 + n.ph) * n.dr * 0.0008
        const s = w2s(n.x + dx, n.y + dy)
        if (s[0] < -40 || s[1] < -40 || s[0] > W + 40 || s[1] > H + 40) continue
        const baseR = Math.max(1.0, cam.s * vm() * 0.0040), r = baseR * (1 + 0.13 * Math.sin(t * 1.6 + n.ph))
        let bright = 1
        if (fromSpace) { const dd = Math.hypot(n.x - CX, n.y - CY) / PR; bright = 1 - Math.min(1, dd * dd) * 0.55 }
        const dc = Math.hypot(s[0] - W / 2, s[1] - H / 2)
        if (r > 2.2 && dc < best) { best = dc; act = n }
        const locked = !!CONTINENTS[n.c].adult && !verifiedRef.current
        if (r > 17 && !locked) {
          const im = faceFor(n)
          if (im) {
            ctx.save(); ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, 6.283); ctx.clip(); ctx.drawImage(im, s[0] - r, s[1] - r, r * 2, r * 2); ctx.restore()
            ctx.strokeStyle = `hsla(${n.hue},70%,62%,.5)`; ctx.lineWidth = 1.5 * DPR; ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, 6.283); ctx.stroke()
          } else { ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, 6.283); ctx.fillStyle = `hsl(${n.hue},70%,60%)`; ctx.shadowBlur = r * 1.6; ctx.shadowColor = `hsla(${n.hue},85%,62%,.8)`; ctx.fill(); ctx.shadowBlur = 0 }
          ctx.fillStyle = "rgba(238,244,248,.92)"; ctx.textAlign = "center"; ctx.font = `500 ${Math.min(13, r * 0.45) * DPR}px ${FF}`; ctx.fillText(n.char.host, s[0], s[1] + r + 13 * DPR); ctx.textAlign = "left"
        } else {
          ctx.globalAlpha = Math.max(0.25, bright); ctx.beginPath(); ctx.arc(s[0], s[1], r, 0, 6.283)
          ctx.fillStyle = `hsl(${n.hue},72%,${Math.round(58 + bright * 8)}%)`
          if (r > 2.6) { ctx.shadowBlur = r * 1.7; ctx.shadowColor = `hsla(${n.hue},85%,62%,.8)` } else ctx.shadowBlur = 0
          ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1
        }
      }
      pickedNode = act
      if (act) {
        const s = w2s(act.x, act.y)
        ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 1.5 * DPR
        ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(8, cam.s * vm() * 0.0042 + 6 * DPR), 0, 6.283); ctx.stroke()
        const id = act.c * 10000 + act.ci * 100 + (nodes.indexOf(act) % 100)
        if (id !== candId) { candId = id; candAt = t }
        else if (audioStarted && !inCallRef.current && id !== spokenId && t - candAt > 0.45 && cam.s > 14) { spokenId = id; speak(act) }
      }
      const co = act ? CONTINENTS[act.c] : CONTINENTS[0]
      const loc = act ? act.c * 100003 + act.ci : 0
      const join: Join | null = (act && cam.s > 3.2) ? { n: joinSize(cam.s, loc), seed: loc, f: CONTINENTS[act.c].f, adult: !!CONTINENTS[act.c].adult } : null
      let crumb: string, altl: string, hear: string
      if (cam.s < 3.2) { crumb = "from orbit · the whole now"; altl = "orbit"; hear = "the hum of the whole now · thousands of voices" }
      else if (cam.s < 11) { crumb = `${co.n} · a region of the now`; altl = "atmosphere"; hear = `drifting over ${co.n} — ${co.v}` }
      else if (cam.s < 24) { crumb = `${co.n} · room ${(act ? act.ci : 0) + 1}`; altl = "rooftops"; hear = `a room in ${co.n} · many close voices` }
      else { crumb = `${co.n} · room ${(act ? act.ci : 0) + 1} · one voice`; altl = "street"; hear = act ? `hearing · ${act.char.host} — “${act.char.lines[0]}”` : "lean closer" }
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
  }, [nodes, ambient, conCentres, speak, openVoice])

  return (
    <div style={{ position: "fixed", inset: 0, background: "#04050b", overflow: "hidden", touchAction: "none" }}>
      <canvas ref={cvRef} style={{ display: "block", width: "100%", height: "100%", cursor: "grab" }} />

      <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top) + 12px)", left: 16, right: 16, display: "flex", justifyContent: "space-between", gap: 10, pointerEvents: "none", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
        <div style={{ fontSize: 12, color: "#9fb2c4", letterSpacing: 1, background: "rgba(4,5,11,.5)", padding: "5px 10px", borderRadius: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>it&apos;s the now · {hud.crumb}</div>
        <div style={{ fontSize: 11, color: "#6b7d8e", background: "rgba(4,5,11,.5)", padding: "5px 10px", borderRadius: 9, whiteSpace: "nowrap" }}>altitude — {hud.alt}</div>
      </div>

      {/* The main act: join the group at this scale. The number shrinks as you descend. */}
      {hud.join && !selected && !group && (
        <button onClick={() => joinGroup(hud.join!)}
          style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: "calc(env(safe-area-inset-bottom) + 60px)", fontSize: 14, fontWeight: 600, color: "#06121e", background: "#7fd6c0", border: "none", borderRadius: 16, padding: "12px 20px", cursor: "pointer", boxShadow: "0 8px 28px -8px rgba(127,214,192,.55)", fontFamily: "var(--font-geist), system-ui, sans-serif", whiteSpace: "nowrap" }}>
          {hud.join.n === 1 ? "talk 1:1 →" : `join this room · ${hud.join.n} here →`}
        </button>
      )}

      <div style={{ position: "absolute", left: 16, bottom: "calc(env(safe-area-inset-bottom) + 16px)", fontSize: 12.5, color: "#cfe0ee", background: "rgba(4,5,11,.55)", padding: "8px 13px", borderRadius: 12, maxWidth: "62%", pointerEvents: "none", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>{hud.hearing}</div>

      <div style={{ position: "absolute", right: 14, bottom: "calc(env(safe-area-inset-bottom) + 14px)", display: "flex", flexDirection: "column", gap: 8 }}>
        <button aria-label="descend" onClick={() => zoomFnRef.current(1.6)} style={btn}>+</button>
        <button aria-label="climb" onClick={() => zoomFnRef.current(1 / 1.6)} style={btn}>−</button>
      </div>

      {selected && <AirBubble cluster={selected} tempLabel={tempLabel(selected.f)} onClose={() => setSelected(null)} onTalked={() => track("airraw_talk", { surface: "planet" })} />}

      {group && <GroupRoom seed={group.seed} f={group.f} count={group.count} tempLabel={tempLabel(group.f)} onClose={() => setGroup(null)} />}

      {(pending || pendingJoin) && !verified && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(20,6,30,.9)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 26, zIndex: 30 }}>
          <div style={{ maxWidth: 340, textAlign: "center", color: "#f3e8fb" }}>
            <div style={{ fontSize: 12, letterSpacing: 1, color: "#c69cff" }}>you&apos;re at the edge of the deep</div>
            <div style={{ fontSize: 21, fontWeight: 500, margin: "8px 0 10px" }}>it gets adult down here</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: "#d7c3ea" }}>flirty, late-night, 18+. you only go deeper if you&apos;re old enough.</div>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 9 }}>
              <button onClick={confirm18} style={{ fontSize: 14, fontWeight: 500, color: "#1a0d2a", background: "#c69cff", border: "none", borderRadius: 14, padding: "12px 0", cursor: "pointer" }}>i&apos;m 18 or older — take me down</button>
              <button onClick={() => { setPending(null); setPendingJoin(null) }} style={{ fontSize: 14, color: "#d7c3ea", background: "transparent", border: ".5px solid rgba(198,156,255,.3)", borderRadius: 14, padding: "12px 0", cursor: "pointer" }}>keep me up here</button>
            </div>
          </div>
        </div>
      )}

      <audio ref={audioRef} style={{ display: "none" }} />
    </div>
  )
}
