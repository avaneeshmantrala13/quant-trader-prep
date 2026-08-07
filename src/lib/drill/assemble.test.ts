import { describe, expect, it } from "vitest";
import { assembleDrill } from "./assemble";
import { parseDrillIntent, type DrillSpec } from "./parseIntent";
import { DRILL_TOPICS } from "./vocabulary";

const key = (label: string): string => {
  const t = DRILL_TOPICS.find((d) => d.label === label);
  if (!t) throw new Error(`no drill topic labelled "${label}"`);
  return t.topicKey;
};

describe("assembleDrill", () => {
  it("returns exactly `count` questions when the pool is large enough", () => {
    const spec = parseDrillIntent("bayes and expected value, 8 questions");
    const qs = assembleDrill(spec, 1234);
    expect(qs.length).toBe(8);
  });

  it("is deterministic for a fixed (spec, seed)", () => {
    const spec = parseDrillIntent("combinatorics, 10");
    const a = assembleDrill(spec, 42);
    const b = assembleDrill(spec, 42);
    expect(a.map((q) => q.prompt)).toEqual(b.map((q) => q.prompt));
  });

  it("varies with the seed", () => {
    const spec = parseDrillIntent("combinatorics, 10");
    const a = assembleDrill(spec, 1);
    const b = assembleDrill(spec, 999);
    // Not a hard guarantee, but with a healthy pool the orderings differ.
    expect(a.map((q) => q.prompt)).not.toEqual(b.map((q) => q.prompt));
  });

  it("produces well-formed MCQ questions (>=2 choices, valid correctIndex)", () => {
    const spec = parseDrillIntent("markov chains, 6");
    const qs = assembleDrill(spec, 7);
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) {
      expect(q.choices.length).toBeGreaterThanOrEqual(2);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.choices.length);
      expect(q.prompt.trim().length).toBeGreaterThan(0);
    }
  });

  it("dedupes identical prompts within a drill", () => {
    const spec = parseDrillIntent("expected value, 20");
    const qs = assembleDrill(spec, 55);
    const sigs = qs.map((q) => `${q.prompt}::${q.correctIndex}`);
    expect(new Set(sigs).size).toBe(sigs.length);
  });

  it("returns [] when no topic matches", () => {
    const empty: DrillSpec = {
      topicKeys: [],
      minOrder: 0,
      maxOrder: 4,
      count: 10,
    };
    expect(assembleDrill(empty, 1)).toEqual([]);
  });

  it("returns [] for a topicKey that exists but with an out-of-range band", () => {
    // Order 99 can never match any level's difficulty order (0..4).
    const spec: DrillSpec = {
      topicKeys: [key("Conditional Probability")],
      minOrder: 99,
      maxOrder: 99,
      count: 10,
    };
    expect(assembleDrill(spec, 1)).toEqual([]);
  });

  it("respects count=0 (returns [])", () => {
    const spec = parseDrillIntent("bayes");
    expect(assembleDrill({ ...spec, count: 0 }, 1)).toEqual([]);
  });

  it("honors a large in-capacity request: '37 questions on markov' → 37 unique", () => {
    // Regression: the assembler used to cap each level at its lesson-sized
    // `questionCount` (~5), so it could never reach 37. It now re-materializes
    // the parametric generators until the request is met. Markov Chains has ample
    // unique capacity (>200), so 37 must come back exactly, all distinct.
    const spec = parseDrillIntent("37 questions on markov");
    expect(spec.count).toBe(37);
    const qs = assembleDrill(spec, 4242);
    expect(qs.length).toBe(37);
    const sigs = qs.map((q) => `${q.prompt}::${q.correctIndex}`);
    expect(new Set(sigs).size).toBe(37);
  });

  it("gracefully caps at a topic's true capacity when it can't reach the request", () => {
    // Moment Generating Functions has a small generator space (~44 unique),
    // below the max request of 50 — so a 50-ask yields the MAX available, every
    // item unique, and never a promised-but-undelivered count. This is the
    // "topic can only make N" path the confirmation reports honestly.
    const spec: DrillSpec = {
      topicKeys: [key("Moment Generating Functions")],
      minOrder: 0,
      maxOrder: 4,
      count: 50,
    };
    const qs = assembleDrill(spec, 9);
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.length).toBeLessThan(50); // genuinely capped below the request
    const sigs = qs.map((q) => `${q.prompt}::${q.correctIndex}`);
    expect(new Set(sigs).size).toBe(qs.length); // every delivered item is unique
    // Deterministic for a fixed (spec, seed).
    const again = assembleDrill(spec, 9);
    expect(again.map((q) => q.prompt)).toEqual(qs.map((q) => q.prompt));
  });
});
