import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chunkForSpeech,
  createSpeechController,
  detectSpeechSupport,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  pickBestVoice,
  scoreVoice,
  type VoiceLike,
} from "./speech";

/**
 * The speech wrapper must DEGRADE GRACEFULLY. In the Vitest `node` environment
 * there is no `window`, so detection is false and every controller method is a
 * safe no-op — exactly the "no mic / SSR" path. We also stub a fake `window` to
 * exercise the supported path and confirm transcripts flow to the callback (and
 * are never captured/stored by the wrapper).
 */

const originalWindow = (globalThis as { window?: unknown }).window;

afterEach(() => {
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
  vi.restoreAllMocks();
});

describe("graceful degradation when Web Speech is unavailable (node/SSR)", () => {
  it("reports unsupported and no-ops without throwing", () => {
    expect(isSpeechRecognitionSupported()).toBe(false);
    expect(isSpeechSynthesisSupported()).toBe(false);
    expect(detectSpeechSupport()).toEqual({
      recognition: false,
      synthesis: false,
    });

    const ctl = createSpeechController();
    expect(ctl.supported).toBe(false);
    // None of these throw; listen reports it did not start.
    expect(() => ctl.speak("hello")).not.toThrow();
    expect(() => ctl.cancelSpeech()).not.toThrow();
    expect(() => ctl.stop()).not.toThrow();
    const started = ctl.listen({ onResult: () => {} });
    expect(started).toBe(false);
  });
});

describe("supported path (stubbed window)", () => {
  it("detects support and streams transcripts to the callback", () => {
    // A minimal fake SpeechRecognition that emits one final result on start.
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        this.onresult?.({
          resultIndex: 0,
          results: {
            length: 1,
            0: { 0: { transcript: "forty two", confidence: 0.9 }, isFinal: true, length: 1 },
          },
        });
        this.onend?.();
      }
      stop() {}
      abort() {}
    }
    const speakSpy = vi.fn();
    (globalThis as { window?: unknown }).window = {
      SpeechRecognition: FakeRecognition,
      speechSynthesis: { speak: speakSpy, cancel: vi.fn() },
      SpeechSynthesisUtterance: class {
        text: string;
        constructor(t: string) {
          this.text = t;
        }
      },
    };

    expect(isSpeechRecognitionSupported()).toBe(true);
    expect(isSpeechSynthesisSupported()).toBe(true);

    const ctl = createSpeechController({ lang: "en-GB", rate: 1.1 });
    expect(ctl.supported).toBe(true);

    const results: { text: string; final: boolean }[] = [];
    let ended = false;
    const started = ctl.listen({
      onResult: (text, final) => results.push({ text, final }),
      onEnd: () => {
        ended = true;
      },
    });
    expect(started).toBe(true);
    expect(results).toEqual([{ text: "forty two", final: true }]);
    expect(ended).toBe(true);

    ctl.speak("Welcome to the interview");
    expect(speakSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back cleanly when only synthesis exists (no recognition)", () => {
    (globalThis as { window?: unknown }).window = {
      speechSynthesis: { speak: vi.fn(), cancel: vi.fn() },
      SpeechSynthesisUtterance: class {
        constructor(public text: string) {}
      },
    };
    expect(isSpeechRecognitionSupported()).toBe(false);
    expect(isSpeechSynthesisSupported()).toBe(true);
    const ctl = createSpeechController();
    expect(ctl.supported).toBe(true);
    expect(ctl.listen({ onResult: () => {} })).toBe(false); // can't listen
    expect(() => ctl.speak("hi")).not.toThrow(); // but can speak
  });
});

/* -------------------------------------------------------------------------- */
/*  PURE helpers: chunkForSpeech                                               */
/* -------------------------------------------------------------------------- */

describe("chunkForSpeech — sentence-ish chunking for natural pauses", () => {
  it("returns [] for empty / whitespace-only input", () => {
    expect(chunkForSpeech("")).toEqual([]);
    expect(chunkForSpeech("   \n  ")).toEqual([]);
  });

  it("keeps a single sentence as one chunk (punctuation preserved)", () => {
    expect(chunkForSpeech("What is 12 times 12?")).toEqual([
      "What is 12 times 12?",
    ]);
  });

  it("splits on sentence terminators, keeping the punctuation", () => {
    const chunks = chunkForSpeech(
      "Take your time. Think out loud! Ready to begin?",
    );
    expect(chunks).toEqual([
      "Take your time.",
      "Think out loud!",
      "Ready to begin?",
    ]);
  });

  it("collapses whitespace and splits on semicolons and newlines", () => {
    const chunks = chunkForSpeech("First clause; second clause\nthird line here");
    expect(chunks).toEqual([
      "First clause;",
      "second clause",
      "third line here",
    ]);
  });

  it("merges tiny trailing fragments into the previous chunk", () => {
    // The bare "42." is too short to stand alone as its own utterance.
    const chunks = chunkForSpeech("Compute the following product carefully. 42.");
    expect(chunks).toEqual(["Compute the following product carefully. 42."]);
  });
});

/* -------------------------------------------------------------------------- */
/*  PURE helpers: voice ranking                                               */
/* -------------------------------------------------------------------------- */

