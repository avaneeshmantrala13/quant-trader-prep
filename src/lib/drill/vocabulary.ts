import { topicKeyOf } from "@/lib/mastery/topicKey";

/**
 * Custom Drill Builder — canonical DRILLABLE topic vocabulary.
 *
 * Each entry is a real `section` that exists in the live content (see
 * `src/content/probabilityStats/index.ts` + the per-track `levels.ts`), paired
 * with the `topicKey` its levels fold mastery into and a set of natural-language
 * aliases the deterministic parser matches against. This is the single source of
 * truth the parser and the optional LLM parser both snap onto — the LLM is never
 * trusted to invent a section; its output is validated against these `sectionKey`s.
 *
 * `sectionKey` is the exact `Level.section` string. `trackId` + `sectionKey`
 * uniquely identify a topic (a section can only live on one track here). Aliases
 * are lowercase; matching is substring/slug-based (see `parseIntent`).
 */
export interface DrillTopic {
  /** Exact `Level.section` string (or `null` for a track's section-less core). */
  sectionKey: string | null;
  /** Track the section's levels live on. */
  trackId: string;
  /** Human label shown in the resolved-spec confirmation. */
  label: string;
  /** Canonical mastery topic key (`${trackId}::${section ?? "_core"}`). */
  topicKey: string;
  /** Lowercase natural-language aliases the parser matches. */
  aliases: string[];
}

function topic(
  trackId: string,
  sectionKey: string | null,
  label: string,
  aliases: string[],
): DrillTopic {
  return {
    trackId,
    sectionKey,
    label,
    topicKey: topicKeyOf(trackId, sectionKey ?? undefined),
    aliases,
  };
}

/**
 * The drillable topics. Order is roughly the teaching order; the parser is
 * order-independent (it collects every alias hit). Aliases are deliberately
 * generous — a learner types "bayes", "conditional", "posterior", we all map
 * them to Conditional Probability.
 */
