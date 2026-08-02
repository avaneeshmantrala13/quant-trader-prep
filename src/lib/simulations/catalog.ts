/**
 * ============================================================================
 *  SIMULATIONS / VISUALIZATIONS — CENTRAL CATALOG (single source of truth)
 * ============================================================================
 * The Simulations tab (`/simulations`) is a themed gallery of interactive,
 * seedable probability visualizations. This module is the ONE place that names
 * every simulation: a stable `id` (also its in-page DOM anchor and URL hash),
 * a human title, the display GROUP it lives in, the content `topics` (matching
 * `Level.section` strings) it helps with, and a one-line "what this shows".
 *
 * Everything that references a simulation — the page's index, each group
 * component, and the hint ladder's "open the exact sim" deep link (Subtask B4)
 * — resolves it through this catalog, so ids never drift. Pure data + helpers,
 * no React, unit-tested in `catalog.test.ts`.
 */

/** The display groups the gallery is organized into (index + section headers). */
export type SimGroupId =
  | "core"
  | "distributions"
  | "joint-distributions"
  | "ev-processes"
  | "real-world"
  | "games"
  | "trading-desk";

export interface SimGroupMeta {
  id: SimGroupId;
  title: string;
  /** Short section blurb shown under the group heading. */
  blurb: string;
}

export interface SimMeta {
  /** Stable id — also the DOM `id` anchor and the `/simulations#<id>` hash. */
  id: string;
  /** Human-friendly title shown on the sim card + index. */
  title: string;
  /** Which display group renders this sim. */
  group: SimGroupId;
  /**
   * Content sections this sim illustrates. Values match `Level.section` strings
   * (e.g. "Core Probability", "Conditional Probability") so other systems can
   * map a topic → its best visualization. May be empty for purely generic sims.
   */
  topics: string[];
  /** One-line, self-explanatory "what this shows" caption. */
  whatShows: string;
}

export const SIM_GROUPS: SimGroupMeta[] = [
  {
    id: "core",
    title: "Core Probability",
    blurb:
      "Flip, roll, and count. Set the parameters, run trials, and watch the empirical result settle onto the true probability.",
  },
  {
    id: "distributions",
    title: "Distributions & the Central Limit Theorem",
    blurb:
      "Where randomness piles up. Sampling distributions, the bell curve emerging from averages, and the behaviour of extremes.",
  },
  {
    id: "joint-distributions",
    title: "Joint Distributions",
    blurb:
      "Two variables at once. See a joint density surface over the plane and take its double integral over a region — the volume under the surface, i.e. the probability that BOTH quantities land in that range together.",
  },
  {
    id: "ev-processes",
    title: "Expected Value, Betting & Processes",
    blurb:
      "The long run. Running averages converging to E[X], Kelly bankroll growth, and step-by-step random processes.",
  },
  {
    id: "real-world",
    title: "Real-World Scenarios",
    blurb:
      "The same math, with money on the line. Trade a random-walk stock and read poker pot odds — see how expected value, random walks, and Markov regimes decide the right call, and watch the empirical result converge to the theory.",
  },
  {
    id: "games",
    title: "Conditional Probability, Geometry & Games",
    blurb:
      "Where intuition breaks. Bayes, Monty Hall, geometric area demos, and strategic games — simulated until they click.",
  },
  {
    id: "trading-desk",
    title: "Trading Desk — Live Markets",
    blurb:
      "Play the desk. Tune a market-making policy and stream a live, path-dependent market — quote two-sided, manage inventory and P&L, and get scored on cumulative P&L and max drawdown against a benchmark desk. The live companions to the Interview Games market-making, de-vig and ETF/NAV drills.",
  },
];

