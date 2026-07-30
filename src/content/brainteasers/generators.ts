import type { Rng } from "@/lib/rng";
import type { Flashcard, FlashcardGenerator } from "@/types/content";
import type FractionType from "fraction.js";
import {
  F,
  adjacentCrossExpected,
  backupDealerExpectedPrice,
  decText,
  fadingBuyer,
  fracText,
  inventoryCap,
  roundTrip,
  walkOfferDown,
} from "./solvers";

/**
 * Parametric, EXACT-verified generators for the six ORIGINAL house brainteasers.
 * Each `(rng) => Flashcard` draws fresh parameters, computes the answer with the
 * exact solver in `./solvers.ts`, and templates the prompt + explanation (with
 * several phrasing variants) around the drawn numbers — so infinitely many fresh
 * instances can be produced deterministically per seed, with NO LLM / API.
 *
 * All math is rendered in PLAIN UNICODE (√, ², ·, ≥, ≤, →, …), never LaTeX, to
 * match the existing hand-authored flashcards (explanations render via
 * `whitespace-pre-line`). The generated `id` encodes the parameters so the
 * verification test can independently re-derive each answer from the id alone.
 *
 * Design note (preserving each "aha"): the parameter spaces are deliberately
 * chosen to keep every puzzle's surprise intact — e.g. the Backup Dealer keeps
 * the 50/50 fill (so the clean midpoint cancellation survives), and Walking the
 * Offer Down keeps ≥ 2 ask rounds (so "a second lower ask beats a single ask"
 * is always true). See the delivery report for the full list of judgment calls.
 */

/* -------------------------------------------------------------------------- */
/*  Formatting helpers (plain Unicode)                                         */
/* -------------------------------------------------------------------------- */

/** "$0.50" when the value has ≤ 2 exact decimals, else "$2/3" (exact fraction). */
function usd(f: FractionType): string {
  const cents = f.mul(100);
  if (Number(cents.d) === 1) return `$${f.valueOf().toFixed(2)}`;
  return `$${fracText(f)}`;
}

/** Exact fraction text — for probabilities (e.g. 1/2, 2/3). */
function probText(f: FractionType): string {
  return fracText(f);
}

/* ========================================================================== */
/*  FAMILY 1 — The Backup Dealer  (easy)                                        */
/* ========================================================================== */

const BACKUP_FRAMINGS = [
  (a: string, b: string) =>
    `Your desk needs one share, so two rival brokers each flash a firm price at the same instant; every price is an independent draw uniform on the band ${a}–${b}. You route the order to whichever broker is cheaper, but that routing link is flaky — it works only half the time, and on the other half your order rests with the pricier broker instead. Averaged over everything, what do you end up paying for the share?`,
  (a: string, b: string) =>
    `Two market-makers each stream you an independent quote drawn uniformly from ${a} to ${b}. You always try to lift the lower of the two, but your line to the best price fails half the time — with probability 1/2 you get filled at the cheaper quote, and with probability 1/2 you're bumped to the dearer one. On average, what price do you pay for the one share?`,
  (a: string, b: string) =>
    `You request a price from two independent dealers; each quote is Uniform[${a}, ${b}]. You aim for the minimum of the two, but the better dealer answers only 50% of the time (otherwise you transact at the worse quote). What is your expected fill price?`,
];

