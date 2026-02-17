import { spawn } from "child_process";
import type { Logger, TTSProvider } from "../types.js";

/**
 * Edge TTS — Free, decent quality.
 * Uses Microsoft Edge's TTS engine via the edge-tts CLI tool.
 * No API key needed. Quality is good for free.
 * Requires: pip install edge-tts
 *
 * Returns PCM 48kHz 16-bit stereo (converted from MP3 via ffmpeg, ready for Discord).
 * If edge-tts is not installed, falls back to a helpful error.
 */
export class EdgeTTSClient implements TTSProvider {
  constructor(
    private logger: Logger,
    private options: {
      voice?: string;
    } = {}
  ) {}

  async synthesize(text: string): Promise<Buffer> {
    const voice = this.options.voice ?? "en-US-AriaNeural";

    // edge-tts outputs mp3, we pipe through ffmpeg to get raw PCM
    // edge-tts --voice "en-US-AriaNeural" --text "hello" --write-media /dev/stdout
    // | ffmpeg -i pipe:0 -f s16le -ar 24000 -ac 1 pipe:1
    return new Promise<Buffer>((resolve, reject) => {
      const edgeTts = spawn("edge-tts", [
        "--voice", voice,
        "--text", text,
        "--write-media", "-",
      ]);

      const ffmpeg = spawn("ffmpeg", [
        "-i", "pipe:0",
        "-f", "s16le",
        "-ar", "48000",
        "-ac", "2",
        "-loglevel", "error",
        "pipe:1",
      ]);

      edgeTts.stdout.pipe(ffmpeg.stdin);

      const chunks: Buffer[] = [];

      ffmpeg.stdout.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`ffmpeg exited with code ${code}`));
        }
      });

      edgeTts.on("error", (err) => {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          reject(
            new Error(
              "edge-tts not found. Install it with: pip install edge-tts\n" +
              "Also ensure ffmpeg is installed."
            )
          );
        } else {
          reject(err);
        }
      });

      ffmpeg.on("error", (err) => {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          reject(
            new Error(
              "ffmpeg not found. Install it with: brew install ffmpeg (macOS) " +
              "or apt install ffmpeg (Linux)"
            )
          );
        } else {
          reject(err);
        }
      });

      edgeTts.stderr.on("data", (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) this.logger.debug("edge-tts stderr", { msg });
      });

      ffmpeg.stderr.on("data", (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) this.logger.debug("ffmpeg stderr", { msg });
      });
    });
  }
}
