import type { NumericQuestion, Question } from "@/types/content";
import { numericMatches } from "@/lib/numeric";
import { misconceptionKey } from "@/lib/mastery/topicKey";

/**
 * Misconception resolution + the confront taxonomy (PHASE_2 §5, COORDINATION
 * §2.4). Phase 1 shipped only `misconceptionKey(topicKey, tag)`; Phase 2 owns
 * turning a wrong PRIMARY answer into the resolved, namespaced key(s) that
 * `recordItemAttempt` folds, and mapping a misconception TAG to the deterministic
 * "confront" representation (Fischbein & Schnarch 1997; RESEARCH_TUTORING §2.4).
 *
 * A TAG is the authored `Question.misconceptions[i]` / `commonErrors[].
 * misconception` when present, else the deterministic fallback `idx:<i>` (quiz)
 * / `err:<value>` (numeric) — so misconception tracking works even before a
 * topic is tagged. A KEY is the namespaced `misconceptionKey(topicKey, tag)`.
 */

/** The deterministic confront strategy a misconception maps to. */
export type ConfrontKind =
  | "nf-tree" // Bayesian: natural-frequency tree (Gigerenzer & Hoffrage 1995)
  | "coin-sim" // gambler's fallacy: independent-trial coin simulation
  | "dice-sim" // outcome approach: repeated-trials simulation
  | "nested-set" // conjunction fallacy: the "and" set is a subset (count it)
  | "none"; // no special confront — generic elicit/enumerate nudge

/**
 * Canonical misconception tags used across Phases 2–4. Authored content should
 * prefer these so the confront mapping and the dashboard read consistently.
 */
export const MISCONCEPTION = {
  reversedConditional: "reversed_conditional",
  baseRateNeglect: "base_rate_neglect",
  likelihoodAsPosterior: "likelihood_as_posterior",
  orderedVsUnordered: "ordered_vs_unordered",
  facesNotObjects: "faces_not_objects",
  gamblersFallacy: "gamblers_fallacy",
  conjunctionFallacy: "conjunction_fallacy",
  outcomeApproach: "outcome_approach",
  memorylessUniform: "memoryless_uniform",
  equalWeightMixture: "equal_weight_mixture",
} as const;

/** tag → confront strategy (PHASE_2 §5 "Misconception → confront mapping"). */
export const CONFRONT_BY_TAG: Record<string, ConfrontKind> = {
  [MISCONCEPTION.reversedConditional]: "nf-tree",
  [MISCONCEPTION.baseRateNeglect]: "nf-tree",
  [MISCONCEPTION.likelihoodAsPosterior]: "nf-tree",
  [MISCONCEPTION.gamblersFallacy]: "coin-sim",
  [MISCONCEPTION.outcomeApproach]: "dice-sim",
  [MISCONCEPTION.conjunctionFallacy]: "nested-set",
};

/** The confront strategy for a tag (defaults to `"none"`). */
export function confrontForTag(tag: string | undefined): ConfrontKind {
  if (!tag) return "none";
  return CONFRONT_BY_TAG[tag] ?? "none";
}

/* -------------------------------------------------------------------------- */
/*  Tag resolution (authored tag → else deterministic fallback)               */
/* -------------------------------------------------------------------------- */

/** A non-empty authored tag, else `undefined` (empty strings are placeholders). */
function authored(tag: string | undefined): string | undefined {
  return tag && tag.trim().length > 0 ? tag : undefined;
}

/** The tag a wrong quiz choice trips: authored `misconceptions[i]` or `idx:<i>`. */
export function resolveQuizTag(question: Question, chosenIndex: number): string {
  return authored(question.misconceptions?.[chosenIndex]) ?? `idx:${chosenIndex}`;
}

/** The matching `commonErrors` entry for a wrong numeric value (decimals-aware). */
export function matchNumericError(
  question: NumericQuestion,
  value: number,
): { value: number; feedback: string; misconception?: string } | undefined {
  return question.commonErrors?.find((e) =>
    question.decimals == null
      ? e.value === value
      : Math.round(e.value * 10 ** question.decimals) ===
        Math.round(value * 10 ** question.decimals),
  );
}

/** The tag a wrong numeric value trips: authored `misconception` or `err:<v>`. */
export function resolveNumericTag(
  question: NumericQuestion,
  value: number,
): string {
  return authored(matchNumericError(question, value)?.misconception) ?? `err:${value}`;
}

/* -------------------------------------------------------------------------- */
/*  Namespaced key resolution (fed to recordItemAttempt)                       */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the namespaced misconception key(s) a QUIZ attempt tripped. Returns
 * `[]` for a correct answer (the fold decays stale flags on a correct item).
 */
export function resolveQuizMisconceptionKeys(
  topicKey: string,
  question: Question,
  chosenIndex: number,
): string[] {
  if (chosenIndex === question.correctIndex) return [];
  return [misconceptionKey(topicKey, resolveQuizTag(question, chosenIndex))];
}

/**
 * Resolve the namespaced misconception key(s) a NUMERIC attempt tripped. Returns
 * `[]` for a correct answer.
 */
export function resolveNumericMisconceptionKeys(
  topicKey: string,
  question: NumericQuestion,
  value: number,
): string[] {
  if (numericMatches(question, value)) return [];
  return [misconceptionKey(topicKey, resolveNumericTag(question, value))];
}
