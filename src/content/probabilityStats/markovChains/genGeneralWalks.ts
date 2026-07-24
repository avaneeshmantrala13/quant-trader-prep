import type { Rng } from "@/lib/rng";
import type { Difficulty, NumericQuestion, Question } from "@/types/content";
import {
  F,
  allForwardProb,
  decText,
  deuceWinProb,
  fracText,
  gamblerRuinReach,
  restartGameProbs,
} from "../coreSolvers";
import { type Choice, assembleChoices, numericErrors } from "../coreScaffold";

/**
 * Parametric generators for the Probability & Statistics → **Markov Chains**
 * subcategory, random-walk / gambler's-ruin recursion family (re-homed from the
 * former "General" set). Every correct scalar is produced by the EXACT solver in
 * `../coreSolvers`; every distractor is a re-derived, NAMED misconception.
 *
 * Mode per generator (see adapters at the bottom):
 *   • quiz    — genRuin (biased-vs-fair gambler's-ruin trap)
 *   • numeric — genAllForward, genDeuce, genRestart
 */

/* ========================================================================== */
/* =============  GAMBLER'S RUIN & RANDOM WALKS (numeric + quiz)  =========== */
/* ========================================================================== */

/** Ruin per-round win probabilities (biased only — the fair ½ is excluded). */
const RUIN_P: [number, number][] = ([
  [1, 2],
  [2, 5],
  [3, 5],
  [2, 3],
  [1, 3],
  [4, 10],
  [6, 10],
] as [number, number][]).filter(([pn, pd]) => !F(pn, pd).equals(F(1, 2)));

/**
 * P(reach `N` before 0) from `k`, winning each round w.p. p ≠ ½. Correct =
 * (1−rᵏ)/(1−rᴺ), r = q/p. Canonical trap = the FAIR k/N used despite an edge;
 * also inverting r (p/q instead of q/p) and reporting the ruin complement.
 */
export function buildRuinInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: string; question: Question } {
  const [pn, pd] = rng.pick(RUIN_P);
  const p = F(pn, pd);
  const q = F(1).sub(p);
  const N = rng.pick([10, 20, 50, 100]);
  const k = rng.int(1, N - 1);

  const value = gamblerRuinReach(k, N, p);
  const dp = 3;
  const answer = decText(value, dp);

  const symmetric = F(k, N);
  const inverted = gamblerRuinReach(k, N, q); // uses r = p/q instead of q/p
  const reversed = F(1).sub(value);

  const correct: Choice = {
    text: decText(value, dp),
    rationale: `Correct — with an edge you need the biased formula (1−rᵏ)/(1−rᴺ), r = q/p = ${fracText(q.div(p))}: P = ${decText(value, dp)}.`,
  };
  const distractors: Choice[] = [
    {
      text: decText(symmetric, dp),
      rationale: `k/N = ${k}/${N} = ${decText(symmetric, dp)} only holds for a FAIR game (p = ½). Here p = ${fracText(p)} ≠ ½, so use (1−rᵏ)/(1−rᴺ) with r = q/p.`,
    },
    {
      text: decText(inverted, dp),
      rationale: `You inverted the ratio — that uses r = p/q. The multiplier must be r = q/p (loss-odds over win-odds); flipping it reverses who the edge favours.`,
    },
    {
      text: decText(reversed, dp),
      rationale: `${decText(reversed, dp)} = 1 − ${decText(value, dp)} is P(go broke first), the opposite event.`,
    },
  ];

  const prompt =
    `You start with ${k} chips and stake one chip per round, winning each round with probability ${fracText(p)} (else you lose the chip). ` +
    `You stop at ${N} chips (win) or 0 chips (broke). What is the probability you reach ${N} before going broke?`;
  const explanation =
    `Biased gambler's ruin: r = q/p = ${fracText(q.div(p))}, so P(reach ${N} from ${k}) = (1 − r^${k})/(1 − r^${N}) = ${decText(value, dp)}. ` +
    `The tempting ${decText(symmetric, dp)} (= k/N) is the FAIR-game value and is wrong whenever p ≠ ½.`;

  return {
    answer,
    question: {
      id: `gen-ruin-${k}-${N}-${pn}-${pd}`,
      prompt,
      explanation,
      difficulty,
      concept: "Gambler's ruin (biased-vs-fair trap)",
      source: "Markov Chains · Gambler's ruin",
      ...assembleChoices(rng, correct, distractors),
    },
  };
}

