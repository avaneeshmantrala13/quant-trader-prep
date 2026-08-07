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

/**
 * Detect an internally-inconsistent binary computation of the form
 * `"a <op> b = c"` (e.g. `"3 × 1/2 = 3/8"`, where 3·0.5 = 1.5 ≠ 0.375). Returns
 * `true` iff a clean, fully-numeric such statement is found whose left side does
 * NOT equal its stated result — a deterministic signal that the *written
 * derivation* is broken regardless of the final answer. Conservative: it only
 * fires on a fully-parseable `num op num = num`, so real prose never trips it.
 */
export function hasArithmeticContradiction(text: string): boolean {
  const re =
    /([+-]?\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)\s*([+\-*/×÷])\s*([+-]?\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)\s*=\s*([+-]?\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const a = parseNumericValue(m[1].replace(/\s+/g, ""));
    const b = parseNumericValue(m[3].replace(/\s+/g, ""));
    const c = parseNumericValue(m[4].replace(/\s+/g, ""));
    if (a === null || b === null || c === null) continue;
    let computed: number | null = null;
    switch (m[2]) {
      case "+":
        computed = a + b;
        break;
      case "-":
        computed = a - b;
        break;
      case "*":
      case "×":
        computed = a * b;
        break;
      case "/":
      case "÷":
        computed = b !== 0 ? a / b : null;
        break;
    }
    if (computed === null) continue;
    const tol = 1e-6 + Math.abs(c) * 1e-6;
    if (Math.abs(computed - c) > tol) return true;
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
  return !CONTENT_MARKERS.some((m) => residual.includes(m));
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
  const lower = (text ?? "").toLowerCase();
  return HEDGE_PATTERNS.some((re) => re.test(lower));
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
  // The written derivation contradicts itself, or concludes a value that
  // disagrees with the verifier's ground-truth answer. We only trust a
  // "concluded" value when the text actually states a result (after `=`/`→`);
  // otherwise the first number in prose is NOT a conclusion.
  const verifiedAnswer = parseNumericValue(input.correctAnswer);
  const hasResultMarker = text.includes("=") || text.includes("→");
  const concluded = hasResultMarker ? lastComputedValue(text) : null;
  const contradictsVerified =
    verifiedAnswer !== null &&
    concluded !== null &&
    Math.abs(concluded - verifiedAnswer) >
      1e-3 + Math.abs(verifiedAnswer) * 1e-6;
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
  const hasMechanism = requiresMechanism && matchesMechanismSignal(text, signals);
  const handWaveOnly = isHandWaveOnly(text, input.bannedAsSoleJustification ?? []);

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
  } else if (isHedgedReasoning(text)) {
    // MIXED / both-sides / hedged reasoning: the candidate points both ways
    // instead of committing. NEVER treat this as sound and NEVER silently mark
    // it wrong — it triggers a CLARIFYING follow-up (the caller reads the
    // `ambiguous` quality and forces a single committed answer).
    quality = "ambiguous";
    issues.push(
      "Your explanation points both ways instead of committing — pick ONE answer and give the single reason it's correct.",
    );
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
    issues.push("Reasoning is structured but reaches the wrong result — locate the broken step.");
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
