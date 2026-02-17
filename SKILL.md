---
name: clawpilot
description: Discord voice channel integration for OpenClaw. Talk to your AI agent through Discord voice - say its name anywhere in a sentence or use wake words. Choose between free (local) or paid (cloud) STT/TTS providers. Streams responses sentence-by-sentence for fast voice interaction.
---

# ClawPilot - Discord Voice for OpenClaw

Talk to your OpenClaw agent through Discord voice channels.

## Setup — Step by step

### Step 1: Create a Discord Bot

1. Go to **https://discord.com/developers/applications**
2. Click **"New Application"** — give it a name (e.g. "ClawPilot")
3. Go to the **Bot** section (left sidebar)
4. Click **"Reset Token"** to generate a bot token — **copy it**, you'll need it later
5. Under **Privileged Gateway Intents** — no privileged intents are needed. Leave everything off.
6. Go to **OAuth2 > URL Generator** (left sidebar)
7. Under **Scopes**, check: `bot`, `applications.commands`
8. Under **Bot Permissions**, check exactly these 5 permissions:

   **General Permissions:**
   - View Channels

   **Text Permissions:**
   - Send Messages
   - Use Slash Commands

   **Voice Permissions:**
   - Connect
   - Speak

9. Copy the generated URL at the bottom and **open it in your browser**
10. Select your Discord server and click **Authorize**

### Step 2: Choose your settings

**What language will you mainly speak?**
- `fr` — French
- `en` — English
- `es` — Spanish
- `de` — German
- Any ISO language code

**What name should the agent respond to?**
Pick a short, easy-to-pronounce name (e.g. "bobby", "claw", "jarvis", "friday"). You'll say this name in voice to activate the agent.

**Which STT (Speech-to-Text) provider?**

