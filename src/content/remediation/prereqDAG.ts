import { topicKeyOf } from "@/lib/mastery/topicKey";
import { MISCONCEPTION } from "@/lib/tutor/misconception";

/**
 * The static prerequisite DAG for bounded backtracking (PHASE_4 §2/§5).
 *
 * Nodes are Phase-1 topicKeys (`topicKeyOf(trackId, section)`) so the mastery a
 * probe writes lands in the SAME bucket the policy reads. Edges point DOWN a
 * node to its prerequisites ("is prerequisite of"): descending = moving to a
 * node in `prereqs`. The foundational conceptual chain is
 *
 *   L0 arithmetic  →  L1 meaning / sample space  →  counting  →  conditioning
 *                                                              →  expectation
 *
 * collapsed onto the app's real section-level topics (the mastery layer is
 * section-granular, COORDINATION §6.4). Three nodes are FLOORS (Vygotsky: stop
 * dropping, teach here): the L0 mental-arithmetic leaf, the L1 "meaning of
 * probability / sample space" node, and the Rates/Algebra foundation (a scored
 * skill-graph root with no prerequisite of its own).
 *
 * COVERAGE (remediation gap fix): the DAG now covers EVERY SCORED (quiz/numeric)
 * topic, all 26 of them (the 19 originals, the Conditional Expectation unit, and
 * the SEVEN first-class course-completeness topics that replaced the single
 * "Extra Relevant Knowledge" super-node: MGF, Gamma, Joint Distributions, Limit
 * Theorems, Branching, CTMC, and Markov Chain Structure), so auto-launch
 * remediation (finish-time + mid-lesson) engages for any scored topic a learner
 * bombs, not just the original five, AND routes to the correct sub-topic. The
 * edges are DERIVED from the ordered skill graph (`@/lib/roadmap/skillGraph`),
 * which already defines each topic's prerequisite relationships in curriculum
 * order; this DAG is the acyclic subset restricted to remediable nodes. The
 * self-assessed FLASHCARD-only tracks are intentionally OUT OF SCOPE, the two
 * Brainteasers topics (`brainteasers::Core Puzzles`, `brainteasers::Techniques
 * Toolkit`) have no scored attempt to remediate and `buildProbeItem` returns
 * null for flashcard levels, so they are deliberately absent. Every skill-graph
 * prereq of a covered topic is itself a scored node, so no flashcard-prereq
 * rerouting was required; each node's `levelRef` points at a REAL scored
 * intro/easy level in that topic (verified against its `levels.ts`).
 *
 * ROUTING STUBS (audit Z1 / auctions no-routing): in addition to the scored
 * topics, six timed-drill / game topics whose `Level`s are authored but NOT yet
 * registered into a playable track — Sequences, No-Arbitrage, Fermi,
 * EV-under-time, Speed Arena, and Auctions — are included as `external` nodes.
 * They have NO own `levelRef` (nothing to probe in place); they exist purely so a
 * bombed drill descends to a real prerequisite instead of exiting `no-gap`. Their
 * prerequisites are all real scored nodes, so the descent target always resolves.
 *
 * `MISCONCEPTION_EDGE` maps a misconception TAG (the canonical Phase-2 tags in
 * `@/lib/tutor/misconception`, i.e. the string AFTER the `topicKey::` prefix a
 * misconception KEY carries) to the prerequisite topicKey it implicates
 * (Doignon & Falmagne KST: the misconception names the missing precedence).
 *
 * Research: Doignon & Falmagne (precedence DAG / outer fringe); Bloom 1984
 * (remediate the specific missing prerequisite).
 */

