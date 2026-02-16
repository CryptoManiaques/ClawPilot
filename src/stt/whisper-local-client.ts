import { spawn, type ChildProcess } from "child_process";
import { writeFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import type { Logger, TranscriptCallback, STTProvider } from "../types.js";

/**
 * Whisper Local STT — Fully free, runs on your machine via whisper.cpp.
 * No API key needed. Downloads the model once, then runs offline.
 *
 * Latency: ~1-2s (GPU) / ~3-8s (CPU) per utterance.
 * Accuracy: Same as OpenAI Whisper.
 *
 * Requires: whisper.cpp binary in PATH (or whisperModel path configured).
 * Install: brew install whisper-cpp (macOS) or build from source.
 *
 * Strategy: Buffer PCM audio chunks, detect silence, then batch-transcribe
 * the buffered audio via whisper.cpp CLI.
 */
export class WhisperLocalSTTClient implements STTProvider {
  private isConnected = false;
  private audioBuffer: Buffer[] = [];
  private bufferDurationMs = 0;
  private onTranscript: TranscriptCallback | null = null;
  private onUtteranceEnd: (() => void) | null = null;
  private silenceTimeout: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private tmpDir: string | null = null;

  // PCM 48kHz 16-bit mono = 96000 bytes/sec = 96 bytes/ms
  private readonly BYTES_PER_MS = 96;
  // Min audio length to bother transcribing (500ms)
  private readonly MIN_BUFFER_MS = 500;
  // Silence duration before triggering transcription
  private readonly SILENCE_THRESHOLD_MS = 1200;

  constructor(
    private logger: Logger,
    private options: {
      model?: string; // tiny, base, small, medium, large
      language?: string;
      whisperBin?: string; // path to whisper.cpp binary
    } = {}
  ) {}

  async connect(
    onTranscript: TranscriptCallback,
    onUtteranceEnd: () => void
  ): Promise<void> {
    this.onTranscript = onTranscript;
    this.onUtteranceEnd = onUtteranceEnd;
    this.tmpDir = await mkdtemp(join(tmpdir(), "clawpilot-whisper-"));
    this.isConnected = true;
    this.logger.info("Whisper Local STT ready", {
      model: this.options.model ?? "base",
      tmpDir: this.tmpDir,
    });
  }

  sendAudio(pcmChunk: Buffer) {
    if (!this.isConnected || this.isProcessing) return;

    this.audioBuffer.push(pcmChunk);
    this.bufferDurationMs += pcmChunk.length / this.BYTES_PER_MS;

    // Reset silence timer
    if (this.silenceTimeout) clearTimeout(this.silenceTimeout);
    this.silenceTimeout = setTimeout(() => {
      if (this.bufferDurationMs >= this.MIN_BUFFER_MS) {
        this.transcribeBuffer();
      }
    }, this.SILENCE_THRESHOLD_MS);
  }

  get connected() {
    return this.isConnected;
  }

  async close() {
    this.isConnected = false;
    if (this.silenceTimeout) clearTimeout(this.silenceTimeout);
    this.audioBuffer = [];
    this.bufferDurationMs = 0;
  }

  private async transcribeBuffer() {
    if (this.audioBuffer.length === 0 || this.isProcessing) return;

    this.isProcessing = true;
    const pcmData = Buffer.concat(this.audioBuffer);
    this.audioBuffer = [];
    this.bufferDurationMs = 0;

    try {
      // Write PCM as WAV to temp file
      const wavPath = join(this.tmpDir!, `audio-${Date.now()}.wav`);
      const wavBuffer = this.pcmToWav(pcmData, 48000, 1, 16);
      await writeFile(wavPath, wavBuffer);

      // Run whisper.cpp
      const text = await this.runWhisper(wavPath);

      // Cleanup temp file
      await unlink(wavPath).catch(() => {});

      if (text.trim() && this.onTranscript) {
        this.onTranscript({
          text: text.trim(),
          isFinal: true,
          speechFinal: true,
          confidence: 0.9,
        });
      }

      if (this.onUtteranceEnd) {
        this.onUtteranceEnd();
      }
    } catch (err) {
      this.logger.error("Whisper local transcription failed", {
        error: String(err),
      });
    } finally {
      this.isProcessing = false;
    }
  }

  private runWhisper(wavPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const bin = this.options.whisperBin ?? "whisper-cpp";
      const model = this.options.model ?? "base";
      const lang = this.options.language?.split("-")[0] ?? "en";

      const proc = spawn(bin, [
        "-m", `ggml-${model}.bin`,
        "-f", wavPath,
        "-l", lang,
        "--no-timestamps",
        "-nt", // no timestamps in output
      ]);

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          // whisper.cpp outputs text with leading whitespace, clean it
          resolve(stdout.trim());
        } else {
          reject(
            new Error(
              `whisper-cpp exited with code ${code}: ${stderr.trim()}\n` +
                "Make sure whisper-cpp is installed: brew install whisper-cpp (macOS)\n" +
                "And download a model: whisper-cpp-download-ggml-model base"
            )
          );
        }
      });

      proc.on("error", (err) => {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          reject(
            new Error(
              `whisper-cpp binary not found at "${bin}".\n` +
                "Install: brew install whisper-cpp (macOS) or build from https://github.com/ggerganov/whisper.cpp\n" +
                "Or set whisperBin in config to the full path."
            )
          );
        } else {
          reject(err);
        }
      });
    });
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
    const wav = Buffer.alloc(44 + dataSize);

    wav.write("RIFF", 0);
    wav.writeUInt32LE(36 + dataSize, 4);
    wav.write("WAVE", 8);
    wav.write("fmt ", 12);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(channels, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(byteRate, 28);
    wav.writeUInt16LE(blockAlign, 32);
    wav.writeUInt16LE(bitsPerSample, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(dataSize, 40);
    pcm.copy(wav, 44);

    return wav;
  }
}
