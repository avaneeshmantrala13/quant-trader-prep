/**
 * mock/reasoning.ts — the DETERMINISTIC reasoning-quality fallback.
 *
 * The `mock-reason-grade` LLM judges the QUALITY of a candidate's reasoning
 * (never its correctness — the numeric verifier owns that). When the AI layer
 * is off / stubbed / unreachable, this pure function stands in: it applies the
 * same DECOMPOSE-THEN-VERIFY philosophy as `aiSelfExplain#decomposeChecks`
 * (does the text engage the setup? does it commit to real work?) to produce a
 * `{quality, issues, probe}` that mirrors the contract's shape.
 *
 * PURE: no React, DOM, storage, or network. Same inputs ⇒ same grade.
 *
 * INVARIANT honored here too: this never flips correctness. `correct` is an
 * INPUT (the verifier's verdict) and only shapes the *quality* wording.
 */
import type { ReasoningGrade, ReasoningQuality } from "./types";

/** Extract distinct numeric tokens from text (mirrors aiFlavor#extractNumbers). */
export function numbersIn(text: string): Set<string> {
  const out = new Set<string>();
  const re = /\$?\s?(\d[\d,]*(?:\.\d+)?)\s?%?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(n)) out.add(String(n));
  }
  return out;
}

/**
 * Robustly parse ONE numeric value token into a number. Supports fractions
 * (`"1/4"` → 0.25), percentages (`"25%"` → 0.25), and plain
 * integers/decimals (with thousands separators). Returns `null` when the token
 * is not a single, unambiguous numeric value. Pure and total.
 */
export function parseNumericValue(raw: string): number | null {
  if (raw == null) return null;
  // Treat a Unicode minus (U+2212, as printed in prompts) like an ASCII "-" and
  // drop currency symbols so "-$0.50" parses as -0.5 rather than failing.
  const s = raw.trim().replace(/\u2212/g, "-").replace(/[$£€]/g, "");
  if (s === "") return null;
  // Fraction a/b (allows decimals in either part).
  const frac = s.match(/^([+-]?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) {
    const num = Number(frac[1]);
    const den = Number(frac[2]);
    if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
      return num / den;
    }
    return null;
  }
  // Percentage x% → x/100.
  const pct = s.match(/^([+-]?\d+(?:[.,]\d+)?)\s*%$/);
  if (pct) {
    const n = Number(pct[1].replace(/,/g, ""));
    return Number.isFinite(n) ? n / 100 : null;
  }
  // Plain integer / decimal (tolerate thousands separators).
  const plain = s.replace(/,/g, "");
  if (/^[+-]?\d+(?:\.\d+)?$/.test(plain)) {
    const n = Number(plain);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Matches a single value expression: a fraction, a percentage, or a decimal. */
const VALUE_TOKEN_RE =
  /[+-]?\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?|[+-]?\d+(?:[.,]\d+)?\s*%|[+-]?\d[\d,]*(?:\.\d+)?/;

/** Parse the FIRST value expression found in `s`, or `null` if none. */
function firstValueIn(s: string): number | null {
  const m = s.match(VALUE_TOKEN_RE);
  if (!m) return null;
  return parseNumericValue(m[0].replace(/\s+/g, ""));
}

/**
 * The value a piece of text CONCLUDES with: prefer the value stated after the
 * final `=` or `→` (the result of a computation chain); otherwise the first
 * value in the text. Returns `null` when the text carries no numeric value.
 */
export function lastComputedValue(text: string): number | null {
  const marker = Math.max(text.lastIndexOf("="), text.lastIndexOf("→"));
  const region = marker >= 0 ? text.slice(marker + 1) : text;
  const v = firstValueIn(region);
  if (v !== null) return v;
  return marker >= 0 ? firstValueIn(text) : null;
}

/** Every numeric value token in `s`, left-to-right. Pure and total. */
export function allValuesIn(s: string): number[] {
  const re = new RegExp(VALUE_TOKEN_RE.source, "g");
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const v = parseNumericValue(m[0].replace(/\s+/g, ""));
    if (v !== null) out.push(v);
    if (m.index === re.lastIndex) re.lastIndex++; // guard: never loop on empty
  }
  return out;
}

/**
 * The set of values the written work presents as a RESULT: the value stated
 * right after each `=`/`→` (the output of a computation step) PLUS the final
 * numeric token of the whole text (a prose conclusion like "… which is 95").
 * This is the collection of numbers a derivation ARRIVES AT — used to check the
 * work is consistent with the VERIFIER (does it reach the answer by ANY
 * equivalent route?) rather than matching one canonical script. Pure and total.
 */
export function statedResultValues(text: string): number[] {
  const out: number[] = [];
  const re = /[=→]([^=→]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const v = firstValueIn(m[1]);
    if (v !== null) out.push(v);
  }
  const all = allValuesIn(text);
  if (all.length > 0) out.push(all[all.length - 1]);
  return out;
}

/**
 * Safely evaluate a PURELY-NUMERIC arithmetic expression — digits, decimal
 * points, thousands separators, parentheses and the operators `+ - * /` (the
 * unicode spellings `× ÷ · ⋅ −` are accepted too), with standard precedence.
 * Returns the value, or `null` when the string contains anything non-arithmetic
 * (a variable like `n`, a word, an `=`, an empty/dangling operand). This lets us
 * validate a candidate's stated computation — including CHAINED expressions like
 * `"108 − 18 + 5 = 95"` — for internal consistency, instead of misreading a
 * trailing binary fragment (`"18 + 5 = 95"`). Pure and total: it never throws
 * and never executes the input as code.
 */
export function evalArithmetic(raw: string): number | null {
  const s = (raw ?? "")
    .replace(/\u2212/g, "-") // unicode minus → ASCII "-"
    .replace(/[×✕⋅·]/g, "*")
    .replace(/\u00f7/g, "/")
    .replace(/,/g, "") // thousands separators
    .trim();
  if (s === "" || !/^[0-9.\s()+\-*/]+$/.test(s) || !/[0-9]/.test(s)) return null;

  type Tok =
    | { t: "num"; v: number }
    | { t: "op"; v: "+" | "-" | "*" | "/" }
    | { t: "(" }
    | { t: ")" };
  const toks: Tok[] = [];
  const prevIsValue = (): boolean => {
    const p = toks[toks.length - 1];
    return p != null && (p.t === "num" || p.t === ")");
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " ") {
      i++;
      continue;
    }
    if (c === "(") {
      toks.push({ t: "(" });
      i++;
      continue;
    }
    if (c === ")") {
      toks.push({ t: ")" });
      i++;
      continue;
    }
    if (c === "+" || c === "-" || c === "*" || c === "/") {
      // A leading +/- with no value before it is a UNARY sign on the number.
      if ((c === "+" || c === "-") && !prevIsValue()) {
        const m = s.slice(i).match(/^[+-]?\d*\.?\d+/);
        if (m && /\d/.test(m[0])) {
          toks.push({ t: "num", v: Number(m[0]) });
          i += m[0].length;
          continue;
        }
      }
      toks.push({ t: "op", v: c });
      i++;
      continue;
    }
    const m = s.slice(i).match(/^\d*\.?\d+/);
    if (!m) return null;
    toks.push({ t: "num", v: Number(m[0]) });
    i += m[0].length;
  }
  if (toks.length === 0) return null;

  // Shunting-yard → RPN.
  const prec = (op: string): number => (op === "+" || op === "-" ? 1 : 2);
  const out: Tok[] = [];
  const ops: Tok[] = [];
  for (const tk of toks) {
    if (tk.t === "num") out.push(tk);
    else if (tk.t === "op") {
      let top = ops[ops.length - 1];
      while (top && top.t === "op" && prec(top.v) >= prec(tk.v)) {
        out.push(ops.pop()!);
        top = ops[ops.length - 1];
      }
      ops.push(tk);
    } else if (tk.t === "(") ops.push(tk);
    else {
      while (ops.length && ops[ops.length - 1].t !== "(") out.push(ops.pop()!);
      if (!ops.length) return null; // mismatched ")"
      ops.pop();
    }
  }
  while (ops.length) {
    const o = ops.pop()!;
    if (o.t === "(") return null; // mismatched "("
    out.push(o);
  }

  const st: number[] = [];
  for (const tk of out) {
    if (tk.t === "num") st.push(tk.v);
    else if (tk.t === "op") {
      const b = st.pop();
      const a = st.pop();
      if (a === undefined || b === undefined) return null;
      let r: number;
      switch (tk.v) {
        case "+":
          r = a + b;
          break;
        case "-":
          r = a - b;
          break;
        case "*":
          r = a * b;
          break;
        case "/":
          if (b === 0) return null;
          r = a / b;
          break;
      }
      st.push(r);
    }
  }
  return st.length === 1 && Number.isFinite(st[0]) ? st[0] : null;
}

/** Character class of a numeric-arithmetic run (no `=`; digits/ops/parens). */
const ARITH_RUN_CHARS = "0-9.,\\s()+\\-*/×✕÷·⋅\\u2212";
/** The maximal arithmetic run at the END of `s` (the operand feeding an `=`). */
function trailingArithExpr(s: string): string {
  const m = s.match(new RegExp(`[${ARITH_RUN_CHARS}]*$`));
  return m ? m[0] : "";
}
/** The maximal arithmetic run at the START of `s` (a stated result). */
function leadingArithExpr(s: string): string {
  const m = s.match(new RegExp(`^[${ARITH_RUN_CHARS}]*`));
  return m ? m[0] : "";
}

