---
name: clawpilot
description: Discord voice channel integration for OpenClaw. Talk to your AI agent through Discord voice - say its name anywhere in a sentence or use wake words. Choose between free (local) or paid (cloud) STT/TTS providers.
---

# ClawPilot - Discord Voice for OpenClaw

Talk to your OpenClaw agent through Discord voice channels.

## Setup — Step by step

### Step 1: Create a Discord Bot

1. Go to **https://discord.com/developers/applications**
2. Click **"New Application"** — give it a name (e.g. "ClawPilot")
3. Go to the **Bot** section (left sidebar)
4. Click **"Reset Token"** to generate a bot token — **copy it**, you'll need it later
5. Under **Privileged Gateway Intents**, enable:
   - **Server Members Intent**
   - **Message Content Intent**
6. Go to **OAuth2 > URL Generator** (left sidebar)
7. Under **Scopes**, check: `bot`, `applications.commands`
8. Under **Bot Permissions**, check:
   - **Connect** (join voice channels)
   - **Speak** (play audio in voice channels)
   - **Use Slash Commands**
9. Copy the generated URL at the bottom and **open it in your browser**
10. Select your Discord server and click **Authorize**

The bot is now in your server.

### Step 2: Choose your providers

Pick a STT and TTS provider based on your budget:

**Speech-to-Text (listening):**

| Provider | Latency | Cost | What you need |
|----------|---------|------|---------------|
| **deepgram** | ~200ms (real-time) | ~$0.05/h | `deepgramApiKey` — get one at [deepgram.com](https://deepgram.com) |
| **whisper** | ~2-3s (batch) | ~$0.006/min | `openaiApiKey` — get one at [platform.openai.com](https://platform.openai.com) |
| **whisper-local** | ~3-5s (batch) | **Free** | Install [whisper.cpp](https://github.com/ggerganov/whisper.cpp): `brew install whisper-cpp` (macOS) |

**Text-to-Speech (speaking):**

| Provider | Latency | Cost | What you need |
|----------|---------|------|---------------|
| **openai** | ~300ms | ~$0.003/h | `openaiApiKey` |
| **edge** | ~700ms | **Free** | `pip install edge-tts` + `ffmpeg` installed |

### Step 3: Install the plugin

```bash
git clone https://github.com/CryptoManiaques/ClawPilot.git
cd ClawPilot
npm install
npm run build
```

Or via OpenClaw:
```
openclaw plugins install @openclaw/clawpilot
```

### Step 4: Configure

Add to your OpenClaw config (`~/.openclaw/openclaw.json`):

```json
{
  "plugins": {
    "entries": {
      "clawpilot": {
        "enabled": true,
        "config": {
          "discordToken": "YOUR_BOT_TOKEN_FROM_STEP_1",
          "sttProvider": "whisper-local",
          "ttsProvider": "edge",
          "agentName": "bobby",
          "activationMode": "wake_word",
          "wakeWords": ["hey claw", "ok claw"]
        }
      }
    }
  }
}
```

### Step 5: Start

```
openclaw restart
```

Then in Discord:
1. Join a voice channel
2. Type `/join` in any text channel — the bot joins your voice
3. Say **"Bobby, can you send an email to John?"** (or whatever your agent name is)
4. The bot listens, sends the request to your agent, and speaks the answer back

## Activation modes

### Agent name (recommended)

Set `agentName` in config (e.g. `"bobby"`). Then say the name **anywhere** in a sentence:

- "Bobby, what's the weather?"
- "Can you help me bobby?"
- "Send an email bobby to John about the meeting"

The name is removed from the text before sending to the agent.

### Wake word (prefix)

Set `wakeWords` (e.g. `["hey claw", "ok claw"]`). Must be said at the **start** of the sentence:

- "Hey Claw, what's the weather?"
- "Ok Claw, send an email to John"

### Always active

Set `activationMode` to `"always_active"`. The bot listens to **everything** — no trigger needed. Best for solo use.

## Commands

- `/join` — Bot joins your voice channel
- `/leave` — Bot leaves
- `/mode wake_word` or `/mode always_active` — Switch activation mode
- `/status` — Check connection, providers, active speakers

## Config Examples

### Fully free ($0/month)
```json
{
  "discordToken": "BOT_TOKEN",
  "sttProvider": "whisper-local",
  "ttsProvider": "edge",
  "agentName": "bobby",
  "edgeTtsVoice": "en-US-AriaNeural"
}
```
Requires: whisper.cpp + edge-tts + ffmpeg installed locally.

### Balanced (~$10/month)
```json
{
  "discordToken": "BOT_TOKEN",
  "sttProvider": "deepgram",
  "deepgramApiKey": "DEEPGRAM_KEY",
  "ttsProvider": "edge",
  "agentName": "bobby"
}
```

### Premium (~$50/month)
```json
{
  "discordToken": "BOT_TOKEN",
  "sttProvider": "deepgram",
  "deepgramApiKey": "DEEPGRAM_KEY",
  "ttsProvider": "openai",
  "openaiApiKey": "OPENAI_KEY",
  "ttsVoice": "nova",
  "agentName": "bobby"
}
```

## Troubleshooting

- **Bot doesn't join voice**: Make sure it has **Connect** + **Speak** permissions in the channel
- **No transcription**: Check that your STT provider API key is correct. For whisper-local, run `whisper-cpp --help` to verify it's installed
- **No audio playback**: For Edge TTS, make sure `edge-tts` and `ffmpeg` are in your PATH
- **Bot doesn't respond to name**: Check `agentName` in config matches what you say (case insensitive)