export const DRILL_TOPICS: DrillTopic[] = [
  topic("probability", "Core Probability", "Core Probability", [
    "core probability",
    "basic probability",
    "probability basics",
    "fundamentals",
    "warm up",
    "warmup",
    "coin",
    "coins",
    "dice",
  ]),
  topic("probability", "Combinatorial Analysis", "Combinatorial Analysis", [
    "combinatorics",
    "combinatorial",
    "counting",
    "permutations",
    "combinations",
    "stars and bars",
    "choose",
    "arrangements",
  ]),
  topic("probability", "Geometric Probability", "Geometric Probability", [
    "geometric probability",
    "geometric prob",
    "areas",
    "area probability",
    "uniform region",
    "meeting problem",
  ]),
  topic("probability", "Conditional Probability", "Conditional Probability", [
    "bayes",
    "bayesian",
    "conditional",
    "conditional probability",
    "posterior",
    "prior",
    "base rate",
    "likelihood",
    "updating",
    "monty hall",
  ]),
  topic("probability", "Expected Value", "Expected Value", [
    "ev",
    "expected value",
    "expectation",
    "fair value",
    "fair price",
    "expected payoff",
    "linearity",
  ]),
  topic(
    "probability",
    "Poisson Distribution & Process",
    "Poisson Distribution & Process",
    [
      "poisson",
      "poisson process",
      "rare events",
      "arrival rate",
      "counts",
    ],
  ),
  topic("probability", "Betting & Sizing", "Betting & Sizing (Kelly)", [
    "kelly",
    "betting",
    "bet sizing",
    "sizing",
    "stake",
    "odds",
    "bankroll",
    "edge",
  ]),
  topic("probability", "Order Statistics", "Order Statistics", [
    "order statistics",
    "order stats",
    "min",
    "max",
    "minimum",
    "maximum",
    "kth largest",
    "median",
  ]),
  topic(
    "probability",
    "Continuous Distributions",
    "Continuous Distributions",
    [
      "continuous",
      "continuous distributions",
      "uniform distribution",
      "exponential",
      "normal distribution",
      "density",
      "pdf",
      "cdf",
    ],
  ),
  topic(
    "probability",
    "Variance, Covariance & the CLT",
    "Variance, Covariance & the CLT",
    [
      "variance",
      "covariance",
      "correlation",
      "clt",
      "central limit",
      "standard deviation",
      "second moment",
      "concentration",
    ],
  ),
  topic("probability", "Markov Chains", "Markov Chains", [
    "markov",
    "markov chain",
    "markov chains",
    "states",
    "recursion",
    "stationary",
    "gambler's ruin",
    "gamblers ruin",
    "random walk",
    "hitting time",
  ]),
  topic("probability", "Brownian Motion", "Brownian Motion", [
    "brownian",
    "brownian motion",
    "wiener",
    "drift",
    "diffusion",
  ]),
  topic(
    "probability",
    "Game Theory & Puzzles",
    "Game Theory & Puzzles",
    [
      "game theory",
      "games",
      "equilibrium",
      "nash",
      "mixed strategy",
      "arbitrage",
      "market making",
      "spread",
    ],
  ),
  // Upstream split the former umbrella "Extra Relevant Knowledge" section into
  // several first-class sections (see `EXTRA_RELEVANT_KNOWLEDGE_TOPIC_KEYS` in
  // `src/lib/mode/visibility.ts`, where they're now only a DISPLAY grouping).
  // We drill each real section directly so the aliases resolve to live MCQ levels.
  topic(
    "probability",
    "Moment Generating Functions",
    "Moment Generating Functions",
    ["mgf", "moment generating", "moment generating function"],
  ),
  topic("probability", "Gamma Distribution", "Gamma Distribution", [
    "gamma",
    "gamma distribution",
  ]),
  topic("probability", "Joint Distributions", "Joint Distributions", [
    "joint",
    "joint distribution",
    "joint distributions",
    "marginal",
    "jointly distributed",
  ]),
  topic("probability", "Limit Theorems", "Limit Theorems", [
    "limit theorem",
    "limit theorems",
    "law of large numbers",
    "lln",
    "chebyshev",
    "concentration inequality",
  ]),
  topic("probability", "Branching Processes", "Branching Processes", [
    "branching",
    "branching process",
    "galton",
    "extinction",
  ]),
  topic(
    "probability",
    "Continuous-Time Markov Chains",
    "Continuous-Time Markov Chains",
    [
      "continuous time markov",
      "continuous-time markov",
      "ctmc",
      "queues",
      "queueing",
      "birth death",
    ],
  ),
  topic("probability", "Markov Chain Structure", "Markov Chain Structure", [
    "markov chain structure",
    "recurrence",
    "transience",
    "communicating classes",
    "absorbing",
  ]),
  topic(
    "probability",
    "Conditional Expectation",
    "Conditional Expectation",
    [
      "conditional expectation",
      "tower",
      "tower property",
      "law of total expectation",
      "e[x|y]",
    ],
  ),

  // Math Questions track sections.
  topic(
    "math-questions",
    "Rates, Algebra & Word Problems",
    "Rates, Algebra & Word Problems",
    [
      "rates",
      "rate",
      "speed",
      "work",
      "word problems",
      "algebra",
      "distance",
      "mental math word",
    ],
  ),
  topic(
    "math-questions",
    "Number Theory & Counting",
    "Number Theory & Counting",
    [
      "number theory",
      "modular",
      "digits",
      "divisibility",
      "primes",
      "gcd",
      "remainder",
    ],
  ),
  topic(
    "math-questions",
    "Geometry & Derivations",
    "Geometry & Derivations",
    [
      "geometry",
      "derivations",
      "calculus",
      "derivative",
      "integral",
      "proof",
    ],
  ),

  // NOTE: the `brainteasers` track (Core Puzzles, Techniques Toolkit) is
  // intentionally OMITTED — every one of its levels is a `flashcard` level with
  // no MCQ form, and the drill assembler skips flashcard levels (see
  // `matchingLevels` in `assemble.ts`). Listing those sections here would let a
  // learner "build" a drill that always resolves to zero questions, so we don't
  // advertise them. If brainteasers ever gain MCQ levels, add them back here.
];

/** All known section keys (used to validate LLM-proposed sections). */
export const DRILL_TOPIC_KEYS = new Set(
  DRILL_TOPICS.map((t) => t.topicKey),
);

/** Lookup a drill topic by its canonical `topicKey`. */
export function drillTopicByKey(topicKey: string): DrillTopic | undefined {
  return DRILL_TOPICS.find((t) => t.topicKey === topicKey);
}
