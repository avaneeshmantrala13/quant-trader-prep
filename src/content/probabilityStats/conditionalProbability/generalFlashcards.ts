import type { Flashcard } from "@/types/content";

/**
 * Reasoning-desk flashcard re-homed from the former "General" reasoning desk
 * into **Conditional Probability** (cp-6, Paradoxes & Classics): the stopping-
 * rule invariant — a self-selected stopping time cannot bias the sex ratio.
 */
export const conditionalGeneralFlashcards: Flashcard[] = [
  {
    // GN65 — All-Boys City — stopping-rule invariant.
    id: "gen-fc-stoppingrule",
    prompt:
      "Picture a very large country where every family follows one custom: they keep having children and stop the instant their first girl arrives. Treating each birth as an independent, evenly-matched coin flip between the sexes, what value does the nationwide proportion of girls settle at — and can you prove it cannot be tilted?",
    answer:
      "Exactly one-half (50%). A stopping rule the parents choose cannot bias the sex of any individual birth — every birth is still an independent 50/50 event, so the long-run proportion of girls is precisely ½.",
    explanation:
      "Every birth is an independent fair coin no matter what rule the parents use to decide WHEN to stop. By linearity/exchangeability, the whole nationwide sequence of births is a single i.i.d. 50/50 stream; slicing it into families by 'stop at the first girl' merely relabels the stream without altering any individual outcome, so E[#girls]/E[#children] = ½. Concretely, each family ends with exactly one girl preceded by a Geometric(½)−1 number of boys, giving E[boys] = 1 = E[girls] per family — again ½. The classic error is to expect 'stopping at the first girl' to skew the population toward boys; it feels lopsided, but nature is memoryless, and no self-chosen stopping time can shift a fair coin.",
    difficulty: "easy",
    concept: "Stopping rule doesn't change the parity ratio",
    source: "Conditional Probability · stopping-rule invariant",
  },
];
