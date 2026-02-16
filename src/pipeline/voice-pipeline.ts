import type { VoiceConnection } from "@discordjs/voice";
import type { ClawPilotConfig } from "../config-schema.js";
import {
  ActivationMode,
  type Logger,
  type TranscriptResult,
  type STTProvider,
  type TTSProvider,
} from "../types.js";
import { AudioReceiver } from "../audio/audio-receiver.js";
import { AudioPlayer } from "../audio/audio-player.js";
import { createSTTProvider, createTTSProvider } from "../providers.js";
import { ActivationFilter } from "./activation-filter.js";
import { SpeakerTracker } from "./speaker-tracker.js";
import { UtteranceAssembler } from "../stt/utterance-assembler.js";
import type { MessageEnvelope } from "../index.js";

export class VoicePipeline {
  private audioReceiver: AudioReceiver;
  private audioPlayer: AudioPlayer;
  private stt: STTProvider;
  private tts: TTSProvider;
  private activationFilter: ActivationFilter;
  private speakerTracker: SpeakerTracker;
  private defaultAssembler: UtteranceAssembler;
  private startedAt = 0;
  private subscribedUsers = new Set<string>();
  private sessionKey: string;

  constructor(
    private connection: VoiceConnection,
    private config: ClawPilotConfig,
    private logger: Logger
  ) {
    this.audioReceiver = new AudioReceiver(logger);
    this.audioPlayer = new AudioPlayer(connection, logger);
    this.stt = createSTTProvider(config, logger);
    this.tts = createTTSProvider(config, logger);
    this.activationFilter = new ActivationFilter({
      mode:
        (config.activationMode as ActivationMode) ?? ActivationMode.WAKE_WORD,
      wakeWords: config.wakeWords ?? ["hey claw", "ok claw"],
      activationDurationMs: config.activationDurationMs ?? 30000,
      agentName: config.agentName,
    });
    this.speakerTracker = new SpeakerTracker();
    this.defaultAssembler = new UtteranceAssembler();
    this.sessionKey = `${connection.joinConfig.guildId}:${connection.joinConfig.channelId}`;
  }

  async start() {
    this.startedAt = Date.now();
    const receiver = this.connection.receiver;

    // Connect STT provider
    await this.stt.connect(
      (result) => this.onTranscript(result),
      () => this.onUtteranceEnd()
    );

    // Listen for users starting to speak
    receiver.speaking.on("start", (userId) => {
      this.speakerTracker.onSpeakingStart(userId, userId);
      if (!this.subscribedUsers.has(userId)) {
        this.subscribedUsers.add(userId);
        this.audioReceiver.subscribeToUser(receiver, userId, (pcmChunk) => {
          // Barge-in: if bot is speaking and user starts talking, interrupt
          if (this.audioPlayer.playing && (this.config.enableBargeIn ?? true)) {
            this.audioPlayer.interrupt();
          }
          this.stt.sendAudio(pcmChunk);
        });
      }
    });

    this.logger.info("Voice pipeline started", {
      mode: this.activationFilter.currentMode,
      stt: this.config.sttProvider ?? "deepgram",
      tts: this.config.ttsProvider ?? "openai",
    });
  }

  private onTranscript(result: TranscriptResult) {
    if (!result.text.trim()) return;

    const utterance = this.defaultAssembler.onTranscript(result);
    if (utterance) {
      this.processUtterance(utterance);
    }
  }

  private onUtteranceEnd() {
    const utterance = this.defaultAssembler.onUtteranceEnd();
    if (utterance) {
      this.processUtterance(utterance);
    }
  }

  private async processUtterance(text: string) {
    this.logger.debug("Utterance received", { text });

    // Activation check
    const { shouldProcess, cleanedText } = this.activationFilter.check(text);
    if (!shouldProcess) {
      this.logger.debug("Utterance filtered out", { text });
      return;
    }

    this.logger.info("Processing utterance", { text: cleanedText });

    // Route to OpenClaw agent via the inbound message queue
    const onInbound = (globalThis as any).__clawpilot_onInbound as
      | ((envelope: MessageEnvelope) => void)
      | undefined;

    if (onInbound) {
      onInbound({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        channel: "discord-voice",
        sender: "voice-user", // TODO: resolve actual Discord userId
        text: cleanedText,
        timestamp: Date.now(),
      });
    } else {
      // Standalone mode (no OpenClaw) — echo back via TTS
      await this.speakResponse(
        `I heard: ${cleanedText}`
      );
    }
  }

  async speakResponse(text: string) {
    try {
      this.logger.debug("Synthesizing TTS", { length: text.length });
      const pcmAudio = await this.tts.synthesize(text);
      await this.audioPlayer.playPCM(pcmAudio);
    } catch (err) {
      this.logger.error("TTS/playback failed", { error: String(err) });
    }
  }

  setActivationMode(mode: ActivationMode) {
    this.activationFilter.setMode(mode);
    this.logger.info("Activation mode changed", { mode });
  }

  getStatus() {
    return {
      activationMode: this.activationFilter.currentMode,
      sttConnected: this.stt.connected,
      sttProvider: this.config.sttProvider ?? "deepgram",
      ttsProvider: this.config.ttsProvider ?? "openai",
      activeSpeakers: this.subscribedUsers.size,
      uptimeMs: Date.now() - this.startedAt,
    };
  }

  async stop() {
    this.audioReceiver.unsubscribeAll();
    await this.stt.close();
    this.subscribedUsers.clear();
    this.logger.info("Voice pipeline stopped");
  }
}
