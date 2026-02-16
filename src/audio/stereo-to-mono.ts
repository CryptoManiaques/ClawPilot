import { Transform, type TransformCallback } from "stream";

/**
 * Converts interleaved stereo s16le PCM to mono s16le by averaging L+R channels.
 * Input: 48kHz, 16-bit, stereo (4 bytes per sample pair)
 * Output: 48kHz, 16-bit, mono (2 bytes per sample)
 */
export class StereoToMono extends Transform {
  _transform(chunk: Buffer, _encoding: string, callback: TransformCallback) {
    const monoBuffer = Buffer.alloc(chunk.length / 2);
    for (let i = 0; i < chunk.length; i += 4) {
      const left = chunk.readInt16LE(i);
      const right = chunk.readInt16LE(i + 2);
      const mono = Math.round((left + right) / 2);
      monoBuffer.writeInt16LE(mono, i / 2);
    }
    callback(null, monoBuffer);
  }
}
