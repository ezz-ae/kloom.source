# KLOOM - Multi-AI Conversation Platform

![KLOOM Logo](https://img.shields.io/badge/KLOOM-AI-purple?style=for-the-badge)
[![License](https://img.shields.io/badge/License-MIT-cyan?style=for-the-badge)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://typescriptlang.org/)

**KLOOM** is a revolutionary multi-AI conversation platform that allows you to chat with multiple AI models simultaneously in shared rooms. Connect with friends, collaborate with AI experts, and experience the future of intelligent conversations.

## Features

### Multi-AI Rooms
- **Simultaneous Conversations**: Chat with Claude, Gemini, GPT, and Mistral AI models at the same time
- **Shared Spaces**: Invite friends to join your conversations
- **Live Voice Chat**: Real-time voice conversations with AI models
- **Collaborative Work**: Multiple minds working together on complex tasks

### AI Experts
- **100+ Specialized Personas**: Access experts in business, technology, wellness, creative arts, and more
- **8 Categories**: Organized by domain for easy discovery
- **Professional Depth**: Each expert has genuine depth in their field
- **Multilingual Support**: Excellent Arabic and 50+ language support

### Platform Features
- **Wallet-Based Authentication**: Your Solana wallet is your account
- **Free Text Chat**: All text conversations are free, forever
- **Pay-As-You-Go Voice**: Voice calls from $1 per minute
- **Privacy First**: No email, no tracking, full privacy
- **Unrestricted**: No content restrictions (18+ mode available)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/ezz-ae/kloom.source.git
cd kloom.source
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment Variables

Copy the example environment file and add your API keys:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your API keys:

```env
# Solana Configuration
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# AI Backend API Keys
ANTHROPIC_API_KEY=your_claude_api_key
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
MISTRAL_API_KEY=your_mistral_api_key

# Local LLM Configuration (Ollama)
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=local
LLM_MODEL=llama3.2:latest

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key

# Payment Configuration
PAYPAL_CLIENT_ID=your_paypal_client_id
ZIINA_API_KEY=your_ziina_api_key
```

### 4. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL migrations:

```bash
psql -h your-supabase-host -U postgres -d postgres -f supabase-setup.sql
```

Or use the Supabase dashboard to run the SQL from `supabase-setup.sql`.

### 5. Run the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
kloom.source/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Landing page
│   ├── layout.tsx                # Root layout
│   └── (app)/                    # Application routes
│       ├── discover/              # Discover page
│       ├── rooms/                # Room browser
│       ├── experts/              # Expert browser
│       ├── chat/                 # 1-on-1 chat
│       ├── voice/                # Voice rooms
│       └── settings/             # User settings
│
├── components/                   # React components
│   ├── app-shell/                # Application shell
│   │   ├── shell.tsx             # Main shell
│   │   ├── sidebar.tsx           # Desktop sidebar
│   │   └── mobile-nav.tsx        # Mobile navigation
│   ├── model-selector.tsx        # Model selection UI
│   ├── onboarding.tsx            # Onboarding flows
│   ├── room-browser.tsx          # Room discovery
│   └── ui/                       # Shadcn UI components
│
├── lib/                          # Core libraries
│   ├── llm-backends.ts           # AI backend integrations
│   ├── experts.ts                # Expert definitions
│   ├── rooms.ts                  # Room definitions
│   ├── supabase.ts               # Supabase client
│   └── ...
│
├── mcp-server/                   # Model Context Protocol server
│   ├── src/
│   │   ├── tools/                # MCP tools
│   │   └── prompts/               # AI prompts
│   │       └── index.ts          # Enhanced prompts with Mistral support
│   └── ...
│
├── hooks/                        # React hooks
│   └── use-sol-credits.ts        # Solana credit management
│
├── public/                       # Static assets
├── styles/                       # Global styles
├── deploy/                       # Deployment configurations
│   └── fly.toml                  # Fly.io configuration
│
└── scripts/                      # Utility scripts
```

## AI Backends

KLOOM supports multiple AI backends with full streaming support:

| Backend | Input Cost | Output Cost | Best For |
|---------|-----------|-------------|----------|
| Local (Ollama) | Free | Free | Development, Offline |
| Mistral | $2/1K | $6/1K | General, Coding, Multilingual, Arabic |
| Claude | $3/1K | $15/1K | Reasoning, Complex Tasks |
| Gemini | $1/1K | $3/1K | Fast, Multimodal |
| OpenAI | $5/1K | $15/1K | General, Coding, Creative |

### Mistral AI Integration

Mistral is our recommended backend for:
- **Cost-effective** conversations
- **Excellent multilingual** support (especially Arabic)
- **Fast responses**
- **High-quality outputs**

To enable Mistral:
1. Get an API key from [mistral.ai](https://mistral.ai)
2. Add it to your `.env.local`:
   ```env
   MISTRAL_API_KEY=your_mistral_api_key
   MISTRAL_MODEL=mistral-large-latest
   ```

## Expert Categories

KLOOM features 8 expert categories with 50+ specialized personas:

1. **Business & Finance** - Trading, startups, marketing, finance
2. **Technology & AI** - Coding, AI, Web3, cybersecurity
3. **Creative Arts** - Writing, design, music, art
4. **Health & Wellness** - Fitness, nutrition, mental health
5. **Lifestyle & Social** - Dating, fashion, travel, social
6. **Learning & Growth** - Languages, skills, education
7. **Entertainment** - Games, movies, music, books
8. **Spiritual & Future** - Tarot, astrology, advice

## Room Categories

Explore 20+ room types across 8 categories:

- **Multi-AI Collaboration** - Multiple models working together
- **Business & Trading** - Market analysis, trading strategies
- **Creative Studios** - Writing, design, music production
- **Learning Spaces** - Language learning, skill development
- **Social Hubs** - Dating advice, social scenarios
- **Gaming & Entertainment** - Game companions, movie discussions
- **Wellness & Support** - Mental health, fitness coaching
- **Technical Workshops** - Coding, debugging, architecture

## Payment System

### Free Tier
- ✅ Text chat with all models
- ✅ Access to all experts
- ✅ Create and join rooms
- ✅ Invite friends
- ✅ First 5 minutes of voice free

### Paid Features
- **Voice Calls**: $1 per minute (pay-as-you-go)
- **Unlimited Voice**: $60/month
- **Unrestricted Mode**: $10/month (removes all restrictions, 18+)

### Payment Methods
- **Solana (SOL)**: Direct wallet payments
- **PayPal**: Global payment support
- **Ziina**: UAE-specific payment (AED)

## Deployment

### Fly.io (Recommended)

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Deploy
flyctl deploy --remote-only
```

### Vercel

```bash
vercel
```

### Docker

```bash
# Build
docker build -t kloom .

# Run
docker run -p 3000:3000 kloom
```

## Technology Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript 5.0
- **UI**: Shadcn UI, Tailwind CSS
- **State**: Zustand
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Solana Wallet Adapter
- **AI Integration**: Mistral, Claude, Gemini, OpenAI
- **Voice**: Fish Audio TTS
- **Realtime**: Ably (optional)
- **Payments**: PayPal, Ziina, Solana

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- **Documentation**: [KLOOM Docs](https://docs.kloom.ai)
- **Community**: [Discord](https://discord.gg/kloom)
- **Email**: support@kloom.ai

## Changelog

See [CHANGES.md](CHANGES.md) for release history.

---

**Built with ❤️ in UAE**

KLOOM is designed for the UAE market with full Arabic support and local payment integration.
