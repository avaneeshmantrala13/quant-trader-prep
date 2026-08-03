import { Rng } from "@/lib/rng";
import type { NumericQuestion, Question } from "@/types/content";
import { gradeFreeResponse, type NumericGrade } from "@/lib/numeric";
import {
  ARBITRAGE_NUMERIC_GENERATORS,
  ARBITRAGE_QUIZ_GENERATORS,
} from "@/content/arbitrage/generators";

/**
 * Pure session model for the self-contained Arbitrage drill page (`/arbitrage`).
 * It draws a DETERMINISTIC, interleaved battery of quiz + numeric items from the
 * arbitrage generators and grades responses — no React, no globals, so every bit
 * of drill logic is unit-testable. The page is a thin renderer over this.
 *
 * Determinism contract: `buildArbitrageDrill(seed, count)` builds ONE `Rng(seed)`,
 * shuffles the tagged generator pool with it, then draws `count` items by cycling
 * the shuffled pool and calling each generator with that SAME rng. Ids are forced
 * unique (`arb-drill-${seed}-${i}`) so reusing a generator never collides.
 */

/** A single drawn drill item, tagged by play mode. */
export type DrillItem =
  | { kind: "quiz"; id: string; family: string; question: Question }
  | { kind: "numeric"; id: string; family: string; question: NumericQuestion };

type TaggedGen =
  | { kind: "quiz"; family: string; gen: (rng: Rng) => Question }
  | { kind: "numeric"; family: string; gen: (rng: Rng) => NumericQuestion };

/** The full interleaved generator pool (quiz + numeric) backing the drill. */
export const ARBITRAGE_DRILL_POOL: TaggedGen[] = [
  ...Object.entries(ARBITRAGE_QUIZ_GENERATORS).map(
    ([family, gen]): TaggedGen => ({ kind: "quiz", family, gen }),
  ),
  ...Object.entries(ARBITRAGE_NUMERIC_GENERATORS).map(
    ([family, gen]): TaggedGen => ({ kind: "numeric", family, gen }),
  ),
];

/**
 * Draw exactly `count` interleaved drill items reproducibly from `seed`. Same
 * `(seed, count)` ⇒ identical items (ids, prompts, answers).
 */
export function buildArbitrageDrill(seed: number, count: number): DrillItem[] {
  const rng = new Rng(seed);
  const pool = rng.shuffle(ARBITRAGE_DRILL_POOL);
  const out: DrillItem[] = [];
  if (pool.length === 0) return out;
  for (let i = 0; i < count; i++) {
    const tagged = pool[i % pool.length];
    const id = `arb-drill-${seed}-${i}`;
    if (tagged.kind === "quiz") {
      out.push({ kind: "quiz", id, family: tagged.family, question: tagged.gen(rng) });
    } else {
      out.push({ kind: "numeric", id, family: tagged.family, question: tagged.gen(rng) });
    }
  }
  return out;
}

/** Grade a quiz selection: correct iff the chosen index is the key. */
export function gradeQuizItem(
  item: Extract<DrillItem, { kind: "quiz" }>,
  chosenIndex: number,
): { correct: boolean } {
  return { correct: chosenIndex === item.question.correctIndex };
}

/** Grade a numeric free-entry against the item (fractions / % / decimals ok). */
export function gradeNumericItem(
  item: Extract<DrillItem, { kind: "numeric" }>,
  raw: string,
): NumericGrade {
  return gradeFreeResponse(item.question, raw);
}

export interface DrillScore {
  answered: number;
  correct: number;
  total: number;
  /** Percentage 0–100 of answered items that were correct. */
  pct: number;
}

/** Tally a run: `responses[i]` is the correctness recorded for item i (or null). */
export function scoreDrill(responses: (boolean | null)[], total: number): DrillScore {
  const answered = responses.filter((r) => r !== null).length;
  const correct = responses.filter((r) => r === true).length;
  return {
    answered,
    correct,
    total,
    pct: total > 0 ? Math.round((correct / total) * 100) : 0,
  };
}
