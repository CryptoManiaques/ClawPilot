import {
  createAudioResource,
  createAudioPlayer,
  AudioPlayerStatus,
  StreamType,
  type VoiceConnection,
  type AudioPlayer as DiscordAudioPlayer,
} from "@discordjs/voice";
import { PassThrough } from "stream";
import type { Logger } from "../types.js";

export class AudioPlayer {
  private player: DiscordAudioPlayer;
  private queue: Buffer[] = [];
  private isPlaying = false;

  constructor(
    connection: VoiceConnection,
    private logger: Logger
  ) {
    this.player = createAudioPlayer();
    connection.subscribe(this.player);

    this.player.on(AudioPlayerStatus.Idle, () => {
      this.isPlaying = false;
      this.playNext();
    });

    this.player.on("error", (err) => {
      this.logger.error("Audio player error", { error: String(err) });
      this.isPlaying = false;
      this.playNext();
    });
  }

  async playPCM(pcmBuffer: Buffer) {
    this.queue.push(pcmBuffer);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private playNext() {
    const buffer = this.queue.shift();
    if (!buffer) return;

    this.isPlaying = true;

    // Use PassThrough with chunked writes instead of Readable.from(buffer)
    // which pushes all data at once causing Discord audio player to go idle immediately
    const stream = new PassThrough();
    const resource = createAudioResource(stream, {
      inputType: StreamType.Raw,
    });
    this.player.play(resource);

    // Write PCM data in 20ms chunks (48kHz * 2ch * 2bytes * 0.020s = 3840 bytes)
    const CHUNK_SIZE = 3840;
    let offset = 0;
    const writeChunks = () => {
      while (offset < buffer.length) {
        const end = Math.min(offset + CHUNK_SIZE, buffer.length);
        const chunk = buffer.subarray(offset, end);
        const canContinue = stream.write(chunk);
        offset = end;
        if (!canContinue) {
          stream.once("drain", writeChunks);
          return;
        }
      }
      stream.end();
    };
    writeChunks();
  }

  interrupt() {
    this.queue = [];
    this.player.stop(true);
    this.isPlaying = false;
  }

  get playing() {
    return this.isPlaying;
  }
}
