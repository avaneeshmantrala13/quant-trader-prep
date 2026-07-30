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

/**
 * Parse a FREE-RESPONSE entry that may be a plain number, a fraction (`a/b`), a
 * decimal, a percentage (trailing `%`), OR a simple arithmetic expression over
 * `+ - * / ( )` (e.g. `"1/2 + 1/4"`, `"(3+1)/8"`, `"2*3"`). Returns a finite
 * number or `null` if unparseable. This is a strict, SAFE evaluator (recursive
 * descent — never `eval`) so users who type an un-simplified expression instead
 * of a decimal still get graded correctly. Currency symbols and thousands
 * separators are stripped first; a single trailing `%` scales the whole result
 * by 1/100.
 *
 * `parseNumericInput` (plain-number-only) is kept for the strict integer/decimal
 * Kelly path; free-response numeric levels should grade with this.
 */
export function parseFreeResponse(raw: string): number | null {
  if (raw == null) return null;
  let s = raw.trim().replace(/[,$£€]/g, "").replace(/\s+/g, "");
  if (s === "") return null;
  let percent = false;
  if (s.endsWith("%")) {
    percent = true;
    s = s.slice(0, -1);
  }
  if (s === "") return null;
  // Only allow the safe expression alphabet: digits, ., + - * /, parentheses.
  if (!/^[0-9.+\-*/()]+$/.test(s)) return null;
  const tokens = tokenizeExpr(s);
  if (tokens === null) return null;
  const parser = new ExprParser(tokens);
  const value = parser.parseExpression();
  if (value === null || !parser.atEnd()) return null;
  if (!Number.isFinite(value)) return null;
  return percent ? value / 100 : value;
}

type ExprToken =
  | { t: "num"; v: number }
  | { t: "op"; v: "+" | "-" | "*" | "/" }
  | { t: "lp" }
  | { t: "rp" };

function tokenizeExpr(s: string): ExprToken[] | null {
  const out: ExprToken[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "+" || c === "-" || c === "*" || c === "/") {
      out.push({ t: "op", v: c });
      i++;
    } else if (c === "(") {
      out.push({ t: "lp" });
      i++;
    } else if (c === ")") {
      out.push({ t: "rp" });
      i++;
    } else if ((c >= "0" && c <= "9") || c === ".") {
      let j = i;
      let dots = 0;
      while (j < s.length && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) {
        if (s[j] === ".") dots++;
        j++;
      }
      if (dots > 1) return null;
      const num = Number(s.slice(i, j));
      if (!Number.isFinite(num)) return null;
      out.push({ t: "num", v: num });
      i = j;
    } else {
      return null;
    }
  }
  return out;
}

/** Recursive-descent evaluator: expr → term (('+'|'-') term)*; term → factor; factor → unary/paren/num. */
class ExprParser {
  private pos = 0;
  constructor(private readonly tokens: ExprToken[]) {}
  atEnd(): boolean {
    return this.pos >= this.tokens.length;
  }
  private peek(): ExprToken | undefined {
    return this.tokens[this.pos];
  }
  parseExpression(): number | null {
    let left = this.parseTerm();
    if (left === null) return null;
    for (;;) {
      const tok = this.peek();
      if (tok?.t === "op" && (tok.v === "+" || tok.v === "-")) {
        this.pos++;
        const right = this.parseTerm();
        if (right === null) return null;
        left = tok.v === "+" ? left + right : left - right;
      } else break;
    }
    return left;
  }
  private parseTerm(): number | null {
    let left = this.parseFactor();
    if (left === null) return null;
    for (;;) {
      const tok = this.peek();
      if (tok?.t === "op" && (tok.v === "*" || tok.v === "/")) {
        this.pos++;
        const right = this.parseFactor();
        if (right === null) return null;
        if (tok.v === "/") {
          if (right === 0) return null;
          left = left / right;
        } else left = left * right;
      } else break;
    }
    return left;
  }
  private parseFactor(): number | null {
    const tok = this.peek();
    if (!tok) return null;
    if (tok.t === "op" && (tok.v === "-" || tok.v === "+")) {
      this.pos++;
      const f = this.parseFactor();
      if (f === null) return null;
      return tok.v === "-" ? -f : f;
    }
    if (tok.t === "lp") {
      this.pos++;
      const e = this.parseExpression();
      if (e === null) return null;
      if (this.peek()?.t !== "rp") return null;
      this.pos++;
      return e;
    }
    if (tok.t === "num") {
      this.pos++;
      return tok.v;
    }
    return null;
  }
}

