import type { Rng } from "@/lib/rng";
import type { Flashcard, FlashcardGenerator } from "@/types/content";
import { decText, fracText } from "./solvers";
import {
  lastAmongKProb,
  lastAmongKTraps,
  minWeighingsBinaryTrap,
  minWeighingsFakeUnknown,
  minWeighingsKnownHeavier,
  queryTheMaxMinQueries,
  queryTheMaxTraps,
  secretaryOptimalReject,
  secretaryRejectApprox,
  symmetryPayoutEV,
} from "./infoTrapSolvers";

/**
 * Parametric, EXACT-verified flashcard generators for the NEW
 * "Information-theoretic & adversarial-trap" brainteaser family. Each
 * `(rng) => Flashcard` draws fresh parameters, computes the answer with an exact
 * solver in `./infoTrapSolvers.ts`, and templates a self-contained prompt + a
 * strong explanation (several phrasing variants) around the drawn numbers, so
 * infinitely many fresh, verified instances can be produced per seed with NO
 * LLM / API. The `id` encodes the parameters so the verification test can
 * independently re-derive each answer from the id alone.
 *
 * All math is rendered in PLAIN UNICODE (⌈⌉, ≥, ≤, →, ·, ≈, log₂, log₃), never
 * LaTeX, to match the existing hand-authored flashcards. These are TRAP puzzles,
 * so every explanation NAMES the tempting wrong answers and WHY they fail — the
 * same wrong-answer enumeration the mock archetype turns into hint-ladder rungs.
 */

/* ========================================================================== */
/*  1. Query-the-max / "must reveal all"  (answer = n)                         */
/* ========================================================================== */

const QUERYMAX_FRAMINGS = [
  (n: number) =>
    `A dealer lays out ${n} face-down cards, all of DISTINCT rank. You may turn them over one at a time; each time you flip a card you are told only its rank RELATIVE to the cards you have already seen (e.g. "3rd-highest so far"). What is the minimum number of flips that GUARANTEES you can point to the single highest card?`,
  (n: number) =>
    `${n} sealed envelopes each hold a different amount of money. You open them one at a time and, on each open, learn only how the new amount RANKS among the ones opened so far. To be CERTAIN which envelope holds the largest amount, what is the fewest envelopes you must open in the worst case?`,
  (n: number) =>
    `There are ${n} face-down tiles with distinct hidden numbers. A "query" reveals a tile's position in the sorted order of everything queried so far (and nothing about the un-queried tiles). How many queries do you need to be GUARANTEED to identify the single largest tile?`,
];

export function genQueryTheMax(rng: Rng): Flashcard {
  const n = rng.int(5, 14);
  const answer = queryTheMaxMinQueries(n); // = n
  const { skipLast, binarySearch, ternarySearch } = queryTheMaxTraps(n);

  const prompt = rng.pick(QUERYMAX_FRAMINGS)(n);
  const answerText =
    `${answer}. You must query EVERY card. There is no shortcut: any card you never look at could be the maximum.`;
  const explanation =
    `The key is INFORMATION. A query tells you a card's rank only among the cards ALREADY seen, so an un-queried card is never constrained at all — its true rank could be anything, including the very top. If you stop after querying only ${n} − 1 = ${skipLast} cards, an adversary is free to make the one card you skipped the global maximum, and you would miss it. So no strategy can guarantee the answer with fewer than ${n} queries.\n\n` +
    `Conversely ${n} queries always suffice: flip all ${n} cards and track the running best. Hence the guaranteed minimum is exactly n = ${answer}.\n\n` +
    `Trap answers to resist: '${skipLast}' ("the last card adds no new comparison" — false, it can be the max); '⌈log₂ ${n}⌉ = ${binarySearch}' (a binary-search / tournament reflex — but you can't binary-search cards you're forbidden to compare directly); and '⌈log₃ ${n}⌉ = ${ternarySearch}' (confusing this with a three-outcome weighing). All three UNDER-count because unqueried cards carry ZERO information.`;

  return {
    id: `bt-querymax-${n}`,
    prompt,
    answer: answerText,
    explanation,
    difficulty: "medium",
    concept: "Information-theoretic guarantee (adversary argument)",
    source: "Brainteasers · Information & Adversarial Traps · parametric",
    gradable: true,
    numericAnswer: answer,
    tolerance: 0,
  };
}

/* ========================================================================== */
/*  2. Secretary / optimal stopping  (answer = optimal reject count ≈ n/e)     */
/* ========================================================================== */

