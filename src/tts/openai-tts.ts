import OpenAI from "openai";
import type { Logger, TTSProvider } from "../types.js";

/**
 * OpenAI TTS — Paid, high quality, fast.
 * ~$0.60/1M chars with gpt-4o-mini-tts. Natural voices.
 * Returns PCM 24kHz 16-bit mono.
 */
export class OpenAITTSClient implements TTSProvider {
  private client: OpenAI;

  constructor(
    apiKey: string,
    private logger: Logger,
    private options: {
      model?: string;
      voice?: string;
      speed?: number;
    } = {}
  ) {
    this.client = new OpenAI({ apiKey });
  }

  async synthesize(text: string): Promise<Buffer> {
    const response = await this.client.audio.speech.create({
      model: (this.options.model ?? "gpt-4o-mini-tts") as any,
      voice: (this.options.voice ?? "nova") as any,
      input: text,
      response_format: "pcm",
      speed: this.options.speed ?? 1.0,
    });

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
