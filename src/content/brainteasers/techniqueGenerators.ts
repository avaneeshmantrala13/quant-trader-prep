import type { Rng } from "@/lib/rng";
import type { Flashcard, FlashcardGenerator } from "@/types/content";
import { fracText } from "./solvers";
import {
  avoidMultiplesThreshold,
  complementaryPairThreshold,
  firstToTargetGame,
  houseOfCards,
  maxAvoidingPerBox,
  maxSubsetNoMultiple,
  minBinaryWeights,
  minDropsTwoBalls,
  minPerBoxThreshold,
  modularHats,
  smallestNumberWithDigitProduct,
  trailingZerosFactorial,
  triangular,
} from "./techniqueSolvers";

/**
 * Parametric, EXACT-verified flashcard generators for the technique families
 * integrated from datasets 3–8. Each `(rng) => Flashcard` draws fresh
 * parameters, computes the answer with an exact solver in
 * `./techniqueSolvers.ts`, and templates a self-contained prompt + a strong
 * explanation (several phrasing variants) around the drawn numbers, so
 * infinitely many fresh, verified instances can be produced per seed with NO
 * LLM / API. None of these reproduces a dataset puzzle verbatim: the parameter
 * spaces are chosen to keep each technique's "aha" intact while avoiding the
 * exact original numbers where they would collide with a shipped static card.
 *
 * All math is rendered in PLAIN UNICODE (·, ≥, ≤, →, ⌊⌋, mod), never LaTeX, to
 * match the existing hand-authored flashcards. The generated `id` encodes the
 * parameters so the verification test can independently re-derive each answer
 * from the id alone.
 */

/* ========================================================================== */
/*  FAMILY. Pigeonhole thresholds (dataset 6)                                 */
/* ========================================================================== */

const PIGEON_BOX_ITEMS = [
  { box: "drawer", item: "sock", plural: "socks" },
  { box: "shelf", item: "book", plural: "books" },
  { box: "bin", item: "ball", plural: "balls" },
  { box: "folder", item: "report", plural: "reports" },
];

