import type { SpeakerState } from "../types.js";
import { UtteranceAssembler } from "../stt/utterance-assembler.js";

export class SpeakerTracker {
  private speakers = new Map<
    string,
    SpeakerState & { assembler: UtteranceAssembler }
  >();

  onSpeakingStart(userId: string, displayName: string) {
    if (!this.speakers.has(userId)) {
      this.speakers.set(userId, {
        userId,
        displayName,
        lastSpoke: Date.now(),
        assembler: new UtteranceAssembler(),
      });
    }
    this.speakers.get(userId)!.lastSpoke = Date.now();
  }

  getAssembler(userId: string): UtteranceAssembler | undefined {
    return this.speakers.get(userId)?.assembler;
  }

  formatForAgent(userId: string, text: string): string {
    const speaker = this.speakers.get(userId);
    const name = speaker?.displayName || "Unknown";
    return `[${name}]: ${text}`;
  }

  get activeSpeakerCount() {
    return this.speakers.size;
  }

  cleanup(idleMs: number = 60_000) {
    const now = Date.now();
    for (const [userId, state] of this.speakers) {
      if (now - state.lastSpoke > idleMs) {
        this.speakers.delete(userId);
      }
    }
  }
}
