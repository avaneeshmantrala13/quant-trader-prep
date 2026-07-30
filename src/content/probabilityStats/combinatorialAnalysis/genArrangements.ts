import type { Rng } from "@/lib/rng";
import type { NumericQuestion } from "@/types/content";
import {
  F,
  chooseBig,
  decText,
  factorialBig,
  fallingBig,
  fracBig,
  fracText,
  numDp,
  powBig,
} from "./combinatorics";
import {
  circularAscendingProb,
  dealUntilOneEachProb,
  heavierPanProb,
  independentChoicesCount,
  keepBothNeighborsProb,
  orderedDrawProb,
  unionFixedBitsCount,
} from "./solvers";
import { numericErrors } from "./_shared";

/**
 * Parametric numeric generators for the Probability & Statistics →
 * **Combinatorial Analysis** subcategory, "Arrangements & multiplication
 * principle" family (ordered draws / chain rule, deal-until-stop, circular
 * arrangements, the gap method, independent-choice counts, inclusion–exclusion
 * on fixed bit blocks, and balance-scale symmetry).
 *
 * Every correct value is produced by an EXACT solver in `./solvers.ts` (never a
 * hardcoded table); every distractor (`numeric` commonErrors) is a re-derived,
 * NAMED misconception, guaranteed distinct and ≠ the answer at the grading
 * precision (`numericErrors` dedupes and drops non-finite / negative values).
 *
 * Themes are all freshly invented — none reuse a source-dataset title.
 */

const SHARED_SOURCE =
  "Combinatorial Analysis · Arrangements & multiplication principle";

/* ========================================================================== */
/* =================  1 — ORDERED DRAW / CHAIN RULE (numeric)  ============= */
/* ========================================================================== */

const URN_THEMES = [
  { vessel: "a velvet pouch", n0: "sapphire", n1: "amber", item: "chips" },
  { vessel: "a clay jar", n0: "jade", n1: "coral", item: "beads" },
  { vessel: "a felt bag", n0: "onyx", n1: "pearl", item: "stones" },
];

const DRAW_PATTERNS: number[][] = [
  [0, 0, 1, 1],
  [0, 1, 0, 1],
  [1, 1, 0, 0],
  [0, 1, 1, 0],
];

/**
 * P(an ORDERED draw without replacement from a 2-colour urn matches a specific
 * colour sequence), via the chain rule (decrement both the drawn colour count
 * and the total after each draw). Traps: the with-replacement product (odds held
 * fixed each draw), shrinking only the denominator (forget to decrement the
 * colour count), and the order-blind combination ratio.
 */
