// THE CHARACTER REGISTRY, OVER MCP — authoring, inspecting and previewing
// characters out of band, on the same registry the product speaks from.
//
// lib/airraw/persona.ts explains why the registry itself is in-process: it sits
// on the path between a person finishing a sentence and hearing a voice, and a
// protocol hop there costs a round trip for nothing. This is the OTHER side of
// that line. Every tool here calls into the registry and the profile
// computation; none of them mints, stores or changes anything. So what these
// tools show is exactly what the floor will do — the two cannot disagree — and
// a new character can be drafted, read back and previewed on every surface
// without touching a component.
//
// Registered on the adult build only (app/api/mcp/route.ts): the cast is the
// AIRRAW cast. Kloom never lists or runs these.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { CAST_LANGS, byId, castIn, identityFor, clusterFor, soulPrompt, type Lang } from "@/lib/airraw/cast50"
import { profileFor, lookLine, cardFor } from "@/lib/airraw/profile"
import { renderPersona, namedCharacter, SURFACE_NAMES, type Surface } from "@/lib/airraw/persona"
import { accentForSeed, arabicDialectLine } from "@/lib/airraw/accent"
import { faceSeedFor, type Cluster } from "@/lib/airroom/roster"

const LANG_NAME: Record<Lang, string> = { en: "English", ar: "Arabic", es: "Spanish", fr: "French", tr: "Turkish", ru: "Russian" }
const langArg = z.enum(CAST_LANGS as [Lang, ...Lang[]]).default("en").describe("The language the character appears in — name and origin follow it; soul and voice never do")
const surfaceArg = z.enum(SURFACE_NAMES as [Surface, ...Surface[]]).describe("Where they are appearing: call, room, group, scene or game")

const text = (v: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(v, null, 2) }] })
const fail = (msg: string) => ({ content: [{ type: "text" as const, text: msg }], isError: true })

/** Everything the floor derives from one character, in one object. */
function describe(c: Cluster) {
  const p = profileFor(c)
  const seedKey = faceSeedFor(c) || c.host
  return {
    key: c.key || c.host,
    seedKey,
    profile: p,
    lookLine: lookLine(p),
    card: cardFor(p),
    voice: { seedKey, accent: accentForSeed(seedKey), arabicDialect: arabicDialectLine(seedKey).trim() || null, voiceId: c.voiceId ?? null },
  }
}

export function registerCastTools(server: McpServer) {
  server.registerTool(
    "cast_list",
    {
      title: "List the written cast",
      description: "The fifty written characters, as they appear in one language. Returns id, name, gender, band and look. Use cast_get for everything about one of them.",
      inputSchema: { lang: langArg },
    },
    async ({ lang }) => text(castIn(lang).map((i) => ({ id: i.id, name: i.name, gender: i.gender === "f" ? "female" : "male", band: i.band, look: i.look }))),
  )

  server.registerTool(
    "cast_get",
    {
      title: "Everything about one character",
      description: "One written character, fully derived: identity in the chosen language, the computed profile (body, work, where, what's on their mind, opinion, peeve, tell), the card lines, the face seed, and the voice (accent, Arabic dialect, voice id). This is what the floor itself reads — nothing here is a second copy.",
      inputSchema: { id: z.string().min(1).describe("The character id from cast_list"), lang: langArg },
    },
    async ({ id, lang }) => {
      const m = byId(id)
      if (!m) return fail(`no character with id "${id}" — see cast_list`)
      const who = identityFor(m, lang)
      return text({ identity: { id: who.id, lang: who.lang, name: who.name, gender: who.gender === "f" ? "female" : "male", look: who.look, openers: who.openers, band: who.band }, ...describe(clusterFor(m, lang)) })
    },
  )

  server.registerTool(
    "cast_preview",
    {
      title: "Preview a character on a surface",
      description: "The exact persona the model is handed for this character on this surface — the same renderPersona() the call, room, group, scene and game use. Change a character in the registry and this is how to see what every surface will now say.",
      inputSchema: { id: z.string().min(1), surface: surfaceArg, lang: langArg, mood: z.string().max(40).optional().describe("Room mood, where the surface has one"), others: z.string().max(200).optional().describe("Who else is present, where the surface has others") },
    },
    async ({ id, surface, lang, mood, others }) => {
      const m = byId(id)
      if (!m) return fail(`no character with id "${id}" — see cast_list`)
      const who = identityFor(m, lang)
      const c = clusterFor(m, lang)
      return text(renderPersona(c, surface, { soul: soulPrompt(who), language: LANG_NAME[lang], mood, others }))
    },
  )

  server.registerTool(
    "cast_voice",
    {
      title: "How a character sounds",
      description: "The voice side of one character: the seed their accent and face are both derived from, the accent, the Arabic dialect steer (if they have an Arabic-region origin), and the pinned voice id where one exists. Face and voice come from the same seed, so they always agree.",
      inputSchema: { id: z.string().min(1), lang: langArg },
    },
    async ({ id, lang }) => {
      const m = byId(id)
      if (!m) return fail(`no character with id "${id}" — see cast_list`)
      const c = clusterFor(m, lang)
      return text({ id, name: c.host, ...describe(c).voice, voiceLayers: m.voice })
    },
  )

  server.registerTool(
    "cast_draft",
    {
      title: "Draft a new character and see them everywhere",
      description: "Make a character from three facts — name, archetype, gender — and read back everything the floor would derive for them: profile, card, face seed, voice, and the persona on a chosen surface. Nothing is stored; this is the registry showing what a new entry would become before it is written.",
      inputSchema: { host: z.string().min(1).max(40).describe("Their name"), archetype: z.string().min(1).max(40).describe("The archetype key, which also seeds their face and accent"), gender: z.enum(["female", "male"]), surface: surfaceArg.default("call"), lang: langArg },
    },
    async ({ host, archetype, gender, surface, lang }) => {
      const c = namedCharacter(host, archetype, gender)
      return text({ ...describe(c), persona: renderPersona(c, surface, { language: LANG_NAME[lang] }) })
    },
  )
}

/** The tool names, so the route can gate them and a test can walk them. */
export const CAST_TOOLS = ["cast_list", "cast_get", "cast_preview", "cast_voice", "cast_draft"] as const
