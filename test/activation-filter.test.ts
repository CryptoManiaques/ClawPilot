import { describe, it, expect, beforeEach } from "vitest";
import { ActivationFilter } from "../src/pipeline/activation-filter.js";
import { ActivationMode } from "../src/types.js";

describe("ActivationFilter", () => {
  describe("always_active mode", () => {
    let filter: ActivationFilter;

    beforeEach(() => {
      filter = new ActivationFilter({
        mode: ActivationMode.ALWAYS_ACTIVE,
        wakeWords: ["hey claw"],
        activationDurationMs: 30000,
      });
    });

    it("should process all utterances", () => {
      const result = filter.check("what is the weather today");
      expect(result.shouldProcess).toBe(true);
      expect(result.cleanedText).toBe("what is the weather today");
    });

    it("should pass through text unchanged", () => {
      const result = filter.check("hey claw do something");
      expect(result.shouldProcess).toBe(true);
      expect(result.cleanedText).toBe("hey claw do something");
    });
  });

  describe("wake_word mode", () => {
    let filter: ActivationFilter;

    beforeEach(() => {
      filter = new ActivationFilter({
        mode: ActivationMode.WAKE_WORD,
        wakeWords: ["hey claw", "ok claw"],
        activationDurationMs: 5000,
      });
    });

    it("should not process without wake word", () => {
      const result = filter.check("what is the weather today");
      expect(result.shouldProcess).toBe(false);
      expect(result.cleanedText).toBe("");
    });

    it("should process with wake word and strip it", () => {
      const result = filter.check("hey claw what is the weather");
      expect(result.shouldProcess).toBe(true);
      expect(result.cleanedText).toBe("what is the weather");
    });

    it("should handle alternative wake words", () => {
      const result = filter.check("ok claw tell me a joke");
      expect(result.shouldProcess).toBe(true);
      expect(result.cleanedText).toBe("tell me a joke");
    });

    it("should not process if wake word only", () => {
      const result = filter.check("hey claw");
      expect(result.shouldProcess).toBe(false);
      expect(result.cleanedText).toBe("");
    });

    it("should process follow-up within activation window", () => {
      // First trigger wake word
      filter.check("hey claw");
      // Then send follow-up without wake word
      const result = filter.check("what is the weather");
      expect(result.shouldProcess).toBe(true);
      expect(result.cleanedText).toBe("what is the weather");
    });

    it("should be case insensitive", () => {
      const result = filter.check("Hey Claw what time is it");
      expect(result.shouldProcess).toBe(true);
      expect(result.cleanedText).toBe("what time is it");
    });
  });

  describe("mode switching", () => {
    it("should switch from wake_word to always_active", () => {
      const filter = new ActivationFilter({
        mode: ActivationMode.WAKE_WORD,
        wakeWords: ["hey claw"],
        activationDurationMs: 5000,
      });

      expect(filter.check("hello").shouldProcess).toBe(false);

      filter.setMode(ActivationMode.ALWAYS_ACTIVE);
      expect(filter.check("hello").shouldProcess).toBe(true);
    });
  });
});
