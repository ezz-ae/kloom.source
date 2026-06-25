"use client"

import { useEffect, useRef, useState } from "react"
import { imageFor } from "@/lib/persona-utils"
import { faceUrl, cachedFace } from "@/lib/airraw/face"

/**
 * A persona's face — real, never a flat gradient monogram. Uses the stored portrait
 * (an explicit photoUrl, or a curated /cast/*.jpg) when one exists; otherwise generates
 * a real, diverse face via the AIRRAW photo pipeline (/api/character-photo, which
 * generates-once-and-caches-forever server-side) and swaps it in. The monogram only ever
 * shows for the instant before the real face resolves. De-duped + cached across the app.
 */
export function RoomFace({
  name, gender, photoUrl, seed, className, alt,
}: {
  name: string
  gender?: string
  photoUrl?: string
  seed?: string
  className?: string
  alt?: string
}) {
  const key = seed ?? name
  const base = imageFor({ name: key, photoUrl })
  // photoUrl (http) and /cast/*.jpg are real photos; a data: URI is the SVG monogram.
  const isReal = !base.startsWith("data:")
  const [src, setSrc] = useState(() => (isReal ? base : cachedFace({ name, gender, seed: key }) || base))
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    if (isReal) return
    const cached = cachedFace({ name, gender, seed: key })
    if (cached) { setSrc(cached); return () => { alive.current = false } }
    faceUrl({ name, gender, seed: key }).then((u) => { if (u && alive.current) setSrc(u) })
    return () => { alive.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, gender])

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt ?? name} className={className} loading="lazy" />
}
