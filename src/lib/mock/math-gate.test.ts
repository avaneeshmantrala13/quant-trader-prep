import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { buildInterview } from "./engine";
import { PRESET_ORDER } from "./presets";
import {
  GATE_HARD,
  GATE_MEDIUM,
  MOCK_GATE_POOLS,
  NON_TRIVIAL_FRACTION_DENS,
  TRIVIAL_DECIMALS,
  gateDivision,
  gateFractionToDecimal,
  gateMultiply2x2,
  gateMultiply3x2,
  gateOddsToProb,
  gatePercent,
  reducedDenominator,
} from "./mathGate";
import {
  buildDivisionNumericInstance,
  buildFractionToDecimalNumericInstance,
  buildMultiply2x2NumericInstance,
  buildPercentNumericInstance,
  genFractionToDecimalNumeric,
  genPercentNumeric,
} from "@/content/mentalMath/generators";
import type { NumericQuestion } from "@/types/content";

/**
 * The mock arithmetic gate must NEVER hand the candidate a memorised freebie
 * (the reported bug: "Express 1/2 as a decimal"). These tests run MANY seeds
 * through the mock-scoped gate generators, the tiered pools, and the full
 * preset interviews and assert every gate item requires genuine computation —
 * while proving the SHARED lesson / Speed-Arena generators are UNCHANGED.
 */

const SEEDS = Array.from({ length: 400 }, (_, i) => i * 7 + 1);

/** A reduced fraction shown in a prompt, e.g. "3/8" → { num, den }. */
function fractionInPrompt(prompt: string): { num: number; den: number } | null {
  const m = prompt.match(/\b(\d+)\s*\/\s*(\d+)\b/);
  return m ? { num: Number(m[1]), den: Number(m[2]) } : null;
}

describe("mock gate — fraction→decimal is never a memorised freebie", () => {
  it("never yields a trivial decimal or a denominator-≤5 reduced fraction", () => {
    for (const seed of SEEDS) {
      const q = gateFractionToDecimal(new Rng(seed));
      // Answer is a genuine long-division result, not a memorised value.
      expect(TRIVIAL_DECIMALS.has(q.answer)).toBe(false);
      // Reduced denominator forces real computation.
      expect(NON_TRIVIAL_FRACTION_DENS.has(reducedDenominator(q.answer))).toBe(
        true,
      );
      // The prompt itself never shows an easy reduced fraction (1/2, 1/4, 3/5…).
      const frac = fractionInPrompt(q.prompt);
      expect(frac).not.toBeNull();
      expect(frac!.den).toBeGreaterThanOrEqual(8);
      expect([8, 16, 20, 25]).toContain(frac!.den);
    }
  });

  it("still produces the genuinely-hard values the gate is meant to test", () => {
    const seen = new Set<number>();
    for (const seed of SEEDS) seen.add(gateFractionToDecimal(new Rng(seed)).answer);
    // e.g. 3/8=0.375, 7/16=0.4375, 7/20=0.35, 9/25=0.36 are all reachable.
    expect([...seen].some((v) => reducedDenominator(v) === 8)).toBe(true);
    expect([...seen].some((v) => reducedDenominator(v) === 16)).toBe(true);
    expect([...seen].some((v) => reducedDenominator(v) === 20)).toBe(true);
    expect([...seen].some((v) => reducedDenominator(v) === 25)).toBe(true);
  });
});

describe("mock gate — percent never lands on a round/memorised value", () => {
  it("results are never multiples of 5 and never trivially tiny", () => {
    for (const seed of SEEDS) {
      const q = gatePercent(new Rng(seed));
      expect(q.answer % 5).not.toBe(0);
      expect(q.answer).toBeGreaterThanOrEqual(6);
    }
  });
});

describe("mock gate — multiplication and division require real computation", () => {
  const factors = (prompt: string): number[] =>
    (prompt.match(/(\d[\d,]*)/g) ?? []).map((s) => Number(s.replace(/,/g, "")));

  it("2×2 gate is a genuine 2-digit × 2-digit", () => {
    for (const seed of SEEDS) {
      const q = gateMultiply2x2(new Rng(seed));
      const [a, b] = factors(q.prompt);
      expect(a).toBeGreaterThanOrEqual(13);
      expect(a).toBeLessThanOrEqual(99);
      expect(b).toBeGreaterThanOrEqual(13);
      expect(b).toBeLessThanOrEqual(99);
    }
  });

  it("3×2 gate is a genuine 3-digit × 2-digit", () => {
    for (const seed of SEEDS) {
      const q = gateMultiply3x2(new Rng(seed));
      const [a, b] = factors(q.prompt);
      expect(a).toBeGreaterThanOrEqual(100);
      expect(b).toBeGreaterThanOrEqual(10);
      expect(b).toBeLessThanOrEqual(99);
    }
  });

  it("division gate is a genuine 3-digit ÷ 2-digit (exact)", () => {
    for (const seed of SEEDS) {
      const q = gateDivision(new Rng(seed));
      const [dividend, divisor] = factors(q.prompt);
      expect(dividend).toBeGreaterThanOrEqual(100);
      expect(divisor).toBeGreaterThanOrEqual(10);
      expect(divisor).toBeLessThanOrEqual(99);
      // exact division → answer × divisor === dividend
      expect(q.answer * divisor).toBe(dividend);
    }
  });
});