export function genBackupDealer(rng: Rng): Flashcard {
  // Integer-dollar interval [a, b], a < b, kept small so the midpoint is clean.
  // a ≥ 1 so the family never emits the source's [0, 1] interval.
  const a = rng.int(1, 4);
  const width = rng.pick([1, 2, 3, 4, 6]);
  const b = a + width;
  const pFill = F(1, 2); // KEEP 50/50 so the midpoint-cancellation aha survives
  const price = backupDealerExpectedPrice(F(a), F(b), pFill); // = (a+b)/2
  const aT = usd(F(a));
  const bT = usd(F(b));

  const prompt = rng.pick(BACKUP_FRAMINGS)(aT, bT);
  const mid = usd(price);
  const answer =
    `${mid} — exactly the midpoint (${aT} + ${bT})/2, the same as if you had ignored both quotes and traded with a single dealer at random.`;
  const explanation =
    `Call the two quotes X and Y, each Uniform[${aT}, ${bT}], so each on its own averages the midpoint ${mid}. Let m = min(X, Y) and M = max(X, Y). With probability 1/2 you pay m and with probability 1/2 you pay M, so your expected cost is ½·E[m] + ½·E[M] = ½·(E[m] + E[M]).\n\n` +
    `Key identity: for ANY two numbers, m + M = X + Y always. Taking expectations, E[m] + E[M] = E[X] + E[Y] = 2·${mid} = ${usd(F(a).add(F(b)))}. So the expected cost is ½·${usd(F(a).add(F(b)))} = ${mid}.\n\n` +
    `The 'aha': the 50/50 backup EXACTLY cancels the advantage of shopping for the minimum — averaging the min and the max with equal weight is the same as averaging the two original quotes. (For reference, E[min] = ${usd(F(a).add(F(b).sub(F(a)).div(F(3))))} and E[max] = ${usd(F(a).add(F(b).sub(F(a)).mul(F(2)).div(F(3))))}, and indeed their average is ${mid}.) In general, if you got the cheaper quote with probability p, your expected cost would be a + (b−a)·(2 − p)/3, which only beats the midpoint when p > 1/2.`;

  return {
    id: `bt-backup-${a}-${b}`,
    prompt,
    answer,
    explanation,
    difficulty: "easy",
    concept: "Expected value / order statistics (min + max identity)",
    source: "Original house brainteaser · parametric",
  };
}

/* ========================================================================== */
/*  FAMILY 2 — The Adjacent Cross  (medium)                                     */
/* ========================================================================== */

const CROSS_FRAMINGS = [
  (n: number, m: number, tot: number) =>
    `You drop ${n} buy tickets and ${m} sell tickets — ${tot} altogether — into a hopper, shuffle uniformly, and deal them out into one line. Wherever a buy ends up sitting directly ahead of a sell, mark it as a 'cross'. How many crosses should you expect the line to contain on average?`,
  (n: number, m: number, tot: number) =>
    `${n} buy tickets and ${m} sell tickets (${tot} total) are shuffled into a uniformly random line. A 'cross' is any adjacent pair that reads buy-then-sell. What is the expected number of such crosses across the row?`,
  (n: number, m: number, tot: number) =>
    `On the tape, ${tot} orders — ${n} buys and ${m} sells — appear in a uniformly random sequence. Count each spot where a buy is immediately followed by a sell. What is the expected count of these buy→sell adjacencies?`,
];

export function genAdjacentCross(rng: Rng): Flashcard {
  const n = rng.int(3, 10);
  const m = rng.int(3, 10);
  const tot = n + m;
  const slots = tot - 1;
  const perSlot = F(n, tot).mul(F(m, tot - 1)); // (n/tot)·(m/(tot-1))
  const expected = adjacentCrossExpected(n, m); // n·m/(n+m)

  const prompt = rng.pick(CROSS_FRAMINGS)(n, m, tot);
  const answer = `Exactly ${fracText(expected)}${
    Number(expected.d) === 1 ? "" : ` (≈ ${decText(expected, 3)})`
  }. In general, for n buys and m sells the expected count is n·m/(n+m).`;
  const explanation =
    `Use LINEARITY OF EXPECTATION: the expected value of a sum equals the sum of the expected values, even when the terms are dependent. There are ${tot} − 1 = ${slots} adjacent slots. For slot i let I_i = 1 if that pair is buy-then-sell. The number of crosses is I_1 + … + I_${slots}, so its expectation is Σ P(slot i is B then S).\n\n` +
    `For one fixed slot, P(left is a buy) = ${n}/${tot}, and given that, P(right is a sell) = ${m}/${tot - 1} (${m} sells among the ${tot - 1} remaining cards). So each slot is a cross with probability (${n}/${tot})·(${m}/${tot - 1}) = ${fracText(perSlot)}. Multiplying by the ${slots} slots: ${slots}·${fracText(perSlot)} = ${fracText(expected)}.\n\n` +
    `The 'aha': neighboring slots overlap (they share a card) and are therefore dependent, but linearity lets you ignore that entirely and just add per-slot probabilities. The (${tot} − 1) cancels, leaving the clean n·m/(n+m).`;

  return {
    id: `bt-cross-${n}-${m}`,
    prompt,
    answer,
    explanation,
    difficulty: "medium",
    concept: "Linearity of expectation",
    source: "Original house brainteaser · parametric",
  };
}