export function genOrderedDraw(rng: Rng): NumericQuestion {
  const th = rng.pick(URN_THEMES);
  let a = rng.int(5, 10);
  let b = rng.int(5, 10);
  // {6,9} with a 2-2 pattern reproduces the source's 0.0659 (Button Tin #1).
  if ((a === 6 && b === 9) || (a === 9 && b === 6)) {
    a = rng.int(5, 10);
    b = rng.pick([5, 7, 8, 10]);
  }
  const sequence = rng.pick(DRAW_PATTERNS);
  const N0 = a + b;
  const L = sequence.length;

  const value = orderedDrawProb([a, b], sequence);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  // with replacement / forgetting to decrement: odds a/(a+b) held fixed each draw
  let withRepl = F(1);
  for (const c of sequence) withRepl = withRepl.mul(F(c === 0 ? a : b, N0));
  // shrink the pool size but reuse the ORIGINAL colour counts
  let decDenomOnly = F(1);
  let tot = N0;
  for (const c of sequence) {
    decDenomOnly = decDenomOnly.mul(F(c === 0 ? a : b, tot));
    tot -= 1;
  }
  // order-blind combination ratio
  const n0 = sequence.filter((x) => x === 0).length;
  const n1 = L - n0;
  const unordered = fracBig(
    chooseBig(a, n0) * chooseBig(b, n1),
    chooseBig(N0, L),
  );

  const { errors, push } = numericErrors(answer, dp);
  push(
    withRepl,
    `The with-replacement product (a/(a+b))^${n0}·(b/(a+b))^${n1} = ${fracText(withRepl)} keeps the odds fixed every draw — it forgets to decrement the counts as ${th.item} leave the pouch.`,
  );
  push(
    decDenomOnly,
    `Shrinking the pool size but reusing the ORIGINAL colour counts gives ${fracText(decDenomOnly)}; whenever you draw a colour, that colour's count must drop too, not just the total.`,
  );
  push(
    unordered,
    `The order-blind ratio C(${a},${n0})·C(${b},${n1})/C(${N0},${L}) = ${fracText(unordered)} counts unordered handfuls, but this asks for one SPECIFIC ordered sequence.`,
  );

  const seqWords = sequence.map((c) => (c === 0 ? th.n0 : th.n1)).join(", ");
  const first = sequence[0] === 0 ? th.n0 : th.n1;
  const firstNum = sequence[0] === 0 ? a : b;
  const prompt =
    `From ${th.vessel} holding ${a} ${th.n0} and ${b} ${th.n1} ${th.item}, you draw ${L} ${th.item} one at a time WITHOUT replacement. ` +
    `What is the probability the colours come out in exactly this order — ${seqWords}? (Round to ${dp} decimals.)`;
  const explanation =
    `Multiply the chain-rule fractions, decrementing after each draw: the first ${first} factor is ${firstNum}/${N0}, then each subsequent factor uses the reduced colour count over a total shrinking from ${N0} down to ${N0 - L + 1}. ` +
    `The full product is P = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    id: `gen-ordereddraw-${a}-${b}-${sequence.join("")}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "medium",
    concept: "Ordered draw without replacement (chain rule)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SHARED_SOURCE,
  };
}

/* ========================================================================== */
/* =================  2 — DEAL UNTIL STOP CARD (numeric)  ================== */
/* ========================================================================== */

const DEAL_THEMES = [
  { deck: "a shuffled arcade deck", target: "prize", stop: "buzzer" },
  { deck: "a shuffled festival deck", target: "token", stop: "joker" },
  { deck: "a shuffled relay deck", target: "relay", stop: "halt" },
];

// [4,4,4] omitted: with stop 4 or 1 it reproduces the source's Specific Card #2/#3.
const DEAL_GROUPS: number[][] = [
  [5, 5, 5],
  [4, 4],
  [3, 3, 3],
];

/**
 * P(dealing one card at a time until the first STOP card, exactly one of each of
 * the `g` target groups appears BEFORE it). Favourable = g!·∏(groupSizeᵢ)·stop,
 * total = falling factorial of (Σgroups+stop) taken g+1. Traps: dropping the g!
 * ordering factor, dropping the ∏(groupSizeᵢ) copy multipliers, and using an
 * unordered C(·) denominator instead of the falling factorial.
 */
export function genDealUntil(rng: Rng): NumericQuestion {
  const th = rng.pick(DEAL_THEMES);
  const groupSizes = rng.pick(DEAL_GROUPS);
  const stopSize = rng.pick([1, 4]);
  const g = groupSizes.length;

  const value = dealUntilOneEachProb(groupSizes, stopSize);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  let prodGroups = 1n;
  for (const s of groupSizes) prodGroups *= BigInt(s);
  const sum = groupSizes.reduce((x, y) => x + y, 0);
  const relevant = sum + stopSize;
  const fallDen = fallingBig(relevant, g + 1);
  const chooseDen = chooseBig(relevant, g + 1);
  const factG = factorialBig(g);
  const stopB = BigInt(stopSize);

  const forgotFactorial = fracBig(prodGroups * stopB, fallDen);
  const forgotCopies = fracBig(factG * stopB, fallDen);
  const unorderedDenom = fracBig(prodGroups * stopB, chooseDen);

  const { errors, push } = numericErrors(answer, dp);
  push(
    forgotFactorial,
    `Dropping the ${g}! = ${factG} ordering factor for the ${g} target kinds gives ${fracText(forgotFactorial)}; the kinds can appear before the ${th.stop} in any of ${g}! orders.`,
  );
  push(
    forgotCopies,
    `Dropping the copy multipliers ∏(sizes) = ${prodGroups} gives ${fracText(forgotCopies)}; each of the ${g} kinds can be any of its several copies.`,
  );
  push(
    unorderedDenom,
    `Using an unordered denominator C(${relevant},${g + 1}) = ${chooseDen} instead of the falling factorial ${fallDen} gives ${fracText(unorderedDenom)}; position order among the ${g + 1} relevant cards matters here.`,
  );

  const prompt =
    `${cap(th.deck)} contains ${g} distinct ${th.target} kinds — each kind present in ${groupSizes[0]} copies — plus ${stopSize} ${th.stop} card${stopSize > 1 ? "s" : ""}. ` +
    `Cards are dealt one at a time until the first ${th.stop} appears. What is the probability that exactly one ${th.target} of each of the ${g} kinds shows up before that ${th.stop}? (Round to ${dp} decimals.)`;
  const explanation =
    `Only the ${relevant} relevant cards matter (${sum} ${th.target}s + ${stopSize} ${th.stop}${stopSize > 1 ? "s" : ""}). ` +
    `Favourable orderings = ${g}!·∏(sizes)·(stop copies) = ${factG}·${prodGroups}·${stopSize} = ${factG * prodGroups * stopB}, over the falling factorial for the first ${g + 1} positions = ${fallDen}. ` +
    `So P = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    id: `gen-dealuntil-${groupSizes.join("_")}-${stopSize}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "medium",
    concept: "Deal-until-stop (one of each kind before the stop)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SHARED_SOURCE,
  };
}

