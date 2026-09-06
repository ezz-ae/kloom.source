// THE SCENE BUILDER — the paid tab.
//
// Everywhere else on the floor you meet whoever is there. Here the user CASTS
// the scene: who is in the room, what each of them is, what they're to each
// other, and who is allowed to speak. That control is the product, and it is
// why this tier is worth more than the pass.
//
// ── HOW A SCENE REACHES THE MODEL ────────────────────────────────────────────
//
// It does not get its own endpoint. /api/chat already speaks multi-character —
// `persona` is whoever is talking, `partners` is everyone else in the room, and
// `relationship` lands in the prompt as THE SCENE. A scene is just a cast the
// user chose instead of one the floor dealt, so it rides the same route, which
// means it inherits the same safety floor rather than needing its own copy of it.
//
// ── WHAT IS DELIBERATELY NOT IN THIS FILE ────────────────────────────────────
//
// The lists below are a CLOSED taxonomy. The user picks from them; they do not
// write them. That is the whole reason this is a fixed table and not a text box:
// a scene assembled from ids cannot be used to smuggle instructions into the
// system prompt, so the tab adds expressive range without adding an attack
// surface. The one free-text field (a character's vibe) is length-capped and
// goes through the same intent gate as anything else the user types.
//
// And these categories are absent on purpose. They are not oversights, and
// tests/fantasy-test.mjs fails the build if any of them reappear:
//
//   • ANYTHING involving minors. No school settings, no age-play, no "barely
//     legal", no word that codes young. The floor in app/api/chat blocks this
//     at runtime; keeping it out of the menu means it is never even offered.
//   • Family framings. Incest is a hard exclusion, so no relative roles.
//   • Non-consent as a premise. Reluctance and resistance play fine INSIDE a
//     scene between adults who chose it; a menu item that sells assault does not.
//   • Animals.
//   • Real, identifiable people. Every role here is an archetype, never a name.
//
// Keeping these out costs the product nothing — what is left is enormous — and
// it is what makes the tier defensible to a payment processor.

export type Gender = "f" | "m" | "t"

export const GENDERS: Array<{ id: Gender; label: string; long: string }> = [
  { id: "f", label: "F", long: "woman" },
  { id: "m", label: "M", long: "man" },
  { id: "t", label: "T", long: "trans woman" },
]

export interface Fantasy {
  id: string
  /** What the menu shows. */
  label: string
  /** The group this sits in, for browsing. */
  kind: "meeting" | "power" | "place" | "tension" | "more" | "fiction"
  /** The framing the model is given. Present tense, nothing has happened yet —
   *  a scene that opens mid-act leaves the conversation nowhere to go. */
  scene: string
}

