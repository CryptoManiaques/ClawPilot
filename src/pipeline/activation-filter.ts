import { ActivationMode } from "../types.js";

export class ActivationFilter {
  private wakeWords: string[];
  private mode: ActivationMode;
  private isActivated = false;
  private activationTimeout: NodeJS.Timeout | null = null;
  private activationDurationMs: number;

  constructor(config: {
    mode: ActivationMode;
    wakeWords: string[];
    activationDurationMs: number;
  }) {
    this.mode = config.mode;
    this.wakeWords = config.wakeWords.map((w) => w.toLowerCase());
    this.activationDurationMs = config.activationDurationMs;
  }

  check(transcribedText: string): {
    shouldProcess: boolean;
    cleanedText: string;
  } {
    if (this.mode === ActivationMode.ALWAYS_ACTIVE) {
      return { shouldProcess: true, cleanedText: transcribedText };
    }

    const lower = transcribedText.toLowerCase().trim();

    // Check for wake word at start of utterance
    for (const wakeWord of this.wakeWords) {
      if (lower.startsWith(wakeWord)) {
        this.activate();
        const cleaned = transcribedText.slice(wakeWord.length).trim();
        // If there's content after the wake word, process it
        if (cleaned.length > 0) {
          return { shouldProcess: true, cleanedText: cleaned };
        }
        // Wake word only — stay activated for follow-up utterance
        return { shouldProcess: false, cleanedText: "" };
      }
    }

    // If within activation window, process without wake word
    if (this.isActivated) {
      return { shouldProcess: true, cleanedText: transcribedText };
    }

    return { shouldProcess: false, cleanedText: "" };
  }

  setMode(mode: ActivationMode) {
    this.mode = mode;
    this.deactivate();
  }

  get currentMode() {
    return this.mode;
  }

  private activate() {
    this.isActivated = true;
    if (this.activationTimeout) clearTimeout(this.activationTimeout);
    this.activationTimeout = setTimeout(() => {
      this.isActivated = false;
    }, this.activationDurationMs);
  }

  private deactivate() {
    this.isActivated = false;
    if (this.activationTimeout) {
      clearTimeout(this.activationTimeout);
      this.activationTimeout = null;
    }
  }
}