export interface NumericGrade {
  /** The parsed numeric value, or null if the entry could not be parsed. */
  parsed: number | null;
  /** True iff the parsed value matches the question's answer (see `numericMatches`). */
  correct: boolean;
  /** Targeted feedback if the (wrong) entry matches a known common error. */
  matchedError?: { value: number; feedback: string; misconception?: string };
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

/** Round to the nearest thousandth (3 decimal places). */
function roundThousandth(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Whether a FREE-RESPONSE entry counts as the answer, tolerating equivalent
 * representations (fractions vs decimals vs percentages) and non-terminating
 * decimals.
 *
 * Three regimes, chosen so exact answers stay strict while multi-representation
 * answers grade fairly:
 * - EXACT-INTEGER / EXACT-DOLLAR (`decimals` omitted and the answer is a whole
 *   number): require an EXACT match, so 42 still demands 42 and rejects 42.0004.
 *   Equivalent expressions that evaluate exactly (e.g. "600/2" → 300) still pass.
 * - MULTI-REPRESENTATION / NON-TERMINATING reference (`decimals` omitted and the
 *   answer is a non-integer such as 1/3, 0.5, or a probability): convert BOTH the
 *   entry and the reference to a decimal ROUNDED TO THE NEAREST THOUSANDTH and
 *   compare. This makes "1/3", "0.333", and "0.3333…" all agree, and
 *   "50%" / "0.5" / "1/2" all pass.
 * - DECLARED-PRECISION reference (`decimals` set): compare after rounding both
 *   sides to that many places (unchanged) — the family authored the precision it
 *   wants graded at (and distinguishes its parametric error modes at), so a
 *   full-precision fraction/percent/decimal entry still matches.
 */
export function freeResponseMatches(
  question: Pick<NumericQuestion, "answer" | "decimals">,
  value: number,
): boolean {
  if (question.decimals == null) {
    return Number.isInteger(question.answer)
      ? value === question.answer
      : roundThousandth(value) === roundThousandth(question.answer);
  }
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
  return gradeWith(question, raw, parseNumericInput, numericMatches);
}

/**
 * Grade a FREE-RESPONSE entry (fractions / decimals / percentages / simple
 * expressions) against a numeric question. Identical to `gradeNumeric` but parses
 * with `parseFreeResponse`, so a learner may type `"1/3"`, `"25%"`, or
 * `"(3+1)/8"` and still be graded — and matched against the family's parametric
 * error modes (`commonErrors`) for misconception-driven rung-1 coaching.
 */
export function gradeFreeResponse(
  question: Pick<NumericQuestion, "answer" | "decimals" | "commonErrors">,
  raw: string,
): NumericGrade {
  const parsed = parseFreeResponse(raw);
  if (parsed === null) return { parsed: null, correct: false };
  // 1) Exact / declared-precision match (see `freeResponseMatches`). This keeps
  //    exact-integer answers strict and honors a family's authored precision.
  if (freeResponseMatches(question, parsed)) return { parsed, correct: true };
  // 2) A known misconception value, compared at the family's authored precision
  //    so parametric error modes stay mutually distinct (and out-rank the looser
  //    thousandth tolerance below — typing an exact error value is that error).
  const matchedError = question.commonErrors?.find((e) =>
    freeResponseMatches({ answer: e.value, decimals: question.decimals }, parsed),
  );
  if (matchedError) return { parsed, correct: false, matchedError };
  // 3) Thousandth-rounding tolerance for multi-representation entries: a learner
  //    who converts a fraction/percent to a 3-decimal number (e.g. "0.333" for a
  //    reference of 1/3 stored at finer precision) still grades correct. Skipped
  //    for exact-integer / exact-dollar answers so 42 never accepts 42.0004.
  const exactIntegerAnswer =
    question.decimals == null && Number.isInteger(question.answer);
  if (
    !exactIntegerAnswer &&
    roundThousandth(parsed) === roundThousandth(question.answer)
  ) {
    return { parsed, correct: true };
  }
  return { parsed, correct: false };
}

function gradeWith(
  question: Pick<NumericQuestion, "answer" | "decimals" | "commonErrors">,
  raw: string,
  parse: (raw: string) => number | null,
  matches: (
    q: Pick<NumericQuestion, "answer" | "decimals">,
    value: number,
  ) => boolean,
): NumericGrade {
  const parsed = parse(raw);
  if (parsed === null) return { parsed: null, correct: false };
  const correct = matches(question, parsed);
  if (correct) return { parsed, correct: true };
  const matchedError = question.commonErrors?.find((e) =>
    matches({ answer: e.value, decimals: question.decimals }, parsed),
  );
  return { parsed, correct: false, matchedError };
}
