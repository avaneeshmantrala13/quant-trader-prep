/**
 * mock/annotate.ts — SPAN-LEVEL reasoning annotations for the review UI.
 *
 * Given the candidate's submitted reasoning, this produces a list of character
 * SPANS classified GOOD (green — a correct step / valid mechanism / reaches the
 * verified answer) or FLAWED (red — a demonstrably false stated computation, a
 * self-contradiction, or a hedge), each with a short "why". The UI highlights
 * these spans so a learner SEES exactly which parts of their own words were
 * right and which were wrong.
 *
 * DESIGN (mirrors the extract-and-verify philosophy of `claims.ts`):
 *   • The DETERMINISTIC verdict stays AUTHORITATIVE — annotations only DECORATE
 *     the text; they never change the graded `quality` (passed in, or computed
 *     via the tested deterministic grader).
 *   • Every FLAWED/GOOD label is re-derived by DETERMINISTIC arithmetic checks
 *     (`evalArithmetic`, `findFalseArithmetic`, …), so an LLM extractor can only
 *     ever SUPPLY candidate spans/mechanism phrasings — it can never fabricate a
 *     "correct" label. This keeps the LLM part mockable and non-jailbreakable.
 *
 * PURE: no React, DOM, storage, or network. Imports only pure helpers from
 * `./reasoning` (one-directional; `reasoning.ts` never imports this module).
 */
import {
  allValuesIn,
  evalArithmetic,
  findFalseArithmetic,
  findPremiseFlaw,
  hasArithmeticContradiction,
  isHedgedReasoning,
  isUninterpretable,
  matchesMechanismSignal,
  parseNumericValue,
  statedResultValues,
  toClauses,
  type TextClause,
} from "./reasoning";

/** GOOD (correct/green) vs FLAWED (incorrect/red). */
export type SpanLabel = "good" | "flawed";

/** One highlighted span of the candidate's submitted reasoning text. */
export interface ReasoningSpan {
  /** Inclusive start / exclusive end char offsets into the ORIGINAL text. */
  start: number;
  end: number;
  /** The exact substring `text.slice(start, end)` (convenience for the UI). */
  excerpt: string;
  label: SpanLabel;
  /** Short, plain-language reason shown on hover / below the highlight. */
  why: string;
}

/** Options for {@link annotateReasoning}. */
export interface AnnotateOptions {
  /** The verifier's ground-truth answer, if numeric (drives the "reaches" span). */
  verifiedAnswer?: number | null;
  /** Accepted mechanism phrasings (question signals + rubric classes). */
  mechanismSignals?: string[];
  /** The question prompt — enables PREMISE / decomposition flaw localization. */
  prompt?: string;
  /**
   * Whether the verifier marked the ANSWER wrong. When true (or the derivation
   * lands on a value contradicting `verifiedAnswer`), the annotator localizes
   * the single ROOT flaw as a RED span — a broken premise/decomposition, or (as
   * a fallback) the earliest load-bearing step — so the learner is never left to
   * "find the broken step" themselves.
   */
  answerWasWrong?: boolean;
}

/** A trimmed clause with offsets into the original text. */
type Clause = TextClause;

/** Compact human-readable number. */
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
}

/** Does the clause contain a stated `<expr> = <expr>` equality that HOLDS? */
function hasCorrectArithmetic(clause: string): boolean {
  if (clause.indexOf("=") < 0) return false;
  const segs = clause.split("=");
  for (let k = 0; k + 1 < segs.length; k++) {
    const a = evalArithmetic(segs[k]);
    const b = evalArithmetic(segs[k + 1]);
    if (a === null || b === null) continue;
    const tol = 1e-6 + Math.abs(b) * 1e-6;
    if (Math.abs(a - b) <= tol) return true;
  }
  return false;
}

/**
 * Classify ONE clause into an annotation, or `null` when it carries no clear
 * good/flawed signal. FLAWED takes precedence over GOOD within a clause.
 */
function classifyClause(
  clause: Clause,
  opts: AnnotateOptions,
): ReasoningSpan | null {
  const { text } = clause;
  const span = (label: SpanLabel, why: string): ReasoningSpan => ({
    start: clause.start,
    end: clause.end,
    excerpt: text,
    label,
    why,
  });

  // --- FLAWED (red) -------------------------------------------------------
  const falseArith = findFalseArithmetic(text);
  if (falseArith) {
    return span(
      "flawed",
      `Incorrect step: ${falseArith.claim} — should be ${fmt(falseArith.correct)}, not ${fmt(falseArith.stated)}.`,
    );
  }
  if (hasArithmeticContradiction(text)) {
    return span("flawed", "This stated equality doesn't hold — recheck the arithmetic.");
  }
  if (isHedgedReasoning(text)) {
    return span("flawed", "Hedging — this points both ways instead of committing to one answer.");
  }

  // --- GOOD (green) -------------------------------------------------------
  const verified = opts.verifiedAnswer ?? null;
  if (verified !== null) {
    const tol = 1e-3 + Math.abs(verified) * 1e-6;
    const results = statedResultValues(text);
    if (results.some((v) => Math.abs(v - verified) <= tol)) {
      return span("good", `Reaches the correct value (${fmt(verified)}).`);
    }
  }
  if (hasCorrectArithmetic(text)) {
    return span("good", "Correct arithmetic — this step checks out.");
  }
  if (
    opts.mechanismSignals &&
    opts.mechanismSignals.length > 0 &&
    matchesMechanismSignal(text, opts.mechanismSignals)
  ) {
    return span("good", "Names the key mechanism that justifies the answer.");
  }
  return null;
}

