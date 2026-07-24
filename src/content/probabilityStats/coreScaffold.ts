import type { Rng } from "@/lib/rng";
import type {
  NumericQuestionGenerator,
  Question,
  QuestionGenerator,
} from "@/types/content";
import type FractionType from "fraction.js";
import { exactDecimals } from "./coreSolvers";
import { mixNumericGenerators, mixQuestionGenerators } from "../mixFamilies";

/**
 * Shared generator scaffolding for the re-homed Probability & Statistics topics
 * (formerly the "General" subcategory). Mirrors the helpers baked into the
 * sibling subcategories' `generators.ts` (assemble/shuffle MC choices, dedupe
 * numeric commonErrors, mix pools) so every re-homed generator file stays
 * consistent.
 *
 * Every distractor produced through these helpers must be a re-derived, NAMED
 * misconception — guaranteed distinct and ≠ the answer (asserted in the tests).
 */

export interface Choice {
  text: string;
  rationale: string;
}

/** Assemble + shuffle MC choices so the answer position never leaks. */
export function assembleChoices(
  rng: Rng,
  correct: Choice,
  distractors: Choice[],
): Pick<Question, "choices" | "correctIndex" | "distractorRationale"> {
  const chosen: Choice[] = [correct];
  const seen = new Set<string>([correct.text]);
  for (const d of distractors) {
    if (seen.has(d.text)) continue;
    seen.add(d.text);
    chosen.push(d);
    if (chosen.length >= 4) break;
  }
  const order = rng.shuffle(chosen.map((_, i) => i));
  const shuffled = order.map((i) => chosen[i]);
  return {
    choices: shuffled.map((c) => c.text),
    correctIndex: order.indexOf(0),
    distractorRationale: shuffled.map((c) => c.rationale),
  };
}

/** Deduping accumulator for `numeric` commonErrors (rounded to `dp`, ≠ answer). */
export function numericErrors(
  answer: number,
  dp: number,
): {
  errors: { value: number; feedback: string }[];
  push: (raw: FractionType | number, feedback: string) => void;
} {
  const f = 10 ** dp;
  const seen = new Set<number>([Math.round(answer * f)]);
  const errors: { value: number; feedback: string }[] = [];
  const push = (raw: FractionType | number, feedback: string) => {
    const v = typeof raw === "number" ? raw : raw.valueOf();
    if (!Number.isFinite(v)) return;
    const rounded = Math.round(v * f) / f;
    const k = Math.round(rounded * f);
    if (seen.has(k)) return;
    seen.add(k);
    errors.push({ value: rounded, feedback });
  };
  return { errors, push };
}

/** Decimals for a numeric answer (exact if terminating within `cap`, else `cap`). */
export function numDp(f: FractionType, min = 2, cap = 4): number {
  return Math.max(min, exactDecimals(f, cap));
}

/**
 * Combine several Question generators into one that picks per call — now via the
 * shared family-tagging mixer, so each item is stamped with its family and the
 * result exposes a `.families` lookup for family-preserving regeneration.
 */
export const mixQuiz = (pool: QuestionGenerator[]): QuestionGenerator =>
  mixQuestionGenerators(pool);

/** Combine several numeric generators into one that picks per call (family-tagged). */
export const mixNumeric = (
  pool: NumericQuestionGenerator[],
): NumericQuestionGenerator => mixNumericGenerators(pool);

/** Capitalise the first letter (for theme actors at sentence start). */
export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