export interface PrereqNode {
  /** Node identity, a Phase-1 topicKey (`topicKeyOf(trackId, section)`). */
  topicKey: string;
  label: string;
  /** Parent topicKeys, the prerequisites of this node (edges "is prerequisite of"). */
  prereqs: string[];
  /** L0 / "meaning of probability": stop dropping, teach here (do not descend below). */
  floor?: boolean;
  /**
   * The closest existing foundational level to draw probe/corrective items from.
   * OMITTED for {@link PrereqNode.external} drill/game nodes whose content is not
   * registered in any playable track — those nodes only exist so a failure ROUTES
   * DOWN to a real prerequisite (they are never themselves probed in place).
   */
  levelRef?: { trackId: string; levelId: string };
  /**
   * EXTERNAL routing stub: a timed-drill / game topic (Speed Arena, Sequences,
   * No-Arbitrage, Fermi, EV-under-time, Auctions) whose `Level`s are authored but
   * NOT registered into a playable track, so it has no in-topic tier ladder and
   * no resolvable `levelRef` of its own. It is present ONLY so that a bombed
   * attempt on that topic descends to an appropriate ZPD prerequisite instead of
   * exiting `no-gap`. Because there is nothing lower WITHIN the topic to ease into,
   * the policy treats any repeated miss here as already at the topic's floor tier
   * (see `remediationStep`) and descends. Its prerequisites are all real, scored
   * nodes, so the descent target always resolves to a real probe level.
   */
  external?: boolean;
}

/* -- Node topicKeys (all resolve to REAL mastery buckets + levels) ----------
 *
 * Every constant below mirrors a node in the skill graph (`@/lib/roadmap/
 * skillGraph`); the DAG prereqs are that graph's prereqs restricted to scored
 * nodes. Constants are grouped by curriculum tier (foundations → probability →
 * expectation/distributions → processes/applications). The two flashcard-only
 * Brainteasers topics are intentionally omitted (no scored attempt to probe).
 */

/* Foundations. */
/** L0. Mental arithmetic. Mental Math serves as the arithmetic floor (PHASE_4 §5 gap note). FLOOR. */
export const L0_ARITHMETIC = topicKeyOf("mental-math"); // `mental-math::_core`
/** Rates, algebra & word problems, algebraic fluency (M408 prereq). A foundations
 * root in the skill graph (no scored prereq of its own), so it is itself a FLOOR. */
export const RATES = topicKeyOf("math-questions", "Rates, Algebra & Word Problems");
/** Number theory & counting, series/multiples/growth; floors on arithmetic. */
export const NUMBER_THEORY = topicKeyOf("math-questions", "Number Theory & Counting");

/* Probability foundations (M362K chs. 1–3). */
/** L1. Meaning of probability, sample space, P(A∪B)/P(A∩B), independence (pr-1). FLOOR. */
export const L1_MEANING = topicKeyOf("probability", "Core Probability");
/** Counting / combinatorics, supports reduced-sample-space counting. */
export const COUNTING = topicKeyOf("probability", "Combinatorial Analysis");
/** Conditioning + Bayes. */
export const CONDITIONAL = topicKeyOf("probability", "Conditional Probability");

/* Expectation, distributions & variability (M362K chs. 4–8). */
/** Expected value. */
export const EXPECTED_VALUE = topicKeyOf("probability", "Expected Value");
/** Conditional expectation E[X|Y] / tower rule / random sums; needs conditioning + expectation. */
export const CONDITIONAL_EXPECTATION = topicKeyOf(
  "probability",
  "Conditional Expectation",
);
/** Poisson distribution & process (uses E[X]=λ). */
export const POISSON = topicKeyOf("probability", "Poisson Distribution & Process");
/** Geometric probability, favourable measure ÷ total (meaning-of-probability application). */
export const GEOMETRIC = topicKeyOf("probability", "Geometric Probability");
/** Geometry & derivations, clean-number geometry; builds on algebra (Rates). */
export const GEOMETRY = topicKeyOf("math-questions", "Geometry & Derivations");
/** Order statistics, min/max/median of several draws (expected extremes). */
export const ORDER_STATS = topicKeyOf("probability", "Order Statistics");
/** Continuous distributions, density integration, Uniform/Exp/Normal. */
export const CONTINUOUS = topicKeyOf("probability", "Continuous Distributions");
/** Variance, covariance & the CLT, second moments, concentration, CLT tails. */
export const VARIANCE_CLT = topicKeyOf("probability", "Variance, Covariance & the CLT");

