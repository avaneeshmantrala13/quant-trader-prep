import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { gradeFreeResponse, gradeNumeric } from "@/lib/numeric";
import type { NumericQuestion } from "@/types/content";
import { ALL_MM_NUMERIC_GENERATORS } from "./generators";

/**
 * Free-response conversion coverage for the mental-math track (mm-1..mm-4). The
 * quiz generators + `ALL_MM_GENERATORS` are left intact and exercised by the
 * shared registry test (`src/content/generators.test.ts`); here we cover the new
 * NUMERIC generators: every family's answer must grade (both as free-response and
 * strict numeric), be deterministic per seed, and carry a clean, TAGGED
 * parametric error-mode catalog whose wrong values each grade incorrect with
 * targeted rung-1 feedback.
 */

const NUMERIC_GENS: Record<string, (rng: Rng) => NumericQuestion> =
  ALL_MM_NUMERIC_GENERATORS;

const SEEDS = Array.from({ length: 80 }, (_, i) => i * 97 + 3);

describe("mental-math numeric generators: round-trip grading + tagged error modes", () => {
  for (const [name, gen] of Object.entries(NUMERIC_GENS)) {
    it(`${name} — answer grades, commonErrors are clean, distinct + tagged`, () => {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        const dp = q.decimals ?? 0;
        const f = 10 ** dp;

        expect(Number.isFinite(q.answer)).toBe(true);
        expect(q.unit).toBe("");
        expect(q.prompt).toMatch(/\(Enter (the number|a decimal)\.\)$/);
        expect(q.explanation.trim().length).toBeGreaterThan(10);

        // Deterministic: same seed ⇒ same instance.
        const q2 = gen(new Rng(seed));
        expect(q2.answer).toBe(q.answer);

        // The correct answer grades correct on BOTH grading paths.
        const typed = dp === 0 ? String(q.answer) : q.answer.toFixed(dp);
        expect(gradeFreeResponse(q, typed).correct).toBe(true);
        expect(gradeNumeric(q, typed).correct).toBe(true);

        // Every error mode: finite, distinct-from-answer, tagged, and it grades
        // INCORRECT while surfacing its targeted feedback.
        const keys: number[] = [];
        for (const ce of q.commonErrors ?? []) {
          expect(Number.isFinite(ce.value)).toBe(true);
          expect(Math.round(ce.value * f)).not.toBe(Math.round(q.answer * f));
          expect(ce.misconception).toBeTruthy();
          expect(ce.feedback.length).toBeGreaterThan(20);
          const g = gradeFreeResponse(
            q,
            dp === 0 ? String(ce.value) : ce.value.toFixed(dp),
          );
          expect(g.correct).toBe(false);
          expect(g.matchedError?.feedback).toBe(ce.feedback);
          expect(g.matchedError?.misconception).toBe(ce.misconception);
          keys.push(Math.round(ce.value * f));
        }
        // No duplicate error values within an item.
        expect(new Set(keys).size).toBe(keys.length);
      }
    });
  }
});

describe("mental-math numeric: each family emits its intended misconception tags", () => {
  const EXPECTED: Record<string, string[]> = {
    genAdditionNumeric: ["off_by_carry", "place_value_slip", "off_by_one"],
    genSubtractionNumeric: [
      "off_by_carry",
      "place_value_slip",
      "swapped_operands",
    ],
    genMultiply2x1Numeric: ["operation_confused", "off_by_one"],
    genMultiply2x2Numeric: [
      "dropped_cross_term",
      "off_by_one",
      "place_value_slip",
    ],
    genDivisionNumeric: ["off_by_one", "place_value_slip", "wrong_denominator"],
    genPercentNumeric: [
      "percent_as_whole",
      "place_value_slip",
      "operation_confused",
    ],
    genFractionToDecimalNumeric: [
      "inverted_fraction",
      "wrong_denominator",
      "place_value_slip",
    ],
    genOddsToProbNumeric: [
      "odds_direction_flipped",
      "odds_ratio_as_prob",
      "wrong_denominator",
    ],
  };

  for (const [name, expected] of Object.entries(EXPECTED)) {
    it(`${name} — surfaces every intended tag across seeds`, () => {
      const gen = NUMERIC_GENS[name];
      const seen = new Set<string>();
      for (const seed of SEEDS) {
        for (const ce of gen(new Rng(seed)).commonErrors ?? []) {
          if (ce.misconception) seen.add(ce.misconception);
        }
      }
      for (const tag of expected) expect(seen.has(tag)).toBe(true);
    });
  }
});

describe("fraction→decimal: coaching + explanation cite the DISPLAYED (reduced) fraction", () => {
  // Regression for audit D3: the prompt renders a reduced fraction (e.g. "3/5"),
  // so the rung-1 coaching and rung-5 explanation must reference that SAME
  // fraction — never the unreduced draw ("the denominator is 10").
  it("explanation + every commonError reference the shown numerator/denominator", () => {
    const gen = ALL_MM_NUMERIC_GENERATORS.genFractionToDecimalNumeric;
    // A wide seed sweep to hit every reducible denominator {4,8,10,16,20,25}.
    for (const seed of Array.from({ length: 400 }, (_, i) => i * 7 + 1)) {
      const q = gen(new Rng(seed));
      const m = q.prompt.match(/Express (\d+)\/(\d+) as a decimal/);
      expect(m).not.toBeNull();
      const shownNum = Number(m![1]);
      const shownDen = Number(m![2]);

      // Displayed fraction is fully reduced.
      const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
      expect(gcd(shownNum, shownDen)).toBe(1);

      // rung-5 explanation divides the SHOWN numerator by the SHOWN denominator.
      expect(q.explanation).toContain(
        `${shownNum}/${shownDen} = ${shownNum} ÷ ${shownDen} =`,
      );

      for (const ce of q.commonErrors ?? []) {
        if (ce.misconception === "wrong_denominator") {
          // Coaching must name the SHOWN denominator, not the raw draw.
          expect(ce.feedback).toContain(`the denominator is ${shownDen}`);
          expect(ce.feedback).toContain(`You used ${shownDen + 1} on the bottom`);
          // The classic bug: citing an unreduced denominator like 10 for "3/5".
          expect(ce.feedback).not.toMatch(
            new RegExp(`denominator is (?!${shownDen}\\b)\\d+`),
          );
        }
        if (ce.misconception === "inverted_fraction") {
          expect(ce.feedback).toContain(
            `You divided ${shownDen} by ${shownNum}`,
          );
        }
      }
    }
  });
});

describe("mental-math numeric: sample answers reproduce the exact arithmetic", () => {
  it("addition sums the two operands parsed from the prompt", () => {
    for (const seed of SEEDS) {
      const q = ALL_MM_NUMERIC_GENERATORS.genAdditionNumeric(new Rng(seed));
      const m = q.prompt.match(/(\d+)\s*\+\s*(\d+)/)!;
      expect(q.answer).toBe(Number(m[1]) + Number(m[2]));
    }
  });

  it("odds→probability equals b/(a+b) for odds a:b against", () => {
    for (const seed of SEEDS) {
      const q = ALL_MM_NUMERIC_GENERATORS.genOddsToProbNumeric(new Rng(seed));
      const m = q.prompt.match(/are (\d+) : (\d+)/)!;
      const a = Number(m[1]);
      const b = Number(m[2]);
      const dp = q.decimals ?? 0;
      expect(q.answer).toBe(Number((b / (a + b)).toFixed(dp)));
    }
  });
});
