import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
  ChannelType,
} from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";
import type { ClawPilotConfig } from "../config-schema.js";
import type { Logger } from "../types.js";
import { ActivationMode } from "../types.js";
import { connectToVoiceChannel } from "./voice-connection.js";
import { VoicePipeline } from "../pipeline/voice-pipeline.js";
import { voicePipelineRegistry } from "../index.js";

const commands = [
  new SlashCommandBuilder()
    .setName("join")
    .setDescription("ClawPilot joins your voice channel"),
  new SlashCommandBuilder()
    .setName("leave")
    .setDescription("ClawPilot leaves the voice channel"),
  new SlashCommandBuilder()
    .setName("mode")
    .setDescription("Switch activation mode")
    .addStringOption((opt) =>
      opt
        .setName("mode")
        .setDescription("Activation mode")
        .setRequired(true)
        .addChoices(
          { name: "Wake Word", value: "wake_word" },
          { name: "Always Active", value: "always_active" }
        )
    ),
  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show ClawPilot status"),
];

export function getCommandsJSON() {
  return commands.map((cmd) => cmd.toJSON());
}

export function setupCommandHandlers(
  client: Client,
  config: ClawPilotConfig,
  logger: Logger
) {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
      switch (interaction.commandName) {
        case "join":
          await handleJoin(interaction, config, logger);
          break;
        case "leave":
          await handleLeave(interaction, logger);
          break;
        case "mode":
          await handleMode(interaction, logger);
          break;
        case "status":
          await handleStatus(interaction, logger);
          break;
      }
    } catch (err) {
      logger.error("Command error", {
        command: interaction.commandName,
        error: String(err),
      });
      const reply = interaction.replied || interaction.deferred
        ? interaction.followUp.bind(interaction)
        : interaction.reply.bind(interaction);
      await reply({ content: "An error occurred.", ephemeral: true });
    }
  });
}

async function handleJoin(
  interaction: ChatInputCommandInteraction,
  config: ClawPilotConfig,
  logger: Logger
) {
  const member = await interaction.guild?.members.fetch(interaction.user.id);
  const voiceChannel = member?.voice.channel;

  if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
    await interaction.reply({
      content: "You need to be in a voice channel first.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const connection = await connectToVoiceChannel(voiceChannel, logger);
  const sessionKey = `${voiceChannel.guild.id}:${voiceChannel.id}`;

  // Stop existing pipeline if any
  const existing = voicePipelineRegistry.get(sessionKey);
  if (existing) {
    await existing.stop();
  }

  const pipeline = new VoicePipeline(connection, config, logger);
  voicePipelineRegistry.set(sessionKey, pipeline);
  await pipeline.start();

  await interaction.editReply(
    `Joined **${voiceChannel.name}**. Mode: **${config.activationMode ?? "wake_word"}**`
  );
}

async function handleLeave(
  interaction: ChatInputCommandInteraction,
  logger: Logger
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: "Not in a guild.", ephemeral: true });
    return;
  }

  const connection = getVoiceConnection(guildId);
  if (!connection) {
    await interaction.reply({
      content: "I'm not in a voice channel.",
      ephemeral: true,
    });
    return;
  }

  // Find and stop pipeline
  for (const [key, pipeline] of voicePipelineRegistry) {
    if (key.startsWith(guildId)) {
      await pipeline.stop();
      voicePipelineRegistry.delete(key);
    }
  }

  connection.destroy();
  logger.info("Left voice channel", { guildId });
  await interaction.reply({ content: "Left the voice channel.", ephemeral: true });
}

async function handleMode(
  interaction: ChatInputCommandInteraction,
  logger: Logger
) {
  const mode = interaction.options.getString("mode", true);
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: "Not in a guild.", ephemeral: true });
    return;
  }

  // Find pipeline for this guild
  for (const [key, pipeline] of voicePipelineRegistry) {
    if (key.startsWith(guildId)) {
      pipeline.setActivationMode(mode as ActivationMode);
      logger.info("Activation mode changed", { mode });
      await interaction.reply({
        content: `Activation mode set to **${mode}**`,
        ephemeral: true,
      });
      return;
    }
  }

  await interaction.reply({
    content: "Not in a voice channel. Use `/join` first.",
    ephemeral: true,
  });
}

async function handleStatus(
  interaction: ChatInputCommandInteraction,
  logger: Logger
) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: "Not in a guild.", ephemeral: true });
    return;
  }

  for (const [key, pipeline] of voicePipelineRegistry) {
    if (key.startsWith(guildId)) {
      const status = pipeline.getStatus();
      await interaction.reply({
        content: [
          "**ClawPilot Status**",
          `Mode: ${status.activationMode}`,
          `STT: ${status.sttProvider} (${status.sttConnected ? "connected" : "disconnected"})`,
          `TTS: ${status.ttsProvider}`,
          `Active speakers: ${status.activeSpeakers}`,
          `Uptime: ${Math.floor(status.uptimeMs / 1000)}s`,
        ].join("\n"),
        ephemeral: true,
      });
      return;
    }
  }

  await interaction.reply({
    content: "Not in a voice channel. Use `/join` first.",
    ephemeral: true,
  });
}
