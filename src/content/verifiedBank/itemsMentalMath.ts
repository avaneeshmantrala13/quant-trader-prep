import type { VerifiedItem } from "./schema";

/**
 * Mental-math sprint items — the fast arithmetic trading-floor screens live on.
 * Every phrasing here is original; the WORKED SOLUTION shows the mental shortcut
 * (difference-of-squares, complements, anchoring) not just the final number.
 */
export const MENTAL_MATH_ITEMS: VerifiedItem[] = [
  {
    id: "vb-mm-001",
    prompt: "Compute 17 × 23 in your head.",
    category: "mental-math",
    difficulty: "easy",
    answer: 391,
    workedSolution:
      "Both numbers straddle 20 symmetrically (20 − 3 and 20 + 3), so use difference of squares: (20 − 3)(20 + 3) = 20² − 3² = 400 − 9 = 391.",
    provenance: {
      firm: "Optiver",
      round: "mental-math sprint",
      genre: "timed arithmetic screen",
    },
    tags: ["difference-of-squares", "multiplication", "speed"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-mm-002",
    prompt: "Compute 48 × 52 without writing anything down.",
    category: "mental-math",
    difficulty: "easy",
    answer: 2496,
    workedSolution:
      "48 and 52 are 50 ∓ 2, so (50 − 2)(50 + 2) = 50² − 2² = 2500 − 4 = 2496.",
    provenance: {
      firm: "Optiver",
      round: "mental-math sprint",
      genre: "timed arithmetic screen",
    },
    tags: ["difference-of-squares", "multiplication", "speed"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-mm-003",
    prompt: "Express 7/16 as a decimal.",
    category: "mental-math",
    difficulty: "easy",
    answer: 0.4375,
    workedSolution:
      "1/16 = 0.0625 (half of 1/8 = 0.125). Multiply by 7: 7 × 0.0625 = 0.4375. Traders memorise the sixteenths because option ticks used to live there.",
    provenance: {
      genre: "fraction-to-decimal recall (tick sizes)",
    },
    tags: ["fractions", "decimals", "sixteenths", "recall"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-mm-004",
    prompt: "What is 13% of 250? Do it in your head.",
    category: "mental-math",
    difficulty: "easy",
    answer: 32.5,
    workedSolution:
      "Split the percentage: 10% of 250 = 25, and 3% of 250 = 7.5. Add them: 25 + 7.5 = 32.5.",
    provenance: {
      genre: "percentage decomposition drill",
    },
    tags: ["percentages", "decomposition", "speed"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-mm-005",
    prompt: "Square 35 in your head.",
    category: "mental-math",
    difficulty: "easy",
    answer: 1225,
    workedSolution:
      "Any number ending in 5: take the tens digit n (here 3), compute n(n+1) = 3 × 4 = 12, then append 25 → 1225.",
    provenance: {
      genre: "squaring-numbers-ending-in-5 trick",
    },
    tags: ["squaring", "trick", "speed"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-mm-006",
    prompt: "Compute 96 × 94 mentally.",
    category: "mental-math",
    difficulty: "medium",
    answer: 9024,
    workedSolution:
      "Center on 95: (95 + 1)(95 − 1) = 95² − 1. And 95² = 9025 (9 × 10 = 90, append 25). So 9025 − 1 = 9024.",
    provenance: {
      firm: "Jane Street",
      round: "arithmetic warmup",
      genre: "difference-of-squares multiplication",
    },
    tags: ["difference-of-squares", "squaring", "multiplication"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-mm-007",
    prompt:
      "A position is up 8% one day and down 8% the next. Is it above, below, or at its starting value, and by how much?",
    category: "mental-math",
    difficulty: "medium",
    answer: "Below start by 0.64%",
    workedSolution:
      "Chaining returns multiplies factors: 1.08 × 0.92 = 0.9936, i.e. 99.36% of the start. Equivalently (1 + x)(1 − x) = 1 − x² = 1 − 0.0064. Gains and equal-percentage losses do NOT cancel — you finish down 0.64%.",
    provenance: {
      genre: "return-compounding intuition check",
    },
    tags: ["percentages", "compounding", "difference-of-squares", "returns"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-mm-008",
    prompt: "Estimate the square root of 2000 to one decimal place.",
    category: "mental-math",
    difficulty: "medium",
    answer: 44.7,
    workedSolution:
      "44² = 1936 and 45² = 2025, so the root is between 44 and 45, nearer 45. Linear interpolation: 2000 − 1936 = 64 of the 89 gap (2025 − 1936), i.e. ≈ 0.72, giving ≈ 44.7. (Exact: √2000 ≈ 44.721.)",
    provenance: {
      genre: "square-root estimation by bracketing",
    },
    tags: ["square-root", "estimation", "interpolation"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
];
