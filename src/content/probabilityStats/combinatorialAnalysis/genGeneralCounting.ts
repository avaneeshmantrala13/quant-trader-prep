import type { Rng } from "@/lib/rng";
import { gcd } from "@/lib/rng";
import type { Difficulty, NumericQuestion } from "@/types/content";
import type FractionType from "fraction.js";
import {
  F,
  commonSemicircleProb,
  consecutiveRunProb,
  couponCollectorExpected,
  decText,
  expectedWordsAfterMerges,
  fracText,
  higherCardProb,
  notAorNotBProb,
  polygonNoCollisionProb,
  round1MeetProb,
  topTwoSeedsMeetFinalProb,
  twoInARowScheduleProb,
} from "../coreSolvers";
import { cap, numericErrors } from "../coreScaffold";

/**
 * Parametric generators + per-family misconception taxonomy for the
 * Probability & Statistics → **Combinatorial Analysis** subcategory, counting /
 * tournaments / arrangements / expectation-misc family (re-homed from the former
 * "General" set). NOTE: the exponential-median generator moved to Order
 * Statistics; this file keeps only the pure counting families.
 *
 * Every generated scalar is produced by the EXACT solver in `./general.ts`
 * (never a hardcoded table); every distractor (`numeric` commonErrors) is a
 * re-derived, NAMED misconception, guaranteed distinct and ≠ the answer at the
 * grading precision (`numericErrors` dedupes and drops non-finite values).
 *
 * NONE of the source-dataset questions are user-facing — every playable item is
 * freshly themed with different objects, stories, and numbers.
 */

/* ========================================================================== */
/* =================  1 — BRACKET FINAL: #1 vs #3 (numeric)  =============== */
/* ========================================================================== */

const BRACKET_THEME = [
  { unit: "esports squads", event: "grand final" },
  { unit: "debate teams", event: "final round" },
  { unit: "robotics crews", event: "championship match" },
];

/**
 * Seeded single-elim bracket of `size` teams (lower seed always wins). P(the #1
 * and #3 seeds meet in the FINAL) = (size/2)/(size−1) · (size/2−1)/(size−2):
 * #3 must land on the opposite half from #1 AND #2 must land on #1's half (else
 * #2 knocks #3 out before the final). Traps: only the opposite-half factor,
 * confusing it with a round-1 meeting 1/(size−1), and a naive 2/size guess.
 */
