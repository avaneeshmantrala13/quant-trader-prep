import type { VerifiedItem } from "./schema";

/**
 * Market-making items — quoting around fair value, edge, width, adverse
 * selection and inventory skew. Worked solutions derive the fair value first,
 * then reason about the trade the way a desk would.
 */
export const MARKET_MAKING_ITEMS: VerifiedItem[] = [
  {
    id: "vb-mk-001",
    prompt:
      "You must make a two-sided market on the sum of two fair dice. What is the fair value you should quote around, and what is a reasonable tight market?",
    category: "market-making",
    difficulty: "easy",
    answer: "Fair value 7; e.g. quote 6.5 bid / 7.5 ask",
    workedSolution:
      "By symmetry the expected sum is 2 × 3.5 = 7, so 7 is fair value. Center a market there; a 1-wide market like 6.5 / 7.5 keeps you tight while leaving edge for adverse selection. You buy at 6.5 (EV +0.5) and sell at 7.5 (EV +0.5) against an uninformed flow.",
    provenance: {
      firm: "Optiver",
      round: "market-making game",
      genre: "quote-around-fair-value",
    },
    tags: ["fair-value", "quoting", "width", "dice"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-mk-002",
    prompt:
      "Make a market on the number of heads in 10 flips of a fair coin. What is fair value, and what is the variance you are exposed to?",
    category: "market-making",
    difficulty: "medium",
    answer: "Fair value 5; variance 2.5 (SD ≈ 1.58)",
    workedSolution:
      "Heads count ~ Binomial(10, 1/2). Mean = np = 10 × 0.5 = 5 → fair value 5. Variance = np(1 − p) = 10 × 0.5 × 0.5 = 2.5, so SD ≈ 1.58. Because outcomes cluster within ~2 of 5, a market like 4 / 6 is defensible; wider if you fear an informed counterparty.",
    provenance: {
      firm: "IMC",
      genre: "binomial fair value + risk sizing",
    },
    tags: ["binomial", "fair-value", "variance", "quoting"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-mk-003",
    prompt:
      "Make a market on the PRODUCT of two fair dice. What is fair value?",
    category: "market-making",
    difficulty: "medium",
    answer: "12.25",
    workedSolution:
      "The two dice are independent, so E[XY] = E[X]·E[Y] = 3.5 × 3.5 = 12.25. Note the product is right-skewed (it can reach 36), so even though fair value is 12.25 you should skew your ask a touch higher to protect against the fat upper tail.",
    provenance: {
      firm: "Jane Street",
      genre: "expectation of a product (independence)",
    },
    tags: ["independence", "expectation", "fair-value", "skew"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-mk-004",
    prompt:
      "A contract pays $100 if a fair coin lands heads and $0 otherwise. You quote a market of 45 bid / 55 ask. A counterparty SELLS to you at 45. What is your expected profit on the trade?",
    category: "market-making",
    difficulty: "easy",
    answer: "+$5",
    workedSolution:
      "Fair value of the contract is 0.5 × 100 = $50. You bought it for $45, so expected profit = 50 − 45 = $5. Your 10-wide market (45/55) is symmetric around the true 50, giving you $5 of theoretical edge on either side.",
    provenance: {
      genre: "edge on a binary payoff quote",
    },
    tags: ["edge", "fair-value", "binary-payoff", "quoting"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-mk-005",
    prompt:
      "You quote a two-sided market and a counterparty is free to buy OR sell at your prices. Why should you widen your quotes when you suspect the counterparty is better informed than you?",
    category: "market-making",
    difficulty: "hard",
    answer: "To offset adverse selection — informed flow only trades your worse side",
    workedSolution:
      "An informed trader trades only when your price is wrong in their favor: they lift your ask when true value is above it and hit your bid when it is below. So your realized fill is systematically the losing side, not a random one. Widening the market raises the edge required before they trade, shrinking their information advantage. This is the adverse-selection (winner's-curse) tax every market maker pays.",
    provenance: {
      firm: "SIG",
      round: "concept interview",
      genre: "adverse selection reasoning",
    },
    tags: ["adverse-selection", "winners-curse", "width", "information"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-mk-006",
    prompt:
      "Fair value of a name is 100 and you normally quote 99 / 101. You are already long a large inventory and want to reduce it. How should you adjust (skew) your quotes, and why?",
    category: "market-making",
    difficulty: "medium",
    answer: "Skew both quotes DOWN, e.g. 98 / 100, to encourage selling and discourage buying",
    workedSolution:
      "Lowering both bid and ask (say to 98 / 100) makes your ask more attractive so counterparties buy from you (you sell inventory), while your less-attractive bid discourages you from buying more. You give up a little theoretical edge to cut position risk — trading fair-value edge for inventory control, exactly the tradeoff a desk manages continuously.",
    provenance: {
      genre: "inventory skew / quote management",
    },
    tags: ["inventory", "skew", "quoting", "risk-management"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-mk-007",
    prompt:
      "Make a market on the value of a single card drawn from a standard 52-card deck, where Ace = 1 up to King = 13. What is fair value?",
    category: "market-making",
    difficulty: "easy",
    answer: 7,
    workedSolution:
      "Each rank 1–13 is equally likely (four suits each), so the mean equals the mean of 1..13 = (1 + 13)/2 = 7. Fair value is 7; a tight market of 6 / 8 quotes symmetrically around it.",
    provenance: {
      genre: "uniform fair value (card rank)",
    },
    tags: ["fair-value", "uniform", "cards", "quoting"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-mk-008",
    prompt:
      "You buy 200 lots at your bid of 49 on a contract whose fair value is 50, then immediately sell 200 lots at your ask of 51. What is your total theoretical profit, and where did it come from?",
    category: "market-making",
    difficulty: "easy",
    answer: "$400 (200 × $2 round-trip edge)",
    workedSolution:
      "Your bid is 1 below fair (edge +1 per lot bought) and your ask is 1 above fair (edge +1 per lot sold), so a full round trip earns the 2-wide spread. Across 200 lots: 200 × (51 − 49) = 200 × 2 = $400. The profit is the bid-ask spread you captured by providing liquidity on both sides at fair value.",
    provenance: {
      genre: "spread capture / round-trip PnL",
    },
    tags: ["spread", "edge", "pnl", "round-trip"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
];