/* ========================================================================== */
/*  FAMILY 3 — Walking the Offer Down  (medium)                                 */
/* ========================================================================== */

const WALK_FRAMINGS = [
  (M: string, k: number) =>
    `A lone buyer secretly values your one unit at V, an unobserved draw uniform on [0, ${M}]. You may post a descending ladder of at most ${k} firm asks — after each refusal you may drop to a strictly lower ask. The buyer is myopic and grabs the first ask that does not exceed V. Tuning the whole ${k}-ask ladder up front, (a) which prices do you post, and (b) what maximum expected revenue results — and how does that stack up against a single posted price?`,
  (M: string, k: number) =>
    `A buyer's value V is Uniform[0, ${M}]. You get to "walk the offer down": quote a price, and if it's rejected you may lower it — up to ${k} asks in total, each strictly below the last. The buyer takes any ask ≤ V. Optimizing the whole schedule, what asks do you post and what expected revenue do they earn, versus the best single ask?`,
  (M: string, k: number) =>
    `Selling one unit to a myopic buyer with value V ~ Uniform[0, ${M}], you may post ${k} declining take-it-or-leave-it asks (each lower than the previous, made only after the prior is refused). What is the optimal ${k}-price schedule and its expected revenue, and how does it compare to a single posted price?`,
];

export function genWalkOfferDown(rng: Rng): Flashcard {
  const rounds = rng.pick([2, 2, 3, 4]); // ≥ 2 so "second ask beats single" holds
  const M = rng.pick([6, 12, 20, 60, 100]); // no M = 1 → never the source [0, 1] scale
  const { prices, revenue, singleAskRevenue } = walkOfferDown(F(M), rounds);
  const MT = usd(F(M));
  const priceList = prices.map((p) => usd(p)).join(", then ");
  const pct = revenue
    .sub(singleAskRevenue)
    .div(singleAskRevenue)
    .mul(100)
    .valueOf();

  const prompt = rng.pick(WALK_FRAMINGS)(MT, rounds);
  const answer =
    `Quote ${priceList}. Maximum expected revenue = ${usd(revenue)}. A single-ask seller's best is ${usd(F(M).div(F(2)))} for expected revenue ${usd(singleAskRevenue)} — the extra asks lift revenue from ${usd(singleAskRevenue)} to ${usd(revenue)} (a ${pct.toFixed(0)}% improvement).`;
  const explanation =
    `With a SINGLE ask p, the buyer accepts w.p. P(V ≥ p) = (${MT} − p)/${MT}, so expected revenue is p·(${MT} − p)/${MT}, peaking at p = ${MT}/2 = ${usd(F(M).div(F(2)))} for ${usd(singleAskRevenue)}.\n\n` +
    `With a declining schedule p₁ > p₂ > … the buyer accepts the i-th ask iff p_i ≤ V < p_{i−1} (they refused every higher earlier ask), contributing p_i·(p_{i−1} − p_i), with p₀ = ${MT}. Revenue R = Σ p_i·(p_{i−1} − p_i). The first-order conditions p_{i−1} + p_{i+1} = 2·p_i force an ARITHMETIC schedule with equal gaps of ${MT}/(${rounds}+1): the optimal asks are ${priceList}.\n\n` +
    `Summing, R* = ${MT}·${rounds}/(2·(${rounds}+1)) = ${usd(revenue)}. The 'aha': a second, lower quote lets you price-discriminate over time — skim the high-value buyers first, then recover a sale from the medium-value buyers — which strictly beats any single price. Note the fallbacks are NOT the single-ask optimum ${MT}/2; the whole schedule shifts because each ask has already creamed off the top of the distribution.`;

  return {
    id: `bt-walk-${M}-${rounds}`,
    prompt,
    answer,
    explanation,
    difficulty: "medium",
    concept: "Sequential pricing / price discrimination",
    source: "Original house brainteaser · parametric",
  };
}

