// Call audio output: volume, which speaker it comes out of, and keeping the
// sound alive when the page isn't on screen.

const VOL_KEY = "airraw_volume"
const SINK_KEY = "airraw_sink"

/**
 * The saved volume, or full volume for anyone who has never set one.
 *
 * This read used to be `Number(localStorage.getItem(VOL_KEY))`, and getItem
 * returns null when the key has never been written. Number(null) is 0 — which
 * is finite, is >= 0 and is <= 1, so it sailed through the range check below and
 * was returned as a real preference. The `: 1` fallback only ever caught a
 * garbage string.
 *
 * Every first-time visitor therefore started a private call at volume zero. She
 * spoke, the voice engine billed for it, and they heard silence — on the one
 * screen the pass exists to sell. An explicit "was anything ever stored" check
 * is the whole fix, and the missing-key case has to be tested, because a range
 * check that accepts 0 cannot tell absence from a choice.
 */
export function loadVolume(): number {
  try {
    if (typeof localStorage === "undefined") return 1
    const stored = localStorage.getItem(VOL_KEY)
    if (stored === null || stored === "") return 1
    const raw = Number(stored)
    // A stored 0 is honoured — someone may genuinely have slid it to nothing.
    return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 1
  } catch { return 1 }
}

export function saveVolume(v: number) {
  try { localStorage.setItem(VOL_KEY, String(v)) } catch { /* private mode */ }
}

export interface OutputDevice { id: string; label: string }

/**
 * Can this browser choose which speaker plays the call? setSinkId is Chromium-only
 * today — Safari (so every iPhone) has no API for it at all, and routing there is
 * decided by the OS. Feature-detected rather than sniffed, so the control simply
 * doesn't render where it can't work instead of appearing and doing nothing.
 */
export function canChooseOutput(): boolean {
  return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype
}

/**
 * Available speakers. Labels are only populated once the user has granted a media
 * permission — which by this point in a call they have, since the mic is live.
 */
export async function listOutputs(): Promise<OutputDevice[]> {
  if (!canChooseOutput() || !navigator.mediaDevices?.enumerateDevices) return []
  try {
    const all = await navigator.mediaDevices.enumerateDevices()
    return all
      .filter((d) => d.kind === "audiooutput")
      .map((d, i) => ({ id: d.deviceId, label: d.label || (d.deviceId === "default" ? "default" : `speaker ${i + 1}`) }))
  } catch {
    return []
  }
}

export function loadSink(): string {
  if (typeof localStorage === "undefined") return ""
  return localStorage.getItem(SINK_KEY) || ""
}

export async function applySink(el: HTMLMediaElement, deviceId: string): Promise<boolean> {
  if (!deviceId || !canChooseOutput()) return false
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (el as any).setSinkId(deviceId)
    try { localStorage.setItem(SINK_KEY, deviceId) } catch { /* private mode */ }
    return true
  } catch {
    // Device unplugged since it was chosen, or permission withdrawn — fall back to
    // the system default rather than leaving the call with no audio path.
    return false
  }
}

/**
 * Register the call with the OS media session, so audio keeps playing when the
 * page is backgrounded and the call shows up on the lock screen / media keys.
 *
 * Without this a browser is free to treat the audio as incidental and pause it on
 * blur. With it, the tab is a media session and stays audible — the same
 * mechanism a music site uses. Returns a cleanup function.
 *
 * This governs PLAYBACK only. Capture is a separate problem: on iOS, leaving the
 * browser suspends the mic no matter what, and no web API can prevent it.
 */
export function bindMediaSession(opts: {
  title: string
  artist: string
  artwork?: string
  onStop?: () => void
}): () => void {
  const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined
  if (!ms) return () => {}
  const prev = ms.metadata
  try {
    ms.metadata = new MediaMetadata({
      title: opts.title,
      artist: opts.artist,
      ...(opts.artwork ? { artwork: [{ src: opts.artwork, sizes: "512x512", type: "image/jpeg" }] } : {}),
    })
    ms.playbackState = "playing"
    // A live call has nothing to seek or skip, and leaving the default handlers in
    // place puts dead buttons on the user's lock screen. Only stop is real.
    for (const a of ["seekbackward", "seekforward", "previoustrack", "nexttrack"] as const) {
      try { ms.setActionHandler(a, null) } catch { /* unsupported action */ }
    }
    try { ms.setActionHandler("stop", opts.onStop ? () => opts.onStop!() : null) } catch { /* */ }
    // play/pause must be handled or some browsers refuse to show the session.
    try { ms.setActionHandler("pause", opts.onStop ? () => opts.onStop!() : null) } catch { /* */ }
    try { ms.setActionHandler("play", () => { ms.playbackState = "playing" }) } catch { /* */ }
  } catch { /* MediaMetadata unavailable */ }

  return () => {
    try {
      ms.playbackState = "none"
      ms.metadata = prev
      try { ms.setActionHandler("stop", null) } catch { /* */ }
      try { ms.setActionHandler("pause", null) } catch { /* */ }
      try { ms.setActionHandler("play", null) } catch { /* */ }
    } catch { /* */ }
  }
}
