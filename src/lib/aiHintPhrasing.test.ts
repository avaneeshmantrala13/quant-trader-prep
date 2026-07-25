import { afterEach, describe, expect, it, vi } from "vitest";
import { requestHintPhrasing } from "./aiHintPhrasing";

/**
 * The hint-phrasing wrapper only ever swaps WORDING; the deterministic rung
 * always wins. With the flag off it's a no-op returning the original text; when
 * on, a rephrase that leaks the answer or changes a number is re-guarded and
 * discarded (fall back to the original rung).
 */

const RUNG = {
  text: "Re-express it as natural frequencies out of 1000 people, then compare the two counts.",
  answer: 8,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Mock the AI endpoint to return a given hint payload once. */
function mockAiHint(hint: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, hint }),
    })) as unknown as typeof fetch,
  );
}

describe("requestHintPhrasing", () => {
  it("flag OFF ⇒ returns the ORIGINAL rung text unchanged (no network)", async () => {
    // Force the flag off (the test env's .env.local may switch the AI layer on).
    vi.stubEnv("VITE_AI_LAYER", "off");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy as unknown as typeof fetch);
    const out = await requestHintPhrasing(RUNG);
    expect(out).toBe(RUNG.text);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stub sub-mode ⇒ returns the original rung text (no network)", async () => {
    vi.stubEnv("VITE_AI_LAYER", "on");
    vi.stubEnv("VITE_AI_STUB", "on");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy as unknown as typeof fetch);
    const out = await requestHintPhrasing(RUNG);
    expect(out).toBe(RUNG.text);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("accepts a clean rephrase (keeps the number, hides the answer)", async () => {
    vi.stubEnv("VITE_AI_LAYER", "on");
    vi.stubEnv("VITE_AI_ENDPOINT", "https://ai.example.com");
    const clean =
      "Picture it as 1000 people — line up the two groups and compare which is larger.";
    mockAiHint(clean);
    expect(await requestHintPhrasing(RUNG)).toBe(clean);
  });

  it("falls back to the original when the rephrase LEAKS the answer", async () => {
    vi.stubEnv("VITE_AI_LAYER", "on");
    vi.stubEnv("VITE_AI_ENDPOINT", "https://ai.example.com");
    // Introduces "8" (the answer) — both a new number AND an answer leak.
    mockAiHint("Out of 1000 people, 8 test positive — so divide by those.");
    expect(await requestHintPhrasing(RUNG)).toBe(RUNG.text);
  });

  it("falls back when the rephrase DROPS the required number", async () => {
    vi.stubEnv("VITE_AI_LAYER", "on");
    vi.stubEnv("VITE_AI_ENDPOINT", "https://ai.example.com");
    mockAiHint("Re-express it as natural frequencies, then compare the counts.");
    expect(await requestHintPhrasing(RUNG)).toBe(RUNG.text);
  });

  it("falls back when the response has no usable hint", async () => {
    vi.stubEnv("VITE_AI_LAYER", "on");
    vi.stubEnv("VITE_AI_ENDPOINT", "https://ai.example.com");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: false, error: "guardrail:leaks-answer" }),
      })) as unknown as typeof fetch,
    );
    expect(await requestHintPhrasing(RUNG)).toBe(RUNG.text);
  });
});
