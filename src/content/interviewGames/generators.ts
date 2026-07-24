import type { Rng } from "@/lib/rng";
import type { Question, QuestionGenerator } from "@/types/content";
import { assemble, fmt, round } from "../shared";
import { mixQuestionGenerators } from "../mixFamilies";

/**
 * EV / market-making decision-game generators. These mirror the genres asked at
 * SIG/Citadel/Jane Street: optimal-stopping re-roll games and fair-value
 * pricing. Answers are exact closed forms; distractors encode the classic
 * decision errors (ignoring option value, mean vs max confusion). Kelly
 * bet-sizing moved to the exact Betting & Sizing subcategory (Probability/Math).
 */

const D = (n: number) => fmt(round(n, 4), 4);

/** Die roll with ONE optional re-roll — the canonical E=4.25 optimal-stopping game. */
function genReRollDie(rng: Rng): Question {
  const N = rng.pick([6, 8, 10, 12] as const);
  const e1 = (N + 1) / 2; // EV of a single roll
  // Optimal rule: keep first roll x iff x >= e1, else re-roll (expected e1).
  let sumMax = 0;
  for (let x = 1; x <= N; x++) sumMax += Math.max(x, e1);
  const ev = sumMax / N;

  // Distractor 1: ignore the option value entirely (just a single roll).
  const noOption = e1;
  // Distractor 2: over-optimistic — assume you always land in the "keep" set.
  const keepVals: number[] = [];
  for (let x = 1; x <= N; x++) if (x >= e1) keepVals.push(x);
  const overOptimistic =
    keepVals.reduce((a, b) => a + b, 0) / keepVals.length;
  // Distractor 3: only re-roll the single worst outcome (suboptimal threshold).
  let sumWorstOnly = e1; // re-roll x=1 → e1
  for (let x = 2; x <= N; x++) sumWorstOnly += x;
  const worstOnly = sumWorstOnly / N;

  return assemble(rng, {
    id: `ig-reroll-${N}`,
    prompt: `You roll a fair ${N}-sided die and may either keep the result or re-roll exactly once (you must keep the second roll). Playing optimally, what is the expected value of your final result?`,
    correct: D(ev),
    distractors: [D(noOption), D(overOptimistic), D(worstOnly)],
    explanation: `Keep the first roll when it beats the EV of a fresh roll, ${D(e1)}; otherwise re-roll. EV = (1/${N})·Σ max(x, ${D(e1)}) = ${D(ev)}. (For a standard 6-sided die this is the classic 4.25.)`,
    difficulty: "hard",
    concept: "Optimal stopping / option value",
    distractorRationaleByValue: {
      [D(noOption)]: "Ignored the re-roll option — just the EV of one roll.",
      [D(overOptimistic)]: "Averaged only the outcomes you'd keep, assuming you never land in the re-roll region.",
      [D(worstOnly)]: "Used a suboptimal threshold (only re-rolled the single worst outcome).",
    },
    source: "Citadel die-roll re-roll game (E=4.25)",
  });
}

/** Fair value of a uniformly random card/number draw (market-making prerequisite). */
function genFairValue(rng: Rng): Question {
  const N = rng.pick([10, 20, 50, 100] as const);
  const ev = (N + 1) / 2;
  return assemble(rng, {
    id: `ig-fair-${N}`,
    prompt: `A card is drawn uniformly at random from cards numbered 1 to ${N}, and pays its face value in dollars. If you had to name a single fair price (its expected value), what is it?`,
    correct: `$${D(ev)}`,
    distractors: [`$${D(N / 2)}`, `$${D(N)}`, `$${D((N - 1) / 2)}`],
    explanation: `EV of a uniform draw on 1..${N} is (1 + ${N}) / 2 = $${D(ev)}. A market maker would quote a tight two-sided spread around this.`,
    difficulty: "medium",
    concept: "Fair value / expectation of a uniform",
    distractorRationaleByValue: {
      [`$${D(N / 2)}`]: "Used N/2 — forgot the +1 (endpoints run 1..N, not 0..N).",
      [`$${D(N)}`]: "Named the maximum payout instead of the average.",
      [`$${D((N - 1) / 2)}`]: "Off-by-one on the average of an inclusive range.",
    },
    source: "Fair-value pricing (market making)",
  });
}

export const EV_GENERATORS: Record<string, QuestionGenerator> = {
  genReRollDie,
  genFairValue,
};

export const mixEV = (pool: QuestionGenerator[]): QuestionGenerator =>
  mixQuestionGenerators(pool);
