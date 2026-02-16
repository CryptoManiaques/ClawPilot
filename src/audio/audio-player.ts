import {
  createAudioResource,
  createAudioPlayer,
  AudioPlayerStatus,
  StreamType,
  type VoiceConnection,
  type AudioPlayer as DiscordAudioPlayer,
} from "@discordjs/voice";
import { Readable } from "stream";
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
    const stream = Readable.from(buffer);

    const resource = createAudioResource(stream, {
      inputType: StreamType.Raw,
    });

    this.player.play(resource);
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
