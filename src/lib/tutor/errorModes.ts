import type { NumericQuestion } from "@/types/content";

/**
 * Parametric ERROR-MODE framework (PHASE_1 — the heart of hint rung 1).
 *
 * Our free-response questions are PARAMETRIC (generators + exact solvers), so the
 * "top mistakes" can't be a static list of wrong values — they must be small
 * SOLVERS that compute the WRONG value for ANY parameterization of a family
 * (e.g. "added instead of multiplied", "used n instead of n−1", "forgot to
 * divide by 2", "confused P(A|B) with P(B|A)"). Each mode is keyed to a
 * machine-readable misconception id + an encouraging rung-1 COACHING sentence
 * that names the mistake and asks a leading question WITHOUT revealing the
 * answer (Van der Kleij/Shute elaborated, answer-withholding feedback).
 *
 * A per-family CATALOG (`ErrorModeCatalog<P>`) is authored in content (Phase 2).
 * At GENERATION time a generator calls `buildCommonErrors(catalog, params,
 * correct)` to emit the instance's `NumericQuestion.commonErrors` — so the exact
 * wrong values are computed from the SAME params/solver as the correct answer
 * and can never drift. At GRADE time the existing `gradeNumeric` /
 * `matchNumericError` matches the learner's entry against those values, or you
 * can match a catalog directly with `matchErrorMode` here.
 *
 * Collision handling (both build- and match-time):
 *  - a mode whose value equals the CORRECT answer (within tolerance) is dropped
 *    (it isn't a distractor);
 *  - if two modes compute the SAME value, the FIRST in catalog order wins
 *    (deterministic; later duplicates are dropped) so grading is unambiguous.
 */

/** One parametric error mode for a question family, over params `P`. */
export interface ErrorModeSpec<P> {
  /** Stable id within the family (e.g. "added_instead_of_multiplied"). */
  id: string;
  /** Canonical misconception tag (prefer `MISCONCEPTION.*` from `misconception.ts`). */
  misconception: string;
  /**
   * Compute the WRONG value this mode produces for these params. Return `null`
   * when the mode does not apply to this particular instance (e.g. a "forgot to
   * divide by 2" mode when the divisor happens to be 1).
   */
  compute: (params: P) => number | null;
  /**
   * Rung-1 coaching sentence: names the specific mistake and asks a leading
   * question. MUST NOT state the correct answer. May be a function of the params
   * for family-specific phrasing.
   */
  coach: string | ((params: P) => string);
}

/** A per-family catalog of parametric error modes, tried in order. */
export type ErrorModeCatalog<P> = ErrorModeSpec<P>[];

/** The concrete `commonErrors` entry shape (mirrors `NumericQuestion.commonErrors[number]`). */
export type CommonError = NonNullable<NumericQuestion["commonErrors"]>[number];

/** Rounded-compare helper mirroring `numeric.ts` decimals semantics. */
function sameValue(a: number, b: number, decimals?: number): boolean {
  if (decimals == null) return a === b;
  const f = 10 ** decimals;
  return Math.round(a * f) === Math.round(b * f);
}

function coachText<P>(spec: ErrorModeSpec<P>, params: P): string {
  return typeof spec.coach === "function" ? spec.coach(params) : spec.coach;
}

/**
 * Build the instance's `commonErrors` from a catalog + params + the exact
 * correct value. Drops modes that don't apply (`compute` → null), collide with
 * the correct answer, or duplicate an earlier mode's value. `decimals` controls
 * the rounded compare (matches `NumericQuestion.decimals`).
 */
export function buildCommonErrors<P>(
  catalog: ErrorModeCatalog<P>,
  params: P,
  correct: number,
  opts: { decimals?: number } = {},
): CommonError[] {
  const { decimals } = opts;
  const out: CommonError[] = [];
  const seen: number[] = [];
  for (const spec of catalog) {
    const value = spec.compute(params);
    if (value == null || !Number.isFinite(value)) continue;
    if (sameValue(value, correct, decimals)) continue; // not a distractor
    if (seen.some((v) => sameValue(v, value, decimals))) continue; // collision
    seen.push(value);
    out.push({
      value,
      feedback: coachText(spec, params),
      misconception: spec.misconception,
    });
  }
  return out;
}

/** The result of matching a learner's entry against a family catalog. */
export interface ErrorModeMatch {
  id: string;
  misconception: string;
  coaching: string;
  value: number;
}

/**
 * Match a learner's `entry` against a catalog for these `params`, honoring the
 * same collision rules as `buildCommonErrors`. Returns the matched mode (with
 * its resolved coaching sentence) or `undefined` when the entry matches no known
 * mode (the caller then falls back to the generic rung-1 nudge). The correct
 * value is passed so a mode colliding with it is never reported as an "error".
 */
