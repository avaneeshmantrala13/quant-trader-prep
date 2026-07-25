/**
 * Answer-WITHHOLDING guard (PHASE_2 §5, invariant).
 *
 * Research anchor: Shute 2008 & Van der Kleij, Feskens & Eggen 2015 — elaborated,
 * answer-WITHHOLDING feedback (d ≈ 0.49) is far more effective than bare
 * right/wrong feedback (d ≈ 0.05). Hint-ladder rungs 1–4 must therefore guide
 * the learner toward the answer WITHOUT stating it; only rung 5 ("reveal") may
 * contain the final answer.
 *
 * This is the deterministic verifier used to ASSERT that property (client + the
 * Phase-7 server re-check): `containsFinalAnswer(text, answer)` must be `false`
 * for every rung 1–4 text. It matches the final answer whether written as a
 * plain number, a `$1,000`-style currency figure, a percentage, or an `a/b`
 * fraction, and it is tolerant of formatting noise (commas, symbols, spacing).
 */

/** Pull every numeric value out of free text (integers, decimals, %, `a/b`). */
function extractNumbers(text: string): number[] {
  const out: number[] = [];
  // Fractions first (a/b) so "1/3" reads as 0.333…, not two integers 1 and 3.
  const fracRe = /(\d+)\s*\/\s*(\d+)/g;
  const consumed: [number, number][] = [];
  let m: RegExpExecArray | null;
  while ((m = fracRe.exec(text)) !== null) {
    const denom = Number(m[2]);
    if (denom !== 0) out.push(Number(m[1]) / denom);
    consumed.push([m.index, m.index + m[0].length]);
  }
  // Plain numbers with optional currency / thousands separators / percent, but
  // skip spans already consumed by a fraction match.
  const numRe = /-?\$?\s*\d[\d,]*(?:\.\d+)?\s*%?/g;
  while ((m = numRe.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (consumed.some(([s, e]) => start < e && end > s)) continue;
    const isPercent = /%\s*$/.test(m[0]);
    const cleaned = m[0].replace(/[$,%\s]/g, "");
    if (cleaned === "" || cleaned === "-") continue;
    const n = Number(cleaned);
    if (!Number.isFinite(n)) continue;
    out.push(isPercent ? n / 100 : n);
  }
  return out;
}

/** Normalise a possibly-formatted string to a number, or `null`. */
function toNumber(value: string): number | null {
  const trimmed = value.trim();
  const frac = /^(-?\d+)\s*\/\s*(\d+)$/.exec(trimmed);
  if (frac) {
    const denom = Number(frac[2]);
    return denom === 0 ? null : Number(frac[1]) / denom;
  }
  const isPercent = /%\s*$/.test(trimmed);
  const cleaned = trimmed.replace(/[$,%\s]/g, "");
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return isPercent ? n / 100 : n;
}

/**
 * True iff `text` leaks the final `answer`.
 *
 * - Numeric answers (or numeric-looking strings such as `"1/3"`, `"0.0748"`,
 *   `"$1,000"`, `"12%"`) match any number in `text` within `tolerance` (default
 *   exact). Currency/percent/fraction formatting is normalised on both sides, so
 *   `$1,000` in the text is caught by an answer of `1000` and vice-versa.
 * - Non-numeric answers (e.g. the Russian-Roulette decision strings) fall back
 *   to a normalised, case-insensitive substring check.
 *
 * `tolerance` guards the decimal cases (e.g. an answer of `2.8` with a small
 * tolerance) while still rejecting merely-nearby values at tolerance 0.
 */
export function containsFinalAnswer(
  text: string,
  answer: number | string,
  tolerance = 0,
): boolean {
  if (!text) return false;

  const answerNum =
    typeof answer === "number" ? answer : toNumber(answer);

  if (answerNum !== null && Number.isFinite(answerNum)) {
    const nums = extractNumbers(text);
    if (nums.some((n) => Math.abs(n - answerNum) <= tolerance)) return true;
    // A numeric answer might still be embedded verbatim as a token the numeric
    // extractor normalised differently; fall through to substring only for the
    // exact-string form when the answer was given as a string.
    if (typeof answer !== "string") return false;
  }

  // Non-numeric (decision) answers: normalised substring containment.
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const needle = norm(String(answer));
  if (needle.length === 0) return false;
  return norm(text).includes(needle);
}
