import { topicKeyOf } from "@/lib/mastery/topicKey";
import { TRADING_SUBTOPICS } from "@/lib/mastery/tradingSubtopics";

/**
 * THE SKILL GRAPH — the ordered, prerequisite-respecting pathway that turns the
 * app's sprawling catalog into a single "what to do next / how ready am I" story.
 *
 * This is PURE data + helpers (no React, no progress) so it can be unit-tested
 * and reused by the roadmap page, the dashboard link, and the diagnostic
 * blueprint. Every node is one Phase-1 mastery topic (`topicKeyOf(trackId,
 * section)`), so a skill's progress reads the SAME bucket the mastery layer
 * writes.
 *
 * Ordering provenance (see `datasets/CURRICULUM_ROADMAP.md`): UT Austin
 * **M362K — Intro to Probability & Statistics** (Ross chs. 1–8: counting →
 * axioms/sample space → conditional/Bayes → expectation → variance/covariance →
 * CLT) and **M362M — Intro to Stochastic Processes** (prereq M362K; random
 * walks / Markov chains / gambler's ruin live downstream of conditional
 * probability + expectation), plus the quant-interview canon (Green Book;
 * Optiver/Jane Street timed mental-math screens as the Tier-0 gate; EV decision
 * games, optimal stopping, market making, and Kelly sizing as applications).
 *
 * The prerequisite edges are a strict SUPERSET of the remediation DAG
 * (`src/content/remediation/prereqDAG.ts`): L0 arithmetic → L1 meaning →
 * counting → {conditional, expectation}. We keep those edges and extend them to
 * every topic — including the seven first-class course-completeness topics (MGF,
 * Gamma, Joint Distributions, Limit Theorems, Branching, CTMC, Markov Chain
 * Structure) that were formerly folded into one "Extra Relevant Knowledge" node.
 */

/** Pathway tiers, coarse → advanced. `order` is the render/sort order. */
export interface SkillTierMeta {
  id: string;
  label: string;
  blurb: string;
  order: number;
}

export const SKILL_TIERS: Record<string, SkillTierMeta> = {
  foundations: {
    id: "foundations",
    label: "Foundations · Speed & Algebra",
    blurb:
      "The timed arithmetic screen most firms gate on, plus the algebraic fluency M362K assumes (M408 prerequisite).",
    order: 0,
  },
  probability: {
    id: "probability",
    label: "Probability Foundations",
    blurb:
      "M362K chs. 1–3: counting, the meaning of probability & sample space, and conditional probability / Bayes.",
    order: 1,
  },
  expectation: {
    id: "expectation",
    label: "Expectation, Distributions & Variability",
    blurb:
      "M362K chs. 4–8: expected value, continuous measure, order statistics, and variance/covariance up to the CLT.",
    order: 2,
  },
  processes: {
    id: "processes",
    label: "Stochastic Processes & Trading Applications",
    blurb:
      "M362M + the desk: Kelly sizing, Markov chains / random walks, EV decision games, and market making.",
    order: 3,
  },
  synthesis: {
    id: "synthesis",
    label: "Synthesis · Puzzles & Problem-Solving",
    blurb:
      "Cross-cutting brainteasers that reward structuring an unfamiliar problem under pressure.",
    order: 4,
  },
};