export function matchErrorMode<P>(
  catalog: ErrorModeCatalog<P>,
  params: P,
  correct: number,
  entry: number,
  opts: { decimals?: number } = {},
): ErrorModeMatch | undefined {
  const { decimals } = opts;
  if (sameValue(entry, correct, decimals)) return undefined;
  const seen: number[] = [];
  for (const spec of catalog) {
    const value = spec.compute(params);
    if (value == null || !Number.isFinite(value)) continue;
    if (sameValue(value, correct, decimals)) continue;
    if (seen.some((v) => sameValue(v, value, decimals))) continue;
    seen.push(value);
    if (sameValue(value, entry, decimals)) {
      return {
        id: spec.id,
        misconception: spec.misconception,
        coaching: coachText(spec, params),
        value,
      };
    }
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/*  Unaccounted-error fallback (rung-1 nudge when NO known mode matched)        */
/* -------------------------------------------------------------------------- */

/**
 * Coarse topic families we can offer a CHEAP, honest self-check for. Derived
 * from the item's `section`/`family` strings (both human-readable), so no new
 * data plumbing is needed. `"generic"` is always a safe default.
 */
export type FallbackTopic =
  | "probability"
  | "combinatorics"
  | "expected-value"
  | "variance-stats"
  | "mental-math"
  | "generic";

/**
 * A METHOD-FREE, topic-flavoured re-check nudge. Deliberately states NO
 * operational rule (no "multiply for AND", "order matters", "probability ×
 * value", …): rung 1 must only prompt the learner to re-examine their own work,
 * never hand them the method. Each entry re-reads the step, the question, and the
 * representation without naming any operation.
 */
const SELF_CHECK_BY_TOPIC: Record<FallbackTopic, string> = {
  probability:
    "re-check each arithmetic step, re-read exactly what the wording is asking you to find, and verify your units and representation (fraction vs. decimal vs. percent)",
  combinatorics:
    "re-check each arithmetic step, re-read exactly what is being counted, and verify your units and representation",
  "expected-value":
    "re-check each arithmetic step, re-read exactly which quantity the question is asking for, and verify your units and representation",
  "variance-stats":
    "re-check each arithmetic step, re-read exactly which quantity the question is asking for, and verify your units and representation",
  "mental-math":
    "re-check each arithmetic step for a dropped carry or a place-value slip, re-read which quantity is asked for, and verify your units and representation",
  generic:
    "re-check each arithmetic step, re-read exactly what the question is asking for, and verify your units and representation (fraction vs. decimal vs. percent)",
};

/** Classify an item into a `FallbackTopic` from its `section`/`family` text. */
export function classifyFallbackTopic(opts: {
  section?: string;
  family?: string;
}): FallbackTopic {
  const hay = `${opts.section ?? ""} ${opts.family ?? ""}`.toLowerCase();
  if (!hay.trim()) return "generic";
  // Order matters: check the most specific keywords first.
  if (/expected\s*value|\bev\b/.test(hay)) return "expected-value";
  if (/variance|covariance|\bclt\b|std|standard\s*deviation|distribution/.test(hay))
    return "variance-stats";
  if (/combinator|counting|arrangement|permut|combinat|choose/.test(hay))
    return "combinatorics";
  if (/probab|conditional|bayes|complement/.test(hay)) return "probability";
  if (/mental|arithmetic|zetamac|optiver|sprint/.test(hay)) return "mental-math";
  return "generic";
}

/**
 * The HONEST generic rung-1 nudge shown when a wrong free-response answer
 * matches NO known parametric error mode (`matchErrorMode` → `undefined`).
 *
 * Unlike a "you tripped a common trap" message, this MUST NOT fabricate or claim
 * a specific misconception (we genuinely don't know which mistake was made), and
 * — per the rung-1 "name-only" contract — it MUST NOT reveal any solution method
 * (no "multiply for AND", "order matters", "probability × value", …). It:
 *  (a) honestly acknowledges the answer isn't right without inventing a cause;
 *  (b) offers a METHOD-FREE, topic-flavoured re-check nudge (re-check the steps,
 *      re-read the question, verify units/representation) via `section`/`family`;
 *  (c) invites the learner to fix it and try again, or advance the hint ladder.
 *
 * Pure and deterministic; callers (e.g. the hint ladder) can substitute this for
 * the old generic name-trap string.
 */
export function genericFallbackCoaching(
  opts: { section?: string; family?: string } = {},
): string {
  const topic = classifyFallbackTopic(opts);
  const selfCheck = SELF_CHECK_BY_TOPIC[topic];
  return (
    `That's not the right answer yet — and it doesn't line up with any of the ` +
    `usual mistakes for this question, so I won't guess at what went wrong. ` +
    `Best next move: ${selfCheck}. ` +
    `Then adjust your answer and try again, or tap for the next hint.`
  );
}

/* -------------------------------------------------------------------------- */
/*  Answer-DOMAIN inference (rung-1 absurdity / out-of-domain pointer)          */
/* -------------------------------------------------------------------------- */

/**
 * The valid RANGE a quantity's answer must live in, inferred CONSERVATIVELY from
 * metadata already in scope (section/family topic, unit, decimals, the correct
 * answer). `kind === "real"` is the safe default — it is NEVER out of domain, so
 * we only assert a stricter domain when we are confident. `label` is a short
 * human phrase used by the pointer message (e.g. "[0, 1]", "variance or standard
 * deviation", "dollar stake").
 */
export type AnswerDomain = {
  kind: "probability" | "count" | "nonneg" | "real";
  label: string;
};

/**
 * Infer the answer's valid domain from what the item already carries. Be
 * conservative: assert only a domain we are confident about, else fall back to
 * `"real"` (never absurd). See the per-branch heuristics inline.
 */
export function inferAnswerDomain(opts: {
  section?: string;
  family?: string;
  unit?: string;
  decimals?: number;
  answer: number;
}): AnswerDomain {
  const { section, family, unit, decimals, answer } = opts;
  const topic = classifyFallbackTopic({ section, family });
  const unitless = unit === "" || unit == null;

  // Probability: a probability-topic item with no unit whose correct value sits
  // inside [0, 1]. (classifyFallbackTopic already folds conditional/Bayes here.)
  if (topic === "probability" && unitless && answer >= 0 && answer <= 1) {
    return { kind: "probability", label: "[0, 1]" };
  }
  // Variance / standard deviation: a non-negative statistic.
  if (topic === "variance-stats" && answer >= 0) {
    return { kind: "nonneg", label: "variance or standard deviation" };
  }
  // Count of outcomes: a non-negative whole number (no declared decimals).
  if (
    topic === "combinatorics" &&
    decimals == null &&
    Number.isInteger(answer) &&
    answer >= 0
  ) {
    return { kind: "count", label: "count of outcomes" };
  }
  // Kelly dollar stake: a non-negative whole-dollar amount (a negative stake is
  // absurd for this section's sizing questions).
  if (unit === "$" && decimals == null && answer >= 0) {
    return { kind: "nonneg", label: "dollar stake" };
  }
  return { kind: "real", label: "any real number" };
}

/** True iff `value` falls OUTSIDE the domain `d` (always false for `"real"`). */
export function isOutOfDomain(value: number, d: AnswerDomain): boolean {
  switch (d.kind) {
    case "probability":
      return value < 0 || value > 1;
    case "count":
      return value < 0 || !Number.isInteger(value);
    case "nonneg":
      return value < 0;
    case "real":
      return false;
  }
}

/**
 * A METHOD-FREE sanity-check pointer for an out-of-domain value: it names the
 * basic property the answer violates (a probability must be in [0, 1], a count
 * can't be negative or fractional, a variance / stake can't be negative) and
 * asks the learner to re-check their arithmetic — never a corrective operation
 * and never the correct answer.
 */
export function domainPointerCoaching(d: AnswerDomain): string {
  switch (d.kind) {
    case "probability":
      return (
        "Keep in mind, probabilities are always in the range [0, 1]! " +
        "Check your arithmetic so your probability lands in that range too."
      );
    case "count":
      return (
        "Keep in mind, a count of outcomes can't be negative and must be a " +
        "whole number — re-check your arithmetic so your result is a sensible count."
      );
    case "nonneg":
      return (
        `Keep in mind, a ${d.label} can't be negative — re-check your ` +
        `arithmetic so your result isn't below zero.`
      );
    case "real":
      return "";
  }
}

/* -------------------------------------------------------------------------- */
/*  Arithmetic-slip heuristic (rung-1 close-but-not-exact nudge)               */
/* -------------------------------------------------------------------------- */

/**
 * True when `value` looks like a mere ARITHMETIC slip on an otherwise-correct
 * setup: it isn't exact, but it's CLOSE to `correct` — within ~12% relative
 * error, or (for small magnitudes) within a small absolute band. Callers apply
 * this only AFTER ruling out the out-of-domain and matched-misconception cases
 * (handled earlier by priority), so it need only test closeness.
 */
export function isArithmeticSlip(value: number, correct: number): boolean {
  if (!Number.isFinite(value) || !Number.isFinite(correct)) return false;
  if (value === correct) return false;
  const abs = Math.abs(value - correct);
  const rel = abs / Math.max(1, Math.abs(correct));
  if (rel <= 0.12) return true;
  // Small-magnitude reference: allow a tight absolute band so a near-miss on a
  // sub-unit answer still reads as a slip, without flagging a zero-vs-large gap.
  if (Math.abs(correct) < 1 && abs <= 0.05) return true;
  return false;
}

/** Method-free encouragement for a close-but-not-exact (arithmetic-slip) entry. */
export function arithmeticSlipCoaching(): string {
  return (
    "Your logic looks spot on — just double-check your arithmetic to make " +
    "sure every step's number is right."
  );
}
