import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import {
  formatNumericAnswer,
  gradeFreeResponse,
  gradeNumeric,
} from "@/lib/numeric";
import { materializeNumericLevel } from "@/content/materialize";
import type { Level, NumericQuestion } from "@/types/content";
import { PROB_GENERATORS, PROB_NUMERIC_GENERATORS } from "./generators";
import { probabilityTrack } from "./levels";

/**
 * Free-response conversion coverage for the CORE Probability track (pr-1/pr-2/
 * pr-3). Mirrors the geo-1 / cp-1 numeric round-trip block: every converted
 * family must (a) grade its own answer via `gradeFreeResponse` AND `gradeNumeric`,
 * (b) carry a NAMED misconception tag + answer-withholding rung-1 coaching on
 * every `commonError`, and (c) emit mutually-distinct, finite error values ≠ the
 * answer. The quiz builders + `PROB_GENERATORS` are asserted to stay intact
 * (the shared `src/content/generators.test.ts` remains the 4-choices consumer).
 *
 * Also covers pr-4/pr-5 — the two hand-authored STATIC pools converted
 * MCQ→free-response numeric with per-ITEM (non-parametric) error-mode catalogs:
 * each verified answer grades right, and every `commonError` is finite, ≠ the
 * answer, misconception-tagged, and fires answer-withholding rung-1 coaching.
 */

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 101 + 7);

const NUMERIC_GENS = Object.entries(PROB_NUMERIC_GENERATORS) as [
  string,
  (rng: Rng) => NumericQuestion,
][];

describe("core-probability numeric generators: grading round-trip + clean, tagged errors", () => {
  for (const [name, gen] of NUMERIC_GENS) {
    it(`${name} — answer grades (free-response + numeric) and errors are clean, tagged`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        const dp = q.decimals ?? 0;
        const f = 10 ** dp;

        // Deterministic per seed (fresh + reproducible for save/resume).
        const q2 = gen(new Rng(seed));
        expect(q2.answer).toBe(q.answer);
        expect(Number.isFinite(q.answer)).toBe(true);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(["", "$"]).toContain(q.unit);

        // (a) The correct answer grades correct via BOTH graders.
        const typed = formatNumericAnswer(q);
        expect(gradeNumeric(q, typed).correct).toBe(true);
        expect(gradeFreeResponse(q, typed).correct).toBe(true);

        // (b) Every commonError: finite, ≠ answer, tagged, coaching present,
        //     answer-withholding, and matched (fires targeted feedback).
        for (const ce of q.commonErrors ?? []) {
          expect(Number.isFinite(ce.value)).toBe(true);
          expect(Math.round(ce.value * f)).not.toBe(Math.round(q.answer * f));
          expect(ce.misconception, `${name} missing misconception tag`).toBeTruthy();
          expect(ce.feedback.length).toBeGreaterThan(20);
          if (q.decimals != null) {
            // Rung-1 coaching must NOT leak the answer verbatim.
            expect(ce.feedback).not.toContain(q.answer.toFixed(dp));
          }
          const g = gradeFreeResponse(
            q,
            dp === 0 ? String(ce.value) : ce.value.toFixed(dp),
          );
          expect(g.correct).toBe(false);
          expect(g.matchedError?.feedback).toBeTruthy();
          expect(g.matchedError?.misconception).toBe(ce.misconception);
        }

        // (c) commonErrors mutually distinct at the grading precision.
        const keys = (q.commonErrors ?? []).map((e) => Math.round(e.value * f));
        expect(new Set(keys).size).toBe(keys.length);

        // Rung-5 explanation is a complete worked solution.
        expect(q.explanation.trim().length).toBeGreaterThan(40);
      }
    });
  }
});

describe("converted families reuse the canonical MISCONCEPTION taxonomy", () => {
  it("surfaces the expected canonical + descriptive tags across seeds", () => {
    const tags = new Set<string>();
    for (const [, gen] of NUMERIC_GENS) {
      for (const seed of SEEDS) {
        for (const ce of gen(new Rng(seed)).commonErrors ?? []) {
          if (ce.misconception) tags.add(ce.misconception);
        }
      }
    }
    // Canonical MISCONCEPTION.* tags our conversions must surface.
    expect(tags.has("or_means_add_no_overlap")).toBe(true);
    expect(tags.has("and_means_add")).toBe(true);
    expect(tags.has("ordered_vs_unordered")).toBe(true);
    expect(tags.has("reversed_conditional")).toBe(true);
    expect(tags.has("base_rate_neglect")).toBe(true);
    expect(tags.has("likelihood_as_posterior")).toBe(true);
    expect(tags.has("at_least_one_naive")).toBe(true);
    expect(tags.has("equal_weight_mixture")).toBe(true);
  });
});

/** Fetch a converted level from the assembled track by id. */
function levelById(id: string): Level {
  const level = probabilityTrack.levels.find((l) => l.id === id);
  if (!level) throw new Error(`missing level ${id}`);
  return level;
}