/* ========================================================================== */
/*  FAMILY 4 — The Fading Buyer  (hard)                                         */
/* ========================================================================== */

const FADING_FRAMINGS = [
  (M: string, q: string) =>
    `You must offload one block of stock. Bids land one at a time, each an independent draw uniform on [0, ${M}], and on each one you either take it on the spot or wave it off for good. The danger: after every wave-off, with probability ${q} the block is snapped up elsewhere and you walk away with 0 — otherwise a fresh bid appears. Under optimal play, (a) what acceptance rule should you use, and (b) what expected payoff does it earn?`,
  (M: string, q: string) =>
    `Offers for your one block arrive sequentially, each Uniform[0, ${M}]; you accept or reject on the spot with no recall. But every rejection carries a probability ${q} that the opportunity vanishes entirely (payoff 0). What threshold should you accept above, and what is your expected sale price under optimal play?`,
  (M: string, q: string) =>
    `A block of stock draws i.i.d. Uniform[0, ${M}] bids one at a time. Reject a bid and there is a ${q} chance the deal dies (you get 0); otherwise the next bid arrives. Determine the optimal accept-or-reject rule and the resulting expected payoff.`,
];

export function genFadingBuyer(rng: Rng): Flashcard {
  const M = rng.pick([10, 50, 100]); // no M = 1 → never the source [0, 1] scale
  const q = rng.pick([F(1, 2), F(1, 3), F(2, 3), F(1, 4), F(3, 5)]);
  const qNum = Number(q.n);
  const qDen = Number(q.d);
  const { threshold, ev } = fadingBuyer(M, q.valueOf());
  const c = 1 - q.valueOf();

  const prompt = rng.pick(FADING_FRAMINGS)(usd(F(M)), probText(q));
  const answer =
    `Accept the first offer that is at least the threshold t* ≈ ${threshold.toFixed(4)}; reject anything below it. Expected payoff W ≈ ${ev.toFixed(4)}. (Closed form: with c = 1 − ${probText(q)} = ${fracText(F(1).sub(q))}, t* = (${M}/c)·(1 − √(1 − c²)) and W = t*/c.)`;
  const explanation =
    `Every future decision faces the same situation (i.i.d. offers, memoryless collapse), so the optimal policy is a single fixed THRESHOLD t: accept iff the offer ≥ t. Let W be the expected payoff at the start. When you reject, with probability ${probText(q)} you get 0 and with probability ${fracText(F(1).sub(q))} you face the same problem worth W, so rejecting is worth ${fracText(F(1).sub(q))}·W. You accept an offer x exactly when x ≥ that continuation value, so t = ${fracText(F(1).sub(q))}·W (threshold = continuation value).\n\n` +
    `Compute W self-consistently. Seeing x ~ Uniform[0, ${M}] you get max(x, t): take x if it clears the bar, else fall back to t. So W = E[max(x, t)] = t²/${M} + (${M}² − t²)/(2·${M}). Substituting t = c·W with c = ${c.toFixed(4)} gives the quadratic t² − (2·${M}/c)·t + ${M}² = 0, whose valid root is t* = (${M}/c)·(1 − √(1 − c²)) ≈ ${threshold.toFixed(4)}, and W = t*/c ≈ ${ev.toFixed(4)}.\n\n` +
    `The 'aha': the RISK that the opportunity vanishes forces you to be far LESS picky. If offers never disappeared you could wait indefinitely for a near-${M} offer and no finite threshold would be optimal; the collapse probability is exactly what pins the cutoff down. The whole solution rests on the fixed point t = (continuation value).`;

  return {
    id: `bt-fading-${M}-${qNum}-${qDen}`,
    prompt,
    answer,
    explanation,
    difficulty: "hard",
    concept: "Optimal stopping (threshold = continuation value)",
    source: "Original house brainteaser · parametric",
  };
}

/* ========================================================================== */
/*  FAMILY 5 — The Round-Trip  (hard)                                           */
/* ========================================================================== */

