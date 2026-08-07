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
 *
 * NEURAL VOICE (Phase — human-sounding interviewer): `speak()` now PREFERS a
 * neural text-to-speech voice served by the app's existing AI Lambda layer
 * (OpenAI `gpt-4o-mini-tts`, returned as base64 mp3 the client decodes + plays
 * via an `HTMLAudioElement`). It reuses the SAME endpoint/config the AI flavor
 * client already resolves (`readAiConfig` over the `VITE_AI_*` env, see
 * `aiConfig.ts` / `aiFlavor.ts`) — no new config mechanism. If that layer is
 * off / unconfigured / offline / errors, `speak()` transparently FALLS BACK to
 * the tuned Web Speech synthesis below, so a TTS failure can never break the
 * interview. The PUBLIC interface is unchanged: callers still just call
 * `speak(text)` / `cancelSpeech()`.
 */
import { readAiConfig } from "@/lib/aiConfig";
import { env } from "@/lib/aiFlavor";
import { readAwsConfig, type EnvLike } from "@/lib/awsConfig";

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
/*  NEURAL TTS (human-sounding voice) — config, auth, decode + playback        */
/* -------------------------------------------------------------------------- */

/**
 * The interviewer voice. OpenAI's `gpt-4o-mini-tts` voices range from bright
 * ("nova"/"shimmer") to neutral ("alloy") to warm-professional ("onyx"). We
 * pick **"onyx"** — a calm, grounded, professional male timbre that reads like a
 * real quant-trading interviewer rather than an assistant. Overridable per call
 * site / env, but this is the default the whole app uses.
 */
export const DEFAULT_TTS_VOICE = "onyx";
/** OpenAI TTS model the server uses (kept here for docs/tests parity). */
export const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
/** Path appended to the AI base endpoint for the TTS route (POST). */
export const TTS_PATH = "/tts";

/**
 * Client-side config for the neural voice. `endpoint` is the SAME base URL the
 * AI flavor client resolves (`readAiConfig().endpoint`); we POST to
 * `${endpoint}${TTS_PATH}`. `getAuthToken` supplies the Cognito JWT (the TTS
 * route sits behind the same authorizer as the other AI endpoints).
 */
export interface TtsClientConfig {
  endpoint: string;
  voice: string;
  getAuthToken?: () => string | null;
}

/**
 * Best-effort read of the current Cognito ID token from the well-known public
 * localStorage locations (mirrors `aiFlavor.ts`'s reader — we only READ public
 * token keys, never import another workstream's storage internals). Returns
 * `null` when unauthenticated, in which case the request still goes out (and, if
 * the route rejects it, we fall back to Web Speech).
 */
