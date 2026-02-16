---
name: clawpilot
description: Discord voice channel integration for OpenClaw. Talk to your AI agent through Discord voice - supports wake word activation ("Hey Claw") and always-active mode. Choose between paid (fast) or free (slower) STT/TTS providers.
---

# ClawPilot - Discord Voice for OpenClaw

Talk to your OpenClaw agent through Discord voice channels.

## Setup

1. **Create a Discord bot** at https://discord.com/developers/applications
   - Enable the "Voice" privileged gateway intent
   - Generate a bot token
   - Invite to your server with `bot` + `applications.commands` scopes

2. **Choose your providers** (see Providers section below)

3. **Install the plugin**
   ```
   openclaw plugins install @openclaw/clawpilot
   ```

4. **Configure** in `~/.openclaw/openclaw.json` (see examples below)

5. **Restart the gateway**: `openclaw restart`

## Usage

- `/join` - Bot joins your voice channel
- `/leave` - Bot leaves
- `/mode wake_word` or `/mode always_active` - Switch activation
- `/status` - Check connection status and provider info

Say "Hey Claw" followed by your question, or use always-active mode.

## Providers

### STT (Speech-to-Text)

| Provider | Cost | Latency | Setup |
|----------|------|---------|-------|
| **deepgram** (default) | ~$0.05/h | ~150-300ms streaming | `deepgramApiKey` required |
| **whisper** | ~$0.006/min via OpenAI | ~2-3s batch | `openaiApiKey` required |

### TTS (Text-to-Speech)

| Provider | Cost | Latency | Setup |
|----------|------|---------|-------|
| **openai** (default) | ~$0.003/h | ~200-400ms | `openaiApiKey` required |
| **edge** | Free | ~500-1000ms | `pip install edge-tts` + `ffmpeg` |

## Config Examples

### Premium — fastest (~$50/month)
```json
{
  "plugins": { "entries": { "clawpilot": { "enabled": true, "config": {
    "discordToken": "BOT_TOKEN",
    "sttProvider": "deepgram",
    "deepgramApiKey": "DEEPGRAM_KEY",
    "ttsProvider": "openai",
    "openaiApiKey": "OPENAI_KEY",
    "ttsVoice": "nova"
  }}}}
}
```

### Budget — one API key (~$10/month)
```json
{
  "plugins": { "entries": { "clawpilot": { "enabled": true, "config": {
    "discordToken": "BOT_TOKEN",
    "sttProvider": "whisper",
    "ttsProvider": "openai",
    "openaiApiKey": "OPENAI_KEY"
  }}}}
}
```

### Free — no API costs (edge-tts + ffmpeg needed locally)
```json
{
  "plugins": { "entries": { "clawpilot": { "enabled": true, "config": {
    "discordToken": "BOT_TOKEN",
    "sttProvider": "whisper",
    "openaiApiKey": "OPENAI_KEY",
    "ttsProvider": "edge",
    "edgeTtsVoice": "en-US-AriaNeural"
  }}}}
}
```

Note: the "free" config still needs an OpenAI key for Whisper STT ($0.006/min). For a truly free STT, self-host whisper.cpp — plugin support for local Whisper coming soon.
