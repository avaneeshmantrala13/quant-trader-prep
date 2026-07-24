import { describe, expect, it } from "vitest";
import { aiLayerEnabled, aiStubEnabled, readAiConfig } from "./aiConfig";
import { extractNumbers, verifyFlavor } from "./aiFlavor";

/**
 * The AI layer is OPT-IN and OFF BY DEFAULT, and the flavor guardrail must never
 * let a reskin that changes the math through. No network / API key needed here —
 * these are the pure config + guardrail units.
 */

describe("aiConfig flag parsing", () => {
  it("aiLayerEnabled defaults false and is case-insensitive", () => {
    expect(aiLayerEnabled({})).toBe(false);
    expect(aiLayerEnabled({ VITE_AI_LAYER: "off" })).toBe(false);
    expect(aiLayerEnabled({ VITE_AI_LAYER: "on" })).toBe(true);
    expect(aiLayerEnabled({ VITE_AI_LAYER: "ON" })).toBe(true);
  });

  it("aiStubEnabled defaults false", () => {
    expect(aiStubEnabled({})).toBe(false);
    expect(aiStubEnabled({ VITE_AI_STUB: "on" })).toBe(true);
  });

  it("readAiConfig returns null when the layer is off", () => {
    expect(readAiConfig({})).toBeNull();
    expect(readAiConfig({ VITE_AI_ENDPOINT: "https://x" })).toBeNull();
  });

  it("readAiConfig returns null when on but no endpoint and no stub", () => {
    expect(readAiConfig({ VITE_AI_LAYER: "on" })).toBeNull();
  });

  it("readAiConfig parses a dedicated endpoint and trims trailing slashes", () => {
    const cfg = readAiConfig({
      VITE_AI_LAYER: "on",
      VITE_AI_ENDPOINT: "https://ai.example.com/",
    });
    expect(cfg).not.toBeNull();
    expect(cfg?.endpoint).toBe("https://ai.example.com");
    expect(cfg?.stub).toBe(false);
  });

  it("readAiConfig falls back to VITE_API_BASE_URL when no dedicated endpoint", () => {
    const cfg = readAiConfig({
      VITE_AI_LAYER: "on",
      VITE_API_BASE_URL: "https://api.example.com",
    });
    expect(cfg?.endpoint).toBe("https://api.example.com");
  });

  it("readAiConfig allows stub with no endpoint", () => {
    const cfg = readAiConfig({ VITE_AI_LAYER: "on", VITE_AI_STUB: "on" });
    expect(cfg).not.toBeNull();
    expect(cfg?.stub).toBe(true);
    expect(cfg?.endpoint).toBe("");
  });
});

describe("extractNumbers", () => {
  it("normalizes $, thousands separators and %", () => {
    expect(extractNumbers("Bankroll $1,000, edge 2.5%")).toEqual([
      "1000",
      "2.5",
    ]);
  });

  it("collapses 2.00 and 2 to the same value", () => {
    expect(extractNumbers("pays 2.00")).toEqual(["2"]);
  });
});

describe("verifyFlavor guardrail", () => {
  const original =
    "At the Aria salon you flip 3 fair coins with a $1,000 bankroll priced at 200 odds. Stake?";

  it("accepts a reskin that preserves every number", () => {
    const candidate =
      "On a Chicago prop desk you flip 3 fair coins; with a $1,000 bankroll at 200 odds, what's the Kelly stake?";
    expect(verifyFlavor(original, candidate).ok).toBe(true);
  });

  it("REJECTS a reskin that drops a required number (→ caller falls back)", () => {
    // Missing the "$1,000" bankroll entirely.
    const candidate =
      "On a Chicago prop desk you flip 3 fair coins at 200 odds. What's the Kelly stake?";
    const res = verifyFlavor(original, candidate);
    expect(res.ok).toBe(false);
    expect(res.missing).toContain("1000");
  });

  it("REJECTS a reskin that alters a quantity", () => {
    // Changed the bankroll from 1,000 to 2,000 — the math no longer matches.
    const candidate =
      "You flip 3 fair coins with a $2,000 bankroll at 200 odds. Kelly stake?";
    const res = verifyFlavor(original, candidate);
    expect(res.ok).toBe(false);
  });

  it("strict-by-default rejects sneaking in a NEW number", () => {
    const candidate =
      "At 9:30 you flip 3 fair coins with a $1,000 bankroll at 200 odds. Stake?";
    const res = verifyFlavor(original, candidate);
    expect(res.ok).toBe(false);
    expect(res.introduced).toContain("9"); // "9:30" → 9 and 30 are new tokens
  });

  it("can be relaxed to allow new numbers", () => {
    const candidate =
      "At 9:30 you flip 3 fair coins with a $1,000 bankroll at 200 odds. Stake?";
    expect(
      verifyFlavor(original, candidate, { disallowNewNumbers: false }).ok,
    ).toBe(true);
  });

  it("rejects empty output", () => {
    expect(verifyFlavor(original, "").ok).toBe(false);
  });
});
