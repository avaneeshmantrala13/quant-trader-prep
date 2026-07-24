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
      "In a country, every couple keeps having children until they get their first son, then stops. Births are independent and 50/50. Over the whole population, what happens to the fraction of children who are boys? Argue it precisely.",
    answer:
      "It stays 50%. A stopping rule chosen by the parents cannot bias the sex of any individual birth — each birth is still an independent 50/50 coin, so the long-run fraction of boys is exactly ½.",
    explanation:
      "Each birth is an independent fair coin regardless of any rule the parents use to decide WHEN to stop. Linearity/exchangeability: the sequence of all births in the country is just an i.i.d. 50/50 stream; partitioning it into families by 'stop at first son' re-labels the stream but changes no individual outcome, so E[#boys]/E[#children] = ½. Concretely, each family produces exactly one boy and a Geometric(½)−1 number of girls, with E[girls] = 1 = E[boys] per family, again ½. The classic error is to think 'stopping at the first boy' should tilt the ratio toward girls; it feels asymmetric but nature is memoryless — no self-selected stopping time can change a coin's bias.",
    difficulty: "easy",
    concept: "Stopping rule doesn't change the parity ratio",
    source: "Conditional Probability · stopping-rule invariant",
  },
];