/* Stochastic processes & trading applications (M362M + canon). */
/** Betting & sizing (Kelly), a focused application of EV + odds. */
export const BETTING = topicKeyOf("probability", "Betting & Sizing");
/** Markov chains & random walks, recursions/ruin/stationary; needs conditioning + expectation. */
export const MARKOV = topicKeyOf("probability", "Markov Chains");
/** Brownian motion, continuous-time limit of a random walk; needs Markov + continuous. */
export const BROWNIAN = topicKeyOf("probability", "Brownian Motion");
/** EV decision games & market making, re-roll EV, optimal stopping, adverse selection. */
export const INTERVIEW_GAMES = topicKeyOf("interview-games"); // `interview-games::_core`
/** Game theory & puzzles, equilibria/mixed strategies on top of EV games. */
export const GAME_THEORY = topicKeyOf("probability", "Game Theory & Puzzles");

/* Course-completeness topics (M362K/M362M; untested at surveyed firms). These
 * are the SEVEN first-class topics that replaced the former single "Extra
 * Relevant Knowledge" super-node, each with its own correct prerequisites and
 * its own scored `levelRef` (so remediation routes to the right sub-topic
 * instead of always landing on the MGF quiz). */
/** Moment generating functions, moments from derivatives + the MGF method for sums. */
export const MGF = topicKeyOf("probability", "Moment Generating Functions");
/** Gamma distribution, sum of k iid exponentials (a continuous density). */
export const GAMMA = topicKeyOf("probability", "Gamma Distribution");
/** Joint distributions, joint densities/pmfs, marginals, conditionals, transforms. */
export const JOINT = topicKeyOf("probability", "Joint Distributions");
/** Limit theorems. Chebyshev, the LLN, and the formal CLT. */
export const LIMIT_THEOREMS = topicKeyOf("probability", "Limit Theorems");
/** Branching processes. Galton–Watson growth + extinction (first-step conditioning). */
export const BRANCHING = topicKeyOf("probability", "Branching Processes");
/** Continuous-time Markov chains, holding times, balance, and the M/M/1 queue. */
export const CTMC = topicKeyOf("probability", "Continuous-Time Markov Chains");
/** Markov chain structure. Pⁿ / Chapman–Kolmogorov + state classification. */
export const MARKOV_STRUCTURE = topicKeyOf("probability", "Markov Chain Structure");

/* -- EXTERNAL routing stubs (timed drills / games) -------------------------
 *
 * These topics' `Level`s are authored (see `content/{sequences,arbitrage,
 * auctions}/levels.ts`, `content/fermi/items.ts`, `lib/{arena,evTimed}/**`) but
 * NOT registered into a playable track, so their probes have no in-topic tier
 * ladder and no resolvable `levelRef`. Before this fix, a bombed drill hit
 * `prereqNode → undefined → exit "no-gap"` (audit Z1 / auctions "no routing"),
 * so the ZPD layer was inert for them. Each is added as an `external` node whose
 * prerequisites are REAL scored nodes, so a failure now descends to an
 * appropriate prerequisite (Vygotsky) even though the drill itself is never
 * re-probed in place. The chosen trackIds mirror the content-area names (and
 * match the existing `topicKeyOf("fermi")` calibration key). */
/** Sequences & Pattern Recognition (OA abstract-reasoning drill). */
export const SEQUENCES = topicKeyOf("sequences", "Sequences & Pattern Recognition");
/** No-Arbitrage / de-vig drill (odds → probability, booksum, basket NAV). */
export const ARBITRAGE = topicKeyOf("arbitrage", "No-Arbitrage");
/** Fermi / order-of-magnitude estimation drill. */
export const FERMI = topicKeyOf("fermi"); // `fermi::_core`
/** EV-under-time timed decision drill. */
export const EV_TIMED = topicKeyOf("ev-timed"); // `ev-timed::_core`
/** Speed Arena timed mental-arithmetic sprint. */
export const ARENA = topicKeyOf("arena"); // `arena::_core`
/** Winner's-curse / common-value auctions drill. */
export const AUCTIONS = topicKeyOf("auctions"); // `auctions::_core`

