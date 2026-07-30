import type { Rng } from "@/lib/rng";
import type { NumericQuestion } from "@/types/content";
import type FractionType from "fraction.js";
import {
  F,
  chooseBig,
  choose,
  decText,
  factorialBig,
  fracBig,
  fracText,
  numDp,
  powBig,
} from "./combinatorics";
import {
  allSameColorProb,
  avoidOneSpecialProb,
  eachPlayerOneSpecialProb,
  exactlyTwoColorsProb,
  oneCorrectAssignmentProb,
  oneOfEachColorProb,
  pairSumAtLeastProb,
} from "./solvers";
import { cap, numericErrors } from "./_shared";

/**
 * Parametric numeric generators for the Probability & Statistics →
 * **Combinatorial Analysis** subcategory, "Choose-k ratios" family (favorable
 * combinations ÷ total combinations). Mirrors the structure of
 * `../general/genCounting.ts`: a JSDoc + THEME array + `genX(rng)` per item.
 *
 * Every correct scalar is produced by the EXACT solver in `./solvers.ts`
 * (never re-derived here); every distractor (`numeric` commonErrors) is a
 * re-derived, NAMED misconception, computed the way a student making that exact
 * mistake would, then deduped and range-checked by `numericErrors`.
 *
 * NONE of the source-dataset questions are user-facing — every playable item is
 * freshly themed with different objects, stories, and numbers, and is fully
 * reproducible from its seed.
 */

/* ========================================================================== */
/* =================  1 — ONE OF EACH COLOR (numeric)  ==================== */
/* ========================================================================== */

const ONE_OF_EACH_THEME = [
  {
    place: "a felt drawstring pouch",
    obj: "gemstone",
    colors: ["amber", "jade", "onyx"],
  },
  {
    place: "a craft caddy",
    obj: "glass bead",
    colors: ["ruby", "teal", "gold"],
  },
  {
    place: "a hobbyist's tray",
    obj: "enamel pin",
    colors: ["coral", "mint", "slate"],
  },
];

/**
 * Urn with 3 color `counts` (each in [4..12]), draw 3 without replacement.
 * P(exactly one of each color) = ∏cᵢ / C(Σcᵢ, 3) via `oneOfEachColorProb`.
 * Traps: an ordered nᵏ = total³ denominator under an unordered ∏cᵢ numerator;
 * a full with-replacement model 3!·∏(cᵢ/total); and dropping one color factor.
 */
export function genOneOfEach(rng: Rng): NumericQuestion {
  const th = rng.pick(ONE_OF_EACH_THEME);
  let counts: number[];
  do {
    counts = [rng.int(4, 12), rng.int(4, 12), rng.int(4, 12)];
  } while (counts[0] === 10 && counts[1] === 10 && counts[2] === 10);
  const total = counts[0] + counts[1] + counts[2];
  const prod = counts[0] * counts[1] * counts[2];

  const value = oneOfEachColorProb(counts, 3);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const orderedDen = F(prod, total ** 3); // ∏cᵢ / total³ (nᵏ denominator)
  const withRepl = F(6 * prod, total ** 3); // 3!·∏(cᵢ/total), with replacement
  const dropColor = F(counts[0] * counts[1], choose(total, 3)); // forgot one color

  const { errors, push } = numericErrors(answer, dp);
  push(
    orderedDen,
    `∏cᵢ/total³ = ${prod}/${total ** 3} = ${fracText(orderedDen)} puts an unordered numerator over an ORDERED-with-replacement denominator total³; the correct total is C(${total},3) = ${choose(total, 3)}.`,
  );
  push(
    withRepl,
    `3!·∏(cᵢ/total) = ${fracText(withRepl)} treats the three draws as WITH replacement (independent), but the draw is without replacement — use C(${total},3) in the denominator.`,
  );
  push(
    dropColor,
    `${counts[0]}·${counts[1]}/C(${total},3) = ${fracText(dropColor)} drops the third color's C(cᵢ,1) factor; favorable must multiply one from EACH of the three colors.`,
  );

  const prompt =
    `${cap(th.place)} holds ${counts[0]} ${th.colors[0]} ${th.obj}s, ${counts[1]} ${th.colors[1]} ${th.obj}s, and ${counts[2]} ${th.colors[2]} ${th.obj}s. ` +
    `You draw 3 ${th.obj}s at once (without replacement). What is the probability you get exactly one of each color? (Round to ${dp} decimals.)`;
  const explanation =
    `Favorable draws pick one ${th.obj} of each color: ∏cᵢ = ${counts[0]}·${counts[1]}·${counts[2]} = ${prod}. ` +
    `Total ways to draw 3 of ${total} is C(${total},3) = ${choose(total, 3)}. ` +
    `So P = ${prod}/${choose(total, 3)} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    id: `ca-oneofeach-${counts.join("-")}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "easy",
    concept: "Choose-k ratios (one of each color)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Combinatorial Analysis · Choose-k ratios",
  };
}