/* ========================================================================== */
/* =================  3 — CIRCULAR ASCENDING (numeric)  =================== */
/* ========================================================================== */

const RING_THEMES = [
  { people: "hikers", attr: "height", place: "a campfire ring" },
  { people: "cellists", attr: "seniority", place: "a rehearsal circle" },
  { people: "clocktowers", attr: "chime pitch", place: "a plaza" },
];

/**
 * P(`n` distinct-valued people seated in random order around a round table end
 * up in ascending order clockwise OR counter-clockwise) = 2n/n! = 2/(n−1)!.
 * Traps: one winding direction only 1/(n−1)!, the linear 1/n! (ignoring that
 * rotations coincide), and a naive 2/n.
 */
export function genCircularAscending(rng: Rng): NumericQuestion {
  const th = rng.pick(RING_THEMES);
  // n ≠ 5: 5 seats ascending both ways is the source's 1/12 tuple (Table of Ages).
  const n = rng.pick([4, 6, 7]);

  const value = circularAscendingProb(n);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const oneDirection = fracBig(1n, factorialBig(n - 1));
  const linear = fracBig(1n, factorialBig(n));
  const twoOverN = F(2, n);

  const { errors, push } = numericErrors(answer, dp);
  push(
    oneDirection,
    `1/(${n}−1)! = ${fracText(oneDirection)} counts only ONE winding direction; both clockwise AND counter-clockwise ascending qualify, so double it.`,
  );
  push(
    linear,
    `1/${n}! = ${fracText(linear)} treats the seats as a LINE of ${n}! orders; around a circle rotations coincide, leaving (${n}−1)! seatings and the ×2 for direction.`,
  );
  push(
    twoOverN,
    `2/${n} = ${fracText(twoOverN)} is a naive "2 good directions out of ${n}" guess that ignores the factorial number of seatings.`,
  );

  const prompt =
    `${n} ${th.people} of distinct ${th.attr}s sit in random order around ${th.place}. ` +
    `What is the probability their ${th.attr}s increase in ascending order going ALL THE WAY around — either clockwise or counter-clockwise? (Round to ${dp} decimals.)`;
  const explanation =
    `Around a circle there are (${n}−1)! = ${factorialBig(n - 1)} distinct seatings (rotations identified). Exactly 2 of them are fully ascending — one clockwise, one counter-clockwise. ` +
    `So P = 2/(${n}−1)! = 2·${n}/${n}! = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    id: `gen-circasc-${n}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "medium",
    concept: "Circular arrangement (ascending either direction)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SHARED_SOURCE,
  };
}

/* ========================================================================== */
/* =================  4 — GAP METHOD: KEEP BOTH NEIGHBOURS (numeric)  ====== */
/* ========================================================================== */