export const PREREQ_DAG: Record<string, PrereqNode> = {
  /* -- Foundations ------------------------------------------------------- */
  [L0_ARITHMETIC]: {
    topicKey: L0_ARITHMETIC,
    label: "Mental Arithmetic (L0)",
    prereqs: [],
    floor: true,
    levelRef: { trackId: "mental-math", levelId: "mm-1" },
  },
  [RATES]: {
    topicKey: RATES,
    label: "Rates, Algebra & Word Problems",
    // Skill graph places this in the foundations tier with no prerequisites, so
    // it is a scored FLOOR: descent teaches algebraic fluency here (ZPD) rather
    // than dropping to pure mental arithmetic.
    prereqs: [],
    floor: true,
    levelRef: { trackId: "math-questions", levelId: "mq-1" },
  },
  [NUMBER_THEORY]: {
    topicKey: NUMBER_THEORY,
    label: "Number Theory & Counting",
    prereqs: [L0_ARITHMETIC],
    levelRef: { trackId: "math-questions", levelId: "mq-4" },
  },
  /* -- Probability foundations ------------------------------------------- */
  [L1_MEANING]: {
    topicKey: L1_MEANING,
    label: "Meaning of Probability & Sample Space (L1)",
    // Depends only on arithmetic, but is itself a floor: we teach the meaning
    // here rather than dropping to pure arithmetic (ZPD).
    prereqs: [L0_ARITHMETIC],
    floor: true,
    levelRef: { trackId: "probability", levelId: "pr-1" },
  },
  [COUNTING]: {
    topicKey: COUNTING,
    label: "Counting & Combinatorics",
    prereqs: [L0_ARITHMETIC],
    levelRef: { trackId: "probability", levelId: "ca-1" },
  },
  [CONDITIONAL]: {
    topicKey: CONDITIONAL,
    label: "Conditional Probability & Bayes",
    prereqs: [L1_MEANING, COUNTING],
    levelRef: { trackId: "probability", levelId: "cp-1" },
  },
  /* -- Expectation, distributions & variability -------------------------- */
  [EXPECTED_VALUE]: {
    topicKey: EXPECTED_VALUE,
    label: "Expected Value",
    prereqs: [L1_MEANING, COUNTING],
    levelRef: { trackId: "probability", levelId: "ev-1" },
  },
  [CONDITIONAL_EXPECTATION]: {
    topicKey: CONDITIONAL_EXPECTATION,
    label: "Conditional Expectation & the Tower Rule",
    // Skill graph: E[X|Y] / tower rule / random sums build on conditioning
    // (Conditional Probability & Bayes) and Expected Value. Mirrors the
    // skill-graph node's prereqs.
    prereqs: [CONDITIONAL, EXPECTED_VALUE],
    levelRef: { trackId: "probability", levelId: "ce-1" },
  },
  [GEOMETRIC]: {
    topicKey: GEOMETRIC,
    label: "Geometric Probability",
    // Skill graph: prereq is Core Probability (favourable-measure meaning).
    prereqs: [L1_MEANING],
    levelRef: { trackId: "probability", levelId: "geo-1" },
  },
  [POISSON]: {
    topicKey: POISSON,
    label: "Poisson Distribution & Process",
    // Process-depth levels (interarrivals are exponential) build on Continuous
    // Distributions, so it is a prerequisite alongside Expected Value.
    prereqs: [EXPECTED_VALUE, CONTINUOUS],
    levelRef: { trackId: "probability", levelId: "po-1" },
  },
  [ORDER_STATS]: {
    topicKey: ORDER_STATS,
    label: "Order Statistics",
    prereqs: [EXPECTED_VALUE],
    levelRef: { trackId: "probability", levelId: "os-1" },
  },
  [CONTINUOUS]: {
    topicKey: CONTINUOUS,
    label: "Continuous Distributions",
    prereqs: [EXPECTED_VALUE],
    levelRef: { trackId: "probability", levelId: "cd-1" },
  },
  [VARIANCE_CLT]: {
    topicKey: VARIANCE_CLT,
    label: "Variance, Covariance & the CLT",
    prereqs: [EXPECTED_VALUE],
    levelRef: { trackId: "probability", levelId: "vc-1" },
  },
  /* -- Applied math word-problem spine ----------------------------------- */
  [GEOMETRY]: {
    topicKey: GEOMETRY,
    label: "Geometry & Derivations",
    // Skill graph: prereq is Rates/Algebra (both scored math-questions topics).
    prereqs: [RATES],
    levelRef: { trackId: "math-questions", levelId: "mq-5" },
  },
  /* -- Stochastic processes & trading applications ----------------------- */
  [BETTING]: {
    topicKey: BETTING,
    label: "Betting & Sizing (Kelly)",
    prereqs: [EXPECTED_VALUE],
    levelRef: { trackId: "probability", levelId: "bs-1" },
  },
  [INTERVIEW_GAMES]: {
    topicKey: INTERVIEW_GAMES,
    label: "EV Decision Games & Market Making",
    prereqs: [EXPECTED_VALUE],
    levelRef: { trackId: "interview-games", levelId: "ig-1" },
  },
  [MARKOV]: {
    topicKey: MARKOV,
    label: "Markov Chains & Random Walks",
    // First-step analysis / hitting times are tower-rule arguments, so
    // Conditional Expectation is a genuine prerequisite.
    prereqs: [CONDITIONAL, EXPECTED_VALUE, CONDITIONAL_EXPECTATION],
    levelRef: { trackId: "probability", levelId: "mc-1" },
  },
  [GAME_THEORY]: {
    topicKey: GAME_THEORY,
    label: "Game Theory & Puzzles",
    // Its Kelly/EV-heavy puzzles rest directly on Expected Value (previously
    // only transitive via Interview Games).
    prereqs: [INTERVIEW_GAMES, EXPECTED_VALUE],
    levelRef: { trackId: "probability", levelId: "gt-1" },
  },
  [BROWNIAN]: {
    topicKey: BROWNIAN,
    label: "Brownian Motion",
    prereqs: [MARKOV, CONTINUOUS],
    levelRef: { trackId: "probability", levelId: "bm-1" },
  },
  /* -- Course-completeness topics (formerly the single ERK super-node) ----- */
  [MGF]: {
    topicKey: MGF,
    label: "Moment Generating Functions",
    prereqs: [EXPECTED_VALUE, VARIANCE_CLT],
    levelRef: { trackId: "probability", levelId: "ek-mgf" },
  },
  [GAMMA]: {
    topicKey: GAMMA,
    label: "Gamma Distribution",
    prereqs: [CONTINUOUS],
    levelRef: { trackId: "probability", levelId: "ek-gamma" },
  },
  [JOINT]: {
    topicKey: JOINT,
    label: "Joint Distributions",
    // Double integrals over joint densities build on Continuous Distributions;
    // discrete conditionals/independence draw on conditioning.
    prereqs: [CONTINUOUS, CONDITIONAL],
    levelRef: { trackId: "probability", levelId: "ek-joint" },
  },
  [LIMIT_THEOREMS]: {
    topicKey: LIMIT_THEOREMS,
    label: "Limit Theorems (Chebyshev / LLN / CLT)",
    prereqs: [VARIANCE_CLT],
    levelRef: { trackId: "probability", levelId: "ek-limit" },
  },
  [BRANCHING]: {
    topicKey: BRANCHING,
    label: "Branching Processes",
    // Extinction via first-step conditioning on the offspring PGF is a
    // conditional-expectation argument.
    prereqs: [EXPECTED_VALUE, CONDITIONAL_EXPECTATION],
    levelRef: { trackId: "probability", levelId: "ek-branching" },
  },
  [CTMC]: {
    topicKey: CTMC,
    label: "Continuous-Time Markov Chains",
    // Exponential holding times / birth–death queues need the Poisson process.
    prereqs: [MARKOV, POISSON],
    levelRef: { trackId: "probability", levelId: "ek-ctmc" },
  },
  [MARKOV_STRUCTURE]: {
    topicKey: MARKOV_STRUCTURE,
    label: "Markov Chain Structure (Pⁿ / classification)",
    prereqs: [MARKOV],
    levelRef: { trackId: "probability", levelId: "ek-markov-pn" },
  },
  /* -- External routing stubs (unregistered timed drills / games) --------- */
  [SEQUENCES]: {
    topicKey: SEQUENCES,
    label: "Sequences & Pattern Recognition",
    // Recovering a generating rule (arithmetic/geometric/quadratic differences,
    // series & growth) rests on the structural counting of Number Theory.
    prereqs: [NUMBER_THEORY],
    external: true,
  },
  [ARBITRAGE]: {
    topicKey: ARBITRAGE,
    label: "No-Arbitrage & De-Vig",
    // Reading a quote as a probability (1/o), normalising a book, and detecting a
    // Dutch book are the axioms/meaning of probability; value legs and basket NAV
    // are probability-weighted sums (Expected Value).
    prereqs: [L1_MEANING, EXPECTED_VALUE],
    external: true,
  },
  [FERMI]: {
    topicKey: FERMI,
    label: "Fermi / Order-of-Magnitude Estimation",
    // Decompose-and-multiply estimation builds on rates/word-problem algebra.
    prereqs: [RATES],
    external: true,
  },
  [EV_TIMED]: {
    topicKey: EV_TIMED,
    label: "EV Under Time",
    // Timed +EV/−EV decisions are a speeded application of Expected Value.
    prereqs: [EXPECTED_VALUE],
    external: true,
  },
  [ARENA]: {
    topicKey: ARENA,
    label: "Speed Arena (Timed Mental Arithmetic)",
    // A pure arithmetic sprint: descend to the mental-arithmetic floor.
    prereqs: [L0_ARITHMETIC],
    external: true,
  },
  [AUCTIONS]: {
    topicKey: AUCTIONS,
    label: "Winner's-Curse / Common-Value Auctions",
    // "Winning is bad news" is conditioning on the winning event (Conditional
    // Probability); the exact shade is E[max of n signals] (Order Statistics);
    // the bid decision is an Expected-Value comparison.
    prereqs: [CONDITIONAL, EXPECTED_VALUE, ORDER_STATS],
    external: true,
  },
};

