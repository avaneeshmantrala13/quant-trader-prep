import type { NumericQuestion, Question } from "@/types/content";
import { formatNumericAnswer } from "@/lib/numeric";
import {
  naturalFrequencyTree,
  type NaturalFrequencyTree,
} from "./naturalFrequency";
import { MAX_TRIALS, type MonteCarloSpec } from "./monteCarlo";
import { confrontForTag } from "./misconception";
import { containsFinalAnswer } from "./answerWithholding";

/**
 * The answer-WITHHOLDING hint ladder (PHASE_2 §5).
 *
 * On a WRONG primary answer, instead of revealing, we build an ordered ladder of
 * five rungs keyed on the tripped misconception, escalating support while
 * WITHHOLDING the final answer until the last rung:
 *   1. name-trap        — name the specific error (never the answer).
 *   2. representation    — re-represent it (natural-frequency tree for Bayesian).
 *   3. worked-sibling    — study the same step on a fresh sibling, then redo.
 *   4. elicit-confront   — simulate/enumerate to confront a durable misconception.
 *   5. reveal            — only now, the full worked solution.
 *
 * Research anchors: Shute 2008 & Van der Kleij et al. 2015 (elaborated,
 * answer-withholding feedback d ≈ 0.49 ≫ right/wrong d ≈ 0.05); Gigerenzer &
 * Hoffrage 1995 (natural frequencies); GAISE 2016 / Fischbein & Schnarch 1997
 * (elicit-then-confront via simulation); VanLehn 2011 (step-based tutoring).
 *
 * INVARIANT: rungs 1–4 satisfy `containsFinalAnswer(text, answer) === false`.
 * Rung 1's authored rationale is sanitised to a generic nudge if it would leak
 * the answer; rungs 2–4 are authored generically; only rung 5 reveals.
 */

export interface HintRung {
  rung: 1 | 2 | 3 | 4 | 5;
  kind:
    | "name-trap"
    | "representation"
    | "worked-sibling"
    | "elicit-confront"
    | "reveal";
  /** Never contains the final answer for rungs 1–4 (asserted in tests). */
  text: string;
  /** Optional structured payload the thin view renders. */
  payload?:
    | NaturalFrequencyTree
    | MonteCarloSpec
    | { siblingPrompt: string };
}

/** Generic, answer-free fallback when an authored rationale would leak the answer. */
const GENERIC_NAME_TRAP =
  "You tripped a common trap here. Re-read exactly what the question is conditioning on before you recompute — the mistake is usually in the set-up, not the arithmetic.";

/** A stable non-negative seed derived from a string (for reproducible sims). */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2_000_000_000 || 1;
}

/** Extract percentages from prompt text (for the Bayesian NF tree at rung 2). */
function parsePercents(text: string): number[] {
  const out: number[] = [];
  const re = /(\d+(?:\.\d+)?)\s*%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(Number(m[1]) / 100);
  return out;
}

function isQuiz(q: Question | NumericQuestion): q is Question {
  return "choices" in q;
}

/** The final answer used only for the withholding guard (never shown pre-reveal). */
function finalAnswerOf(q: Question | NumericQuestion): number | string {
  return isQuiz(q) ? q.choices[q.correctIndex] : q.answer;
}

/** Build a Bayesian natural-frequency tree from the prompt, if parseable. */
function tryNaturalFrequencyTree(
  q: Question | NumericQuestion,
): NaturalFrequencyTree | null {
  const pcts = parsePercents(q.prompt);
  if (pcts.length < 3) return null;
  const [prior, sens, fpr] = pcts;
  if (prior <= 0 || prior >= 1) return null;
  return naturalFrequencyTree({ prior, sens, fpr, total: 1000 });
}

/**
 * Build the ordered 5-rung ladder for a wrong attempt, keyed on the tripped
 * misconception `misconceptionTag` (resolved by the caller via the Phase-2
 * `misconception` helpers). Always returns exactly 5 rungs in order 1..5.
 */