| Provider | Latency | Cost | Setup |
|----------|---------|------|-------|
| `whisper-local` | ~2-3s | **Free** | Install [whisper.cpp](https://github.com/ggerganov/whisper.cpp) + download a model |
| `deepgram` | ~200ms | ~$0.05/h | Get API key at [deepgram.com](https://deepgram.com) |
| `whisper` | ~2-3s | ~$0.006/min | Get API key at [platform.openai.com](https://platform.openai.com) |

**Which TTS (Text-to-Speech) provider?**

| Provider | Latency | Cost | Setup |
|----------|---------|------|-------|
| `edge` | ~1-2s | **Free** | `pip install edge-tts` + `ffmpeg` |
| `openai` | ~300ms | ~$15/1M chars | Get API key at [platform.openai.com](https://platform.openai.com) |

**Which TTS voice?**
- For Edge TTS (free), pick from [the voice list](https://gist.github.com/BettyJJ/17cbaa1de96235a7f5773b8571a4f741). Popular choices:
  - French: `fr-FR-RemyMultilingualNeural` (warm male), `fr-FR-DeniseNeural` (female)
  - English: `en-US-AndrewMultilingualNeural` (natural male), `en-US-AriaNeural` (female)
- For OpenAI TTS: `nova` (female), `onyx` (male), `alloy` (neutral), `echo`, `fable`, `shimmer`

**Which model for the voice agent?**
The voice agent should use a fast model for quick responses:
- `anthropic/claude-sonnet-4-5-20250929` — recommended (fast + smart)
- `anthropic/claude-haiku-3-5-20241022` — fastest, cheapest, good for simple Q&A

### Step 3: Install ClawPilot

```bash
git clone https://github.com/CryptoManiaques/ClawPilot.git
cd ClawPilot
npm install
```

For **whisper-local** STT (free):
```bash
# macOS
brew install whisper-cpp ffmpeg
pip install edge-tts
whisper-cpp-download-ggml-model tiny  # or: base, small, medium

# Linux (Ubuntu/Debian)
apt install ffmpeg
pip install edge-tts
# Build whisper.cpp from source: https://github.com/ggerganov/whisper.cpp
```

Register as an OpenClaw plugin:
```bash
openclaw plugins install --link /path/to/ClawPilot
```

### Step 4: Create a voice agent

Add a dedicated voice agent to your OpenClaw config (`~/.openclaw/openclaw.json`). This agent uses a fast model optimized for short voice responses:

```jsonc
{
  "agents": {
    "list": [
      // ... your existing agents ...
      {
        "id": "voice",
        "name": "YOUR_AGENT_NAME Voice",
        "model": {
          "primary": "anthropic/claude-sonnet-4-5-20250929"
        },
        "workspace": "~/.openclaw/agents/voice",
        "agentDir": "~/.openclaw/agents/voice/agent"
      }
    ]
  }
}
```

Create the voice agent system prompt:
```bash
mkdir -p ~/.openclaw/agents/voice/agent
```

Write `~/.openclaw/agents/voice/agent/AGENT.md`:
```markdown
# Voice Agent — YOUR_AGENT_NAME

You are YOUR_AGENT_NAME, a friendly AI assistant responding via Discord voice chat.
Your responses are converted to speech, so write exactly as you would speak.

## Rules (STRICT)
- Maximum 1-2 sentences. NEVER more than 3 sentences.
- Be conversational and warm, like a friend
- Match the user's language (French or English)
- NEVER use markdown: no asterisks, no bold, no italic, no headers, no lists, no code blocks
- NEVER use emojis or emoticons
- Write pure plain spoken text only
- If unsure, ask to repeat briefly
- Answer directly, no filler phrases
```

### Step 5: Configure the plugin

Add to your OpenClaw config under `plugins.entries`:

```jsonc
{
  "plugins": {
    "entries": {
      "clawpilot": {
        "enabled": true,
        "config": {
          "discordToken": "YOUR_DISCORD_BOT_TOKEN",
          "sttProvider": "whisper-local",
          "ttsProvider": "edge",
          "edgeTtsVoice": "fr-FR-RemyMultilingualNeural",
          "agentName": "bobby",
          "agentId": "voice",
          "activationMode": "always_active"
        }
      }
    }
  }
}
```

> Replace `agentName` with the name you chose, `edgeTtsVoice` with your preferred voice, and `agentId` with `"voice"` to use the dedicated fast voice agent.

### Step 6: Start

```bash
openclaw gateway restart
```

Then in Discord:
1. Join a voice channel
2. Type `/join` in any text channel
3. Speak! Say your agent's name to trigger it (or just speak if using `always_active` mode)

## Activation modes

### Agent name (recommended)
Set `agentName` in config. Say the name **anywhere** in a sentence:
- "Bobby, what's the weather?"
- "Can you help me bobby?"

### Always active
Set `activationMode` to `"always_active"`. Listens to **everything**. Best for solo use.

### Wake word (prefix)
Set `wakeWords` (e.g. `["hey claw"]`). Must be at the **start**:
- "Hey Claw, what's the weather?"

## Commands

- `/join` — Bot joins your voice channel
- `/leave` — Bot leaves
- `/mode wake_word` or `/mode always_active` — Switch activation mode
- `/status` — Connection info, providers, active speakers, uptime

## Config reference

| Key | Default | Description |
|-----|---------|-------------|
| `discordToken` | — | Discord bot token **(required)** |
| `sttProvider` | `"deepgram"` | `"deepgram"`, `"whisper"`, or `"whisper-local"` |
| `ttsProvider` | `"openai"` | `"openai"` or `"edge"` |
| `agentName` | — | Name the agent responds to (e.g. `"bobby"`) |
| `agentId` | `"main"` | OpenClaw agent to route voice messages to |
| `activationMode` | `"wake_word"` | `"wake_word"` or `"always_active"` |
| `edgeTtsVoice` | `"en-US-AriaNeural"` | Edge TTS voice |
| `deepgramApiKey` | — | Required if sttProvider = deepgram |
| `deepgramLanguage` | `"en-US"` | Deepgram language |
| `openaiApiKey` | — | Required if ttsProvider = openai |
| `ttsVoice` | `"nova"` | OpenAI TTS voice |
| `whisperModelPath` | — | Path to whisper.cpp model file |
| `enableBargeIn` | `false` | Interrupt bot when user speaks |
| `wakeWords` | `["hey claw", "ok claw"]` | Prefix trigger phrases |

## Troubleshooting

- **Bot doesn't join voice**: Make sure it has **Connect** + **Speak** permissions
- **No transcription**: For whisper-local, run `whisper-cpp --help` to verify it's installed
- **No audio playback**: Make sure `edge-tts` and `ffmpeg` are in your PATH
- **Bot doesn't respond to name**: Check `agentName` matches what you say (case insensitive)
- **First response is slow**: Normal — the voice agent needs a cold start. Subsequent responses are faster.
- **Audio cuts off mid-sentence**: Make sure `enableBargeIn` is `false` (default)
