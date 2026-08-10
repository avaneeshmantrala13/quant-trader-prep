import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSpeechController,
  detectSpeechSupport,
  isSpeechRecognitionSupported,
} from "./speech";

/**
 * The speech-recognition wrapper must DEGRADE GRACEFULLY. In the Vitest `node`
 * environment there is no `window`, so detection is false and every controller
 * method is a safe no-op — exactly the "no mic / SSR" path. We also stub a fake
 * `window` to exercise the supported path and confirm transcripts flow to the
 * callback (and are never captured/stored by the wrapper).
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
    expect(detectSpeechSupport()).toEqual({ recognition: false });

    const ctl = createSpeechController();
    expect(ctl.supported).toBe(false);
    // No method throws; listen reports it did not start.
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
    (globalThis as { window?: unknown }).window = {
      SpeechRecognition: FakeRecognition,
    };

    expect(isSpeechRecognitionSupported()).toBe(true);

    const ctl = createSpeechController({ lang: "en-GB" });
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
  });

  it("reports it cannot listen when recognition is absent", () => {
    (globalThis as { window?: unknown }).window = {};
    expect(isSpeechRecognitionSupported()).toBe(false);
    const ctl = createSpeechController();
    expect(ctl.supported).toBe(false);
    expect(ctl.listen({ onResult: () => {} })).toBe(false);
  });
});