const GAP_THEMES = [
  { ring: "standing stones", filler: "lanterns", anchor: "stone" },
  { ring: "carousel horses", filler: "riders", anchor: "horse" },
  { ring: "totem posts", filler: "banners", anchor: "post" },
];

/**
 * P(a distinguished anchor keeps BOTH its neighbours when `fillers` items are
 * placed into distinct gaps around a circle of `anchors` items) — its two
 * flanking gaps must both stay empty: C(anchors−2, fillers)/C(anchors, fillers).
 * Traps: keeping only ONE gap empty C(a−1,f)/C(a,f), the complement, and a linear
 * (anchors−2)/anchors "2 bad gaps out of anchors" guess.
 */
export function genGapMethod(rng: Rng): NumericQuestion {
  const th = rng.pick(GAP_THEMES);
  const anchors = rng.int(10, 16);
  let fillers = rng.int(3, anchors - 3);
  // Avoid the source tuple (15 gaps, 9 fillers → 1/7, Round Table Jesters).
  if (anchors === 15 && fillers === 9) fillers = rng.pick([7, 8, 10]);

  const value = keepBothNeighborsProb(anchors, fillers);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const oneGapEmpty = fracBig(
    chooseBig(anchors - 1, fillers),
    chooseBig(anchors, fillers),
  );
  const complement = F(1).sub(value);
  const linear = F(anchors - 2, anchors);

  const { errors, push } = numericErrors(answer, dp);
  push(
    oneGapEmpty,
    `C(${anchors}−1,${fillers})/C(${anchors},${fillers}) = ${fracText(oneGapEmpty)} keeps only ONE flanking gap empty; BOTH gaps must be empty to retain both neighbours.`,
  );
  push(
    complement,
    `${fracText(complement)} is the probability the ${th.anchor} LOSES at least one neighbour — the complement of the event asked.`,
  );
  push(
    linear,
    `(${anchors}−2)/${anchors} = ${fracText(linear)} is a linear "2 bad gaps out of ${anchors}" guess; the gaps are filled jointly, so use the ratio of C(·) counts.`,
  );

  const prompt =
    `${anchors} ${th.ring} stand evenly around a circle, and ${fillers} ${th.filler} are hung in ${fillers} of the ${anchors} distinct gaps between consecutive ${th.anchor}s (at most one per gap). ` +
    `What is the probability that one particular ${th.anchor} keeps BOTH of its neighbouring ${th.anchor}s — i.e. the two gaps flanking it stay empty? (Round to ${dp} decimals.)`;
  const explanation =
    `The ${fillers} ${th.filler} occupy a uniformly random ${fillers}-subset of the ${anchors} gaps. The chosen ${th.anchor} keeps both neighbours exactly when neither flanking gap is used: ` +
    `C(${anchors}−2,${fillers})/C(${anchors},${fillers}) = ${chooseBig(anchors - 2, fillers)}/${chooseBig(anchors, fillers)} = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    id: `gen-gapmethod-${anchors}-${fillers}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "medium",
    concept: "Gap method (anchor keeps both neighbours)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SHARED_SOURCE,
  };
}

/* ========================================================================== */
/* =================  5 — INDEPENDENT CHOICES (numeric int)  ============== */
/* ========================================================================== */

const CHOICE_THEMES = [
  { item: "garden plots", one: "plot", state: "crop" },
  { item: "toggle switches", one: "switch", state: "position" },
  { item: "locker doors", one: "locker", state: "colour" },
];

/**
 * Number of ways to give each of `n` elements one independent state out of
 * `options` = options^n (multiplication principle). Traps: swapping base and
 * exponent (n^options), the naive single product options·n, and an off-by-one
 * options^n − 1.
 */
