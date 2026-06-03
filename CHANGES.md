# KLOOM Changelog

All notable changes to the KLOOM platform are documented in this file.

## [Unreleased]

### Added
- **Complete KLOOM Branding**: Changed from "Ora" to "KLOOM" with new K-shaped logo and purple/cyan gradient theme
- **Mistral AI Integration**: Full support for Mistral AI backend with streaming, cost tracking, and model recommendations
- **Enhanced Expert System**: 8 clear categories with 50+ experts, better metadata, and platform value descriptions
- **Expanded Room System**: 20+ room definitions across 8 categories with better descriptions and SEO metadata
- **Model Selector Component**: New UI for selecting AI backends with cost display and comparison
- **Onboarding Flow**: Complete onboarding modal, feature tour, and quick start guide
- **Room Browser**: Advanced room discovery with filtering, search, and category chips

### Changed
- **Branding**: All references to "Ora" replaced with "KLOOM"
- **Color Theme**: Updated from amber/orange to purple/cyan gradient
- **Logo**: New K-shaped icon with wordmark
- **Expert Categories**: Reorganized from 7 to 8 groups for better UX
- **Room Categories**: Expanded with better filtering and discovery
- **Landing Page**: Updated hero section, features, and CTAs with KLOOM branding

### Fixed
- **Sidebar**: Fixed mobile responsiveness and navigation
- **Mobile Nav**: Improved hamburger menu and sheet navigation
- **Model Selection**: Better fallback handling for missing API keys

### Technical
- **Backend Support**: Added Mistral to the Backend type union
- **Cost Tracking**: Added comprehensive cost information for all backends
- **Model Recommendations**: Added RECOMMENDED_MODELS array with use cases
- **Backend Metadata**: Complete metadata for all supported backends

## [1.0.0] - Initial Release

### Added
- **Core Platform**: Multi-AI conversation platform with shared rooms
- **AI Backends**: Support for Claude, Gemini, OpenAI, and local (Ollama) backends
- **Expert System**: 50+ AI personas across 7 categories
- **Room System**: Multi-AI rooms for collaborative conversations
- **Voice Chat**: Real-time voice conversations with AI models
- **Wallet Integration**: Solana wallet authentication
- **Payment System**: PayPal and Ziina integration for voice credits
- **Supabase Backend**: Database, authentication, and realtime features
- **MCP Server**: Model Context Protocol server with tools and prompts
- **UI Components**: Complete component library with Shadcn UI

### Features
- **Multi-AI Rooms**: Chat with multiple AI models simultaneously
- **Shared Spaces**: Invite friends to join conversations
- **Expert Selection**: Choose from 50+ specialized AI personas
- **Voice Chat**: Live voice conversations (paid feature)
- **Free Text Chat**: All text conversations are free
- **Privacy**: Wallet-based authentication, no email required
- **Localization**: Arabic language support

## Upcoming Features

### Planned
- **Mobile App**: Native iOS and Android applications
- **Desktop App**: Standalone desktop application
- **API Access**: REST and WebSocket APIs for developers
- **Plugin System**: Extensible plugin architecture
- **Marketplace**: Community-created experts and rooms
- **Analytics**: Usage statistics and insights
- **Team Features**: Collaborative workspaces for teams
- **Enterprise**: Self-hosted enterprise solution

### In Development
- **Video Chat**: Face-to-face conversations with AI
- **Screen Sharing**: Share your screen during voice calls
- **File Upload**: Upload documents for AI analysis
- **Code Interpreter**: Execute code directly in conversations
- **Web Search**: Real-time web search capabilities
- **Image Generation**: AI-powered image creation

## Migration Guides

### From Ora to KLOOM

If you're migrating from the previous "Ora" branding:

1. **Environment Variables**: No changes required, but consider updating any custom branding
2. **Logo**: Replace any Ora logos with the new KLOOM logo
3. **Color Scheme**: Update from amber/orange to purple/cyan
4. **API Keys**: Add MISTRAL_API_KEY to enable Mistral support
5. **Model Selection**: The new model selector component replaces any custom model switching logic

### Adding New AI Backends

To add a new AI backend:

1. Add the backend type to `lib/llm-backends.ts`:
   ```typescript
   export type Backend = "local" | "claude" | "gemini" | "openai" | "mistral" | "new-backend"
   ```

2. Add configuration constants:
   ```typescript
   const NEW_BACKEND_KEY = process.env.NEW_BACKEND_API_KEY || ""
   const NEW_BACKEND_MODEL = process.env.NEW_BACKEND_MODEL || "default-model"
   ```

3. Add to `backendAvailable` function:
   ```typescript
   if (b === "new-backend") return !!NEW_BACKEND_KEY
   ```

4. Create a streaming function:
   ```typescript
   async function* streamNewBackend(messages: LLMMessage[], opts: LLMOptions): AsyncGenerator<string> {
     // Implementation
   }
   ```

5. Add to the router:
   ```typescript
   case "new-backend":
     yield* streamNewBackend(messages, opts)
     break
   ```

6. Add metadata to `BACKEND_METADATA`

## Versioning

KLOOM follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards-compatible)
- **PATCH**: Bug fixes (backwards-compatible)

## Support Policy

- Latest version: Full support
- Previous major version: Security updates only
- Older versions: No support

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Security

If you discover a security vulnerability, please email security@kloom.ai instead of using the public issue tracker.

---

**Last Updated**: June 3, 2026
