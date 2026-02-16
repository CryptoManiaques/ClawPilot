import { type VoiceReceiver, EndBehaviorType } from "@discordjs/voice";
import prismMedia from "prism-media";
import { StereoToMono } from "./stereo-to-mono.js";
import type { Logger } from "../types.js";
import type { Readable, Transform } from "stream";

const { opus } = prismMedia;

interface ActiveStream {
  opusStream: Readable;
  decoder: Transform;
  monoConverter: StereoToMono;
}

export class AudioReceiver {
  private activeStreams = new Map<string, ActiveStream>();

  constructor(private logger: Logger) {}

  subscribeToUser(
    receiver: VoiceReceiver,
    userId: string,
    onAudioChunk: (pcmMono: Buffer) => void
  ) {
    // Don't double-subscribe
    if (this.activeStreams.has(userId)) return;

    const opusStream = receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.Manual },
    });

    const decoder = new opus.Decoder({
      rate: 48000,
      channels: 2,
      frameSize: 960,
    });

    const monoConverter = new StereoToMono();

    opusStream
      .pipe(decoder)
      .pipe(monoConverter)
      .on("data", (chunk: Buffer) => {
        onAudioChunk(chunk);
      });

    opusStream.on("error", (err: Error) => {
      this.logger.error("Opus stream error", { userId, error: String(err) });
    });

    decoder.on("error", (err: Error) => {
      this.logger.error("Opus decoder error", { userId, error: String(err) });
    });

    this.activeStreams.set(userId, { opusStream, decoder, monoConverter });
    this.logger.debug("Subscribed to user audio", { userId });
  }

  unsubscribeUser(userId: string) {
    const stream = this.activeStreams.get(userId);
    if (stream) {
      stream.opusStream.destroy();
      stream.decoder.destroy();
      stream.monoConverter.destroy();
      this.activeStreams.delete(userId);
      this.logger.debug("Unsubscribed from user audio", { userId });
    }
  }

  unsubscribeAll() {
    for (const userId of this.activeStreams.keys()) {
      this.unsubscribeUser(userId);
    }
  }

  get activeUserCount() {
    return this.activeStreams.size;
  }
}
