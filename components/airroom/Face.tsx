"use client"

// A face <img> that shows the cheap fallback (gradient/initial) instantly, then
// swaps to the persona's live, diverse, generated photo once it resolves — fading
// in so the floor never flashes empty. Drop-in for `<img src={imageFor(...)}>`.

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { faceUrl, cachedFace, type FacePersona } from "@/lib/airraw/face"
import { imageFor } from "@/lib/persona-utils"

export function Face({ persona, alt = "", style, className, lazy = true }: {
  persona: FacePersona
  alt?: string
  style?: CSSProperties
  className?: string
  lazy?: boolean
}) {
  const fallback = imageFor({ name: persona.seed || persona.name })
  const [src, setSrc] = useState<string>(() => cachedFace(persona) || fallback)
  const [loaded, setLoaded] = useState(false)
  const key = persona.seed || persona.name
  const lastKey = useRef(key)

  useEffect(() => {
    let on = true
    const c = cachedFace(persona)
    if (c) { setSrc(c); return }
    if (lastKey.current !== key) { setSrc(fallback); setLoaded(false); lastKey.current = key }
    faceUrl(persona).then((u) => { if (on && u) { setSrc(u); setLoaded(false) } })
    return () => { on = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const isLive = src !== fallback
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={lazy ? "lazy" : undefined}
      onLoad={() => setLoaded(true)}
      style={{ ...style, opacity: isLive && !loaded ? 0.55 : 1, transition: "opacity .45s ease" }}
    />
  )
}