/* ========================================================================== */
/* =================  2 — ALL SAME COLOR (numeric)  ====================== */
/* ========================================================================== */

const ALL_SAME_THEME = [
  {
    place: "a snack bowl",
    obj: "jelly bean",
    colors: ["cherry", "lime", "grape"],
  },
  {
    place: "a desk organizer",
    obj: "paper clip",
    colors: ["red", "blue", "green"],
  },
  {
    place: "a sewing kit",
    obj: "button",
    colors: ["pearl", "brass", "jet"],
  },
];

/**
 * Box with 3 small color `counts` (each in [3..6]), draw 3 without replacement.
 * P(all three the same color) = Σ C(cᵢ,3) / C(Σcᵢ,3) via `allSameColorProb`.
 * Traps: counting only the dominant color's triples; a with-replacement model
 * Σ(cᵢ/N)³; and permutations cᵢ(cᵢ−1)(cᵢ−2) over C(N,3) (forgot to ÷3! on top).
 */
export function genAllSameColor(rng: Rng): NumericQuestion {
  const th = rng.pick(ALL_SAME_THEME);
  const counts = [rng.int(3, 6), rng.int(3, 6), rng.int(3, 6)];
  const total = counts[0] + counts[1] + counts[2];

  const value = allSameColorProb(counts, 3);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const maxC = Math.max(...counts);
  const oneColor = F(choose(maxC, 3), choose(total, 3)); // only the biggest color
  let withRepl = F(0);
  for (const c of counts) withRepl = withRepl.add(F(c, total).pow(3) as FractionType);
  const sumPerm = counts.reduce((a, c) => a + c * (c - 1) * (c - 2), 0);
  const perms = F(sumPerm, choose(total, 3)); // ordered triples per color

  const { errors, push } = numericErrors(answer, dp);
  push(
    oneColor,
    `C(${maxC},3)/C(${total},3) = ${fracText(oneColor)} counts only the ${th.obj}s of one color; you must ADD C(cᵢ,3) over all three colors.`,
  );
  push(
    withRepl,
    `Σ(cᵢ/${total})³ = ${fracText(withRepl)} models the draws as WITH replacement (independent); without replacement use Σ C(cᵢ,3) / C(${total},3).`,
  );
  push(
    perms,
    `Σ cᵢ(cᵢ−1)(cᵢ−2) / C(${total},3) = ${fracText(perms)} counts ORDERED same-color triples over an unordered denominator — divide the numerator by 3! as well (that gives C(cᵢ,3)).`,
  );

  const prompt =
    `${cap(th.place)} contains ${counts[0]} ${th.colors[0]} ${th.obj}s, ${counts[1]} ${th.colors[1]} ${th.obj}s, and ${counts[2]} ${th.colors[2]} ${th.obj}s. ` +
    `You scoop out 3 ${th.obj}s at random (without replacement). What is the probability all three are the same color? (Round to ${dp} decimals.)`;
  const explanation =
    `A monochrome scoop must come entirely from one color, so favorable = ΣC(cᵢ,3) = C(${counts[0]},3)+C(${counts[1]},3)+C(${counts[2]},3) = ${choose(counts[0], 3) + choose(counts[1], 3) + choose(counts[2], 3)}. ` +
    `Total = C(${total},3) = ${choose(total, 3)}, so P = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    id: `ca-allsame-${counts.join("-")}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "easy",
    concept: "Choose-k ratios (all same color)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Combinatorial Analysis · Choose-k ratios",
  };
}

