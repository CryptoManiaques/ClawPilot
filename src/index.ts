import { Type } from "@sinclair/typebox";
import { createDiscordVoiceBot } from "./discord/bot.js";
import type { ClawPilotConfig } from "./config-schema.js";
import { configSchema } from "./config-schema.js";
import { createLogger } from "./utils/logger.js";
import type { VoicePipeline } from "./pipeline/voice-pipeline.js";

// Registry of active voice pipelines keyed by sessionKey
export const voicePipelineRegistry = new Map<string, VoicePipeline>();

/**
 * OpenClaw Plugin Definition (PluginDefinition format).
 * Registers ClawPilot as a channel plugin with monitor/send pattern.
 */
export default {
  slot: "channel" as const,
  id: "discord-voice",

  schema: configSchema,

  async init(config: ClawPilotConfig, deps: { logger: any; configDir: string; rpc: any }) {
    const logger = createLogger("ClawPilot");
    logger.info("Initializing ClawPilot channel plugin...");

    const bot = await createDiscordVoiceBot(config, logger);

    // Inbound message queue: voice pipeline pushes transcribed utterances here
    const inboundQueue: Array<{
      resolve: (value: MessageEnvelope) => void;
    }> = [];
    const pendingMessages: MessageEnvelope[] = [];

    /**
     * Called by VoicePipeline when a user utterance passes activation filter.
     * Pushes it into the monitor async generator for the OpenClaw agent.
     */
    (globalThis as any).__clawpilot_onInbound = (envelope: MessageEnvelope) => {
      if (inboundQueue.length > 0) {
        const waiter = inboundQueue.shift()!;
        waiter.resolve(envelope);
      } else {
        pendingMessages.push(envelope);
      }
    };

    return {
      /**
       * Async generator yielding inbound messages (user speech → text).
       * The OpenClaw Gateway consumes this to route messages to the agent.
       */
      async *monitor(): AsyncGenerator<MessageEnvelope> {
        while (true) {
          if (pendingMessages.length > 0) {
            yield pendingMessages.shift()!;
          } else {
            yield await new Promise<MessageEnvelope>((resolve) => {
              inboundQueue.push({ resolve });
            });
          }
        }
      },

      /**
       * Called by the OpenClaw Gateway when the agent has a response.
       * Routes text to the appropriate VoicePipeline for TTS playback.
       */
      async send(envelope: OutboundMessageEnvelope) {
        const pipeline = voicePipelineRegistry.get(envelope.target);
        if (pipeline) {
          await pipeline.speakResponse(envelope.text);
        } else {
          logger.warn("No active voice pipeline for target", {
            target: envelope.target,
          });
        }
      },

      async login() {
        return { success: true };
      },

      async logout() {
        for (const pipeline of voicePipelineRegistry.values()) {
          await pipeline.stop();
        }
        voicePipelineRegistry.clear();
        await bot.destroy();
      },
    };
  },
};

// --- Types matching OpenClaw channel protocol ---

export interface MessageEnvelope {
  id: string;
  channel: string;
  sender: string;
  text: string;
  timestamp: number;
  replyToId?: string;
}

export interface OutboundMessageEnvelope {
  target: string;
  text: string;
  channel?: string;
  replyToId?: string;
}

/**
 * Standalone start function (for running outside OpenClaw, e.g. testing).
 */
export async function startClawPilot(config: ClawPilotConfig): Promise<{
  destroy: () => Promise<void>;
}> {
  const logger = createLogger("ClawPilot");
  logger.info("Starting ClawPilot (standalone mode)...");

  const bot = await createDiscordVoiceBot(config, logger);

  logger.info("ClawPilot started successfully");

  return {
    destroy: async () => {
      logger.info("Shutting down ClawPilot...");
      for (const pipeline of voicePipelineRegistry.values()) {
        await pipeline.stop();
      }
      voicePipelineRegistry.clear();
      await bot.destroy();
      logger.info("ClawPilot shut down");
    },
  };
}