const SECRETARY_FRAMINGS = [
  (n: number) =>
    `You interview ${n} candidates one at a time in random order. After each interview you must hire-or-reject ON THE SPOT (no going back), and you only ever learn how each candidate RANKS against the ones already seen. The optimal strategy is: reject the first r, then hire the next candidate who is better than everyone before them. What reject-count r maximizes your chance of hiring the single BEST candidate?`,
  (n: number) =>
    `${n} offers arrive sequentially in a uniformly-random order; you must accept or decline each immediately and can compare only against earlier offers. Using the "observe-then-take-the-next-record" rule, how many offers r should you observe (and auto-decline) up front to maximize the probability of ending on the very best offer?`,
  (n: number) =>
    `A classic optimal-stopping setup: ${n} items pass by one at a time in random order, decisions are irrevocable, and you want the #1 item. You reject the first r as a calibration sample, then take the first later item that beats them all. What r gives the highest success probability?`,
];

export function genSecretaryStop(rng: Rng): Flashcard {
  const n = rng.pick([10, 12, 20, 25, 30, 40, 50, 52, 60, 75, 100]);
  const { r, prob } = secretaryOptimalReject(n);
  const approx = secretaryRejectApprox(n);
  const halfTrap = Math.floor(n / 2);
  const probPct = (prob * 100).toFixed(1);

  const prompt = rng.pick(SECRETARY_FRAMINGS)(n);
  const answerText =
    `Reject the first ${r}, then take the next record-beating candidate. That is ≈ n/e = ${n}/e ≈ ${approx}, and it wins with probability ≈ ${prob.toFixed(3)} (about ${probPct}%, close to 1/e ≈ 37%).`;
  const explanation =
    `Rejecting the first r and then taking the next "best-so-far" wins with probability P(r) = (r/n)·Σ_{i=r+1}^{n} 1/(i−1). Maximizing this over r ∈ [0, ${n} − 1] gives r* = ${r} for n = ${n}, with win probability ≈ ${prob.toFixed(4)}.\n\n` +
    `As n grows the optimum settles at r* ≈ n/e and the success probability at ≈ 1/e ≈ 0.3679 — the famous "37% rule". Here n/e ≈ ${approx}, matching the exact argmax.\n\n` +
    `Trap answer to resist: '${halfTrap}' (reject the first HALF, n/2). Observing half throws away too many strong early candidates; the calibration sample should be only ~37% of the field, not 50%.`;

  return {
    id: `bt-secretary-${n}`,
    prompt,
    answer: answerText,
    explanation,
    difficulty: "hard",
    concept: "Optimal stopping (secretary ≈ n/e threshold)",
    source: "Brainteasers · Information & Adversarial Traps · parametric",
    gradable: true,
    numericAnswer: r,
    tolerance: 0,
  };
}

/* ========================================================================== */
/*  3a. Weighing: one KNOWN-heavier coin  (answer = ⌈log₃ n⌉)                   */
/* ========================================================================== */

const WEIGH3_FRAMINGS = [
  (n: number) =>
    `You have ${n} identical-looking coins; exactly one is COUNTERFEIT and it is KNOWN to be heavier than the rest. Using only a two-pan balance scale (no weights), what is the minimum number of weighings that GUARANTEES you find the heavy coin?`,
  (n: number) =>
    `Among ${n} coins, one is heavier (you know it's the heavy one — you just don't know which). With a balance scale, how few weighings suffice IN THE WORST CASE to identify it?`,
  (n: number) =>
    `${n} otherwise-identical marbles include a single OVERWEIGHT marble. Given only a balance (which tips left, tips right, or stays level), what is the guaranteed minimum number of weighings to pin down the heavy one?`,
];