export function genPigeonhole(rng: Rng): Flashcard {
  const scenario = rng.pick(["box", "pair", "mult"] as const);

  if (scenario === "box") {
    const boxes = rng.int(6, 20);
    const perBox = rng.int(2, 6);
    const k = minPerBoxThreshold(boxes, perBox);
    const worst = maxAvoidingPerBox(boxes, perBox);
    const { box, plural } = rng.pick(PIGEON_BOX_ITEMS);
    const prompt =
      `Identical ${plural} are dropped one at a time into ${boxes} ${box}s at random. ` +
      `What is the smallest number of ${plural} that GUARANTEES at least one ${box} ends up holding at least ${perBox} of them?`;
    const answer =
      `${k}. In general, guaranteeing ≥ m items in some box among B boxes needs B·(m−1) + 1 = ${boxes}·${perBox - 1} + 1 = ${k}.`;
    const explanation =
      `This is the PIGEONHOLE PRINCIPLE in its "≥ m per box" form. The worst you can do while keeping every ${box} below ${perBox} is to put exactly ${perBox - 1} in each, that is ${boxes}·(${perBox} − 1) = ${worst} ${plural} with NO ${box} yet at ${perBox}. Every one of those placements is still "safe", so ${worst} is not enough. Add just one more: the (${worst} + 1) = ${k}-th ${plural.replace(/s$/, "")} must land in a ${box} that already has ${perBox - 1}, pushing it to ${perBox}. Hence the guaranteed threshold is B·(m−1) + 1 = ${k}. (One fewer, ${worst}, can be arranged to fail, so the bound is tight.)`;
    return {
      id: `bt-pigeon-box-${boxes}-${perBox}`,
      prompt,
      answer,
      explanation,
      difficulty: "medium",
      concept: "Pigeonhole principle (≥ m per box threshold)",
      source: "Brainteasers · Pigeonhole · parametric",
      gradable: true,
      numericAnswer: k,
      tolerance: 0,
    };
  }

  if (scenario === "pair") {
    const half = rng.int(8, 40);
    const N = half * 2;
    const k = complementaryPairThreshold(N);
    const sum = N + 1;
    const prompt =
      `Tickets numbered 1 through ${N} sit in a bag. Two tickets are "partners" when their numbers add to ${sum}. ` +
      `Drawing blindly, what is the fewest tickets you must take to GUARANTEE holding a partner pair (two tickets summing to ${sum})?`;
    const answer =
      `${k}. The ${N} numbers split into ${N / 2} partner pairs {i, ${sum}−i}; taking ${N / 2} could dodge them all, so ${N / 2} + 1 = ${k} forces a pair.`;
    const explanation =
      `Group the numbers by the invariant "sums to ${sum}": {1, ${N}}, {2, ${N - 1}}, …, exactly ${N / 2} disjoint partner pairs, each a pigeonhole. You could unluckily pick one number from every pair (${N / 2} tickets) and still have no matching pair. But once you take ${N / 2} + 1 = ${k}, the PIGEONHOLE PRINCIPLE says two of them must come from the same pair, and that pair sums to ${sum}. So ${k} is the guaranteed threshold (the general answer for 1..N is N/2 + 1).`;
    return {
      id: `bt-pigeon-pair-${N}`,
      prompt,
      answer,
      explanation,
      difficulty: "medium",
      concept: "Pigeonhole principle (complementary-pair threshold)",
      source: "Brainteasers · Pigeonhole · parametric",
      gradable: true,
      numericAnswer: k,
      tolerance: 0,
    };
  }

  // scenario === "mult"
  const d = rng.pick([3, 4, 5, 6, 7]);
  const N = rng.int(20, 60);
  const k = avoidMultiplesThreshold(N, d);
  const nonMultiples = maxSubsetNoMultiple(N, d);
  const multiples = N - nonMultiples;
  const prompt =
    `Cards numbered 1 through ${N} are shuffled face-down. Drawing without looking, ` +
    `what is the fewest cards you must draw to be CERTAIN of holding at least one multiple of ${d}?`;
  const answer =
    `${k}. There are ${multiples} multiples of ${d} in 1..${N} and ${nonMultiples} non-multiples; drawing all ${nonMultiples} non-multiples then one more forces a multiple: ${nonMultiples} + 1 = ${k}.`;
  const explanation =
    `Split 1..${N} into "multiples of ${d}" (there are ⌊${N}/${d}⌋ = ${multiples}) and "non-multiples" (${N} − ${multiples} = ${nonMultiples}). The adversary's best stall is to hand you every non-multiple first, ${nonMultiples} cards with still no multiple of ${d}. By the PIGEONHOLE PRINCIPLE the very next card (the ${nonMultiples} + 1 = ${k}-th) must be a multiple of ${d}, since the non-multiples are exhausted. So the guaranteed threshold is (N − ⌊N/d⌋) + 1 = ${k}.`;
  return {
    id: `bt-pigeon-mult-${N}-${d}`,
    prompt,
    answer,
    explanation,
    difficulty: "medium",
    concept: "Pigeonhole principle (avoid-then-+1 threshold)",
    source: "Brainteasers · Pigeonhole · parametric",
    gradable: true,
    numericAnswer: k,
    tolerance: 0,
  };
}

/* ========================================================================== */
/*  FAMILY. House of Cards (triangular sum, dataset 5)                        */
/* ========================================================================== */

