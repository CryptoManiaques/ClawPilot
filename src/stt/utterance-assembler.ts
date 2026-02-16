import type { TranscriptResult } from "../types.js";

export class UtteranceAssembler {
  private finalizedSegments: string[] = [];

  /**
   * Process a transcript result from Deepgram.
   * Returns a complete utterance string when speech_final is detected, or null otherwise.
   */
  onTranscript(result: TranscriptResult): string | null {
    if (!result.isFinal) {
      // Interim result — don't accumulate, just used for display/preview
      return null;
    }

    // Final result for this segment
    if (result.text.trim()) {
      this.finalizedSegments.push(result.text.trim());
    }

    if (result.speechFinal) {
      return this.flush();
    }

    return null;
  }

  /**
   * Called when Deepgram fires UtteranceEnd (silence timeout).
   * Flushes any remaining finalized segments.
   */
  onUtteranceEnd(): string | null {
    if (this.finalizedSegments.length > 0) {
      return this.flush();
    }
    return null;
  }

  private flush(): string {
    const full = this.finalizedSegments.join(" ");
    this.finalizedSegments = [];
    return full;
  }

  reset() {
    this.finalizedSegments = [];
  }
}
