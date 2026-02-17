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
import { openclawRuntime } from "../index.js";

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
  private isProcessingAgent = false;

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
          // Suppress STT input while the bot is speaking or processing to avoid feedback
          if (this.audioPlayer.playing || this.isProcessingAgent) {
            if (this.config.enableBargeIn) {
              this.audioPlayer.interrupt();
            }
            return;
          }
          this.stt.sendAudio(pcmChunk);
        });
      }
    });

    // Warmup: fire a quick ping to the voice agent to avoid cold start
    this.warmupAgent();

    this.logger.info("Voice pipeline started", {
      mode: this.activationFilter.currentMode,
      stt: this.config.sttProvider ?? "deepgram",
      tts: this.config.ttsProvider ?? "openai",
    });
  }

  /**
   * Fire a lightweight warmup call to the voice agent so the first real
   * request doesn't suffer cold-start latency.
   */
  private async warmupAgent() {
    const runtime = openclawRuntime;
    if (!runtime) return;

    try {
      const cfg = runtime.config.loadConfig();
      const voiceAgentId = this.config.agentId ?? "voice";

      const ctx = runtime.channel.reply.finalizeInboundContext({
        Body: "[system warmup ping]",
        RawBody: "ping",
        CommandBody: "ping",
        From: "discord-voice:system",
        To: `discord-voice:channel:${this.sessionKey}`,
        SessionKey: `agent:${voiceAgentId}:discord-voice:warmup`,
        AccountId: "default",
        ChatType: "direct",
        SenderName: "System",
        SenderId: "system",
        Provider: "discord",
        Surface: "discord",
        OriginatingChannel: "discord",
        OriginatingTo: `channel:${this.sessionKey}`,
        CommandAuthorized: true,
        CommandSource: "text",
      });

      // Fire and forget — don't await or care about response
      runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
        ctx,
        cfg,
        dispatcherOptions: {
          deliver: async () => {},
          onError: () => {},
        },
      }).then(() => {
        this.logger.info("Voice agent warmup completed");
      }).catch(() => {
        this.logger.debug("Voice agent warmup failed (non-critical)");
      });
    } catch {
      // Warmup is best-effort, don't crash
    }
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

    // Filter out whisper hallucinations (music tags, short noise, etc.)
    const lower = text.toLowerCase().trim();
    if (
      /^\[.*\]$/.test(lower) ||          // [Musique], [Music], etc.
      /^\(.*\)$/.test(lower) ||          // (musique), (music), etc.
      /^[-–—]/.test(lower) ||            // "- T'es..." fragments
      lower.length < 3                    // Too short to be meaningful
    ) {
      this.logger.debug("Whisper hallucination filtered", { text });
      return;
    }

    // Activation check
    const { shouldProcess, cleanedText } = this.activationFilter.check(text);
    if (!shouldProcess) {
      this.logger.debug("Utterance filtered out", { text });
      return;
    }

    this.logger.info("Processing utterance", { text: cleanedText });

    const runtime = openclawRuntime;
    if (runtime) {
      await this.dispatchToAgent(cleanedText, runtime);
    } else {
      this.logger.warn("No OpenClaw runtime available, using standalone echo mode");
      await this.speakResponse(`I heard: ${cleanedText}`);
    }
  }

  /**
   * Dispatch a voice utterance to the OpenClaw agent and stream the response
   * to TTS sentence-by-sentence for minimal latency.
   */
  private async dispatchToAgent(text: string, runtime: any) {
    this.isProcessingAgent = true;
    try {
      const cfg = runtime.config.loadConfig();
      const voiceAgentId = this.config.agentId ?? "voice";

      let route: any;
      try {
        route = runtime.channel.routing.resolveAgentRoute({
          cfg,
          channel: "discord",
          accountId: "default",
          peer: { kind: "direct", id: "voice-user" },
        });
      } catch {
        route = {
          agentId: voiceAgentId,
          accountId: "default",
          sessionKey: `agent:${voiceAgentId}:discord-voice:${this.sessionKey}`,
        };
      }

      // Session key must follow agent:<id>:<rest> for OpenClaw to resolve the correct agent/model
      route.agentId = voiceAgentId;
      route.sessionKey = `agent:${voiceAgentId}:discord-voice:${this.sessionKey}`;

      this.logger.info("Dispatching to agent", {
        agentId: route.agentId,
        sessionKey: route.sessionKey,
      });

      const envelopeOptions = runtime.channel.reply.resolveEnvelopeFormatOptions(cfg);
      const storePath = runtime.channel.session.resolveStorePath(
        cfg.session?.store,
        { agentId: route.agentId }
      );
      const previousTimestamp = runtime.channel.session.readSessionUpdatedAt({
        storePath,
        sessionKey: route.sessionKey,
      });

      const combinedBody = runtime.channel.reply.formatInboundEnvelope({
        channel: "Discord Voice",
        from: "voice-user",
        timestamp: Date.now(),
        body: text,
        chatType: "direct",
        senderLabel: "Voice User",
        previousTimestamp,
        envelope: envelopeOptions,
      });

      const ctx = runtime.channel.reply.finalizeInboundContext({
        Body: combinedBody,
        RawBody: text,
        CommandBody: text,
        From: "discord-voice:voice-user",
        To: `discord-voice:channel:${this.sessionKey}`,
        SessionKey: route.sessionKey,
        AccountId: route.accountId ?? "default",
        ChatType: "direct",
        SenderName: "Voice User",
        SenderId: "voice-user",
        Provider: "discord",
        Surface: "discord",
        OriginatingChannel: "discord",
        OriginatingTo: `channel:${this.sessionKey}`,
        CommandAuthorized: true,
        CommandSource: "text",
      });

      // Streaming: collect text and fire TTS as soon as we detect a sentence boundary
      let pendingText = "";
      let firstSentenceSpoken = false;
      const ttsQueue: Promise<void>[] = [];

      const flushSentence = (sentence: string) => {
        const cleaned = this.cleanTextForTTS(sentence);
        if (!cleaned) return;
        this.logger.info("Streaming TTS sentence", { text: cleaned, first: !firstSentenceSpoken });
        firstSentenceSpoken = true;
        // Queue the TTS+play — they will execute sequentially via audioPlayer queue
        const p = this.speakResponse(cleaned);
        ttsQueue.push(p);
      };

      // Sentence boundary regex: period, exclamation, question mark, or line break
      const SENTENCE_END = /[.!?]\s|[.!?]$|\n/;

      const dispatchPromise = runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
        ctx,
        cfg,
        dispatcherOptions: {
          deliver: async (payload: any, info: any) => {
            if (!payload.text) return;
            pendingText += payload.text;

            // Check for sentence boundaries and flush immediately
            let match;
            while ((match = SENTENCE_END.exec(pendingText)) !== null) {
              const sentence = pendingText.slice(0, match.index + match[0].length).trim();
              pendingText = pendingText.slice(match.index + match[0].length);
              if (sentence) flushSentence(sentence);
            }
          },
          onError: (err: any) => {
            this.logger.error("Agent reply error", { error: String(err) });
          },
        },
      });

      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("Agent dispatch timeout (15s)")), 15000)
      );

      try {
        await Promise.race([dispatchPromise, timeoutPromise]);
      } catch (timeoutErr) {
        this.logger.warn("Agent dispatch timed out", { pending: pendingText.length });
      }

      // Flush any remaining text after dispatch completes
      if (pendingText.trim()) {
        flushSentence(pendingText.trim());
        pendingText = "";
      }

      // Wait for all TTS to finish
      await Promise.all(ttsQueue);

      if (!firstSentenceSpoken) {
        this.logger.warn("Agent returned empty response");
      }
    } catch (err) {
      this.logger.error("Failed to dispatch to agent", { error: String(err) });
    } finally {
      this.isProcessingAgent = false;
    }
  }

  /**
   * Clean text for TTS: remove emojis, onomatopoeia, markdown, etc.
   */
  private cleanTextForTTS(text: string): string {
    let cleaned = text
      // Remove emoji (Unicode emoji ranges)
      .replace(/[\u{1F600}-\u{1F64F}]/gu, "")
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "")
      .replace(/[\u{2600}-\u{26FF}]/gu, "")
      .replace(/[\u{2700}-\u{27BF}]/gu, "")
      .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")
      .replace(/[\u{1FA00}-\u{1FA6F}]/gu, "")
      .replace(/[\u{1FA70}-\u{1FAFF}]/gu, "")
      .replace(/[\u{200D}]/gu, "")
      // Remove common onomatopoeia patterns
      .replace(/\b[Zz]{2,}\b/g, "")
      .replace(/\b[Hh]a[Hh]a[Hh]?a?\b/g, "")
      .replace(/\b[Hh]e[Hh]e[Hh]?e?\b/g, "")
      .replace(/\b[Hh]mm+\b/g, "")
      .replace(/\b[Uu]h+\b/g, "")
      .replace(/\b[Aa]h+\b/g, "")
      .replace(/\b[Oo]h+\b/g, "")
      .replace(/\b[Ee]h+\b/g, "")
      // Remove markdown formatting
      .replace(/\*{1,2}(.*?)\*{1,2}/g, "$1")
      .replace(/_{1,2}(.*?)_{1,2}/g, "$1")
      .replace(/`{1,3}[^`]*`{1,3}/g, "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^[-*]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "")
      // Clean up whitespace
      .replace(/\s{2,}/g, " ")
      .trim();

    return cleaned;
  }

  async speakResponse(text: string) {
    try {
      const cleaned = this.cleanTextForTTS(text);
      if (!cleaned) {
        this.logger.warn("Text empty after TTS cleanup, skipping");
        return;
      }
      const ttsStart = Date.now();
      const pcmAudio = await this.tts.synthesize(cleaned);
      this.logger.info("TTS synthesized", {
        chars: cleaned.length,
        audioBytes: pcmAudio.length,
        ttsMs: Date.now() - ttsStart,
      });
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