/** One node in the skill graph. */
export interface SkillNode {
  /** Phase-1 mastery topicKey (`${trackId}::${section ?? "_core"}`). */
  topicKey: string;
  /** Learner-facing skill name. */
  label: string;
  trackId: string;
  /** First level of the topic — the deep-link target for "practice this". */
  firstLevelId: string;
  /** Pathway tier id (key into {@link SKILL_TIERS}). */
  tier: string;
  /** Prerequisite topicKeys (must all be mastered to be "available"). */
  prereqs: string[];
  /** Interview-readiness importance weight (1–3). Higher = counts more. */
  weight: number;
  /** Short academic/canon justification for placement. */
  source: string;
  /**
   * COURSE-COMPLETENESS ONLY (default: scored). When explicitly `false`, this
   * node is present in the graph/roadmap (and the Case-A course-mode diagnostic)
   * for M362K/M362M completeness, but is EXCLUDED from the quant-interview SCORED
   * set (`scoredContentTopicKeys`) — so it does NOT gate greenlight, is NOT probed
   * by the untimed interview diagnostic, and is NOT drilled by the pipeline. Set
   * on the purely-academic distribution/process-theory topics with no attested
   * OA/interview footprint (MGF, Gamma, Joint Distributions, Limit Theorems, CTMC
   * — see `datasets/UT_COURSE_GAP_ANALYSIS.md` §4 "largely academic"). Genuinely
   * interview-relevant advanced topics (Markov Chains, Markov Chain Structure /
   * stationary distributions, Branching, Brownian) stay scored.
   */
  scored?: boolean;
  /**
   * EXTERNAL timed-drill / game topic (Speed Arena, Sequences, No-Arbitrage,
   * Fermi, EV-under-time, Auctions) whose `Level`s are authored but NOT yet
   * registered into a playable track. Mirrored here so the remediation prereq
   * DAG (a strict subset of this graph) can route a bombed drill to a real
   * prerequisite. Its `firstLevelId` points at the authored content level for the
   * future integrator, but does not resolve via `getLevel` until wired in — so
   * the "references a REAL first level" invariant skips external nodes.
   */
  external?: boolean;
}

/* -- Topic key constants (all resolve to REAL mastery buckets + levels) ----- */
const MENTAL = topicKeyOf("mental-math");
const RATES = topicKeyOf("math-questions", "Rates, Algebra & Word Problems");
const COMBINATORICS = topicKeyOf("probability", "Combinatorial Analysis");
const NUMBER_THEORY = topicKeyOf("math-questions", "Number Theory & Counting");
const CORE_PROB = topicKeyOf("probability", "Core Probability");
const CONDITIONAL = topicKeyOf("probability", "Conditional Probability");
const EXPECTED_VALUE = topicKeyOf("probability", "Expected Value");
const CONDITIONAL_EXPECTATION = topicKeyOf(
  "probability",
  "Conditional Expectation",
);
const GEOMETRIC = topicKeyOf("probability", "Geometric Probability");
const GEOMETRY = topicKeyOf("math-questions", "Geometry & Derivations");
const ORDER_STATS = topicKeyOf("probability", "Order Statistics");
const VARIANCE_CLT = topicKeyOf("probability", "Variance, Covariance & the CLT");
const BETTING = topicKeyOf("probability", "Betting & Sizing");
const MARKOV = topicKeyOf("probability", "Markov Chains");
// UT M362K/M362M coverage additions (datasets/UT_TOPICS_BUILD_PLAN.md).
const POISSON = topicKeyOf("probability", "Poisson Distribution & Process");
const CONTINUOUS = topicKeyOf("probability", "Continuous Distributions");
const BROWNIAN = topicKeyOf("probability", "Brownian Motion");
// The seven first-class course-completeness topics (formerly one "Extra
// Relevant Knowledge" super-node).
const MGF = topicKeyOf("probability", "Moment Generating Functions");
const GAMMA = topicKeyOf("probability", "Gamma Distribution");
const JOINT = topicKeyOf("probability", "Joint Distributions");
const LIMIT_THEOREMS = topicKeyOf("probability", "Limit Theorems");
const BRANCHING = topicKeyOf("probability", "Branching Processes");
const CTMC = topicKeyOf("probability", "Continuous-Time Markov Chains");
const MARKOV_STRUCTURE = topicKeyOf("probability", "Markov Chain Structure");
const INTERVIEW_GAMES = topicKeyOf("interview-games");
const GAME_THEORY = topicKeyOf("probability", "Game Theory & Puzzles");
const BT_CORE = topicKeyOf("brainteasers", "Core Puzzles");
const BT_TECHNIQUES = topicKeyOf("brainteasers", "Techniques Toolkit");
// External timed-drill / game topics (authored but not registered into a track;
// mirrored from the remediation DAG so its edges stay a subset of this graph).
const SEQUENCES = topicKeyOf("sequences", "Sequences & Pattern Recognition");
const ARBITRAGE = topicKeyOf("arbitrage", "No-Arbitrage");
const FERMI = topicKeyOf("fermi");
const EV_TIMED = topicKeyOf("ev-timed");
const ARENA = topicKeyOf("arena");
const AUCTIONS = topicKeyOf("auctions");
/**
 * The two NEW first-class COMPETENCY nodes (spec §3.2 / RESOLVED DECISIONS §10.2,
 * §10.8). They are gated to pass Stage 6 but have NO in-place probe ladder of
 * their own: brainteaser-reasoning is fed by self-eval / objectively-graded
 * flashcards, and trading-intuition by the market-making game verdict — both via
 * the competency scorer (`src/lib/mastery/competency.ts`), which folds a computed
 * `credit ∈ [0,1]` through the SAME `applyItemAttempt`/Beta path every other node
 * uses. Because they carry no resolvable content level, they are marked
 * `external: true` so the "references a REAL first level" invariant SKIPS them
 * (exactly like the timed-drill / game stubs above). Their literal topicKeys
 * MUST equal `COMPETENCY_BRAINTEASER` / `COMPETENCY_TRADING` in
 * `src/lib/pipeline/gates.ts` (asserted in `skillGraph.test.ts`) so the P0 gate
 * stubs read the very buckets the scorer feeds.
 */
