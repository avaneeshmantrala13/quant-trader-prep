/**
 * A tiny, feature-detected wrapper around the browser Web Speech RECOGNITION API:
 *   • `window.SpeechRecognition` / `window.webkitSpeechRecognition` (LISTEN)
 *
 * Everything is optional and defensively feature-detected. When the API is
 * missing (no microphone, SSR, or the Vitest `node` environment where there is
 * no `window`), the controller reports `supported: false` and its methods become
 * safe no-ops — callers then fall back to typed input, so the drill remains
 * fully usable.
 *
 * PRIVACY: recognition results are handed straight to the caller's callback and
 * NEVER stored, logged, or sent anywhere. No PII leaves this module.
 *
 * NOTE: The Web Speech types aren't in the app's ambient lib set, so this module
 * types the surface it uses locally (no global augmentation of shared files).
 */

/* -------------------------------------------------------------------------- */
/*  Minimal local typings for the Web Speech surface we touch                 */
/* -------------------------------------------------------------------------- */

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
  length: number;
}
interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechCapableWindow {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

/** Safe accessor for `window` that works in SSR / node test environments. */
function getWin(): SpeechCapableWindow | null {
  return typeof window === "undefined"
    ? null
    : (window as unknown as SpeechCapableWindow);
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = getWin();
  if (!w) return null;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Support detection                                                         */
/* -------------------------------------------------------------------------- */

export interface SpeechSupport {
  /** SpeechRecognition (listen) is available. */
  recognition: boolean;
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

/** Detect the Web Speech recognition surface. */
export function detectSpeechSupport(): SpeechSupport {
  return {
    recognition: isSpeechRecognitionSupported(),
  };
}

/* -------------------------------------------------------------------------- */
/*  Controller                                                                */
/* -------------------------------------------------------------------------- */

export interface ListenHandlers {
  /** Called with the (interim or final) transcript for the current utterance. */
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

export interface SpeechController {
  /** True iff recognition is available. */
  readonly supported: boolean;
  readonly support: SpeechSupport;
  /** Start listening. Returns `true` if listening actually began. */
  listen(handlers: ListenHandlers): boolean;
  /** Stop the current recognition session (safe to call anytime). */
  stop(): void;
}

export interface SpeechControllerOptions {
  /** BCP-47 language tag for recognition (default "en-US"). */
  lang?: string;
}

/**
 * Build a speech controller. In an unsupported environment every method is a
 * safe no-op and `supported` is `false`, so callers can branch once and
 * otherwise treat speech as best-effort enhancement over the typed baseline.
 */
export function createSpeechController(
  options?: SpeechControllerOptions,
): SpeechController {
  const support = detectSpeechSupport();
  const lang = options?.lang ?? "en-US";
  const RecognitionCtor = getRecognitionCtor();
  let recognition: SpeechRecognitionLike | null = null;

  return {
    supported: support.recognition,
    support,

    listen(handlers: ListenHandlers): boolean {
      if (!RecognitionCtor) return false;
      try {
        recognition = new RecognitionCtor();
        recognition.lang = lang;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.onresult = (e) => {
          let transcript = "";
          let isFinal = false;
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const res = e.results[i];
            transcript += res[0]?.transcript ?? "";
            if (res.isFinal) isFinal = true;
          }
          // Transcript is passed straight through — never stored here.
          handlers.onResult(transcript, isFinal);
        };
        recognition.onerror = (e) => handlers.onError?.(e.error);
        recognition.onend = () => handlers.onEnd?.();
        recognition.start();
        return true;
      } catch (err) {
        handlers.onError?.(err instanceof Error ? err.message : "speech-error");
        return false;
      }
    },

    stop() {
      try {
        recognition?.stop();
      } catch {
        /* ignore */
      }
    },
  };
}
