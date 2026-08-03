import type { VerifiedItem } from "./schema";

/**
 * Sequence / pattern items — "what comes next?" screens. Worked solutions state
 * the generating rule explicitly (differences, ratios, closed form) rather than
 * just naming the answer, so the learner can defend it.
 */
export const SEQUENCE_ITEMS: VerifiedItem[] = [
  {
    id: "vb-sq-001",
    prompt: "What number continues the sequence 2, 6, 12, 20, 30, ...?",
    category: "sequences",
    difficulty: "easy",
    answer: 42,
    workedSolution:
      "The first differences are 4, 6, 8, 10 — an arithmetic run increasing by 2 — so the next difference is 12, giving 30 + 12 = 42. Closed form: the nth term is n(n + 1) (2 = 1·2, 6 = 2·3, ...), and 6·7 = 42.",
    provenance: {
      genre: "next-term / difference pattern",
    },
    tags: ["differences", "closed-form", "pattern"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-sq-002",
    prompt: "What number continues the sequence 1, 4, 9, 16, 25, ...?",
    category: "sequences",
    difficulty: "intro",
    answer: 36,
    workedSolution:
      "These are the perfect squares 1², 2², 3², 4², 5², so the next term is 6² = 36. (Equivalently the differences 3, 5, 7, 9 are the consecutive odd numbers, and the next is 11: 25 + 11 = 36.)",
    provenance: {
      genre: "perfect-squares pattern",
    },
    tags: ["squares", "odd-numbers", "pattern"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-sq-003",
    prompt: "What number continues the sequence 1, 1, 2, 3, 5, 8, ...?",
    category: "sequences",
    difficulty: "intro",
    answer: 13,
    workedSolution:
      "Each term is the sum of the two before it (Fibonacci): 5 + 8 = 13.",
    provenance: {
      genre: "Fibonacci recurrence",
    },
    tags: ["fibonacci", "recurrence", "pattern"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-sq-004",
    prompt: "What number continues the sequence 2, 3, 5, 7, 11, ...?",
    category: "sequences",
    difficulty: "easy",
    answer: 13,
    workedSolution:
      "These are the prime numbers in order (2, 3, 5, 7, 11). The next prime after 11 is 13. The trap is to read it as an additive pattern — the gaps 1, 2, 2, 4 have no simple arithmetic rule.",
    provenance: {
      genre: "prime-number recognition",
    },
    tags: ["primes", "recognition", "pattern"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-sq-005",
    prompt: "What number continues the sequence 1, 2, 6, 24, 120, ...?",
    category: "sequences",
    difficulty: "medium",
    answer: 720,
    workedSolution:
      "Each term is the previous term times an increasing integer: ×2, ×3, ×4, ×5, so next is ×6 → 120 × 6 = 720. These are the factorials: 1!, 2!, 3!, 4!, 5!, 6!.",
    provenance: {
      genre: "factorial growth pattern",
    },
    tags: ["factorial", "ratios", "pattern"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-sq-006",
    prompt: "What number continues the sequence 1, 8, 27, 64, ...?",
    category: "sequences",
    difficulty: "easy",
    answer: 125,
    workedSolution:
      "These are the perfect cubes 1³, 2³, 3³, 4³, so the next is 5³ = 125.",
    provenance: {
      genre: "perfect-cubes pattern",
    },
    tags: ["cubes", "recognition", "pattern"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-sq-007",
    prompt: "What term continues the sequence 1, 11, 21, 1211, 111221, ...?",
    category: "sequences",
    difficulty: "hard",
    answer: 312211,
    workedSolution:
      "This is the 'look-and-say' sequence: each term describes the digits of the previous one. 111221 reads as 'three 1s, two 2s, one 1' → 31 22 11 → 312211.",
    provenance: {
      firm: "Jane Street",
      round: "puzzle round",
      genre: "look-and-say self-description",
    },
    tags: ["look-and-say", "self-reference", "pattern"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-sq-008",
    prompt: "What number continues the sequence 0, 1, 1, 2, 4, 7, 13, ...?",
    category: "sequences",
    difficulty: "hard",
    answer: 24,
    workedSolution:
      "Each term is the sum of the previous three (a tribonacci-style rule): 2 + 4 + 7 = 13, and the next is 4 + 7 + 13 = 24. Check the start: 0 + 1 + 1 = 2, 1 + 1 + 2 = 4, 1 + 2 + 4 = 7. Consistent.",
    provenance: {
      genre: "higher-order linear recurrence",
    },
    tags: ["tribonacci", "recurrence", "pattern"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
];