export function genHouseOfCards(rng: Rng): Flashcard {
  const stories = rng.int(4, 60);
  const cards = houseOfCards(stories);
  const tri = triangular(stories);
  const prompt =
    `A house of cards is built with ${stories} stories: the bottom row is ${stories} adjacent card-triangles, ` +
    `the row above it ${stories - 1}, and so on up to a single triangle on top. Each triangle uses 2 leaning cards, ` +
    `and every triangle rests on one horizontal "floor" card shared with the triangle beside it, so each of the ${stories} rows needs one fewer floor card than triangles. How many cards does the whole ${stories}-story house use?`;
  const answer =
    `${cards} cards. With T = ${stories}·${stories + 1}/2 = ${tri} triangles, cards = 3·T − ${stories} = 3·${tri} − ${stories} = ${cards} (the closed form is S(3S+1)/2).`;
  const explanation =
    `Count the little triangles by TRIANGULAR SUMMATION: rows of ${stories}, ${stories - 1}, …, 1 give T = Σ_{i=1..${stories}} i = ${stories}·(${stories}+1)/2 = ${tri}. Each triangle is 3 cards (2 leaning + 1 floor), which double-counts the floor cards shared between neighbors: exactly one shared floor card is removed per row, i.e. ${stories} in total. So cards = 3·${tri} − ${stories} = ${cards}. Equivalently, cards = S(3S+1)/2 with S = ${stories}. The key move is recognizing the count of triangles is the ${stories}-th triangular number, not a raw multiple.`;
  return {
    id: `bt-house-${stories}`,
    prompt,
    answer,
    explanation,
    difficulty: "medium",
    concept: "Triangular summation Σi = n(n+1)/2",
    source: "Brainteasers · Summation · parametric",
    gradable: true,
    numericAnswer: cards,
    tolerance: 0,
  };
}

/* ========================================================================== */
/*  FAMILY. Two Balls / minimum worst-case drops (triangular, dataset 5)      */
/* ========================================================================== */

export function genTwoBalls(rng: Rng): Flashcard {
  const floors = rng.pick([
    16, 25, 28, 36, 45, 50, 55, 64, 78, 85, 120, 150, 200,
  ]);
  const n = minDropsTwoBalls(floors);
  const reached = triangular(n);
  const prevReached = triangular(n - 1);
  const prompt =
    `A building has ${floors} floors. Two identical glass balls will shatter if (and only if) dropped from at or above some unknown "critical" floor. ` +
    `You may reuse a ball until it breaks. Dropping optimally to MINIMIZE the worst-case number of drops, how many drops guarantee you find the critical floor?`;
  const answer =
    `${n} drops. The fewest N with N(N+1)/2 ≥ ${floors}: here ${n}·${n + 1}/2 = ${reached} ≥ ${floors} while ${n - 1}·${n}/2 = ${prevReached} < ${floors}.`;
  const explanation =
    `With only two balls you cannot binary-search: once the first ball breaks you must climb the remaining span one floor at a time with the last ball. The trick is to make every possible outcome cost the same worst case. Start the first ball at floor ${n}; if it survives, jump ${n - 1} floors, then ${n - 2}, and so on, each survived drop spends one drop but shrinks the follow-up linear search by one. The floors covered in N drops is the TRIANGULAR NUMBER N + (N−1) + … + 1 = N(N+1)/2, so you need the smallest N with N(N+1)/2 ≥ ${floors}. Since ${n}(${n}+1)/2 = ${reached} ≥ ${floors} but (${n}−1)${n}/2 = ${prevReached} < ${floors}, the answer is ${n}.`;
  return {
    id: `bt-twoballs-${floors}`,
    prompt,
    answer,
    explanation,
    difficulty: "medium",
    concept: "Minimax via triangular numbers N(N+1)/2 ≥ floors",
    source: "Brainteasers · Summation · parametric",
    gradable: true,
    numericAnswer: n,
    tolerance: 0,
  };
}

/* ========================================================================== */
/*  FAMILY. Trailing zeros of n! (number theory, dataset 7)                   */
/* ========================================================================== */

export function genTrailingZeros(rng: Rng): Flashcard {
  const n = rng.pick([25, 30, 40, 50, 60, 75, 90, 120, 125, 150, 200, 250]);
  const zeros = trailingZerosFactorial(n);
  const floorExprs: string[] = [];
  const values: number[] = [];
  let pow = 5;
  while (pow <= n) {
    floorExprs.push(`⌊${n}/${pow}⌋`);
    values.push(Math.floor(n / pow));
    pow *= 5;
  }
  const sumLine = `${floorExprs.join(" + ")} = ${values.join(" + ")} = ${zeros}`;
  const prompt =
    `How many consecutive zeros does the number ${n}! (${n} factorial, i.e. ${n} × ${n - 1} × … × 2 × 1) end in?`;
  const answer = `${zeros}. Count factors of 5: ${sumLine}.`;
  const explanation =
    `A trailing zero is one factor of 10 = 2 × 5. In ${n}! factors of 2 are far more plentiful than factors of 5, so the number of trailing zeros equals the number of factors of 5. Count them with the LEGENDRE / de Polignac sum Σ_{i≥1} ⌊${n}/5^i⌋ = ${sumLine} (the first term counts multiples of 5, the next counts extra 5s from multiples of 25, and so on). So ${n}! ends in ${zeros} zero${zeros === 1 ? "" : "s"}.`;
  return {
    id: `bt-tzeros-${n}`,
    prompt,
    answer,
    explanation,
    difficulty: "medium",
    concept: "Trailing zeros of n! = Σ⌊n/5^i⌋",
    source: "Brainteasers · Number theory · parametric",
    gradable: true,
    numericAnswer: zeros,
    tolerance: 0,
  };
}

