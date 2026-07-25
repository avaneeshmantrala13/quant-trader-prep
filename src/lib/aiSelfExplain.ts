/**
 * aiSelfExplain.ts — OPTIONAL free-text "explain your reasoning" grading via
 * DECOMPOSE-THEN-VERIFY (PHASE_7 §3/§5).
 *
 * The reliability split (RESEARCH_ML_USAGE.md §1.9): LLMs are only ~56% reliable
 * as math tutors and can't reliably locate the erroneous step, so the LLM MUST
 * NOT decide correctness. Instead a deterministic pre-pass (`decomposeChecks`)
 * runs the item's structural reasoning checks against the learner's free text and
 * produces the verdict `{correct, failedCheck}`. Only THEN — and only if the AI
 * layer is on — does the LLM narrate encouragement/elaboration AROUND that fixed
 * verdict. The LLM can never flip `correct` or change `failedCheck`.
 *
 * With the flag off — the DEFAULT — `gradeSelfExplanation` returns the verifier's
 * `{correct, failedCheck}` with NO narration: fully functional, zero LLM.
 *
 * NOTE: this grades the OPTIONAL free-text box. The primary self-explanation path
 * remains the deterministic `buildSelfExplainMCQ` (Phase 2) and the item's own
 * quiz/numeric verifier — neither is affected by anything here.
 */
import type { NumericQuestion, Question } from "@/types/content";
import { formatNumericAnswer } from "./numeric";
import { containsFinalAnswer } from "./tutor/answerWithholding";
import { readAiConfig } from "./aiConfig";
import { env, extractNumbers, postAi } from "./aiFlavor";

/** The result of grading a free-text explanation. */
export interface SelfExplainGrade {
  /** Decided by the VERIFIER (`decomposeChecks`), NEVER the LLM. */
  correct: boolean;
  /** Which structural check failed first (deterministic); absent when correct. */
  failedCheck?: string;
  /** LLM prose ONLY; advisory; absent when the flag is off / no narration returned. */
  narration?: string;
}

/** Stable identifiers for the structural checks (surfaced as `failedCheck`). */
export const SELF_EXPLAIN_CHECKS = {
  /** The explanation must engage the given quantities, not just guess a number. */
  referencesSetup: "references-the-setup",
  /** The explanation must arrive at the verifier's correct result. */
  reachesResult: "reaches-correct-result",
} as const;

function isQuiz(q: Question | NumericQuestion): q is Question {
  return "choices" in q;
}

/** The item's final answer (quiz choice or numeric value) — the verifier's truth. */
function finalAnswerOf(q: Question | NumericQuestion): number | string {
  return isQuiz(q) ? q.choices[q.correctIndex] : q.answer;
}

/** A human/LLM-facing answer string (numeric items honor `decimals`). */
function answerText(q: Question | NumericQuestion): string {
  return isQuiz(q) ? q.choices[q.correctIndex] : formatNumericAnswer(q);
}

/**
 * The tolerance for the numeric answer-match check: numeric items with a
 * `decimals` precision allow the learner's rounded value; everything else is
 * exact. Mirrors the grading precision so the free-text check agrees with the
 * item's own verifier.
 */
function answerTolerance(q: Question | NumericQuestion): number {
  if (!isQuiz(q) && q.decimals != null) return 0.5 * 10 ** -q.decimals;
  return 0;
}

/**
 * DETERMINISTIC pre-pass. Runs the item's structural reasoning checks against the
 * learner's free text and returns the verdict. This decision is the VERIFIER's —
 * the LLM never participates. Checks, in order (the first failure is reported):
 *
 *   1. `references-the-setup` — the explanation engages the given quantities (at
 *      least one distinct number from the prompt appears in the free text; when
 *      the prompt has no numbers this passes vacuously). This is the
 *      deterministic proxy for "showed the reasoning" vs. "guessed a number".
 *   2. `reaches-correct-result` — the free text states the verifier's correct
 *      answer (`containsFinalAnswer`, decimals-aware tolerance).
 *
 * `correct` is true iff BOTH pass. Pure & side-effect-free (unit tested).
 */
export function decomposeChecks(
  question: Question | NumericQuestion,
  freeText: string,
): { correct: boolean; failedCheck?: string } {
  const text = (freeText ?? "").trim();

  // Check 1 — did they engage the setup quantities at all (vs. a bare guess)?
  const required = new Set(extractNumbers(question.prompt));
  const present = new Set(extractNumbers(text));
  const referencesSetup =
    required.size === 0 || [...required].some((n) => present.has(n));
  if (!referencesSetup) {
    return { correct: false, failedCheck: SELF_EXPLAIN_CHECKS.referencesSetup };
  }

  // Check 2 — did they reach the verifier's correct result?
  const reachesResult = containsFinalAnswer(
    text,
    finalAnswerOf(question),
    answerTolerance(question),
  );
  if (!reachesResult) {
    return { correct: false, failedCheck: SELF_EXPLAIN_CHECKS.reachesResult };
  }

  return { correct: true };
}

/**
 * Merge an LLM narration payload onto a FIXED verifier verdict. The verdict's
 * `correct`/`failedCheck` are taken verbatim from `verdict`; ONLY a string
 * `narration` is lifted off the payload. Any `correct`/`failedCheck` the model
 * tries to return is IGNORED — this is the guardrail that makes it structurally
 * impossible for the LLM to flip correctness. Pure (unit tested).
 */
export function mergeNarration(
  verdict: { correct: boolean; failedCheck?: string },
  payload: Record<string, unknown> | null,
): SelfExplainGrade {
  const narration =
    payload &&
    typeof payload["narration"] === "string" &&
    (payload["narration"] as string).trim().length > 0
      ? (payload["narration"] as string)
      : undefined;
  return {
    correct: verdict.correct,
    ...(verdict.failedCheck ? { failedCheck: verdict.failedCheck } : {}),
    ...(narration ? { narration } : {}),
  };
}

export interface SelfExplainOptions {
  signal?: AbortSignal;
}

/**
 * Grade a free-text explanation. The verifier (`decomposeChecks`) decides
 * `correct` + `failedCheck`; then, ONLY if the AI layer is on, the LLM narrates
 * around that fixed verdict. Returns the verifier verdict with NO narration when
 * the flag is off / unconfigured / stubbed, or when the request yields nothing —
 * fully functional without the LLM. The LLM can NEVER flip `correct`.
 */
export async function gradeSelfExplanation(
  question: Question | NumericQuestion,
  freeText: string,
  opts: SelfExplainOptions = {},
): Promise<SelfExplainGrade> {
  const verdict = decomposeChecks(question, freeText);

  const e = env();
  const cfg = readAiConfig(e);
  // Flag off / unconfigured / stub → verifier verdict only, no narration.
  if (!cfg || cfg.stub) return mergeNarration(verdict, null);

  const payload = await postAi(
    cfg,
    e,
    {
      mode: "self-explain",
      // The LLM narrates around the verifier's FIXED result. It is told the
      // correctness + failed check; it does not (and cannot) decide them.
      prompt: question.prompt,
      answer: answerText(question),
      correct: verdict.correct,
      failedCheck: verdict.failedCheck ?? null,
      explanation: freeText,
    },
    opts.signal,
  );

  // The verdict is fixed; only a narration string is ever taken from the model.
  return mergeNarration(verdict, payload);
}