/**
 * misconception TAG → prerequisite topicKey to descend to (PHASE_4 §5). Keyed on
 * the canonical Phase-2 tags actually emitted by the content generators (strip
 * the `topicKey::` prefix from a misconception KEY to get the tag via
 * {@link misconceptionTagOf}). Every value is a node in {@link PREREQ_DAG}.
 *
 *  - reversed conditional / base-rate / likelihood-as-posterior / total-prob
 *    weighting / memoryless-uniform ⇒ the gap is in the MEANING of probability
 *    (marginals, conditioning set-up) ⇒ descend to L1.
 *  - AND-means-add / OR-means-add / complement-confusion / at-least-one-naive ⇒
 *    the gap is in the axioms of probability (multiplication/addition/complement
 *    rules, independence) ⇒ descend to L1. These implicate L1 for the scored
 *    topics that build on it (Expected Value, Geometric Probability, …).
 *  - ordered-vs-unordered / faces-not-objects / forgot-divide-by-two ⇒ the gap
 *    is in COUNTING the reduced sample space ⇒ descend to Counting.
 *  - n-vs-(n−1) (sample-variance denominator) ⇒ the gap is in second-moment
 *    reasoning ⇒ descend to Variance/Covariance & the CLT (its downstream nodes
 *    MGF and Limit Theorems list it as a prerequisite).
 */
