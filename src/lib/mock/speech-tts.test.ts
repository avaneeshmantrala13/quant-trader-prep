import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSpeechController,
  type NeuralPlayer,
  type TtsClientConfig,
} from "./speech";

/**
 * Neural-voice (TTS) behaviour for the mock interview. These exercise the path
 * that PREFERS server-synthesized audio and transparently FALLS BACK to Web
 * Speech, with `fetch` + audio playback injected (jsdom/node has no real audio
 * pipeline, so we stub the player minimally per the task note). The controller's
 * PUBLIC interface is unchanged — MockPage keeps calling `speak`/`cancelSpeech`.
 */

const originalWindow = (globalThis as { window?: unknown }).window;

/** Install a fake Web Speech surface so the FALLBACK path is observable. */
function installFakeSynth() {
  const speak = vi.fn();
  const cancel = vi.fn();
  (globalThis as { window?: unknown }).window = {
    speechSynthesis: { speak, cancel, getVoices: () => [] },
    SpeechSynthesisUtterance: class {
      constructor(public text: string) {}
    },
  };
  return { speak, cancel };
}

afterEach(() => {
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
  vi.restoreAllMocks();
});

/** Let queued microtasks (the awaited fetch/json chain) settle. */
const tick = () => new Promise((r) => setTimeout(r, 0));

const CFG: TtsClientConfig = {
  endpoint: "https://ai.example.com",
  voice: "onyx",
};

interface PlayerCall {
  b64: string;
  handlers: { onEnded: () => void; onError: () => void };
  stop: ReturnType<typeof vi.fn>;
}
function makePlayer() {
  const calls: PlayerCall[] = [];
  const player: NeuralPlayer = (b64, handlers) => {
    const stop = vi.fn();
    calls.push({ b64, handlers, stop });
    return { stop };
  };
  return { player, calls };
}

/** A fetch stub returning a JSON body with base64 audio. */
function okFetch(audioBase64 = "QUJD") {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, audioBase64 }),
  })) as unknown as typeof fetch;
}

describe("neural TTS — prefers synthesized audio when configured", () => {
  it("POSTs the right request shape and plays the returned audio", async () => {
    const { player, calls } = makePlayer();
    const fetchImpl = okFetch("QUJD");
    const ctl = createSpeechController({
      tts: CFG,
      fetchImpl,
      neuralPlayer: player,
    });

    ctl.speak("Hello world");
    await tick();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchImpl as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ai.example.com/tts");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      text: "Hello world",
      voice: "onyx",
    });
    // The returned base64 audio is handed to the player (i.e. it plays).
    expect(calls).toHaveLength(1);
    expect(calls[0].b64).toBe("QUJD");
  });

  it("sends the Cognito JWT as the authorization header when available", async () => {
    const fetchImpl = okFetch();
    const ctl = createSpeechController({
      tts: { ...CFG, getAuthToken: () => "jwt-123" },
      fetchImpl,
      neuralPlayer: makePlayer().player,
    });
    ctl.speak("Question one.");
    await tick();
    const [, init] = (fetchImpl as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe("jwt-123");
  });
});

describe("neural TTS — cancellation stops audio and aborts the fetch", () => {
  it("cancelSpeech() stops in-flight playback", async () => {
    const { player, calls } = makePlayer();
    const ctl = createSpeechController({
      tts: CFG,
      fetchImpl: okFetch(),
      neuralPlayer: player,
    });
    ctl.speak("Playing now.");
    await tick();
    expect(calls).toHaveLength(1);

    ctl.cancelSpeech();
    expect(calls[0].stop).toHaveBeenCalledTimes(1);
  });

  it("cancelSpeech() aborts an in-flight fetch and does NOT fall back", async () => {
    const { speak } = installFakeSynth();
    // A fetch that only settles (rejects) when its signal aborts.
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
          );
        }),
    ) as unknown as typeof fetch;

    const ctl = createSpeechController({
      tts: CFG,
      fetchImpl,
      neuralPlayer: makePlayer().player,
    });
    ctl.speak("Slow prompt.");
    await tick();

    const [, init] = (fetchImpl as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0] as [string, RequestInit];
    ctl.cancelSpeech();
    await tick();

    expect((init.signal as AbortSignal).aborted).toBe(true);
    // A user cancel must NOT trigger the Web Speech fallback.
    expect(speak).not.toHaveBeenCalled();
  });
});

describe("neural TTS — graceful fallback to Web Speech", () => {
  it("falls back when there is no TTS config (misconfigured)", async () => {
    const { speak } = installFakeSynth();
    const fetchImpl = okFetch();
    const ctl = createSpeechController({
      tts: null,
      fetchImpl,
      neuralPlayer: makePlayer().player,
    });
    ctl.speak("Hi there.");
    await tick();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(speak).toHaveBeenCalled();
    expect((speak.mock.calls[0][0] as { text: string }).text).toBe("Hi there.");
  });

  it("falls back when the fetch throws (offline / network error)", async () => {
    const { speak } = installFakeSynth();
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const ctl = createSpeechController({
      tts: CFG,
      fetchImpl,
      neuralPlayer: makePlayer().player,
    });
    ctl.speak("Compute twelve.");
    await tick();
    expect(speak).toHaveBeenCalled();
    expect((speak.mock.calls[0][0] as { text: string }).text).toBe(
      "Compute twelve.",
    );
  });

  it("falls back on a non-OK response", async () => {
    const { speak } = installFakeSynth();
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const ctl = createSpeechController({
      tts: CFG,
      fetchImpl,
      neuralPlayer: makePlayer().player,
    });
    ctl.speak("Try again.");
    await tick();
    expect(speak).toHaveBeenCalled();
  });

  it("falls back when the response has no audioBase64", async () => {
    const { speak } = installFakeSynth();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    })) as unknown as typeof fetch;
    const ctl = createSpeechController({
      tts: CFG,
      fetchImpl,
      neuralPlayer: makePlayer().player,
    });
    ctl.speak("No audio here.");
    await tick();
    expect(speak).toHaveBeenCalled();
  });
});

describe("neural TTS — caching + prefetch avoid duplicate synthesis", () => {
  it("caches per (voice, text): repeated speak() synthesizes once", async () => {
    const fetchImpl = okFetch();
    const ctl = createSpeechController({
      tts: CFG,
      fetchImpl,
      neuralPlayer: makePlayer().player,
    });
    ctl.speak("Same prompt.");
    await tick();
    ctl.speak("Same prompt.");
    await tick();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("prefetch() warms the cache so the later speak() reuses it", async () => {
    const fetchImpl = okFetch();
    const ctl = createSpeechController({
      tts: CFG,
      fetchImpl,
      neuralPlayer: makePlayer().player,
    });
    ctl.prefetch("Next prompt.");
    await tick();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    ctl.speak("Next prompt.");
    await tick();
    // Served from cache — no second synthesis.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("neural TTS — voice-off suppresses playback", () => {
  it("does not synthesize or play when the MockPage voice guard is off", async () => {
    // Mirror MockPage's guard: it only calls speak() when voiceOn is true.
    const maybeSpeak = (
      ctl: ReturnType<typeof createSpeechController>,
      voiceOn: boolean,
      text: string,
    ) => {
      if (!voiceOn) return;
      ctl.speak(text);
    };

    const fetchImpl = okFetch();
    const { player, calls } = makePlayer();
    const ctl = createSpeechController({
      tts: CFG,
      fetchImpl,
      neuralPlayer: player,
    });

    maybeSpeak(ctl, false, "Should be silent.");
    await tick();

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });
});
