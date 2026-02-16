import { Type, type Static } from "@sinclair/typebox";

export const configSchema = Type.Object({
  // Discord
  discordToken: Type.String({ description: "Discord bot token" }),
  guildId: Type.Optional(
    Type.String({ description: "Guild to join (auto-detect if omitted)" })
  ),
  voiceChannelId: Type.Optional(
    Type.String({ description: "Voice channel to auto-join on startup" })
  ),

  // --- STT Provider ---
  sttProvider: Type.Optional(
    Type.String({
      default: "deepgram",
      description:
        'STT engine: "deepgram" (fast, paid), "whisper" (OpenAI API), or "whisper-local" (free, local whisper.cpp)',
    })
  ),

  // Deepgram-specific (used when sttProvider = "deepgram")
  deepgramApiKey: Type.Optional(
    Type.String({ description: "Deepgram API key (required if sttProvider=deepgram)" })
  ),
  deepgramModel: Type.Optional(Type.String({ default: "nova-3" })),
  deepgramLanguage: Type.Optional(Type.String({ default: "en-US" })),

  // --- TTS Provider ---
  ttsProvider: Type.Optional(
    Type.String({
      default: "openai",
      description:
        'TTS engine: "openai" (high quality, paid ~$0.003/h) or "edge" (free, needs edge-tts + ffmpeg)',
    })
  ),

  // OpenAI-specific (used when ttsProvider = "openai" OR sttProvider = "whisper")
  openaiApiKey: Type.Optional(
    Type.String({
      description:
        "OpenAI API key (required if ttsProvider=openai or sttProvider=whisper)",
    })
  ),
  ttsModel: Type.Optional(Type.String({ default: "gpt-4o-mini-tts" })),
  ttsVoice: Type.Optional(Type.String({ default: "nova" })),
  ttsSpeed: Type.Optional(
    Type.Number({ default: 1.0, minimum: 0.25, maximum: 4.0 })
  ),

  // Edge TTS-specific (used when ttsProvider = "edge")
  edgeTtsVoice: Type.Optional(
    Type.String({
      default: "en-US-AriaNeural",
      description: "Edge TTS voice name (see: edge-tts --list-voices)",
    })
  ),

  // Whisper Local-specific (used when sttProvider = "whisper-local")
  whisperModel: Type.Optional(
    Type.String({
      default: "base",
      description:
        'Whisper model size: "tiny" (fastest), "base", "small", "medium", "large" (most accurate)',
    })
  ),
  whisperBin: Type.Optional(
    Type.String({
      description: "Path to whisper-cpp binary (default: whisper-cpp in PATH)",
    })
  ),

  // Activation
  activationMode: Type.Optional(Type.String({ default: "wake_word" })),
  wakeWords: Type.Optional(
    Type.Array(Type.String(), { default: ["hey claw", "ok claw"] })
  ),
  activationDurationMs: Type.Optional(Type.Number({ default: 30000 })),

  // Behavior
  enableBargeIn: Type.Optional(Type.Boolean({ default: true })),
  groupMode: Type.Optional(Type.Boolean({ default: false })),
  maxConcurrentSpeakers: Type.Optional(Type.Number({ default: 3 })),

  // Agent
  agentId: Type.Optional(Type.String({ default: "main" })),
  agentName: Type.Optional(
    Type.String({
      description:
        'Agent name for activation (e.g. "bobby"). If set, saying the name anywhere in a sentence triggers the agent — no need for a prefix wake word.',
    })
  ),
});

export type ClawPilotConfig = Static<typeof configSchema>;