export const COMPETENCY_BRAINTEASER = topicKeyOf(
  "competency",
  "brainteaser-reasoning",
);
export const COMPETENCY_TRADING = topicKeyOf("competency", "trading-intuition");

/**
 * The pathway, in curriculum order. Order within a tier is easiest→hardest and
 * matches the app's own content data order where they overlap.
 */
export const SKILL_GRAPH: SkillNode[] = [
  // --- Tier 0: Foundations ---
  {
    topicKey: MENTAL,
    label: "Mental Arithmetic",
    trackId: "mental-math",
    firstLevelId: "mm-1",
    tier: "foundations",
    prereqs: [],
    weight: 3,
    source:
      "Quant canon: timed mental-arithmetic sprints (Zetamac-style) are the first screen most firms gate on. Also the remediation DAG's L0 arithmetic floor.",
  },
  {
    topicKey: RATES,
    label: "Rates, Algebra & Word Problems",
    trackId: "math-questions",
    firstLevelId: "mq-1",
    tier: "foundations",
    prereqs: [],
    weight: 2,
    source:
      "Algebraic fluency M362K assumes via its M408 (calculus) prerequisite; translating words to equations under time pressure.",
  },
  // --- Tier 1: Probability Foundations (M362K chs. 1–3) ---
  {
    topicKey: COMBINATORICS,
    label: "Counting & Combinatorics",
    trackId: "probability",
    firstLevelId: "ca-1",
    tier: "probability",
    prereqs: [MENTAL],
    weight: 2,
    source: "M362K ch. 1 (combinatorial analysis) — the counting the axioms build on.",
  },
  {
    topicKey: NUMBER_THEORY,
    label: "Number Theory & Counting",
    trackId: "math-questions",
    firstLevelId: "mq-4",
    tier: "probability",
    prereqs: [MENTAL],
    weight: 1,
    source:
      "Series, multiples, and doubling growth — structural counting that reinforces combinatorics.",
  },
  {
    topicKey: CORE_PROB,
    label: "Meaning of Probability & Sample Space",
    trackId: "probability",
    firstLevelId: "pr-1",
    tier: "probability",
    prereqs: [MENTAL],
    weight: 3,
    source:
      "M362K ch. 2 (axioms of probability, sample spaces, unions/inclusion–exclusion, independence). The remediation DAG's L1 floor.",
  },
  {
    topicKey: CONDITIONAL,
    label: "Conditional Probability & Bayes",
    trackId: "probability",
    firstLevelId: "cp-1",
    tier: "probability",
    prereqs: [CORE_PROB, COMBINATORICS],
    weight: 3,
    source:
      "M362K ch. 3 (conditional probability, independence, Bayes). Builds on the meaning of probability + reduced-sample-space counting.",
  },
  // --- Tier 2: Expectation, Distributions & Variability (M362K chs. 4–8) ---
  {
    topicKey: EXPECTED_VALUE,
    label: "Expected Value",
    trackId: "probability",
    firstLevelId: "ev-1",
    tier: "expectation",
    prereqs: [CORE_PROB, COMBINATORICS],
    weight: 3,
    source:
      "M362K chs. 4.4–4.5, 7 (expectation of discrete RVs; the probability-weighted sum). The desk's language for pricing every bet.",
  },
  {
    topicKey: CONDITIONAL_EXPECTATION,
    label: "Conditional Expectation & the Tower Rule",
    trackId: "probability",
    firstLevelId: "ce-1",
    tier: "expectation",
    prereqs: [EXPECTED_VALUE, CONDITIONAL],
    weight: 2,
    source:
      "M362M ch. 1 (conditional expectation E[X|Y], the tower rule / law of total expectation, random sums via Wald, and the law of total variance). Builds on expectation + conditioning; shared with the M362K expectation chapter.",
  },
  {
    topicKey: CONTINUOUS,
    label: "Continuous Distributions",
    trackId: "probability",
    firstLevelId: "cd-1",
    tier: "expectation",
    prereqs: [EXPECTED_VALUE],
    weight: 2,
    source:
      "M362K ch. 5 (continuous RVs via PDFs/CDFs & integration; Uniform/Exponential/Normal). The taught density unit behind the CLT's Φ(z) and the exponential interarrivals of the Poisson process.",
  },
  {
    topicKey: POISSON,
    label: "Poisson Distribution & Process",
    trackId: "probability",
    firstLevelId: "po-1",
    tier: "expectation",
    // Poisson-PROCESS depth (po-2/po-3: exponential interarrivals, waiting
    // times) leans on the exponential density taught in Continuous Distributions.
    prereqs: [EXPECTED_VALUE, CONTINUOUS],
    weight: 2,
    source:
      "M362K ch. 4.7 + M362M Poisson-process core (arrivals, splitting/superposition). Interview-relevant rare-event modelling; builds on E[X]=λ and exponential interarrivals.",
  },
  {
    topicKey: GEOMETRIC,
    label: "Geometric Probability",
    trackId: "probability",
    firstLevelId: "geo-1",
    tier: "expectation",
    prereqs: [CORE_PROB],
    weight: 1,
    source:
      "M362K ch. 5 (continuous / uniform RVs) — favourable measure ÷ total; a gentle continuous-probability idea.",
  },
  {
    topicKey: GEOMETRY,
    label: "Geometry & Derivations",
    trackId: "math-questions",
    firstLevelId: "mq-5",
    tier: "expectation",
    prereqs: [RATES],
    weight: 1,
    source:
      "Clean-number geometry and multi-step derivations — precision under time pressure.",
  },
  {
    topicKey: ORDER_STATS,
    label: "Order Statistics",
    trackId: "probability",
    firstLevelId: "os-1",
    tier: "expectation",
    prereqs: [EXPECTED_VALUE],
    weight: 1,
    source:
      "M362K ch. 6 (jointly distributed RVs) — min/max/median of several draws; expected extremes.",
  },
  {
    topicKey: VARIANCE_CLT,
    label: "Variance, Covariance & the CLT",
    trackId: "probability",
    firstLevelId: "vc-1",
    tier: "expectation",
    prereqs: [EXPECTED_VALUE],
    weight: 2,
    source:
      "M362K chs. 7–8 (second moments, covariance, Markov/Chebyshev bounds, the Central Limit Theorem).",
  },
  // --- Tier 3: Stochastic Processes & Trading Applications (M362M + canon) ---
  {
    topicKey: BETTING,
    label: "Betting & Sizing (Kelly)",
    trackId: "probability",
    firstLevelId: "bs-1",
    tier: "processes",
    prereqs: [EXPECTED_VALUE],
    weight: 2,
    source:
      "Green Book money management — Kelly is a focused application of EV + odds fluency.",
  },
  {
    topicKey: MARKOV,
    label: "Markov Chains & Random Walks",
    trackId: "probability",
    firstLevelId: "mc-1",
    tier: "processes",
    // First-step analysis / hitting times are tower-rule (E[·|·]) arguments, so
    // Conditional Expectation is a genuine prerequisite alongside conditioning + EV.
    prereqs: [CONDITIONAL, EXPECTED_VALUE, CONDITIONAL_EXPECTATION],
    weight: 2,
    source:
      "M362M core: random walks, gambler's ruin, hitting times, first-step analysis, and stationary/limiting distributions (πP=π) — downstream of conditional probability + expectation + conditional expectation (tower rule).",
  },
  {
    topicKey: BROWNIAN,
    label: "Brownian Motion",
    trackId: "probability",
    firstLevelId: "bm-1",
    tier: "processes",
    prereqs: [MARKOV, CONTINUOUS],
    weight: 2,
    source:
      "M362M (advanced): the continuous-time limit of a random walk — drift + √t variance scaling. Quant-research/derivatives intuition; needs Markov + continuous distributions.",
  },
  {
    topicKey: INTERVIEW_GAMES,
    label: "EV Decision Games & Market Making",
    trackId: "interview-games",
    firstLevelId: "ig-1",
    tier: "processes",
    prereqs: [EXPECTED_VALUE],
    weight: 3,
    source:
      "SIG / Citadel / Jane Street decision genres: re-roll EV, optimal stopping, and two-sided market making with adverse selection.",
  },
  {
    topicKey: GAME_THEORY,
    label: "Game Theory & Puzzles",
    trackId: "probability",
    firstLevelId: "gt-1",
    tier: "processes",
    // Its Kelly/EV-heavy puzzles (gp-1, gt-spread) rest directly on Expected
    // Value, so a direct EV edge is added alongside the Interview-Games edge.
    prereqs: [INTERVIEW_GAMES, EXPECTED_VALUE],
    weight: 1,
    source:
      "Equilibria, mixed strategies, and optimal market-making spread — strategic reasoning on top of EV decision games and Expected Value.",
  },
  // --- Tier 4: Synthesis ---
  {
    topicKey: BT_CORE,
    label: "Brainteasers · Core Puzzles",
    trackId: "brainteasers",
    firstLevelId: "bt-1",
    tier: "synthesis",
    prereqs: [],
    weight: 2,
    source:
      "Logic, weighings, and lateral thinking — structuring an unfamiliar problem out loud, which firms watch closely.",
  },
  {
    topicKey: BT_TECHNIQUES,
    label: "Brainteasers · Techniques Toolkit",
    trackId: "brainteasers",
    firstLevelId: "bt-4",
    tier: "synthesis",
    prereqs: [BT_CORE],
    weight: 1,
    source:
      "Invariants, parity, pigeonhole, and backward induction — the reusable moves behind hard brainteasers.",
  },
  // --- Course-completeness topics (formerly the single "Extra Relevant
  // Knowledge" super-node; now seven first-class topics, each with its own
  // prerequisites). Included for M362K/M362M completeness and the Case-A
  // course-mode diagnostic. Placed last so they never clutter the interview
  // spine. FIVE of them (MGF, Gamma, Joint Distributions, Limit Theorems, CTMC)
  // are `scored: false` — purely academic distribution/process-theory with no
  // attested quant OA/interview footprint (UT_COURSE_GAP_ANALYSIS.md §4), so
  // they stay learnable but are EXCLUDED from the interview scored gate and the
  // untimed diagnostic. Branching and Markov Chain Structure remain scored
  // (branching/PGF puzzles + stationary-distribution / Chapman–Kolmogorov
  // reasoning genuinely appear at top firms). ---
  {
    topicKey: MGF,
    label: "Moment Generating Functions",
    trackId: "probability",
    firstLevelId: "ek-mgf",
    tier: "expectation",
    prereqs: [EXPECTED_VALUE, VARIANCE_CLT],
    weight: 1,
    scored: false,
    source:
      "M362K: moments from M'(0)/M''(0), the uniqueness theorem, and the MGF method for independent sums. Builds on expectation and second moments (variance).",
  },
  {
    topicKey: GAMMA,
    label: "Gamma Distribution",
    trackId: "probability",
    firstLevelId: "ek-gamma",
    tier: "expectation",
    prereqs: [CONTINUOUS],
    weight: 1,
    scored: false,
    source:
      "M362K: Gamma(k,λ) as the sum of k iid Exp(λ) — a continuous density (mean k/λ, variance k/λ²) built directly on Continuous Distributions.",
  },
  {
    topicKey: JOINT,
    label: "Joint Distributions",
    trackId: "probability",
    firstLevelId: "ek-joint",
    tier: "expectation",
    // Double integrals over joint densities build on Continuous Distributions;
    // the discrete pmf conditionals/independence draw on conditioning.
    prereqs: [CONTINUOUS, CONDITIONAL],
    weight: 1,
    scored: false,
    source:
      "M362K chs. 6–7: joint densities/pmfs, marginals, conditionals, independence, covariance, and CDF-method transforms. Rests on continuous integration + conditioning.",
  },
  {
    topicKey: LIMIT_THEOREMS,
    label: "Limit Theorems",
    trackId: "probability",
    firstLevelId: "ek-limit",
    tier: "expectation",
    prereqs: [VARIANCE_CLT],
    weight: 1,
    scored: false,
    source:
      "M362K ch. 8: Chebyshev's inequality, the (weak) Law of Large Numbers, and the formal Central Limit Theorem — a precise treatment on top of variance/covariance & the CLT.",
  },
  {
    topicKey: BRANCHING,
    label: "Branching Processes",
    trackId: "probability",
    firstLevelId: "ek-branching",
    tier: "processes",
    // Extinction via first-step conditioning on the offspring PGF is a
    // conditional-expectation (random-sums) argument.
    prereqs: [EXPECTED_VALUE, CONDITIONAL_EXPECTATION],
    weight: 1,
    source:
      "M362M: Galton–Watson processes — geometric mean growth μⁿ and extinction as the smallest fixed point of q=G(q). Rests on expectation + conditional-expectation (first-step) reasoning.",
  },
  {
    topicKey: CTMC,
    label: "Continuous-Time Markov Chains",
    trackId: "probability",
    firstLevelId: "ek-ctmc",
    tier: "processes",
    // Exponential holding times / birth–death queues need the Poisson process;
    // the jump chain + balance equations extend discrete Markov chains.
    prereqs: [MARKOV, POISSON],
    weight: 1,
    scored: false,
    source:
      "M362M / Ross IPM: exponential holding times, flow balance, and the M/M/1 queue — continuous-time extension of Markov chains built on the Poisson process.",
  },
  {
    topicKey: MARKOV_STRUCTURE,
    label: "Markov Chain Structure",
    trackId: "probability",
    firstLevelId: "ek-markov-pn",
    tier: "processes",
    prereqs: [MARKOV],
    weight: 1,
    source:
      "M362M: the n-step Pⁿ / Chapman–Kolmogorov formalism and state classification (recurrence, transience, periodicity, communication) — the structural theory of Markov chains.",
  },
  // --- External timed-drill / game topics (authored but not yet registered into
  // a playable track). Placed LAST so they never clutter the interview spine, and
  // marked `external` so the "resolves to a real first level" invariant skips
  // them. Their prereqs are all real, earlier nodes, so the DAG-order invariant
  // (prereqs precede dependents) still holds and remediation descent resolves. ---
  {
    topicKey: SEQUENCES,
    label: "Sequences & Pattern Recognition",
    trackId: "sequences",
    firstLevelId: "seq-quiz-foundations",
    tier: "foundations",
    prereqs: [NUMBER_THEORY],
    weight: 1,
    external: true,
    source:
      "OA abstract-reasoning: recover a generating rule (arithmetic/geometric/quadratic differences, series & growth) — structural counting on top of Number Theory.",
  },
  {
    topicKey: ARENA,
    label: "Speed Arena",
    trackId: "arena",
    firstLevelId: "arena-1",
    tier: "foundations",
    prereqs: [MENTAL],
    weight: 1,
    external: true,
    source:
      "Timed mental-arithmetic sprint (Zetamac-style) — a pure speed application of the mental-arithmetic floor.",
  },
  {
    topicKey: FERMI,
    label: "Fermi / Order-of-Magnitude Estimation",
    trackId: "fermi",
    firstLevelId: "fermi-gas-stations-us",
    tier: "processes",
    prereqs: [RATES],
    weight: 1,
    external: true,
    source:
      "Decompose-and-multiply estimation (gas stations, daily volume) — rests on rates/word-problem algebra.",
  },
  {
    topicKey: EV_TIMED,
    label: "EV Under Time",
    trackId: "ev-timed",
    firstLevelId: "ev-timed-1",
    tier: "processes",
    prereqs: [EXPECTED_VALUE],
    weight: 1,
    external: true,
    source:
      "Speeded +EV/−EV decisions under a per-question budget — a timed application of Expected Value.",
  },
  {
    topicKey: ARBITRAGE,
    label: "No-Arbitrage & De-Vig",
    trackId: "arbitrage",
    firstLevelId: "arb-implied-prob",
    tier: "processes",
    prereqs: [CORE_PROB, EXPECTED_VALUE],
    weight: 1,
    external: true,
    source:
      "Odds→implied probability, stripping the vig, Dutch-book detection, basket NAV — the meaning of probability (axioms/normalisation) plus probability-weighted sums.",
  },
  {
    topicKey: AUCTIONS,
    label: "Winner's-Curse / Common-Value Auctions",
    trackId: "auctions",
    firstLevelId: "auc-1",
    tier: "processes",
    prereqs: [CONDITIONAL, EXPECTED_VALUE, ORDER_STATS],
    weight: 1,
    external: true,
    source:
      "‘Winning is bad news’: E[V|win] conditioning, the exact shade E[max of n signals] (order statistics), and the +EV/−EV bid decision.",
  },
  // --- Competency nodes (spec §3.2). First-class KST nodes that MUST be mastered
  // to clear Stage 6, but with NO probe ladder of their own — fed by the
  // competency scorer (self-eval flashcards / market-making verdict), so they are
  // `external` (the "resolves to a real first level" invariant skips them). Their
  // prereqs are all REAL, earlier scored nodes, so the DAG-order invariant holds.
  // Placed LAST so they never clutter the interview spine. ---
  {
    topicKey: COMPETENCY_BRAINTEASER,
    label: "Brainteaser Reasoning (competency)",
    trackId: "competency",
    // No resolvable content level of its own; drilling routes to brainteaser
    // flashcard sets (self-eval / objectively-graded). Placeholder id for the
    // future integrator — never resolved because the node is `external`.
    firstLevelId: "competency-brainteaser-reasoning",
    tier: "synthesis",
    // §3.2: Combinatorial Analysis, Conditional Probability, Expected Value
    // (advisory) — the probability the hard brainteasers actually lean on.
    prereqs: [COMBINATORICS, CONDITIONAL, EXPECTED_VALUE],
    weight: 3,
    external: true,
    source:
      "Competency node (spec §3.2): folds Stage-2 brainteaser flashcard self-eval + mock brainteaser steps into a Beta on self-assessed 'got'; mastered ⇔ CI_low ≥ 0.80.",
  },
  {
    topicKey: COMPETENCY_TRADING,
    label: "Trading Intuition (competency)",
    trackId: "competency",
    // No resolvable content level of its own; drilling routes to make-a-market
    // game rounds. Placeholder id — never resolved (the node is `external`).
    firstLevelId: "competency-trading-intuition",
    tier: "processes",
    // §3.2: Expected Value + the EV-decision / market-making genre.
    prereqs: [EXPECTED_VALUE, INTERVIEW_GAMES],
    weight: 3,
    external: true,
    source:
      "Competency node (spec §3.2 / §10.8): folds Stage-4 game-OA + drilling MM rounds + mock MM into a Beta on the edge-capturing verdict; mastered ⇔ CI_low ≥ 0.80.",
  },
  // --- Trading-intuition SUBTOPICS (Game-OA battery decomposition). One
  // first-class competency node per market game in the battery, each fed by its
  // own game and folded into its own Beta (mastered ⇔ CI_low ≥ 0.80). The
  // aggregate `competency::trading-intuition` gate ROLLS UP these subtopics (all
  // must clear their bar), so a weak SPECIFIC subtopic re-opens Stage-6 drilling
  // and routes back to that exact game. Like the other competency nodes they are
  // `external` (no probe ladder of their own — drilling routes to the game), and
  // every prereq is a REAL earlier scored node so the DAG-order + external-node
  // invariants hold. Placed LAST so they never clutter the interview spine. The
  // single source of truth for the decomposition is
  // `@/lib/mastery/tradingSubtopics`. ---
  ...TRADING_SUBTOPICS.map(
    (s): SkillNode => ({
      topicKey: s.key,
      label: s.label,
      trackId: "competency",
      firstLevelId: s.key.replace("::", "-"),
      tier: s.tier,
      prereqs: s.prereqs,
      weight: s.weight,
      external: true,
      source: `Trading-intuition subtopic (Game-OA battery): folds the ${s.gameId} game's per-round verdict into a Beta; the aggregate trading-intuition gate rolls it up.`,
    }),
  ),
];

