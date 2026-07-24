import type { Flashcard } from "@/types/content";

/**
 * Reasoning-desk flashcards re-homed from the former "General" reasoning desk
 * into **Markov Chains** (mc-6): the divergent first-return expectation of a
 * symmetric random walk, and the best-of-three decision resolved via (2p−1)².
 * Both are pure-reasoning specials (no scalar to grade).
 */
export const markovGeneralFlashcards: Flashcard[] = [
  {
    // GN32 — How Many Children — divergent expectation (Infinity sentinel).
    id: "gen-fc-firstreturn",
    prompt:
      "A family keeps having children until, for the first time, they have exactly as many sons as daughters (each birth is an independent 50/50). Each child is a ±1 step of a symmetric random walk (son +1, daughter −1); they stop the first time the walk returns to 0. Two questions: (a) do they ALMOST SURELY stop? (b) what is the EXPECTED number of children?",
    answer:
      "(a) Yes — a symmetric 1-D walk is recurrent, so it returns to 0 with probability 1. (b) The expected number of children is INFINITE. It is a genuine paradox: they tie eventually with certainty, yet the mean waiting time diverges.",
    explanation:
      "The first return to 0 of a symmetric ±1 walk happens only at even times 2k, with P(T = 2k) = C(2k,k)/((2k−1)·2^{2k}). By Stirling C(2k,k) ~ 4^k/√(πk), so P(T = 2k) ~ (1/(2√π))·k^{−3/2}. Recurrence: Σ P(T = 2k) = 1, so they stop almost surely. But E[T] = Σ 2k·P(T = 2k) ~ (1/√π)·Σ k^{−1/2}, a p-series with p = ½ < 1, which DIVERGES. So the answer is not a finite number — it is +∞ (a sentinel, never a finite scalar). The heavy k^{−3/2} tail is what makes an almost-surely-finite quantity have an infinite mean.",
    difficulty: "hard",
    concept: "Expected first-return time of a symmetric walk (diverges)",
    source: "Markov Chains · Random walk / recursion (divergent expectation)",
  },
  {
    // GN66 — Tennis 2-or-3 sets — a decision via (2p−1)².
    id: "gen-fc-bestof3",
    prompt:
      "In a best-of-three match (first to two sets), one player wins each set independently with probability p. Would you rather bet that the match ends in exactly TWO sets, or in exactly THREE sets? For which p is it a toss-up?",
    answer:
      "Bet on TWO sets. P(2 sets) − P(3 sets) = (2p − 1)², which is ≥ 0 for every p and strictly positive unless p = ½. So finishing in two sets is always at least as likely, and it is a genuine toss-up only when the players are exactly evenly matched (p = ½).",
    explanation:
      "P(2 sets) = p² + (1−p)² (one player takes the first two). P(3 sets) = 2p(1−p) (a 1–1 split forces a decider). Their difference is p² + (1−p)² − 2p(1−p) = 4p² − 4p + 1 = (2p − 1)². Because a square is never negative, two-set finishes dominate for all p, with equality only at p = ½ (where both are ½). The key object the interviewer wants is (2p − 1)² ≥ 0 — recognising that the sign of the decision never flips — not a specific number.",
    difficulty: "medium",
    concept: "Compare P(2 sets) vs P(3 sets) via (2p−1)²",
    source: "Markov Chains · Random walk / recursion (decision rule)",
  },
];
