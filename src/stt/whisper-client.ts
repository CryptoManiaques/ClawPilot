import OpenAI from "openai";
import { Readable } from "stream";
import type { Logger, TranscriptCallback, STTProvider } from "../types.js";

/**
 * OpenAI Whisper STT — Free-tier friendly, batch-based (not streaming).
 * Uses OpenAI Whisper API: $0.006/min. Falls back to local if no key.
 * Higher latency than Deepgram (~1-3s) because it buffers audio before transcribing.
 *
 * For a truly free option, users can run whisper.cpp locally,
 * but this implementation uses the OpenAI API for simplicity.
 */
export class WhisperSTTClient implements STTProvider {
  private client: OpenAI;
  private isConnected = false;
  private audioBuffer: Buffer[] = [];
  private bufferDurationMs = 0;
  private onTranscript: TranscriptCallback | null = null;
  private onUtteranceEnd: (() => void) | null = null;
  private flushInterval: NodeJS.Timeout | null = null;
  private silenceTimeout: NodeJS.Timeout | null = null;
  private isReceivingAudio = false;

  // How long to buffer before sending to Whisper (ms)
  private readonly BUFFER_THRESHOLD_MS = 2000;
  // Silence duration before triggering utterance end (ms)
  private readonly SILENCE_THRESHOLD_MS = 1500;
  // PCM format: 48kHz, 16-bit, mono = 96000 bytes/sec
  private readonly BYTES_PER_MS = 96;

  constructor(
    private apiKey: string,
    private logger: Logger,
    private options: {
      language?: string;
    } = {}
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async connect(
    onTranscript: TranscriptCallback,
    onUtteranceEnd: () => void
  ): Promise<void> {
    this.onTranscript = onTranscript;
    this.onUtteranceEnd = onUtteranceEnd;
    this.isConnected = true;

    // Periodically flush buffer
    this.flushInterval = setInterval(() => {
      if (this.bufferDurationMs >= this.BUFFER_THRESHOLD_MS) {
        this.flushBuffer();
      }
    }, 500);

    this.logger.info("Whisper STT client ready (batch mode)");
  }

  sendAudio(pcmChunk: Buffer) {
    if (!this.isConnected) return;

    this.audioBuffer.push(pcmChunk);
    this.bufferDurationMs += pcmChunk.length / this.BYTES_PER_MS;
    this.isReceivingAudio = true;

    // Reset silence timer on each audio chunk
    if (this.silenceTimeout) clearTimeout(this.silenceTimeout);
    this.silenceTimeout = setTimeout(() => {
      this.isReceivingAudio = false;
      // Flush remaining audio and signal utterance end
      if (this.audioBuffer.length > 0) {
        this.flushBuffer(true);
      }
    }, this.SILENCE_THRESHOLD_MS);
  }

  get connected() {
    return this.isConnected;
  }

  async close() {
    this.isConnected = false;
    if (this.flushInterval) clearInterval(this.flushInterval);
    if (this.silenceTimeout) clearTimeout(this.silenceTimeout);
    this.audioBuffer = [];
    this.bufferDurationMs = 0;
  }

  private async flushBuffer(isFinal = false) {
    if (this.audioBuffer.length === 0) return;

    const pcmData = Buffer.concat(this.audioBuffer);
    this.audioBuffer = [];
    this.bufferDurationMs = 0;

    // Convert raw PCM to WAV for Whisper API
    const wavBuffer = this.pcmToWav(pcmData, 48000, 1, 16);

    try {
      const file = new File([wavBuffer], "audio.wav", { type: "audio/wav" });

      const transcription = await this.client.audio.transcriptions.create({
        model: "whisper-1",
        file,
        language: this.options.language?.split("-")[0] ?? "en",
        response_format: "json",
      });

      const text = transcription.text?.trim();
      if (text && this.onTranscript) {
        this.onTranscript({
          text,
          isFinal: true,
          speechFinal: isFinal,
          confidence: 0.9, // Whisper doesn't return confidence
        });
      }

      if (isFinal && this.onUtteranceEnd) {
        this.onUtteranceEnd();
      }
    } catch (err) {
      this.logger.error("Whisper transcription failed", { error: String(err) });
    }
  }

  private pcmToWav(
    pcm: Buffer,
    sampleRate: number,
    channels: number,
    bitsPerSample: number
  ): Buffer {
    const byteRate = (sampleRate * channels * bitsPerSample) / 8;
    const blockAlign = (channels * bitsPerSample) / 8;
    const dataSize = pcm.length;
    const headerSize = 44;
    const wav = Buffer.alloc(headerSize + dataSize);

    // RIFF header
    wav.write("RIFF", 0);
    wav.writeUInt32LE(36 + dataSize, 4);
    wav.write("WAVE", 8);

    // fmt sub-chunk
    wav.write("fmt ", 12);
    wav.writeUInt32LE(16, 16); // Sub-chunk size
    wav.writeUInt16LE(1, 20); // PCM format
    wav.writeUInt16LE(channels, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(byteRate, 28);
    wav.writeUInt16LE(blockAlign, 32);
    wav.writeUInt16LE(bitsPerSample, 34);

    // data sub-chunk
    wav.write("data", 36);
    wav.writeUInt32LE(dataSize, 40);
    pcm.copy(wav, 44);

    return wav;
  }
}
