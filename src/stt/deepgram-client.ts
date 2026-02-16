import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import type { Logger, TranscriptCallback, STTProvider } from "../types.js";

/**
 * Deepgram STT — Paid, fast, streaming.
 * ~$0.0043/min. Latency: ~150-300ms. Best for real-time.
 */
export class DeepgramSTTClient implements STTProvider {
  private connection: any = null;
  private deepgram: any;
  private isConnected = false;

  constructor(
    private apiKey: string,
    private logger: Logger,
    private options: {
      model?: string;
      language?: string;
    } = {}
  ) {
    this.deepgram = createClient(apiKey);
  }

  async connect(
    onTranscript: TranscriptCallback,
    onUtteranceEnd: () => void
  ): Promise<void> {
    this.connection = this.deepgram.listen.live({
      model: this.options.model ?? "nova-3",
      language: this.options.language ?? "en-US",
      smart_format: true,
      encoding: "linear16",
      sample_rate: 48000,
      channels: 1,
      interim_results: true,
      utterance_end_ms: 1200,
      vad_events: true,
      endpointing: 300,
    });

    return new Promise<void>((resolve, reject) => {
      this.connection.on(LiveTranscriptionEvents.Open, () => {
        this.isConnected = true;
        this.logger.info("Deepgram connection opened");
        resolve();
      });

      this.connection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        const alt = data.channel?.alternatives?.[0];
        if (!alt) return;

        onTranscript({
          text: alt.transcript || "",
          isFinal: data.is_final ?? false,
          speechFinal: data.speech_final ?? false,
          confidence: alt.confidence ?? 0,
        });
      });

      this.connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
        onUtteranceEnd();
      });

      this.connection.on(LiveTranscriptionEvents.Error, (err: any) => {
        this.logger.error("Deepgram error", { error: String(err) });
        this.isConnected = false;
      });

      this.connection.on(LiveTranscriptionEvents.Close, () => {
        this.logger.warn("Deepgram connection closed");
        this.isConnected = false;
      });

      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error("Deepgram connection timeout"));
        }
      }, 10_000);
    });
  }

  sendAudio(pcmChunk: Buffer) {
    if (this.connection && this.isConnected) {
      this.connection.send(pcmChunk);
    }
  }

  get connected() {
    return this.isConnected;
  }

  async close() {
    if (this.connection) {
      this.connection.requestClose();
      this.isConnected = false;
    }
  }
}
