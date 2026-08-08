/**
 * mock/difficulty-floor.test.ts — the DIFFICULTY-FLOOR regression guard.
 *
 * THE BUG (fixed): a prior "hard rebuild" ADDED verified hard archetypes but
 * left the pre-existing freshman pool items and `medium` preset slots in place,
 * so a firm mock still drew a MIX of hard and freshman-level questions (EV of
 * two dice = 7, EV of one die = 3.5, "30,000 seats × $8" Fermi, bare 29×14
 * warm-ups). A quant does those in their sleep — they must NEVER appear.
 *
 * THIS GUARD proves the leak is closed by (a) enumerating EVERY numeric
 * generator reachable from EVERY firm-preset slot — through `presets.ts`, the
 * `questionPools.ts` pools, the pinned firm archetypes, and the `mathGate.ts`
 * warm-up pools — drawing MANY seeds and asserting NONE is a known-trivial item,
 * and (b) asserting every preset slot's declared difficulty is `hard` or
 * `stretch` (no `medium` / `easy` anywhere in a firm mock).
 *
 * It is designed to FAIL against the pre-fix code (which reached all four
 * freshman signatures + `medium` slots) and PASS after the purge.
 */
import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { buildInterview } from "./engine";
import { MOCK_PRESETS, PRESET_ORDER } from "./presets";
import {
  drawArchetype,
  drawNumericQuestion,
  type PoolDifficulty,
} from "./questionPools";
import { MOCK_GATE_POOLS } from "./mathGate";
import type { MathStep, MathTier } from "./types";

/** Many well-spread seeds so a rarely-picked leak still surfaces. */
const SEEDS = Array.from({ length: 250 }, (_, i) => i * 13 + 1);

/** Anything with a numeric answer + a prompt (gate items and pool items alike). */
interface NumericLike {
  prompt: string;
  answer: number;
  concept?: string;
  qtype?: string;
}

/** Mirror of `engine.difficultyToTier` (stretch → hard for the mental-math gate). */
function difficultyToTier(d: PoolDifficulty): MathTier {
  if (d === "easy") return "easy";
  if (d === "medium") return "medium";
  return "hard"; // hard + stretch
}

/* -------------------------------------------------------------------------- */
/*  Known-trivial detectors — the exact freshman signatures to forbid          */
/* -------------------------------------------------------------------------- */

/** "EV of the SUM of two dice" — the answer-is-7 freebie. */
function isTwoDiceSumEV(q: NumericLike): boolean {
  return (
    /expected value/i.test(q.prompt) &&
    /\btwo\b/i.test(q.prompt) &&
    /dice/i.test(q.prompt) &&
    /\bsum\b/i.test(q.prompt) &&
    Math.abs(q.answer - 7) < 1e-9
  );
}

/** "EV of one roll of a fair k-sided die" — the mean-is-(k+1)/2 freebie (3.5 for d6). */
function isSingleDieMeanEV(q: NumericLike): boolean {
  return (
    /fair\s+\d+-sided die/i.test(q.prompt) &&
    /rolled once/i.test(q.prompt) &&
    /expected value/i.test(q.prompt)
  );
}

/** A bare small N×N multiplication warm-up (both factors ≤ 2 digits, e.g. 29×14). */
function isBareSmallMultiplication(q: NumericLike): boolean {
  const m = q.prompt.match(/^\s*(\d[\d,]*)\s*[×x]\s*(\d[\d,]*)\s*=/i);
  if (!m) return false;
  const a = Number(m[1].replace(/,/g, ""));
  const b = Number(m[2].replace(/,/g, ""));
  return a < 100 && b < 100;
}

/** A "seats × per-person spend" stadium Fermi (the item the user mocked twice). */
function isSeatsPriceFermi(q: NumericLike): boolean {
  return /\b(stadium|seats)\b/i.test(q.prompt) && /(\bspend\b|\$)/i.test(q.prompt);
}

/**
 * "N numbers average X, here are all but one — find the missing one" — the DRW
 * triage main. Its intended difficulty lived in the follow-up, but as a scored
 * MAIN it is trivial back-out-the-total arithmetic a middle-schooler does. This
 * is the exact class a real candidate reported seeing in an Optiver mock.
 */
function isMissingNumberFromAverage(q: NumericLike): boolean {
  return (
    /\baverage\b|\bmean\b/i.test(q.prompt) &&
    /\b(fifth|sixth|missing|other|last|remaining)\b[^?]*\bnumber\b/i.test(q.prompt)
  );
}

