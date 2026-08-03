import type { VerifiedItem } from "./schema";

/**
 * Probability & expected-value items — the reasoning core of every trading
 * interview. Worked solutions show the full sample-space / linearity argument.
 */
export const PROBABILITY_EV_ITEMS: VerifiedItem[] = [
  {
    id: "vb-pe-001",
    prompt: "Two fair six-sided dice are rolled. What is the probability the two faces sum to 7?",
    category: "probability-ev",
    difficulty: "easy",
    answer: "1/6",
    workedSolution:
      "There are 6 × 6 = 36 equally likely ordered outcomes. Sums of 7 come from (1,6),(2,5),(3,4),(4,3),(5,2),(6,1) — exactly 6 of them. So P = 6/36 = 1/6. (7 is the unique modal sum because every face 1–6 has a partner.)",
    provenance: {
      genre: "dice sample-space counting",
    },
    tags: ["dice", "sample-space", "counting"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-pe-002",
    prompt:
      "You flip a fair coin repeatedly until the first head appears. What is the expected number of flips?",
    category: "probability-ev",
    difficulty: "medium",
    answer: 2,
    workedSolution:
      "Let E be the expected flips. The first flip is always used. With prob 1/2 you stop; with prob 1/2 you are back where you started needing E more. So E = 1 + (1/2)E, giving (1/2)E = 1, E = 2. (This is the mean of a Geometric(1/2), 1/p = 2.)",
    provenance: {
      firm: "Jane Street",
      round: "phone screen",
      genre: "geometric expectation / recursion",
    },
    tags: ["expectation", "geometric", "recursion"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-pe-003",
    prompt:
      "A bag holds 3 red and 2 blue chips. You draw 2 chips at random without replacement. What is the probability both are red?",
    category: "probability-ev",
    difficulty: "easy",
    answer: "3/10",
    workedSolution:
      "Sequentially: P(first red) = 3/5, then P(second red | first red) = 2/4. Multiply: (3/5)(2/4) = 6/20 = 3/10. Equivalently C(3,2)/C(5,2) = 3/10.",
    provenance: {
      genre: "hypergeometric draw without replacement",
    },
    tags: ["conditional-probability", "combinatorics", "without-replacement"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-pe-004",
    prompt:
      "A game costs $4 to play: you roll one fair die and are paid its face value in dollars. What is your expected profit per play?",
    category: "probability-ev",
    difficulty: "easy",
    answer: "-$0.50",
    workedSolution:
      "The payout is the die face, whose mean is (1+2+3+4+5+6)/6 = 21/6 = 3.5. Expected profit = payout − cost = 3.5 − 4 = −0.5. The game is a losing proposition by 50 cents per play.",
    provenance: {
      genre: "expected-value of a paid game",
    },
    tags: ["expected-value", "dice", "edge"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-pe-005",
    prompt: "You roll a fair die four times. What is the probability you see at least one six?",
    category: "probability-ev",
    difficulty: "medium",
    answer: "≈ 0.518 (671/1296)",
    workedSolution:
      "Complement: P(no six on a roll) = 5/6, and rolls are independent, so P(no six in four) = (5/6)⁴ = 625/1296. Therefore P(at least one) = 1 − 625/1296 = 671/1296 ≈ 0.5177.",
    provenance: {
      firm: "IMC",
      genre: "complement / de Méré-style counting",
    },
    tags: ["complement", "independence", "dice"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-pe-006",
    prompt:
      "Draw 2 cards from a well-shuffled standard 52-card deck. What is the probability both are aces?",
    category: "probability-ev",
    difficulty: "medium",
    answer: "1/221",
    workedSolution:
      "P(first ace) = 4/52, then P(second ace | first ace) = 3/51. Multiply: (4/52)(3/51) = 12/2652 = 1/221 ≈ 0.452%.",
    provenance: {
      genre: "card-draw conditional probability",
    },
    tags: ["cards", "conditional-probability", "without-replacement"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-pe-007",
    prompt:
      "Two fair dice are rolled. What is the expected value of the larger of the two faces (the max)?",
    category: "probability-ev",
    difficulty: "hard",
    answer: "161/36 ≈ 4.47",
    workedSolution:
      "P(max = k) = P(both ≤ k) − P(both ≤ k−1) = (k/6)² − ((k−1)/6)² = (2k − 1)/36. Then E[max] = Σ_{k=1}^{6} k(2k − 1)/36 = (2·Σk² − Σk)/36 = (2·91 − 21)/36 = 161/36 ≈ 4.47.",
    provenance: {
      firm: "SIG",
      round: "onsite",
      genre: "order-statistics expectation",
    },
    tags: ["order-statistics", "expectation", "dice", "max"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-pe-008",
    prompt:
      "A family has two children. You are told at least one of them is a boy. What is the probability both are boys? (Assume each child is independently a boy or girl with probability 1/2.)",
    category: "probability-ev",
    difficulty: "medium",
    answer: "1/3",
    workedSolution:
      "The equally likely birth orders are {BB, BG, GB, GG}. Conditioning on 'at least one boy' removes GG, leaving {BB, BG, GB}. Only BB has two boys, so P = 1/3. The classic trap is to answer 1/2 by ignoring the ordered sample space.",
    provenance: {
      genre: "conditional probability paradox (two-child)",
    },
    tags: ["conditional-probability", "sample-space", "paradox"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
];