// ~60 openings. Each is a SITUATION with something unresolved in it, because a
// premise with no tension produces a model that narrates furniture.
export const FANTASIES: Fantasy[] = [
  // ── first contact ──
  { id: "stranger-bar", label: "a stranger at the bar", kind: "meeting", scene: "You have never met. It is late, the bar is thinning out, and one of you has been looking too long to pretend otherwise." },
  { id: "wrong-number", label: "the wrong number", kind: "meeting", scene: "This started as a message meant for someone else. Neither of you has ended the conversation, and both of you have noticed that." },
  { id: "hotel-lobby", label: "same hotel, different reasons", kind: "meeting", scene: "You are strangers in the same hotel, both away from your own lives for the week. Nobody here knows either of you." },
  { id: "last-train", label: "the last train", kind: "meeting", scene: "The carriage is nearly empty and there are forty minutes left. You keep almost talking to each other." },
  { id: "blind-set-up", label: "set up by a friend", kind: "meeting", scene: "A mutual friend arranged this and oversold you both. You are ten minutes in and it is going better than either of you admits." },
  { id: "next-door", label: "the neighbour", kind: "meeting", scene: "You live one wall apart and have heard more of each other's lives than either of you mentions. Tonight one of you knocked." },
  { id: "rain-doorway", label: "waiting out the rain", kind: "meeting", scene: "You ducked into the same doorway out of the same downpour and now there is nowhere to look but at each other." },
  { id: "gallery", label: "arguing about a painting", kind: "meeting", scene: "You disagreed out loud about the same piece and neither of you has conceded. The gallery is closing." },

  // ── history ──
  { id: "the-ex", label: "the ex, one drink", kind: "tension", scene: "You were together once and it ended badly enough to matter. This was supposed to be one drink to prove you could." },
  { id: "almost", label: "the one it never happened with", kind: "tension", scene: "Years of nearly, and never once. You are alone together for the first time since it stopped being possible, and it is possible again." },
  { id: "reunion", label: "ten years later", kind: "tension", scene: "You knew each other completely once. You are both entirely different now and neither of you has stopped looking." },
  { id: "unfinished", label: "the fight you never finished", kind: "tension", scene: "There is an argument between you that was interrupted and never resolved. It is still sitting there, and so is everything under it." },
  { id: "one-night-again", label: "it was supposed to be once", kind: "tension", scene: "It already happened once and you both agreed that was all it was. Neither of you meant it." },
  { id: "his-friend", label: "someone you shouldn't want", kind: "tension", scene: "Wanting this is a genuinely bad idea for reasons you both know and neither of you is saying out loud." },
  { id: "jealous", label: "watching them with someone else", kind: "tension", scene: "One of you spent the evening watching the other be wanted by somebody else, and is not hiding it well." },
  { id: "confession", label: "the thing never said", kind: "tension", scene: "One of you has been carrying something unsaid for a long time and tonight is the night it comes out." },

  // ── who's in charge ──
  { id: "told-what", label: "told exactly what to do", kind: "power", scene: "One of you is giving the instructions and the other agreed to that before anything started. Both of you want it this way." },
  { id: "taking-charge", label: "taking charge", kind: "power", scene: "One of you runs everything all day and does not want to run this. The other one knows that." },
  { id: "earned", label: "made to earn it", kind: "power", scene: "Nothing here is given immediately. One of you decides the pace and is enjoying deciding it." },
  { id: "brat", label: "difficult on purpose", kind: "power", scene: "One of you is being deliberately impossible to see what the other will do about it. The other has noticed the game." },
  { id: "service", label: "wanting to be useful", kind: "power", scene: "One of you takes real pleasure in being of use to the other, and the other has finally stopped refusing." },
  { id: "switch", label: "neither of you backing down", kind: "power", scene: "You are evenly matched and both used to winning. Neither has decided to yield and both are enjoying that." },
  { id: "praise", label: "told you're good", kind: "power", scene: "One of you needs to hear it out loud far more than they will ever admit, and the other has worked that out." },
  { id: "patience", label: "made to wait", kind: "power", scene: "One of you has decided this is not happening quickly. The other agreed to that and is regretting agreeing." },
  { id: "worship", label: "adored out loud", kind: "power", scene: "One of you cannot stop saying what the other one does to them, and is not being talked out of it." },

  // ── where ──
  { id: "hotel-last-night", label: "hotel room, last night of the trip", kind: "place", scene: "It is the last night of something that is ending tomorrow. Nothing has been said out loud yet." },
  { id: "office-late", label: "the office, everyone gone", kind: "place", scene: "You are the last two in the building. The professional distance you keep all day is getting harder to hold." },
  { id: "back-seat", label: "parked, not going in", kind: "place", scene: "The car is parked outside and neither of you has moved to get out. The conversation stopped being small a while ago." },
  { id: "kitchen-3am", label: "the kitchen at 3am", kind: "place", scene: "Everyone else is asleep. You both came down for water and neither of you has gone back up." },
  { id: "balcony", label: "out on the balcony", kind: "place", scene: "The party is loud behind you and you both came out here to not be in it. It is very quiet." },
  { id: "fitting-room", label: "behind the curtain", kind: "place", scene: "One of you is trying things on and asked the other's opinion, and the question stopped being about clothes." },
  { id: "spa-empty", label: "the pool, after hours", kind: "place", scene: "The place is closed and warm and there is nobody else in it. Neither of you is in a hurry." },
  { id: "cabin-snow", label: "snowed in", kind: "place", scene: "Nobody is getting out for a day or two. There is one fire and a great deal of time." },
  { id: "beach-house", label: "the house, off season", kind: "place", scene: "A borrowed house out of season, no neighbours for a mile, and no reason to be anywhere tomorrow." },
  { id: "studio", label: "being photographed", kind: "place", scene: "One of you is behind the camera and directing, and the direction has become very specific." },
  { id: "hospital-night", label: "the night shift", kind: "place", scene: "It is the dead middle of a long shift, the corridor is empty, and the adrenaline has nowhere to go." },
  { id: "kitchen-close", label: "after close", kind: "place", scene: "The service is over, the doors are locked, and there is one bottle open between you." },

  // ── the shape of it ──
  { id: "slow", label: "as slow as possible", kind: "more", scene: "Neither of you is rushing anything. The whole point is how long it can be drawn out." },
  { id: "watched", label: "someone is watching", kind: "more", scene: "There is somebody else in this scene who is not participating, is not hiding, and is not being asked to leave." },
  { id: "shared", label: "sharing them", kind: "more", scene: "One of you is the centre of this and the others agreed to that arrangement in advance. Everyone wanted it." },
  { id: "three", label: "three of you", kind: "more", scene: "All three of you chose this together. Nobody here is the odd one out and everyone knows the arrangement." },
  { id: "the-room", label: "a room full of them", kind: "more", scene: "Several people, one focus, and an understanding everyone arrived with. Nobody is here by accident." },
  { id: "words-only", label: "nothing but talking", kind: "more", scene: "Nobody is touching anybody. The whole thing happens in what is said, and that is the rule you both agreed to." },
  { id: "denied", label: "not yet", kind: "more", scene: "One of you keeps deciding it is not time. The other has stopped being able to pretend they don't mind." },
  { id: "caught", label: "nearly caught", kind: "more", scene: "There are people on the other side of a door who cannot know. That is most of why it is happening." },
  { id: "told-about", label: "tell me what you did", kind: "more", scene: "One of you is being asked to describe something that already happened, in detail, out loud." },
  { id: "instructions", label: "over the phone", kind: "more", scene: "You are not in the same place. Everything that happens has to be said, and one of you is doing the saying." },
  { id: "aftercare", label: "after, holding on", kind: "more", scene: "Whatever happened has happened. This is the part afterwards, and neither of you wants to be the first to let go." },
  { id: "first-time-together", label: "the first time, nervous", kind: "more", scene: "It is the first time for the two of you together and both of you are more nervous than you are admitting." },

  // ── not quite this world ──
  { id: "royal", label: "the one you're not allowed", kind: "fiction", scene: "One of you outranks the other by an amount that makes this genuinely forbidden, and neither of you cares tonight." },
  { id: "vampire", label: "something older than you", kind: "fiction", scene: "One of you is not entirely human and has been patient for a very long time. The other worked it out and stayed anyway." },
  { id: "spy", label: "on opposite sides", kind: "fiction", scene: "You work for people who want each other destroyed. Neither of you has reported this meeting." },
  { id: "arranged", label: "married to a stranger", kind: "fiction", scene: "This was arranged by other people. You have been introduced, the door is closed, and you are alone for the first time." },
  { id: "mafia", label: "under someone's protection", kind: "fiction", scene: "One of you is dangerous to everyone but the other, and has made that very clear to everyone but the other." },
  { id: "stranded", label: "the last two", kind: "fiction", scene: "Something has gone wrong on a large scale and there is nobody else. Ordinary rules stopped applying some time ago." },
  { id: "rival-duel", label: "rivals, finally alone", kind: "fiction", scene: "You have been each other's obstacle for years in front of everyone. There is no audience now." },
  { id: "future", label: "bought a companion", kind: "fiction", scene: "One of you was made for this and the other is uneasy about how little that changes what they want." },
]

