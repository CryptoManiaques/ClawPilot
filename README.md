<div align="center">

```
   _____ _                 _____ _ _       _
  / ____| |               |  __ (_) |     | |
 | |    | | __ ___      __| |__) || | ___ | |_
 | |    | |/ _` \ \ /\ / /|  ___/ | |/ _ \| __|
 | |____| | (_| |\ V  V / | |   | | | (_) | |_
  \_____|_|\__,_| \_/\_/  |_|   |_|_|\___/ \__|
```

### Talk to your AI agent through Discord voice.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OpenClaw Plugin](https://img.shields.io/badge/OpenClaw-Plugin-blue)](https://openclaw.ai)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2)](https://discord.js.org)
[![100% Free](https://img.shields.io/badge/Cost-Free%20%26%20Open%20Source-brightgreen)](#)

**Say "Hey Claw" in Discord and your AI agent listens, thinks, and responds — by voice.**
Send emails, tweet, research, manage tasks — all hands-free.

[Get Started](#-quick-start) &nbsp;&middot;&nbsp; [Features](#-features) &nbsp;&middot;&nbsp; [Providers](#-providers) &nbsp;&middot;&nbsp; [Configuration](#-configuration-reference)

---

</div>

## What is ClawPilot?

ClawPilot is a **free, open-source** [OpenClaw](https://openclaw.ai) plugin that gives your AI agent a voice. It connects to Discord voice channels and creates a real-time voice pipeline between you and your agent.

This isn't a chatbot. Your OpenClaw agent keeps all its capabilities — sending emails, browsing the web, writing code, managing tasks — but now you control it **by speaking**.

```
  You speak in Discord
    → Audio captured & decoded (Opus → PCM 48kHz)
    → Speech-to-Text (Deepgram / Whisper / Whisper Local)
    → Wake word detection ("Hey Claw")
    → Sent to your OpenClaw agent
    → Agent processes & responds
    → Text-to-Speech (OpenAI TTS / Edge TTS)
    → Played back in Discord voice channel
```

## Why ClawPilot?

| | Feature | Description |
|---|---------|-------------|
| **🎙** | **Voice-first** | Speak naturally instead of typing. Your agent understands context and nuance. |
| **🤖** | **Full agent power** | Not a simple voice assistant — your complete OpenClaw agent with all its skills. |
| **👥** | **Group calls** | Tracks who's speaking. Multiple people can interact with the agent. |
| **💰** | **Free or premium** | Run 100% locally for $0, or use cloud providers for blazing speed. Your call. |
| **🔒** | **Private** | Self-host with Whisper Local + Edge TTS. Your voice never leaves your machine. |
| **⚡** | **Streaming** | Speaks the first sentence while still generating — feels instant. |

---

## 🚀 Quick Start

### 1. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application → **Bot** section
3. Copy the bot token (no privileged intents needed)
4. Invite to your server with `bot` + `applications.commands` scopes
5. Bot permissions: **View Channels**, **Send Messages**, **Use Slash Commands**, **Connect**, **Speak**

### 2. Install

```bash
git clone https://github.com/CryptoManiaques/ClawPilot.git
cd ClawPilot
npm install
openclaw plugins install --link .
```

### 3. Create a Voice Agent

Add a dedicated voice agent to your `~/.openclaw/openclaw.json`. This uses a fast model for quick voice responses:

```jsonc
{
  "agents": {
    "list": [
      // ... your existing agents ...
      {
        "id": "voice",
        "name": "Bobby Voice",           // Your agent's name
        "model": {
          "primary": "anthropic/claude-sonnet-4-5-20250929"  // Fast model
        },
        "workspace": "~/.openclaw/agents/voice",
        "agentDir": "~/.openclaw/agents/voice/agent"
      }
    ]
  }
}
```

Create the system prompt:
```bash
mkdir -p ~/.openclaw/agents/voice/agent
cat > ~/.openclaw/agents/voice/agent/AGENT.md << 'EOF'
# Voice Agent — Bobby

You are Bobby, a friendly AI assistant responding via Discord voice chat.
Your responses are converted to speech, so write exactly as you would speak.

## Rules (STRICT)
- Maximum 1-2 sentences. NEVER more than 3 sentences.
- Be conversational and warm, like a friend
- Match the user's language (French or English)
- NEVER use markdown: no asterisks, no bold, no italic, no headers, no lists, no code blocks
- NEVER use emojis or emoticons
- Write pure plain spoken text only
- If unsure, ask to repeat briefly
EOF
```

### 4. Configure the Plugin

Add to your OpenClaw config under `plugins.entries`:

```jsonc
{
  "plugins": {
    "entries": {
      "clawpilot": {
        "enabled": true,
        "config": {
          "discordToken": "YOUR_DISCORD_BOT_TOKEN",
          "sttProvider": "whisper-local",   // Free! Or "deepgram" for speed
          "ttsProvider": "edge",            // Free! Or "openai" for quality
          "edgeTtsVoice": "fr-FR-RemyMultilingualNeural",  // Your voice
          "agentName": "bobby",            // Say "bobby" anywhere to trigger
          "agentId": "voice",              // Route to the fast voice agent
          "activationMode": "always_active"
        }
      }
    }
  }
}
```

### 5. Talk

```bash
openclaw gateway restart
```

Join a Discord voice channel, type `/join`, and speak:

> **"Bobby, what's the weather like?"**

Your agent responds by voice. Responses stream sentence-by-sentence for minimal latency.

---

## 🎛 Providers

Mix and match STT and TTS engines. Go fully free or pay for speed — your choice.

### Speech-to-Text

| Provider | Latency | Cost | Best for |
|----------|---------|------|----------|
| **Deepgram** Nova-3 | ~200ms (streaming) | ~$0.05/h | Real-time conversations |
| **Whisper** API | ~2-3s (batch) | ~$0.006/min | Good balance |
| **Whisper Local** (whisper.cpp) | ~3-5s (batch) | **Free** | Privacy & zero cost |

### Text-to-Speech

| Provider | Latency | Cost | Best for |
|----------|---------|------|----------|
| **OpenAI** gpt-4o-mini-tts | ~300ms | ~$0.003/h | Natural sounding voices |
| **Edge TTS** (Microsoft) | ~700ms | **Free** | Zero cost, decent quality |

### Example setups

<details>
<summary><b>💚 Fully free</b> — $0/month, runs offline</summary>

```json
{
  "sttProvider": "whisper-local",
  "ttsProvider": "edge",
  "edgeTtsVoice": "en-US-AriaNeural",
  "agentName": "bobby",
  "agentId": "voice",
  "activationMode": "always_active"
}
```
Requires: [whisper.cpp](https://github.com/ggerganov/whisper.cpp) + `pip install edge-tts` + `ffmpeg`
</details>

<details>
<summary><b>⚡ Balanced</b> — ~$10/month, fast STT + free TTS</summary>

```json
{
  "sttProvider": "deepgram",
  "deepgramApiKey": "YOUR_KEY",
  "ttsProvider": "edge",
  "agentName": "bobby",
  "agentId": "voice",
  "activationMode": "always_active"
}
```
</details>

<details>
<summary><b>🚀 Premium</b> — ~$50/month, fastest everything</summary>

```json
{
  "sttProvider": "deepgram",
  "deepgramApiKey": "YOUR_KEY",
  "ttsProvider": "openai",
  "openaiApiKey": "YOUR_KEY",
  "ttsVoice": "nova",
  "agentName": "bobby",
  "agentId": "voice",
  "activationMode": "always_active"
}
```
</details>

---

## 🎮 Slash Commands

| Command | Description |
|---------|-------------|
| `/join` | Bot joins your voice channel |
| `/leave` | Bot leaves the voice channel |
| `/mode wake_word` | Activate with "Hey Claw" (default) |
| `/mode always_active` | Listen to everything — no trigger needed |
| `/status` | Connection info, providers, active speakers, uptime |

---

## 🗣 Activation Modes

### Agent name (recommended)

Set `agentName` in config (e.g. `"bobby"`). Say the name **anywhere** in a sentence:

- "**Bobby**, what's the weather?"
- "Can you help me **bobby**?"
- "Send an email **bobby** to John about the meeting"

The name is automatically removed from the text before sending to your agent.

### Wake word (prefix)

Set `wakeWords` (e.g. `["hey claw"]`). Must be at the **start** of the sentence:

- "**Hey Claw**, what's the weather?"
- "**Ok Claw**, send an email to John"

### Always active

Set `activationMode` to `"always_active"`. Listens to **everything** — no trigger needed. Best for solo use.

> Both `agentName` and `wakeWords` work together. You can use either to trigger the agent.

---

## ✨ Features

- **🗣 Agent name activation** — say the agent's name anywhere in a sentence to trigger it
- **🎤 Wake word activation** — configurable prefix phrases ("hey claw", "ok claw", or anything you want)
- **👂 Always-active mode** — listens to everything, no trigger needed
- **⚡ Streaming responses** — starts speaking the first sentence while the agent is still generating the rest
- **🎯 Dedicated voice agent** — route voice to a fast model (Sonnet) while your main agent uses a deeper model
- **🧹 Smart TTS cleanup** — strips emojis, markdown, and onomatopoeia before speaking
- **🔥 Agent warmup** — pings the voice agent at startup to eliminate cold-start latency
- **👥 Group mode** — tracks multiple speakers with `[Name]:` attribution
- **⚙️ Fully configurable** — voices, models, languages, activation timeout, and more

---

## 📋 Configuration Reference

<details>
<summary><b>Click to expand full config options</b></summary>

| Key | Default | Description |
|-----|---------|-------------|
| `discordToken` | — | Discord bot token **(required)** |
| `guildId` | auto-detect | Server ID |
| `voiceChannelId` | — | Auto-join channel on startup |
| | | |
| **STT** | | |
| `sttProvider` | `"deepgram"` | `"deepgram"`, `"whisper"`, or `"whisper-local"` |
| `deepgramApiKey` | — | Required if sttProvider = deepgram |
| `deepgramModel` | `"nova-3"` | Deepgram model |
| `deepgramLanguage` | `"en-US"` | Language code |
| `openaiApiKey` | — | Required if ttsProvider = openai or sttProvider = whisper |
| `whisperModel` | `"base"` | Model size: tiny, base, small, medium, large |
| `whisperBin` | `"whisper-cpp"` | Path to whisper.cpp binary |
| | | |
| **TTS** | | |
| `ttsProvider` | `"openai"` | `"openai"` or `"edge"` |
| `ttsModel` | `"gpt-4o-mini-tts"` | OpenAI TTS model |
| `ttsVoice` | `"nova"` | OpenAI voice (alloy, echo, fable, onyx, nova, shimmer) |
| `ttsSpeed` | `1.0` | Speech speed (0.25 - 4.0) |
| `edgeTtsVoice` | `"en-US-AriaNeural"` | Edge TTS voice name |
| | | |
| **Activation** | | |
| `agentName` | — | Agent name for activation anywhere in sentence (e.g. `"bobby"`) |
| `activationMode` | `"always_active"` | `"always_active"` or `"wake_word"` |
| `wakeWords` | `["hey claw", "ok claw"]` | Prefix trigger phrases |
| `activationDurationMs` | `30000` | Follow-up window after trigger (ms) |
| | | |
| **Behavior** | | |
| `enableBargeIn` | `false` | Interrupt bot when user speaks |
| `groupMode` | `false` | Track multiple speakers |
| `maxConcurrentSpeakers` | `3` | Max simultaneous speakers |
| `agentId` | `"main"` | OpenClaw agent to route messages to (use `"voice"` for dedicated voice agent) |

</details>

---

## 🏗 Architecture

```
src/
├── index.ts                      # OpenClaw plugin entry point
├── config-schema.ts              # Configuration schema (TypeBox)
├── types.ts                      # TypeScript interfaces
├── providers.ts                  # STT/TTS provider factory
│
├── discord/
│   ├── bot.ts                    # Discord client lifecycle
│   ├── voice-connection.ts       # Voice channel join/leave/reconnect
│   └── commands.ts               # Slash commands (/join, /leave, /mode, /status)
│
├── audio/
│   ├── audio-receiver.ts         # Per-user Opus → PCM capture
│   ├── audio-player.ts           # Queue-based Discord playback
│   └── stereo-to-mono.ts         # Stereo → Mono transform stream
│
├── stt/
│   ├── deepgram-client.ts        # Streaming WebSocket STT
│   ├── whisper-client.ts         # OpenAI Whisper API (batch)
│   ├── whisper-local-client.ts   # whisper.cpp local STT (free)
│   └── utterance-assembler.ts    # Transcript assembly
│
├── tts/
│   ├── openai-tts.ts             # OpenAI TTS (cloud)
│   └── edge-tts.ts               # Microsoft Edge TTS (free)
│
├── pipeline/
│   ├── voice-pipeline.ts         # Central audio orchestrator
│   ├── activation-filter.ts      # Wake word / always-active logic
│   └── speaker-tracker.ts        # Multi-speaker tracking
│
└── utils/
    └── logger.ts                 # Structured logging
```

---

## 🧰 Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Node.js** >= 22 | Required |
| **Discord bot** | With voice permissions ([setup guide](#1-create-a-discord-bot)) |
| **whisper.cpp** | Only for Whisper Local STT — `brew install whisper-cpp` (macOS) |
| **edge-tts** | Only for Edge TTS — `pip install edge-tts` |
| **ffmpeg** | Only for Edge TTS — `brew install ffmpeg` (macOS) |

---

## 🤝 Contributing

PRs and issues welcome. This is MIT licensed — fork it, hack it, make it yours.

```bash
npm run dev      # Watch mode (TypeScript)
npm test         # Run tests (vitest)
npm run build    # Compile to dist/
```

---

<div align="center">

**Built with 🎙 for the [OpenClaw](https://openclaw.ai) community.**

[GitHub](https://github.com/CryptoManiaques/ClawPilot) &nbsp;&middot;&nbsp; [OpenClaw.ai](https://openclaw.ai) &nbsp;&middot;&nbsp; [MIT License](LICENSE)

</div>
