# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (api-server), SQLite via better-sqlite3 (agent)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/agent run dev` — run BaraaClaw Telegram agent

## BaraaClaw Agent (`artifacts/agent/`)

A personal AI agent that runs locally and uses Telegram as its only interface.

### Architecture

```
artifacts/agent/src/
├── index.ts              # Entry point — starts the bot
├── config/
│   └── index.ts          # Typed config from env vars
├── telegram/
│   └── bot.ts            # grammy bot setup, auth middleware, command/message handlers
├── agent/
│   └── loop.ts           # Core agent loop with iteration limit
├── llm/
│   ├── types.ts          # Shared LLM message types
│   ├── index.ts          # LLM router: Groq primary → Gemini fallback
│   ├── groq.ts           # Groq API integration (Llama 3.3 70B)
│   └── gemini.ts         # Gemini API fallback integration
├── tools/
│   └── index.ts          # Tool registry + executors
└── memory/
    └── db.ts             # SQLite persistence via better-sqlite3
```

### Security

- **Telegram user ID whitelist** enforced via `TELEGRAM_ALLOWED_USER_IDS`
- All credentials in environment secrets (never in code)
- Agent loop capped at `MAX_ITERATIONS` (default: 10)

### Built-in Tools

- `get_current_time` — current date/time with optional timezone
- `remember_fact` — persist a key/value fact to SQLite
- `recall_fact` — retrieve a stored fact
- `list_memory` — list all stored facts for the user

### Telegram Commands

- `/start` — introduction message
- `/help` — command list and tool overview
- `/clear` — clear conversation history
- `/memory` — view stored facts

### Required Secrets

- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `GROQ_API_KEY` — from console.groq.com
- `GEMINI_API_KEY` — from aistudio.google.com
- `TELEGRAM_ALLOWED_USER_IDS` — comma-separated Telegram user IDs

### Scalability Notes

The architecture is designed to be extended:
- Add new tools by adding entries to `artifacts/agent/src/tools/index.ts`
- Add new LLM providers by adding adapters in `artifacts/agent/src/llm/`
- Cloud deployment (Firebase/GCP): replace the SQLite store with Firestore
- ElevenLabs TTS: add a tool that calls ElevenLabs API and sends voice messages via grammy
- Transcription: add a tool using Whisper/Groq audio API, handle `message:voice` in bot.ts
- Multi-channel: add adapters in `artifacts/agent/src/channels/`

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
