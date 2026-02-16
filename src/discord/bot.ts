import { Client, GatewayIntentBits, REST, Routes } from "discord.js";
import type { ClawPilotConfig } from "../config-schema.js";
import type { Logger } from "../types.js";
import { getCommandsJSON, setupCommandHandlers } from "./commands.js";
import { connectToVoiceChannel } from "./voice-connection.js";
import { VoicePipeline } from "../pipeline/voice-pipeline.js";
import { voicePipelineRegistry } from "../index.js";

export async function createDiscordVoiceBot(
  config: ClawPilotConfig,
  logger: Logger
): Promise<{ client: Client; destroy: () => Promise<void> }> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
    ],
  });

  // Register slash commands
  const rest = new REST({ version: "10" }).setToken(config.discordToken);

  client.once("ready", async () => {
    if (!client.user) return;
    logger.info("Discord bot ready", { tag: client.user.tag });

    // Register commands globally (or per-guild if guildId is set)
    try {
      const commandData = getCommandsJSON();
      if (config.guildId) {
        await rest.put(
          Routes.applicationGuildCommands(client.user.id, config.guildId),
          { body: commandData }
        );
        logger.info("Registered guild commands", { guildId: config.guildId });
      } else {
        await rest.put(Routes.applicationCommands(client.user.id), {
          body: commandData,
        });
        logger.info("Registered global commands");
      }
    } catch (err) {
      logger.error("Failed to register commands", { error: String(err) });
    }

    // Auto-join configured voice channel
    if (config.voiceChannelId && config.guildId) {
      try {
        const guild = await client.guilds.fetch(config.guildId);
        const channel = await guild.channels.fetch(config.voiceChannelId);
        if (channel?.isVoiceBased()) {
          const connection = await connectToVoiceChannel(channel, logger);
          const sessionKey = `${config.guildId}:${config.voiceChannelId}`;
          const pipeline = new VoicePipeline(connection, config, logger);
          voicePipelineRegistry.set(sessionKey, pipeline);
          await pipeline.start();
          logger.info("Auto-joined voice channel", {
            channelId: config.voiceChannelId,
          });
        }
      } catch (err) {
        logger.error("Failed to auto-join voice channel", {
          error: String(err),
        });
      }
    }
  });

  // Setup command handlers
  setupCommandHandlers(client, config, logger);

  await client.login(config.discordToken);

  return {
    client,
    destroy: async () => {
      client.destroy();
    },
  };
}