function readIdToken(e: EnvLike): string | null {
  if (typeof localStorage === "undefined") return null;
  const get = (k: string): string | null => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const oauthTok = get("qtp.aws.oauth.idToken");
  const oauthExp = Number(get("qtp.aws.oauth.exp") ?? "0");
  if (oauthTok && oauthExp > Date.now()) return oauthTok;
  const clientId = readAwsConfig(e)?.userPoolClientId;
  if (!clientId) return null;
  const last = get(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`);
  if (!last) return null;
  return get(`CognitoIdentityServiceProvider.${clientId}.${last}.idToken`);
}

/**
 * Resolve the neural-voice config from the SAME env the AI layer uses. Returns
 * `null` (→ Web Speech fallback) when the AI layer is OFF, in local-dev STUB
 * mode (no real endpoint), or when no endpoint is configured. Pure aside from
 * reading `import.meta.env` via `env()`; never throws.
 */
export function resolveTtsConfig(voice: string = DEFAULT_TTS_VOICE): TtsClientConfig | null {
  let e: EnvLike;
  try {
    e = env();
  } catch {
    return null;
  }
  const cfg = readAiConfig(e);
  if (!cfg || cfg.stub || !cfg.endpoint) return null;
  return {
    endpoint: cfg.endpoint,
    voice,
    getAuthToken: () => readIdToken(e),
  };
}

/** A handle to an in-flight neural playback; `stop()` halts + discards it. */
export interface NeuralPlayback {
  stop(): void;
}

/**
 * Plays base64 mp3 and reports completion/failure. Abstracted so it can be
 * stubbed in tests (jsdom/node has no real `<audio>` pipeline). The default
 * implementation decodes → Blob → object URL → `HTMLAudioElement`.
 */
export type NeuralPlayer = (
  audioBase64: string,
  handlers: { onEnded: () => void; onError: () => void },
) => NeuralPlayback;

/** Decode base64 → `Blob` (default `audio/mpeg`). Browser-only (`atob`/`Blob`). */
export function base64ToBlob(b64: string, type = "audio/mpeg"): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/**
 * Default neural player: base64 mp3 → object URL → `HTMLAudioElement`. Only ever
 * constructed at PLAY time (never at import), so this module still loads cleanly
 * in the node/SSR test environment where `Audio` doesn't exist.
 */
const defaultNeuralPlayer: NeuralPlayer = (audioBase64, handlers) => {
  const url = URL.createObjectURL(base64ToBlob(audioBase64));
  const audio = new Audio();
  audio.src = url;
  let done = false;
  const revoke = () => {
    if (done) return;
    done = true;
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  };
  audio.onended = () => {
    revoke();
    handlers.onEnded();
  };
  audio.onerror = () => {
    revoke();
    handlers.onError();
  };
  // `play()` can reject under autoplay policies — treat that as an error so the
  // caller can fall back to Web Speech.
  void Promise.resolve(audio.play?.()).catch(() => {
    revoke();
    handlers.onError();
  });
  return {
    stop() {
      try {
        audio.pause();
      } catch {
        /* ignore */
      }
      try {
        audio.src = "";
      } catch {
        /* ignore */
      }
      revoke();
    },
  };
};

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
  /**
   * Speak text aloud. PREFERS the neural voice (when the AI layer is configured)
   * and transparently falls back to Web Speech synthesis on any failure. No-op
   * when neither path is available. Fire-and-forget: returns immediately while
   * the (possibly async) neural request runs.
   */
  speak(text: string): void;
  /**
   * Warm the neural-audio cache for `text` WITHOUT playing it (low-latency
   * prefetch for the next prompt). Safe no-op when neural TTS is unavailable.
   */
  prefetch(text: string): void;
  /** Start listening. Returns `true` if listening actually began. */
  listen(handlers: ListenHandlers): boolean;
  /** Stop the current recognition session (safe to call anytime). */
  stop(): void;
  /** Cancel any in-flight speech — neural (stop audio + abort fetch) AND Web Speech. */
  cancelSpeech(): void;
}

export interface SpeechControllerOptions {
  /** BCP-47 language tag for recognition + synthesis (default "en-US"). */
  lang?: string;
  /**
   * Speaking rate for Web-Speech synthesis (the FALLBACK path). Defaults to a
   * slightly-relaxed 0.97 which reads more naturally than the platform default
   * of 1.0 (which tends to feel rushed). The neural path uses server-side prosody.
   */
  rate?: number;
  /** Synthesis pitch (default 1.0 — neutral, natural). */
  pitch?: number;
  /**
   * Neural-voice config. `undefined` (default) → auto-resolve from the AI env
   * via `resolveTtsConfig()`. `null` → force Web-Speech-only. An explicit config
   * is used as-is (dependency injection for tests).
   */
  tts?: TtsClientConfig | null;
  /** Injected `fetch` (defaults to the global). Exposed for tests. */
  fetchImpl?: typeof fetch;
  /** Injected neural audio player (defaults to the `HTMLAudioElement` one). */
  neuralPlayer?: NeuralPlayer;
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

  /* ------------------------- neural TTS state + helpers ------------------- */
  // `undefined` → auto-resolve from env; `null` → force Web-Speech-only.
  const ttsConfig =
    options?.tts === undefined ? resolveTtsConfig() : options.tts;
  const doFetch: typeof fetch | null =
    options?.fetchImpl ??
    (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  const playNeural: NeuralPlayer = options?.neuralPlayer ?? defaultNeuralPlayer;
  const neuralEnabled = !!ttsConfig && !!doFetch;
  // Cache synthesized audio per (voice, text) so repeated prompts never
  // re-synthesize (and `prefetch` can warm the next prompt for zero latency).
  const audioCache = new Map<string, string>();
  const cacheKey = (voice: string, text: string) => `${voice}\u0000${text}`;
  // Monotonic "which utterance is current" token. Every `speak`/`cancelSpeech`
  // bumps it, so any async neural continuation older than the latest is dropped
  // (prevents a slow fetch from playing after the user moved on / cancelled).
  let speakEpoch = 0;
  let currentAbort: AbortController | null = null;
  let currentPlayback: NeuralPlayback | null = null;

  const stopNeural = () => {
    if (currentAbort) {
      try {
        currentAbort.abort();
      } catch {
        /* ignore */
      }
      currentAbort = null;
    }
    if (currentPlayback) {
      try {
        currentPlayback.stop();
      } catch {
        /* ignore */
      }
      currentPlayback = null;
    }
  };

  const stopWebSpeech = () => {
    const w = getWin();
    try {
      w?.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  };

  // The FALLBACK: tuned Web Speech synthesis (best local voice + relaxed prosody
  // + sentence chunking for natural pauses). Never throws into the UI.
  const webSpeechSpeak = (text: string) => {
    const w = getWin();
    if (!support.synthesis || !w?.speechSynthesis || !w.SpeechSynthesisUtterance)
      return;
    try {
      w.speechSynthesis.cancel();
      const voice = resolveVoice();
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
  };

  const startNeuralPlayback = (b64: string, epoch: number, text: string) => {
    if (epoch !== speakEpoch) return;
    try {
      currentPlayback = playNeural(b64, {
        onEnded: () => {
          if (epoch === speakEpoch) currentPlayback = null;
        },
        onError: () => {
          if (epoch !== speakEpoch) return;
          currentPlayback = null;
          // Audio pipeline failed AFTER a good response → fall back so the
          // prompt is still heard.
          webSpeechSpeak(text);
        },
      });
    } catch {
      if (epoch === speakEpoch) webSpeechSpeak(text);
    }
  };

  // Fetch synthesized audio (or use cache), then play it. On ANY failure that
  // is NOT a user cancellation, transparently fall back to Web Speech.
  const neuralSpeak = async (
    text: string,
    epoch: number,
    cfg: TtsClientConfig,
  ) => {
    const key = cacheKey(cfg.voice, text);
    const cached = audioCache.get(key);
    if (cached) {
      startNeuralPlayback(cached, epoch, text);
      return;
    }

    const abort = new AbortController();
    currentAbort = abort;
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    const token = cfg.getAuthToken?.();
    if (token) headers["authorization"] = token;

    let res: Response;
    try {
      res = await (doFetch as typeof fetch)(`${cfg.endpoint}${TTS_PATH}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text, voice: cfg.voice }),
        signal: abort.signal,
      });
    } catch {
      // A user cancel aborts the fetch — do NOT fall back in that case.
      if (abort.signal.aborted || epoch !== speakEpoch) return;
      webSpeechSpeak(text);
      return;
    }
    if (currentAbort === abort) currentAbort = null;
    if (epoch !== speakEpoch) return; // cancelled while awaiting
    if (!res.ok) {
      webSpeechSpeak(text);
      return;
    }

    let b64: string | null = null;
    try {
      const json = (await res.json()) as { audioBase64?: unknown };
      b64 =
        typeof json.audioBase64 === "string" && json.audioBase64
          ? json.audioBase64
          : null;
    } catch {
      b64 = null;
    }
    if (epoch !== speakEpoch) return;
    if (!b64) {
      webSpeechSpeak(text);
      return;
    }
    audioCache.set(key, b64);
    startNeuralPlayback(b64, epoch, text);
  };

  return {
    supported: support.recognition || support.synthesis,
    support,

    speak(text: string) {
      const trimmed = (text ?? "").trim();
      // Bump the epoch and hard-stop anything currently playing/pending so a new
      // prompt never overlaps the previous one (neural OR Web Speech).
      const epoch = ++speakEpoch;
      stopNeural();
      stopWebSpeech();
      if (!trimmed) return;
      if (neuralEnabled && ttsConfig) {
        void neuralSpeak(trimmed, epoch, ttsConfig);
      } else {
        webSpeechSpeak(trimmed);
      }
    },

    prefetch(text: string) {
      const trimmed = (text ?? "").trim();
      if (!trimmed || !neuralEnabled || !ttsConfig) return;
      const cfg = ttsConfig;
      const key = cacheKey(cfg.voice, trimmed);
      if (audioCache.has(key)) return;
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      const token = cfg.getAuthToken?.();
      if (token) headers["authorization"] = token;
      // Best-effort cache warm; failures are silent (the real `speak` will just
      // re-request and, if needed, fall back).
      void (async () => {
        try {
          const res = await (doFetch as typeof fetch)(
            `${cfg.endpoint}${TTS_PATH}`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({ text: trimmed, voice: cfg.voice }),
            },
          );
          if (!res.ok) return;
          const json = (await res.json()) as { audioBase64?: unknown };
          if (typeof json.audioBase64 === "string" && json.audioBase64) {
            audioCache.set(key, json.audioBase64);
          }
        } catch {
          /* ignore — prefetch is purely an optimization */
        }
      })();
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
      // Invalidate any in-flight neural continuation, stop audio + abort fetch,
      // and clear the Web Speech queue.
      speakEpoch++;
      stopNeural();
      stopWebSpeech();
    },
  };
}