/* ========================================================================== */
/* =================  3 — EXACTLY TWO COLORS (numeric)  ================== */
/* ========================================================================== */

const TWO_COLOR_THEME = [
  {
    place: "a tackle box",
    obj: "lure",
    colors: ["silver", "copper", "neon"],
  },
  {
    place: "a yarn basket",
    obj: "skein",
    colors: ["rose", "olive", "indigo"],
  },
  {
    place: "a marker cup",
    obj: "marker",
    colors: ["black", "azure", "lemon"],
  },
];

/**
 * Same 3-color box (small `counts` in [3..6]), draw 3 without replacement.
 * P(exactly two of the three colors appear) via `exactlyTwoColorsProb`:
 * Σ_{i<j}[C(cᵢ+cⱼ,3) − C(cᵢ,3) − C(cⱼ,3)] / C(N,3). Traps: forgetting to
 * subtract the single-color triples; using 1 − P(all same) (also drops the
 * one-of-each mass); and reporting P(one of each) instead (all three present).
 */
export function genExactlyTwoColors(rng: Rng): NumericQuestion {
  const th = rng.pick(TWO_COLOR_THEME);
  const counts = [rng.int(3, 6), rng.int(3, 6), rng.int(3, 6)];
  const total = counts[0] + counts[1] + counts[2];

  const value = exactlyTwoColorsProb(counts, 3);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  // Forgot to subtract the all-one-color triples within each color pair.
  let noSub = 0;
  for (let i = 0; i < counts.length; i++)
    for (let j = i + 1; j < counts.length; j++)
      noSub += choose(counts[i] + counts[j], 3);
  const noSubtract = F(noSub, choose(total, 3));
  const compAllSame = F(1).sub(allSameColorProb(counts, 3)); // 1 − P(all same)
  const oneEach = oneOfEachColorProb(counts, 3); // all three colors present

  const { errors, push } = numericErrors(answer, dp);
  push(
    noSubtract,
    `Σ C(cᵢ+cⱼ,3) / C(${total},3) = ${fracText(noSubtract)} counts every triple drawn from a color pair but forgets to subtract the all-one-color triples C(cᵢ,3)+C(cⱼ,3).`,
  );
  push(
    compAllSame,
    `1 − P(all same color) = ${fracText(compAllSame)} still includes the "one of each of the three colors" draws; exactly-two means you must ALSO subtract the all-three-colors mass.`,
  );
  push(
    oneEach,
    `${fracText(oneEach)} is P(one of EACH color) — all three colors present, the opposite of exactly two colors appearing.`,
  );

  const prompt =
    `${cap(th.place)} holds ${counts[0]} ${th.colors[0]} ${th.obj}s, ${counts[1]} ${th.colors[1]} ${th.obj}s, and ${counts[2]} ${th.colors[2]} ${th.obj}s. ` +
    `You draw 3 ${th.obj}s at random (without replacement). What is the probability the draw shows exactly two of the three colors? (Round to ${dp} decimals.)`;
  const explanation =
    `For each color pair, draw all 3 from those two colors — C(cᵢ+cⱼ,3) — then subtract the all-one-color triples C(cᵢ,3)+C(cⱼ,3) so at least one of each of the pair appears. ` +
    `Summing over the 3 pairs and dividing by C(${total},3) = ${choose(total, 3)} gives P = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    id: `ca-exactlytwo-${counts.join("-")}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "easy",
    concept: "Choose-k ratios (exactly two colors)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Combinatorial Analysis · Choose-k ratios",
  };
}

/* ========================================================================== */
/* =================  4 — AVOID THE LONE EVEN TILE (numeric)  ============= */
/* ========================================================================== */