const ROUNDTRIP_FRAMINGS = [
  (M: string, d: number) =>
    `Each of the next ${d} trading days closes at an independent price uniform on [0, ${M}], revealed only at that day's close (no re-trading past closes). You want a single round trip — one buy followed by a strictly later sell — deciding online with no lookahead. Hold past the final day and you're force-sold at that close; still flat after day ${d} and you make no trade. Under optimal play, what maximum expected profit can you lock in?`,
  (M: string, d: number) =>
    `Over ${d} days, each day's close is i.i.d. Uniform[0, ${M}]. You may buy once and sell once, buying strictly before selling, choosing online as prices reveal. If you still hold on day ${d} you sell at that close; if you're flat on day ${d} you make no trade. What is the maximum expected profit under optimal play?`,
  (M: string, d: number) =>
    `${d} daily closes arrive one at a time, each Uniform[0, ${M}]. Do one round trip — enter on some day, exit on a strictly later day — deciding as you go, with a forced sale on the final day if you're long. What expected profit does the optimal strategy achieve?`,
];

export function genRoundTrip(rng: Rng): Flashcard {
  const days = rng.pick([2, 3, 3, 4, 5]);
  const M = rng.pick([10, 100]); // no M = 1 → never the source [0, 1] scale
  const { profit, sellThresholds, buyThresholds } = roundTrip(F(M), days);
  const MT = usd(F(M));
  const half = usd(F(M).div(F(2)));

  const prompt = rng.pick(ROUNDTRIP_FRAMINGS)(MT, days);
  const answer =
    `Maximum expected profit = ${usd(profit)}. Optimal policy: on each day t, if HOLDING sell iff the price ≥ the sell-threshold, else keep; if FLAT buy iff the price ≤ the buy-threshold, else wait. (Sell-thresholds by day: ${sellThresholds
      .map((f) => usd(f))
      .join(", ")}; buy-thresholds by day: ${buyThresholds
      .map((f) => usd(f))
      .join(", ")}.)`;
  const explanation =
    `Solve by BACKWARD INDUCTION. A fresh uniform price averages ${half}.\n\n` +
    `Selling side: define S_t = expected sale value of holding entering day t. On day ${days} you must sell: S_${days} = ${half}. Earlier, holding, you compare selling now (x) with holding for S_{t+1}: sell iff x ≥ S_{t+1}, giving S_t = E[max(x, S_{t+1})] = (${MT}² + S_{t+1}²)/(2·${MT}).\n\n` +
    `Buying side: define F_t = value of being flat entering day t. On day ${days}, F_${days} = 0 (no later day to sell). Earlier, flat, buying yields expected profit S_{t+1} − x, so buy iff x ≤ S_{t+1} − F_{t+1}, giving F_t = E[max(S_{t+1} − x, F_{t+1})].\n\n` +
    `The answer is F_1 = ${usd(profit)}. The 'aha': this is a TWO-SIDED optimal-stopping problem — you optimize BOTH entry and exit. The thresholds sit around ${half}, yet the day-1 entry cutoff is driven by the sell-side continuation value (not by ${half} directly), because a share you buy early can still be sold on the better of the remaining days.`;

  return {
    id: `bt-roundtrip-${M}-${days}`,
    prompt,
    answer,
    explanation,
    difficulty: "hard",
    concept: "Optimal stopping (two-sided) / backward induction",
    source: "Original house brainteaser · parametric",
  };
}

/* ========================================================================== */
/*  FAMILY 6 — The Inventory Cap  (hard)                                        */
/* ========================================================================== */

const INVENTORY_FRAMINGS = [
  (k: number, up: string, down: string) =>
    `A desk's inventory begins at 0 and is hard-capped to {−${k}, …, +${k}} (a strict ${k}-lot risk limit). Each arriving order nudges inventory +1 with probability ${up} or −1 with probability ${down}; any order that would breach the ±${k} cap is refused and inventory is left untouched, with that order simply walking. Over the long run, what share of arriving orders get refused?`,
  (k: number, up: string, down: string) =>
    `Inventory is capped to {−${k}, …, +${k}} and begins at 0. Each arriving customer moves it +1 with probability ${up} and −1 with probability ${down}; if the move would breach the ±${k} limit the customer is turned away and inventory is unchanged. Long-run, what proportion of customers get rejected?`,
  (k: number, up: string, down: string) =>
    `A desk runs a one-sided book with inventory confined to {−${k}, …, +${k}}. Order flow is i.i.d.: +1 with probability ${up}, −1 with probability ${down}. Orders that would exceed the cap are rejected (inventory stays put). What is the steady-state rejection rate?`,
];

