import { describe, it, expect, beforeEach } from "vitest";
import { UtteranceAssembler } from "../src/stt/utterance-assembler.js";

describe("UtteranceAssembler", () => {
  let assembler: UtteranceAssembler;

  beforeEach(() => {
    assembler = new UtteranceAssembler();
  });

  it("should return null for interim results", () => {
    const result = assembler.onTranscript({
      text: "hello",
      isFinal: false,
      speechFinal: false,
      confidence: 0.9,
    });
    expect(result).toBeNull();
  });

  it("should return null for final but not speech_final", () => {
    const result = assembler.onTranscript({
      text: "hello",
      isFinal: true,
      speechFinal: false,
      confidence: 0.95,
    });
    expect(result).toBeNull();
  });

  it("should return text when speech_final is true", () => {
    // First segment
    assembler.onTranscript({
      text: "hello world",
      isFinal: true,
      speechFinal: false,
      confidence: 0.95,
    });
    // speech_final segment
    const result = assembler.onTranscript({
      text: "how are you",
      isFinal: true,
      speechFinal: true,
      confidence: 0.95,
    });
    expect(result).toBe("hello world how are you");
  });

  it("should return single segment on speech_final", () => {
    const result = assembler.onTranscript({
      text: "hello",
      isFinal: true,
      speechFinal: true,
      confidence: 0.95,
    });
    expect(result).toBe("hello");
  });

  it("should flush on utteranceEnd", () => {
    assembler.onTranscript({
      text: "hello",
      isFinal: true,
      speechFinal: false,
      confidence: 0.95,
    });
    const result = assembler.onUtteranceEnd();
    expect(result).toBe("hello");
  });

  it("should return null on utteranceEnd with no segments", () => {
    const result = assembler.onUtteranceEnd();
    expect(result).toBeNull();
  });

  it("should ignore empty text segments", () => {
    assembler.onTranscript({
      text: "",
      isFinal: true,
      speechFinal: false,
      confidence: 0.0,
    });
    assembler.onTranscript({
      text: "hello",
      isFinal: true,
      speechFinal: true,
      confidence: 0.95,
    });
    // Should not have an empty prefix
    const result = assembler.onUtteranceEnd();
    // Already flushed by speechFinal, so this returns null
    expect(result).toBeNull();
  });

  it("should reset state after flush", () => {
    assembler.onTranscript({
      text: "first",
      isFinal: true,
      speechFinal: true,
      confidence: 0.95,
    });

    // Second utterance should be independent
    const result = assembler.onTranscript({
      text: "second",
      isFinal: true,
      speechFinal: true,
      confidence: 0.95,
    });
    expect(result).toBe("second");
  });
});
