import type { Flashcard } from "@/types/content";
import { fracText, decText } from "./combinatorics";
import {
  coinGrabAtLeastProb,
  multiDeckStraightProb,
  overbookedDeniedProb,
  secretSharing,
  expectedPairsDealt,
} from "./solvers";

/**
 * The **Combinatorial Reasoning Desk** (`ca-9`) — the non-scalar / multi-
 * technique specials the dataset flags for reasoning rather than a single graded
 * number: a TWO-PART threshold-secret-sharing answer, a "compute-it-yourself"
 * coin-grab count, a big-binomial denied-boarding tail, a multi-deck straight
 * (straights minus straight-flushes), and a linearity-of-expectation indicator
 * count. Each is an integrity-based flashcard (reason → reveal → self-assess).
 *
 * Every number shown is computed LIVE from the verified solvers in `./solvers.ts`
 * (never hardcoded), so the reveals stay in sync with the fixtures. All wording
 * is fresh — no source-dataset title or phrasing appears.
 */

// Fresh (non-dataset) parameter instances, all solved exactly by the core.
const share = secretSharing(7, 4); // 7 signatories, any 4 can open
const grab = coinGrabAtLeastProb([200, 100, 50, 20, 10, 5, 2, 1], 3, 90); // the computed classic, re-derived
const straight = multiDeckStraightProb(4); // a 4-deck shoe (208 cards)
const denied = overbookedDeniedProb(260, 250, 0.04); // 260 sold, 250 seats, 4% no-show
const pairs = expectedPairsDealt(5, 2, 5); // 5 ranks × 2 copies, deal 5