const AVOID_SPECIAL_THEME = [
  { place: "a locker rack", obj: "number tile" },
  { place: "a bingo cage", obj: "value chip" },
  { place: "a stationery drawer", obj: "labeled token" },
];

/**
 * Pick 4 of `n` items (n ∈ {12,14,16,18,20}), exactly one of which is even and
 * the rest odd. The 4-item sum is even ⟺ all 4 chosen are odd ⟺ the lone even
 * item is avoided: P = C(n−1,4)/C(n,4) = (n−4)/n via `avoidOneSpecialProb`.
 * Traps: naive 1/2 parity; the complement 4/n (even item chosen); and a
 * with-replacement ((n−1)/n)⁴ model of "avoid on each of 4 picks".
 */
export function genAvoidSpecialSum(rng: Rng): NumericQuestion {
  const th = rng.pick(AVOID_SPECIAL_THEME);
  // n ≠ 16: choosing 4 of 16 with one even is the source's 3/4 tuple (Sum of Primes).
  const n = rng.pick([12, 14, 18, 20]);

  const value = avoidOneSpecialProb(n, 4);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const naive = F(1, 2);
  const complement = F(4, n); // P(the even item IS selected)
  const withRepl = F(n - 1, n).pow(4) as FractionType;

  const { errors, push } = numericErrors(answer, dp);
  push(
    naive,
    `1/2 assumes the sum is equally likely even or odd. Here parity is NOT symmetric: an even sum requires avoiding the single even ${th.obj}, so P = C(${n - 1},4)/C(${n},4).`,
  );
  push(
    complement,
    `4/${n} = ${fracText(complement)} is P(the even ${th.obj} IS among the 4 chosen) — the complement, which gives an ODD sum, not an even one.`,
  );
  push(
    withRepl,
    `((n−1)/n)⁴ = ${fracText(withRepl)} treats the 4 picks as independent with replacement; they are 4 DISTINCT items, so use C(${n - 1},4)/C(${n},4).`,
  );

  const prompt =
    `${cap(th.place)} holds ${n} ${th.obj}s: exactly one shows an even number and the other ${n - 1} are odd. ` +
    `You grab 4 ${th.obj}s at random (without replacement). What is the probability that the sum of the 4 numbers is even? (Round to ${dp} decimals.)`;
  const explanation =
    `A sum of 4 numbers is even exactly when an even count of the addends are odd. With only one even ${th.obj} available, the 4-pick sum is even ⟺ all 4 chosen are odd ⟺ the lone even ${th.obj} is avoided. ` +
    `That probability is C(${n - 1},4)/C(${n},4) = (${n}−4)/${n} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    id: `ca-avoidspecial-${n}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "easy",
    concept: "Choose-k ratios (avoid one special item)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Combinatorial Analysis · Choose-k ratios",
  };
}

/* ========================================================================== */
/* =================  5 — PAIR SUM AT LEAST THRESHOLD (numeric)  ========= */
/* ========================================================================== */

const PAIR_SUM_THEME = [
  { place: "a fishbowl", obj: "raffle stub" },
  { place: "a velvet bag", obj: "cloakroom tag" },
  { place: "a hopper", obj: "lotto disc" },
];

/**
 * Tickets numbered 1..m (m ∈ {8,9,10,12}), draw two distinct, P(sum ≥ threshold)
 * via `pairSumAtLeastProb`. Threshold is sampled in the upper range so the answer
 * is a clean minority probability. Traps: off-by-one using strict > (drops the
 * exactly-threshold pairs); counting each unordered pair twice (ordered numerator
 * over C(m,2)); and inflating the sample space with the m same-ticket draws.
 */
