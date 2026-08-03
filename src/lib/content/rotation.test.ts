import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import {
  createRotation,
  nextSelection,
  recordServed,
  selectSequence,
  type RotationState,
} from "./rotation";

/** Sample candidates as bare signature strings (default `signatureOf`). */
const FIVE = ["a", "b", "c", "d", "e"] as const;

describe("createRotation", () => {
  it("starts empty and coerces the window to a non-negative integer", () => {
    expect(createRotation(3)).toEqual({ windowSize: 3, recent: [] });
    expect(createRotation(2.9).windowSize).toBe(2);
    expect(createRotation(-4).windowSize).toBe(0);
  });
});

describe("recordServed", () => {
  it("stays bounded to the window size (drops oldest first)", () => {
    let s = createRotation(3);
    for (const sig of ["a", "b", "c", "d", "e"]) s = recordServed(s, sig);
    expect(s.recent).toEqual(["c", "d", "e"]);
    expect(s.recent.length).toBe(s.windowSize);
  });

  it("does not mutate the input state (immutable update)", () => {
    const s0 = createRotation(2);
    const s1 = recordServed(s0, "x");
    expect(s0.recent).toEqual([]);
    expect(s1.recent).toEqual(["x"]);
  });

  it("with window 0, never remembers anything", () => {
    let s = createRotation(0);
    s = recordServed(s, "a");
    s = recordServed(s, "b");
    expect(s.recent).toEqual([]);
  });
});

describe("nextSelection anti-repeat", () => {
  it("never repeats a signature within the window when enough distinct candidates exist", () => {
    const windowSize = 3;
    let state: RotationState = createRotation(windowSize);
    const rng = new Rng(12345);
    for (let i = 0; i < 200; i++) {
      // The window BEFORE this pick must not contain the chosen signature.
      const windowBefore = new Set(state.recent);
      const step = nextSelection(state, FIVE, rng);
      expect(windowBefore.has(step.chosen)).toBe(false);
      state = step.state;
      // Ring never exceeds the window.
      expect(state.recent.length).toBeLessThanOrEqual(windowSize);
    }
  });

  it("is deterministic by seed (same inputs → same picks)", () => {
    const runOnce = (seed: number) =>
      selectSequence(createRotation(3), FIVE, new Rng(seed), 50).chosen;
    expect(runOnce(999)).toEqual(runOnce(999));
    // A different seed should generally diverge (guards against a constant).
    expect(runOnce(999)).not.toEqual(runOnce(1000));
  });

  it("works with object candidates via a signatureOf selector", () => {
    const items = [
      { id: "q1", family: "ev" },
      { id: "q2", family: "arb" },
      { id: "q3", family: "bayes" },
      { id: "q4", family: "walk" },
    ];
    const sigOf = (x: { family: string }) => x.family;
    let state = createRotation(2);
    const rng = new Rng(7);
    for (let i = 0; i < 60; i++) {
      const windowBefore = new Set(state.recent);
      const step = nextSelection(state, items, rng, sigOf);
      expect(windowBefore.has(sigOf(step.chosen))).toBe(false);
      state = step.state;
    }
  });
});

describe("nextSelection graceful fallback", () => {
  it("still serves when candidates < window (all in-window)", () => {
    // Window of 5 but only 2 distinct candidates: repeats are unavoidable,
    // yet selection must never throw and always returns a real candidate.
    const two = ["a", "b"] as const;
    let state = createRotation(5);
    const rng = new Rng(42);
    for (let i = 0; i < 20; i++) {
      const step = nextSelection(state, two, rng);
      expect(two).toContain(step.chosen);
      state = step.state;
      // State stays bounded to the window even under fallback.
      expect(state.recent.length).toBeLessThanOrEqual(5);
    }
  });

  it("falls back deterministically by seed", () => {
    const two = ["a", "b"] as const;
    const runOnce = (seed: number) =>
      selectSequence(createRotation(5), two, new Rng(seed), 20).chosen;
    expect(runOnce(3)).toEqual(runOnce(3));
  });

  it("throws on empty candidates", () => {
    expect(() => nextSelection(createRotation(3), [], new Rng(1))).toThrow();
  });
});

describe("state boundedness under sequence", () => {
  it("selectSequence keeps recent length capped at the window", () => {
    const { state } = selectSequence(createRotation(4), FIVE, new Rng(5), 100);
    expect(state.recent.length).toBe(4);
  });
});
