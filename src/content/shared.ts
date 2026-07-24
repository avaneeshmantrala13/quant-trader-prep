import type { Rng } from "@/lib/rng";
import type { Difficulty, Question } from "@/types/content";

/**
 * Build a multiple-choice question from a correct value plus a list of
 * *plausible-error* distractor values. Each distractor should correspond to a
 * specific mistake (an off-by, a wrong formula, a transposition) — never a
 * random number. We dedupe, keep the answer and distractors the same format,
 * shuffle, and return the correctIndex.
 */
export function buildChoices(
  rng: Rng,
  correct: string,
  distractors: string[],
): { choices: string[]; correctIndex: number } {
  const seen = new Set<string>([correct]);
  const kept: string[] = [];
  for (const d of distractors) {
    if (!seen.has(d)) {
      seen.add(d);
      kept.push(d);
    }
    if (kept.length === 3) break;
  }
  // If a generator produced too few distinct distractors, pad defensively.
  let pad = 1;
  while (kept.length < 3) {
    const candidate = `${correct}·alt${pad++}`;
    if (!seen.has(candidate)) {
      seen.add(candidate);
      kept.push(candidate);
    }
  }
  const all = rng.shuffle([correct, ...kept]);
  return { choices: all, correctIndex: all.indexOf(correct) };
}

/** Round to at most `dp` decimals, trimming trailing zeros. */
export function round(n: number, dp = 4): number {
  return Number(n.toFixed(dp));
}

export function fmt(n: number, dp = 2): string {
  if (Number.isInteger(n)) return n.toLocaleString("en-US");
  return round(n, dp).toLocaleString("en-US", {
    maximumFractionDigits: dp,
  });
}

export function pct(p: number, dp = 1): string {
  return `${round(p * 100, dp)}%`;
}

/** Reduce a fraction to lowest terms as a display string "a/b". */
export function fracStr(num: number, den: number): string {
  const g = gcdLocal(num, den) || 1;
  const n = num / g;
  const d = den / g;
  return d === 1 ? `${n}` : `${n}/${d}`;
}

function gcdLocal(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export interface QuestionParts {
  id: string;
  prompt: string;
  correct: string;
  distractors: string[];
  explanation: string;
  difficulty: Difficulty;
  concept?: string;
  distractorRationaleByValue?: Record<string, string>;
  source?: string;
}

/**
 * Assemble a Question, but re-run the builder (which re-draws parameters from
 * the RNG) until it yields at least 3 distractors that are distinct from each
 * other and from the correct answer. This guarantees no padding placeholders and
 * that every option is a genuine, meaningful choice — even when a particular
 * parameter draw would make two error-paths coincide.
 */
export function assembleDistinct(
  rng: Rng,
  build: (rng: Rng) => QuestionParts,
): Question {
  let last: QuestionParts | null = null;
  for (let i = 0; i < 60; i++) {
    const parts = build(rng);
    last = parts;
    const seen = new Set<string>([parts.correct]);
    let distinct = 0;
    for (const d of parts.distractors) {
      if (!seen.has(d)) {
        seen.add(d);
        distinct++;
      }
    }
    if (distinct >= 3) return assemble(rng, parts);
  }
  // Extremely unlikely fallback; assemble() will pad if needed.
  return assemble(rng, last!);
}

/** Assemble a full Question, shuffling choices and aligning rationale. */
export function assemble(rng: Rng, parts: QuestionParts): Question {
  const { choices, correctIndex } = buildChoices(
    rng,
    parts.correct,
    parts.distractors,
  );
  const distractorRationale = parts.distractorRationaleByValue
    ? choices.map((c) =>
        c === parts.correct
          ? "Correct."
          : (parts.distractorRationaleByValue?.[c] ??
            "A plausible but incorrect value."),
      )
    : undefined;
  return {
    id: parts.id,
    prompt: parts.prompt,
    choices,
    correctIndex,
    explanation: parts.explanation,
    difficulty: parts.difficulty,
    concept: parts.concept,
    distractorRationale,
    source: parts.source,
  };
}
