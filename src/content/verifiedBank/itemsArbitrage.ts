import type { VerifiedItem } from "./schema";

/**
 * Arbitrage / no-arbitrage items — spotting locked-in edge from mispriced
 * relationships. Worked solutions build the exact replicating trade and net the
 * cash flows to show the risk-free profit (or prove none exists).
 */
export const ARBITRAGE_ITEMS: VerifiedItem[] = [
  {
    id: "vb-ar-001",
    prompt:
      "Spot quotes are EUR/USD = 1.10 (1 EUR buys 1.10 USD), USD/GBP = 0.80 (1 USD buys 0.80 GBP), and EUR/GBP = 0.85 (1 EUR buys 0.85 GBP). Is there a triangular arbitrage, and if so what is the profit per euro cycled?",
    category: "arbitrage",
    difficulty: "hard",
    answer: "Yes — about 0.03 GBP profit per euro",
    workedSolution:
      "The implied cross from the first two rates is 1 EUR = 1.10 USD = 1.10 × 0.80 = 0.88 GBP, but the market quotes EUR/GBP at only 0.85 — euros are cheap in GBP terms. Arbitrage: use 0.85 GBP to buy 1 EUR at the market cross, convert EUR → 1.10 USD → 0.88 GBP. You end with 0.88 GBP having spent 0.85, a risk-free 0.03 GBP per euro (before costs).",
    provenance: {
      firm: "FX desk",
      genre: "triangular FX arbitrage",
    },
    tags: ["fx", "triangular-arbitrage", "cross-rate", "no-arbitrage"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-ar-002",
    prompt:
      "With interest rates at zero, a stock trades at $100. A 1-year call and put, both struck at $100, trade at $5 and $6 respectively. Is there an arbitrage, and what trade captures it?",
    category: "arbitrage",
    difficulty: "hard",
    answer: "Yes — the put is $1 rich; lock in $1 risk-free",
    workedSolution:
      "Put-call parity (r = 0) says C + K = P + S, i.e. call + strike-cash should equal put + stock. Here C + K = 5 + 100 = 105 but P + S = 6 + 100 = 106, so the (put + stock) side is $1 overpriced. Sell that side and buy the cheap side: sell the put, short the stock, buy the call, and set aside $100. At expiry the call/put/stock legs offset exactly regardless of price, leaving the initial $1 difference as risk-free profit.",
    provenance: {
      firm: "SIG",
      round: "options interview",
      genre: "put-call parity violation",
    },
    tags: ["options", "put-call-parity", "no-arbitrage", "replication"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-ar-003",
    prompt:
      "A non-dividend stock trades at $100 and the 1-year continuously-compounded rate is 5%. A 1-year forward on the stock is quoted at $108. Is it mispriced, and how do you arbitrage it?",
    category: "arbitrage",
    difficulty: "hard",
    answer: "Yes — fair forward ≈ $105.13; sell the forward and carry the stock for ≈ $2.87",
    workedSolution:
      "The no-arbitrage forward is F = S·e^{rT} = 100 × e^{0.05} ≈ $105.13. The quoted $108 is too high, so do a cash-and-carry: sell the forward at 108, borrow $100 to buy the stock spot, and hold it. At delivery you hand over the stock, receive $108, and repay the loan of 100·e^{0.05} ≈ 105.13, netting ≈ $2.87 risk-free.",
    provenance: {
      genre: "cost-of-carry / cash-and-carry arbitrage",
    },
    tags: ["forwards", "cost-of-carry", "cash-and-carry", "no-arbitrage"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-ar-004",
    prompt:
      "The same stock is showing 50.00 bid / 50.02 ask on exchange A and 50.05 bid / 50.07 ask on exchange B at the same instant. Ignoring fees, is there an arbitrage and what is the per-share profit?",
    category: "arbitrage",
    difficulty: "medium",
    answer: "Yes — buy on A at 50.02, sell on B at 50.05: +$0.03/share",
    workedSolution:
      "Cross-exchange arbitrage exists when you can buy where the ask is below where you can sell (the bid). Here A's ask (50.02) is below B's bid (50.05), so buy on A at 50.02 and simultaneously sell on B at 50.05 for a locked-in $0.03 per share. In practice this edge is tiny and fleeting — fees, latency, and fill risk are exactly why it usually vanishes.",
    provenance: {
      firm: "HFT desk",
      genre: "cross-venue latency arbitrage",
    },
    tags: ["cross-exchange", "latency", "bid-ask", "arbitrage"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-ar-005",
    prompt:
      "A bookmaker offers decimal odds of 2.10 on each side of a two-outcome match (a $1 winning bet returns $2.10 total). Can you guarantee a profit betting both sides, and how much?",
    category: "arbitrage",
    difficulty: "medium",
    answer: "Yes — implied probabilities sum to ≈ 0.952 < 1, a ≈ 5% arbitrage",
    workedSolution:
      "Each side's implied probability is 1/2.10 ≈ 0.476, and they sum to ≈ 0.952. Because that is below 1, the book has negative overround and both sides can be backed profitably. Stake proportional to the odds — e.g. $50 on each side ($100 total). Whichever side wins pays 50 × 2.10 = $105, a guaranteed $5 (≈ 5%) profit regardless of outcome.",
    provenance: {
      genre: "Dutch-book / betting-odds arbitrage",
    },
    tags: ["dutch-book", "implied-probability", "overround", "arbitrage"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-ar-006",
    prompt:
      "A European call option on a stock is quoted at a price HIGHER than the current stock price. Why is this an immediate arbitrage, and what do you do?",
    category: "arbitrage",
    difficulty: "medium",
    answer: "A call can never be worth more than the stock; sell the call, buy the stock",
    workedSolution:
      "A call's payoff is max(S_T − K, 0) ≤ S_T, so its value can never exceed the current stock price S (the stock dominates the call in every state). If the call trades above S, sell the call and buy the stock with part of the proceeds, pocketing the difference now. At expiry: if the call is exercised you deliver the stock and receive K > 0; if it expires worthless you still hold the stock — you can never lose, so the upfront credit is risk-free.",
    provenance: {
      genre: "option price-bound (no-arbitrage upper bound)",
    },
    tags: ["options", "no-arbitrage", "price-bounds", "dominance"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-ar-007",
    prompt:
      "An ETF that holds a fixed basket of stocks trades at $99.50, while the live value of its underlying basket (its NAV) is $100.00. Assuming you can create/redeem shares at NAV, how do you arbitrage the gap?",
    category: "arbitrage",
    difficulty: "hard",
    answer: "Buy the cheap ETF, redeem for the $100 basket: +$0.50/share",
    workedSolution:
      "The ETF is trading at a $0.50 discount to the value of what it holds. Buy ETF shares at 99.50 and simultaneously short the underlying basket at 100.00 to lock the spread; then use the creation/redemption mechanism to redeem the ETF shares for the actual basket, which covers your short. You capture the $0.50 discount per share. This creation/redemption arbitrage is exactly what keeps ETF prices pinned to NAV.",
    provenance: {
      firm: "ETF market maker",
      genre: "ETF NAV / creation-redemption arbitrage",
    },
    tags: ["etf", "nav", "creation-redemption", "basket", "arbitrage"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
  {
    id: "vb-ar-008",
    prompt:
      "Bond X pays $100 in exactly one year and nothing else. Bond Y pays $100 in exactly two years and nothing else. X trades at $96 and Y trades at $90. A dealer offers to buy a two-year $100 zero from you at $93. Is there an arbitrage?",
    category: "arbitrage",
    difficulty: "hard",
    answer: "Yes — sell the dealer the 2-year zero at $93 and hedge with Y at $90: +$3 risk-free",
    workedSolution:
      "Bond Y IS a two-year $100 zero, and it is available at $90. The dealer will pay you $93 for the identical cash flow. Sell the dealer that instrument for $93 and buy Bond Y for $90 to deliver the promised $100 in two years. The Y you hold exactly funds the obligation, so you keep the $93 − $90 = $3 difference risk-free. (Bond X is a distractor — the one-year rate is irrelevant to matching a two-year cash flow.)",
    provenance: {
      genre: "fixed-income replication (identical cash flows)",
    },
    tags: ["fixed-income", "zero-coupon", "replication", "no-arbitrage"],
    verifiedBy: "quant-trader-prep content team",
    distinctnessReviewed: true,
  },
];