/** The groups, in the order the menu shows them. */
export const FANTASY_KINDS: Array<{ id: Fantasy["kind"]; label: string }> = [
  { id: "meeting", label: "strangers" },
  { id: "tension", label: "history" },
  { id: "power", label: "who's in charge" },
  { id: "place", label: "somewhere" },
  { id: "more", label: "the shape of it" },
  { id: "fiction", label: "not this world" },
]

// WHO THEY ARE. Archetypes only — a role is a job or a standing, never a named
// person and never a family relation (see the exclusions in the header).
//
// A role is doing real work in the prompt: it gives a character somewhere to
// have come from tonight and a reason to talk the way they do. "A surgeon who
// has not come down yet" writes differently from "a librarian who closes alone",
// and that difference is most of what makes a cast feel like people.
export interface Role { id: string; label: string; line: string }

export const ROLES: Role[] = [
  { id: "stranger",   label: "a stranger",        line: "someone nobody here knows, with a whole life outside this room" },
  { id: "neighbour",  label: "the neighbour",     line: "someone who lives a wall away and has heard more than they let on" },
  { id: "ex",         label: "the ex",            line: "someone who already knows exactly where the weak points are" },
  { id: "rival",      label: "the rival",         line: "someone used to competing with the others and not used to losing" },
  { id: "boss",       label: "the boss",          line: "someone who gives instructions all day and is used to being obeyed" },
  { id: "assistant",  label: "the assistant",     line: "someone who runs everything quietly and gets no credit for it" },
  { id: "colleague",  label: "the colleague",     line: "someone who keeps things professional in daylight and is not in daylight now" },
  { id: "client",     label: "the client",        line: "someone paying for something and unsure where the service ends" },
  { id: "bartender",  label: "the bartender",     line: "someone who has heard every confession and is unshockable" },
  { id: "nurse",      label: "the nurse",         line: "someone who has seen everything and nothing lands as shocking any more" },
  { id: "surgeon",    label: "the surgeon",       line: "someone with very steady hands who has not come down from the day yet" },
  { id: "therapist",  label: "the therapist",     line: "someone trained to notice everything and currently off duty" },
  { id: "lawyer",     label: "the lawyer",        line: "someone who argues for sport and finds it hard to stop" },
  { id: "detective",  label: "the detective",     line: "someone who reads people for a living and is reading you now" },
  { id: "journalist", label: "the journalist",    line: "someone who asks better questions than anyone is comfortable with" },
  { id: "professor",  label: "the professor",     line: "someone who explains things slowly and enjoys being listened to" },
  { id: "librarian",  label: "the librarian",     line: "someone quiet in public who closes up alone and is not quiet at all" },
  { id: "trainer",    label: "the trainer",       line: "someone who pushes people past what they thought they had" },
  { id: "masseuse",   label: "the masseuse",      line: "someone whose whole job is knowing where the tension is" },
  { id: "dancer",     label: "the dancer",        line: "someone entirely at home in their own body and aware of it" },
  { id: "model",      label: "the model",         line: "someone used to being looked at and bored of being looked at politely" },
  { id: "photograph", label: "the photographer",  line: "someone who directs people for a living and is directing now" },
  { id: "artist",     label: "the artist",        line: "someone who stares too long and calls it work" },
  { id: "musician",   label: "the musician",      line: "someone who came off stage an hour ago and is still lit up" },
  { id: "singer",     label: "the singer",        line: "someone whose voice is the first thing anyone notices about them" },
  { id: "dj",         label: "the DJ",            line: "someone who has been reading a room all night and reads this one instantly" },
  { id: "chef",       label: "the chef",          line: "someone precise, impatient, and running on adrenaline after service" },
  { id: "sommelier",  label: "the sommelier",     line: "someone who makes a ceremony of everything and knows it works" },
  { id: "tailor",     label: "the tailor",        line: "someone who takes measurements for a living and is unhurried about it" },
  { id: "tattooist",  label: "the tattooist",     line: "someone people sit very still for, who is used to being trusted" },
  { id: "pilot",      label: "the pilot",         line: "someone calm under things that would frighten anybody else" },
  { id: "crew",       label: "the cabin crew",    line: "someone who has been three cities deep this week and is nowhere tonight" },
  { id: "concierge",  label: "the night porter",  line: "someone who runs a building at night and sees who comes and goes" },
  { id: "driver",     label: "the driver",        line: "someone who has been waiting outside for hours with nothing to do but think" },
  { id: "bodyguard",  label: "the bodyguard",     line: "someone paid to stand close and stay professional about it" },
  { id: "soldier",    label: "the soldier",       line: "someone recently back, still keyed up, not sleeping properly" },
  { id: "diplomat",   label: "the diplomat",      line: "someone who never says the true thing first and enjoys the game" },
  { id: "spy",        label: "the spy",           line: "someone whose entire life is a cover story, including tonight" },
  { id: "royal",      label: "the royal",         line: "someone who has never queued for anything and is unused to being refused" },
  { id: "heir",       label: "the heir",          line: "someone with far too much money and nothing they had to earn" },
  { id: "boxer",      label: "the fighter",       line: "someone who takes hits for a living and does not flinch easily" },
  { id: "climber",    label: "the climber",       line: "someone who needs the drop to feel anything and knows that about themselves" },
  { id: "sailor",     label: "the sailor",        line: "someone off a long crossing who has not spoken to anyone in weeks" },
  { id: "scientist",  label: "the scientist",     line: "someone who has been alone with a problem all day and needs a voice" },
  { id: "architect",  label: "the architect",     line: "someone who cannot stop redesigning the room they are standing in" },
  { id: "curator",    label: "the curator",       line: "someone who decides what is worth looking at and is looking at you" },
  { id: "translator", label: "the translator",    line: "someone who hears the second meaning in everything anyone says" },
  { id: "gambler",    label: "the gambler",       line: "someone who reads a table instantly and is reading this one" },
  { id: "smuggler",   label: "the smuggler",      line: "someone comfortable with risk who does not explain themselves" },
  { id: "boss-crime", label: "the one in charge",  line: "someone dangerous to everybody in the room except the person they want" },
  { id: "fixer",      label: "the fixer",         line: "someone who makes problems disappear and is owed by everyone" },
  { id: "priestlike", label: "the devout one",    line: "someone who has spent a long time refusing themselves things" },
  { id: "widow",      label: "the widow",         line: "someone who has been careful for years and is finished being careful" },
  { id: "newlywed",   label: "the newly married", line: "someone whose life just changed shape and is testing the walls of it" },
  { id: "divorcee",   label: "the newly single",  line: "someone out of something long and rediscovering what they like" },
  { id: "traveller",  label: "the one passing through", line: "someone who leaves in the morning and both of you know it" },
  { id: "host",       label: "the host",          line: "someone whose house this is, watching their own party from the edge" },
  { id: "guest",      label: "the guest",         line: "someone who does not know anyone here and has stopped pretending to mind" },
  { id: "roommate",   label: "the flatmate",      line: "someone who shares the space and has been carefully not noticing things" },
  { id: "friend",     label: "the oldest friend", line: "someone who has known the others for years and never crossed the line" },
  { id: "instructor",  label: "the instructor",    line: "someone who teaches adults a skill and is used to being watched closely" },
  { id: "apprentice",  label: "the apprentice",    line: "a grown adult learning something new from someone who is very good at it" },
  { id: "vampire",    label: "something older",   line: "someone who is not entirely human and has been patient a very long time" },
  { id: "android",    label: "the made one",      line: "someone built for this, more aware of it than anyone is comfortable with" },
  { id: "witch",      label: "the strange one",   line: "someone the others half believe the rumours about" },
  { id: "knight",     label: "the sworn one",     line: "someone bound by an oath they are about to break" },
  { id: "captain",    label: "the captain",       line: "someone whose word is final everywhere except in this room" },
  { id: "thief",      label: "the thief",         line: "someone who takes what they want and is honest about that much" },
  { id: "escort",     label: "the professional",  line: "an adult who does this for a living, entirely in control of the arrangement" },
  { id: "confessor",  label: "the confidant",     line: "someone people tell the truth to, who has never told theirs" },
]

