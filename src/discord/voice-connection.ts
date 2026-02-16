import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  type VoiceConnection,
} from "@discordjs/voice";
import type { VoiceBasedChannel } from "discord.js";
import type { Logger } from "../types.js";

const RECONNECT_TIMEOUT_MS = 20_000;
const READY_TIMEOUT_MS = 30_000;

export async function connectToVoiceChannel(
  channel: VoiceBasedChannel,
  logger: Logger
): Promise<VoiceConnection> {
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false, // Must be false to receive audio
    selfMute: false,
  });

  // Handle disconnects with auto-reconnection
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    logger.warn("Voice connection disconnected, attempting reconnect...");
    try {
      // Try to reconnect within timeout
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, RECONNECT_TIMEOUT_MS),
        entersState(connection, VoiceConnectionStatus.Connecting, RECONNECT_TIMEOUT_MS),
      ]);
      logger.info("Voice connection reconnecting...");
    } catch {
      // Could not reconnect — destroy and let caller handle
      logger.error("Voice connection failed to reconnect, destroying");
      connection.destroy();
    }
  });

  // Wait for connection to be ready
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, READY_TIMEOUT_MS);
    logger.info("Voice connection ready", {
      channelId: channel.id,
      guildId: channel.guild.id,
    });
  } catch {
    connection.destroy();
    throw new Error(
      `Failed to connect to voice channel ${channel.id} within ${READY_TIMEOUT_MS}ms`
    );
  }

  return connection;
}
