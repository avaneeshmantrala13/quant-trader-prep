/**
 * aiConfig.test.ts — the client reads the AI endpoint from build-time env.
 *
 * The production bug behind "grading is instant / highlights are tiny" was a
 * bundle baked with `VITE_AI_ENDPOINT=http://localhost:8788`: real browsers
 * POST to localhost, the request fails, and the app silently falls back to the
 * deterministic keyword highlighter. These tests pin the config-reading contract
 * so a PROD build points at the hosted AWS endpoint (and a DEV build can still
 * point at localhost) — the "no-localhost in prod" guarantee itself is enforced
 * by the post-build dist scan in `infra/build-prod.sh`.
 */
import { describe, expect, it } from "vitest";
import { aiLayerEnabled, readAiConfig } from "./aiConfig";

const PROD_ENDPOINT = "https://a3uyqqj6s0.execute-api.us-east-1.amazonaws.com";

describe("readAiConfig — endpoint wiring", () => {
  it("returns null when the AI layer is off (default local-first)", () => {
    expect(readAiConfig({})).toBeNull();
    expect(readAiConfig({ VITE_AI_ENDPOINT: PROD_ENDPOINT })).toBeNull();
    expect(aiLayerEnabled({})).toBe(false);
  });

  it("uses the hosted AWS endpoint for a PROD build (never localhost)", () => {
    const cfg = readAiConfig({
      VITE_AI_LAYER: "on",
      VITE_AI_PROVIDER: "openai",
      VITE_AI_ENDPOINT: PROD_ENDPOINT,
    });
    expect(cfg).not.toBeNull();
    expect(cfg!.endpoint).toBe(PROD_ENDPOINT);
    expect(cfg!.endpoint).not.toContain("localhost");
    expect(cfg!.stub).toBe(false);
  });

  it("trims a trailing slash so `${endpoint}/ai` is well-formed", () => {
    const cfg = readAiConfig({
      VITE_AI_LAYER: "on",
      VITE_AI_ENDPOINT: `${PROD_ENDPOINT}/`,
    });
    expect(cfg!.endpoint).toBe(PROD_ENDPOINT);
  });

  it("still supports a localhost endpoint for LOCAL dev", () => {
    const cfg = readAiConfig({
      VITE_AI_LAYER: "on",
      VITE_AI_ENDPOINT: "http://localhost:8788",
    });
    expect(cfg!.endpoint).toBe("http://localhost:8788");
  });

  it("falls back to VITE_API_BASE_URL when no dedicated AI endpoint is set", () => {
    const cfg = readAiConfig({
      VITE_AI_LAYER: "on",
      VITE_API_BASE_URL: PROD_ENDPOINT,
    });
    expect(cfg!.endpoint).toBe(PROD_ENDPOINT);
  });
});
