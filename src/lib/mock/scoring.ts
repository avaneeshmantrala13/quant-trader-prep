import { gradeFreeResponse } from "@/lib/numeric";
import type { MathScore, MathStep, TimingBand } from "./types";

/**
 * Deterministic scoring for the spoken mental-math portion.
 *
 * A spoken answer arrives as free text ("forty two", "three hundred", "one
 * point five", "50 percent"). We first normalize English number words to a
 * numeric/expression string, then grade with the shared tolerant parser
 * `@/lib/numeric#gradeFreeResponse` (which already handles digits, fractions,
 * decimals, percentages, and simple arithmetic expressions). This keeps the
 * math grading EXACT and identical whether the learner spoke or typed.
 *
 * Timing is reported as a band relative to the step's `targetMs`, but it never
 * changes the correctness score — a right answer is right regardless of pace.
 */

/* -------------------------------------------------------------------------- */
/*  Spoken-number normalization (English words → numeric string)              */
/* -------------------------------------------------------------------------- */

const SMALL: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};

const MAGNITUDE: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  million: 1000000,
  billion: 1000000000,
};

/** Standalone fraction words → their decimal-safe fraction string. */
const FRACTION_WORDS: Record<string, string> = {
  half: "1/2",
  halves: "1/2",
  third: "1/3",
  thirds: "1/3",
  quarter: "1/4",
  quarters: "1/4",
  fourth: "1/4",
  fourths: "1/4",
  fifth: "1/5",
  fifths: "1/5",
  eighth: "1/8",
  eighths: "1/8",
};

/**
 * Convert a run of English number words to a number, or `null` if the tokens do
 * not form a recognizable whole/compound number. Handles up to billions and
 * compound forms like "three hundred forty two" and "twelve hundred".
 */
function wordsToInteger(tokens: string[]): number | null {
  if (tokens.length === 0) return null;
  let total = 0;
  let current = 0;
  let matchedAny = false;
  for (const tok of tokens) {
    if (tok === "and") continue; // "three hundred and five"
    if (tok in SMALL) {
      current += SMALL[tok];
      matchedAny = true;
    } else if (tok === "hundred") {
      current = (current === 0 ? 1 : current) * 100;
      matchedAny = true;
    } else if (tok in MAGNITUDE) {
      const mag = MAGNITUDE[tok];
      current = (current === 0 ? 1 : current) * mag;
      total += current;
      current = 0;
      matchedAny = true;
    } else {
      return null; // unknown word — not a pure number phrase
    }
  }
  if (!matchedAny) return null;
  return total + current;
}

/**
 * Normalize a spoken/typed answer string into something `@/lib/numeric` can
 * grade. Digit forms pass through untouched; English number words (including a
 * "point" decimal, trailing "percent", and common fraction words) are converted
 * to a numeric/expression string. Returns the ORIGINAL string when no
 * conversion applies, so typed input like "3/8" or "(3+1)/8" is preserved.
 */
export function normalizeSpokenNumber(raw: string): string {
  if (raw == null) return "";
  const trimmed = raw.trim();
  if (trimmed === "") return "";

  // Fast path: already contains a digit → leave for the tolerant parser
  // (but still translate a trailing "percent" word to "%").
  const percentWord = /\bpercent\b/i.test(trimmed);
  if (/\d/.test(trimmed)) {
    const cleaned = trimmed
      .replace(/\bpercent\b/gi, "%")
      .replace(/\s+/g, " ")
      .replace(/\s*%/g, "%")
      .trim();
    return cleaned;
  }

  let s = trimmed.toLowerCase();
  s = s.replace(/[.,!?]+$/g, ""); // strip trailing punctuation from ASR
  s = s.replace(/-/g, " "); // "forty-two" → "forty two"
  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";

  // Standalone fraction word (e.g. "a half", "one third" handled below too).
  if (tokens.length === 1 && tokens[0] in FRACTION_WORDS) {
    return FRACTION_WORDS[tokens[0]];
  }

  // "<int> <fractionword>" e.g. "one third", "three quarters".
  if (tokens.length === 2 && tokens[1] in FRACTION_WORDS) {
    const numWord = tokens[0] === "a" || tokens[0] === "an" ? "one" : tokens[0];
    const n = wordsToInteger([numWord]);
    const frac = FRACTION_WORDS[tokens[1]];
    const den = frac.split("/")[1];
    if (n !== null && den) return `${n}/${den}`;
  }

  // Split on "point" for decimals: "one point five" → 1 . 5
  const pointIdx = tokens.indexOf("point");
  if (pointIdx !== -1) {
    const intPart = wordsToInteger(tokens.slice(0, pointIdx));
    const fracTokens = tokens.slice(pointIdx + 1);
    // Decimal digits are read one-by-one: "point five" → .5, "point two five" → .25
    let fracDigits = "";
    for (const t of fracTokens) {
      if (t in SMALL && SMALL[t] < 10) fracDigits += String(SMALL[t]);
      else if (t === "percent") break;
      else return trimmed; // unrecognized after point → give up, pass through
    }
    const whole = intPart ?? 0;
    if (fracDigits === "") return trimmed;
    const num = `${whole}.${fracDigits}`;
    return percentWord ? `${num}%` : num;
  }

  // Plain integer phrase.
  const numberTokens = tokens.filter((t) => t !== "percent");
  const n = wordsToInteger(numberTokens);
  if (n === null) return trimmed; // not a recognizable number phrase
  return percentWord ? `${n}%` : String(n);
}

/* -------------------------------------------------------------------------- */
/*  Timing + scoring                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Classify how quickly a math answer arrived relative to its target. `fast` ≤
 * target, `ok` ≤ 2× target, else `slow`. Pure and deterministic.
 */
export function classifyTiming(elapsedMs: number, targetMs: number): TimingBand {
  const t = Math.max(0, elapsedMs);
  if (t <= targetMs) return "fast";
  if (t <= targetMs * 2) return "ok";
  return "slow";
}

/**
 * Grade one spoken/typed math answer against a `MathStep`. Deterministic:
 * identical (step, raw, elapsedMs) always yields an identical score. Correctness
 * comes entirely from `@/lib/numeric`; timing is reported but never alters the
 * correctness score.
 */
export function scoreMathAnswer(
  step: Pick<MathStep, "answer" | "decimals" | "commonErrors" | "targetMs">,
  raw: string,
  elapsedMs: number,
): MathScore {
  const normalized = normalizeSpokenNumber(raw);
  const grade = gradeFreeResponse(
    { answer: step.answer, decimals: step.decimals, commonErrors: step.commonErrors },
    normalized,
  );
  const timing = classifyTiming(elapsedMs, step.targetMs);
  return {
    parsed: grade.parsed,
    correct: grade.correct,
    matchedError: grade.matchedError,
    elapsedMs: Math.max(0, elapsedMs),
    targetMs: step.targetMs,
    timing,
    score: grade.correct ? 1 : 0,
  };
}
