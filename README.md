# KLOOM Roleplay Phase 7

> Live multi-AI rooms (voice + text) with expert agents and the $KLOOM credit economy

## Overview

KLOOM is a platform for creating and experiencing immersive AI-powered roleplay rooms. Phase 7 completes rooms 41-60 with persona IDs 165-244, featuring fantasy-themed scenarios with Mistral AI leading the primary characters.

## Features

- **20 New Rooms**: Rooms 41-60 with 80 unique personas
- **Persona IDs**: 165-244
- **Voice & Text**: Full voice chat support with TTS
- **Multi-AI**: Mistral, Claude, Gemini, and OpenAI models
- **TypeScript**: Fully typed definitions and interfaces

## Project Structure

src/
-- kloom_rooms_final.ts    # Type definitions (Room, Persona, Tool, Option)
-- rooms_41_50.ts          # Rooms 41-50 (Persona IDs 165-204)
-- rooms_51_60.ts          # Rooms 51-60 (Persona IDs 205-244)
-- index.ts               # Master exports

## Rooms Included

### Rooms 41-50 (Persona IDs 165-204)
10 fantasy rooms with complete personas and configurations.

### Rooms 51-60 (Persona IDs 205-244)
10 additional fantasy rooms with complete personas and configurations.

## Model Assignments

- Lead Characters: Mistral AI (first persona in each room)
- Supporting Characters: Claude, Gemini, OpenAI

## UAE Market Considerations

All content is culturally appropriate for the UAE market. Blocked topics include politics, religion, NSFW content, hate speech, violence, etc. Compliant with local regulations and community standards.

## Type Safety

The project uses TypeScript for full type safety.

## Environment Variables

Required for deployment:

Codestral_API_KEY=your_codestral_key
MISTRAL_API_KEY=your_mistral_key

## Deployment

The project is configured for Vercel deployment with the above environment variables.

## Getting Started

1. Clone the repository
2. Install dependencies
3. Build
4. Start

## License

MIT

## Author

Mahmoud Ezz - ezz-ae

---

Built with Mistral AI, Claude, Gemini, and OpenAI