import type { Logger, STTProvider, TTSProvider, STTProviderType, TTSProviderType } from "./types.js";
import type { ClawPilotConfig } from "./config-schema.js";
import { DeepgramSTTClient } from "./stt/deepgram-client.js";
import { WhisperSTTClient } from "./stt/whisper-client.js";
import { WhisperLocalSTTClient } from "./stt/whisper-local-client.js";
import { OpenAITTSClient } from "./tts/openai-tts.js";
import { EdgeTTSClient } from "./tts/edge-tts.js";

/**
 * Create the STT provider based on user config.
 *
 * - "deepgram" (default): Fast streaming, ~$0.05/h. Needs deepgramApiKey.
 * - "whisper": Batch via OpenAI API, ~$0.006/min. Needs openaiApiKey.
 * - "whisper-local": Fully free, runs whisper.cpp locally. Needs whisper-cpp installed.
 */
export function createSTTProvider(
  config: ClawPilotConfig,
  logger: Logger
): STTProvider {
  const provider = (config.sttProvider ?? "deepgram") as STTProviderType;

  switch (provider) {
    case "whisper-local":
      logger.info("Using Whisper Local STT (free, offline, whisper.cpp)");
      return new WhisperLocalSTTClient(logger, {
        model: config.whisperModel,
        language: config.deepgramLanguage,
        whisperBin: config.whisperBin,
      });

    case "whisper":
      if (!config.openaiApiKey) {
        throw new Error("Whisper STT requires openaiApiKey in config");
      }
      logger.info("Using Whisper STT (batch mode, OpenAI API)");
      return new WhisperSTTClient(config.openaiApiKey, logger, {
        language: config.deepgramLanguage,
      });

    case "deepgram":
    default:
      if (!config.deepgramApiKey) {
        throw new Error("Deepgram STT requires deepgramApiKey in config");
      }
      logger.info("Using Deepgram STT (streaming, fast)");
      return new DeepgramSTTClient(config.deepgramApiKey, logger, {
        model: config.deepgramModel,
        language: config.deepgramLanguage,
      });
  }
}

/**
 * Create the TTS provider based on user config.
 *
 * - "openai" (default): High quality, ~$0.003/h. Needs openaiApiKey.
 * - "edge": Free (Microsoft Edge TTS). Needs edge-tts + ffmpeg installed locally.
 */
export function createTTSProvider(
  config: ClawPilotConfig,
  logger: Logger
): TTSProvider {
  const provider = (config.ttsProvider ?? "openai") as TTSProviderType;

  switch (provider) {
    case "edge":
      logger.info("Using Edge TTS (free, requires edge-tts + ffmpeg)");
      return new EdgeTTSClient(logger, {
        voice: config.edgeTtsVoice,
      });

    case "openai":
    default:
      if (!config.openaiApiKey) {
        throw new Error("OpenAI TTS requires openaiApiKey in config");
      }
      logger.info("Using OpenAI TTS (high quality, paid)");
      return new OpenAITTSClient(config.openaiApiKey, logger, {
        model: config.ttsModel,
        voice: config.ttsVoice,
        speed: config.ttsSpeed,
      });
  }
}