/**
 * Produce SPAN-LEVEL good/flawed annotations for the candidate's reasoning. The
 * spans are disjoint and ordered by position. Garbled / empty text yields NO
 * spans (the UI shows a "not understood" / "no reasoning" state instead). Pure
 * and total.
 */
export function annotateReasoning(
  rawText: string,
  opts: AnnotateOptions = {},
): ReasoningSpan[] {
  const text = rawText ?? "";
  if (text.trim() === "") return [];
  // Genuinely garbled text has no meaningful spans to highlight.
  if (isUninterpretable(text)) return [];
  const spans: ReasoningSpan[] = [];
  for (const clause of toClauses(text)) {
    const s = classifyClause(clause, opts);
    if (s) spans.push(s);
  }
  localizeRootCause(text, spans, opts);
  spans.sort((a, b) => a.start - b.start);
  return spans;
}

/**
 * When the derivation is WRONG, ensure the single ROOT flaw is highlighted RED
 * so the learner sees exactly where it breaks (never "locate it yourself"):
 *   1. a specific broken PREMISE / decomposition / independence-abuse / bogus
 *      50/50 (shared with the grader's `findPremiseFlaw`, so the highlighted
 *      span and the graded verdict come from the SAME root cause); else
 *   2. if nothing is highlighted flawed yet, the EARLIEST load-bearing clause —
 *      the chain built on it carries the error forward.
 * A derivation that REACHES the verified answer is never reddened, so a correct
 * chain can't get a false red. Mutates `spans` in place.
 */
function localizeRootCause(
  text: string,
  spans: ReasoningSpan[],
  opts: AnnotateOptions,
): void {
  const verified = opts.verifiedAnswer ?? null;
  const tol = verified !== null ? 1e-3 + Math.abs(verified) * 1e-6 : 0;
  const reaches =
    verified !== null &&
    statedResultValues(text).some((v) => Math.abs(v - verified) <= tol);
  if (reaches) return; // correct chain — never redden
  const all = allValuesIn(text);
  const landing = all.length > 0 ? all[all.length - 1] : null;
  const contradicts =
    verified !== null &&
    landing !== null &&
    Math.abs(landing - verified) > tol;
  const wrong = opts.answerWasWrong === true || contradicts;
  if (!wrong) return;

  const flaw = findPremiseFlaw(text, {
    prompt: opts.prompt,
    verifiedAnswer: verified,
    statedValue: landing,
  });
  if (flaw) {
    // The root cause wins over any overlapping decoration at that span.
    for (let i = spans.length - 1; i >= 0; i--) {
      if (!(spans[i].end <= flaw.start || spans[i].start >= flaw.end)) {
        spans.splice(i, 1);
      }
    }
    spans.push({
      start: flaw.start,
      end: flaw.end,
      excerpt: text.slice(flaw.start, flaw.end),
      label: "flawed",
      why: flaw.why,
    });
    return;
  }

  // Generic fallback: nothing specific matched, but the chain is wrong. Point at
  // the earliest substantive, not-yet-highlighted clause instead of punting.
  if (spans.some((s) => s.label === "flawed")) return;
  for (const c of toClauses(text)) {
    if (c.text.trim().split(/\s+/).filter(Boolean).length < 3) continue;
    if (spans.some((s) => !(c.end <= s.start || c.start >= s.end))) continue;
    spans.push({
      start: c.start,
      end: c.end,
      excerpt: c.text,
      label: "flawed",
      why:
        "This is the earliest load-bearing step, and the chain built on it reaches the wrong result — the error originates here and the later steps carry it forward. Recheck this assumption against the setup.",
    });
    return;
  }
}

/**
 * Convenience for callers that already hold the verifier's answer as a STRING
 * (e.g. a `MathStep.answer` stringified). Parses it to a number when possible.
 */
export function annotateReasoningForAnswer(
  rawText: string,
  correctAnswer: string,
  mechanismSignals?: string[],
): ReasoningSpan[] {
  return annotateReasoning(rawText, {
    verifiedAnswer: parseNumericValue(correctAnswer),
    mechanismSignals,
  });
}