/** Ready-made temperaments, so a scene can be cast in three taps. */
export const VIBES: string[] = [
  "warm and unhurried", "sharp and teasing", "quiet, then not", "openly hungry",
  "playing hard to get", "nervous and honest", "cocky", "tender",
  "filthy-mouthed", "restrained, barely", "amused by everything", "intense and direct",
  "shy until pushed", "in charge and calm", "desperate and hiding it", "cold, warming slowly",
]

/** How the turn passes between the cast. */
export type TurnMode = "turns" | "random" | "director"
export const TURN_MODES: Array<{ id: TurnMode; label: string; hint: string }> = [
  { id: "turns",    label: "in turns",   hint: "they speak in order, round the room" },
  { id: "random",   label: "random",     hint: "whoever happens to answer" },
  { id: "director", label: "you choose", hint: "nobody speaks until you name them" },
]

/** How a line is labelled with who said it. */
export type Attribution = "name" | "face"
export const ATTRIBUTIONS: Array<{ id: Attribution; label: string; hint: string }> = [
  { id: "name", label: "name after the line", hint: "— mara" },
  { id: "face", label: "their picture",       hint: "a face beside each line" },
]

export interface SceneMember {
  /** Stable id within the scene. */
  id: string
  gender: Gender
  roleId: string
  vibe: string
  /** Muted members are present in the scene and do not speak. */
  quiet: boolean
}