export function genIndependentChoices(rng: Rng): NumericQuestion {
  const th = rng.pick(CHOICE_THEMES);
  const options = rng.pick([2, 3, 4]);
  // avoid n === options and the (2,4)/(4,2) coincidence where n^options == options^n,
  // and the source tuple (3 states, 5 items → 3^5 = 243, Starred Watchlist).
  const nChoices = [4, 5, 6, 7].filter(
    (x) =>
      x !== options &&
      Math.pow(x, options) !== Math.pow(options, x) &&
      !(options === 3 && x === 5),
  );
  const n = rng.pick(nChoices);

  const value = independentChoicesCount(options, n);
  const answer = Number(value);

  const swapped = Number(powBig(n, options));
  const naive = options * n;
  const offByOne = Number(powBig(options, n) - 1n);

  const { errors, push } = numericErrors(answer, 0);
  push(
    swapped,
    `${n}^${options} = ${swapped} swaps the base and exponent; there are ${n} independent ${th.one}s each with ${options} states, so it's ${options}^${n}.`,
  );
  push(
    naive,
    `${options}·${n} = ${naive} just multiplies the two counts once; independent choices MULTIPLY across all ${n} ${th.one}s, giving ${options}^${n}.`,
  );
  push(
    offByOne,
    `${options}^${n} − 1 = ${offByOne} subtracts one (perhaps excluding an "all-same" configuration), but every assignment is a valid configuration.`,
  );

  const prompt =
    `Each of ${n} ${th.item} is independently assigned one of ${options} ${th.state}s. ` +
    `How many distinct overall configurations are possible? (Whole number.)`;
  const explanation =
    `By the multiplication principle, each of the ${n} ${th.one}s independently has ${options} possible ${th.state}s, so the total is ${options}^${n} = ${answer} configurations.`;

  return {
    id: `gen-indchoices-${options}-${n}`,
    prompt,
    answer,
    difficulty: "medium",
    concept: "Multiplication principle (independent states)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SHARED_SOURCE,
  };
}

/* ========================================================================== */
/* =================  6 — UNION OF FIXED BIT BLOCKS (numeric int)  ========= */
/* ========================================================================== */

const BIT_THEMES = [
  { unit: "on/off cells", strip: "a status strip" },
  { unit: "0/1 flags", strip: "a register row" },
  { unit: "binary pixels", strip: "an LED bar" },
];

/**
 * Count of length-`L` bit strings that START with a fixed `p`-bit block OR END
 * with a fixed `s`-bit block (inclusion–exclusion): 2^(L−p) + 2^(L−s) − 2^(L−p−s).
 * Traps: forgetting the subtraction (double-counts the both-ends strings), only
 * one condition 2^(L−p), and reporting just the intersection 2^(L−p−s).
 */
export function genUnionFixedBits(rng: Rng): NumericQuestion {
  const th = rng.pick(BIT_THEMES);
  let L = rng.int(8, 12);
  const p = rng.pick([2, 3]);
  const s = rng.pick([2, 3]);
  // Avoid the source tuple (10 bits, 2-prefix OR 2-suffix → 448, Binary Bookends).
  if (L === 10 && p === 2 && s === 2) L = rng.pick([9, 11, 12]);

  const value = unionFixedBitsCount(L, p, s);
  const answer = Number(value);

  const prefixCount = powBig(2, L - p);
  const suffixCount = powBig(2, L - s);
  const bothCount = powBig(2, L - p - s);
  const noIE = Number(prefixCount + suffixCount);
  const onlyOne = Number(prefixCount);
  const intersectionOnly = Number(bothCount);

  const { errors, push } = numericErrors(answer, 0);
  push(
    noIE,
    `Adding without inclusion–exclusion, 2^(${L}−${p}) + 2^(${L}−${s}) = ${prefixCount} + ${suffixCount} = ${noIE}, double-counts the strips matching BOTH ends.`,
  );
  push(
    onlyOne,
    `2^(${L}−${p}) = ${onlyOne} counts only the fixed-prefix strips, ignoring the OR with the suffix condition.`,
  );
  push(
    intersectionOnly,
    `2^(${L}−${p}−${s}) = ${intersectionOnly} is only the strips matching BOTH blocks — that's the intersection, not the union.`,
  );

  const prompt =
    `${cap(th.strip)} of ${L} ${th.unit} is set to a 0/1 pattern. ` +
    `How many of the 2^${L} possible patterns either START with a fixed ${p}-cell block OR END with a fixed ${s}-cell block (or both)? (Whole number.)`;
  const explanation =
    `By inclusion–exclusion: (start-fixed) + (end-fixed) − (both fixed) = 2^(${L}−${p}) + 2^(${L}−${s}) − 2^(${L}−${p}−${s}) = ${prefixCount} + ${suffixCount} − ${bothCount} = ${answer}.`;

  return {
    id: `gen-unionbits-${L}-${p}-${s}`,
    prompt,
    answer,
    difficulty: "medium",
    concept: "Inclusion–exclusion on fixed bit blocks",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SHARED_SOURCE,
  };
}

