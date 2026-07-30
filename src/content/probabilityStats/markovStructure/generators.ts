import type { Rng } from "@/lib/rng";
import Fraction from "fraction.js";
import type { Difficulty, NumericQuestion, Question } from "@/types/content";
import { F, decText, fracText } from "../coreSolvers";
import { type Choice, assembleChoices, numDp, numericErrors } from "../coreScaffold";
import { twoStepEntry } from "./structure";

/**
 * Generators for **Markov structural theory** (Bucket 2). Pⁿ / Chapman–Kolmogorov
 * is exact & numeric; state classification is conceptual & quiz. Distractors are
 * NAMED misconceptions (1-step vs 2-step; squaring an entry vs the matrix; a row
 * sums to 1; the classification confusions).
 */

// Small 3×3 rational transition matrices (rows sum to 1; all states communicate).
const MATRICES: Fraction[][][] = [
  [
    [F(1, 2), F(1, 2), F(0)],
    [F(1, 3), F(1, 3), F(1, 3)],
    [F(0), F(1, 2), F(1, 2)],
  ],
  [
    [F(0), F(1, 2), F(1, 2)],
    [F(1, 2), F(0), F(1, 2)],
    [F(1, 2), F(1, 2), F(0)],
  ],
  [
    [F(2, 3), F(1, 3), F(0)],
    [F(1, 3), F(1, 3), F(1, 3)],
    [F(0), F(2, 3), F(1, 3)],
  ],
];

/** (P²)_{ij} via Chapman–Kolmogorov. Traps: 1-step P_{ij}, squaring the entry, or the row sum 1. */
export function buildPnEntryInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const P = rng.pick(MATRICES);
  const i = rng.int(0, 2);
  const j = rng.int(0, 2);
  const value = twoStepEntry(P, i, j);
  const dp = numDp(value, 2, 4);
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    P[i][j],
    `${fracText(P[i][j])} = P_{${i + 1}${j + 1}} is the ONE-step probability. Two steps need Σ_k P_{${i + 1}k}·P_{k${j + 1}} (Chapman–Kolmogorov).`,
  );
  push(
    P[i][j].mul(P[i][j]),
    `${fracText(P[i][j].mul(P[i][j]))} squares the single ENTRY. You must multiply the MATRIX by itself and sum over the intermediate state k.`,
  );
  push(
    F(1),
    `1 is the ROW sum of P (each row is a distribution). A single 2-step entry (P²)_{ij} is generally well below 1.`,
  );

  const rows = P.map((r) => `[${r.map((x) => fracText(x)).join(", ")}]`).join(", ");
  const prompt =
    `A Markov chain has transition matrix rows ${rows} (states 1,2,3). ` +
    `What is the 2-step probability P(X₂ = ${j + 1} | X₀ = ${i + 1}), i.e. (P²)_{${i + 1}${j + 1}}? (Round to ${dp} decimals.)`;
  const explanation =
    `By Chapman–Kolmogorov, (P²)_{${i + 1}${j + 1}} = Σ_k P_{${i + 1}k}·P_{k${j + 1}} = ${fracText(value)} ≈ ${decText(value, dp)} — sum over the intermediate state k of "step to k, then to ${j + 1}".`;

  return {
    answer,
    numeric: {
      id: `gen-markov-pn-${MATRICES.indexOf(P)}-${i}-${j}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Chapman–Kolmogorov (P²)_{ij}=Σ P_{ik}P_{kj}",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Markov structure · n-step (Pⁿ)",
    },
  };
}

interface ClassItem {
  prompt: string;
  correct: Choice;
  distractors: Choice[];
  concept: string;
}

const CLASS_ITEMS: ClassItem[] = [
  {
    prompt:
      "A state i has a self-loop (P_{ii} > 0). What is its period?",
    concept: "Periodicity (self-loop ⇒ aperiodic)",
    correct: {
      text: "1 (aperiodic)",
      rationale: "A self-loop lets you return in 1 step, so gcd of return times is 1 — the state is aperiodic.",
    },
    distractors: [
      { text: "2", rationale: "Period 2 would require all returns at even times; a self-loop allows a return at time 1, breaking that." },
      { text: "0", rationale: "Period is a gcd of return times ≥ 1; it is never 0." },
      { text: "Undefined", rationale: "Period is defined for any state that can return to itself, which a self-loop guarantees." },
    ],
  },
  {
    prompt:
      "In a FINITE, irreducible Markov chain, every state is:",
    concept: "Finite irreducible ⇒ all recurrent",
    correct: {
      text: "Recurrent",
      rationale: "A finite irreducible chain cannot 'leak' probability, so every state is (positive) recurrent — revisited infinitely often.",
    },
    distractors: [
      { text: "Transient", rationale: "Transience needs escaping mass; impossible when finitely many communicating states trap it." },
      { text: "Absorbing", rationale: "Absorbing states can't be left, contradicting irreducibility (all states communicate)." },
      { text: "Periodic", rationale: "Recurrence is about return, not timing; an irreducible finite chain can be aperiodic." },
    ],
  },
  {
    prompt: "Two states i and j 'communicate' precisely when:",
    concept: "Communicating classes (mutual reachability)",
    correct: {
      text: "Each is reachable from the other with positive probability",
      rationale: "Communication is mutual accessibility: i→j and j→i in some number of steps.",
    },
    distractors: [
      { text: "They have the same stationary probability", rationale: "Equal π is unrelated to communication; communication is about reachability." },
      { text: "They are directly connected in one step", rationale: "Reachability may take several steps; one-step adjacency isn't required." },
      { text: "One of them is absorbing", rationale: "An absorbing state communicates with no other state — the opposite of communicating." },
    ],
  },
  {
    prompt:
      "A state you can leave but to which you return only with probability < 1 is:",
    concept: "Transience (return probability < 1)",
    correct: {
      text: "Transient",
      rationale: "Transient = the chain returns with probability < 1, so it is visited only finitely often.",
    },
    distractors: [
      { text: "Recurrent", rationale: "Recurrent means return with probability exactly 1 — the opposite." },
      { text: "Absorbing", rationale: "Absorbing means you can never leave; here you can leave." },
      { text: "Aperiodic", rationale: "Aperiodicity is about return TIMING, not whether you return at all." },
    ],
  },
];

/** State-classification concept question (recurrence/transience/periodicity/communicating). */
export function buildClassifyInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const idx = rng.int(0, CLASS_ITEMS.length - 1);
  const item = CLASS_ITEMS[idx];
  const explanation =
    `${item.correct.rationale} ` +
    `State classification (recurrence, transience, periodicity, communicating classes) is the structural language of Markov chains.`;

  return {
    answer: item.correct.text,
    question: {
      id: `gen-markov-classify-${idx}`,
      prompt: item.prompt,
      explanation,
      difficulty,
      concept: item.concept,
      source: "Markov structure · state classification",
      ...assembleChoices(rng, item.correct, item.distractors),
    },
  };
}

export const genPnEntry = (rng: Rng): NumericQuestion =>
  buildPnEntryInstance(rng, "hard").numeric;
export const genClassify = (rng: Rng): Question =>
  buildClassifyInstance(rng, "medium").question;
