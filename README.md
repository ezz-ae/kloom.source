# kloom.source

> Multi-AI Conversation Platform - Chat with multiple AI models, create custom rooms, and collaborate with AI experts.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Mistral AI](https://img.shields.io/badge/Mistral-AI-purple.svg)](https://mistral.ai/)

## Features

### Multi-AI Backend Support
- Mistral AI - Recommended default. Cost-effective, excellent at coding, multilingual, and structured data
- Claude (Anthropic) - Best for complex reasoning and coding
- Gemini (Google) - Best for creative tasks and multimodal
- OpenAI - Industry standard GPT-4 and GPT-3.5
- Local Models - Run models on your own device for privacy

### AI Experts & Rooms
- 50+ AI Experts - Specialized agents for any task
- Custom Rooms - Create conversation spaces with specific experts
- Multi-AI Rooms - Combine multiple experts in one room
- Expert Categories - Guidance, Creative, Wellness, Mind, Business, Future, Intimacy

### Mistral-Specific Features
- 5 Mistral-Optimized Experts: Code, Multilingual, Data, Math, Storytelling
- 4 Mistral Rooms: Code Lab, Polyglot Hub, Data Studio, Creative Fusion
- 7 Mistral MCP Tools: Code optimization, translation, structured data, and more
- Cost Tracking - Monitor your Mistral API usage and costs

### Advanced Features
- Model Comparison - Compare costs and capabilities across providers
- Smart Routing - Automatically select the best model for your task
- Conversation History - Save and resume conversations
- Collaboration - Share rooms with others
- Customization - Configure AI behavior and appearance

### Technical Features
- Next.js 16 - Latest React framework with App Router
- TypeScript - Full type safety
- Supabase - PostgreSQL database and authentication
- MCP Server - Model Context Protocol for AI tools
- Solana Integration - Blockchain payments and NFTs
- PayPal & Ziina - Payment processing

## Quick Start

### Prerequisites
- Node.js 18+ 
- pnpm (recommended)
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/ezz-ae/kloom.source.git
cd kloom.source
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

4. Set up Supabase:
```bash
# Create a new Supabase project at https://supabase.com
# Copy the URL and anon key to your .env file
```

5. Run the development server:
```bash
pnpm dev
```

6. Open http://localhost:3000 in your browser.

## Environment Variables

See .env.example for a complete template.

## Project Structure

kloom.source/
├── app/                          # Next.js App Router
├── components/                  # React components
├── hooks/                       # React hooks
├── lib/                         # Utility functions
├── mcp-server/                  # Model Context Protocol server
└── public/                      # Static assets

## AI Models & Pricing

| Model | Provider | Input Cost (per 1K) | Output Cost (per 1K) | Best For |
|-------|----------|---------------------|----------------------|----------|
| Mistral | Mistral AI | $0.00025 | $0.00025 | General, Multilingual, Coding |
| Claude | Anthropic | $0.003 | $0.015 | Complex Reasoning, Coding |
| Gemini | Google | $0.00025 | $0.001 | Creative, Multimodal |
| GPT-4 | OpenAI | $0.03 | $0.06 | General, Enterprise |
| Local | Local | Free | Free | Private, Offline |

**Mistral is recommended for most use cases**

## Mistral Integration

### Why Mistral?
- Cost-Effective: 10-100x cheaper than other providers
- Multilingual: Native-level fluency in 100+ languages
- Coding: Exceptional at code generation and review
- Structured Data: Excellent at JSON, CSV, and structured output
- Speed: Fast response times

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License

## Contact

- Website: kloom.source
- GitHub: ezz-ae/kloom.source
- Email: mahmoud@ezz.ae

---

Built with love and AI

*Last updated: June 3, 2026*