export function genWeighKnownHeavier(rng: Rng): Flashcard {
  // Draw n so the answer is a clean, non-trivial ⌈log₃ n⌉ (2..4 weighings) and
  // the binary trap ⌈log₂ n⌉ is STRICTLY larger (so it is visibly wrong). n = 4
  // is excluded because there ⌈log₂ 4⌉ = ⌈log₃ 4⌉ = 2 (the trap would coincide).
  const n = rng.pick([5, 6, 7, 8, 9, 12, 18, 20, 24, 27, 40, 60, 80]);
  const answer = minWeighingsKnownHeavier(n);
  const binaryTrap = minWeighingsBinaryTrap(n);

  const prompt = rng.pick(WEIGH3_FRAMINGS)(n);
  const answerText =
    `${answer} weighings. A balance has THREE outcomes, so each weighing cuts the suspects into three roughly-equal groups: the minimum is ⌈log₃ ${n}⌉ = ${answer}.`;
  const explanation =
    `Count the OUTCOMES, not the objects. A balance scale can tip left, tip right, or balance — THREE outcomes — so k weighings can distinguish at most 3^k cases. To separate ${n} coins you need 3^k ≥ ${n}, i.e. k = ⌈log₃ ${n}⌉ = ${answer}. Each weighing: split the coins into three near-equal piles, weigh two of them; the heavy coin is in the heavier pan, or in the set-aside pile if they balance.\n\n` +
    `Trap answer to resist: '⌈log₂ ${n}⌉ = ${binaryTrap}'. That treats the scale as a yes/no (two-outcome) device and IGNORES the informative "balanced" result, so it over-counts the weighings. The scale's third outcome is exactly what makes log base 3 — not base 2 — the right measure.`;

  return {
    id: `bt-weigh3-${n}`,
    prompt,
    answer: answerText,
    explanation,
    difficulty: "medium",
    concept: "Information counting (balance scale = log base 3)",
    source: "Brainteasers · Information & Adversarial Traps · parametric",
    gradable: true,
    numericAnswer: answer,
    tolerance: 0,
  };
}

/* ========================================================================== */
/*  3b. Weighing: one fake, heavier-or-lighter UNKNOWN, + identify direction   */
/* ========================================================================== */

const WEIGHFAKE_FRAMINGS = [
  (n: number) =>
    `You have ${n} identical-looking coins; exactly one is fake, but you do NOT know whether the fake is heavier or lighter than a genuine coin. Using only a balance scale, what is the minimum number of weighings that GUARANTEES you both find the fake AND determine whether it is heavy or light?`,
  (n: number) =>
    `Among ${n} coins, one is counterfeit — it could be either too heavy or too light. With a balance scale and no reference weights, how few weighings suffice in the worst case to identify the fake and say which way it is off?`,
  (n: number) =>
    `${n} coins, one defective (unknown direction). Determine, with certainty and the fewest balance weighings, WHICH coin is fake and whether it is heavier or lighter.`,
];

export function genWeighFakeUnknown(rng: Rng): Flashcard {
  // Curated n where the closed form (3^k − 3)/2 ≥ n is clean AND the
  // known-heavier count ⌈log₃ n⌉ is a STRICT under-count (so the trap is always
  // genuinely wrong). The famous twelve-coin instance — where the two counts
  // coincide at 3 — ships as the hand-authored static card instead.
  const n = rng.pick([3, 4, 5, 6, 7, 8, 9, 20, 21, 27]);
  const answer = minWeighingsFakeUnknown(n);
  const knownTrap = minWeighingsKnownHeavier(n); // the "if you knew the direction" count

  const prompt = rng.pick(WEIGHFAKE_FRAMINGS)(n);
  const capacity = (3 ** answer - 3) / 2;
  const answerText =
    `${answer} weighings. With the direction unknown, k weighings resolve at most (3^k − 3)/2 coins; the smallest k with (3^k − 3)/2 ≥ ${n} is ${answer} (capacity ${capacity}).`;
  const explanation =
    `A balance still has three outcomes, but now each coin has TWO possible defect states (heavy or light), so there are 2·${n} "coin + direction" possibilities to tell apart — plus you never get a fully free reference. The exact worst-case bound is that k weighings can resolve at most (3^k − 3)/2 coins, so you need the smallest k with (3^k − 3)/2 ≥ ${n}: here k = ${answer} (since (3^${answer} − 3)/2 = ${capacity} ≥ ${n}). This is why the celebrated TWELVE-coin puzzle takes exactly 3 weighings.\n\n` +
    `Trap answer to resist: '⌈log₃ ${n}⌉ = ${knownTrap}' — the count you'd use if you already KNEW the fake was heavier. Not knowing the direction costs extra information, so each weighing effectively separates fewer than three fresh cases; using the known-direction formula under-counts.`;

  return {
    id: `bt-weighfake-${n}`,
    prompt,
    answer: answerText,
    explanation,
    difficulty: "hard",
    concept: "Information counting (unknown-direction coin weighing)",
    source: "Brainteasers · Information & Adversarial Traps · parametric",
    gradable: true,
    numericAnswer: answer,
    tolerance: 0,
  };
}

/* ========================================================================== */
/*  4. Symmetry "last among k"  (answer = probability 1/k; EV = payout/k)      */
/* ========================================================================== */

