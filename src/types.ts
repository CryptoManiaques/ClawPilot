export enum ActivationMode {
  WAKE_WORD = "wake_word",
  ALWAYS_ACTIVE = "always_active",
}

export interface TranscriptResult {
  text: string;
  isFinal: boolean;
  speechFinal: boolean;
  confidence: number;
}

export type TranscriptCallback = (result: TranscriptResult) => void;

export interface SpeakerState {
  userId: string;
  displayName: string;
  lastSpoke: number;
}

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
}

// --- Abstract provider interfaces ---

/**
 * Speech-to-Text provider interface.
 * Implementations: DeepgramSTT (paid, fast), WhisperSTT (free, slower)
 */
export interface STTProvider {
  connect(
    onTranscript: TranscriptCallback,
    onUtteranceEnd: () => void
  ): Promise<void>;
  sendAudio(pcmChunk: Buffer): void;
  readonly connected: boolean;
  close(): Promise<void>;
}

/**
 * Text-to-Speech provider interface.
 * Implementations: OpenAITTS (paid, high quality), EdgeTTS (free, decent)
 */
export interface TTSProvider {
  synthesize(text: string): Promise<Buffer>;
}

export type STTProviderType = "deepgram" | "whisper" | "whisper-local";
export type TTSProviderType = "openai" | "edge";