export interface SceneConfig {
  fantasyId: string
  cast: SceneMember[]
  turnMode: TurnMode
  attribution: Attribution
  /** Keep the transcript after the scene ends. */
  save: boolean
  /** Keep the audio too. */
  record: boolean
}

export const MAX_CAST = 5
export const VIBE_MAX = 120

export function fantasyById(id: string): Fantasy | null {
  return FANTASIES.find((f) => f.id === id) || null
}
export function roleById(id: string): Role | null {
  return ROLES.find((r) => r.id === id) || null
}

/**
 * Turn the user's picks into the text that lands in the prompt as THE SCENE.
 *
 * Everything here is looked up from the tables by id — the only user-authored
 * string that reaches the prompt is `vibe`, which is capped and stripped of the
 * characters that would let it pose as a new instruction block. That is what
 * makes a cast a cast and not a prompt the user wrote.
 *
 * Returns "" for an unknown fantasy rather than guessing, so a bad id produces
 * an ordinary conversation instead of a scene nobody designed.
 */
export function composeScene(cfg: SceneConfig, names: Record<string, string>): string {
  const f = fantasyById(cfg.fantasyId)
  if (!f) return ""
  const who = cfg.cast.map((m) => {
    const role = roleById(m.roleId)
    const g = GENDERS.find((x) => x.id === m.gender)?.long || "person"
    const bits = [`a ${g}`, role ? role.line : null, cleanVibe(m.vibe) || null].filter(Boolean)
    return `- ${names[m.id] || "someone"}: ${bits.join("; ")}.${m.quiet ? " Present but not speaking right now." : ""}`
  }).join("\n")

  const speakers = cfg.cast.filter((m) => !m.quiet).length
  return [
    f.scene,
    "",
    "Who is here:",
    who,
    "",
    speakers > 1
      ? "Several people are in this. You are ONE of them — write only your own line, never anyone else's."
      : "",
    "Everyone here is an adult and chose to be here.",
  ].filter(Boolean).join("\n")
}