export const MISCONCEPTION_EDGE: Record<string, string> = {
  [MISCONCEPTION.reversedConditional]: L1_MEANING,
  [MISCONCEPTION.baseRateNeglect]: L1_MEANING,
  [MISCONCEPTION.likelihoodAsPosterior]: L1_MEANING,
  [MISCONCEPTION.outcomeApproach]: L1_MEANING,
  [MISCONCEPTION.gamblersFallacy]: L1_MEANING,
  [MISCONCEPTION.conjunctionFallacy]: L1_MEANING,
  [MISCONCEPTION.equalWeightMixture]: L1_MEANING,
  [MISCONCEPTION.memorylessUniform]: L1_MEANING,
  [MISCONCEPTION.andMeansAdd]: L1_MEANING,
  [MISCONCEPTION.orMeansAddNoOverlap]: L1_MEANING,
  [MISCONCEPTION.complementConfusion]: L1_MEANING,
  [MISCONCEPTION.atLeastOneNaive]: L1_MEANING,
  [MISCONCEPTION.orderedVsUnordered]: COUNTING,
  [MISCONCEPTION.facesNotObjects]: COUNTING,
  [MISCONCEPTION.forgotDivideByTwo]: COUNTING,
  [MISCONCEPTION.nVsNMinusOne]: VARIANCE_CLT,

  /* -- DOMAIN tags emitted by the timed drills & games (audit Z1 / games.md).
   * These are RAW authored tags (not in the canonical `MISCONCEPTION` registry,
   * which lives in the out-of-scope tutor module) that the drill generators emit.
   * Mapping them lets descent target the RIGHT prerequisite of the failing node
   * instead of falling back to `prereqs[0]`. A mapping is only ever honored when
   * the implicated node is an actual prereq of the failing node (see
   * `chooseDescentEdge` / `descentTarget`), so a tag that is shared across topics
   * (e.g. `uniform_norm`) routes to whichever of its parents actually lists the
   * target — and harmlessly falls through elsewhere. */
  // Sequences & Pattern Recognition ⇒ the rule-recovery gap is structural
  // counting / number sense (its only prereq is Number Theory).
  off_by_one_continuation: NUMBER_THEORY,
  used_previous_term: NUMBER_THEORY,
  copied_absolute_gap: NUMBER_THEORY,
  treated_as_arithmetic: NUMBER_THEORY,
  wrong_sign_difference: NUMBER_THEORY,
  // No-Arbitrage: reading a quote AS a probability + normalising a book are the
  // MEANING/axioms of probability (L1); weighted-sum / sizing errors are the
  // probability-weighted-sum reasoning of Expected Value.
  complement_prob: L1_MEANING,
  decimal_as_fractional: L1_MEANING,
  net_return_share: L1_MEANING,
  fraction_inverted: L1_MEANING,
  unit_numerator: L1_MEANING,
  ratio_not_prob: L1_MEANING,
  moneyline_sign_flip: L1_MEANING,
  forgot_stake_term: L1_MEANING,
  ignore_overround: L1_MEANING,
  uniform_norm: L1_MEANING,
  normalize_by_odds: L1_MEANING,
  unweighted_basket: EXPECTED_VALUE,
  summed_weights: EXPECTED_VALUE,
  averaged_not_summed: EXPECTED_VALUE,
  stake_by_odds: EXPECTED_VALUE,
  forgot_normalize: EXPECTED_VALUE,
  forgot_subtract_stake: EXPECTED_VALUE,
  // Winner's-curse auctions: "winning is bad news" is a CONDITIONING gap; failing
  // to shade with n is the E[max of n signals] Order-Statistics gap.
  ignored_winners_curse: CONDITIONAL,
  wrong_conditioning: CONDITIONAL,
  used_own_signal: CONDITIONAL,
  no_shading_for_n: ORDER_STATS,
  // Interview-games de-vig / next-card conditioning + basket NAV weighting: these
  // trip on Expected Value (the node's prereq); the conditioning half is coarser
  // (interview-games is a single section-less bucket) but still routes sensibly.
  summed_payouts_no_weight: EXPECTED_VALUE,
  unweighted_sum: EXPECTED_VALUE,
  unconditioned_half: EXPECTED_VALUE,
};

/** Look up a node (undefined if the topicKey is not in the DAG). */
export function prereqNode(topicKey: string): PrereqNode | undefined {
  return PREREQ_DAG[topicKey];
}

/**
 * Strip the `${topicKey}::` prefix from a namespaced misconception KEY to recover
 * the TAG that {@link MISCONCEPTION_EDGE} is keyed on. A bare tag (no prefix) is
 * returned unchanged; `undefined`/empty ⇒ `undefined`.
 */
export function misconceptionTagOf(
  misconceptionKeyOrTag: string | undefined,
): string | undefined {
  if (!misconceptionKeyOrTag) return undefined;
  const idx = misconceptionKeyOrTag.lastIndexOf("::");
  return idx >= 0
    ? misconceptionKeyOrTag.slice(idx + 2)
    : misconceptionKeyOrTag;
}