/* ========================================================================== */
/*  FAMILY. Smallest number with a given digit product (dataset 7)            */
/* ========================================================================== */

/** Products (≥ 2) reachable by single digits, giving clean 2–6 digit answers. */
const DIGIT_PRODUCTS = [
  12, 15, 18, 24, 32, 36, 45, 48, 64, 72, 90, 96, 100, 128, 144, 162, 192, 216,
  252, 336, 432, 500, 640,
];

export function genDigitProduct(rng: Rng): Flashcard {
  const product = rng.pick(DIGIT_PRODUCTS);
  const num = smallestNumberWithDigitProduct(product);
  // Every entry in DIGIT_PRODUCTS is reachable, so `num` is a string.
  const digits = (num as string).split("");
  const prompt =
    `What is the SMALLEST positive whole number whose digits multiply together to give exactly ${product}? ` +
    `(For example, 26 works for 12 because 2 × 6 = 12, but it may not be the smallest.)`;
  const answer =
    `${num}. Its digits ${digits.join(" × ")} = ${product}, and no smaller number has digit product ${product}.`;
  const explanation =
    `Two ideas make this exact. First, to make the number SHORT (fewer digits ⇒ smaller number), greedily peel off the LARGEST single-digit factors from 9 down to 2: repeatedly divide ${product} by 9, then 8, …, then 2. That yields the digit multiset {${digits.join(
      ", ",
    )}}. Second, given a fixed multiset of digits, the SMALLEST number arranges them in ASCENDING order, so read them small-to-large: ${num}. (If a product has a prime factor above 7, like 11 or 13, no single-digit decomposition exists and there is no such number.) Check: ${digits.join(
      " × ",
    )} = ${product}.`;
  return {
    id: `bt-digitprod-${product}`,
    prompt,
    answer,
    explanation,
    difficulty: "medium",
    concept: "Smallest number with a given digit product (greedy 9→2)",
    source: "Brainteasers · Number theory · parametric",
    gradable: true,
    numericAnswer: Number(num),
    tolerance: 0,
  };
}

/* ========================================================================== */
/*  FAMILY. Binary weights to cover 1..N (number theory, dataset 7)           */
/* ========================================================================== */

export function genBinaryWeights(rng: Rng): Flashcard {
  const N = rng.int(20, 500);
  const b = minBinaryWeights(N);
  const weights: number[] = [];
  for (let i = 0; i < b; i++) weights.push(2 ** i);
  const reach = 2 ** b - 1;
  const prompt =
    `You have a pan balance and want to weigh out every whole-gram mass from 1 up to ${N} grams, ` +
    `placing weights on ONE pan only (the goods on the other). Using as few distinct weights as possible, ` +
    `what is the minimum number of weights needed, and what should they be?`;
  const answer =
    `${b} weights: ${weights.join(", ")} grams. These powers of two combine (binary) to make every mass 1..${reach}, which covers 1..${N}.`;
  const explanation =
    `Weights on a single pan can only be added, so a set of weights measures exactly the sums of its subsets. To cover the most masses with the fewest weights, use POWERS OF TWO: {1, 2, 4, …, 2^(b−1)}. Their subset-sums are precisely the binary numbers 0..(2^b − 1), i.e. every integer 1..${reach} with no gaps. You need 2^b − 1 ≥ ${N}, so the minimum count is the number of binary digits of ${N}: ⌊log₂ ${N}⌋ + 1 = ${b}. Fewer than ${b} weights reach only 1..${2 ** (b - 1) - 1} < ${N}. Hence ${b} weights (${weights.join(
      ", ",
    )}) are necessary and sufficient.`;
  return {
    id: `bt-binweights-${N}`,
    prompt,
    answer,
    explanation,
    difficulty: "medium",
    concept: "Binary weights: min = ⌊log₂N⌋ + 1",
    source: "Brainteasers · Number theory · parametric",
    // The minimum COUNT of weights is objectively gradable (the specific weight
    // set is shown in the reveal but is not what the learner types).
    gradable: true,
    numericAnswer: b,
    tolerance: 0,
  };
}

