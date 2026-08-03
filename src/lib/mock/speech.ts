/**
 * A tiny, feature-detected wrapper around the browser Web Speech APIs:
 *   • `window.SpeechRecognition` / `window.webkitSpeechRecognition` (LISTEN)
 *   • `window.speechSynthesis` (SPEAK)
 *
 * Everything is optional and defensively feature-detected. When the APIs are
 * missing (no microphone, SSR, or the Vitest `node` environment where there is
 * no `window`), the controller reports `supported: false` and its methods become
 * safe no-ops — callers then fall back to typed input and on-screen text, so the
 * drill remains fully usable.
 *
 * PRIVACY: recognition results are handed straight to the caller's callback and
 * NEVER stored, logged, or sent anywhere. `speechSynthesis` only ever receives
 * text the app itself generated (question prompts). No PII leaves this module.
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

/**
 * The subset of `SpeechSynthesisVoice` we rank on. Kept structural (not the DOM
 * type) so `pickBestVoice` is unit-testable with plain objects.
 */
export interface VoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

interface SpeechSynthesisLike {
  speak(u: unknown): void;
  cancel(): void;
  getVoices?(): VoiceLike[];
  onvoiceschanged?: (() => void) | null;
}

interface SpeechCapableWindow {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
  speechSynthesis?: SpeechSynthesisLike;
  SpeechSynthesisUtterance?: new (text: string) => Record<string, unknown>;
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
  /** speechSynthesis (speak) is available. */
  synthesis: boolean;
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function isSpeechSynthesisSupported(): boolean {
  const w = getWin();
  return (
    !!w &&
    typeof w.speechSynthesis !== "undefined" &&
    typeof w.SpeechSynthesisUtterance !== "undefined"
  );
}

/** Detect both halves of the Web Speech surface in one call. */
export function detectSpeechSupport(): SpeechSupport {
  return {
    recognition: isSpeechRecognitionSupported(),
    synthesis: isSpeechSynthesisSupported(),
  };
}

/* -------------------------------------------------------------------------- */
/*  PURE speech-quality helpers (voice ranking + sentence chunking)            */
/* -------------------------------------------------------------------------- */

/**
 * Substrings (lowercased) that mark a modern, natural-sounding voice. Ordered
 * loosely best→good; scoring adds a fixed bonus for any hit so ranking stays a
 * pure function of the (voice list, lang) pair — no hidden platform state.
 */
const NATURAL_MARKERS = ["natural", "neural", "premium", "enhanced"];

/**
 * Named voices widely regarded as high quality across macOS / Windows / Chrome
 * (Google's cloud en-US voice, Apple's Siri-family voices, Microsoft's modern
 * en-US voices). Matching one of these is a strong positive signal.
 */
const NAMED_GOOD_VOICES = [
  "google us english",
  "google uk english",
  "samantha",
  "ava",
  "aaron",
  "allison",
  "serena",
  "zoe",
  "evan",
  "nora",
  "aria",
  "jenny",
  "guy",
  "michelle",
];

/** Vendors that generally beat the built-in default (weaker signal than above). */
const GOOD_VENDOR_MARKERS = ["google", "microsoft", "siri", "apple"];

/**
 * Markers of the low-quality, robotic fallbacks we want to AVOID whenever a
 * better voice exists (compact/eSpeak variants, novelty macOS voices).
 */
const LOW_QUALITY_MARKERS = [
  "compact",
  "espeak",
  "e-speak",
  "fred",
  "albert",
  "zarvox",
  "junior",
  "ralph",
  "bad news",
  "bahh",
  "bells",
  "boing",
  "bubbles",
  "cellos",
  "trinoids",
  "whisper",
];

/**
 * Score a single voice for `lang` (higher is better). Deterministic and pure:
 * language match dominates, then explicit quality signals, with a penalty for
 * the known robotic fallbacks. Exposed for testing / reuse.
 */
export function scoreVoice(voice: VoiceLike, lang = "en-US"): number {
  const name = (voice.name ?? "").toLowerCase();
  const vlang = (voice.lang ?? "").toLowerCase().replace(/_/g, "-");
  const target = lang.toLowerCase();
  const targetPrefix = target.split("-")[0];

  let score = 0;

  // 1) Language match dominates: exact locale ≫ same language ≫ other language.
  if (vlang === target) score += 120;
  else if (vlang.split("-")[0] === targetPrefix) score += 70;
  else score -= 100;

  // 2) Explicit "natural/neural" markers are the strongest quality signal.
  if (NATURAL_MARKERS.some((m) => name.includes(m))) score += 60;

  // 3) Known-good named voices.
  if (NAMED_GOOD_VOICES.some((m) => name.includes(m))) score += 45;

  // 4) Reputable vendor in the name.
  if (GOOD_VENDOR_MARKERS.some((m) => name.includes(m))) score += 20;

  // 5) Penalize the robotic fallbacks so a better voice always wins.
  if (LOW_QUALITY_MARKERS.some((m) => name.includes(m))) score -= 80;

  // 6) Gentle nudges: cloud voices (non-local) tend to sound better; the OS
  //    `default` voice is a mild tiebreak when nothing else separates them.
  if (voice.localService === false) score += 8;
  if (voice.default) score += 3;

  return score;
}

/**
 * Deterministically pick the highest-quality voice for `lang` from a candidate
 * list, or `null` when the list is empty. Pure and stable: ties keep the earlier
 * voice (the platform's own ordering), so the same list always yields the same
 * pick — which is what makes it unit-testable without a real browser.
 */
export function pickBestVoice(
  voices: readonly VoiceLike[] | null | undefined,
  lang = "en-US",
): VoiceLike | null {
  if (!voices || voices.length === 0) return null;
  let best: VoiceLike | null = null;
  let bestScore = -Infinity;
  for (const v of voices) {
    const s = scoreVoice(v, lang);
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return best;
}

/**
 * Split a prompt into sentence-ish chunks so synthesis has natural pauses at
 * clause/sentence boundaries instead of one flat, rushed utterance. Pure and
 * total: splits on sentence terminators (. ! ?), newlines, and semicolons while
 * keeping the punctuation, trims blanks, and returns `[]` for empty input. Very
 * short trailing fragments are merged back so we never emit a lone "?" chunk.
 */
export function chunkForSpeech(text: string): string[] {
  if (!text) return [];
  const trimmed = text.trim();
  if (trimmed === "") return [];

  // Break after sentence punctuation (keeping it) or at newlines, THEN collapse
  // internal whitespace per chunk (so we split on newlines before flattening).
  const rawChunks = trimmed
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter((c) => c.length > 0);

  if (rawChunks.length <= 1) {
    return rawChunks.length === 1
      ? rawChunks
      : [trimmed.replace(/\s+/g, " ")];
  }

  // Merge tiny fragments (e.g. a stray "42." or "?") into the previous chunk so
  // each spoken unit is substantial enough to carry natural prosody.
  const MIN_CHUNK_LEN = 12;
  const merged: string[] = [];
  for (const chunk of rawChunks) {
    if (
      merged.length > 0 &&
      (chunk.length < MIN_CHUNK_LEN || !/[A-Za-z0-9]/.test(chunk))
    ) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${chunk}`;
    } else {
      merged.push(chunk);
    }
  }
  return merged;
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
  /** True iff at least recognition OR synthesis is available. */
  readonly supported: boolean;
  readonly support: SpeechSupport;
  /** Speak text aloud (no-op if synthesis unsupported). */
  speak(text: string): void;
  /** Start listening. Returns `true` if listening actually began. */
  listen(handlers: ListenHandlers): boolean;
  /** Stop the current recognition session (safe to call anytime). */
  stop(): void;
  /** Cancel any in-flight speech. */
  cancelSpeech(): void;
}

export interface SpeechControllerOptions {
  /** BCP-47 language tag for recognition + synthesis (default "en-US"). */
  lang?: string;
  /**
   * Speaking rate for synthesis. Defaults to a slightly-relaxed 0.97 which reads
   * more naturally than the platform default of 1.0 (which tends to feel rushed).
   */
  rate?: number;
  /** Synthesis pitch (default 1.0 — neutral, natural). */
  pitch?: number;
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
  const rate = options?.rate ?? 0.97;
  const pitch = options?.pitch ?? 1;
  const RecognitionCtor = getRecognitionCtor();
  let recognition: SpeechRecognitionLike | null = null;

  // Lazily-resolved best voice. `voicesResolved` guards against re-ranking on
  // every utterance; `getVoices()` is empty on first call in some browsers, so
  // we also subscribe to `voiceschanged` to pick up the real list when it lands.
  let cachedVoice: VoiceLike | null = null;
  let voicesResolved = false;
  let voicesListenerAttached = false;

  const listVoices = (): VoiceLike[] => {
    const synth = getWin()?.speechSynthesis;
    if (!synth || typeof synth.getVoices !== "function") return [];
    try {
      return synth.getVoices() ?? [];
    } catch {
      return [];
    }
  };

  const attachVoicesListener = () => {
    if (voicesListenerAttached) return;
    const synth = getWin()?.speechSynthesis;
    if (!synth) return;
    try {
      synth.onvoiceschanged = () => {
        const voices = listVoices();
        if (voices.length > 0) {
          cachedVoice = pickBestVoice(voices, lang);
          voicesResolved = true;
        }
      };
      voicesListenerAttached = true;
    } catch {
      /* ignore: not all engines expose onvoiceschanged */
    }
  };

  const resolveVoice = (): VoiceLike | null => {
    if (voicesResolved) return cachedVoice;
    const voices = listVoices();
    if (voices.length === 0) {
      // Not ready yet — subscribe and try again on the next speak().
      attachVoicesListener();
      return null;
    }
    cachedVoice = pickBestVoice(voices, lang);
    voicesResolved = true;
    return cachedVoice;
  };

  return {
    supported: support.recognition || support.synthesis,
    support,

    speak(text: string) {
      const w = getWin();
      if (!support.synthesis || !w?.speechSynthesis || !w.SpeechSynthesisUtterance)
        return;
      try {
        w.speechSynthesis.cancel();
        const voice = resolveVoice();
        // Speak sentence-ish chunks as SEQUENTIAL utterances: the synthesizer
        // queues them, giving a natural pause between sentences instead of one
        // flat, rushed read. Falls back to the whole string if it can't split.
        const chunks = chunkForSpeech(text);
        const parts = chunks.length > 0 ? chunks : [text];
        for (const part of parts) {
          const utter = new w.SpeechSynthesisUtterance(part) as Record<
            string,
            unknown
          >;
          utter.lang = lang;
          utter.rate = rate;
          utter.pitch = pitch;
          if (voice) utter.voice = voice;
          w.speechSynthesis.speak(utter);
        }
      } catch {
        /* best-effort: never throw into the UI */
      }
    },

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

    cancelSpeech() {
      const w = getWin();
      try {
        w?.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    },
  };
}