describe("pr-1/pr-2/pr-3 materialize as numeric free-response levels", () => {
  for (const id of ["pr-1", "pr-2", "pr-3"]) {
    it(`${id} — materializes numeric items whose answers grade correct`, () => {
      const level = levelById(id);
      expect(level.mode).toBe("numeric");
      expect(level.numericGenerator).toBeTruthy();
      for (const seed of [1, 7, 42, 313, 2024]) {
        const items = materializeNumericLevel(level, seed);
        expect(items.length).toBe(level.questionCount ?? 5);
        for (const q of items) {
          // Each materialized item is stamped with the family that drew it.
          expect(q.family, `${id} item unstamped`).toBeTruthy();
          // The exact answer grades correct through the free-response path.
          expect(gradeFreeResponse(q, formatNumericAnswer(q)).correct).toBe(true);
          // Every common error carries a misconception tag (rung-1 driver).
          for (const ce of q.commonErrors ?? []) {
            expect(ce.misconception).toBeTruthy();
          }
        }
      }
    });
  }
});

describe("pr-4/pr-5 STATIC pools converted to free-response numeric (per-item error modes)", () => {
  const CASES: { id: string; count: number; answers: Record<string, number> }[] = [
    {
      id: "pr-4",
      count: 6,
      answers: {
        "pr-hh-ht": 4,
        "pr-hh": 6,
        "pr-ant-cube": 10,
        "pr-gamblers-ruin": 0.3,
        "pr-broken-stick": 0.25,
        "pr-birthday": 23,
      },
    },
    {
      id: "pr-5",
      count: 5,
      answers: {
        "pr-lattice-count": 35,
        "pr-ballot": 0.25,
        "pr-catalan": 5,
        "pr-coupon": 14.7,
        "pr-grid-collision": 0.5,
      },
    },
  ];

  for (const { id, count, answers } of CASES) {
    it(`${id} — numeric pool: verified answers grade right, every error mode is tagged + grades wrong`, () => {
      const level = levelById(id);
      expect(level.mode).toBe("numeric");
      expect(level.numericGenerator).toBeUndefined();
      const pool = level.numericQuestions ?? [];
      expect(pool.length).toBe(count);
      // drawCount samples 5 for the play attempt but the authored pool is intact.
      expect(level.drawCount).toBe(5);

      const ids = new Set<string>();
      for (const q of pool) {
        // Unique ids, substantive prompt + rung-5 explanation.
        expect(ids.has(q.id)).toBe(false);
        ids.add(q.id);
        expect(q.prompt.trim().length).toBeGreaterThan(5);
        expect(q.explanation.trim().length).toBeGreaterThan(40);
        expect(q.unit).toBe("");

        // Answer matches the arithmetically-verified expected value, is finite
        // and positive, and (per the numeric-level contract) is a positive
        // INTEGER when `decimals` is omitted.
        const dp = q.decimals ?? 0;
        const f = 10 ** dp;
        expect(q.id in answers).toBe(true);
        const expected = answers[q.id];
        expect(Math.round(q.answer * f)).toBe(Math.round(expected * f));
        expect(Number.isFinite(q.answer)).toBe(true);
        expect(q.answer).toBeGreaterThan(0);
        if (q.decimals == null) {
          expect(Number.isInteger(q.answer)).toBe(true);
        }

        // The exact answer grades correct through the free-response path.
        expect(gradeFreeResponse(q, formatNumericAnswer(q)).correct).toBe(true);

        // Every per-item error mode: finite, ≠ answer at precision, tagged,
        // answer-withholding coaching, and it fires targeted feedback when typed.
        expect((q.commonErrors ?? []).length).toBeGreaterThan(0);
        for (const ce of q.commonErrors ?? []) {
          expect(Number.isFinite(ce.value)).toBe(true);
          expect(Math.round(ce.value * f)).not.toBe(Math.round(q.answer * f));
          expect(ce.misconception, `${q.id} missing misconception tag`).toBeTruthy();
          expect(ce.feedback.length).toBeGreaterThan(20);
          if (q.decimals != null) {
            expect(ce.feedback).not.toContain(q.answer.toFixed(dp));
          }
          const g = gradeFreeResponse(
            q,
            dp === 0 ? String(ce.value) : ce.value.toFixed(dp),
          );
          expect(g.correct).toBe(false);
          expect(g.matchedError?.feedback).toBeTruthy();
          expect(g.matchedError?.misconception).toBe(ce.misconception);
        }

        // commonErrors mutually distinct at the grading precision.
        const keys = (q.commonErrors ?? []).map((e) => Math.round(e.value * f));
        expect(new Set(keys).size).toBe(keys.length);
      }
    });
  }
});

describe("quiz generators + PROB_GENERATORS stay intact (shared registry contract)", () => {
  it("PROB_GENERATORS still exposes exactly the nine quiz families, 4-choice", () => {
    expect(Object.keys(PROB_GENERATORS).sort()).toEqual(
      [
        "genAtLeastOne",
        "genBayes",
        "genBinomial",
        "genCombinations",
        "genConditional",
        "genExpectedValue",
        "genGeometric",
        "genIntersectionIndep",
        "genUnion",
      ].sort(),
    );
    // None of the numeric generators leaked into the quiz-only registry.
    for (const key of Object.keys(PROB_GENERATORS)) {
      expect(key.endsWith("Numeric")).toBe(false);
    }
    // A representative quiz generator still yields 4 distinct MC choices.
    for (const seed of SEEDS.slice(0, 10)) {
      const q = PROB_GENERATORS.genUnion(new Rng(seed));
      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices).size).toBe(4);
    }
  });
});
