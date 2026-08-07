import type { Flashcard } from "@/types/content";

/**
 * Integrity-based flashcards for the Math Questions track's **Solving Unknowns &
 * Derivations** level. These are the NON-SCALAR problems that don't fit numeric
 * free-entry or clean multiple choice:
 *
 *   • Linear Diophantine puzzles (SU1–SU4 shape) whose answer is a full 5-tuple
 *     (A,B,C,D,E), each a distinct digit 1–5, graded as a permutation, so a
 *     single-number checker can't score them. Every puzzle here is BRAND NEW
 *     (fresh equations, distinct from the source dataset's tuples) and its
 *     uniqueness is asserted by the brute-force solver in the test suite.
 *   • Sharing a Glass (MQ34): a TWO-PART answer (2/3 and 1/3).
 *   • Derivation/strategy answers (Boats on a River, Sheep Runs Home, System of
 *     Weights): the "answer" is a worked derivation, so the learner reasons it
 *     out and self-assesses on reveal.
 *
 * The exact closed forms behind the derivation cards (river width W = 3a − b,
 * the Snell-style optimum, the balance system) are re-derived independently in
 * `mathQuestions.test.ts` so the revealed numbers are verifier-checked.
 */

export const solvingUnknownsFlashcards: Flashcard[] = [
  {
    id: "mq-su-diophantine-1",
    prompt:
      "A, B, C, D, E are five DIFFERENT whole numbers, each from 1 to 5 (used once each). They satisfy: (1) A + E = C, (2) B = D + E, (3) A = 2·D, and (4) E > A. Find A, B, C, D, E.",
    answer: "A = 2, B = 4, C = 5, D = 1, E = 3.",
    explanation:
      "From (3) A = 2·D the options are (D, A) = (1, 2) or (2, 4). Branch D = 1, A = 2: (1) gives C = 2 + E and (2) gives B = 1 + E over the remaining {3, 4, 5}; E = 3 yields C = 5, B = 4, exactly {3, 4, 5}, and (4) E = 3 > A = 2 holds. Branch D = 2, A = 4 also solves (1)–(3) (as A4 B3 C5 D2 E1) but there E = 1 < A = 4, violating (4). So constraint (4) pins the unique answer A2 B4 C5 D1 E3.",
    difficulty: "medium",
    concept: "Linear Diophantine system (unique permutation)",
    source: "Math Questions · Solving Unknowns",
  },
  {
    id: "mq-su-diophantine-2",
    prompt:
      "A, B, C, D, E are five DIFFERENT whole numbers, each from 1 to 5 (used once each). They satisfy: (1) B = A + C, (2) A + E = D, and (3) B = 5·E. Find A, B, C, D, E.",
    answer: "A = 3, B = 5, C = 2, D = 4, E = 1.",
    explanation:
      "From (3) B = 5·E with both in 1..5 forces E = 1 and B = 5. Then (1) A + C = 5 and (2) D = A + 1, with {A, C, D} drawn from the remaining {2, 3, 4}. If A = 3 then C = 2 and D = 4, exactly {2, 3, 4}. A = 2 gives C = 3, D = 3 (a clash); A = 4 gives D = 5 (already B) and C = 1 (already E). So the unique solution is A3 B5 C2 D4 E1.",
    difficulty: "medium",
    concept: "Linear Diophantine system (unique permutation)",
    source: "Math Questions · Solving Unknowns",
  },
  {
    id: "mq-su-diophantine-3",
    prompt:
      "A, B, C, D, E are five DIFFERENT whole numbers, each from 1 to 5 (used once each). They satisfy: (1) A = 2·B, (2) E = A + C, (3) D = B + C, and (4) A > D. Find A, B, C, D, E.",
    answer: "A = 4, B = 2, C = 1, D = 3, E = 5.",
    explanation:
      "From (1) A = 2·B, the options are (B, A) = (1, 2) or (2, 4). Take B = 2, A = 4: then (2) E = 4 + C and (3) D = 2 + C over the remaining {1, 3, 5}. C = 1 gives D = 3 and E = 5 ✓, and (4) A = 4 > D = 3 holds. The other branch B = 1, A = 2 also solves (1)–(3) (as A2 B1 C3 D4 E5) but there A = 2 < D = 4, violating (4). So constraint (4) pins the unique answer A4 B2 C1 D3 E5.",
    difficulty: "hard",
    concept: "Linear Diophantine system (disambiguated by an inequality)",
    source: "Math Questions · Solving Unknowns",
  },
  {
    id: "mq-su-sharing-glass",
    prompt:
      "A full glass is shared by alternating pours. First Ana pours out and drinks exactly HALF of what is in the glass; then Ben drinks half of what REMAINS; then Ana drinks half of the new remainder; and so on forever, always halving whatever is left. In the limit, what fraction of the original glass does EACH of them drink?",
    answer: "Ana drinks 2/3 of the glass and Ben drinks 1/3.",
    explanation:
      "Ana's sips are 1/2, then 1/8, then 1/32, …, a geometric series with first term 1/2 and ratio 1/4, summing to (1/2)/(1 − 1/4) = 2/3. Ben's sips are 1/4, 1/16, 1/64, …, first term 1/4, ratio 1/4, summing to (1/4)/(1 − 1/4) = 1/3. They total 2/3 + 1/3 = 1 (the whole glass), and the 2:1 split is the invariant: whoever goes first always ends with twice the other's share.",
    difficulty: "easy",
    concept: "Alternating geometric series (two-part answer)",
    source: "Math Questions · Solving Unknowns",
  },
  {
    id: "mq-su-boats-river",
    prompt:
      "Two ferries leave opposite banks of a straight river at the same instant, each at its own constant speed, and cross without stopping. They first pass each other 700 m from the near bank. Each continues to the far bank, instantly turns around, and heads back; they pass a second time 300 m from the far bank. How wide is the river?",
    answer: "1800 m wide.",
    explanation:
      "At the first meeting the two ferries have together covered exactly one river width W. Speeds are constant, so at the second meeting they have together covered 3W (they've now made a round-trip's worth of combined distance). Because each ferry keeps the same speed, each has therefore travelled three times as far as at the first meeting. The ferry that started at the near bank had gone 700 m by the first meeting, so 3·700 = 2100 m by the second. That 2100 m is one full width W plus the 300 m back from the far bank: 2100 = W + 300 ⇒ W = 1800 m. (Equivalently W = 3a − b = 3·700 − 300.)",
    difficulty: "hard",
    concept: "Two-boat river-width meeting (W = 3a − b)",
    source: "Math Questions · Solving Unknowns",
  },
  {
    id: "mq-su-sheep-optimum",
    prompt:
      "A dog must reach a gate. It runs along a straight road at 10 m/s, then cuts across a field at 6 m/s to the gate, which sits 24 m out from the road. The point on the road directly opposite the gate is 48 m ahead of the dog. Where should it leave the road to arrive fastest, and how long does the trip take?",
    answer:
      "Leave the road 18 m before the point opposite the gate; the fastest trip takes exactly 8 seconds.",
    explanation:
      "Let x be the distance short of the opposite point where the dog leaves the road. Road time is (48 − x)/10; field time is √(24² + x²)/6. Minimizing the total, the optimum satisfies the refraction (Snell-style) condition x/√(24² + x²) = 6/10, i.e. the ratio of speeds. Solving: x² = 0.36(576 + x²) ⇒ 0.64x² = 207.36 ⇒ x = 18. The field leg is √(24² + 18²) = √900 = 30 m. Total time = (48 − 18)/10 + 30/6 = 3 + 5 = 8 s. Cutting across too early or too late both cost time; 18 m is the sweet spot.",
    difficulty: "hard",
    concept: "Optimal path (calculus / Snell's law)",
    source: "Math Questions · Solving Unknowns",
  },
  {
    id: "mq-su-weights",
    prompt:
      "On a balance mobile: one Pyramid exactly balances two Orbs, and four Orbs exactly balance a 24-gram reference block. Every Orb weighs the same, and every Pyramid weighs the same. How heavy is one Pyramid?",
    answer: "One Pyramid weighs 12 grams.",
    explanation:
      "Four Orbs balance 24 g, so each Orb weighs 24 ÷ 4 = 6 g. A Pyramid balances two Orbs, so it weighs 2 × 6 = 12 g. The trick is to resolve the reference weight first (the Orb), then substitute upward through the balance relations.",
    difficulty: "medium",
    concept: "Balance system (substitution)",
    source: "Math Questions · Solving Unknowns",
  },
];
