// TEMPORARY diagnostic — lists the ElevenLabs account's voices (id + name + gender +
// category) so the voice pools can be populated accurately. Gated behind a token and
// removed right after use. Returns NO secrets — only public voice metadata.
export const runtime = "nodejs"

export async function GET(req: Request) {
  const u = new URL(req.url)
  if (u.searchParams.get("k") !== "voxlist-7q2") return Response.json({ error: "nope" }, { status: 404 })
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return Response.json({ error: "no key" }, { status: 500 })
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } })
    if (!res.ok) return Response.json({ error: `el ${res.status}`, body: (await res.text()).slice(0, 300) }, { status: 502 })
    const data = await res.json() as { voices?: Array<{ voice_id: string; name: string; category?: string; labels?: Record<string, string> }> }
    const voices = (data.voices || []).map((v) => ({
      id: v.voice_id,
      name: v.name,
      category: v.category,
      gender: v.labels?.gender || "",
      accent: v.labels?.accent || "",
      age: v.labels?.age || "",
      descriptive: v.labels?.descriptive || v.labels?.description || "",
    }))
    return Response.json({ count: voices.length, voices })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 })
  }
}
