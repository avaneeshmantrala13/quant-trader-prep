/**
 * lib/evTimed/pool.ts — the curated EV-under-time question pool.
 *
 * This is a THIN, READ-ONLY curation layer over the project's existing,
 * exact-verified EV / fair-value / optimal-stopping generators. We DO NOT define
 * or modify any generator here — every entry just references a generator that
 * already lives in the content layer:
 *
 *  - `genReRollDie`, `genFairValue` — `@/content/interviewGames/generators`
 *    (`EV_GENERATORS`): the canonical die re-roll optimal-stopping game and
 *    uniform fair-value pricing question.
 *  - `genWalkReach`, `genWald`, `genMartingaleDoubling`
 *    — `@/content/probabilityStats/expectedValue/generators`: random-walk /
 *    martingale expected-value MCQs.
 *
 * All are `QuestionGenerator`s (`(rng: Rng) => Question`) producing 4-choice
 * MCQs, which is exactly what an "under a clock, DECIDE" drill needs. Each entry
 * pairs a generator with a per-question TIME BUDGET (ms) tuned to the item's
 * difficulty; the pure engine scores correctness against that budget.
 */
import type { QuestionGenerator } from "@/types/content";
import { EV_GENERATORS } from "@/content/interviewGames/generators";
import {
  genMartingaleDoubling,
  genWalkReach,
  genWald,
} from "@/content/probabilityStats/expectedValue/generators";

/** One curated slot: a reference to an existing generator + its time budget. */
export interface EvTimedPoolEntry {
  /** Stable slot id (independent of the seeded item id the generator stamps). */
  readonly id: string;
  /** Human label for the concept, shown on the drill card. */
  readonly label: string;
  /** The EXISTING generator this slot draws from (never modified here). */
  readonly generator: QuestionGenerator;
  /** Per-question countdown budget in milliseconds. */
  readonly budgetMs: number;
}

const SEC = 1000;

/**
 * The default curated pool. Ordered easiest → hardest; budgets shrink as the
 * decision gets simpler and grow for the multi-step optimal-stopping / walk
 * problems. Kept as a frozen array so no consumer can mutate the shared pool.
 */
export const EV_TIMED_POOL: readonly EvTimedPoolEntry[] = Object.freeze([
  {
    id: "fair-value",
    label: "Fair value of a uniform draw",
    generator: EV_GENERATORS.genFairValue,
    budgetMs: 40 * SEC,
  },
  {
    id: "walk-reach",
    label: "Random-walk reach probability",
    generator: genWalkReach,
    budgetMs: 50 * SEC,
  },
  {
    id: "wald",
    label: "Wald / stopped-sum expectation",
    generator: genWald,
    budgetMs: 55 * SEC,
  },
  {
    id: "martingale-doubling",
    label: "Martingale doubling expectation",
    generator: genMartingaleDoubling,
    budgetMs: 55 * SEC,
  },
  {
    id: "reroll-die",
    label: "Optimal stopping: die re-roll",
    generator: EV_GENERATORS.genReRollDie,
    budgetMs: 60 * SEC,
  },
]);

/** Fallback per-question budget when a pool is empty / a slot lacks one. */
export const DEFAULT_BUDGET_MS = 45 * SEC;
