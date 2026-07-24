import type { Flashcard } from "@/types/content";
import { ascendingGame } from "../coreSolvers";

/**
 * Reasoning-desk flashcard re-homed from the former "General" reasoning desk
 * into **Combinatorial Analysis** (ca-9): the five-ascending-cards fairness
 * judgment + fair payout, whose core is the ordering probability 1/k! (a
 * counting fact). Numbers come from the verified solver in `../coreSolvers`.
 */
const asc = ascendingGame(5, 25, 1);

export const combinatorialGeneralFlashcards: Flashcard[] = [
  {
    // GN67 — Five Ascending Cards — fairness judgment + payout (hybrid).
    id: "gen-fc-fairpayout",
    prompt:
      "A shuffled deck of 63 distinct cards is dealt; you look at the top 5. If they come out in strictly ascending order you win $25, otherwise you lose $1. Is this a fair game? If not, what winning payout WOULD make it fair?",
    answer:
      `Not fair — it is a losing bet. P(ascending) = 1/5! = 1/120, so EV = 25·(1/120) − 1·(119/120) = ${asc.ev.valueOf().toFixed(4)} ≈ −$0.78 per play. The payout that makes EV = 0 is $${asc.fairReward.valueOf()} (win $119, lose $1).`,
    explanation:
      "Any 5 distinct cards have 5! = 120 equally-likely orderings, exactly one of which is ascending, so P(win) = 1/120 (independent of the deck size beyond 'distinct'). Expected payoff = reward·(1/120) − 1·(119/120). At reward = 25 that is (25 − 119)/120 = −94/120 ≈ −0.783, so the house has a large edge. Setting reward/120 − 119/120 = 0 gives the fair reward = 119: you should be paid $119 for the 1-in-120 event to offset the 119-in-120 chance of losing $1. The two parts — the fairness JUDGMENT (reasoning) and the $119 payout (verifiable) — are why this is a hybrid target.",
    difficulty: "medium",
    concept: "Fair-game / EV; probability of an ordering (1/k!)",
    source: "Combinatorial Analysis · fairness + payout",
  },
];