/** The single trivial-reason (or null) for a numeric item. */
function trivialReason(q: NumericLike): string | null {
  if (isTwoDiceSumEV(q)) return "two-dice-sum EV (=7)";
  if (isSingleDieMeanEV(q)) return "single-die mean EV";
  if (isBareSmallMultiplication(q)) return "bare ≤2-digit × ≤2-digit multiplication warm-up";
  if (isSeatsPriceFermi(q)) return "seats × price Fermi";
  if (isMissingNumberFromAverage(q)) return "missing-number-from-average (triage main)";
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Reachability enumeration                                                   */
/* -------------------------------------------------------------------------- */

type NumericGen = (rng: Rng) => NumericLike;

/**
 * Every NUMERIC generator reachable from a firm-preset slot, resolved through
 * the SAME modules the engine uses: mental-math → `MOCK_GATE_POOLS`, pinned
 * archetypes → `drawArchetype`, and probability-ev / sequences / estimation →
 * `drawNumericQuestion`. (Market-making and brainteasers aren't scored numeric
 * warm-up/EV items and are covered structurally by the difficulty assertion.)
 */
function reachableNumericGens(): { label: string; gen: NumericGen }[] {
  const out: { label: string; gen: NumericGen }[] = [];
  for (const preset of PRESET_ORDER) {
    MOCK_PRESETS[preset].items.forEach((item, i) => {
      const tag = `${preset}#${i} ${item.kind}/${item.difficulty}`;
      if (item.kind === "mental-math") {
        for (const g of MOCK_GATE_POOLS[difficultyToTier(item.difficulty)]) {
          out.push({ label: `${tag} (gate)`, gen: (rng) => g(rng) });
        }
      } else if (
        item.kind === "probability-ev" ||
        item.kind === "sequences" ||
        item.kind === "estimation"
      ) {
        // A pinned archetype (on ANY numeric kind) draws via `drawArchetype`,
        // exactly as the engine does; otherwise draw from the difficulty pool.
        if (item.archetype) {
          const arch = item.archetype;
          out.push({ label: `${tag} archetype:${arch}`, gen: (rng) => drawArchetype(rng, arch) });
        } else {
          const kind = item.kind;
          const diff = item.difficulty;
          out.push({ label: tag, gen: (rng) => drawNumericQuestion(rng, kind, diff) });
        }
      }
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  The guard                                                                  */
/* -------------------------------------------------------------------------- */

describe("difficulty floor — the detectors actually have teeth", () => {
  it("flags every known freshman signature and passes the retained hard items", () => {
    // These MUST be caught (they are the exact leaks that were removed).
    expect(trivialReason({ prompt: "Two fair six-sided dice are rolled. What is the expected value of their sum?", answer: 7 })).toBeTruthy();
    expect(trivialReason({ prompt: "A fair 6-sided die (faces 1…6) is rolled once. What is the expected value?", answer: 3.5 })).toBeTruthy();
    expect(trivialReason({ prompt: "29 × 14 = ?", answer: 406 })).toBeTruthy();
    expect(trivialReason({ prompt: "A stadium seats about 40,000 people. If each spends ~$10, estimate total spend (in dollars).", answer: 400000 })).toBeTruthy();

    // These retained HARD items must NOT be flagged.
    expect(trivialReason({ prompt: "134 × 27 = ?", answer: 3618 })).toBeNull(); // 3-digit × 2-digit is fine
    expect(trivialReason({ prompt: "Two fair six-sided dice are rolled. What is the expected value of the LARGER of the two (the maximum)?", answer: 4.4722 })).toBeNull();
    // The "missing number from an average" triage main IS trivial and must be flagged.
    expect(trivialReason({ prompt: "Five numbers have an average of 12. Four of them are 3, 10, 7, and 11. What is the fifth number?", answer: 29 })).toBeTruthy();
    expect(trivialReason({ prompt: "450 ÷ 18 = ?", answer: 25 })).toBeNull(); // division, not small multiplication
  });
});

describe("difficulty floor — no reachable firm-mock question is freshman-trivial", () => {
  it("every generator reachable from every preset slot is non-trivial across many seeds", () => {
    const violations: string[] = [];
    let checked = 0;
    for (const { label, gen } of reachableNumericGens()) {
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed));
        checked++;
        const reason = trivialReason(q);
        if (reason) violations.push(`${label} seed ${seed}: "${q.prompt}" → ${reason}`);
      }
    }
    // Guard is not vacuous: it actually exercised a large body of items.
    expect(checked).toBeGreaterThan(500);
    expect(violations, violations.slice(0, 12).join("\n")).toHaveLength(0);
  });

  it("full preset interviews never render a trivial numeric step (many seeds)", () => {
    const violations: string[] = [];
    let mathSteps = 0;
    let mentalMathSteps = 0;
    for (const preset of PRESET_ORDER) {
      for (const seed of SEEDS) {
        const script = buildInterview({ seed, preset });
        for (const step of script.steps) {
          if (step.kind !== "math") continue;
          const s = step as MathStep;
          mathSteps++;
          if (s.qtype === "mental-math") mentalMathSteps++;
          const reason = trivialReason({
            prompt: s.prompt,
            answer: s.answer,
            concept: s.concept,
            qtype: s.qtype,
          });
          if (reason) {
            violations.push(`${preset} seed ${seed}: ${s.qtype} "${s.prompt}" → ${reason}`);
          }
        }
      }
    }
    // Sanity: we really did produce numeric steps, including the warm-up gate.
    expect(mathSteps).toBeGreaterThan(1000);
    expect(mentalMathSteps).toBeGreaterThan(0);
    expect(violations, violations.slice(0, 12).join("\n")).toHaveLength(0);
  });
});

describe("difficulty floor — every firm-preset slot is hard or stretch", () => {
  for (const preset of PRESET_ORDER) {
    it(`${preset}: no slot is declared medium/easy`, () => {
      const bad = MOCK_PRESETS[preset].items
        .map((item, i) => ({ i, ...item }))
        .filter((item) => item.difficulty !== "hard" && item.difficulty !== "stretch");
      expect(
        bad,
        bad.map((b) => `slot ${b.i} (${b.kind}) is "${b.difficulty}"`).join("\n"),
      ).toHaveLength(0);
    });
  }
});

/* -------------------------------------------------------------------------- */
/*  ALLOWLIST guard (structural) — the real fix for denylist blind spots       */
/* -------------------------------------------------------------------------- */

/**
 * The denylist above catches KNOWN freshman signatures, but it can only catch
 * what it already knows — that is exactly how the DRW "triage" main (trivial
 * "find the fifth number") slipped through. This ALLOWLIST inverts the burden:
 * every non-arithmetic generator reachable from a firm-preset slot must carry a
 * concept that has been EXPLICITLY vetted as interview-hard. Any new or
 * un-vetted generator (like the triage main was) fails the build until a human
 * adds its concept here on purpose. Arithmetic warm-ups are covered by the
 * denylist detectors above (they don't carry these concepts).
 */
const APPROVED_CONCEPTS = new Set<string>([
  "Conditional probability",
  "Geometric distribution",
  "Conditional probability (memorylessness)",
  "Optimal stopping / multi-stage EV",
  "Order statistics",
  "Gambler's ruin (martingale)",
  "Optimal stopping (bank-or-roll)",
  "Conditional probability (Monty Hall)",
  "Combinatorics",
  "Bayes' theorem (base rates)",
  "Random walks (parity)",
  "Expected waiting time (pattern overlap)",
  "Bayesian updating (unknown composition) + commitment",
  "Confidence → bet-sizing (edge)",
  "Coupon collector (expected cover time)",
  "Birthday paradox (collision probability)",
  "Derangements (inclusion–exclusion)",
  "Polynomial sequence (constant second difference)",
  "Alternating-operation sequence",
  "Cubic sequence (constant third difference)",
  "Estimation (multi-constraint decomposition)",
]);

describe("difficulty floor — every reachable generator is on the vetted-hard allowlist", () => {
  it("no un-vetted concept can reach a firm mock (allowlist, not denylist)", () => {
    const offenders = new Map<string, string>(); // concept → first example label
    let checked = 0;
    for (const { label, gen } of reachableNumericGens()) {
      if (label.includes("(gate)")) continue; // arithmetic warm-ups: denylist-covered
      for (const seed of SEEDS) {
        const q = gen(new Rng(seed)) as NumericLike;
        checked++;
        const concept = q.concept ?? "(no concept)";
        if (!APPROVED_CONCEPTS.has(concept) && !offenders.has(concept)) {
          offenders.set(concept, `${label} seed ${seed}: "${q.prompt}"`);
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
    const msg = [...offenders.entries()]
      .map(([c, ex]) => `UN-VETTED concept "${c}" — e.g. ${ex}`)
      .join("\n");
    expect(offenders.size, msg).toBe(0);
  });
});