const FORWARD_THEME = [
  { actor: "a courier", step: "block", dest: "the depot" },
  { actor: "a rover", step: "leg", dest: "base camp" },
  { actor: "a messenger", step: "hop", dest: "the tower" },
];

/**
 * A walk of `blocks` steps: the first step is forced forward (free), each of the
 * remaining `blocks−1` flips a fair coin. "Fast" ⟺ all remaining steps go
 * forward, P = (1/2)^{blocks−1}; "slow" = its complement. Traps: forgetting the
 * forced first step ((1/2)^blocks), the opposite event, and a linear guess.
 */
export function buildAllForwardInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(FORWARD_THEME);
  const blocks = rng.pick([3, 4, 5]);
  const steps = blocks - 1;
  const askFast = rng.chance(0.5);

  const fast = allForwardProb(steps);
  const value = askFast ? fast : F(1).sub(fast);
  const dp = 3;
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    Math.pow(0.5, blocks),
    `(1/2)^${blocks} counts ALL ${blocks} steps as coin flips. The first step is forced forward (free), so only ${steps} flips are random — the "all forward" event is (1/2)^${steps}.`,
  );
  push(
    1 - value.valueOf(),
    askFast
      ? `${decText(F(1).sub(fast), dp)} = 1 − (1/2)^${steps} is P(it does NOT arrive fast), the opposite event.`
      : `${decText(fast, dp)} = (1/2)^${steps} is P(it arrives fast) — you gave the opposite of what was asked.`,
  );
  push(
    blocks * 0.5,
    `${decText(F(blocks).div(2), dp)} = ${blocks}·½ is a linear guess. The steps must ALL go forward, so you MULTIPLY the ½'s (getting (1/2)^${steps}), not add them.`,
  );

  const eventText = askFast
    ? `arrives as fast as possible (every remaining step forward)`
    : `does NOT arrive as fast as possible`;
  const prompt =
    `${th.actor[0].toUpperCase() + th.actor.slice(1)} covers ${blocks} ${th.step}s toward ${th.dest}. The first ${th.step} is forced forward; each of the remaining ${steps} ${th.step}s independently goes forward or backward on a fair coin flip. ` +
    `What is the probability it ${eventText}? (Round to ${dp} decimals.)`;
  const explanation =
    `The first ${th.step} is free, leaving ${steps} fair coin flips. P(all ${steps} forward) = (1/2)^${steps} = ${fracText(fast)}. ` +
    (askFast
      ? `So P(fast) = ${fracText(value)} ≈ ${decText(value, dp)}.`
      : `So P(not fast) = 1 − ${fracText(fast)} = ${fracText(value)} ≈ ${decText(value, dp)}.`);

  return {
    answer,
    numeric: {
      id: `gen-allforward-${blocks}-${askFast ? "fast" : "slow"}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Random walk (all-forward after a forced first step)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Markov Chains · Random walks",
    },
  };
}

const DEUCE_THEME = [
  { actor: "a chess rapid tiebreak", point: "game" },
  { actor: "a fencing overtime", point: "touch" },
  { actor: "a table-tennis deuce", point: "rally" },
];

/** Per-point win probabilities for the win-by-two recursion. */
const DEUCE_P: [number, number][] = [
  [6, 10],
  [4, 10],
  [55, 100],
  [45, 100],
  [7, 10],
  [3, 10],
  [2, 3],
];

/**
 * Win-by-two from a tie: win w.p. p²/(p²+(1−p)²). Traps: p² (only "win the next
 * two"), p (a single point), and 2p(1−p) (the split that RETURNS to the tie).
 */
export function buildDeuceInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(DEUCE_THEME);
  const [pn, pd] = rng.pick(DEUCE_P);
  const p = F(pn, pd);
  const pv = p.valueOf();

  const value = deuceWinProb(p);
  const dp = 3;
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    pv * pv,
    `p² = ${decText(pv * pv, dp)} is only P(you win the next TWO ${th.point}s outright). You must also fold in the deuce recursion: a split sends the score back to the tie.`,
  );
  push(
    pv,
    `p = ${fracText(p)} is your chance of winning a SINGLE ${th.point}, not the whole win-by-two game.`,
  );
  push(
    2 * pv * (1 - pv),
    `2p(1−p) = ${decText(F(2).mul(p).mul(F(1).sub(p)), dp)} is P(the two ${th.point}s SPLIT), which RETURNS you to the tie — it isn't a win at all.`,
  );

  const prompt =
    `In ${th.actor} the score is tied and a player must win by two ${th.point}s. This player wins each ${th.point} with probability ${fracText(p)}, independently. ` +
    `What is the probability this player eventually wins the game? (Round to ${dp} decimals.)`;
  const explanation =
    `Let P be the win probability from the tie. Win the next two (p²), or split (2p(1−p)) and return to the tie: P = p² + 2p(1−p)·P ⇒ P = p²/(p²+(1−p)²) = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-deuce-${pn}-${pd}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Win-by-two recursion (deuce)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Markov Chains · Random walks",
    },
  };
}

const RESTART_THEME = [
  { names: ["Ada", "Ben"], object: "a contested rally" },
  { names: ["Mira", "Leo"], object: "a sudden-death round" },
  { names: ["Ivy", "Sam"], object: "a replayed frame" },
];

/**
 * Restart game: each round `A` ends it w.p. x, else `B` ends it w.p. y, else the
 * round replays. P(A wins) = x/(x+y). Traps: the raw per-round end prob (not
 * normalised), the wrong normaliser x/(1−y), and solving for the other player.
 */
export function buildRestartInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(RESTART_THEME);
  const [nameA, nameB] = th.names;
  const xNum = rng.int(2, 4);
  const yNum = rng.int(3, 5);
  const x = F(xNum, 10);
  const y = F(yNum, 10);
  const [pA, pB] = restartGameProbs(x, y);
  const askA = rng.chance(0.5);

  const value = askA ? pA : pB;
  const dp = 3;
  const answer = Number(decText(value, dp));

  const targetName = askA ? nameA : nameB;
  const otherName = askA ? nameB : nameA;
  const rawEnd = askA ? x : y;
  const otherEnd = askA ? y : x;
  const wrongNorm = rawEnd.div(F(1).sub(otherEnd));
  const other = askA ? pB : pA;

  const { errors, push } = numericErrors(answer, dp);
  push(
    rawEnd,
    `${fracText(rawEnd)} is the chance ${targetName} ends the round THIS round. To get the overall win probability you must divide by (x+y) = ${fracText(x.add(y))} to account for all the replays.`,
  );
  push(
    wrongNorm,
    `${decText(wrongNorm, dp)} uses the wrong normaliser. Dividing by (1 − ${fracText(otherEnd)}) folds in only ${otherName}'s stops; the correct denominator is (x+y), the chance the round ends at all.`,
  );
  push(
    other,
    `${decText(other, dp)} is ${otherName}'s overall win probability — you solved for the wrong player.`,
  );

  const prompt =
    `Each ${th.object}: ${nameA} ends it (and wins) with probability ${fracText(x)}; otherwise ${nameB} ends it (and wins) with probability ${fracText(y)}; otherwise it is replayed. ` +
    `Over the whole game, what is the probability ${targetName} wins? (Round to ${dp} decimals.)`;
  const explanation =
    `A replay w.p. 1 − x − y = ${fracText(F(1).sub(x).sub(y))} resets the round, so conditional on the round ending, ${nameA} wins with probability x/(x+y). ` +
    `P(${targetName} wins) = ${fracText(rawEnd)}/(${fracText(x)}+${fracText(y)}) = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-restart-${xNum}-${yNum}-${askA ? "A" : "B"}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Restart recursion (normalised win probability)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "Markov Chains · Random walks",
    },
  };
}

/* ========================================================================== */
/*  Named generators (adapters — mode noted per line)                         */
/* ========================================================================== */

export const genRuin = (rng: Rng): Question => buildRuinInstance(rng, "medium").question; // quiz
export const genAllForward = (rng: Rng): NumericQuestion =>
  buildAllForwardInstance(rng, "easy").numeric; // numeric
export const genDeuce = (rng: Rng): NumericQuestion =>
  buildDeuceInstance(rng, "medium").numeric; // numeric
export const genRestart = (rng: Rng): NumericQuestion =>
  buildRestartInstance(rng, "easy").numeric; // numeric