export function genPairSumThreshold(rng: Rng): NumericQuestion {
  const th = rng.pick(PAIR_SUM_THEME);
  let m = 8;
  let threshold = 11;
  let value = pairSumAtLeastProb(m, threshold);
  for (let tries = 0; tries < 200; tries++) {
    m = rng.pick([8, 9, 10, 12]);
    threshold = rng.int(m, 2 * m - 3);
    value = pairSumAtLeastProb(m, threshold);
    const v = value.valueOf();
    // Avoid the source tuple (tickets 1–10, sum ≥ 12 → 4/9).
    const isSourceTuple = m === 10 && threshold === 12;
    if (v > 0 && v <= 0.5 && !isSourceTuple) break;
  }
  const totalPairs = choose(m, 2);
  const favCount = Math.round(value.mul(totalPairs).valueOf());

  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const strict = pairSumAtLeastProb(m, threshold + 1); // used > instead of ≥
  const ordered = F(2 * favCount, totalPairs); // counted ordered pairs
  const selfIncluded = F(favCount, totalPairs + m); // added m same-ticket draws

  const { errors, push } = numericErrors(answer, dp);
  push(
    strict,
    `Using strict sum > ${threshold} gives ${fracText(strict)}; the question is sum ≥ ${threshold}, so the pairs summing to exactly ${threshold} must be counted too.`,
  );
  push(
    ordered,
    `${2 * favCount}/${totalPairs} = ${fracText(ordered)} counts each unordered pair twice (ordered draws) over the C(${m},2) unordered denominator — a factor-of-2 mismatch.`,
  );
  push(
    selfIncluded,
    `${favCount}/${totalPairs + m} = ${fracText(selfIncluded)} adds the ${m} "same ${th.obj} twice" outcomes to the sample space; the two ${th.obj}s are distinct, so the denominator is C(${m},2) = ${totalPairs}.`,
  );

  const prompt =
    `${cap(th.place)} contains ${m} ${th.obj}s numbered 1 through ${m}. You draw two different ${th.obj}s at random. ` +
    `What is the probability that their numbers sum to at least ${threshold}? (Round to ${dp} decimals.)`;
  const explanation =
    `There are C(${m},2) = ${totalPairs} equally likely unordered pairs. Counting those with sum ≥ ${threshold} gives ${favCount} favorable pairs. ` +
    `So P = ${favCount}/${totalPairs} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    id: `ca-pairsum-${m}-${threshold}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "easy",
    concept: "Choose-k ratios (pair sum threshold)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Combinatorial Analysis · Choose-k ratios",
  };
}

/* ========================================================================== */
/* =================  6 — ONE CORRECT ASSIGNMENT (numeric)  ============== */
/* ========================================================================== */

const ASSIGNMENT_THEME = [
  { group: "interns", role: "the on-call pager" },
  { group: "volunteers", role: "the demo slot" },
  { group: "analysts", role: "the client account" },
];

/**
 * From `n` people (n ∈ {5..9}), a random subset of `k` (k ∈ [2..n−1]) is chosen
 * to receive an option; exactly ONE subset is the designated correct one.
 * P(the random choice matches) = 1/C(n,k) via `oneCorrectAssignmentProb`.
 * Traps: 1/n! (ordered everyone), 1/nᵏ (k independent labeled picks), and k/n
 * (the per-person selection chance).
 */
export function genOneAssignment(rng: Rng): NumericQuestion {
  const th = rng.pick(ASSIGNMENT_THEME);
  // n ≠ 7: 1/C(7,3) = 1/C(7,4) = 1/35 is the source tuple (Airplane Food).
  const n = rng.pick([5, 6, 8, 9]);
  const k = rng.int(2, n - 1);

  const value = oneCorrectAssignmentProb(n, k);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const invFact = fracBig(1n, factorialBig(n));
  const invPow = fracBig(1n, powBig(n, k));
  const kOverN = F(k, n);

  const { errors, push } = numericErrors(answer, dp);
  push(
    invFact,
    `1/${n}! = ${fracText(invFact)} divides by every ordering of all ${n} people, but only WHICH ${k} are chosen matters (unordered) — that is C(${n},${k}), not ${n}!.`,
  );
  push(
    invPow,
    `1/${n}^${k} = ${fracText(invPow)} treats the choice as ${k} independent labeled picks from ${n} (ordered, with repetition); the correct count is C(${n},${k}) = ${choose(n, k)}.`,
  );
  push(
    kOverN,
    `${k}/${n} = ${fracText(kOverN)} is the chance a single person is chosen, not the chance the whole set of ${k} matches the one correct set.`,
  );

  const prompt =
    `A manager will randomly pick ${k} of ${n} ${th.group} to take ${th.role}, with every choice of ${k} equally likely. ` +
    `Exactly one particular group of ${k} is the intended assignment. What is the probability the random pick is exactly that intended group? (Round to ${dp} decimals.)`;
  const explanation =
    `There are C(${n},${k}) = ${choose(n, k)} equally likely subsets of ${k} ${th.group}, and only one is correct. ` +
    `So P = 1/C(${n},${k}) = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    id: `ca-oneassign-${n}-${k}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "easy",
    concept: "Choose-k ratios (one correct subset = 1/C(n,k))",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Combinatorial Analysis · Choose-k ratios",
  };
}