/** Curriculum-ordered pathway (the canonical export order). */
export function skillOrder(): SkillNode[] {
  return SKILL_GRAPH;
}

/** Look up a skill node by topicKey (undefined if not in the graph). */
export function skillByKey(topicKey: string): SkillNode | undefined {
  return SKILL_GRAPH.find((s) => s.topicKey === topicKey);
}

/** The set of every topicKey in the graph. */
export function skillKeySet(): Set<string> {
  return new Set(SKILL_GRAPH.map((s) => s.topicKey));
}

export interface SkillTierGroup {
  tier: SkillTierMeta;
  skills: SkillNode[];
}

/**
 * Group the pathway into tiers, ascending by `SKILL_TIERS[...].order`, each with
 * its skills in curriculum order. Only tiers that actually have skills appear.
 */
export function skillTiers(): SkillTierGroup[] {
  const byTier = new Map<string, SkillNode[]>();
  for (const s of SKILL_GRAPH) {
    const arr = byTier.get(s.tier) ?? [];
    arr.push(s);
    byTier.set(s.tier, arr);
  }
  return [...byTier.entries()]
    .map(([id, skills]) => ({ tier: SKILL_TIERS[id], skills }))
    .filter((g) => !!g.tier)
    .sort((a, b) => a.tier.order - b.tier.order);
}
