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

  describe("agent name detection (anywhere in sentence)", () => {
    let filter: ActivationFilter;

    beforeEach(() => {
      filter = new ActivationFilter({
        mode: ActivationMode.WAKE_WORD,
        wakeWords: ["hey claw"],
        activationDurationMs: 5000,
        agentName: "bobby",
      });
    });

    it("should activate when agent name is at the start", () => {
      const result = filter.check("Bobby can you send an email");
      expect(result.shouldProcess).toBe(true);
      expect(result.cleanedText).toBe("can you send an email");
    });

    it("should activate when agent name is in the middle", () => {
      const result = filter.check("est-ce que bobby peut m'aider");
      expect(result.shouldProcess).toBe(true);
      expect(result.cleanedText).toBe("est-ce que peut m'aider");
    });

    it("should activate when agent name is at the end", () => {
      const result = filter.check("send an email bobby");
      expect(result.shouldProcess).toBe(true);
      expect(result.cleanedText).toBe("send an email");
    });

    it("should be case insensitive for agent name", () => {
      const result = filter.check("BOBBY what time is it");
      expect(result.shouldProcess).toBe(true);
      expect(result.cleanedText).toBe("what time is it");
    });

    it("should not activate when name is absent", () => {
      const result = filter.check("what is the weather today");
      expect(result.shouldProcess).toBe(false);
    });

    it("should still support wake word prefix alongside agent name", () => {
      const result = filter.check("hey claw what is the weather");
      expect(result.shouldProcess).toBe(true);
      expect(result.cleanedText).toBe("what is the weather");
    });

    it("should activate follow-up after agent name trigger", () => {
      filter.check("bobby");
      const result = filter.check("what is the weather");
      expect(result.shouldProcess).toBe(true);
      expect(result.cleanedText).toBe("what is the weather");
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