/* ========================================================================== */
/* =================  7 — BALANCE SCALE: MAX-WEIGHT PAN (numeric)  ========= */
/* ========================================================================== */

const SCALE_THEMES = [
  { device: "a two-pan apothecary balance", weight: "brass weights" },
  { device: "a jeweller's beam balance", weight: "gram weights" },
  { device: "a market grain balance", weight: "iron weights" },
];

/**
 * P(the pan holding the heaviest of six distinct `weights` (three per pan) is the
 * heavier pan). Fix the max on one pan with two of the other five; that pan is
 * heavier iff its total exceeds half the grand total — an exact pair count over
 * C(5,2)=10. Traps: 1/2 (naive symmetry), the complement (the light-pan case),
 * and assuming the max-weight pan ALWAYS wins (probability 1).
 */
export function genBalanceScale(rng: Rng): NumericQuestion {
  let weights: number[] = [];
  let value = F(0);
  let fav = 0;
  for (let tries = 0; tries < 300; tries++) {
    const base = rng.int(2, 30);
    const offsets = rng
      .shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      .slice(0, 6)
      .sort((x, y) => x - y);
    const w = offsets.map((o) => base + o);
    const v = heavierPanProb(w);
    const f = Math.round(v.valueOf() * 10);
    if (f >= 6 && f <= 9) {
      weights = w;
      value = v;
      fav = f;
      break;
    }
  }
  if (weights.length === 0) {
    // deterministic fallback: six consecutive integers give fav = 8/10
    weights = [3, 4, 5, 6, 7, 8];
    value = heavierPanProb(weights);
    fav = Math.round(value.valueOf() * 10);
  }

  const th = rng.pick(SCALE_THEMES);
  const dp = numDp(value);
  const answer = Number(decText(value, dp));

  const max = Math.max(...weights);
  const grand = weights.reduce((x, y) => x + y, 0);

  const half = F(1, 2);
  const complement = F(1).sub(value);
  const alwaysWins = F(1);

  const { errors, push } = numericErrors(answer, dp);
  push(
    half,
    `1/2 = ${fracText(half)} is naive left/right symmetry; the pan that happens to hold the single heaviest weight is NOT equally likely to be lighter.`,
  );
  push(
    complement,
    `${fracText(complement)} is the probability the max-weight pan is the LIGHTER one — the complement of the event asked.`,
  );
  push(
    alwaysWins,
    `Assuming the pan with the heaviest weight ALWAYS wins gives 1; that ignores the borderline pairings where its two light companions let the other pan win (only ${fav} of the 10 pairings favour it).`,
  );

  const prompt =
    `Six distinct ${th.weight} are split at random into two groups of three, one group per pan of ${th.device}. ` +
    `What is the probability that the pan holding the SINGLE heaviest weight ends up as the heavier pan? (Round to ${dp} decimals.)`;
  const explanation =
    `Put the heaviest weight (${max}) on a pan; its two companions are a random pair from the other five, so there are C(5,2) = 10 equally-likely pairings. ` +
    `That pan is heavier exactly when twice its total exceeds the grand total ${grand}; this holds for ${fav} of the 10 pairings. ` +
    `So P = ${fav}/10 = ${fracText(value)} ≈ ${decText(value, dp)}.`;

  return {
    id: `gen-balscale-${weights.join("_")}`,
    prompt,
    answer,
    decimals: dp,
    difficulty: "medium",
    concept: "Balance-scale symmetry (max-weight pan heavier)",
    explanation,
    unit: "",
    commonErrors: errors,
    source: SHARED_SOURCE,
  };
}

/* ========================================================================== */
/*  Local helpers                                                              */
/* ========================================================================== */

/** Capitalise the first letter (for theme phrases at sentence start). */
function cap(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