/* ========================================================================== */
/* =================  7 — EACH HAND GETS ONE SPECIAL (numeric)  ========== */
/* ========================================================================== */

const EACH_SPECIAL_THEME = [
  { players: "friends", obj: "card", special: "golden ticket" },
  { players: "roommates", obj: "tile", special: "wildcard" },
  { players: "teammates", obj: "card", special: "trophy card" },
];

/**
 * A deck of `players`·`handSize` cards (players ∈ {3,4}, handSize ∈ {5..13})
 * containing exactly `players` special cards is dealt into `players` hands of
 * `handSize`. P(each hand gets exactly one special) = handSize^players /
 * C(deck, players) via `eachPlayerOneSpecialProb`. Traps: an independence slip
 * (handSize/deck)^players; only players! matchings; and a uniform 1/C(deck,players).
 */
export function genEachPlayerSpecial(rng: Rng): NumericQuestion {
  const th = rng.pick(EACH_SPECIAL_THEME);
  const players = rng.pick([3, 4]);
  // handSize ≤ 12: (4 players, 13 cards) is the source's 52-card "Aces for All" tuple.
  const handSize = rng.int(5, 12);
  const deck = players * handSize;

  const value = eachPlayerOneSpecialProb(players, handSize);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const indep = F(handSize, deck).pow(players) as FractionType;
  const permOnly = fracBig(factorialBig(players), chooseBig(deck, players));
  const uniform = fracBig(1n, chooseBig(deck, players));

  const { errors, push } = numericErrors(answer, dp);
  push(
    indep,
    `(${handSize}/${deck})^${players} = ${fracText(indep)} treats the ${players} special ${th.obj}s' landing hands as independent, each in a given hand w.p. handSize/deck; they compete for the same seats, so use handSize^${players}/C(${deck},${players}).`,
  );
  push(
    permOnly,
    `${players}!/C(${deck},${players}) = ${fracText(permOnly)} counts only the ${players}! ways to match specials to hands, forgetting each special can sit in any of the ${handSize} positions in its hand ⇒ favorable is handSize^${players}, not ${players}!.`,
  );
  push(
    uniform,
    `1/C(${deck},${players}) = ${fracText(uniform)} assumes only ONE favorable placement of the ${players} special ${th.obj}s among the C(${deck},${players}) equally likely position-sets.`,
  );

  const prompt =
    `${players} ${th.players} are each dealt a hand of ${handSize} ${th.obj}s from a shuffled deck of ${deck} ${th.obj}s that contains exactly ${players} ${th.special}s. ` +
    `What is the probability that every ${th.players.slice(0, -1)} receives exactly one ${th.special}? (Round to ${dp} decimals.)`;
  const explanation =
    `Look only at the ${players} special ${th.obj}s' positions among the ${deck} seats: favorable arrangements put one in each hand, giving handSize^${players} = ${handSize}^${players} = ${powBig(handSize, players).toString()} choices of seats. ` +
    `Total ways to place the ${players} specials is C(${deck},${players}) = ${chooseBig(deck, players).toString()}, so P = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    id: `ca-eachspecial-${players}-${handSize}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "easy",
    concept: "Choose-k ratios (each hand one special)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: "Combinatorial Analysis · Choose-k ratios",
  };
}
