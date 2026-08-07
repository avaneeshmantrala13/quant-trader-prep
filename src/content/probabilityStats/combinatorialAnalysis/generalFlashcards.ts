import type { Flashcard } from "@/types/content";
import { ascendingGame } from "../coreSolvers";

/**
 * Reasoning-desk flashcard re-homed from the former "General" reasoning desk
 * into **Combinatorial Analysis** (ca-9): the five-ascending-cards fairness
 * judgment + fair payout, whose core is the ordering probability 1/k! (a
 * counting fact). Numbers come from the verified solver in `../coreSolvers`.
 */
const asc = ascendingGame(5, 40, 1);

export const combinatorialGeneralFlashcards: Flashcard[] = [
  {
    // Ordering-probability fairness judgment + payout (hybrid). Re-themed and
    // re-numbered off the source (different stack size and prize), the concept
    // (P(ascending) = 1/k!) is public-domain; wording and incidental numbers differ.
    id: "gen-fc-fairpayout",
    prompt:
      "You are offered a side bet: from a well-shuffled stack of 50 distinct numbered cards, the dealer flips the top 5 face up one by one. If those five values happen to appear in strictly increasing order the dealer pays you $40; on any other order you forfeit $1. Is the bet fair to you, and if not, what winning prize would even it out?",
    answer:
      `Not fair, the dealer has the edge. P(all 5 ascending) = 1/5! = 1/120, so EV = 40·(1/120) − 1·(119/120) = ${asc.ev.valueOf().toFixed(4)} per play (a loss). To make EV = 0 the winning prize must rise to $${asc.fairReward.valueOf()} against the $1 forfeit.`,
    explanation:
      "Any 5 distinct values have 5! = 120 equally-likely orderings, exactly one strictly ascending, so P(win) = 1/120 regardless of how big the 50-card stack is. Expected payoff = prize·(1/120) − 1·(119/120); at a $40 prize that is (40 − 119)/120 = −79/120 ≈ −0.66, a clear edge to the dealer. Setting prize/120 − 119/120 = 0 gives the fair prize = 119, you must be paid $119 for the 1-in-120 win to offset the 119-in-120 chance of losing $1. The two parts, the fairness JUDGMENT (reasoning) and the $119 break-even prize (verifiable), are why this is a hybrid target.",
    difficulty: "medium",
    concept: "Fair-game / EV; probability of an ordering (1/k!)",
    source: "Combinatorial Analysis · fairness + payout",
  },
];
