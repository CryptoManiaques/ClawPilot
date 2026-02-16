import { ActivationMode } from "../types.js";

export class ActivationFilter {
  private wakeWords: string[];
  private agentName: string | null;
  private mode: ActivationMode;
  private isActivated = false;
  private activationTimeout: NodeJS.Timeout | null = null;
  private activationDurationMs: number;

  constructor(config: {
    mode: ActivationMode;
    wakeWords: string[];
    activationDurationMs: number;
    agentName?: string;
  }) {
    this.mode = config.mode;
    this.wakeWords = config.wakeWords.map((w) => w.toLowerCase());
    this.activationDurationMs = config.activationDurationMs;
    this.agentName = config.agentName?.toLowerCase() ?? null;
  }

  check(transcribedText: string): {
    shouldProcess: boolean;
    cleanedText: string;
  } {
    if (this.mode === ActivationMode.ALWAYS_ACTIVE) {
      return { shouldProcess: true, cleanedText: transcribedText };
    }

    const lower = transcribedText.toLowerCase().trim();

    // 1. Check for wake word at start of utterance (prefix mode)
    for (const wakeWord of this.wakeWords) {
      if (lower.startsWith(wakeWord)) {
        this.activate();
        const cleaned = transcribedText.slice(wakeWord.length).trim();
        if (cleaned.length > 0) {
          return { shouldProcess: true, cleanedText: cleaned };
        }
        // Wake word only — stay activated for follow-up
        return { shouldProcess: false, cleanedText: "" };
      }
    }

    // 2. Check for agent name anywhere in the sentence
    if (this.agentName && lower.includes(this.agentName)) {
      this.activate();
      // Remove the agent name from the text (first occurrence)
      const nameIndex = lower.indexOf(this.agentName);
      const before = transcribedText.slice(0, nameIndex);
      const after = transcribedText.slice(nameIndex + this.agentName.length);
      const cleaned = (before + after).replace(/\s+/g, " ").trim();
      if (cleaned.length > 0) {
        return { shouldProcess: true, cleanedText: cleaned };
      }
      return { shouldProcess: false, cleanedText: "" };
    }

    // 3. If within activation window, process without trigger
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