export function genInventoryCap(rng: Rng): Flashcard {
  const cap = rng.pick([1, 1, 2, 3, 4]);
  const pUp = rng.pick([F(1, 2), F(1, 2), F(1, 3), F(2, 3), F(2, 5)]);
  const pNum = Number(pUp.n);
  const pDen = Number(pUp.d);
  const pDown = F(1).sub(pUp);
  const { stationary, rejectionRate } = inventoryCap(cap, pUp);

  const upT = probText(pUp);
  const downT = probText(pDown);
  const isSymmetric = pUp.equals(F(1, 2));
  const prompt = rng.pick(INVENTORY_FRAMINGS)(cap, upT, downT);
  const answer =
    `Exactly ${fracText(rejectionRate)}${
      Number(rejectionRate.d) === 1 ? "" : ` (≈ ${decText(rejectionRate, 4)})`
    } of arriving customers are rejected.${
      isSymmetric
        ? ` (For a symmetric book with cap k, the rate is 1/(2k+1) = 1/${2 * cap + 1}.)`
        : ""
    }`;
  const stationaryText = stationary
    .map((f, i) => `π(${i - cap >= 0 ? "+" : ""}${i - cap}) = ${fracText(f)}`)
    .join(", ");
  const explanation =
    `Model the inventory as a MARKOV CHAIN on states {−${cap}, …, +${cap}}. From an interior state the chain moves +1 w.p. ${upT} and −1 w.p. ${downT}. At the top state +${cap}, an up-move is rejected so the chain HOLDS (self-loop) with probability ${upT}; the bottom −${cap} mirrors this with the down-move.\n\n` +
    `Solve the balance equations πP = π with Σπ = 1 (an exact linear solve). The stationary distribution is ${stationaryText}.${
      isSymmetric
        ? ` For the symmetric book all ${2 * cap + 1} states are EQUALLY likely — the reflecting cap makes the boundary states 'sticky' (a rejection leaves inventory unchanged).`
        : ` The ratio π(i+1)/π(i) = ${upT}/${downT} sets the geometric tilt toward the more-likely direction.`
    }\n\n` +
    `A rejection happens only at +${cap} when a customer wants to push to +${cap + 1} (prob ${upT}), or at −${cap} pushing to −${cap + 1} (prob ${downT}). So the long-run rejection rate is π(+${cap})·${upT} + π(−${cap})·${downT} = ${fracText(rejectionRate)}. The 'aha': reflecting boundaries linger, and that stickiness is exactly what produces the rejection rate.`;

  return {
    id: `bt-inventory-${cap}-${pNum}-${pDen}`,
    prompt,
    answer,
    explanation,
    difficulty: "hard",
    concept: "Markov chains / steady state (balance equations)",
    source: "Original house brainteaser · parametric",
  };
}

/* ========================================================================== */
/*  Named generators (attached to levels + exercised by the tests)             */
/* ========================================================================== */

export const backupDealerFamily: FlashcardGenerator = genBackupDealer;
export const adjacentCrossFamily: FlashcardGenerator = genAdjacentCross;
export const walkOfferDownFamily: FlashcardGenerator = genWalkOfferDown;
export const fadingBuyerFamily: FlashcardGenerator = genFadingBuyer;
export const roundTripFamily: FlashcardGenerator = genRoundTrip;
export const inventoryCapFamily: FlashcardGenerator = genInventoryCap;

/** All six families, for tests and any "mixed" wiring. */
export const ALL_BRAINTEASER_FAMILIES: [string, FlashcardGenerator][] = [
  ["genBackupDealer", genBackupDealer],
  ["genAdjacentCross", genAdjacentCross],
  ["genWalkOfferDown", genWalkOfferDown],
  ["genFadingBuyer", genFadingBuyer],
  ["genRoundTrip", genRoundTrip],
  ["genInventoryCap", genInventoryCap],
];
