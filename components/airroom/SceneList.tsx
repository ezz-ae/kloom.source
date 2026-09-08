"use client"

/**
 * YOUR SCENES — what the tab becomes once you have made one.
 *
 * The tab used to be the builder and nothing else, so a scene existed only while
 * you were looking at it: leaving dropped it, and there was no way back in and
 * no way to make a second one without losing the first. That made the whole
 * feature read as a toy.
 *
 * So the tab has two states. With no scenes it is the builder, because a list of
 * nothing is not a screen. With scenes it is this: the ones you have, newest
 * first, and one button to start another. Tapping a row walks back into that
 * conversation exactly where it was.
 */
import { useEffect, useState } from "react"
import { listScenes, deleteScene, castLabel, lastLine, type SavedScene } from "@/lib/airraw/scenes"
import { fantasyById, castFor } from "@/lib/airraw/fantasy"
import { faceSeedFor } from "@/lib/airroom/roster"
import { Face } from "@/components/airroom/Face"

const ACCENT = "#f472b6"

export function SceneList({ onOpen, onNew }: {
  onOpen: (s: SavedScene) => void
  onNew: () => void
}) {
  const [scenes, setScenes] = useState<SavedScene[]>([])
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => { setScenes(listScenes()) }, [])

  const drop = (id: string) => {
    deleteScene(id)
    setScenes(listScenes())
    setConfirming(null)
  }

  return (
    <div style={{ color: "#f0e8ff", padding: "6px 16px 96px", maxWidth: 640, margin: "0 auto", boxSizing: "border-box" }}>
      <header style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -.3 }}>your scenes</div>
        <div style={{ fontSize: 12.5, color: "rgba(240,232,255,.45)" }}>
          {scenes.length} {scenes.length === 1 ? "scene" : "scenes"} · pick up where you left off
        </div>
      </header>

      <button onClick={onNew}
        style={{ width: "100%", padding: "15px 0", marginBottom: 14, borderRadius: 14, background: ACCENT,
          color: "#0d0418", fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
        + cast a new scene
      </button>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10, gridTemplateColumns: "minmax(0, 1fr)" }}>
        {scenes.map((s) => {
          const f = fantasyById(s.cfg.fantasyId)
          // Rebuild the cast from the saved seed so the faces on the row are the
          // faces in the scene — the whole point of keeping the seed.
          const cast = castFor(s.cfg, s.seed)
          return (
            <li key={s.id} style={{ background: "rgba(255,255,255,.05)", border: ".5px solid rgba(255,255,255,.11)", borderRadius: 14, overflow: "hidden", minWidth: 0 }}>
              <button onClick={() => onOpen(s)}
                style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "13px 15px 11px", cursor: "pointer", color: "#f0e8ff", fontFamily: "inherit", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                  <span style={{ display: "flex" }}>
                    {cast.slice(0, 4).map((c, i) => (
                      <Face key={c.key} persona={{ name: c.host, gender: c.gender, seed: faceSeedFor(c) }} alt={c.host}
                        style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", marginLeft: i ? -9 : 0,
                          border: "1.5px solid #14101c", flex: "0 0 auto" }} />
                    ))}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{castLabel(s)}</span>
                    <span style={{ display: "block", fontSize: 12, color: ACCENT + "cc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f?.label || "a scene"}</span>
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "rgba(240,232,255,.5)", lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {lastLine(s)}
                </div>
              </button>
              <div style={{ display: "flex", borderTop: ".5px solid rgba(255,255,255,.08)" }}>
                <button onClick={() => onOpen(s)}
                  style={{ flex: 1, padding: "10px 0", background: "none", border: "none", color: ACCENT, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  go back in
                </button>
                {confirming === s.id ? (
                  <button onClick={() => drop(s.id)}
                    style={{ flex: 1, padding: "10px 0", background: "none", border: "none", borderLeft: ".5px solid rgba(255,255,255,.08)", color: "#fb7185", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    delete it — sure?
                  </button>
                ) : (
                  <button onClick={() => setConfirming(s.id)} aria-label={`delete the scene with ${castLabel(s)}`}
                    style={{ flex: "0 0 auto", padding: "10px 16px", background: "none", border: "none", borderLeft: ".5px solid rgba(255,255,255,.08)", color: "rgba(240,232,255,.4)", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
                    delete
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