export function buildBracketFinalInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(BRACKET_THEME);
  const size = rng.pick([8, 16, 64]);
  const half = size / 2;

  const value = topTwoSeedsMeetFinalProb(size);
  const dp = 4;
  const answer = Number(decText(value, dp));

  const oppOnly = F(half, size - 1);
  const round1 = round1MeetProb(size);
  const naive = F(2, size);

  const { errors, push } = numericErrors(answer, dp);
  push(
    oppOnly,
    `That's only P(#3 on the opposite half) = (size/2)/(size−1) = ${fracText(oppOnly)}. You forgot that #2 must be on #1's half — otherwise #2 knocks #3 out before the final.`,
  );
  push(
    round1,
    `1/(size−1) = ${fracText(round1)} is P(#1 and #3 meet in ROUND 1, not the final).`,
  );
  push(
    naive,
    `2/size = ${fracText(naive)} is a naive "2 of size slots" guess; it ignores the bracket structure entirely.`,
  );

  const prompt =
    `A ${size}-competitor knockout draw is randomised, and the stronger seed always advances (seed i beats seed j whenever i < j). ` +
    `How probable is it that the top seed and the third seed avoid each other until the ${th.event}? (Round to ${dp} decimals.)`;
  const explanation =
    `For the #1 and #3 seeds to meet in the final, #3 must be on the opposite half from #1 — probability (size/2)/(size−1) = ${half}/${size - 1} = ${fracText(oppOnly)}. ` +
    `Given that, #2 (the only seed that beats #3) must land on #1's half so it can't reach #3 early — probability (size/2−1)/(size−2) = ${half - 1}/${size - 2} = ${fracText(F(half - 1, size - 2))}. ` +
    `Multiplying: P = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-bracketfinal-${size}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Tournament brackets (top seeds meet in final)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "General · Tournament brackets & arrangements",
    },
  };
}

/* ========================================================================== */
/* =================  2 — ROUND-1 OPPONENTS (numeric)  ===================== */
/* ========================================================================== */

const ROUND1_THEME = [
  { unit: "badminton players", one: "player", verb: "drawn against each other" },
  { unit: "fencers", one: "fencer", verb: "paired together" },
  { unit: "darts entrants", one: "entrant", verb: "matched up" },
];

/**
 * P(two specific players are first-round opponents in a random `size`-slot
 * bracket) = 1/(size−1): fix one player, the other fills one of the remaining
 * size−1 slots and exactly one of those is the shared match. Traps: dividing by
 * all `size` slots, double-counting with 2/size, and matches-vs-slots 1/(size/2).
 */
export function buildRound1Instance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(ROUND1_THEME);
  const size = rng.pick([8, 32, 64]);

  const value = round1MeetProb(size);
  const dp = 4;
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1, size),
    `1/size = ${fracText(F(1, size))} divides by all ${size} slots; once you FIX one player there are only size−1 = ${size - 1} slots left for the other.`,
  );
  push(
    F(2, size),
    `2/size = ${fracText(F(2, size))} double-counts the ordered ways to place the pair.`,
  );
  push(
    F(1, size / 2),
    `1/(size/2) = ${fracText(F(1, size / 2))} confuses the number of first-round MATCHES with the number of open slots.`,
  );

  const prompt =
    `A bracket-style elimination event seats ${size} ${th.unit} into its ${size} bracket positions completely at random. ` +
    `How likely is it that two particular ${th.one}s end up ${th.verb} in their opening match? (Round to ${dp} decimals.)`;
  const explanation =
    `Fix the first player anywhere. The second player then falls uniformly into one of the remaining ${size - 1} slots, and exactly one of those is the seat directly opposite the first player (their round-1 match). ` +
    `So P = 1/(size−1) = 1/${size - 1} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-round1-${size}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Tournament brackets (round-1 meeting = 1/(size−1))",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "General · Tournament brackets & arrangements",
    },
  };
}

/* ========================================================================== */
/* =================  3 — COMMON SEMICIRCLE (numeric)  ===================== */
/* ========================================================================== */

const SEMICIRCLE_THEME = [
  { obj: "birds", place: "a circular wire" },
  { obj: "sensors", place: "a round dial" },
  { obj: "buoys", place: "a circular lagoon's rim" },
];

/**
 * P(all `n` uniform points on a circle lie within some common semicircle) =
 * n·(1/2)^{n−1}. Anchor on each point being the clockwise-most of the group
 * (n mutually-exclusive anchors), each contributing (1/2)^{n−1}. Traps: forgetting
 * the ×n anchor factor, and two exponent off-by-one variants.
 */