/**
 * Detect an internally-inconsistent stated computation `"<expr> = <value>"`
 * where the left arithmetic expression does NOT equal the stated result (e.g.
 * `"3 × 1/2 = 3/8"`, 1.5 ≠ 0.375). It evaluates the FULL arithmetic expression
 * on each side of every `=` (so a correct CHAIN like `"108 − 18 + 5 = 95"` is
 * NOT flagged, and a genuinely-false step still is). Conservative: only fires
 * when BOTH sides are fully-numeric and parseable, so real prose and formulas
 * with variables (`aₙ = 3n² − 3n + 5`) never trip it. Note `→`/`->` are treated
 * as "leads to" (a conclusion arrow), NOT arithmetic equality.
 */
export function hasArithmeticContradiction(text: string): boolean {
  if (!text || text.indexOf("=") < 0) return false;
  const segs = text.split("=");
  for (let k = 0; k + 1 < segs.length; k++) {
    const a = evalArithmetic(trailingArithExpr(segs[k]));
    const b = evalArithmetic(leadingArithExpr(segs[k + 1]));
    if (a === null || b === null) continue;
    const tol = 1e-6 + Math.abs(b) * 1e-6;
    if (Math.abs(a - b) > tol) return true;
  }
  return false;
}

/** A single stated arithmetic equality that does NOT hold. */
export interface FalseArithmetic {
  /** The offending clause exactly as the candidate wrote it. */
  claim: string;
  /** What they should have gotten. */
  correct: number;
  /** The (wrong) value they asserted. */
  stated: number;
  /** Specific, prep-oriented feedback naming the false step. */
  message: string;
}

/** Map an operator alias (word or symbol) to a compute fn + a display symbol. */
const OP_TABLE: {
  re: string;
  sym: string;
  apply: (a: number, b: number) => number | null;
}[] = [
  { re: "divided by|÷", sym: "÷", apply: (a, b) => (b !== 0 ? a / b : null) },
  { re: "multiplied by|times|×", sym: "×", apply: (a, b) => a * b },
  { re: "plus|added to", sym: "+", apply: (a, b) => a + b },
  { re: "minus|subtracted by|less", sym: "−", apply: (a, b) => a - b },
  // `over` is division but ALSO how people say a fraction ("1 over 2"); handled
  // last so the fraction reading is caught the same way (a/b).
  { re: "over", sym: "÷", apply: (a, b) => (b !== 0 ? a / b : null) },
];

const NUM_TOKEN =
  "-?\\d[\\d,]*(?:\\.\\d+)?(?:\\s*/\\s*\\d[\\d,]*(?:\\.\\d+)?)?";
const EQ_WORDS = "=|=>|→|->|equals?|equal to|is|are|gives?|makes?|yields?|becomes?";

/**
 * Scan free-text reasoning for an explicitly-STATED binary arithmetic claim,
 * written either in words ("1 divided by 2 is 5", "3 times 4 equals 11") or with
 * symbols ("1/2 × 3 = 5"), whose left side does NOT equal the stated result.
 *
 * Returns the FIRST demonstrably-false claim with prep-oriented feedback, or
 * `null` if every parseable claim checks out. It tolerates reasonable rounding
 * (e.g. "1 ÷ 3 is 0.33") so honest mental approximations aren't flagged — only a
 * genuinely wrong computation (like 1 ÷ 2 = 5) trips it. Pure and total.
 */
export function findFalseArithmetic(text: string): FalseArithmetic | null {
  if (!text) return null;
  for (const op of OP_TABLE) {
    const re = new RegExp(
      `(${NUM_TOKEN})\\s*(?:${op.re})\\s*(${NUM_TOKEN})\\s*(?:${EQ_WORDS})\\s*(${NUM_TOKEN})`,
      "gi",
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const a = parseNumericValue(m[1].replace(/\s+/g, ""));
      const b = parseNumericValue(m[2].replace(/\s+/g, ""));
      const stated = parseNumericValue(m[3].replace(/\s+/g, ""));
      if (a === null || b === null || stated === null) continue;
      const computed = op.apply(a, b);
      if (computed === null) continue;
      // Relative tolerance so rounding ("1 ÷ 3 is 0.33") passes but a real
      // blunder ("1 ÷ 2 is 5") fails.
      const tol = Math.max(0.01, Math.abs(computed) * 0.03);
      if (Math.abs(computed - stated) <= tol) continue;
      const claim = m[0].trim().replace(/\s+/g, " ");
      const correctStr = fmtNum(computed);
      const statedStr = fmtNum(stated);
      const aStr = fmtNum(a);
      const bStr = fmtNum(b);
      let message =
        `You wrote "${claim}" — that's incorrect: ${aStr} ${op.sym} ${bStr} = ` +
        `${correctStr}, not ${statedStr}. State the real result; don't invent a ` +
        `rule to force the answer.`;
      if (BOGUS_RULE_RE.test(text)) {
        message +=
          " (Do the actual division — there's no valid \u201cshift/add a digit\u201d shortcut here.)";
      }
      return { claim, correct: computed, stated, message };
    }
  }
  return null;
}

/** Fabricated "shortcut" phrasing that tends to accompany nonsensical steps. */
const BOGUS_RULE_RE =
  /(add|move|shift|put|stick|throw)\s+(a\s+|the\s+|in\s+a\s+)?(decimal|zero|digit|point|number)/i;

/** Compact human-readable number (trims trailing zeros; caps precision). */
function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(4)));
}

