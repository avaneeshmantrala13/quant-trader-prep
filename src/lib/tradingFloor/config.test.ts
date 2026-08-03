import { describe, expect, it } from "vitest";
import {
  INTERVIEW,
  SUPERDAY,
  WARMUP,
  floorConfigById,
  floorConfigHash,
} from "./config";

describe("floorConfigHash", () => {
  it("is stable for identical inputs", () => {
    const a = floorConfigHash("over-under", INTERVIEW, 8);
    const b = floorConfigHash("over-under", INTERVIEW, 8);
    expect(a).toBe(b);
    expect(typeof a).toBe("string");
  });

  it("differs when the round count changes", () => {
    expect(floorConfigHash("over-under", INTERVIEW, 8)).not.toBe(
      floorConfigHash("over-under", INTERVIEW, 10),
    );
  });

  it("differs when the pack id changes", () => {
    expect(floorConfigHash("over-under", INTERVIEW, 8)).not.toBe(
      floorConfigHash("running-total", INTERVIEW, 8),
    );
  });

  it("differs across difficulty presets (bot levers change the bucket)", () => {
    const w = floorConfigHash("over-under", WARMUP, 8);
    const i = floorConfigHash("over-under", INTERVIEW, 8);
    const s = floorConfigHash("over-under", SUPERDAY, 8);
    expect(new Set([w, i, s]).size).toBe(3);
  });
});

describe("floorConfigById", () => {
  it("resolves known preset ids", () => {
    expect(floorConfigById("warmup")).toBe(WARMUP);
    expect(floorConfigById("interview")).toBe(INTERVIEW);
    expect(floorConfigById("superday")).toBe(SUPERDAY);
  });

  it("falls back to INTERVIEW for an unknown id", () => {
    expect(floorConfigById("does-not-exist")).toBe(INTERVIEW);
  });
});