/* ========================================================================== */
/*  FAMILY. Modular checksum prisoners' hats (dataset 3)                       */
/* ========================================================================== */

const HAT_COLOR_NAMES: Record<number, string> = {
  2: "two colors (black or white)",
  3: "three colors",
  4: "four colors",
  5: "five colors",
  6: "six colors",
  10: "ten colors",
};

export function genModularHats(rng: Rng): Flashcard {
  const n = rng.pick([10, 12, 20, 25, 50, 100]);
  const colors = rng.pick([2, 3, 4, 5, 10]);
  const { savedForCertain, backSurvival } = modularHats(n, colors);
  const colorPhrase = HAT_COLOR_NAMES[colors] ?? `${colors} colors`;
  const prob = fracText(backSurvival);
  const prompt =
    `${n} prisoners stand in a single line, each wearing a hat that is one of ${colorPhrase}. ` +
    `Each prisoner sees every hat AHEAD of them but not their own or those behind. Starting from the back, each in turn ` +
    `must call out a single color guess (everyone hears it); a prisoner survives only if the guess matches their own hat. ` +
    `They may agree on a strategy beforehand but cannot otherwise communicate. What is the best strategy, how many survivals can they GUARANTEE, and what are the rearmost prisoner's odds?`;
  const answer =
    `Guarantee ${savedForCertain} survivors (everyone except possibly the rearmost). The back prisoner announces the checksum (sum of the ${n - 1} hats he sees) mod ${colors} as a color; each prisoner ahead then deduces their own hat with certainty. The rearmost prisoner survives with probability ${prob} = 1/${colors}.`;
  const explanation =
    `Encode the ${colors} colors as the numbers 0..${colors - 1}. The rearmost prisoner computes the MODULAR CHECKSUM S = (sum of all ${n - 1} hats he can see) mod ${colors} and calls out the color coded by S, spending his own guess to broadcast one shared parity-style symbol. Now consider any prisoner ahead: they can SEE every hat in front of them and have HEARD every guess behind them (each of which, after the first, is that prisoner's true hat). Subtracting the visible sum and the already-announced true hats from the broadcast S (all mod ${colors}) leaves exactly their own color. So all ${savedForCertain} prisoners ahead are saved for certain. The rearmost prisoner's own hat is independent of the checksum he sent, so he is right with probability 1/${colors} = ${prob}. The single idea, one shared checksum digit carries enough information for everyone ahead, generalizes the classic 2-color parity trick to ${colors} colors.`;
  return {
    id: `bt-modhats-${n}-${colors}`,
    prompt,
    answer,
    explanation,
    difficulty: "hard",
    concept: "Modular checksum broadcast (n−1 saved, back 1/k)",
    source: "Brainteasers · Modular · parametric",
    // Answer is a protocol + two numbers (guaranteed survivors and a probability).
    gradable: false,
  };
}

/* ========================================================================== */
/*  FAMILY. Subtraction / count-to-target game (dataset 7, LG17)              */
/* ========================================================================== */