export const SIMULATIONS: SimMeta[] = [
  /* ---- GROUP: core ------------------------------------------------------- */
  {
    id: "coin-flips",
    title: "Coin Flips (Any Bias)",
    group: "core",
    topics: ["Core Probability"],
    whatShows:
      "Flip a coin with any P(heads) and watch the running proportion of heads converge to the true probability.",
  },
  {
    id: "dice-rolls",
    title: "Dice Rolls (Any Faces)",
    group: "core",
    topics: ["Core Probability", "Combinatorial Analysis"],
    whatShows:
      "Roll an N-sided die many times; the frequency of each face approaches 1/N as the rolls pile up.",
  },
  {
    id: "sample-space",
    title: "Two-Dice Sample Space",
    group: "core",
    topics: ["Core Probability", "Combinatorial Analysis"],
    whatShows:
      "Every equally-likely outcome of two dice as a grid; pick an event and read its probability by counting cells.",
  },
  {
    id: "venn-two-events",
    title: "Venn Diagram: Two Events",
    group: "core",
    topics: ["Core Probability", "Conditional Probability"],
    whatShows:
      "Drag P(A), P(B) and their overlap to see P(A∪B), P(A∩B), P(A|B) and complements update live — with independent vs mutually-exclusive presets.",
  },
  {
    id: "two-independent-events",
    title: "Two Independent Events",
    group: "core",
    topics: ["Core Probability", "Conditional Probability"],
    whatShows:
      "Set P(A) and P(B) for independent events, then simulate one trial many times to watch P(A and B) settle on P(A)·P(B).",
  },

  /* ---- GROUP: distributions --------------------------------------------- */
  {
    id: "binomial",
    title: "Binomial Sampling",
    group: "distributions",
    topics: ["Combinatorial Analysis", "Core Probability", "Expected Value"],
    whatShows:
      "Run n Bernoulli(p) trials many times; the histogram of successes converges to the binomial distribution.",
  },
  {
    id: "clt",
    title: "Central Limit Theorem",
    group: "distributions",
    topics: ["Variance, Covariance & the CLT"],
    whatShows:
      "Average n draws from a lumpy source; as n grows the distribution of the sample mean becomes a smooth bell curve.",
  },
  {
    id: "order-statistics",
    title: "Order Statistics (Min / Max / Median)",
    group: "distributions",
    topics: ["Order Statistics"],
    whatShows:
      "The distribution of the minimum, maximum, or median of n uniforms — see how extremes concentrate near the edges.",
  },

  /* ---- GROUP: joint-distributions --------------------------------------- */
  {
    id: "joint-density-integral",
    title: "Double Integral of a Joint Density",
    group: "joint-distributions",
    topics: ["Joint Distributions"],
    whatShows:
      "A bivariate-normal joint density of two correlated asset returns shown as a heatmap; drag a rectangular region and watch the double integral ∫∫ f dx dy — the probability/volume that BOTH returns land in the box — update live, with a Monte-Carlo scatter converging onto it.",
  },

  /* ---- GROUP: ev-processes ---------------------------------------------- */
  {
    id: "expected-value",
    title: "Expected Value (Long-Run Average)",
    group: "ev-processes",
    topics: ["Expected Value"],
    whatShows:
      "Set the payoffs of a die/coin game; the running average payoff converges to the theoretical expected value.",
  },
  {
    id: "kelly",
    title: "Kelly Betting & Bankroll Growth",
    group: "ev-processes",
    topics: ["Betting & Sizing"],
    whatShows:
      "Compare bankroll growth for under-, full-, and over-Kelly staking to see why full-Kelly maximizes long-run growth.",
  },
  {
    id: "coupon-collector",
    title: "Coupon Collector",
    group: "ev-processes",
    topics: ["Expected Value"],
    whatShows:
      "How many random draws to collect all N coupons? The empirical mean tracks the N·H_N prediction.",
  },
  {
    id: "markov-chain",
    title: "Markov Chain → Stationary Distribution",
    group: "ev-processes",
    topics: ["Markov Chains"],
    whatShows:
      "Set the transition probabilities and watch the state distribution converge to the stationary distribution.",
  },
  {
    id: "gamblers-ruin",
    title: "Gambler's Ruin / Random Walk",
    group: "ev-processes",
    topics: ["Markov Chains"],
    whatShows:
      "Bias, starting stake, and target set the walk; the empirical ruin probability matches the closed-form answer.",
  },

  /* ---- GROUP: real-world ------------------------------------------------- */
  {
    id: "stock-random-walk",
    title: "Stock Trader — Buy, Sell, or Hold?",
    group: "real-world",
    topics: ["Expected Value", "Markov Chains"],
    whatShows:
      "A stock ticks up or down each step with your chosen probabilities; make a buy/sell/hold call, then watch the price path, the distribution of final P&L over many trials, and the per-step drift (EV) that decides the right action.",
  },
  {
    id: "stock-regime-markov",
    title: "Bull & Bear Regimes (Markov Switching)",
    group: "real-world",
    topics: ["Markov Chains", "Expected Value"],
    whatShows:
      "A two-state Markov chain flips the market between a bull regime (upward drift) and a bear regime (downward drift); see how the switching probabilities set the long-run mix of regimes and the stock's overall drift.",
  },
  {
    id: "poker-pot-odds",
    title: "Poker Pot Odds — Call or Fold?",
    group: "real-world",
    topics: ["Expected Value", "Conditional Probability"],
    whatShows:
      "Facing a bet, compare your pot odds to your chance of winning; the EV of calling tells you whether to call or fold, and the empirical win rate over many hands converges to your true equity.",
  },
  {
    id: "poker-hand-equity",
    title: "All-In Equity Showdown",
    group: "real-world",
    topics: ["Expected Value", "Combinatorial Analysis"],
    whatShows:
      "Two hands go all-in; simulate the remaining community cards over many deals and watch the empirical win/tie equity converge to each hand's true probability.",
  },

  /* ---- GROUP: games ----------------------------------------------------- */
  {
    id: "monty-hall",
    title: "Monty Hall",
    group: "games",
    topics: ["Conditional Probability"],
    whatShows:
      "Simulate staying vs switching over many games; switching wins about two-thirds of the time.",
  },
  {
    id: "bayes-natural-frequency",
    title: "Bayes via Natural Frequencies",
    group: "games",
    topics: ["Conditional Probability"],
    whatShows:
      "A base rate plus test accuracy shown as counts out of 1000 — see why a positive test is so often a false alarm.",
  },
  {
    id: "geometric-dartboard",
    title: "Geometric Probability (Dartboard)",
    group: "games",
    topics: ["Geometric Probability"],
    whatShows:
      "Throw uniformly-random darts at a square; the fraction landing inside a shape estimates its area ratio.",
  },
  {
    id: "game-theory-matrix",
    title: "Mixed Strategies (2×2 Zero-Sum)",
    group: "games",
    topics: ["Game Theory & Puzzles"],
    whatShows:
      "Adjust a 2×2 zero-sum payoff matrix to find the game's value and each player's optimal mixed strategy.",
  },

  /* ---- GROUP: trading-desk ---------------------------------------------- */
  {
    id: "basketball-book",
    title: "Basketball — Live Book Management",
    group: "trading-desk",
    topics: ["Market Making", "Adverse Selection", "Inventory"],
    whatShows:
      "Make a two-sided market on a basketball game's final total as it unfolds; tune your spread and inventory skew and get scored on P&L and drawdown vs the desk.",
  },
  {
    id: "marble-winner-markets",
    title: "Marble Olympics — Winner Markets",
    group: "trading-desk",
    topics: ["Market Making", "No-Arbitrage / De-Vig", "Correlated Outcomes"],
    whatShows:
      "Quote correlated winner markets across marble races; renormalize your book to stay arbitrage-free (de-vig) or leak a Dutch book to the arbitrageur, scored vs the arb-free desk.",
  },
  {
    id: "etf-creation-redemption",
    title: "ETF Challenge — Creation / Redemption",
    group: "trading-desk",
    topics: ["Market Making", "ETF / NAV Arbitrage", "Latency"],
    whatShows:
      "Make a market on an ETF while its components move under latency; size your spread to cover the NAV move or get arbitraged, scored on P&L and drawdown vs the desk.",
  },
];

/** Fast lookup by id. */
export const SIM_BY_ID: Record<string, SimMeta> = Object.fromEntries(
  SIMULATIONS.map((s) => [s.id, s]),
);

/** All simulations belonging to a display group, in catalog order. */
export function simsInGroup(group: SimGroupId): SimMeta[] {
  return SIMULATIONS.filter((s) => s.group === group);
}

/** The in-app deep link (route + hash) that scrolls to a given simulation. */
export function simAnchorHref(id: string): string {
  return `/simulations#${id}`;
}
