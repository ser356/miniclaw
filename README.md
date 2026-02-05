# 🦞 MiniClaw

**Ultra minimal AI assistant for Telegram powered by local LLMs via LM Studio**

Inspired by [OpenClaw](https://github.com/openclaw/openclaw) but stripped down to the absolute essentials. No frills, just works.

## Features

- 🤖 Telegram bot interface
- 🏠 100% local inference via LM Studio
- 💬 Conversation memory (per-chat sessions)
- ⚡ Simple, fast, minimal dependencies
- 🔒 Optional user whitelist

## Requirements

- Node.js 20+
- pnpm
- [LM Studio](https://lmstudio.ai/) with a loaded model
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

## Quick Start

### 1. Clone & Install

```bash
git clone <repo-url>
cd miniclaw
pnpm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your settings
```

**Required:**
- `TELEGRAM_BOT_TOKEN` - Get from @BotFather on Telegram

**Optional:**
- `LM_STUDIO_URL` - Default: `http://localhost:1234/v1`
- `LM_STUDIO_MODEL` - Default: `mistralai/ministral-3-14b-reasoning`
- `ALLOWED_USERS` - Comma-separated Telegram user IDs (empty = allow all)
- `MAX_TOKENS` - Max response tokens (default: 4096)

### 3. Start LM Studio

1. Open LM Studio
2. Load your model (e.g., `mistralai/ministral-3-14b-reasoning`)
3. Go to "Local Server" tab
4. Click "Start Server" (default port: 1234)

### 4. Run

```bash
# Development (hot reload)
pnpm dev

# Production
pnpm build
pnpm start
```

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Show welcome message |
| `/new` | Start new conversation (clear history) |
| `/status` | Check LM Studio connection & model |

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Telegram   │────▶│  MiniClaw   │────▶│  LM Studio  │
│    User     │◀────│   (grammY)  │◀────│  (local)    │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Project Structure

```
miniclaw/
├── src/
│   ├── index.ts    # Entry point
│   ├── config.ts   # Configuration
│   ├── bot.ts      # Telegram bot logic
│   ├── llm.ts      # LM Studio client
│   └── sessions.ts # Conversation memory
├── .env.example
├── package.json
└── tsconfig.json
```

## Security

- **User whitelist**: Set `ALLOWED_USERS` to restrict access
- **Local only**: All inference happens on your machine
- **No data storage**: Sessions are in-memory only

## Model Notes

This project is optimized for `mistralai/ministral-3-14b-reasoning`:

- Uses OpenAI-compatible API (LM Studio default)
- Minimal system prompt to maximize reasoning tokens
- No fancy prompt engineering - let the model think

## Troubleshooting

**Bot not responding?**
1. Check LM Studio is running with server enabled
2. Verify `TELEGRAM_BOT_TOKEN` is correct
3. Run `/status` to check connection

**"No autorizado" message?**
- Your Telegram ID is not in `ALLOWED_USERS`
- Get your ID: send a message to [@userinfobot](https://t.me/userinfobot)

**Slow responses?**
- Normal for local models on CPU
- Consider reducing `MAX_TOKENS`
- Use GPU acceleration in LM Studio

## License

MIT

---

*Less is more. 🦞*