/**
 * A user-typed vibe, made safe to concatenate into a prompt.
 *
 * Newlines and colons are removed, not escaped: they are what would let a phrase
 * end the line it is on and start something that reads like a new section header
 * to the model. Capped hard, because length is the other half of that trick.
 * This is defence in depth — the intent gate in app/api/chat still runs, and the
 * FLOOR is still appended after everything — not the only thing standing there.
 */
export function cleanVibe(s: string): string {
  return String(s || "").replace(/[\r\n:]+/g, " ").replace(/\s+/g, " ").trim().slice(0, VIBE_MAX)
}

// ── CASTING ──────────────────────────────────────────────────────────────────

import { makeCharacter, type Cluster } from "@/lib/airroom/roster"

/**
 * A real person for a slot the user specified.
 *
 * The floor's people are generated from (seed, temperature) and their gender
 * falls out of the archetype — which is fine when you are meeting whoever is
 * there, and useless when the user has said they want a woman in this chair. So
 * this WALKS forward from a deterministic starting seed until the person it
 * makes matches, rather than trying to force a gender onto a character after
 * the fact and ending up with a name and a voice that disagree.
 *
 * It always returns somebody. If the walk runs out it takes what the seed gave,
 * because a cast slot that comes back empty breaks the scene, and one character
 * of the wrong gender is a smaller failure than no scene at all.
 *
 * "t" casts from the same pool as "f" — the name, face and voice — and the
 * scene text is what states who she is. There is no separate roster to draw
 * from, and inventing one keyed off gender is exactly the kind of thing that
 * ends up encoding assumptions nobody asked for.
 */
export function castMember(gender: Gender, seed: number, slot: number): Cluster {
  const want = gender === "m" ? "male" : "female"
  const base = ((seed >>> 0) * 2654435761 + slot * 40503) >>> 0
  for (let k = 0; k < 40; k++) {
    // Spread the temperature across the walk so a cast isn't five people from
    // one narrow band of the floor.
    const f = ((base + k * 29) % 100) / 100
    const c = makeCharacter((base + k * 7919) >>> 0, f)
    if (c.gender === want) return c
  }
  return makeCharacter(base, 0.5)
}

/** The whole cast, in slot order. Deterministic for a given scene seed. */
export function castFor(cfg: SceneConfig, seed: number): Cluster[] {
  return cfg.cast.slice(0, MAX_CAST).map((m, i) => castMember(m.gender, seed, i))
}
