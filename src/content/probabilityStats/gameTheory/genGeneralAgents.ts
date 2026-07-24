import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion, Question } from "@/types/content";
import {
  F,
  decText,
  fracText,
  optimalSpreadGeneral,
  optimizeTwoAgent,
} from "../coreSolvers";
import { type Choice, assembleChoices, cap, numericErrors } from "../coreScaffold";

/**
 * Parametric generators for the Probability & Statistics → **Game Theory &
 * Puzzles** subcategory, optimizing-agents / market-making family (re-homed from
 * the former "General" set). Every correct scalar is produced ONLY by the exact
 * solver in `../coreSolvers`; every distractor is a re-derived, NAMED
 * misconception guaranteed ≠ the answer and distinct.
 *
 * Modes:
 *   • quiz    — genOptimizeAgents (p* / maximal P(success) of a participation game)
 *   • numeric — genOptimalSpread (informed-vs-uninformed market-making spread)
 */

/* ========================================================================== */
/* ===============  MARKET MAKING & OPTIMIZING AGENTS  ====================== */
/* ========================================================================== */

const AGENT_THEME = [
  { pair: "two liquidity providers", act: "quote", reward: "the fill" },
  { pair: "two market makers", act: "show a price", reward: "the trade" },
  { pair: "two bidders", act: "enter the auction", reward: "the win" },
];

/**
 * Symmetric two-agent participation game: each of two agents independently
 * participates w.p. p; if BOTH participate the reward succeeds w.p. s2, if
 * exactly ONE participates it succeeds w.p. s1, none → 0. P(success)(p) is a
 * downward parabola maximised at p* = s1/(2s1 − s2). We ask EITHER for p* or for
 * the maximal P(success). All quantities are simple fractions.
 */