export const combinatorialAnalysisFlashcards: Flashcard[] = [
  {
    // Two-part threshold secret-sharing (locks AND keys/person) — never one scalar.
    id: "ca-fc-secretsharing",
    prompt:
      "Seven co-signers guard a vault so that ANY four of them together can open it, but no three can. Using a combinatorial lock scheme (each lock opened by a distinct subset who all hold its key), what is the MINIMUM number of locks, and how many keys must each person carry?",
    answer:
      `Two numbers: ${share.locks.toString()} locks, and ${share.keysPerPerson.toString()} keys per person. ` +
      `Every group of 3 must be blocked by some lock none of them holds — one lock per 3-person "blocking" coalition, C(7,3) = ${share.locks.toString()}; each such lock's key goes to the complementary ${share.keysPerLock.toString()} people, and 7·keys = ${share.locks.toString()}·${share.keysPerLock.toString()}, so each person carries ${share.keysPerPerson.toString()}.`,
    explanation:
      `Threshold t = 4 of n = 7. A set of t−1 = 3 people must be unable to open the vault, so there must be a lock whose key none of those 3 hold — held instead by the other n−(t−1) = 4. One lock per minimal blocking coalition (each (t−1)-subset) gives locks = C(7, t−1) = C(7,3) = ${share.locks.toString()}. Each lock has keysPerLock = n − (t−1) = ${share.keysPerLock.toString()} keys, and the total ${share.locks.toString()}·${share.keysPerLock.toString()} keys spread evenly over 7 people is ${share.locks.toString()}·${share.keysPerLock.toString()}/7 = ${share.keysPerPerson.toString()} keys each. The trap is answering a single number — the deliverable is BOTH the lock count and the per-person key count.`,
    difficulty: "hard",
    concept: "Threshold secret-sharing via combinatorial locks (two-part answer)",
    source: "Combinatorial Analysis · Multiplication principle (secret-sharing)",
  },
  {
    // "Compute it yourself" coin-grab value threshold (the dataset's (computed) item).
    id: "ca-fc-coingrab",
    prompt:
      "Your pocket holds exactly one coin of each value: 200, 100, 50, 20, 10, 5, 2 and 1 cents. You grab 3 coins at random. What is the probability the grab is worth at least 90 cents? (This one has no published solution — derive it.)",
    answer:
      `${fracText(grab)} ≈ ${decText(grab, 3)}. The three largest SMALL coins (50+20+10 = 80) can't reach 90, so a grab clears 90¢ iff it contains the 200¢ OR the 100¢ coin. Grabs avoiding both big coins: C(6,3) = 20, so favourable = C(8,3) − 20 = 56 − 20 = 36, and 36/56 = ${fracText(grab)}.`,
    explanation:
      `Total grabs = C(8,3) = 56. Key observation: the largest sum achievable WITHOUT either big coin is 50 + 20 + 10 = 80 < 90, so a grab reaches 90¢ if and only if it includes the 200¢ or the 100¢ coin. Count the complement (neither big coin): choose all 3 from the six small coins, C(6,3) = 20. Favourable = 56 − 20 = 36, giving 36/56 = ${fracText(grab)} ≈ ${decText(grab, 3)}. An independent exact enumeration of all 56 three-coin subsets confirms 36 clear the threshold, matching 9/14.`,
    difficulty: "medium",
    concept: "Counting value-threshold grabs by complement",
    source: "Combinatorial Analysis · Coin-grab value threshold (computed)",
  },
  {
    // Big-binomial denied-boarding tail (exact/high-precision).
    id: "ca-fc-overbooked",
    prompt:
      "An airline sells 260 tickets for a 250-seat flight. Each ticket-holder independently fails to show with probability 4%. What is the probability that at least one passenger who shows up is denied boarding? Explain how you'd compute this binomial tail without overflow.",
    answer:
      `≈ ${denied.toFixed(3)}. Someone is bumped iff fewer than 260 − 250 = 10 no-shows occur, i.e. X ≤ 9 where X ~ Binomial(260, 0.04). Summing P(X = 0..9) in log-space (log-gamma binomial coefficients) gives ≈ ${denied.toFixed(4)}.`,
    explanation:
      `There are 260 − 250 = 10 more tickets than seats, so everyone is seated unless at least 10 people no-show; a passenger is denied boarding iff the number of no-shows X ≤ 9. X ~ Binomial(260, 0.04) with mean 10.4. The tail P(X ≤ 9) = Σ_{k=0}^{9} C(260,k)·0.04^k·0.96^{260−k}. The binomial coefficients are astronomically large and the powers astronomically small, so compute each term in LOG space — log C(n,k) via log-gamma, plus k·ln p + (n−k)·ln(1−p), then exponentiate and sum — to avoid overflow/underflow. The result is ≈ ${denied.toFixed(4)} (just under mean, since the mean 10.4 sits just above the cutoff 9).`,
    difficulty: "hard",
    concept: "Binomial tail with large n via log-space summation",
    source: "Combinatorial Analysis · Binomial tail (big-n no-shows)",
  },
  {
    // Multi-deck straight: straights minus straight flushes.
    id: "ca-fc-multideckstraight",
    prompt:
      "Four standard 52-card decks are shuffled together (208 cards) and you draw 3 cards. What is the probability they form three consecutive ranks (Ace low or high) that are NOT all the same suit? 4 dp.",
    answer:
      `${decText(straight, 4)}. There are 12 rank-runs (A-2-3 … Q-K-A); each rank now has 4·4 = 16 copies, so 16³ = 4096 hands per run, minus the 4·4³ = 256 straight-flushes ⇒ 3840 per run; ×12 = 46080 favourable, over C(208,3). = ${fracText(straight)} ≈ ${decText(straight, 4)}.`,
    explanation:
      `Total hands = C(208,3). A three-card straight uses one of the 12 consecutive rank-triples. With 4 decks each rank has 4 suits × 4 decks = 16 copies, so choosing one card of each of the three ranks gives 16³ = 4096 ordered-by-rank hands per run. Subtract the straight-flushes (all three same suit): 4 suits × 4³ = 256 per run, leaving 4096 − 256 = 3840. Across all 12 runs: 12 × 3840 = 46080 favourable hands, so P = 46080 / C(208,3) = ${fracText(straight)} ≈ ${decText(straight, 4)}. The multi-technique trap is forgetting to subtract the straight-flushes, or mishandling the per-rank copy count.`,
    difficulty: "hard",
    concept: "Multi-deck straight = straights − straight flushes",
    source: "Combinatorial Analysis · Without-replacement (multi-deck straight)",
  },
  {
    // Linearity of expectation with indicators.
    id: "ca-fc-linearitypairs",
    prompt:
      "A mini-deck has 5 ranks with 2 copies of each (10 cards). You deal 5 cards. What is the EXPECTED number of complete pairs (both copies of a rank) in your hand? Why does linearity make this easy even though the pair events are dependent?",
    answer:
      `${fracText(pairs)} ≈ ${decText(pairs, 3)}. Let Iᵣ = 1 if rank r is fully in the hand. E[Iᵣ] = C(8,3)/C(10,5) = 56/252 = 2/9, and by linearity E[pairs] = 5 · 2/9 = ${fracText(pairs)} — no independence needed.`,
    explanation:
      `Define an indicator Iᵣ for each of the 5 ranks: Iᵣ = 1 iff both of its copies are among the 5 dealt cards. P(Iᵣ = 1) = C(2,2)·C(8,3)/C(10,5) = 56/252 = 2/9 (fix the rank's 2 cards, choose the other 3 from the remaining 8). Linearity of expectation says E[Σ Iᵣ] = Σ E[Iᵣ] = 5 · 2/9 = ${fracText(pairs)} ≈ ${decText(pairs, 3)}, and crucially this holds even though the Iᵣ are DEPENDENT (holding one full pair changes the odds of another) — linearity never requires independence. The trap is trying to compute a joint distribution instead of just summing per-rank probabilities.`,
    difficulty: "hard",
    concept: "Linearity of expectation with indicator variables",
    source: "Combinatorial Analysis · Linearity of expectation (indicators)",
  },
];