const LASTK_FRAMINGS = [
  (k: number, P: string, special: string) =>
    `A shuffled deck contains ${k} distinguished cards (say ${k} special cards including the ${special}), dealt out in a uniformly-random order. A game pays ${P} if the ${special} turns out to be the LAST of those ${k} special cards to appear. What is the probability the ${special} is last?`,
  (k: number, P: string, special: string) =>
    `${k} marked tickets — one of them the ${special} — are drawn one at a time in random order. You collect ${P} if the ${special} is the very LAST of the ${k} marked tickets drawn. What is the chance you win?`,
  (k: number, P: string, special: string) =>
    `Among ${k} flagged items in a random permutation (one flagged item is the ${special}), a bettor is paid ${P} when the ${special} lands LAST among the flagged items. What is the probability of that payout?`,
];

const SPECIAL_NAMES = ["Joker", "Ace of Spades", "red seven", "gold token", "marked ace"];

export function genLastAmongK(rng: Rng): Flashcard {
  const k = rng.pick([3, 4, 5, 6, 8, 10, 13, 20, 26, 52]);
  const payout = rng.pick([10, 20, 50, 100, 120, 200, 260, 520]);
  const prob = lastAmongKProb(k); // 1/k
  const ev = symmetryPayoutEV(payout, k); // payout/k
  const traps = lastAmongKTraps(k);
  const special = rng.pick(SPECIAL_NAMES);
  const P = `$${payout}`;

  const prompt = rng.pick(LASTK_FRAMINGS)(k, P, special);
  const answerText =
    `${fracText(prob)}${Number(prob.d) === 1 ? "" : ` ≈ ${decText(prob, 4)}`}. By symmetry every one of the ${k} special cards is equally likely to be last, so the probability is 1/${k}. (The payout's expected value is ${P}·1/${k} = $${decText(ev, 2)}.)`;
  const explanation =
    `Use SYMMETRY, not a permutation product. Look only at the relative order of the ${k} special cards among themselves; every one of the ${k}! orderings of just those cards is equally likely, and by symmetry each specific card is equally likely to occupy each of the ${k} positions. So the ${special} is last with probability exactly 1/${k} = ${decText(prob, 4)}. The EV of the ${P} payout is therefore ${P}·(1/${k}) = $${decText(ev, 2)}.\n\n` +
    `Trap answers to resist: '1/${k}!' (computing the chance of one SPECIFIC full ordering — but you only care about the last slot, not the whole arrangement); '1/2^(${k}−1)' (chaining ${k}−1 independent "loses a coin-flip" comparisons); and '1/2' (the naive "it's last or it isn't"). All ignore that the ${k} cards are exchangeable, which collapses the answer to a clean 1/k. (Here 1/2^(${k}−1) = ${fracText(traps.pairwiseHalves)}.)`;

  return {
    id: `bt-lastk-${k}-${payout}`,
    prompt,
    answer: answerText,
    explanation,
    difficulty: "medium",
    concept: "Symmetry / exchangeability (P(specific is last) = 1/k)",
    source: "Brainteasers · Information & Adversarial Traps · parametric",
    gradable: true,
    numericAnswer: prob.valueOf(),
    tolerance: 0.0005,
  };
}

/* ========================================================================== */
/*  Named families (attached to levels + exercised by the tests)              */
/* ========================================================================== */

export const queryTheMaxFamily: FlashcardGenerator = genQueryTheMax;
export const secretaryStopFamily: FlashcardGenerator = genSecretaryStop;
export const weighKnownHeavierFamily: FlashcardGenerator = genWeighKnownHeavier;
export const weighFakeUnknownFamily: FlashcardGenerator = genWeighFakeUnknown;
export const lastAmongKFamily: FlashcardGenerator = genLastAmongK;

/**
 * All five Information-theoretic & adversarial-trap families, for the diagnostic
 * blueprint, the mock brainteaser pool, and the tests (mirrors
 * `ALL_BRAINTEASER_FAMILIES` / `ALL_TECHNIQUE_FAMILIES`).
 */
export const ALL_INFOTRAP_FAMILIES: [string, FlashcardGenerator][] = [
  ["genQueryTheMax", genQueryTheMax],
  ["genSecretaryStop", genSecretaryStop],
  ["genWeighKnownHeavier", genWeighKnownHeavier],
  ["genWeighFakeUnknown", genWeighFakeUnknown],
  ["genLastAmongK", genLastAmongK],
];