export function buildSemicircleInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(SEMICIRCLE_THEME);
  const n = rng.pick([3, 4, 6]);

  const value = commonSemicircleProb(n);
  const dp = 4;
  const answer = Number(decText(value, dp));

  const oneAnchor = F(1, 2).pow(n - 1) as FractionType;
  const wrongExp1 = F(1, 2).pow(n) as FractionType; // (1/2)^n
  const wrongExp2 = F(n).mul(F(1, 2).pow(n) as FractionType); // n·(1/2)^n

  const { errors, push } = numericErrors(answer, dp);
  push(
    oneAnchor,
    `(1/2)^{n−1} = ${fracText(oneAnchor)} is the probability for ONE fixed anchor point; there are ${n} mutually-exclusive anchors, so multiply by ${n}.`,
  );
  push(
    wrongExp1,
    `(1/2)^n = ${fracText(wrongExp1)} is off by one in the exponent — there are only n−1 = ${n - 1} OTHER points to fall in the half-plane.`,
  );
  push(
    wrongExp2,
    `n·(1/2)^n = ${fracText(wrongExp2)} uses ½ⁿ instead of ½^{n−1}; each anchor leaves n−1 other points, not n.`,
  );

  const prompt =
    `${n} ${th.obj} independently land at uniformly random points around ${th.place}. ` +
    `What is the probability that one half of the ring (some 180° arc) contains all ${n} of them at once? (Round to ${dp} decimals.)`;
  const explanation =
    `Condition on which point is the clockwise-most of the group. For a fixed anchor, the other ${n - 1} points must all fall in the 180° arc clockwise from it — probability (1/2)^{${n}−1} = ${fracText(oneAnchor)}. ` +
    `These ${n} anchor events are mutually exclusive, so P = n·(1/2)^{n−1} = ${n}·${fracText(oneAnchor)} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-semicircle-${n}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Spatial arrangements (common semicircle = n·½^{n−1})",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "General · Tournament brackets & arrangements",
    },
  };
}

/* ========================================================================== */
/* =================  4 — POLYGON WALKERS: NO COLLISION (numeric)  ========= */
/* ========================================================================== */

const POLYGON_THEME = [
  { obj: "beetles", place: "a regular" },
  { obj: "robots", place: "a symmetric" },
  { obj: "tokens", place: "a regular" },
];

/**
 * `n` agents, one per vertex of a regular n-gon, each steps to a uniformly
 * random adjacent vertex by a fair coin. P(no two collide) = 2/2^n — only the
 * all-clockwise and all-counter-clockwise outcomes avoid collisions. Traps:
 * counting only ONE all-same-direction outcome, 2/n, and a wrong permutation count.
 */
export function buildPolygonAntsInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(POLYGON_THEME);
  const n = rng.pick([4, 6, 7]);

  const value = polygonNoCollisionProb(n);
  const dp = 4;
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1, 2 ** n),
    `1/2^n = ${fracText(F(1, 2 ** n))} counts only ONE all-same-direction outcome; there are TWO (all clockwise and all counter-clockwise).`,
  );
  push(
    F(2, n),
    `2/n = ${fracText(F(2, n))} confuses the count of safe outcomes with the number of vertices.`,
  );
  push(
    F(1, 2).pow(n - 1) as FractionType,
    `(1/2)^{n−1} = ${fracText(F(1, 2).pow(n - 1) as FractionType)} uses a wrong count of favorable outcomes over the 2^n equally-likely moves.`,
  );

  const prompt =
    `On ${th.place} ${n}-gon, one ${th.obj.slice(0, -1)} sits at each of the ${n} vertices. Simultaneously, each ${th.obj.slice(0, -1)} flips a fair coin and steps to one of its two adjacent vertices. ` +
    `What is the probability that no two ${th.obj} collide (no shared vertex and no swap along an edge)? (Round to ${dp} decimals.)`;
  const explanation =
    `On a cycle, the landing positions form a permutation (no collisions) only when every ${th.obj.slice(0, -1)} moves the SAME way: all clockwise, or all counter-clockwise. ` +
    `That's 2 favorable outcomes out of 2^${n} = ${2 ** n} equally-likely coin combinations, so P = 2/2^n = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-polygonants-${n}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Spatial arrangements (n-gon no-collision = 2/2^n)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "General · Tournament brackets & arrangements",
    },
  };
}

/* ========================================================================== */
/* =================  5 — COUPON COLLECTOR (numeric)  ====================== */
/* ========================================================================== */

const COUPON_THEME = [
  { set: "sticker album", type: "sticker", act: "buy random packets" },
  { set: "cereal-box prize set", type: "prize", act: "open random boxes" },
  { set: "gacha banner", type: "character", act: "pull at random" },
];

/**
 * Coupon collector: expected draws to see all `n` equally-likely types = n·Hₙ.
 * Traps: n (one each, ignoring re-draws), n² (over-estimate), and the n·ln(n)
 * asymptotic without the correction term.
 */
