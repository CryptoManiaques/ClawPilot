import { createDiscordVoiceBot } from "./discord/bot.js";
import type { ClawPilotConfig } from "./config-schema.js";
import { createLogger } from "./utils/logger.js";
import type { VoicePipeline } from "./pipeline/voice-pipeline.js";
import type { Client } from "discord.js";

// Registry of active voice pipelines keyed by sessionKey
export const voicePipelineRegistry = new Map<string, VoicePipeline>();

// Hold bot reference for service lifecycle
let botInstance: { client: Client; destroy: () => Promise<void> } | null = null;

// OpenClaw runtime reference — set during register(), used by voice pipeline
export let openclawRuntime: any = null;

/**
 * OpenClaw Plugin Definition (new SDK format).
 * Registers ClawPilot as a service that starts the Discord voice bot.
 */
const plugin = {
  id: "clawpilot",
  name: "ClawPilot",
  description: "Discord voice channel integration — talk to your AI agent through Discord voice.",

  register(api: any) {
    const pluginConfig = (api.pluginConfig ?? {}) as ClawPilotConfig;

    // Capture the OpenClaw runtime for agent message dispatching
    openclawRuntime = api.runtime ?? null;

    api.registerService({
      id: "clawpilot-discord",

      async start() {
        const logger = api.logger ?? createLogger("ClawPilot");
        logger.info("Starting ClawPilot Discord voice bot...", {
          hasRuntime: !!openclawRuntime,
        });

        if (!pluginConfig.discordToken) {
          logger.error("discordToken is required in ClawPilot config");
          return;
        }

        try {
          botInstance = await createDiscordVoiceBot(pluginConfig, logger);
          logger.info("ClawPilot Discord bot started successfully");
        } catch (err) {
          logger.error(`Failed to start ClawPilot: ${err}`);
        }
      },

      async stop() {
        const logger = api.logger ?? createLogger("ClawPilot");
        logger.info("Stopping ClawPilot...");

        for (const pipeline of voicePipelineRegistry.values()) {
          await pipeline.stop();
        }
        voicePipelineRegistry.clear();

        if (botInstance) {
          await botInstance.destroy();
          botInstance = null;
        }

        openclawRuntime = null;
        logger.info("ClawPilot stopped");
      },
    });
  },
};

export default plugin;

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
