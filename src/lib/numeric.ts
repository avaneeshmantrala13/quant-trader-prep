import type { NumericQuestion } from "@/types/content";

/**
 * Parsing + grading for the `"numeric"` free-entry play mode.
 *
 * Input sanitization: accept a leading currency symbol, thousands separators
 * (commas), surrounding whitespace, and an optional trailing `%`/unit noise;
 * parse to a finite number. Grading is EXACT match against the integer answer.
 */

/** Parse raw free-entry text to a finite number, or `null` if unparseable. */
export function parseNumericInput(raw: string): number | null {
  if (raw == null) return null;
  // Strip $, £, €, commas, spaces, and a trailing percent sign.
  const cleaned = raw
    .trim()
    .replace(/[,$£€\s]/g, "")
    .replace(/%$/, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "+" || cleaned === ".")
    return null;
  // Only allow a plain (optionally signed) decimal number.
  if (!/^[+-]?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export interface NumericGrade {
  /** The parsed numeric value, or null if the entry could not be parsed. */
  parsed: number | null;
  /** True iff the parsed value matches the question's answer (see `numericMatches`). */
  correct: boolean;
  /** Targeted feedback if the (wrong) entry matches a known common error. */
  matchedError?: { value: number; feedback: string };
}

/**
 * Whether an entered value counts as the answer. For integer answers (Kelly
 * stakes, `decimals` omitted) this is exact `===`. For answers carrying a
 * `decimals` precision (game values, probabilities) both sides are rounded to
 * that many places first, so 2.8 (= 14/5 via fraction.js) and a typed "2.8"
 * agree without floating-point flakiness.
 */
export function numericMatches(
  question: Pick<NumericQuestion, "answer" | "decimals">,
  value: number,
): boolean {
  if (question.decimals == null) return value === question.answer;
  const f = 10 ** question.decimals;
  return Math.round(value * f) === Math.round(question.answer * f);
}

/** Display string for the answer, honoring `decimals` when present. */
export function formatNumericAnswer(
  question: Pick<NumericQuestion, "answer" | "decimals">,
): string {
  return question.decimals == null
    ? question.answer.toLocaleString("en-US")
    : question.answer.toFixed(question.decimals);
}

/** Grade a raw entry against a numeric question (match + error taxonomy). */
export function gradeNumeric(
  question: Pick<NumericQuestion, "answer" | "decimals" | "commonErrors">,
  raw: string,
): NumericGrade {
  const parsed = parseNumericInput(raw);
  if (parsed === null) return { parsed: null, correct: false };
  const correct = numericMatches(question, parsed);
  if (correct) return { parsed, correct: true };
  const matchedError = question.commonErrors?.find((e) =>
    question.decimals == null
      ? e.value === parsed
      : Math.round(e.value * 10 ** question.decimals) ===
        Math.round(parsed * 10 ** question.decimals),
  );
  return { parsed, correct: false, matchedError };
}