describe("mock gate — odds↔probability is never even odds (50% freebie)", () => {
  it("never yields a memorised probability", () => {
    for (const seed of SEEDS) {
      const q = gateOddsToProb(new Rng(seed));
      expect(TRIVIAL_DECIMALS.has(q.answer)).toBe(false);
    }
  });
});

describe("mock gate — tiered pools & seeded determinism", () => {
  it("every generator in every gate pool is non-trivial across seeds", () => {
    const trivialFraction = (q: NumericQuestion): boolean => {
      const frac = fractionInPrompt(q.prompt);
      if (frac && /decimal/i.test(q.prompt)) return frac.den <= 5;
      return false;
    };
    for (const pool of [GATE_MEDIUM, GATE_HARD]) {
      for (const gen of pool) {
        for (const seed of SEEDS.slice(0, 120)) {
          const q = gen(new Rng(seed));
          expect(trivialFraction(q)).toBe(false);
          expect(TRIVIAL_DECIMALS.has(q.answer)).toBe(false);
        }
      }
    }
  });

  it("gate draws are deterministic for a given seed", () => {
    for (const tier of ["easy", "medium", "hard"] as const) {
      const pool = MOCK_GATE_POOLS[tier];
      const a = pool.map((g) => g(new Rng(42)));
      const b = pool.map((g) => g(new Rng(42)));
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });
});

describe("mock gate — full preset interviews never render a freebie", () => {
  it("Optiver / Jane Street / SIG mental-math steps are always non-trivial", () => {
    let sawGate = false;
    for (const preset of PRESET_ORDER) {
      for (const seed of SEEDS.slice(0, 150)) {
        const script = buildInterview({ seed, preset });
        for (const step of script.steps) {
          if (step.kind !== "math" || step.qtype !== "mental-math") continue;
          sawGate = true;
          // Reproduces the reported bug directly: no "Express 1/2 as a decimal".
          if (/decimal/i.test(step.prompt)) {
            const frac = fractionInPrompt(step.prompt);
            expect(frac).not.toBeNull();
            expect(frac!.den).toBeGreaterThanOrEqual(8);
            expect(TRIVIAL_DECIMALS.has(step.answer)).toBe(false);
            expect(
              NON_TRIVIAL_FRACTION_DENS.has(reducedDenominator(step.answer)),
            ).toBe(true);
          }
          if (step.prompt.includes("%")) {
            expect(step.answer % 5).not.toBe(0);
          }
        }
      }
    }
    // Optiver + Jane Street both carry a sprint gate (SIG has none).
    expect(sawGate).toBe(true);
  });
});

describe("shared lesson / Speed-Arena generators are UNCHANGED", () => {
  it("omitting the optional param reproduces the original default behaviour exactly", () => {
    for (const seed of [1, 2, 3, 17, 99, 12345]) {
      expect(buildFractionToDecimalNumericInstance(new Rng(seed), "medium")).toEqual(
        buildFractionToDecimalNumericInstance(new Rng(seed), "medium", {
          dens: [4, 5, 8, 10, 16, 20, 25],
        }),
      );
      expect(buildPercentNumericInstance(new Rng(seed), "easy")).toEqual(
        buildPercentNumericInstance(new Rng(seed), "easy", {
          ps: [5, 10, 12, 15, 20, 25, 30, 40, 75],
        }),
      );
      expect(buildDivisionNumericInstance(new Rng(seed), "medium")).toEqual(
        buildDivisionNumericInstance(new Rng(seed), "medium", {
          divisor: [3, 19],
          quotient: [11, 89],
        }),
      );
      expect(buildMultiply2x2NumericInstance(new Rng(seed), "medium")).toEqual(
        buildMultiply2x2NumericInstance(new Rng(seed), "medium", {
          aRange: [13, 49],
          bRange: [13, 49],
        }),
      );
    }
  });

  it("the shared fraction pool STILL teaches easy fractions (it was not hardened)", () => {
    // If the shared generator were accidentally restricted, this would fail —
    // lessons and the Speed Arena legitimately include 1/2, 1/4, 1/5, etc.
    const easy = SEEDS.some((seed) => {
      const q = genFractionToDecimalNumeric(new Rng(seed));
      return TRIVIAL_DECIMALS.has(q.answer);
    });
    expect(easy).toBe(true);
  });

  it("the shared percent pool STILL includes round/memorised results", () => {
    const round = SEEDS.some((seed) => genPercentNumeric(new Rng(seed)).answer % 5 === 0);
    expect(round).toBe(true);
  });
});