export function buildHintLadder(args: {
  question: Question | NumericQuestion;
  chosenIndex?: number;
  chosenValue?: number;
  misconceptionTag?: string;
}): HintRung[] {
  const { question, chosenIndex, chosenValue, misconceptionTag } = args;
  const answer = finalAnswerOf(question);
  const confront = confrontForTag(misconceptionTag);

  /* -- Rung 1: name the trap (sanitised so it never leaks the answer) -------- */
  let rung1Text = "";
  if (isQuiz(question) && chosenIndex != null) {
    rung1Text = question.distractorRationale?.[chosenIndex] ?? "";
  } else if (!isQuiz(question) && chosenValue != null) {
    rung1Text =
      question.commonErrors?.find((e) =>
        question.decimals == null
          ? e.value === chosenValue
          : Math.round(e.value * 10 ** question.decimals) ===
            Math.round(chosenValue * 10 ** question.decimals),
      )?.feedback ?? "";
  }
  if (!rung1Text || containsFinalAnswer(rung1Text, answer)) {
    rung1Text = GENERIC_NAME_TRAP;
  }

  /* -- Rung 2: representation (natural-frequency tree for Bayesian) ---------- */
  const nfTree =
    confront === "nf-tree" ? tryNaturalFrequencyTree(question) : null;
  const rung2: HintRung = nfTree
    ? {
        rung: 2,
        kind: "representation",
        text: `Re-express it as natural frequencies out of ${nfTree.total} people. Fill the two branch counts, then ask: which TWO counts do you divide to get the answer?`,
        payload: nfTree,
      }
    : {
        rung: 2,
        kind: "representation",
        text: "Draw the picture before reaching for a formula: lay the outcomes out concretely (a tree, a table, or the reduced sample space) and re-count what actually survives the conditioning.",
      };

  /* -- Rung 3: worked sibling (completion) ---------------------------------- */
  const rung3: HintRung = {
    rung: 3,
    kind: "worked-sibling",
    text: "Here's the SAME kind of problem with different numbers, worked one step at a time. Study the step you slipped on, then come back and redo yours.",
    payload: {
      siblingPrompt:
        "A fresh same-family instance is worked below; mirror its critical step on your own item.",
    },
  };

  /* -- Rung 4: elicit-then-confront (simulate) ------------------------------ */
  let rung4: HintRung;
  if (confront === "coin-sim") {
    rung4 = {
      rung: 4,
      kind: "elicit-confront",
      text: "Predict what a long run of flips does after a streak — then run it. Each flip is INDEPENDENT, so watch the simulated frequency settle back toward its true value no matter what just happened.",
      payload: {
        kind: "coin",
        trials: MAX_TRIALS,
        seed: hashSeed(question.id + ":coin"),
        params: { pHeads: 0.5 },
      },
    };
  } else if (confront === "dice-sim") {
    rung4 = {
      rung: 4,
      kind: "elicit-confront",
      text: "Don't reason from a single outcome — simulate many independent trials and watch the long-run frequency, not the last result.",
      payload: {
        kind: "dice",
        trials: MAX_TRIALS,
        seed: hashSeed(question.id + ":dice"),
        params: { sides: 6, face: 6 },
      },
    };
  } else if (confront === "nested-set") {
    rung4 = {
      rung: 4,
      kind: "elicit-confront",
      text: "The 'A and B' cases are a SUBSET of the 'A' cases — a subset can never be larger than the whole. Count the nested sets directly and compare.",
    };
  } else {
    rung4 = {
      rung: 4,
      kind: "elicit-confront",
      text: "Commit to a prediction, then test it: enumerate or simulate many cases and compare the long-run frequency to your guess.",
    };
  }

  /* -- Rung 5: reveal (the only rung allowed to contain the answer) ---------- */
  const rung5: HintRung = {
    rung: 5,
    kind: "reveal",
    text: question.explanation,
  };

  return [
    { rung: 1, kind: "name-trap", text: rung1Text },
    rung2,
    rung3,
    rung4,
    rung5,
  ];
}

/** Convenience for views/tests: the numeric answer string for a numeric item. */
export function numericAnswerText(q: NumericQuestion): string {
  return `${q.unit ?? "$"}${formatNumericAnswer(q)}`;
}