export function buildCouponInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(COUPON_THEME);
  const n = rng.pick([4, 5, 6, 8, 10]);

  const value = couponCollectorExpected(n);
  const dp = 2;
  const answer = Number(decText(value, dp));

  const { errors, push } = numericErrors(answer, dp);
  push(
    n,
    `${n} counts one of each type and ignores re-draws. Collecting the k-th new type takes on average n/(n−k+1) draws, and these sum to n·Hₙ.`,
  );
  push(
    n * n,
    `n² = ${n * n} badly over-estimates; the harmonic sum Hₙ = ${fracText(value.div(F(n)))} is far below n, so n·Hₙ ≪ n².`,
  );
  push(
    n * Math.log(n),
    `n·ln(n) ≈ ${(n * Math.log(n)).toFixed(dp)} is the ASYMPTOTIC approximation (dropping the +γn correction); the exact value is n·Hₙ.`,
  );

  const prompt =
    `A ${th.set} has ${n} equally-likely ${th.type} types. You ${th.act}, one ${th.type} at a time (with replacement). ` +
    `On average, how many ${th.type}s must you draw to collect at least one of every type? (Round to ${dp} decimals.)`;
  const explanation =
    `Once you already hold k distinct types, each new draw is a fresh type with probability (n−k)/n, so the wait for it is geometric with mean n/(n−k). ` +
    `Summing over k = 0..n−1 gives n·(1 + 1/2 + … + 1/n) = n·Hₙ = ${n}·${fracText(value.div(F(n)))} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-coupon-${n}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Counting / expectation (coupon collector = n·Hₙ)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "General · Counting / expectation",
    },
  };
}

/* ========================================================================== */
/* =================  6 — LINEARITY: EXPECTED WORDS (numeric int)  ========= */
/* ========================================================================== */

const WORDS_THEME = [
  { stream: "token stream", token: "symbol", pair: "fusing pair" },
  { stream: "signal tape", token: "glyph", pair: "bonding pair" },
  { stream: "chain of beads", token: "bead", pair: "locking pair" },
];

/**
 * Expected number of "words" after `n` iid tokens over an alphabet of size
 * `alpha`, where `mergePairs` specific ORDERED adjacent pairs fuse (each pair
 * prob 1/alpha²). By linearity E[words] = n − (n−1)·mergePairs/alpha². Parameters
 * are chosen so the answer is a clean integer. Traps: forgetting merges (n),
 * using 1/alpha instead of 1/alpha², and counting only one merge (n − mergePairs).
 */
export function buildLinearityWordsInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(WORDS_THEME);
  const alpha = rng.pick([4, 5, 6]);
  const mergePairs = rng.pick([1, 2]);
  const alpha2 = alpha * alpha;

  // n − 1 must be a multiple of alpha²/gcd(mergePairs, alpha²) for a clean integer.
  const step = alpha2 / gcd(mergePairs, alpha2);
  const candidates: number[] = [];
  for (let m = 1; m <= 5; m++) candidates.push(1 + m * step);
  const valid = candidates.filter((cn) =>
    Number.isInteger(expectedWordsAfterMerges(cn, alpha, mergePairs).valueOf()),
  );
  const n = rng.pick(valid);

  const value = expectedWordsAfterMerges(n, alpha, mergePairs);
  const answer = value.valueOf(); // integer by construction

  const { errors, push } = numericErrors(answer, 0);
  push(
    n,
    `${n} ignores the expected merges. On average (n−1)·mergePairs/alpha² = ${n - 1}·${mergePairs}/${alpha2} = ${fracText(F((n - 1) * mergePairs, alpha2))} adjacent pairs fuse, each removing one word.`,
  );
  push(
    n - ((n - 1) * mergePairs) / alpha,
    `Using 1/alpha instead of 1/alpha²: a specific ORDERED adjacent pair has probability 1/alpha² = 1/${alpha2}, not 1/alpha = 1/${alpha}.`,
  );
  push(
    n - mergePairs,
    `n − mergePairs = ${n - mergePairs} counts only ONE merge, not the expected (n−1)·mergePairs/alpha² merges across all ${n - 1} adjacent gaps.`,
  );

  const prompt =
    `A ${th.stream} of ${n} ${th.token}s is generated, each an independent uniform choice from an alphabet of ${alpha} ${th.token}s. ` +
    `There ${mergePairs === 1 ? "is" : "are"} ${mergePairs} specific ordered adjacent ${th.pair}${mergePairs === 1 ? "" : "s"} (e.g. a particular "${th.token} then ${th.token}"): wherever such a pair appears in consecutive positions, it fuses into a single "word". ` +
    `What is the expected number of words after all fusions? (Whole number.)`;
  const explanation =
    `Start with ${n} separate ${th.token}s and count merges by linearity of expectation over the ${n - 1} adjacent gaps. ` +
    `Each ordered gap matches one of the ${mergePairs} fusing pattern${mergePairs === 1 ? "" : "s"} with probability ${mergePairs}/alpha² = ${mergePairs}/${alpha2}, so E[merges] = (n−1)·${mergePairs}/${alpha2} = ${fracText(F((n - 1) * mergePairs, alpha2))}. ` +
    `Thus E[words] = n − E[merges] = ${n} − ${fracText(F((n - 1) * mergePairs, alpha2))} = ${answer}.`;

  return {
    answer,
    numeric: {
      id: `gen-linwords-${alpha}-${mergePairs}-${n}`,
      prompt,
      answer,
      difficulty,
      concept: "Linearity of expectation (expected words after merges)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "General · Counting / expectation",
    },
  };
}

/* ========================================================================== */
/* =================  7 — TWO WINS IN A ROW (numeric)  ===================== */
/* ========================================================================== */

const SCHEDULE_THEME = [
  { team: "the away side", games: "road games" },
  { team: "the challenger", games: "qualifiers" },
  { team: "the club", games: "cup ties" },
];

/** Three-match schedules; per-match win probabilities as tenths. */
const WIN_SCHEDULES: [number, number, number][] = [
  [3, 6, 4],
  [4, 4, 7],
  [5, 3, 5],
  [6, 2, 6],
  [4, 7, 3],
  [2, 8, 3],
];

/**
 * P(at least two CONSECUTIVE wins) across a fixed 3-match schedule with per-match
 * win probs. Traps: P(win all three) — one of several patterns; the sum of
 * adjacent-pair win products (double-counts the all-win case); and P(≥1 win),
 * which is at-least-one, not two-in-a-row.
 */
export function buildTwoInRowScheduleInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(SCHEDULE_THEME);
  const sched = rng.pick(WIN_SCHEDULES);
  const wins = sched.map((x) => F(x, 10));

  const value = twoInARowScheduleProb(wins);
  const dp = 3;
  const answer = Number(decText(value, dp));

  const winAll = wins[0].mul(wins[1]).mul(wins[2]);
  const adjSum = wins[0].mul(wins[1]).add(wins[1].mul(wins[2]));
  const atLeastOne = F(1).sub(
    F(1).sub(wins[0]).mul(F(1).sub(wins[1])).mul(F(1).sub(wins[2])),
  );

  const { errors, push } = numericErrors(answer, dp);
  push(
    winAll,
    `${fracText(winAll)} is P(win EVERY match) — only one of several patterns (WWW) that contain two in a row; WWL and LWW also count.`,
  );
  push(
    adjSum,
    `Adding the adjacent-pair win probs P(w₁w₂)+P(w₂w₃) = ${fracText(adjSum)} double-counts the all-win case WWW (inclusion–exclusion needs the overlap subtracted).`,
  );
  push(
    atLeastOne,
    `1 − Π(1−wᵢ) = ${fracText(atLeastOne)} is P(at least ONE win), not two wins IN A ROW.`,
  );

  const probList = wins.map((w) => fracText(w)).join(", ");
  const prompt =
    `Over three straight ${th.games}, ${th.team} wins with probabilities ${probList} (independently). ` +
    `What is the probability of at least two CONSECUTIVE wins somewhere in the three? (Round to ${dp} decimals.)`;
  const explanation =
    `Enumerate the win/loss patterns with two adjacent wins: WWL, LWW, and WWW. ` +
    `Summing their probabilities (P=${fracText(wins[0])}, ${fracText(wins[1])}, ${fracText(wins[2])}) gives ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `Note P(win all three) = ${fracText(winAll)} is just the WWW slice, not the whole event.`;

  return {
    answer,
    numeric: {
      id: `gen-tworowsched-${sched.join("_")}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Counting patterns (two consecutive wins in a schedule)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "General · Counting / expectation",
    },
  };
}

/* ========================================================================== */
/* =================  8 — RUN OF CONSECUTIVE SYMBOLS (numeric)  ============ */
/* ========================================================================== */

const RUN_THEME = [
  { device: "a prize wheel", symbol: "bell", trial: "spin" },
  { device: "a scratch strip", symbol: "star", trial: "panel" },
  { device: "a lucky dip", symbol: "gold ticket", trial: "draw" },
];

/**
 * P(a run of ≥ `run` consecutive target symbols in `spins` iid trials, each the
 * target w.p. p). Exact via DP on the trailing run length. Traps: a union bound
 * (spins−run+1)·p^run (no inclusion–exclusion for overlapping windows), a single
 * fixed window p^run, and all-target p^spins.
 */
export function buildConsecutiveRunInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(RUN_THEME);
  const spins = rng.pick([5, 6, 7]);
  const run = rng.pick([3, 4].filter((r) => r <= spins));
  const pd = rng.pick([3, 4, 5]);
  const p = F(1, pd);

  const value = consecutiveRunProb(spins, run, p);
  const dp = 4;
  const answer = Number(decText(value, dp));

  const pRun = p.pow(run) as FractionType;
  const unionBound = F(spins - run + 1).mul(pRun);
  const allTarget = p.pow(spins) as FractionType;

  const { errors, push } = numericErrors(answer, dp);
  push(
    unionBound,
    `(spins−run+1)·p^run = ${spins - run + 1}·${fracText(pRun)} = ${fracText(unionBound)} sums the ${spins - run + 1} window probabilities without subtracting overlaps (inclusion–exclusion).`,
  );
  push(
    pRun,
    `p^run = ${fracText(pRun)} is just ONE fixed window of ${run} ${th.symbol}s in a row; the run can start at several positions.`,
  );
  push(
    allTarget,
    `p^spins = ${fracText(allTarget)} requires ALL ${spins} ${th.trial}s to be ${th.symbol}s — far stronger than a run of ${run}.`,
  );

  const prompt =
    `You take ${spins} independent ${th.trial}s on ${th.device}; each ${th.trial} shows a ${th.symbol} with probability ${fracText(p)}. ` +
    `What is the probability of a run of at least ${run} consecutive ${th.symbol}s somewhere in the ${spins} ${th.trial}s? (Round to ${dp} decimals.)`;
  const explanation =
    `Track the current trailing run length and advance it over the ${spins} ${th.trial}s (a ${th.symbol} w.p. ${fracText(p)} extends the run; anything else resets it), absorbing once the run reaches ${run}. ` +
    `This exact DP gives P = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `A naive window union (spins−run+1)·p^run = ${fracText(unionBound)} overcounts overlapping runs.`;

  return {
    answer,
    numeric: {
      id: `gen-consecrun-${spins}-${run}-${pd}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Counting runs (≥ run consecutive successes)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "General · Counting / expectation",
    },
  };
}

/* ========================================================================== */
/* =================  9 — FIRST CARD STRICTLY HIGHER (numeric)  ============ */
/* ========================================================================== */

const HIGHER_THEME = [
  { actor: "two players", act: "draw" },
  { actor: "two duelists", act: "flip" },
  { actor: "two contestants", act: "reveal" },
];

/** Deck parameterisations [ranks, suits] — reduced decks only (never a full 13×4). */
const DECK_PARAMS: [number, number][] = [
  [10, 4],
  [6, 4],
  [8, 3],
  [13, 2],
  [5, 2],
];

/**
 * P(the FIRST of two cards drawn without replacement has strictly higher rank)
 * from a deck of `ranks`×`suits` = suits·(ranks−1)/(2·(ranks·suits−1)). Traps:
 * ½ (ignores ties), the with-replacement (ranks−1)/(2·ranks), and dropping the
 * ½ altogether: suits·(ranks−1)/(ranks·suits).
 */
export function buildHigherCardInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(HIGHER_THEME);
  const [ranks, suits] = rng.pick(DECK_PARAMS);

  const value = higherCardProb(ranks, suits);
  const dp = 3;
  const answer = Number(decText(value, dp));

  const withRepl = F(ranks - 1, 2 * ranks);
  const noHalf = F(suits * (ranks - 1), ranks * suits);

  const { errors, push } = numericErrors(answer, dp);
  push(
    F(1, 2),
    `½ ignores TIES. With "strictly higher", a same-rank pair has no winner, so P(first higher) = P(second higher) < ½.`,
  );
  push(
    withRepl,
    `(ranks−1)/(2·ranks) = ${fracText(withRepl)} is the with-replacement approximation; without replacement the denominator is ranks·suits−1 = ${ranks * suits - 1}.`,
  );
  push(
    noHalf,
    `suits·(ranks−1)/(ranks·suits) = ${fracText(noHalf)} forgets the ½ that accounts for the symmetric "second higher" outcome.`,
  );

  const total = ranks * suits;
  const prompt =
    `A custom deck has ${total} cards — ${ranks} ranks, ${suits} of each. ${cap(th.actor)} ${th.act} the top two cards in turn (no card is returned). ` +
    `How likely is the earlier card to outrank the later one (strictly higher rank)? (Round to ${dp} decimals.)`;
  const explanation =
    `Condition on the first card's rank: if it has j ranks below it, it beats suits·j of the remaining ${total - 1} cards. Averaging over the uniform first rank gives suits·(ranks−1)/(2·(ranks·suits−1)) = ${suits}·${ranks - 1}/(2·${total - 1}) = ${fracText(value)} ≈ ${decText(value, dp)}. ` +
    `By symmetry this equals P(second higher); the remaining mass is the tie probability, so both are below ½.`;

  return {
    answer,
    numeric: {
      id: `gen-highercard-${ranks}-${suits}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Counting / symmetry (first card strictly higher)",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "General · Counting / expectation",
    },
  };
}

/* ========================================================================== */
/* =================  10 — DE MORGAN: P(not A or not B) (numeric)  ========= */
/* ========================================================================== */

const INCLEXCL_THEME = [
  { a: "the app crashes", b: "the sync fails", noun: "session" },
  { a: "flight A is delayed", b: "flight B is delayed", noun: "trip" },
  { a: "sensor X trips", b: "sensor Y trips", noun: "shift" },
];

/**
 * P(not A OR not B) = 1 − P(A∩B), with P(A∩B) = P(A)+P(B)−P(A∪B) (De Morgan +
 * inclusion–exclusion). Traps: reporting P(A∩B) itself, 1 − P(A∪B) = P((A∪B)ᶜ),
 * and P(A∪B).
 */
export function buildInclExclInstance(
  rng: Rng,
  difficulty: Difficulty,
): { answer: number; numeric: NumericQuestion } {
  const th = rng.pick(INCLEXCL_THEME);

  // Sample tenths with pAorB ≥ max(pA,pB), pAorB ≤ pA+pB (so P(A∩B) ∈ [0, min]).
  let a = 4;
  let b = 5;
  let c = 7;
  for (let tries = 0; tries < 60; tries++) {
    a = rng.int(3, 8);
    b = rng.int(3, 8);
    const lo = Math.max(a, b);
    const hi = Math.min(10, a + b);
    if (lo > hi) continue;
    c = rng.int(lo, hi);
    break;
  }
  const pA = F(a, 10);
  const pB = F(b, 10);
  const pAorB = F(c, 10);

  const value = notAorNotBProb(pAorB, pA, pB);
  const dp = 2;
  const answer = Number(decText(value, dp));

  const pAandB = pA.add(pB).sub(pAorB);
  const unionComp = F(1).sub(pAorB);

  const { errors, push } = numericErrors(answer, dp);
  push(
    pAandB,
    `${fracText(pAandB)} is P(A∩B) itself. By De Morgan P(Aᶜ∪Bᶜ) = 1 − P(A∩B), so you reported the complement of the answer.`,
  );
  push(
    unionComp,
    `1 − P(A∪B) = ${fracText(unionComp)} is P((A∪B)ᶜ) = P(neither), not P((A∩B)ᶜ).`,
  );
  push(
    pAorB,
    `${fracText(pAorB)} is just the given P(A∪B).`,
  );

  const prompt =
    `In a random ${th.noun}, P(${th.a}) = ${fracText(pA)}, P(${th.b}) = ${fracText(pB)}, and P(${th.a} OR ${th.b}) = ${fracText(pAorB)}. ` +
    `What is the probability that ${th.a} does NOT happen, OR ${th.b} does NOT happen (or both)? (Round to ${dp} decimals.)`;
  const explanation =
    `By De Morgan, P(Aᶜ ∪ Bᶜ) = P((A∩B)ᶜ) = 1 − P(A∩B). Inclusion–exclusion gives P(A∩B) = P(A)+P(B)−P(A∪B) = ${fracText(pA)}+${fracText(pB)}−${fracText(pAorB)} = ${fracText(pAandB)}. ` +
    `So the answer is 1 − ${fracText(pAandB)} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    answer,
    numeric: {
      id: `gen-inclexcl-${a}-${b}-${c}`,
      prompt,
      answer,
      decimals: dp,
      difficulty,
      concept: "Inclusion–exclusion / De Morgan (P(Aᶜ∪Bᶜ))",
      explanation,
      unit: "",
      commonErrors: errors,
      source: "General · Counting / expectation",
    },
  };
}

/* ========================================================================== */
/*  Named generators (adapters used by the levels + verification tests)        */
/* ========================================================================== */

// Tournaments & arrangements (numeric)
export const genBracketFinal = (rng: Rng): NumericQuestion =>
  buildBracketFinalInstance(rng, "medium").numeric;
export const genRound1 = (rng: Rng): NumericQuestion =>
  buildRound1Instance(rng, "easy").numeric;
export const genSemicircle = (rng: Rng): NumericQuestion =>
  buildSemicircleInstance(rng, "medium").numeric;
export const genPolygonAnts = (rng: Rng): NumericQuestion =>
  buildPolygonAntsInstance(rng, "easy").numeric;

// Counting / expectation misc (numeric)
export const genCoupon = (rng: Rng): NumericQuestion =>
  buildCouponInstance(rng, "medium").numeric;
export const genLinearityWords = (rng: Rng): NumericQuestion =>
  buildLinearityWordsInstance(rng, "medium").numeric;
export const genTwoInRowSchedule = (rng: Rng): NumericQuestion =>
  buildTwoInRowScheduleInstance(rng, "medium").numeric;
export const genConsecutiveRun = (rng: Rng): NumericQuestion =>
  buildConsecutiveRunInstance(rng, "medium").numeric;
export const genHigherCard = (rng: Rng): NumericQuestion =>
  buildHigherCardInstance(rng, "medium").numeric;
export const genInclExcl = (rng: Rng): NumericQuestion =>
  buildInclExclInstance(rng, "medium").numeric;