export function genSubtractionGame(rng: Rng): Flashcard {
  const maxStep = rng.int(2, 6);
  const period = maxStep + 1;
  // Choose a target that is NOT a multiple of `period` most of the time (first
  // player wins) but sometimes a multiple (second player wins), both are
  // instructive; the answer always states who wins and why.
  const target = rng.int(20, 60);
  const { firstPlayerWins, firstMove } = firstToTargetGame(target, maxStep);
  const r = target % period;

  const prompt =
    `Two players alternate turns. A running total starts at 0; on your turn you add any whole number from 1 to ${maxStep} to it. ` +
    `Whoever makes the total reach exactly ${target} wins. If you move FIRST and play perfectly, do you win, and what is your strategy?`;
  const answer = firstPlayerWins
    ? `Yes, the first player wins. Open by making the total ${firstMove} (add ${firstMove}), then on every turn bring the total back to the next multiple of ${period} away from ${target}: keep it ≡ ${r} (mod ${period}), i.e. ${listResidueTargets(target, period)}.`
    : `No, with perfect play the SECOND player wins, because ${target} is a multiple of ${period} = ${maxStep} + 1. Whatever you add (1..${maxStep}), the second player adds the complement to ${period} and restores a multiple of ${period}, eventually landing on ${target}.`;
  const explanation =
    `This is a SUBTRACTION GAME solved by working backward mod (maxStep + 1) = ${period}. The player who reaches ${target} wins, so the "safe" totals to hand your opponent are those from which they cannot avoid giving you a reachable win, precisely the totals ≡ ${target} (mod ${period}), because from such a total any legal add of 1..${maxStep} lets you complete back to the next safe total (partner-adds to ${period}). ${
      firstPlayerWins
        ? `Since ${target} mod ${period} = ${r} ≠ 0, the first player seizes control immediately by moving to ${firstMove} and thereafter mirroring: whatever the opponent adds (call it s), reply with ${period} − s. This keeps the total on the safe ladder ${listResidueTargets(
            target,
            period,
          )} and forces the first player to say ${target}.`
        : `Since ${target} mod ${period} = 0, the total 0 is ITSELF a safe position, so the player to move (you, first) is the one out of control; the second player simply answers each of your adds s with ${period} − s and wins.`
    } The whole game collapses to a single modular invariant.`;
  return {
    id: `bt-countgame-${target}-${maxStep}`,
    prompt,
    answer,
    explanation,
    difficulty: "hard",
    concept: "Subtraction game / mod-(s+1) invariant",
    source: "Brainteasers · Games · parametric",
    // Answer is a yes/no + a strategy, not a single number.
    gradable: false,
  };
}

/** List the safe "ladder" totals ≡ target (mod period), ascending, e.g. "3, 8, 13, …, 48". */
function listResidueTargets(target: number, period: number): string {
  const r = target % period;
  const rungs: number[] = [];
  for (let t = r === 0 ? period : r; t <= target; t += period) rungs.push(t);
  if (rungs.length <= 6) return rungs.join(", ");
  return `${rungs.slice(0, 3).join(", ")}, …, ${rungs[rungs.length - 1]}`;
}

/* ========================================================================== */
/*  Named families (attached to levels + exercised by the tests)              */
/* ========================================================================== */

export const pigeonholeFamily: FlashcardGenerator = genPigeonhole;
export const houseOfCardsFamily: FlashcardGenerator = genHouseOfCards;
export const twoBallsFamily: FlashcardGenerator = genTwoBalls;
export const trailingZerosFamily: FlashcardGenerator = genTrailingZeros;
export const digitProductFamily: FlashcardGenerator = genDigitProduct;
export const binaryWeightsFamily: FlashcardGenerator = genBinaryWeights;
export const modularHatsFamily: FlashcardGenerator = genModularHats;
export const subtractionGameFamily: FlashcardGenerator = genSubtractionGame;

/** All technique families, for tests and any "mixed" wiring. */
export const ALL_TECHNIQUE_FAMILIES: [string, FlashcardGenerator][] = [
  ["genPigeonhole", genPigeonhole],
  ["genHouseOfCards", genHouseOfCards],
  ["genTwoBalls", genTwoBalls],
  ["genTrailingZeros", genTrailingZeros],
  ["genDigitProduct", genDigitProduct],
  ["genBinaryWeights", genBinaryWeights],
  ["genModularHats", genModularHats],
  ["genSubtractionGame", genSubtractionGame],
];
