"use client"

/**
 * AIRROOM — the arena · chess.
 *
 * A real, playable board (chess.js for the rules) against an AI character. You're
 * white; the house plays black with a small negamax + alpha-beta search (material +
 * centre control) — a casual-but-real opponent. The character is alive: it greets,
 * reacts to captures/checks/mate and talks trash through the live LLM (/api/chat),
 * and can speak it aloud (/api/tts). Stockfish would make it a "1%" opponent — the
 * search is swappable for it later.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Chess, type Square } from "chess.js"
import { detectLanguage, LANGUAGE_TO_BCP47 } from "@/lib/languages"

// Append U+FE0E (text variation selector) so the chess glyphs render as monochrome
// TEXT, not emoji — otherwise macOS/iOS paint them black and the CSS color is ignored
// (white pieces come out dark). With text rendering, `color` works for both sides.
const GLYPH: Record<string, string> = { k: "♚︎", q: "♛︎", r: "♜︎", b: "♝︎", n: "♞︎", p: "♟︎" }
const VAL: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 }

// ── the opponent: negamax + alpha-beta, material + centre control ──
function evalWhite(g: Chess): number {
  if (g.isCheckmate()) return g.turn() === "w" ? -1e6 : 1e6
  if (g.isDraw() || g.isStalemate()) return 0
  let s = 0
  const b = g.board()
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const sq = b[r][f]; if (!sq) continue
    const centre = (3.5 - Math.abs(f - 3.5)) + (3.5 - Math.abs((7 - r) - 3.5))
    const cb = (sq.type === "n" || sq.type === "b" || sq.type === "p") ? centre * 3 : centre
    s += sq.color === "w" ? VAL[sq.type] + cb : -(VAL[sq.type] + cb)
  }
  return s
}
function negamax(g: Chess, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || g.isGameOver()) return (g.turn() === "w" ? 1 : -1) * evalWhite(g)
  let best = -Infinity
  const moves = g.moves({ verbose: true }).sort((a, b) => (b.captured ? VAL[b.captured] : 0) - (a.captured ? VAL[a.captured] : 0))
  for (const m of moves) {
    g.move(m)
    const sc = -negamax(g, depth - 1, -beta, -alpha)
    g.undo()
    if (sc > best) best = sc
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}
function bestMove(g: Chess, depth = 3) {
  let best = null, bs = -Infinity
  const moves = g.moves({ verbose: true }).sort((a, b) => (b.captured ? VAL[b.captured] : 0) - (a.captured ? VAL[a.captured] : 0))
  for (const m of moves) {
    g.move(m)
    const sc = -negamax(g, depth - 1, -Infinity, Infinity)
    g.undo()
    if (sc > bs) { bs = sc; best = m }
  }
  return best
}

export function ChessRoom({ name = "Kai", onClose }: { name?: string; onClose?: () => void }) {
  const gameRef = useRef(new Chess())
  const [fen, setFen] = useState(gameRef.current.fen())
  const [sel, setSel] = useState<Square | null>(null)
  const [targets, setTargets] = useState<Square[]>([])
  const [status, setStatus] = useState("your move — you're white")
  const [thinking, setThinking] = useState(false)
  const [banter, setBanter] = useState<string>(`${name.toLowerCase()} racks the pieces… "sit. let's see what you've got."`)
  // talk-while-playing: a chat you can open over the lower screen without leaving the board
  const [chatOpen, setChatOpen] = useState(false)
  const [chat, setChat] = useState<{ who: "you" | "kai"; text: string }[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatBusy, setChatBusy] = useState(false)
  const [chatListen, setChatListen] = useState(false)
  const chatRef = useRef<{ who: "you" | "kai"; text: string }[]>([])
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const chatRecRef = useRef<any>(null) // eslint-disable-line @typescript-eslint/no-explicit-any
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const banterTok = useRef(0)
  const langRef = useRef("English")   // the house talks your language
  useEffect(() => { langRef.current = detectLanguage() }, [])
  const pushChat = (who: "you" | "kai", text: string) => { const n = [...chatRef.current, { who, text }]; chatRef.current = n; setChat(n); setTimeout(() => chatScrollRef.current?.scrollTo({ top: 1e9 }), 0) }
  const engineRef = useRef<{ worker: Worker; ready: boolean; resolve: ((m: string | null) => void) | null } | null>(null)

  // Load Stockfish (self-contained asm.js) as a CDN blob worker — a genuinely
  // strong opponent. UCI Skill Level keeps it a fair fight, not brutal. Falls back
  // to the built-in negamax if the engine can't load.
  useEffect(() => {
    let dead = false
    fetch("https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js")
      .then((r) => r.text())
      .then((code) => {
        if (dead) return
        const worker = new Worker(URL.createObjectURL(new Blob([code], { type: "application/javascript" })))
        const eng = { worker, ready: false, resolve: null as null | ((m: string | null) => void) }
        worker.onmessage = (e: MessageEvent) => {
          const line = typeof e.data === "string" ? e.data : (e.data && e.data.data) || ""
          if (line === "uciok") worker.postMessage("isready")
          else if (line === "readyok") eng.ready = true
          else if (typeof line === "string" && line.startsWith("bestmove")) {
            const mv = line.split(" ")[1]; const r = eng.resolve; eng.resolve = null; if (r) r(mv || null)
          }
        }
        worker.postMessage("uci")
        worker.postMessage("setoption name Skill Level value 14")
        engineRef.current = eng
      })
      .catch(() => { /* CDN blocked → negamax fallback */ })
    return () => { dead = true; try { engineRef.current?.worker.terminate() } catch { /* */ } engineRef.current = null }
  }, [])

  const stockfishMove = (fen: string, movetime = 700): Promise<string | null> => new Promise((resolve) => {
    const eng = engineRef.current
    if (!eng || !eng.ready) return resolve(null)
    eng.resolve = resolve
    eng.worker.postMessage("position fen " + fen)
    eng.worker.postMessage("go movetime " + movetime)
    setTimeout(() => { if (eng.resolve === resolve) { eng.resolve = null; resolve(null) } }, movetime + 3000)
  })

  const speak = useCallback(async (text: string) => {
    const tok = ++banterTok.current
    try {
      const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, personaName: name, gender: "male", language: langRef.current }) })
      if (!res.ok || banterTok.current !== tok) return
      const url = URL.createObjectURL(await res.blob()); const a = audioRef.current
      if (a) { a.src = url; a.onended = () => URL.revokeObjectURL(url); await a.play().catch(() => {}) }
    } catch { /* */ }
  }, [name])

  const quip = useCallback(async (event: string) => {
    try {
      const persona = {
        name, personality: `You are ${name}, a sharp, cocky, playful chess hustler in a late-night arena. You're mid-game against the person across the board. React to what just happened in ONE short spoken line — trash talk, a dare, a smirk. Never explain chess, never list moves.`,
        speakingStyle: "spoken, cocky, casual, a little dangerous", backstory: "", language: langRef.current,
      }
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ persona, messages: [{ role: "user", content: event }] }) })
      if (!res.ok || !res.body) return
      const rd = res.body.getReader(); const dec = new TextDecoder(); let full = ""
      for (;;) { const { done, value } = await rd.read(); if (done) break; full += dec.decode(value) }
      full = full.trim()
      if (full) { setBanter(full); pushChat("kai", full); speak(full) }
    } catch { /* */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, speak])

  // chat to the house while you play — text or voice, the board keeps going
  const sendChat = async (override?: string) => {
    const text = (override ?? chatInput).trim()
    if (!text || chatBusy) return
    setChatInput(""); pushChat("you", text); setChatBusy(true)
    try {
      const persona = { name, personality: `You are ${name}, a cocky, playful chess hustler mid-game against this person. Talk WITH them — banter, smack talk, dares, but you can hold a real conversation too. Keep it to one or two short spoken lines. Never list chess moves.`, speakingStyle: "spoken, cocky, casual", backstory: "", language: langRef.current }
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ persona, messages: chatRef.current.map((m) => ({ role: m.who === "you" ? "user" as const : "assistant" as const, content: m.text })) }) })
      let full = ""
      if (res.ok && res.body) { const rd = res.body.getReader(); const dec = new TextDecoder(); for (;;) { const { done, value } = await rd.read(); if (done) break; full += dec.decode(value) } }
      full = full.trim()
      if (full) { pushChat("kai", full); setBanter(full); speak(full) }
    } catch { /* */ } finally { setChatBusy(false) }
  }
  const chatTalk = () => {
    if (chatListen) { try { chatRecRef.current?.stop() } catch { /* */ } setChatListen(false); return }
    const w = window as any // eslint-disable-line @typescript-eslint/no-explicit-any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR(); rec.lang = LANGUAGE_TO_BCP47[langRef.current] || "en-US"; rec.interimResults = false; rec.continuous = false
    rec.onresult = (e: any) => { const t = e.results?.[0]?.[0]?.transcript?.trim(); setChatListen(false); if (t) sendChat(t) } // eslint-disable-line
    rec.onerror = () => setChatListen(false); rec.onend = () => setChatListen(false)
    chatRecRef.current = rec
    try { rec.start(); setChatListen(true) } catch { setChatListen(false) }
  }

  useEffect(() => { quip("You just sat down across from me to play. Greet me — set the tone."); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  const sync = () => setFen(gameRef.current.fen())
  const afterMove = useCallback((captured?: string, check?: boolean) => {
    const g = gameRef.current
    if (g.isCheckmate()) { setStatus(g.turn() === "w" ? "checkmate — the house wins" : "checkmate — you win"); quip(g.turn() === "w" ? "You just checkmated them. Gloat." : "You just got checkmated by them. React — stunned, then respect."); return true }
    if (g.isDraw() || g.isStalemate()) { setStatus("a draw — even tonight"); quip("The game just drew. Shrug it off with a line."); return true }
    if (check) { setStatus(g.turn() === "w" ? "you're in check" : "check — careful"); quip("You just put them in check. One playful, threatening line."); return false }
    if (captured) { quip(`You just took a ${({ p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen" } as Record<string, string>)[captured] || "piece"}. One short line of trash talk.`) }
    return false
  }, [quip])

  const aiMove = useCallback(async () => {
    const g = gameRef.current
    if (g.isGameOver()) return
    setThinking(true)
    let res: ReturnType<Chess["move"]> | null = null
    const uci = await stockfishMove(g.fen(), 700).catch(() => null)   // strong: Stockfish
    if (uci && uci.length >= 4 && uci !== "(none)") {
      try { res = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: ((uci[4] || "q") as "q" | "r" | "b" | "n") }) } catch { res = null }
    }
    if (!res) { const m = bestMove(g, 3); if (m) { try { res = g.move(m) } catch { res = null } } }   // fallback: built-in negamax
    sync(); setThinking(false)
    if (res && !afterMove(res.captured, g.isCheck())) setStatus("your move")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afterMove])

  const onSquare = (sq: Square) => {
    const g = gameRef.current
    if (g.turn() !== "w" || thinking || g.isGameOver()) return
    if (sel) {
      if (targets.includes(sq)) {
        const res = g.move({ from: sel, to: sq, promotion: "q" })
        setSel(null); setTargets([]); sync()
        if (res && !afterMove(res.captured, g.isCheck())) { setStatus(`${name.toLowerCase()} is thinking…`); aiMove() }
        return
      }
      setSel(null); setTargets([])
    }
    const piece = g.get(sq)
    if (piece && piece.color === "w") {
      setSel(sq)
      setTargets(g.moves({ square: sq, verbose: true }).map((m) => m.to as Square))
    }
  }

  const reset = () => { gameRef.current = new Chess(); setSel(null); setTargets([]); setThinking(false); setStatus("your move — you're white"); sync(); quip("You just reset the board for a rematch. One cocky line.") }

  const board = gameRef.current.board()
  const over = gameRef.current.isGameOver()   // "new game" only earns its spot once the game is done
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"]
  // Board sized by the viewport's SHORT side minus chrome, so it never exceeds the
  // screen in either orientation (the landscape-overflow fix). Glyphs scale off it.
  const BSIZE = "min(92vw, 460px, calc(100dvh - 240px))"

  return (
    <div style={{ position: "fixed", inset: 0, background: "#06070e", color: "#eef4f8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflowY: "auto", WebkitOverflowScrolling: "touch", paddingTop: "calc(16px + env(safe-area-inset-top))", paddingBottom: "calc(16px + env(safe-area-inset-bottom))", paddingLeft: "calc(16px + env(safe-area-inset-left))", paddingRight: "calc(16px + env(safe-area-inset-right))", boxSizing: "border-box", fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
      <div style={{ width: "min(92vw, 460px)", margin: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* header — aligned to the board's edges */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 12, color: "#9fb2c4", letterSpacing: 1 }}>the arena · chess</div>
            <div style={{ fontSize: 18, fontWeight: 500 }}>{name} · the house</div>
          </div>
          <button onClick={() => onClose ? onClose() : (window.location.href = "/airraw")} style={{ flex: "0 0 auto", fontSize: 13, color: "#cdd9e3", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.2)", padding: "11px 14px", minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 12, cursor: "pointer", whiteSpace: "nowrap", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>← leave</button>
        </div>

        <div style={{ fontSize: 13, color: "#cfe0ee", height: 40, display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden", textAlign: "center", fontStyle: "italic", lineHeight: 1.4 }}>&ldquo;{banter}&rdquo;</div>

        <div style={{ width: BSIZE, maxWidth: "100%", margin: "0 auto", aspectRatio: "1", display: "grid", gridTemplateColumns: "repeat(8,1fr)", fontSize: `calc(${BSIZE} / 11)`, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,.12)" }}>
          {board.map((row, r) => row.map((sq, f) => {
            const square = (files[f] + (8 - r)) as Square
            const dark = (r + f) % 2 === 1
            const isSel = sel === square
            const isTarget = targets.includes(square)
            return (
              <button key={square} onClick={() => onSquare(square)} style={{ position: "relative", border: "none", cursor: "pointer", background: isSel ? "#3f7d6e" : dark ? "#2f3e49" : "#647686", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                {sq && <span style={{ fontSize: "1em", lineHeight: 1, color: sq.color === "w" ? "#f6f7f4" : "#0c1014", textShadow: sq.color === "w" ? "0 1px 3px rgba(0,0,0,.55)" : "0 1px 1px rgba(255,255,255,.2)" }}>{GLYPH[sq.type]}</span>}
                {isTarget && <span style={{ position: "absolute", width: sq ? "100%" : "30%", height: sq ? "100%" : "30%", borderRadius: sq ? 0 : "50%", background: sq ? "transparent" : "rgba(127,214,160,.55)", boxShadow: sq ? "inset 0 0 0 3px rgba(127,214,160,.75)" : "none", pointerEvents: "none" }} />}
              </button>
            )
          }))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13, minHeight: 44 }}>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: thinking ? "#7fd6c0" : "#9fb2c4" }}>{thinking ? `${name.toLowerCase()} is thinking…` : status}</span>
          {over
            ? <button onClick={reset} style={{ flex: "0 0 auto", fontSize: 13, minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#1a0d08", background: "#ef7a4d", border: "none", borderRadius: 12, padding: "11px 18px", cursor: "pointer", whiteSpace: "nowrap", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>new game</button>
            : <button onClick={() => setChatOpen(true)} style={{ flex: "0 0 auto", fontSize: 13, minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#dfeaf2", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.2)", borderRadius: 12, padding: "11px 16px", cursor: "pointer", whiteSpace: "nowrap", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>💬 talk</button>}
        </div>
        <div style={{ fontSize: 12, color: "#6b8092", textAlign: "center" }}>{void fen}you&apos;re white · tap a piece, then a square</div>
      </div>
      {chatOpen && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "min(46vh, 430px)", zIndex: 5, background: "linear-gradient(180deg, rgba(6,7,14,0) 0%, rgba(6,7,14,.96) 20%)", display: "flex", flexDirection: "column", paddingTop: 14, fontFamily: "var(--font-geist), system-ui, sans-serif" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "0 max(16px, env(safe-area-inset-right)) 8px max(16px, env(safe-area-inset-left))" }}>
            <span style={{ fontSize: 12, color: "#9fb2c4", letterSpacing: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>talking to {name} · game&apos;s still on</span>
            <button onClick={() => setChatOpen(false)} style={{ flex: "0 0 auto", fontSize: 13, minHeight: 40, color: "#cdd9e3", background: "rgba(255,255,255,.08)", border: ".5px solid rgba(255,255,255,.2)", borderRadius: 12, padding: "8px 12px", cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>↓ board</button>
          </div>
          <div ref={chatScrollRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", padding: "4px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            {chat.length === 0 && <div style={{ fontSize: 13, color: "#5f7283", textAlign: "center", marginTop: 8 }}>say something to {name.toLowerCase()} while you play…</div>}
            {chat.map((m, i) => (
              <div key={i} style={{ alignSelf: m.who === "you" ? "flex-end" : "flex-start", maxWidth: "82%", fontSize: 14.5, lineHeight: 1.4, color: m.who === "you" ? "#0a1622" : "#eef4f8", background: m.who === "you" ? "#cfe0ee" : "rgba(255,255,255,.1)", padding: "8px 12px", borderRadius: 14 }}>{m.text}</div>
            ))}
            {chatBusy && <div style={{ alignSelf: "flex-start", fontSize: 12, color: "#7f93a5", fontStyle: "italic" }}>{name.toLowerCase()} is talking…</div>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px max(16px, env(safe-area-inset-left)) calc(env(safe-area-inset-bottom) + 12px) max(16px, env(safe-area-inset-right))" }}>
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendChat() }} placeholder={chatListen ? "listening…" : `talk to ${name.toLowerCase()}…`} style={{ flex: 1, minWidth: 0, fontSize: 16, color: "#eef4f8", background: "rgba(255,255,255,.07)", border: ".5px solid rgba(255,255,255,.18)", borderRadius: 14, padding: "11px 14px", minHeight: 44, boxSizing: "border-box", outline: "none" }} />
            <button onClick={chatInput.trim() ? () => sendChat() : chatTalk} disabled={chatBusy && !!chatInput.trim()} aria-label={chatInput.trim() ? "send" : "talk"} style={{ flex: "0 0 auto", width: 62, height: 44, borderRadius: 14, fontSize: chatInput.trim() ? 14 : 18, fontWeight: 600, lineHeight: 1, border: "none", cursor: "pointer", color: chatInput.trim() ? "#1a0d08" : (chatListen ? "#06201a" : "#dfeaf2"), background: chatInput.trim() ? "#ef7a4d" : (chatListen ? "#7fd6c0" : "rgba(255,255,255,.12)"), WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>{chatInput.trim() ? "send" : (chatListen ? "•••" : "🎙")}</button>
          </div>
        </div>
      )}
      <audio ref={audioRef} style={{ display: "none" }} />
    </div>
  )
}
