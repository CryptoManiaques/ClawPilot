import { describe, it, expect } from "vitest";
import { StereoToMono } from "../src/audio/stereo-to-mono.js";

describe("StereoToMono", () => {
  it("should convert stereo s16le to mono by averaging channels", (ctx) => {
    return new Promise<void>((resolve) => {
      const converter = new StereoToMono();

      // Create stereo buffer: L=1000, R=2000 → mono should be 1500
      const stereoBuffer = Buffer.alloc(4);
      stereoBuffer.writeInt16LE(1000, 0); // Left
      stereoBuffer.writeInt16LE(2000, 2); // Right

      converter.on("data", (chunk: Buffer) => {
        expect(chunk.length).toBe(2); // mono = half the size
        expect(chunk.readInt16LE(0)).toBe(1500);
        converter.destroy();
        resolve();
      });

      converter.write(stereoBuffer);
    });
  });

  it("should handle multiple samples", () => {
    return new Promise<void>((resolve) => {
      const converter = new StereoToMono();

      // 2 stereo samples = 8 bytes
      const stereoBuffer = Buffer.alloc(8);
      stereoBuffer.writeInt16LE(100, 0);  // L1
      stereoBuffer.writeInt16LE(200, 2);  // R1
      stereoBuffer.writeInt16LE(-100, 4); // L2
      stereoBuffer.writeInt16LE(-300, 6); // R2

      converter.on("data", (chunk: Buffer) => {
        expect(chunk.length).toBe(4); // 2 mono samples
        expect(chunk.readInt16LE(0)).toBe(150);  // avg(100, 200)
        expect(chunk.readInt16LE(2)).toBe(-200);  // avg(-100, -300)
        converter.destroy();
        resolve();
      });

      converter.write(stereoBuffer);
    });
  });

  it("should handle silence (zero values)", () => {
    return new Promise<void>((resolve) => {
      const converter = new StereoToMono();

      const stereoBuffer = Buffer.alloc(4);
      stereoBuffer.writeInt16LE(0, 0);
      stereoBuffer.writeInt16LE(0, 2);

      converter.on("data", (chunk: Buffer) => {
        expect(chunk.readInt16LE(0)).toBe(0);
        converter.destroy();
        resolve();
      });

      converter.write(stereoBuffer);
    });
  });
});
