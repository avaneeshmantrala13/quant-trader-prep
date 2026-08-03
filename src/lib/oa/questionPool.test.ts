import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import type { OaQuestion } from "./types";
import {
  OA_CONTENT_POOLS,
  OA_QUESTION_GENERATORS,
  drawOaQuestions,
  drawOaQuestionsForFormat,
  drawOaQuestionsForFormatRotated,
  drawOaQuestionsFromPool,
  poolForFormat,
  toOaQuestion,
} from "./questionPool";
import { OA_FORMATS } from "./config";
import { emptyOaStore, getRotationState } from "./store";
import { SEQUENCE_QUIZ_GENERATORS } from "@/content/sequences/generators";
import { ARBITRAGE_QUIZ_GENERATORS } from "@/content/arbitrage/generators";
import { AUCTION_QUIZ_GENERATORS } from "@/content/auctions/generators";

/** Assert a single OaQuestion is structurally well-formed. */
function expectWellFormed(q: OaQuestion): void {
  expect(typeof q.prompt).toBe("string");
  expect(q.prompt.length).toBeGreaterThan(0);
  expect(Array.isArray(q.choices)).toBe(true);
  expect(q.choices.length).toBeGreaterThanOrEqual(2);
  for (const c of q.choices) {
    expect(typeof c).toBe("string");
    expect(c.length).toBeGreaterThan(0);
  }
  expect(Number.isInteger(q.correctIndex)).toBe(true);
  expect(q.correctIndex).toBeGreaterThanOrEqual(0);
  expect(q.correctIndex).toBeLessThan(q.choices.length);
  expect(typeof q.explanation).toBe("string");
  expect(typeof q.difficulty).toBe("string");
}

describe("OA_QUESTION_GENERATORS pool", () => {
  it("is non-empty", () => {
    expect(OA_QUESTION_GENERATORS.length).toBeGreaterThan(0);
  });

  it("every generator returns a well-formed Question with a valid correctIndex", () => {
    for (const gen of OA_QUESTION_GENERATORS) {
      const q = gen(new Rng(1));
      // The app's quiz generators are MCQs — typically 4 options, but a
      // generator may de-dupe a coincidental distractor down to as few as 2.
      expect(q.choices.length).toBeGreaterThanOrEqual(2);
      expect(q.choices.length).toBeLessThanOrEqual(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.choices.length);
      expect(q.prompt.length).toBeGreaterThan(0);
    }
  });
});

describe("toOaQuestion", () => {
  it("maps a Question to an OaQuestion and forces the unique id", () => {
    const q = OA_QUESTION_GENERATORS[0](new Rng(42));
    const oa = toOaQuestion(q, "oa-42-0");
    expect(oa.id).toBe("oa-42-0");
    expect(oa.prompt).toBe(q.prompt);
    expect(oa.choices).toEqual(q.choices);
    expect(oa.correctIndex).toBe(q.correctIndex);
    expect(oa.explanation).toBe(q.explanation);
    expect(oa.difficulty).toBe(q.difficulty);
    expect(oa.concept).toBe(q.concept);
    expect(oa.source).toBe(q.source);
    expectWellFormed(oa);
  });
});

describe("drawOaQuestions", () => {
  it("returns exactly `count` items for a variety of counts", () => {
    for (const count of [1, 5, 10, 17, 40]) {
      const qs = drawOaQuestions(7, count);
      expect(qs).toHaveLength(count);
    }
  });

  it("handles count > pool size by cycling generators", () => {
    const count = OA_QUESTION_GENERATORS.length * 4 + 3;
    const qs = drawOaQuestions(123, count);
    expect(qs).toHaveLength(count);
    for (const q of qs) expectWellFormed(q);
  });

  it("produces only well-formed questions with unique ids", () => {
    const qs = drawOaQuestions(2024, 40);
    for (const q of qs) expectWellFormed(q);
    const ids = qs.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("oa-2024-0");
    expect(ids[39]).toBe("oa-2024-39");
  });

  it("is deterministic: same (seed, count) => deeply equal output", () => {
    const a = drawOaQuestions(99, 25);
    const b = drawOaQuestions(99, 25);
    expect(a).toEqual(b);
  });

  it("different seeds generally yield different prompts", () => {
    const a = drawOaQuestions(1, 20);
    const b = drawOaQuestions(2, 20);
    const samePromptCount = a.filter(
      (q, i) => q.prompt === b[i].prompt,
    ).length;
    // Some overlap is possible (small parameter spaces), but not all identical.
    expect(samePromptCount).toBeLessThan(a.length);
  });

  it("returns an empty array for count 0", () => {
    expect(drawOaQuestions(5, 0)).toEqual([]);
  });
});

