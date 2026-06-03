# kloom.source Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] - 2026-06-03

### Added

#### AI Backend & Mistral Integration
- **Full Mistral AI Integration** - Added Mistral as a first-class backend provider
  - Added lib/llm-backends.ts with complete Mistral backend configuration
  - Implemented streaming support for Mistral models
  - Added cost tracking for all providers (Mistral, Claude, Gemini, OpenAI, Local)
  - Created helper functions for backend resolution, availability checking, and routing
  - Mistral is now the recommended default for most use cases (cost-effective, excellent multilingual)

- **Mistral-Specific Features**
  - Added 5 Mistral-optimized experts
  - Added 4 Mistral-specific rooms
  - Added 7 Mistral-specific MCP tools

#### MCP Server Enhancements
- Enhanced Prompts System with Mistral optimizations
- Added model parameter support for per-prompt optimization
- Created 7 prompt categories

#### UI/UX Components
- Onboarding System with 4 steps
- Model Selector with search and comparison
- Room Browser with grid/list views
- Loading States components
- Error Boundaries components

#### Hooks
- useModelSelector - Manage AI model selection
- useConversationModel - Per-conversation model management
- useModelRecommender - Intelligent model recommendation
- useModelPerformance - Track model performance metrics
- useModelHealth - Monitor model API health
- useModelCostCalculator - Calculate and format costs

#### Documentation
- Complete README.md
- .env.example template
- CHANGES.md changelog

---

## [1.0.0] - 2026-05-01

### Initial Release
- Next.js 16 with App Router
- TypeScript 5.0
- React 19
- Supabase integration
- Basic AI chat functionality

---

## [0.1.0] - 2026-04-15

### Pre-Alpha
- Project initialization
- Repository setup

---

## Migration Notes

### From v0.1.0 to v1.0.0
- Run pnpm install to update dependencies
- Copy .env.example to .env and update values

### From v1.0.0 to Unreleased
- New files added
- Existing files enhanced with Mistral support
- No breaking changes

---

## Roadmap

### Next Features
- Real-time collaboration in rooms
- Voice chat with AI
- Image generation support

### Future Enhancements
- Multi-modal conversations
- Custom model fine-tuning
- AI agent marketplace

---

## License

This project is licensed under the MIT License.

---
*Changelog generated and maintained by Mahmoud Ezz*
*Last updated: June 3, 2026*