export function buildOptimizeAgentsInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const th = rng.pick(AGENT_THEME);
  const [[s1n, s1d], [s2n, s2d]] = rng.pick([
    [
      [1, 2],
      [1, 4],
    ],
    [
      [1, 2],
      [1, 3],
    ],
    [
      [2, 3],
      [1, 3],
    ],
    [
      [3, 4],
      [1, 2],
    ],
  ]);
  const s1 = F(s1n, s1d);
  const s2 = F(s2n, s2d);
  const { pStar, pSuccess } = optimizeTwoAgent(s1, s2);
  const askPStar = rng.chance(0.5);

  let correct: Choice;
  let distractors: Choice[];
  let question: string;
  let concept: string;

  if (askPStar) {
    const badAlgebra = s2.div(s1.mul(2)); // s2/(2s1)
    correct = {
      text: fracText(pStar),
      rationale: `Correct — maximising P(success)(p) = s₂·p² + 2·s₁·p(1−p) gives p* = s₁/(2s₁ − s₂) = ${fracText(pStar)}.`,
    };
    distractors = [
      {
        text: fracText(F(1)),
        rationale: `Always participating isn't optimal — with both participating the reward succeeds at only s₂ = ${fracText(s2)} < s₁ = ${fracText(s1)}, so over-participation lowers the success rate.`,
      },
      {
        text: fracText(F(1, 2)),
        rationale: `The naive midpoint. The true optimum is p* = s₁/(2s₁ − s₂) = ${fracText(pStar)}, which is generally not ½.`,
      },
      {
        text: fracText(badAlgebra),
        rationale: `Algebra slip: s₂/(2s₁) = ${fracText(badAlgebra)} misplaces the terms. Setting the derivative to zero gives p* = s₁/(2s₁ − s₂) = ${fracText(pStar)}.`,
      },
      {
        text: fracText(pSuccess),
        rationale: `That's the maximal P(success) = ${fracText(pSuccess)}, the VALUE at the optimum — not the participation probability p* that achieves it.`,
      },
    ];
    question =
      `In a game, ${th.pair} each independently decide to ${th.act} with probability p. ` +
      `If BOTH participate, ${th.reward} succeeds with probability ${fracText(s2)}; if exactly ONE participates it succeeds with probability ${fracText(s1)}; if neither, it fails. ` +
      `Both choose the same p to maximise the chance of success. What participation probability p is optimal?`;
    concept = "Two-agent participation optimum (p* = s₁/(2s₁ − s₂))";
  } else {
    correct = {
      text: fracText(pSuccess),
      rationale: `Correct — at p* = ${fracText(pStar)} the success probability is s₂·p*² + 2·s₁·p*(1−p*) = ${fracText(pSuccess)}.`,
    };
    distractors = [
      {
        text: fracText(s1),
        rationale: `s₁ = ${fracText(s1)} is the one-participant success probability, not the optimised mixture ${fracText(pSuccess)}.`,
      },
      {
        text: fracText(s2),
        rationale: `s₂ = ${fracText(s2)} is the both-participate success probability, not the maximised overall chance ${fracText(pSuccess)}.`,
      },
      {
        text: fracText(F(1, 2)),
        rationale: `A naive ½ guess. Plugging the optimal p* = ${fracText(pStar)} into the success parabola gives ${fracText(pSuccess)}.`,
      },
      {
        text: fracText(pStar),
        rationale: `That's the optimal participation probability p* = ${fracText(pStar)}, not the success probability ${fracText(pSuccess)} it produces.`,
      },
      {
        text: fracText(s1.mul(s2)),
        rationale: `Multiplying the two success rates (s₁·s₂ = ${fracText(s1.mul(s2))}) isn't the mixture. The optimised success probability is s₂·p*² + 2·s₁·p*(1−p*) = ${fracText(pSuccess)}.`,
      },
    ];
    question =
      `In a game, ${th.pair} each independently decide to ${th.act} with probability p. ` +
      `If BOTH participate, ${th.reward} succeeds with probability ${fracText(s2)}; if exactly ONE participates it succeeds with probability ${fracText(s1)}; if neither, it fails. ` +
      `Both choose the same p to maximise the chance of success. What is the maximal probability of success?`;
    concept = "Two-agent participation optimum (maximal P(success))";
  }

  return {
    answer: correct.text,
    question: {
      id: `gen-optimize-agents-${s1n}_${s1d}-${s2n}_${s2d}-${askPStar ? "pstar" : "psucc"}`,
      prompt: question,
      explanation:
        `Model P(success)(p) = s₂·p² + 2·s₁·p(1−p), a downward parabola for s₁ > s₂/2. ` +
        `Its maximiser is p* = s₁/(2s₁ − s₂) = ${fracText(pStar)}, and the corresponding maximal success probability is ${fracText(pSuccess)}. ` +
        `(With s₁ = ${fracText(s1)}, s₂ = ${fracText(s2)}.)`,
      difficulty,
      concept,
      source: "Game Theory & Puzzles · Optimizing agents",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

const SPREAD_THEME = [
  { maker: "a market maker", crowd: "traders" },
  { maker: "a dealer", crowd: "counterparties" },
  { maker: "an AMM", crowd: "swappers" },
];

/**
 * Market-making optimal spread with `U` uninformed + `I` informed traders on a
 * U[0,1] outcome. Maximising E[PnL](X) = −(U/2 + I/4)X² + (U/2 + I/2)X − I/4
 * gives the optimal spread X* = (U + I)/(2U + I) (exact Fraction). The graded
 * answer is that scalar spread; the two-sided market is bid = (1−X)/2, ask =
 * 1 − bid.
 */
export function buildOptimalSpreadInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(SPREAD_THEME);
  const [U, I] = rng.pick([
    [500, 500],
    [600, 300],
    [400, 400],
    [300, 600],
    [800, 400],
    [200, 200],
  ]);
  const { spread, bid, ask } = optimalSpreadGeneral(U, I);

  const dp = 3;
  const answer = Number(decText(spread, dp));

  const ignoreInformed = F(1, 2); // adverse-selection term dropped
  const bidNotSpread = bid; // (1−X)/2
  const algebraSlip = F(U, 2 * U + I); // U/(2U+I)

  const { errors, push } = numericErrors(answer, dp);
  push(
    ignoreInformed,
    `½ ignores the adverse-selection term from the ${I} informed ${th.crowd}. Trading off uninformed revenue against informed losses gives X* = (U + I)/(2U + I) = ${fracText(spread)} ≈ ${decText(spread, dp)}.`,
  );
  push(
    bidNotSpread,
    `${decText(bid, dp)} is the BID quote (1 − X)/2, not the spread. The optimal spread itself is X* = ${fracText(spread)} ≈ ${decText(spread, dp)}.`,
  );
  push(
    algebraSlip,
    `U/(2U + I) = ${fracText(algebraSlip)} is an algebra slip in maximising E[PnL] = −(U/2 + I/4)X² + (U/2 + I/2)X − I/4; the correct maximiser is (U + I)/(2U + I) = ${fracText(spread)}.`,
  );

  const prompt =
    `${cap(th.maker)} faces ${U} uninformed and ${I} informed ${th.crowd} on an outcome uniform on [0, 1]. ` +
    `Choosing the spread X to maximise expected PnL, what is the optimal spread? (Round to ${dp} decimals.)`;
  const explanation =
    `Expected PnL is E[PnL](X) = −(U/2 + I/4)X² + (U/2 + I/2)X − I/4; setting the derivative to zero gives the optimal spread ` +
    `X* = (U + I)/(2U + I) = (${U} + ${I})/(${2 * U} + ${I}) = ${fracText(spread)} ≈ ${decText(spread, dp)}. ` +
    `The resulting two-sided market is bid = (1 − X*)/2 = ${fracText(bid)} ≈ ${decText(bid, dp)} and ask = 1 − bid = ${fracText(ask)} ≈ ${decText(ask, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-optimal-spread-${U}-${I}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Market-making optimal spread ((U + I)/(2U + I))",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Game Theory & Puzzles · Market making",
    },
  };
}

/* ========================================================================== */
/*  Named generators (adapters)                                                */
/* ========================================================================== */

export const genOptimizeAgents = (rng: Rng): Question =>
  buildOptimizeAgentsInstance(rng, "hard").question;
export const genOptimalSpread = (rng: Rng): NumericQuestion =>
  buildOptimalSpreadInstance(rng, "hard").numeric;