describe("OA_CONTENT_POOLS (per-format archetype pools)", () => {
  it("every named pool is non-empty and yields well-formed questions", () => {
    for (const [id, generators] of Object.entries(OA_CONTENT_POOLS)) {
      expect(generators.length, `pool ${id}`).toBeGreaterThan(0);
      for (const gen of generators) {
        const q = gen(new Rng(11));
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
        expect(q.choices.length).toBeLessThanOrEqual(4);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.choices.length);
        expect(q.prompt.length).toBeGreaterThan(0);
      }
    }
  });

  it("the default `mixed` pool IS the original OA_QUESTION_GENERATORS", () => {
    expect(OA_CONTENT_POOLS.mixed).toBe(OA_QUESTION_GENERATORS);
  });

  it("defines a dedicated pool for each research-derived format", () => {
    expect(OA_CONTENT_POOLS.rapidMixed).toBeDefined();
    expect(OA_CONTENT_POOLS.blitz).toBeDefined();
    expect(OA_CONTENT_POOLS.derivation).toBeDefined();
    expect(OA_CONTENT_POOLS.deepSet).toBeDefined();
  });
});

describe("poolForFormat + drawOaQuestionsForFormat", () => {
  it("resolves each format's declared pool (default mixed when unset)", () => {
    for (const config of OA_FORMATS) {
      const pool = poolForFormat(config);
      if (config.contentPool) {
        expect(pool).toBe(OA_CONTENT_POOLS[config.contentPool]);
      } else {
        expect(pool).toBe(OA_QUESTION_GENERATORS);
      }
    }
  });

  it("falls back to the mixed pool for an unknown pool id", () => {
    expect(
      poolForFormat({ ...OA_FORMATS[0], contentPool: "does-not-exist" }),
    ).toBe(OA_QUESTION_GENERATORS);
  });

  it("draws exactly questionCount well-formed, unique-id questions for EVERY format", () => {
    for (const config of OA_FORMATS) {
      const qs = drawOaQuestionsForFormat(config, 2026, config.questionCount);
      expect(qs, config.id).toHaveLength(config.questionCount);
      for (const q of qs) expectWellFormed(q);
      const ids = qs.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("is deterministic per (config, seed, count)", () => {
    const config = OA_FORMATS.find((f) => f.id === "derivation-set")!;
    expect(drawOaQuestionsForFormat(config, 7, 12)).toEqual(
      drawOaQuestionsForFormat(config, 7, 12),
    );
  });

  it("drawOaQuestions delegates to the mixed pool via drawOaQuestionsFromPool", () => {
    expect(drawOaQuestions(42, 8)).toEqual(
      drawOaQuestionsFromPool(42, 8, OA_QUESTION_GENERATORS),
    );
  });
});

describe("new archetype pool memberships (T11)", () => {
  it("rapidMixed carries quick sequence + arbitrage archetypes", () => {
    const pool = OA_CONTENT_POOLS.rapidMixed;
    for (const key of [
      "arithmeticNext",
      "geometricNext",
      "caesarNext",
      "alternatingShiftNext",
      "analogyNext",
    ] as const) {
      expect(pool, `rapidMixed ${key}`).toContain(SEQUENCE_QUIZ_GENERATORS[key]);
    }
    for (const key of ["genArbDetect", "genValueLeg", "genBasketArb"] as const) {
      expect(pool, `rapidMixed ${key}`).toContain(
        ARBITRAGE_QUIZ_GENERATORS[key],
      );
    }
  });

  it("blitz carries sequence pattern-recognition archetypes", () => {
    const pool = OA_CONTENT_POOLS.blitz;
    for (const key of [
      "polynomialNext",
      "interleavedNext",
      "fibonacciNext",
      "alternatingOpNext",
      "oddOneOut",
    ] as const) {
      expect(pool, `blitz ${key}`).toContain(SEQUENCE_QUIZ_GENERATORS[key]);
    }
  });

  it("derivation carries arbitrage value/direction + auction archetypes", () => {
    const pool = OA_CONTENT_POOLS.derivation;
    for (const key of ["genValueLeg", "genBasketArb"] as const) {
      expect(pool, `derivation ${key}`).toContain(ARBITRAGE_QUIZ_GENERATORS[key]);
    }
    for (const key of [
      "genBidEvDecision",
      "genShadingWithN",
      "genAcquireDecision",
    ] as const) {
      expect(pool, `derivation ${key}`).toContain(AUCTION_QUIZ_GENERATORS[key]);
    }
  });

  it("deepSet carries the auction winner's-curse archetypes", () => {
    const pool = OA_CONTENT_POOLS.deepSet;
    for (const key of [
      "genBidEvDecision",
      "genShadingWithN",
      "genAcquireDecision",
    ] as const) {
      expect(pool, `deepSet ${key}`).toContain(AUCTION_QUIZ_GENERATORS[key]);
    }
  });

  it("all 10 sequence families are reachable via the Case-B rapidMixed/blitz pools", () => {
    const reachable = new Set<unknown>([
      ...OA_CONTENT_POOLS.rapidMixed,
      ...OA_CONTENT_POOLS.blitz,
    ]);
    for (const gen of Object.values(SEQUENCE_QUIZ_GENERATORS)) {
      expect(reachable.has(gen)).toBe(true);
    }
  });

  it("all 3 arbitrage + 3 auction families are reachable via a Case-B pool", () => {
    const reachable = new Set<unknown>([
      ...OA_CONTENT_POOLS.rapidMixed,
      ...OA_CONTENT_POOLS.derivation,
      ...OA_CONTENT_POOLS.deepSet,
    ]);
    for (const gen of Object.values(ARBITRAGE_QUIZ_GENERATORS)) {
      expect(reachable.has(gen)).toBe(true);
    }
    for (const gen of Object.values(AUCTION_QUIZ_GENERATORS)) {
      expect(reachable.has(gen)).toBe(true);
    }
  });

  it("every newly-wired generator is MCQ-shaped (2–4 choices, valid correctIndex)", () => {
    const newGens = [
      ...Object.values(SEQUENCE_QUIZ_GENERATORS),
      ...Object.values(ARBITRAGE_QUIZ_GENERATORS),
      ...Object.values(AUCTION_QUIZ_GENERATORS),
    ];
    for (const gen of newGens) {
      const q = gen(new Rng(5));
      expect(q.choices.length).toBeGreaterThanOrEqual(2);
      expect(q.choices.length).toBeLessThanOrEqual(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.choices.length);
      expect(q.prompt.length).toBeGreaterThan(0);
    }
  });

  it("sequence + auction generators stamp a stable `family` matching their key", () => {
    for (const [key, gen] of Object.entries(SEQUENCE_QUIZ_GENERATORS)) {
      expect(gen(new Rng(7)).family).toBe(key);
    }
    for (const [key, gen] of Object.entries(AUCTION_QUIZ_GENERATORS)) {
      expect(gen(new Rng(7)).family).toBe(key);
    }
  });
});

describe("drawOaQuestionsForFormatRotated (rotation-aware, additive)", () => {
  const rapid = OA_FORMATS.find((f) => f.id === "rapid-battery")!;

  it("returns exactly `count` well-formed, unique-id questions + an advanced store", () => {
    const { questions, store } = drawOaQuestionsForFormatRotated(
      rapid,
      2026,
      12,
      undefined,
    );
    expect(questions).toHaveLength(12);
    for (const q of questions) expectWellFormed(q);
    const ids = questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("oa-2026-0");
    // The served signatures are recorded in the returned store's rotation ring.
    const rot = getRotationState(store);
    expect(rot.recent.length).toBeGreaterThan(0);
    expect(rot.recent.length).toBeLessThanOrEqual(rot.windowSize);
  });

  it("is deterministic given (config, seed, count, store)", () => {
    const a = drawOaQuestionsForFormatRotated(rapid, 9, 10, undefined);
    const b = drawOaQuestionsForFormatRotated(rapid, 9, 10, undefined);
    expect(a.questions).toEqual(b.questions);
    expect(a.store).toEqual(b.store);
  });

  it("does not mutate the input store, and the pure draw path is unaffected", () => {
    const base = emptyOaStore();
    const before = JSON.stringify(base);
    drawOaQuestionsForFormatRotated(rapid, 3, 8, base);
    expect(JSON.stringify(base)).toBe(before);
    // The pure format draw remains deterministic and independent of rotation.
    expect(drawOaQuestionsForFormat(rapid, 3, 8)).toEqual(
      drawOaQuestionsForFormat(rapid, 3, 8),
    );
  });

  it("threads the ring forward across successive draws (bounded to the window)", () => {
    const first = drawOaQuestionsForFormatRotated(rapid, 1, 6, undefined);
    const second = drawOaQuestionsForFormatRotated(rapid, 1, 6, first.store);
    const ring = getRotationState(second.store);
    expect(ring.recent.length).toBeGreaterThan(0);
    expect(ring.recent.length).toBeLessThanOrEqual(ring.windowSize);
  });

  it("returns an empty draw for count 0 without throwing", () => {
    const { questions } = drawOaQuestionsForFormatRotated(rapid, 5, 0, undefined);
    expect(questions).toEqual([]);
  });
});