describe("pickBestVoice — deterministic high-quality voice selection", () => {
  const v = (
    name: string,
    lang: string,
    extra: Partial<VoiceLike> = {},
  ): VoiceLike => ({ name, lang, ...extra });

  it("returns null for an empty or missing list", () => {
    expect(pickBestVoice([], "en-US")).toBeNull();
    expect(pickBestVoice(null, "en-US")).toBeNull();
    expect(pickBestVoice(undefined)).toBeNull();
  });

  it("prefers a natural/neural en-US voice over the robotic default", () => {
    const voices = [
      v("Fred", "en-US", { default: true }),
      v("Albert", "en-US"),
      v("Samantha (Enhanced)", "en-US"),
      v("Microsoft Aria Online (Natural) - English (United States)", "en-US"),
    ];
    const best = pickBestVoice(voices, "en-US");
    expect(best?.name).toContain("Natural");
  });

  it("prefers Google US English / named-good voices over generic ones", () => {
    const voices = [
      v("Daniel", "en-GB"),
      v("Google US English", "en-US", { localService: false }),
      v("Fred", "en-US"),
    ];
    expect(pickBestVoice(voices, "en-US")?.name).toBe("Google US English");
  });

  it("respects the requested language (matching locale wins)", () => {
    const voices = [
      v("Google US English", "en-US"),
      v("Google UK English Female", "en-GB"),
    ];
    expect(pickBestVoice(voices, "en-GB")?.lang).toBe("en-GB");
    expect(pickBestVoice(voices, "en-US")?.lang).toBe("en-US");
  });

  it("penalizes wrong-language voices even when they look premium", () => {
    const voices = [
      v("Amélie (Enhanced)", "fr-FR"),
      v("Samantha", "en-US"),
    ];
    expect(pickBestVoice(voices, "en-US")?.name).toBe("Samantha");
  });

  it("is stable: equal scores keep the earlier (platform-ordered) voice", () => {
    const voices = [v("Alpha", "en-US"), v("Beta", "en-US")];
    // Same score → first one wins; ranking is a pure function of input order.
    expect(pickBestVoice(voices, "en-US")?.name).toBe("Alpha");
    expect(scoreVoice(voices[0], "en-US")).toBe(scoreVoice(voices[1], "en-US"));
  });
});

/* -------------------------------------------------------------------------- */
/*  Controller: chunked + voiced synthesis                                     */
/* -------------------------------------------------------------------------- */

describe("synthesis speaks chunked, voiced utterances", () => {
  it("queues one utterance per sentence chunk and applies the best voice", () => {
    const spoken: { text: string; voice?: VoiceLike; rate?: number; pitch?: number }[] = [];
    const voices: VoiceLike[] = [
      { name: "Fred", lang: "en-US", default: true },
      { name: "Samantha (Enhanced)", lang: "en-US", localService: false },
    ];
    class Utter {
      text: string;
      voice?: VoiceLike;
      rate?: number;
      pitch?: number;
      lang?: string;
      constructor(t: string) {
        this.text = t;
      }
    }
    (globalThis as { window?: unknown }).window = {
      speechSynthesis: {
        speak: (u: Utter) =>
          spoken.push({ text: u.text, voice: u.voice, rate: u.rate, pitch: u.pitch }),
        cancel: vi.fn(),
        getVoices: () => voices,
      },
      SpeechSynthesisUtterance: Utter,
    };

    const ctl = createSpeechController();
    ctl.speak("Compute twelve times twelve. Then tell me the remainder.");

    // Two sentences → two queued utterances.
    expect(spoken).toHaveLength(2);
    expect(spoken[0].text).toBe("Compute twelve times twelve.");
    expect(spoken[1].text).toBe("Then tell me the remainder.");
    // Best voice (Enhanced, non-robotic) selected and applied to each chunk.
    expect(spoken[0].voice?.name).toBe("Samantha (Enhanced)");
    expect(spoken[1].voice?.name).toBe("Samantha (Enhanced)");
    // Natural tuning: relaxed rate + neutral pitch.
    expect(spoken[0].rate).toBeCloseTo(0.97);
    expect(spoken[0].pitch).toBe(1);
  });

  it("handles an initially-empty getVoices() by subscribing to voiceschanged", () => {
    let voices: VoiceLike[] = [];
    const synth: {
      speak: ReturnType<typeof vi.fn>;
      cancel: ReturnType<typeof vi.fn>;
      getVoices: () => VoiceLike[];
      onvoiceschanged: (() => void) | null;
    } = {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: () => voices,
      onvoiceschanged: null,
    };
    (globalThis as { window?: unknown }).window = {
      speechSynthesis: synth,
      SpeechSynthesisUtterance: class {
        constructor(public text: string) {}
      },
    };

    const ctl = createSpeechController();
    // First speak: voices empty → controller subscribes to voiceschanged.
    ctl.speak("Hello there.");
    expect(typeof synth.onvoiceschanged).toBe("function");

    // Voices arrive; fire the event so the controller re-ranks.
    voices = [{ name: "Google US English", lang: "en-US", localService: false }];
    synth.onvoiceschanged?.();
    expect(() => ctl.speak("Second prompt.")).not.toThrow();
  });
});