/** Rough word count (whitespace-delimited, non-empty tokens). */
function wordCount(text: string): number {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

/**
 * Words that signal genuine *reasoning* (a chain of thought) rather than a bare
 * assertion. Used only as a soft, deterministic signal.
 */
const REASONING_MARKERS = [
  "because",
  "so",
  "since",
  "therefore",
  "thus",
  "then",
  "which means",
  "gives",
  "equals",
  "=",
  "multiply",
  "divide",
  "add",
  "subtract",
  "times",
  "per",
  "expected",
  "probability",
  "count",
  "ratio",
  "average",
];

export interface ReasoningInput {
  prompt: string;
  correctAnswer: string;
  correct: boolean;
  reasoning: string;
  isMentalMath?: boolean;
  /**
   * Per-question accepted phrasings that PROVE the candidate engaged this
   * question's MECHANISM (e.g. "second difference is constant", "differences
   * grow by 6", "quadratic"). When non-empty, a `sound` verdict REQUIRES ≥1 of
   * these — merely restating the final answer/arithmetic ("65 + 30 is 95") or
   * asserting correctness ("the math checks out") falls SHORT of sound. Empty /
   * absent ⇒ the mechanism gate is inert (back-compat: mental math, legacy).
   */
  mechanismSignals?: string[];
  /** Extra pure hand-waves that can never alone justify THIS question. */
  bannedAsSoleJustification?: string[];
}

/**
 * Universal HAND-WAVE bank: phrases that ASSERT correctness with NO mechanism.
 * These can never, by themselves, earn credit — a candidate must pair them with
 * a real mechanism signal. Deliberately targeted so ordinary connective prose
 * ("because", "so") is never mistaken for a hand-wave.
 */
const HANDWAVE_PATTERNS: RegExp[] = [
  /\bthe\s+math\s+checks?\s+out\b/i,
  /\bit\s+(?:all\s+)?checks?\s+out\b/i,
  /\bchecks?\s+out\b/i,
  /\bit'?s\s+obvious\b/i,
  /\bobviously\b/i,
  /\btrivial(?:ly)?\b/i,
  /\bby\s+inspection\b/i,
  /\btrust\s+me\b/i,
  /\bi\s+just\s+know\b/i,
  /\byou\s+just\s+know\b/i,
  /\bit'?s\s+clear\b/i,
  /\bclearly\b/i,
  /\bi\s+(?:computed|calculated|did|worked)\s+(?:it|the\s+math|it\s+out)\b/i,
  /\bthe\s+math\s+(?:is\s+)?(?:right|correct)\b/i,
  /\bit\s+(?:just\s+)?works?\s+out\b/i,
  /\bmakes?\s+sense\b/i,
  /\bcommon\s+sense\b/i,
  /\byou\s+can\s+(?:just\s+)?see\b/i,
  /\bself[-\s]evident\b/i,
];

/** Normalize text for tolerant mechanism-signal matching. */
function normalizeForMatch(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\u00b2/g, "^2") // ² → ^2
    .replace(/\u00b3/g, "^3") // ³ → ^3
    .replace(/[×✕⋅·]/g, "*")
    .replace(/[,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Does the reasoning contain ≥1 of the accepted MECHANISM phrasings? Matching is
 * tolerant (case-insensitive, super/sub-scripts, ×/·→*, commas/whitespace
 * collapsed) so a terse-but-correct explanation still matches. Pure and total.
 */
export function matchesMechanismSignal(
  text: string,
  signals: string[] | undefined,
): boolean {
  if (!signals || signals.length === 0) return false;
  const hay = normalizeForMatch(text);
  if (hay === "") return false;
  return signals.some((sig) => {
    const s = normalizeForMatch(sig);
    return s !== "" && hay.includes(s);
  });
}

/**
 * Is `signal` a PURE NUMERIC token whose value equals the verified answer (e.g.
 * the signal `"0.75"` or `"3/4"` for an answer of `0.75`)? Such a signal is the
 * FINAL ANSWER dressed as a mechanism — restating it must NOT satisfy the
 * mechanism gate (per the contract: "restating the final numeric answer never
 * earns sound"). A signal with ANY letters (e.g. `"3n^2"`, `"2m-1"`) is a
 * genuine formulaic mechanism and is kept.
 */
function isBareAnswerValueSignal(
  signal: string,
  verifiedAnswer: number | null,
): boolean {
  if (verifiedAnswer === null) return false;
  if (/[a-z]/i.test(signal)) return false; // has words/letters → real mechanism
  const v = parseNumericValue(signal);
  if (v === null) return false;
  const tol = 1e-3 + Math.abs(verifiedAnswer) * 1e-6;
  return Math.abs(v - verifiedAnswer) <= tol;
}

/**
 * The mechanism signals with any BARE-ANSWER-VALUE tokens removed (see
 * `isBareAnswerValueSignal`). Used by the MAIN reasoning grader so that merely
 * restating the numeric answer can never, by itself, satisfy the mechanism gate.
 */
export function mechanismSignalsSansAnswerValue(
  signals: string[],
  verifiedAnswer: number | null,
): string[] {
  return signals.filter((s) => !isBareAnswerValueSignal(s, verifiedAnswer));
}

/**
 * Is the reasoning DOMINATED by hand-wave / bare assertions — i.e. it asserts
 * correctness (or per-question banned phrases) but, once those and any restated
 * numbers/operators are stripped, carries NO substantive mechanism content? Used
 * as the UNIVERSAL guard for questions without authored `mechanismSignals`.
 * Conservative: it only fires when a hand-wave phrase is present AND nothing
 * content-bearing remains, so genuine explanations are never mistaken for it.
 */
export function isHandWaveOnly(
  text: string,
  banned: string[] = [],
): boolean {
  const lower = (text ?? "").toLowerCase();
  const bannedHit = banned.some((b) => normalizeForMatch(lower).includes(normalizeForMatch(b)));
  const hasHandwave = bannedHit || HANDWAVE_PATTERNS.some((re) => re.test(lower));
  if (!hasHandwave) return false;
  // Strip hand-wave phrases, then remove numbers / operators (a restated final
  // answer is NOT mechanism), then look for any genuine content marker.
  let residual = lower;
  for (const re of HANDWAVE_PATTERNS) {
    residual = residual.replace(new RegExp(re.source, "gi"), " ");
  }
  residual = residual
    .replace(/[0-9]+(?:\.[0-9]+)?/g, " ")
    .replace(/[=+\-*/×÷→^]/g, " ");
  return !CONTENT_MARKERS.some((m) => residual.includes(m));
}

/**
 * Substantive content-bearing terms that signal genuine engagement with a quant
 * mechanism (as opposed to hand-wave). Shared by {@link isHandWaveOnly} and the
 * {@link isUninterpretable} gate.
 */
const CONTENT_MARKERS = [
  "difference", "differences", "ratio", "expected", "probability",
  "complement", "independent", "variance", "pattern", "gap", "gaps",
  "grow", "growing", "constant", "sum", "average", "per", "rate",
  "distribut", "conditional", "symmetr", "combinat", "permut", "factor",
  "quadratic", "cubic", "geometric", "arithmetic", "fibonacci", "recurrence",
  "posterior", "prior", "bayes", "kelly", "edge", "linear", "scales",
  "second diff", "third diff", "square", "closed form", "coefficient",
  "double", "triple", "multiply", "add", "subtract", "divide", "count",
  "mutually", "exclusive", "memoryless", "threshold", "continuation",
];

/**
 * Common English words used as a light lexicon for the {@link isUninterpretable}
 * gate: a response built from real words (even if wrong or hand-wavy) is
 * READABLE — only genuine gibberish (keyboard-mash / symbol-soup / word-salad)
 * with almost no recognizable words is "uninterpretable".
 */
const COMMON_WORDS = new Set<string>([
  "the", "a", "an", "and", "or", "but", "if", "then", "so", "because", "since",
  "is", "are", "was", "were", "be", "been", "being", "it", "its", "this", "that",
  "these", "those", "i", "you", "we", "they", "he", "she", "to", "of", "in", "on",
  "for", "with", "as", "by", "at", "from", "not", "no", "yes", "will", "would",
  "can", "could", "should", "may", "might", "must", "do", "does", "did", "has",
  "have", "had", "get", "got", "one", "two", "three", "half", "same", "different",
  "more", "less", "than", "answer", "reason", "think", "know", "sure", "right",
  "wrong", "correct", "true", "false", "value", "number", "chance", "odds",
  "event", "events", "case", "cases", "each", "both", "all", "any", "some",
  "there", "here", "which", "what", "why", "how", "when", "out", "up", "down",
  "over", "under", "about", "just", "only", "still", "also", "very", "much",
  "many", "first", "next", "last", "total", "times", "equal", "equals", "means",
]);

/** Polarity / commitment phrasing that proves the text states a readable stance. */
const POLARITY_MARKERS: RegExp[] = [
  /\b(?:yes|yeah|yep|no|nope|nah|true|false|correct|incorrect)\b/i,
  /\b(?:same|different|unchanged|changes?|increases?|decreases?|higher|lower)\b/i,
];

/**
 * Is a single token PLAUSIBLY an English word (vs keyboard-mash)? A token counts
 * when it is a known common word, OR it looks word-shaped: alphabetic, of
 * reasonable length, containing a vowel, and WITHOUT a long unpronounceable run
 * of consonants (which betrays mashing like "asdkfj"). Conservative on purpose —
 * it errs toward calling things words, so real prose is never "uninterpretable".
 */
function isWordLike(tokenRaw: string): boolean {
  const t = tokenRaw.toLowerCase().replace(/[^a-z]/g, "");
  if (t === "") return false;
  if (COMMON_WORDS.has(t)) return true;
  if (t.length < 2 || t.length > 18) return t.length >= 2; // very long strings: don't judge
  if (!/[aeiouy]/.test(t)) return false; // no vowel ⇒ not word-like ("pqrst")
  if (/[^aeiouy]{4,}/.test(t)) return false; // 4+ consonants in a row ⇒ mash
  return true;
}

/**
 * Is the reasoning GARBLED / nonsensical — i.e. it cannot be parsed into ANY
 * meaningful claim? This is the "Response not understood" case, DISTINCT from a
 * hedge/contradiction (`ambiguous`) or a readable-but-hand-wavy assertion
 * (`vague`). Deliberately CONSERVATIVE so real English — even weak, wrong, or
 * terse — is never misflagged: it fires only when the text carries NO number, NO
 * reasoning marker, NO content term, NO polarity/commitment, NO hand-wave, and
 * is dominated by non-word tokens (keyboard-mash / symbol-soup). Pure and total.
 */
export function isUninterpretable(text: string): boolean {
  const t = (text ?? "").trim();
  if (t === "") return false; // empty is `absent`, not garbled
  // Any numeric value is itself a readable claim.
  if (numbersIn(t).size > 0) return false;
  const lower = t.toLowerCase();
  if (isHedgedReasoning(t)) return false; // a readable hedge ⇒ ambiguous, not garbled
  if (REASONING_MARKERS.some((m) => lower.includes(m))) return false;
  if (CONTENT_MARKERS.some((m) => lower.includes(m))) return false;
  if (POLARITY_MARKERS.some((re) => re.test(lower))) return false;
  if (HANDWAVE_PATTERNS.some((re) => re.test(lower))) return false; // readable ⇒ vague
  const tokens = lower.match(/[a-z']+/gi) ?? [];
  if (tokens.length === 0) return true; // pure symbols/punctuation ⇒ not understood
  const recognizable = tokens.filter(isWordLike).length;
  // Mostly non-words ⇒ genuine gibberish.
  return recognizable / tokens.length < 0.5;
}

/**
 * STRONG both-sides / hedging phrases that mean the candidate did NOT commit to
 * a single answer (mirrors `./conclusion#HEDGE_PATTERNS`, duplicated here to keep
 * `reasoning.ts` free of a runtime import cycle with `./conclusion`). Deliberately
 * targeted (no bare "maybe"/"perhaps") so genuine, committed answers are never
 * flagged.
 */
const HEDGE_PATTERNS: RegExp[] = [
  /\beither\s+(?:one|answer|could|would|is\s+fine|works)\b/i,
  /\bcould\s+be\s+(?:either|both|right|wrong|the\s+same|different)\b/i,
  /\b(?:could|can)\s+go\s+either\s+way\b/i,
  /\bboth\s+(?:answers?|could\s+be|are\s+(?:correct|right|valid)|ways)\b/i,
  /\bnot\s+(?:sure|certain)\b/i,
  /\b(?:i'?m|im)\s+unsure\b/i,
  /\bhard\s+to\s+say\b/i,
  /\bon\s+the\s+one\s+hand\b/i,
  /\bit\s+(?:might|may|could)\s+be\s+(?:either|the\s+same|different|both)\b/i,
  /\bdepending\s+on\s+how\s+you\s+look\b/i,
];

/**
 * Does the reasoning HEDGE / refuse to commit to a single answer? A both-sides
 * answer is exactly what the clarifying follow-up exists to resolve. Pure/total.
 */
export function isHedgedReasoning(text: string): boolean {
  return findHedgePhrase(text) !== null;
}

/**
 * Locate the EARLIEST both-sides / hedging phrase in the text (char offsets into
 * the original), or `null` when none is present. The span-level annotator uses
 * this to RED-highlight only the hedge phrase itself (not the whole clause), so a
 * hedge is called out granularly with the candidate's actual words. Pure/total.
 */
export function findHedgePhrase(
  text: string,
): { start: number; end: number } | null {
  const s = text ?? "";
  let best: { start: number; end: number } | null = null;
  for (const re of HEDGE_PATTERNS) {
    const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
    const g = new RegExp(re.source, flags);
    const m = g.exec(s);
    if (m && (best === null || m.index < best.start)) {
      best = { start: m.index, end: m.index + m[0].length };
    }
  }
  return best;
}

/* -------------------------------------------------------------------------- */
/*  Clause splitting (shared with the span-level annotator)                    */
/* -------------------------------------------------------------------------- */

/** A trimmed clause with char offsets into the original text. */
export interface TextClause {
  start: number;
  end: number;
  text: string;
}

/**
 * Split text into clauses, preserving char offsets. Boundaries are clause
 * terminators — `;`, a newline, an arrow (`→`), or a period that is NOT a
 * decimal point (i.e. `.` not immediately followed by a digit, so `0.5` stays
 * intact). Coarse on purpose so a highlighted/root-cause span is a readable
 * phrase. Shared by the annotator (`./annotate`) and the premise-flaw localizer
 * so the highlighted span and the graded verdict come from the SAME clauses.
 */
export function toClauses(text: string): TextClause[] {
  const out: TextClause[] = [];
  const pushRange = (rawStart: number, rawEnd: number) => {
    const raw = text.slice(rawStart, rawEnd);
    if (raw.trim() === "") return;
    const lead = raw.length - raw.replace(/^\s+/, "").length;
    const trail = raw.length - raw.replace(/\s+$/, "").length;
    const start = rawStart + lead;
    const end = rawEnd - trail;
    if (end > start) out.push({ start, end, text: text.slice(start, end) });
  };
  const boundary = /[;\n→]|\.(?!\d)/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = boundary.exec(text)) !== null) {
    const end = m.index + m[0].length; // include the delimiter in the clause
    pushRange(cursor, end);
    cursor = end;
  }
  pushRange(cursor, text.length);
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Premise / decomposition / independence-abuse localization                  */
/* -------------------------------------------------------------------------- */

/**
 * A LOAD-BEARING conceptual flaw located to a specific clause: not a false
 * arithmetic step (that is `findFalseArithmetic`), but a broken PREMISE — a
 * wrong decomposition, an invalid ordering imposed on simultaneous events,
 * abused independence, or a bogus 50/50 assumption. This is the ROOT mistake
 * that invalidates everything downstream, with a concrete "why".
 */
export interface PremiseFlaw {
  /** Short id of the misconception (for eval labeling / metrics). */
  kind: string;
  /** The offending clause exactly as the candidate wrote it. */
  claim: string;
  /** Inclusive start / exclusive end char offsets into the original text. */
  start: number;
  end: number;
  /** Specific explanation of WHY it's wrong and why it dooms the chain. */
  why: string;
}

/** Options for {@link findPremiseFlaw}. */
export interface PremiseFlawOptions {
  /** The question prompt — gates which misconceptions can apply. */
  prompt?: string;
  /** The verifier's numeric answer (skips flagging derivations that REACH it). */
  verifiedAnswer?: number | null;
  /** The value the chain lands on (for the "lands at X instead of Y" copy). */
  statedValue?: number | null;
}

/** One misconception detector: a prompt gate + a clause signal + an explanation. */
interface PremiseFlawRule {
  kind: string;
  /** Whether this misconception can apply to a problem with this prompt. */
  appliesToPrompt: (promptLower: string) => boolean;
  /** Fires when a CLAUSE contains this signal (the flawed premise phrasing). */
  signal: RegExp;
  /**
   * Build the CONTENT-REFERENTIAL explanation: it quotes `claim` (the candidate's
   * own offending clause) so the feedback references what they actually said, then
   * says why it's the wrong premise and nudges toward the fix WITHOUT giving the
   * answer. May cite the stated-vs-verified values. NEVER a generic template.
   */
  why: (ctx: {
    claim: string;
    statedStr: string | null;
    verifiedStr: string | null;
  }) => string;
}

/** Quote the candidate's own words compactly (trim trailing punctuation/length). */
function quoteClaim(claim: string): string {
  let c = (claim ?? "").trim().replace(/[.,;:\u2014-]+$/, "").trim();
  if (c.length > 120) c = c.slice(0, 117).trimEnd() + "\u2026";
  return c;
}

/** Append a "…lands at X instead of Y" tail only when both values are known. */
function landsTail(
  statedStr: string | null,
  verifiedStr: string | null,
  fallback: string,
): string {
  return statedStr !== null && verifiedStr !== null
    ? `That broken step is why the whole chain lands at ${statedStr} instead of ${verifiedStr}.`
    : fallback;
}

/**
 * The misconception library. Deliberately CONSERVATIVE: each rule only applies
 * to prompts where the misconception is possible, and every rule is checked ONLY
 * on derivations that do NOT reach the verified answer (see `findPremiseFlaw`),
 * so a correct derivation is never flagged.
 */
const PREMISE_FLAW_RULES: PremiseFlawRule[] = [
  {
    // Order statistics (max/min of dice/draws): treating a JOINT statistic as a
    // sequential "first die / next die" split — the reported dice-max bug.
    kind: "sequential-order-abuse",
    appliesToPrompt: (p) =>
      /\b(larger|largest|bigger|maximum|max|smaller|smallest|minimum|min|higher|lower)\b/.test(
        p,
      ) &&
      /\b(dice|die|rolled?|rolls|two|three|numbers?|cards?|draws?|values?|coins?)\b/.test(
        p,
      ),
    signal:
      /\bone die\b|\b(next|other|first|second|either|that)\s+die\b|\bthe die\s+(rolls?|shows?|is|lands?)\b|\b50\s?%|\b50\/50\b|\bhalf(?:\s+the\s+time)?\b|\bthe larger is\b|\bthe (max(?:imum)?|min(?:imum)?) is (just|simply|only)\b/i,
    why: ({ claim, statedStr, verifiedStr }) =>
      `Here, you treated the two dice as a sequence \u2014 \u201c${quoteClaim(claim)}\u201d imposes a \u201cfirst die / next die\u201d ordering \u2014 but the dice are rolled at the same time, with no first-vs-next. ` +
      "The larger value depends on BOTH dice together, not on one die\u2019s average, and bigger values come up more often. " +
      landsTail(
        statedStr,
        verifiedStr,
        "That decomposition is what breaks the rest of the chain.",
      ) +
      " Re-count how often the maximum is a high number.",
  },
  {
    // Dependent setup (without replacement / conditioning) treated as independent.
    kind: "independence-abuse",
    appliesToPrompt: (p) =>
      /\bwithout replacement\b|\bconditional\b|\bgiven\b|\bat least one\b|\bmutually exclusive\b|\bdependent\b|\burn\b|\bcards?\b|\bdrawn?\b|\bboth red\b|\bposterior\b/.test(
        p,
      ),
    signal:
      /\bindependent\b|\bindependence\b|\bmultiply(?:ing)? the (?:two )?probabilit|\btreat(?:ed|ing)?[^.]*as independent\b|\bassume(?:d|s)? independence\b|\bp\s*[×*x]\s*p\b/i,
    why: ({ claim, statedStr, verifiedStr }) =>
      `You assumed independence here \u2014 \u201c${quoteClaim(claim)}\u201d multiplies the probabilities as if the draws don\u2019t affect each other \u2014 but this setup is dependent: drawing without replacement (or conditioning on what already happened) changes the later probability. ` +
      landsTail(
        statedStr,
        verifiedStr,
        "Every step built on that independence assumption is off.",
      ) +
      " Recompute the second probability GIVEN the first draw.",
  },
  {
    // Monty-Hall / informed-reveal problems collapsed to a naive 50/50.
    kind: "false-5050",
    appliesToPrompt: (p) =>
      /\bmonty\b|\bswitch\b|\bdoors?\b|\bhost\b|\breveal|\bgoat|\bprize\b/.test(p),
    signal:
      /\b50\/50\b|\b50\s?%|\bfifty[-\s]?fifty\b|\bequally likely\b|\bdoesn'?t matter\b|\bno difference\b|\bsame (?:either way|chance|odds)\b|\bcoin ?flip\b/i,
    why: ({ claim, statedStr, verifiedStr }) =>
      `Calling it a 50/50 here \u2014 \u201c${quoteClaim(claim)}\u201d \u2014 treats the remaining options as equally likely, but the reveal is INFORMED: the host deliberately avoids the prize, so the doors are not a coin-flip and switching is not a wash. ` +
      landsTail(
        statedStr,
        verifiedStr,
        "The whole conclusion inherits that even-split assumption.",
      ) +
      " Re-count which door the host was forced to leave closed.",
  },
  {
    // Sequences: assuming a SIMPLER closed form / pattern than the real one
    // (the reported "the sequence is just n\u00b2" opener) — the premise that
    // sets the whole answer up wrong.
    kind: "oversimplified-pattern",
    appliesToPrompt: (p) =>
      /\bnext term\b|\bsequence\b|\bpattern\b|\bseries\b/.test(p) ||
      /\d+\s*,\s*\d+\s*,\s*\d+/.test(p),
    signal:
      /\b(?:just|simply|only|it'?s|is|assume[ds]?)\s+n\s*(?:\^\s*2|2|\u00b2|squared)(?![\d.])|\bn\s*(?:\^\s*2|\u00b2|squared)\s+(?:sequence|pattern|series)\b|\b(?:just|simply|only)\s+(?:linear|arithmetic|geometric)\b/i,
    why: ({ claim }) =>
      `Here, you assumed the sequence is \u201c${quoteClaim(claim)}\u201d, which is what set your answer up to be wrong. ` +
      "Take another look at the actual terms and the gaps between them \u2014 the real pattern isn\u2019t that simple, so re-derive the rule before plugging in.",
  },
];

/**
 * Locate the single ROOT premise flaw in a derivation, or `null` when none is
 * detected. Scans clauses in order and returns the EARLIEST clause that trips
 * any applicable misconception rule (the root; downstream steps just carry the
 * error). Conservative and non-jailbreakable: it NEVER flags a derivation that
 * REACHES the verified answer, so a correct chain can never be reddened. Pure.
 */
export function findPremiseFlaw(
  text: string,
  opts: PremiseFlawOptions = {},
): PremiseFlaw | null {
  const t = text ?? "";
  if (t.trim() === "") return null;
  const verified = opts.verifiedAnswer ?? null;
  // Guard: a derivation that ARRIVES AT the verified answer is not flagged (no
  // false reds on correct reasoning) — mirrors the grader's "reaches" check.
  if (verified !== null) {
    const tol = 1e-3 + Math.abs(verified) * 1e-6;
    if (statedResultValues(t).some((v) => Math.abs(v - verified) <= tol)) {
      return null;
    }
  }
  const promptLower = (opts.prompt ?? "").toLowerCase();
  const statedStr = opts.statedValue != null ? fmtNum(opts.statedValue) : null;
  const verifiedStr = verified != null ? fmtNum(verified) : null;
  const clauses = toClauses(t);
  const applicable = PREMISE_FLAW_RULES.filter((r) =>
    r.appliesToPrompt(promptLower),
  );
  if (applicable.length === 0) return null;
  for (const c of clauses) {
    for (const rule of applicable) {
      const m = rule.signal.exec(c.text);
      if (m) {
        // GRANULAR: narrow the flaw span to the comma-delimited SEGMENT of the
        // clause that actually contains the misconception phrase, not the whole
        // clause — so the red highlight is the specific broken premise, while
        // still covering the offending claim.
        const seg = commaSegment(c.text, m.index);
        const claim = c.text.slice(seg.start, seg.end);
        return {
          kind: rule.kind,
          claim,
          start: c.start + seg.start,
          end: c.start + seg.end,
          why: rule.why({ claim, statedStr, verifiedStr }),
        };
      }
    }
  }
  return null;
}

/**
 * The comma-delimited segment of `text` that contains char index `idx`, trimmed
 * of surrounding whitespace. Used to narrow a premise-flaw span to the specific
 * offending phrase rather than the whole clause.
 */
function commaSegment(text: string, idx: number): { start: number; end: number } {
  let start = 0;
  for (let i = Math.min(idx, text.length - 1); i >= 0; i--) {
    if (text[i] === ",") {
      start = i + 1;
      break;
    }
  }
  let end = text.length;
  for (let i = idx; i < text.length; i++) {
    if (text[i] === ",") {
      end = i;
      break;
    }
  }
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return { start, end };
}

/* -------------------------------------------------------------------------- */
/*  Mis-identified closed form / wrong pattern (sequence family) — GENERAL      */
/* -------------------------------------------------------------------------- */

/**
 * Extract the leading numeric SEQUENCE from a prompt: the first run of ≥3
 * comma-separated numbers (e.g. "4, 9, 18, 31, 48"). Returns the terms in order,
 * or `[]` when the prompt has no such run (i.e. it isn't a sequence prompt).
 * Pure/total — used to compare a candidate's IMPLIED closed form to reality.
 */
export function parseSequenceTerms(prompt: string): number[] {
  const m = (prompt ?? "").match(
    /-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?){2,}/,
  );
  if (!m) return [];
  return m[0]
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x));
}

/**
 * Evaluate a CLOSED-FORM expression in the single variable `n` at value `n`.
 * Supports `+ - * / ^` (power, right-associative), parentheses, the unicode
 * spellings (`× ÷ · − ² ³`), the words "squared"/"cubed", and IMPLICIT
 * multiplication (`2n`, `2(n+1)`, `n(n+1)`, `(n+1)(n+2)`). Returns the value, or
 * `null` when the string isn't a clean single-variable expression in `n` (a
 * word, another variable, a dangling operator, …). Pure/total; never evals code.
 */
export function evalInN(raw: string, n: number): number | null {
  const s = (raw ?? "")
    .toLowerCase()
    .replace(/\u2212/g, "-")
    .replace(/[×✕⋅·]/g, "*")
    .replace(/\u00f7/g, "/")
    .replace(/\bsquared\b/g, "^2")
    .replace(/\bcubed\b/g, "^3")
    .replace(/\u00b2/g, "^2")
    .replace(/\u00b3/g, "^3")
    .replace(/,/g, "")
    .trim();
  if (s === "" || !/n/.test(s) || !/^[0-9n.\s()+\-*/^]+$/.test(s)) return null;

  type Tok =
    | { t: "num"; v: number }
    | { t: "var" }
    | { t: "op"; v: "+" | "-" | "*" | "/" | "^" }
    | { t: "(" }
    | { t: ")" };
  const toks: Tok[] = [];
  const prevIsValue = (): boolean => {
    const p = toks[toks.length - 1];
    return p != null && (p.t === "num" || p.t === "var" || p.t === ")");
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " ") {
      i++;
      continue;
    }
    if (c === "(") {
      if (prevIsValue()) toks.push({ t: "op", v: "*" }); // implicit ×
      toks.push({ t: "(" });
      i++;
      continue;
    }
    if (c === ")") {
      toks.push({ t: ")" });
      i++;
      continue;
    }
    if (c === "n") {
      if (prevIsValue()) toks.push({ t: "op", v: "*" }); // implicit ×
      toks.push({ t: "var" });
      i++;
      continue;
    }
    if (c === "+" || c === "-" || c === "*" || c === "/" || c === "^") {
      // A leading +/- with no value before it is a UNARY sign (−n, −(…), −3).
      if ((c === "+" || c === "-") && !prevIsValue()) {
        toks.push({ t: "num", v: c === "-" ? -1 : 1 });
        toks.push({ t: "op", v: "*" });
        i++;
        continue;
      }
      toks.push({ t: "op", v: c });
      i++;
      continue;
    }
    const m = s.slice(i).match(/^\d*\.?\d+/);
    if (!m) return null;
    if (prevIsValue()) toks.push({ t: "op", v: "*" });
    toks.push({ t: "num", v: Number(m[0]) });
    i += m[0].length;
  }
  if (toks.length === 0) return null;

  const prec = (op: string): number =>
    op === "^" ? 3 : op === "*" || op === "/" ? 2 : 1;
  const rightAssoc = (op: string): boolean => op === "^";
  const out: Tok[] = [];
  const ops: Tok[] = [];
  for (const tk of toks) {
    if (tk.t === "num" || tk.t === "var") out.push(tk);
    else if (tk.t === "op") {
      let top = ops[ops.length - 1];
      while (
        top &&
        top.t === "op" &&
        (prec(top.v) > prec(tk.v) ||
          (prec(top.v) === prec(tk.v) && !rightAssoc(tk.v)))
      ) {
        out.push(ops.pop()!);
        top = ops[ops.length - 1];
      }
      ops.push(tk);
    } else if (tk.t === "(") ops.push(tk);
    else {
      while (ops.length && ops[ops.length - 1].t !== "(") out.push(ops.pop()!);
      if (!ops.length) return null; // mismatched ")"
      ops.pop();
    }
  }
  while (ops.length) {
    const o = ops.pop()!;
    if (o.t === "(") return null; // mismatched "("
    out.push(o);
  }

  const st: number[] = [];
  for (const tk of out) {
    if (tk.t === "num") st.push(tk.v);
    else if (tk.t === "var") st.push(n);
    else if (tk.t === "op") {
      const b = st.pop();
      const a = st.pop();
      if (a === undefined || b === undefined) return null;
      let r: number;
      switch (tk.v) {
        case "+":
          r = a + b;
          break;
        case "-":
          r = a - b;
          break;
        case "*":
          r = a * b;
          break;
        case "/":
          if (b === 0) return null;
          r = a / b;
          break;
        case "^":
          r = Math.pow(a, b);
          break;
        default:
          return null;
      }
      st.push(r);
    } else return null;
  }
  return st.length === 1 && Number.isFinite(st[0]) ? st[0] : null;
}

/** A mis-identified closed form located in the candidate's own text. */
export interface ClosedFormMismatch {
  /** The candidate's implied closed form, e.g. "(n+1)^2". */
  claim: string;
  /** Inclusive start / exclusive end char offsets into the original text. */
  start: number;
  end: number;
  /** What that closed form actually produces for the first terms. */
  cfOutputs: number[];
  /** The real sequence terms it should have produced. */
  terms: number[];
  /** Content-referential explanation of the mismatch (quotes the claim). */
  why: string;
}

/**
 * GENERAL "wrong pattern" detector for the SEQUENCE family (NO per-misconception
 * rule): parse the prompt's actual terms, find a closed-form expression in `n`
 * the candidate committed to, and EVALUATE it against those terms. When the
 * candidate's implied closed form does NOT reproduce the sequence (for either a
 * 1- or 0-based index), it's the mis-identified root cause — returned with a
 * content-referential `why` that quotes the closed form and shows what it gives
 * vs. what the sequence actually is (e.g. "(n+1)^2 gives 4, 9, 16, 25 — but the
 * sequence is 4, 9, 18, 31"). Returns `null` when the prompt isn't a sequence,
 * no closed form is stated, or the stated form actually FITS (never a false red).
 * Pure/total.
 */
export function findClosedFormMismatch(
  text: string,
  prompt: string,
): ClosedFormMismatch | null {
  const terms = parseSequenceTerms(prompt ?? "");
  if (terms.length < 3) return null;
  const t = text ?? "";
  const K = Math.min(terms.length, 6);
  // Candidate closed forms: a MAXIMAL run of closed-form characters that mentions
  // `n` (so the WHOLE polynomial is captured, e.g. "2n² - n + 3", not just "2n²").
  // Prose/commas/`=` stop the run, so it can't swallow surrounding text.
  const re = /[0-9n.^\u00b2\u00b3()+\-*/×·\u2212\s]*n[0-9n.^\u00b2\u00b3()+\-*/×·\u2212\s]*/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    if (m[0].trim() === "") {
      re.lastIndex++;
      continue;
    }
    const raw = m[0];
    const lead = raw.length - raw.replace(/^\s+/, "").length;
    const trail = raw.length - raw.replace(/\s+$/, "").length;
    const start = m.index + lead;
    const cand = raw.slice(lead, raw.length - trail);
    // Must LOOK like a closed form, not a stray "n" from a word ("then", "n-th").
    const looksClosedForm =
      /[\^\u00b2\u00b3()]/.test(cand) ||
      /\d\s*n|n\s*\d/i.test(cand) ||
      /squared|cubed/i.test(cand);
    if (!looksClosedForm) continue;

    const evalBase = (base: number): number[] | null => {
      const outs: number[] = [];
      for (let k = 0; k < K; k++) {
        const v = evalInN(cand, base + k);
        if (v === null) return null;
        outs.push(v);
      }
      return outs;
    };
    const one = evalBase(1);
    const zero = evalBase(0);
    if (one === null && zero === null) continue; // not a real expression in n

    const fits = (outs: number[] | null): boolean =>
      outs !== null &&
      outs.every(
        (v, i) => Math.abs(v - terms[i]) <= 1e-6 + Math.abs(terms[i]) * 1e-9,
      );
    if (fits(one) || fits(zero)) return null; // stated form is actually correct

    const leadMatch = (outs: number[] | null): number => {
      if (!outs) return -1;
      let i = 0;
      while (i < outs.length && Math.abs(outs[i] - terms[i]) <= 1e-6) i++;
      return i;
    };
    const outs =
      (leadMatch(one) >= leadMatch(zero) ? one : zero) ?? one ?? zero!;
    const shown = outs.map(fmtNum).join(", ");
    const termsShown = terms.slice(0, outs.length).map(fmtNum).join(", ");
    return {
      claim: cand,
      start,
      end: start + cand.length,
      cfOutputs: outs,
      terms,
      why:
        `You used \u201c${cand}\u201d as the pattern, but that gives ${shown} while the ` +
        `sequence is ${termsShown} \u2014 so that closed form doesn\u2019t fit. ` +
        `Re-derive the rule from the actual gaps between the terms before solving.`,
    };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Candidate's COMMITTED formula + per-claim truth checks (sequence family)    */
/* -------------------------------------------------------------------------- */

/** A fresh regex for a maximal closed-form char run that mentions `n`. */
function closedFormRunRegex(): RegExp {
  return /[0-9n.^\u00b2\u00b3()+\-*/×·\u2212\s]*n[0-9n.^\u00b2\u00b3()+\-*/×·\u2212\s]*/gi;
}

/** Does a run LOOK like a real closed form (not a stray `n` from a word)? */
function looksLikeClosedForm(cand: string): boolean {
  return (
    /[\^\u00b2\u00b3()]/.test(cand) ||
    /\d\s*n|n\s*\d/i.test(cand) ||
    /squared|cubed/i.test(cand)
  );
}

/** Leading degree of a closed form (3 for cubic, 2 for quadratic, else 1). */
function closedFormDegree(cand: string): number {
  if (/(\^\s*3|\u00b3|cubed)/i.test(cand)) return 3;
  if (/(\^\s*2|\u00b2|squared)/i.test(cand)) return 2;
  return 1;
}

/** The candidate's COMMITTED closed-form polynomial in n, with its text span. */
export interface CommittedFormula {
  /** The literal closed-form text exactly as written, e.g. "3n^2 - n + 3". */
  claim: string;
  /** Inclusive start / exclusive end char offsets into the original text. */
  start: number;
  end: number;
  /** Detected leading degree (2 for n²/squared, 3 for cubed, else 1). */
  degree: number;
}

/**
 * Parse the candidate's FINAL / COMMITTED closed-form polynomial in `n` — the
 * formula they actually propose (e.g. from "the final equation is 3n^2 - n + 3"),
 * NOT any highlighted substring. Robust to `^`, `n^2`, `3n`, spacing, unicode
 * minus, super/subscripts, and phrasing ("=", "is", "hence") because it simply
 * scans EVERY closed-form run that {@link evalInN} can evaluate and returns the
 * LAST run of the HIGHEST degree seen — i.e. the most complete polynomial the
 * candidate committed to. Pure/total; `null` when no evaluable closed form
 * appears. This parsed formula is what the verifier evaluates and critiques.
 */
export function parseCommittedClosedForm(text: string): CommittedFormula | null {
  const t = text ?? "";
  const re = closedFormRunRegex();
  const cands: CommittedFormula[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    if (m[0].trim() === "") {
      re.lastIndex++;
      continue;
    }
    const raw = m[0];
    // Trim surrounding whitespace AND dangling sentence dots (`.` is in the run
    // class, so "3n^2 + 3." would otherwise fail to evaluate) — then adjust the
    // offsets so the span still points at the exact formula text.
    const lead = raw.length - raw.replace(/^[\s.]+/, "").length;
    const trail = raw.length - raw.replace(/[\s.]+$/, "").length;
    const start = m.index + lead;
    const cand = raw.slice(lead, raw.length - trail);
    if (!looksLikeClosedForm(cand)) continue;
    if (evalInN(cand, 1) === null) continue;
    cands.push({
      claim: cand,
      start,
      end: start + cand.length,
      degree: closedFormDegree(cand),
    });
  }
  if (cands.length === 0) return null;
  const maxDeg = Math.max(...cands.map((c) => c.degree));
  const top = cands.filter((c) => c.degree === maxDeg);
  return top[top.length - 1]; // last, highest-degree form = the committed one
}

/** A concrete first-divergence counterexample for the candidate's OWN formula. */
export interface FormulaCounterexample {
  /** The candidate's committed formula text, e.g. "3n^2 - n + 3". */
  formula: string;
  /** Inclusive start / exclusive end char offsets of the formula in the text. */
  start: number;
  end: number;
  /** The index base (1 or 0) that best matches the leading terms. */
  base: number;
  /** The first `n` (in the candidate's own indexing) where it diverges. */
  n: number;
  /** The value the candidate's formula produces at that `n`. */
  candidateValue: number;
  /** The true sequence term at that `n`. */
  trueValue: number;
  /** Terse counterexample: "your formula 3n^2 - n + 3 gives 13 at n=2 but the sequence is 11". */
  counterexample: string;
  /** Content-referential explanation that QUOTES the committed formula. */
  why: string;
}

/**
 * Evaluate the candidate's COMMITTED formula (see {@link parseCommittedClosedForm})
 * against the prompt's ACTUAL sequence terms and return a CONCRETE first-divergence
 * counterexample — the earliest `n` where `candidate_formula(n) ≠ true_term(n)`,
 * quoted with the real numbers ("gives 13 at n=2 but the sequence is 11"). It
 * critiques the formula the candidate ACTUALLY wrote, never a mis-read substring
 * or an expression they never committed to. Returns `null` when the prompt isn't
 * a sequence, no committed form is parseable, or the committed form actually FITS
 * (so a correct derivation is never flagged). Pure/total.
 */
export function checkCommittedFormula(
  text: string,
  prompt: string,
): FormulaCounterexample | null {
  const terms = parseSequenceTerms(prompt ?? "");
  if (terms.length < 3) return null;
  const cf = parseCommittedClosedForm(text ?? "");
  if (!cf) return null;
  const K = terms.length;
  const evalBase = (base: number): (number | null)[] => {
    const outs: (number | null)[] = [];
    for (let k = 0; k < K; k++) outs.push(evalInN(cf.claim, base + k));
    return outs;
  };
  const tolAt = (i: number) => 1e-6 + Math.abs(terms[i]) * 1e-9;
  const fits = (outs: (number | null)[]): boolean =>
    outs.every((v, i) => v !== null && Math.abs((v as number) - terms[i]) <= tolAt(i));
  const leadMatch = (outs: (number | null)[]): number => {
    let i = 0;
    while (i < outs.length && outs[i] !== null && Math.abs((outs[i] as number) - terms[i]) <= tolAt(i)) i++;
    return i;
  };
  const firstDivergence = (outs: (number | null)[]): number => {
    for (let k = 0; k < outs.length; k++) {
      const v = outs[k];
      if (v !== null && Math.abs(v - terms[k]) > tolAt(k)) return k;
    }
    return -1;
  };
  const one = evalBase(1);
  const zero = evalBase(0);
  if (fits(one) || fits(zero)) return null; // committed form is actually correct
  const useOne = leadMatch(one) >= leadMatch(zero);
  const base = useOne ? 1 : 0;
  const outs = useOne ? one : zero;
  const idx = firstDivergence(outs);
  if (idx < 0) return null; // no clean numeric counterexample (only null gaps)
  const nIndex = base === 1 ? idx + 1 : idx;
  const candVal = outs[idx] as number;
  const trueVal = terms[idx];
  const counterexample =
    `your formula ${cf.claim} gives ${fmtNum(candVal)} at n=${nIndex} but the ` +
    `sequence is ${fmtNum(trueVal)}`;
  const why =
    `Your committed formula \u201c${cf.claim}\u201d gives ${fmtNum(candVal)} at n=${nIndex}, ` +
    `but the sequence is ${fmtNum(trueVal)} \u2014 so it doesn't fit. Re-derive the rule ` +
    `from the actual gaps between the terms before solving.`;
  return {
    formula: cf.claim,
    start: cf.start,
    end: cf.end,
    base,
    n: nIndex,
    candidateValue: candVal,
    trueValue: trueVal,
    counterexample,
    why,
  };
}

/** A false per-`n` residual/pattern claim, localized to its literal text span. */
export interface ResidualClaimFlaw {
  kind: "false-residual-claim";
  /** The offending segment exactly as the candidate wrote it ("1 more at n=2"). */
  claim: string;
  /** Inclusive start / exclusive end char offsets into the original text. */
  start: number;
  end: number;
  /** The base expression the residual is measured against (e.g. "3n^2"). */
  baseExpr: string;
  /** The `n` at which the claim is false. */
  n: number;
  /** The base expression's value at that `n`. */
  exprValue: number;
  /** The true sequence term at that `n`. */
  trueValue: number;
  /** Content-referential explanation with the verifier's real numbers. */
  why: string;
}

const RESIDUAL_DIR_MORE = /^(more|above|over|greater|higher|bigger|extra)$/i;
const RESIDUAL_DIR_LESS = /^(less|below|under|lower|smaller|fewer|short)$/i;

/**
 * PER-CLAIM truth check for residual / pattern assertions of the form
 * "<delta> more/less than <expr> at n=k" (and elided follow-ons like "1 more at
 * n=2"). It anchors the base expression from the first "... than <expr>", then
 * verifies EACH asserted delta against the real term: `expr(k) + ±delta` must
 * equal `true_term(k)`. Returns the EARLIEST false claim (by text position) with
 * a concrete counterexample using the candidate's own base expression and the
 * verifier's real numbers ("3n^2 is 12 at n=2 and the term is 11 — 1 less, not 1
 * more"). This is earlier and more load-bearing than the final formula line.
 * Returns `null` when the prompt isn't a sequence, no residual is asserted, or
 * every asserted residual holds (so a correct derivation is never flagged).
 * Pure/total.
 */
export function findFalseResidualClaim(
  text: string,
  prompt: string,
): ResidualClaimFlaw | null {
  const terms = parseSequenceTerms(prompt ?? "");
  if (terms.length < 3) return null;
  const t = text ?? "";
  // A residual claim is "<delta> <dir> [than <expr>] [at] n=k" — the delta must be
  // ADJACENT to the n=k (only the optional dir / "than expr" / "at" between), so a
  // stray number elsewhere (e.g. the "a = 3" coefficient) can never be misread as
  // the residual. A direction word is REQUIRED, which also excludes the exponent
  // in "3n^2 at n=1". The base <expr> is anchored from the first claim that states
  // "than <expr>"; later elided claims ("1 more at n=2") reuse it.
  const re =
    /(-?\d+(?:\.\d+)?)\s*(more|less|above|below|over|under|greater|higher|lower|bigger|smaller|extra|fewer)\s*(?:than\s+([0-9n.^\u00b2\u00b3()+\-*/×·\u2212\s]*n[0-9n.^\u00b2\u00b3()+\-*/×·\u2212\s]*?)\s*)?(?:at\s+)?n\s*=\s*(\d+)/gi;
  let m: RegExpExecArray | null;
  let baseExpr: string | null = null;
  const flaws: ResidualClaimFlaw[] = [];
  while ((m = re.exec(t)) !== null) {
    const delta = Number(m[1]);
    const dir = (m[2] ?? "").toLowerCase();
    const exprRaw = (m[3] ?? "").trim();
    const k = Number(m[4]);
    if (exprRaw !== "" && looksLikeClosedForm(exprRaw) && evalInN(exprRaw, 1) !== null) {
      baseExpr = exprRaw; // anchor / re-anchor the base expression
    }
    if (baseExpr === null) continue; // no expression stated yet — can't verify
    if (!Number.isFinite(delta) || !Number.isInteger(k) || k < 1 || k > terms.length) continue;
    const sign = RESIDUAL_DIR_MORE.test(dir) ? 1 : RESIDUAL_DIR_LESS.test(dir) ? -1 : 1;
    const exprVal = evalInN(baseExpr, k);
    if (exprVal === null) continue;
    const trueVal = terms[k - 1];
    const asserted = exprVal + sign * delta;
    if (Math.abs(asserted - trueVal) <= 1e-6) continue; // this claim holds — not a flaw
    const start = m.index;
    const end = m.index + m[0].length;
    const claim = t.slice(start, end).trim();
    const realResidual = trueVal - exprVal;
    const realDir = realResidual >= 0 ? "more" : "less";
    const why =
      `You wrote \u201c${claim}\u201d, but ${baseExpr} is ${fmtNum(exprVal)} at n=${k} and ` +
      `the term is ${fmtNum(trueVal)} \u2014 that's ${fmtNum(Math.abs(realResidual))} ${realDir}, ` +
      `not ${fmtNum(Math.abs(delta))} ${sign >= 0 ? "more" : "less"}. Re-check this gap ` +
      `before fixing the formula.`;
    flaws.push({
      kind: "false-residual-claim",
      claim,
      start,
      end,
      baseExpr,
      n: k,
      exprValue: exprVal,
      trueValue: trueVal,
      why,
    });
  }
  if (flaws.length === 0) return null;
  flaws.sort((a, b) => a.start - b.start);
  return flaws[0]; // earliest false claim = the primary, load-bearing root cause
}

/**
 * Build a commitment-forcing clarify prompt for a MAIN question whose reasoning
 * was ambiguous (mixed / hedged / contradictory). Generic but still forces a
 * single committed answer + one clean reason. Pure.
 */
export function buildReasoningClarifyPrompt(_input: ReasoningInput): string {
  return (
    "Your explanation points both ways instead of committing. State your ONE " +
    "final answer and give the single reason it's correct — no both-sides, no " +
    "contradictions."
  );
}

/**
 * A small deterministic probe bank keyed loosely by whether the answer was
 * right. Never reveals the answer; nudges toward the flaw / a harder framing.
 */
function pickProbe(input: ReasoningInput): string {
  const { correct, isMentalMath } = input;
  if (!correct) {
    return isMentalMath
      ? "Re-estimate the order of magnitude first — does your number pass a sanity check?"
      : "Which assumption in your setup would you defend if I pushed back on it?";
  }
  return isMentalMath
    ? "If one of the operands doubled, how does the answer move — instantly?"
    : "Walk me through why that's exactly right and not just approximately.";
}

/**
 * Deterministically grade reasoning quality. Rules (contract-faithful):
 *
 *  • FALSE STATED STEP (highest priority): if the text asserts an arithmetic
 *    equality that does NOT hold — in words ("1 divided by 2 is 5") or symbols
 *    ("3 × 1/2 = 3/8") — the reasoning is `flawed`, with feedback naming the
 *    false step. This applies EVEN to mental math and EVEN when the final answer
 *    is correct: a wrong stated computation is never acceptable.
 *  • MENTAL MATH: terse-but-correct is fine — a correct number is `sound` even
 *    with zero prose (brevity is NEVER penalized). A wrong mental-math answer is
 *    `partial` if any work is shown, else `vague`; truly empty is `absent`.
 *  • NON-MENTAL-MATH: the reasoning must actually ENGAGE the problem — use the
 *    given quantities or show a real computation, not just name-drop buzzwords
 *    ("probability", "so", …). Hand-wavy text is `vague` even when the final
 *    answer is CORRECT (so "correct-but-vague" is caught), because a candidate
 *    who can't show their work will fold under pressure. Reasoning that concludes
 *    a value contradicting the verified answer is never `sound` (→ `partial`). A
 *    wrong answer with real structure is `partial`.
 *
 * INVARIANT: this NEVER flips correctness. `input.correct` is the verifier's
 * verdict; it only shapes the quality wording — no branch changes it.
 */
export function gradeReasoningDeterministic(
  input: ReasoningInput,
): ReasoningGrade {
  const text = (input.reasoning ?? "").trim();
  const words = wordCount(text);
  const isMM = input.isMentalMath === true;

  const setupNums = numbersIn(input.prompt);
  const textNums = numbersIn(text);
  const referencesSetup =
    setupNums.size > 0 && [...setupNums].some((n) => textNums.has(n));
  const lower = text.toLowerCase();
  // "Showing work" for MM stays permissive (a shortcut may be a bare number).
  const showsWork =
    textNums.size > 0 || REASONING_MARKERS.some((m) => lower.includes(m));
  // Genuine engagement: uses the given quantities, OR writes a real arithmetic
  // relation, OR reasons over multiple concrete numbers. Buzzwords ALONE (no
  // numbers, no operators) never count — that's the marker-word-vague hole.
  const hasArithmetic = /\d/.test(text) && /[=+\-*/×÷]/.test(text);
  const engagesQuantities =
    setupNums.size > 0
      ? referencesSetup || hasArithmetic
      : // No numeric setup (conceptual): demand a substantive, connected
        // explanation rather than a terse assertion.
        words >= 8 && REASONING_MARKERS.some((m) => lower.includes(m));
  // Does the written derivation actually land on a value that CONTRADICTS the
  // verifier's ground-truth answer? We grade against the VERIFIED SOLUTION
  // SPACE, not a single canonical script: a derivation is consistent if it
  // ARRIVES AT the verified answer by ANY route — the value after any `=`/`→`,
  // OR the final numeric token (a prose conclusion like "… which is 95"). This
  // is what fixes the false negative where "…24 + 6 = 30 … which is 95" was
  // wrongly read as concluding 30 (the value after the LAST `=`) and rejected.
  //
  // The non-jailbreak guard is PRESERVED: we still flag a broken derivation when
  // the work never reaches the verified answer AND lands on a contradicting
  // number (right answer typed, but the shown steps conclude something else).
  const verifiedAnswer = parseNumericValue(input.correctAnswer);
  const answerTol =
    verifiedAnswer !== null ? 1e-3 + Math.abs(verifiedAnswer) * 1e-6 : 0;
  const hasResultMarker = text.includes("=") || text.includes("→");
  const results = statedResultValues(text);
  const reachesVerified =
    verifiedAnswer !== null &&
    results.some((v) => Math.abs(v - verifiedAnswer) <= answerTol);
  const allValues = allValuesIn(text);
  const landingValue =
    allValues.length > 0 ? allValues[allValues.length - 1] : null;
  const contradictsVerified =
    verifiedAnswer !== null &&
    hasResultMarker &&
    !reachesVerified &&
    landingValue !== null &&
    Math.abs(landingValue - verifiedAnswer) > answerTol;
  const brokenDerivation = contradictsVerified;
  // A demonstrably FALSE stated computation (in words or symbols). This is the
  // strongest negative signal and OVERRIDES everything below — a wrong stated
  // computation is never acceptable, not even for mental-math brevity, and it
  // stands even when the final answer is CORRECT (the "1 ÷ 2 is 5 … 0.5" bug).
  const falseArith =
    findFalseArithmetic(text) ??
    (hasArithmeticContradiction(text)
      ? {
          claim: text.trim(),
          correct: NaN,
          stated: NaN,
          message:
            "One of your stated equalities doesn't hold — recheck the arithmetic in that step; the numbers you wrote don't produce that result.",
        }
      : null);

  // Per-question REQUIRED-JUSTIFICATION gate. When a question authors mechanism
  // signals, a `sound` verdict REQUIRES the reasoning to convey the underlying
  // mechanism — not merely restate the final answer/arithmetic or assert it's
  // correct. This is the fix for the reported leniency ("the math checks out and
  // 65 + 30 is 95" was wrongly graded sound). The universal hand-wave guard
  // (below) applies even when a question authors no signals.
  const signals = input.mechanismSignals ?? [];
  const requiresMechanism = signals.length > 0;
  // Drop any BARE-ANSWER-VALUE "signal" (e.g. "0.75"/"3/4" for a 0.75 answer):
  // restating the numeric answer must never, by itself, satisfy the mechanism
  // gate. Formulaic signals with letters (e.g. "3n^2", "2m-1") are kept.
  const mechSignals = mechanismSignalsSansAnswerValue(signals, verifiedAnswer);
  const hasMechanism = requiresMechanism && matchesMechanismSignal(text, mechSignals);
  const handWaveOnly = isHandWaveOnly(text, input.bannedAsSoleJustification ?? []);

  // A broken PREMISE / decomposition / independence-abuse — the ROOT conceptual
  // flaw, distinct from a false arithmetic step. Only consulted when the answer
  // is WRONG (verifier says so) or the derivation contradicts the verified
  // answer, and `findPremiseFlaw` itself never fires on a chain that reaches the
  // verified answer — so a correct derivation is never mislabeled. This drives
  // the verdict off the LOCALIZED root cause: a wrong-premise-wrong-answer
  // derivation reads `flawed`, never a lenient "mostly there" partial.
  const premiseFlaw =
    !input.correct || brokenDerivation
      ? findPremiseFlaw(text, {
          prompt: input.prompt,
          verifiedAnswer,
          statedValue: landingValue,
        })
      : null;

  // A MIS-IDENTIFIED CLOSED FORM (sequence family), detected GENERICALLY by
  // comparing the candidate's implied closed form's outputs to the actual terms
  // — no per-misconception rule. This catches novel wrong patterns like the
  // reported "(n+1)²" opener (which gives 4, 9, 16, 25, not the real sequence).
  // Only consulted on a wrong / contradicting derivation, and it never fires
  // when the stated form actually fits, so a correct chain is never mislabeled.
  const closedFormFlaw =
    !input.correct || brokenDerivation
      ? findClosedFormMismatch(text, input.prompt)
      : null;

  let quality: ReasoningQuality;
  const issues: string[] = [];

  if (falseArith) {
    quality = "flawed";
    issues.push(falseArith.message);
  } else if (text === "") {
    quality = "absent";
    if (!(isMM && input.correct)) {
      // A correct mental-math answer needs no prose; anything else does.
      issues.push("No reasoning was given — state your steps, not just a number.");
    } else {
      // Correct MM with no prose is still `sound` per the contract.
      quality = "sound";
    }
  } else if (isMM) {
    if (input.correct) {
      quality = "sound"; // fast correct number — brevity is fine
    } else if (showsWork) {
      quality = "partial";
      issues.push("The method is visible but the arithmetic lands wrong — recheck a step.");
    } else {
      quality = "vague";
      issues.push("Just a number with no check — show the shortcut you used.");
    }
  } else if (isUninterpretable(text)) {
    // GARBLED / nonsensical: the text cannot be parsed into any claim. This is
    // the "Response not understood" case — DISTINCT from a both-sides hedge
    // (`ambiguous`) and from a readable hand-wave (`vague`). Never correct,
    // never silently wrong; the UI shows an accurate not-understood message.
    quality = "uninterpretable";
    issues.push(
      "I couldn't understand that response — it doesn't read as a claim about the problem. Restate your reasoning in plain words and commit to ONE answer.",
    );
  } else if (
    isHedgedReasoning(text) &&
    (input.correct ||
      reachesVerified ||
      hasMechanism ||
      (verifiedAnswer !== null &&
        allValues.some((v) => Math.abs(v - verifiedAnswer) <= answerTol)))
  ) {
    // MIXED / both-sides / hedged reasoning WITH genuine correct footing (the
    // right value is present, a valid mechanism is named, or the verifier marked
    // the answer correct). Only THIS earns a clarifying second chance: the
    // candidate has real correct content and only needs to commit to one side.
    // A footingless hedge ("could be either, not sure" with nothing correct) is
    // NOT ambiguous — it falls through to a WRONG verdict below (no second
    // chance), per the strict confirm/clarify gate.
    quality = "ambiguous";
    issues.push(
      "Your explanation points both ways instead of committing — pick ONE answer and give the single reason it's correct.",
    );
  } else if (premiseFlaw || closedFormFlaw) {
    // ROOT PREMISE broken (wrong decomposition / imposed ordering / abused
    // independence / bogus 50/50) OR a MIS-IDENTIFIED CLOSED FORM whose outputs
    // don't reproduce the sequence. Either is a genuinely-flawed derivation, not
    // a near-miss: the localized root cause invalidates everything downstream, so
    // a wrong committed answer reads `flawed`, never a lenient "mostly there".
    quality = "flawed";
    issues.push(closedFormFlaw ? closedFormFlaw.why : premiseFlaw!.why);
  } else if (words < 4 || (!engagesQuantities && !hasMechanism)) {
    // Hand-wavy / buzzword-only — vague even if the final answer is correct.
    // A genuine MECHANISM statement counts as engaging the problem even when it
    // doesn't re-plug the setup numbers (so terse-but-correct mechanism prose
    // like "second differences are constant at 6, so the next gap is 30" isn't
    // wrongly charged as vague).
    quality = "vague";
    if (setupNums.size > 0 && !referencesSetup) {
      issues.push("Doesn't engage the given quantities — plug the actual numbers in, don't just assert.");
    } else {
      issues.push("Hand-wavy — name-dropping terms isn't reasoning; show the derivation step by step.");
    }
  } else if (!input.correct) {
    quality = "partial";
    issues.push(
      "Reasoning is structured but reaches the wrong result — the earliest broken step is highlighted above; fix that, since the later steps just carry the error forward.",
    );
  } else if (brokenDerivation) {
    // Final number is right, but the written work doesn't actually support it.
    quality = "partial";
    issues.push("Your final number is right, but the written derivation doesn't hold — the steps don't produce that result.");
  } else if (requiresMechanism && !hasMechanism) {
    // Correct + structured, but the explanation only RESTATES the final answer /
    // last arithmetic or asserts correctness — it never articulates the
    // MECHANISM that justifies the result. This is the exact leniency bug:
    // "because the math checks out and 65 + 30 is 95" is NOT sound.
    quality = "partial";
    issues.push(
      "You stated the answer/arithmetic but not WHY the rule holds — name the " +
        "underlying mechanism that justifies it (what stays constant, the rule " +
        "that generates the next step), not just the final computation.",
    );
  } else if (handWaveOnly) {
    // Universal hand-wave guard: asserting it's correct ("the math checks out /
    // it's obvious / trust me") with no mechanism is never sound, even when the
    // final answer is right.
    quality = "vague";
    issues.push(
      "Asserting it's correct isn't reasoning — show the mechanism, not just " +
        "that \u201cthe math checks out.\u201d",
    );
  } else {
    quality = "sound";
  }

  return {
    quality,
    issues,
    probe: pickProbe(input),
    source: "deterministic",
  };
}

/**
 * Normalize a raw `mock-reason-grade` payload into a `ReasoningGrade`, applying
 * the contract's safe defaults for any missing/wrong-typed field. Correctness is
 * NEVER read from the payload (the schema has no such field) — this only lifts
 * quality/issues/probe. Pure and defensive: never throws on malformed input.
 */
export function normalizeReasoningPayload(
  payload: Record<string, unknown> | null,
): ReasoningGrade {
  const qualities: ReasoningQuality[] = [
    "sound",
    "partial",
    "flawed",
    "ambiguous",
    "uninterpretable",
    "vague",
    "absent",
  ];
  const rawQuality = payload?.["reasoningQuality"];
  const quality: ReasoningQuality =
    typeof rawQuality === "string" &&
    (qualities as string[]).includes(rawQuality)
      ? (rawQuality as ReasoningQuality)
      : "partial"; // contract default

  const rawIssues = payload?.["issues"];
  const issues = Array.isArray(rawIssues)
    ? rawIssues.filter((s): s is string => typeof s === "string" && s.trim() !== "")
    : [];

  const rawProbe = payload?.["probe"];
  const probe = typeof rawProbe === "string" ? rawProbe : "";

  // A conflict-specific clarify question only matters for the ambiguous verdict;
  // ignore it otherwise so a stray field can never trigger a needless clarify.
  const rawClarify = payload?.["clarifyPrompt"];
  const clarifyPrompt =
    quality === "ambiguous" &&
    typeof rawClarify === "string" &&
    rawClarify.trim() !== ""
      ? rawClarify.trim()
      : undefined;

  return {
    quality,
    issues,
    probe,
    source: "ai",
    ...(clarifyPrompt ? { clarifyPrompt } : {}),
  };
}
