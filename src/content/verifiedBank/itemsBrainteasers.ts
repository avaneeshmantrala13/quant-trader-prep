import type { VerifiedItem } from "./schema";

/**
 * Brainteaser items — logic and construction puzzles. Worked solutions give the
 * full constructive argument (the exact procedure or the counting insight), not
 * just the punchline number.
 */
export const BRAINTEASER_ITEMS: VerifiedItem[] = [
  {
    id: "vb-bt-001",
    prompt:
      "You have two lengths of fuse. Each takes exactly 60 minutes to burn end to end, but neither burns at a uniform rate. Using only these fuses and a lighter, how do you measure exactly 45 minutes?",
    category: "brainteasers",
    difficulty: "medium",
    answer: "45 minutes",
    workedSolution:
      "At time 0 light fuse A at BOTH ends and fuse B at ONE end. Because A burns from both ends, it is fully consumed in 30 minutes regardless of its uneven rate. At that instant (30 min) light B's other end; B now has 30 minutes of material left but burns from both ends, so it finishes in 15 more minutes. 30 + 15 = 45.",
    provenance: {
      firm: "Jane Street",
      round: "puzzle round",
      genre: "burning-fuse timing puzzle",
    },
    tags: ["construction", "timing", "logic"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-bt-002",
    prompt:
      "There are 100 closed lockers in a row. 100 students pass by: student k toggles (opens if closed, closes if open) every locker whose number is a multiple of k. After all 100 passes, how many lockers are open?",
    category: "brainteasers",
    difficulty: "hard",
    answer: 10,
    workedSolution:
      "Locker n is toggled once for each divisor of n, so it ends OPEN exactly when n has an odd number of divisors. Divisors pair up (d with n/d) except when n is a perfect square (the square root pairs with itself), so only perfect squares have an odd divisor count. The perfect squares in 1..100 are 1,4,9,...,100 — ten of them.",
    provenance: {
      genre: "divisor-parity toggling puzzle",
    },
    tags: ["number-theory", "divisors", "perfect-squares", "logic"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-bt-003",
    prompt:
      "Four people must cross a rickety bridge at night with one flashlight. At most two can cross at once and they move at the slower person's pace. Alone they would take 1, 2, 5, and 10 minutes. What is the minimum total time to get everyone across?",
    category: "brainteasers",
    difficulty: "hard",
    answer: 17,
    workedSolution:
      "Send the two fastest first, then shuttle the two slowest together so the 5 and 10 share one crossing. 1&2 cross (2), 1 returns (1), 5&10 cross (10), 2 returns (2), 1&2 cross (2). Total = 2 + 1 + 10 + 2 + 2 = 17. The key insight is pairing the two slow people so 10 is not paid twice.",
    provenance: {
      firm: "Two Sigma",
      genre: "bridge-and-torch optimization puzzle",
    },
    tags: ["optimization", "scheduling", "logic"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-bt-004",
    prompt:
      "You have 8 identical-looking coins; exactly one is slightly heavier. Using a balance scale, what is the minimum number of weighings that guarantees you find the heavy coin, and how?",
    category: "brainteasers",
    difficulty: "medium",
    answer: 2,
    workedSolution:
      "Split into groups of 3, 3, 2. Weigh the two 3-groups. If they balance, the heavy coin is in the leftover pair — weigh those two to find it (2nd weighing). If one 3-group is heavier, take its three coins and weigh any two of them: if one is heavier that's it, if they balance it's the third. Either branch finishes in 2 weighings.",
    provenance: {
      genre: "balance-scale search puzzle",
    },
    tags: ["search", "balance-scale", "information", "logic"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-bt-005",
    prompt:
      "You have 1000 numbered bottles of wine, exactly one of which is poisoned. Test strips take an hour to react and show poison. With only one hour before a banquet, what is the minimum number of test strips needed to identify the poisoned bottle?",
    category: "brainteasers",
    difficulty: "hard",
    answer: 10,
    workedSolution:
      "Number each bottle 0–999 in binary (10 bits, since 2¹⁰ = 1024 ≥ 1000). Assign one test strip to each bit position; strip i tastes a drop from every bottle whose i-th bit is 1. After one hour, read which strips react: those bits form the binary index of the poisoned bottle. So 10 strips suffice.",
    provenance: {
      firm: "Google / quant crossover",
      genre: "binary-encoding poison puzzle",
    },
    tags: ["binary-encoding", "information", "logic"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-bt-006",
    prompt:
      "You have two identical eggs and a 100-floor building. An egg breaks if dropped from floor H or above and survives below it. What is the minimum number of drops that guarantees finding H in the worst case?",
    category: "brainteasers",
    difficulty: "hard",
    answer: 14,
    workedSolution:
      "With the first egg use decreasing step sizes so total drops stay flat. Drop from 14, then 14+13=27, then 39, 50, 60, ... each step one smaller. Choosing the largest k with k(k+1)/2 ≥ 100 gives k = 14 (14·15/2 = 105 ≥ 100). If the first egg breaks after j jumps, the second egg linearly scans the (14 − j) floors below, and the worst case is always 14.",
    provenance: {
      firm: "Bloomberg / quant crossover",
      genre: "two-egg drop optimization",
    },
    tags: ["optimization", "worst-case", "logic"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-bt-007",
    prompt:
      "At a party of 20 people, everyone shakes hands with everyone else exactly once. How many handshakes take place in total?",
    category: "brainteasers",
    difficulty: "easy",
    answer: 190,
    workedSolution:
      "Each handshake is an unordered pair of people, so the count is C(20, 2) = 20 × 19 / 2 = 190. (Equivalently each of 20 people shakes 19 others = 380 endpoints, and each handshake has 2 endpoints, so 380 / 2 = 190.)",
    provenance: {
      genre: "combinatorial counting (handshakes)",
    },
    tags: ["combinatorics", "counting", "pairs"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-bt-008",
    prompt:
      "You have an unmarked 3-liter jug and an unmarked 5-liter jug and a tap. How do you measure out exactly 4 liters?",
    category: "brainteasers",
    difficulty: "medium",
    answer: "4 liters in the 5-liter jug",
    workedSolution:
      "Fill the 5-jug and pour into the 3-jug until full, leaving 2 liters in the 5-jug. Empty the 3-jug and pour those 2 liters into it. Refill the 5-jug and pour into the 3-jug (which needs only 1 more liter to fill), leaving exactly 4 liters in the 5-jug.",
    provenance: {
      genre: "water-jug measurement puzzle",
    },
    tags: ["construction", "state-search", "logic"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
];
