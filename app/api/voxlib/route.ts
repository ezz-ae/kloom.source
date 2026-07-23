// TEMPORARY diagnostic — browse the ElevenLabs SHARED voice library and ADD voices to
// the account (so more native-Arabic / English voices become usable). Gated by a token,
// removed right after use. Returns only public voice metadata; adds only on explicit POST.
export const runtime = "nodejs"
const TOK = "voxlib-7q2"

// GET ?mode=account            → the account's current voices
// GET ?mode=shared&lang=ar&gender=female&n=24  → shared-library candidates
export async function GET(req: Request) {
  const u = new URL(req.url)
  if (u.searchParams.get("k") !== TOK) return Response.json({ error: "nope" }, { status: 404 })
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return Response.json({ error: "no key" }, { status: 500 })
  const mode = u.searchParams.get("mode") || "account"
  try {
    if (mode === "account") {
      const res = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } })
      const data = await res.json() as { voices?: Array<{ voice_id: string; name: string; labels?: Record<string, string>; category?: string }> }
      return Response.json({ count: (data.voices || []).length, voices: (data.voices || []).map((v) => ({ id: v.voice_id, name: v.name, gender: v.labels?.gender, accent: v.labels?.accent, category: v.category })) })
    }
    // shared library
    const lang = u.searchParams.get("lang") || ""
    const gender = u.searchParams.get("gender") || ""
    const n = u.searchParams.get("n") || "24"
    const qs = new URLSearchParams({ page_size: n, sort: "trending" })
    if (lang) qs.set("language", lang)
    if (gender) qs.set("gender", gender)
    const res = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${qs}`, { headers: { "xi-api-key": key } })
    if (!res.ok) return Response.json({ error: `shared ${res.status}`, body: (await res.text()).slice(0, 300) }, { status: 502 })
    const data = await res.json() as { voices?: Array<Record<string, unknown>> }
    const voices = (data.voices || []).map((v) => ({
      owner: v.public_owner_id, voice: v.voice_id, name: v.name, gender: v.gender,
      accent: v.accent, language: v.language, age: v.age, cloned: v.cloned_by_count, use: v.usage_character_count_1y,
    }))
    return Response.json({ count: voices.length, voices })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 })
  }
}

// POST { add: [{ owner, voice, name }] } → add each shared voice to the account,
// returns the NEW account voice_id for each (that's what the pools then use).
export async function POST(req: Request) {
  const u = new URL(req.url)
  if (u.searchParams.get("k") !== TOK) return Response.json({ error: "nope" }, { status: 404 })
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return Response.json({ error: "no key" }, { status: 500 })
  let body: { add?: Array<{ owner: string; voice: string; name: string }> } = {}
  try { body = await req.json() } catch { return Response.json({ error: "bad json" }, { status: 400 }) }
  const results: Array<Record<string, unknown>> = []
  for (const a of body.add || []) {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/voices/add/${a.owner}/${a.voice}`, {
        method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ new_name: a.name }),
      })
      const j = await res.json().catch(() => ({}))
      results.push({ name: a.name, ok: res.ok, status: res.status, newId: (j as { voice_id?: string }).voice_id, err: res.ok ? undefined : JSON.stringify(j).slice(0, 200) })
    } catch (e) {
      results.push({ name: a.name, ok: false, err: e instanceof Error ? e.message : "failed" })
    }
  }
  return Response.json({ results })
}
