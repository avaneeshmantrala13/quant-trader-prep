import type { Level, Question, Track } from "@/types/content";
import { PROB_GENERATORS, mix } from "./generators";
import { probabilityStatsSubcategoryLevels } from "../probabilityStats";

const G = PROB_GENERATORS;

/**
 * Probability track. Levels 1–3 use EXACT parametric generators (fresh every
 * attempt, provably correct). Levels 4–5 are hand-authored, genuine
 * quant-interview-grade problems with worked solutions; the hardest are flagged
 * `needsVerification` for expert review (see CONTENT_NOTES.md).
 */

const hardProblems: Question[] = [
  {
    id: "pr-hh-ht",
    prompt:
      "You flip a fair coin repeatedly. What is the expected number of flips until you first see the pattern H then T (HT)?",
    choices: ["4", "6", "3", "2"],
    correctIndex: 0,
    explanation:
      "Wait for the first H (expected 2 flips). After an H, each subsequent flip is T with prob 1/2, so you wait 2 more on average. E[HT] = 2 + 2 = 4. (Contrast E[HH] = 6: after an H a 'failure' T restarts you completely, which costs more.)",
    difficulty: "hard",
    concept: "Pattern waiting times / Markov states",
    distractorRationale: [
      "Correct — 2 to get the first H, then 2 more for a T.",
      "That is E[HH]; HH is slower because a wrong flip fully resets progress.",
      "Guessing near the 3-flip average of a length-2 pattern.",
      "Only the expected wait for a single H.",
    ],
    needsVerification: true,
    source: "Expected waiting time for HT vs HH (Green Book style)",
  },
  {
    id: "pr-hh",
    prompt:
      "You flip a fair coin repeatedly. What is the expected number of flips until you first see two heads in a row (HH)?",
    choices: ["6", "4", "3", "8"],
    correctIndex: 0,
    explanation:
      "Let E be the answer. From scratch: with prob 1/2 you get T (1 flip, restart); with prob 1/2 an H, then 1/2 HH (done in 2), 1/2 HT (2 flips, restart). Solving E = 1/2(1+E) + 1/4(2) + 1/4(2+E) gives E = 6.",
    difficulty: "hard",
    concept: "Pattern waiting times / recursion",
    distractorRationale: [
      "Correct — 6, from the state recursion.",
      "That is E[HT]; HH is strictly slower.",
      "Underestimate ignoring the reset cost.",
      "Overestimate.",
    ],
    needsVerification: true,
    source: "Expected waiting time for HH",
  },
  {
    id: "pr-ant-cube",
    prompt:
      "An ant sits on a vertex of a cube and each step walks along a random edge to an adjacent vertex. What is the expected number of steps to reach the diagonally opposite vertex?",
    choices: ["10", "6", "8", "12"],
    correctIndex: 0,
    explanation:
      "By symmetry group vertices by distance from start: A(0), B(1 away, 3 of them), C(2 away, 3), D(opposite). Set up E_A=1+E_B, E_B=1+ (1/3)E_A+(2/3)E_C, E_C=1+(2/3)E_B+(1/3)E_D, E_D=0. Solving gives E_A = 10.",
    difficulty: "hard",
    concept: "Random walk on a graph / expected hitting time",
    distractorRationale: [
      "Correct — 10 by the symmetry-reduced hitting-time equations.",
      "The graph distance (3) times 2 — a plausible but wrong shortcut.",
      "Underestimate from ignoring back-tracking.",
      "Overestimate.",
    ],
    needsVerification: true,
    source: "Ant on a cube (expected hitting time)",
  },
  {
    id: "pr-gamblers-ruin",
    prompt:
      "You start with $3 and repeatedly make fair $1 even-money bets, stopping when you reach $0 (broke) or $10 (goal). What is the probability you reach $10 first?",
    choices: ["0.3", "0.5", "0.7", "0.03"],
    correctIndex: 0,
    explanation:
      "For a fair game, the probability of reaching N before 0 starting from i is exactly i/N. Here i = 3, N = 10, so P = 3/10 = 0.3.",
    difficulty: "hard",
    concept: "Gambler's ruin (fair game)",
    distractorRationale: [
      "Correct — i/N = 3/10.",
      "Ignores the starting position (assumes symmetric 50/50).",
      "Uses (N−i)/N — the probability of going broke, not of winning.",
      "Misplaced decimal.",
    ],
    needsVerification: true,
    source: "Gambler's ruin",
  },
  {
    id: "pr-broken-stick",
    prompt:
      "A stick is broken at two points chosen independently and uniformly at random along its length, making three pieces. What is the probability the three pieces can form a triangle?",
    choices: ["1/4", "1/2", "1/3", "1/8"],
    correctIndex: 0,
    explanation:
      "A triangle needs every piece shorter than 1/2 (no piece exceeds the sum of the others). Mapping the two cut points to the unit square and removing the regions where some piece > 1/2 leaves area 1/4.",
    difficulty: "expert",
    concept: "Geometric probability",
    distractorRationale: [
      "Correct — 1/4 from the geometric-probability region.",
      "The common overestimate that ignores one of the triangle inequalities.",
      "Assumes symmetry among three 'equally likely' orderings incorrectly.",
      "Double-counts the excluded regions.",
    ],
    needsVerification: true,
    source: "Broken-stick triangle probability",
  },
  {
    id: "pr-birthday",
    prompt:
      "In a room of randomly chosen people (365 equally likely birthdays, ignore leap years), what is the SMALLEST group size for which the probability that at least two share a birthday exceeds 50%?",
    choices: ["23", "183", "30", "20"],
    correctIndex: 0,
    explanation:
      "P(all distinct) = 365/365 · 364/365 · … drops below 1/2 once the group reaches 23 people, so the shared-birthday probability first exceeds 50% at 23.",
    difficulty: "hard",
    concept: "Birthday problem / complement",
    distractorRationale: [
      "Correct — the classic 23.",
      "The intuitive '~half of 365' answer; wrong because we compare PAIRS, not people to a fixed date.",
      "A common over-guess.",
      "A common under/over guess near the true value.",
    ],
    needsVerification: true,
    source: "Birthday paradox",
  },
];

const latticeProblems: Question[] = [
  {
    id: "pr-lattice-count",
    prompt:
      "Moving only right or up along grid lines, how many distinct monotonic lattice paths go from (0,0) to (4,3)?",
    choices: ["35", "12", "7", "343"],
    correctIndex: 0,
    explanation:
      "Any path is a sequence of 4 R's and 3 U's; choose which 3 of the 7 steps are U: C(7,3) = 35.",
    difficulty: "medium",
    concept: "Lattice paths / combinations",
    distractorRationale: [
      "Correct — C(7,3) = 35.",
      "Multiplied 4·3 instead of using combinations.",
      "Added 4+3.",
      "Used 7³ (ordered with replacement).",
    ],
    source: "Lattice path counting",
  },
  {
    id: "pr-ballot",
    prompt:
      "In an election, candidate A gets 5 votes and B gets 3. If the 8 votes are counted in a uniformly random order, what is the probability A is strictly ahead of B throughout the entire count?",
    choices: ["1/4", "5/8", "2/5", "1/2"],
    correctIndex: 0,
    explanation:
      "By the Ballot Theorem, P(A always strictly ahead) = (a − b)/(a + b) = (5 − 3)/(5 + 3) = 2/8 = 1/4.",
    difficulty: "expert",
    concept: "Ballot problem / reflection principle",
    distractorRationale: [
      "Correct — (a−b)/(a+b) = 1/4.",
      "Used a/(a+b), the final vote share, not the 'always ahead' probability.",
      "A miscount of favorable orderings.",
      "Assumes a coin-flip.",
    ],
    needsVerification: true,
    source: "Bertrand's ballot problem",
  },
  {
    id: "pr-catalan",
    prompt:
      "Moving right or up from (0,0) to (3,3) WITHOUT ever going above the main diagonal (staying in y ≤ x), how many such paths are there?",
    choices: ["5", "20", "6", "10"],
    correctIndex: 0,
    explanation:
      "These are Dyck paths, counted by the Catalan number C₃ = C(6,3)/(3+1) = 20/4 = 5.",
    difficulty: "expert",
    concept: "Catalan numbers / constrained paths",
    distractorRationale: [
      "Correct — Catalan C₃ = 5.",
      "C(6,3) = 20 counts ALL monotone paths, ignoring the diagonal constraint.",
      "A small miscount.",
      "Confuses with a different Catalan index.",
    ],
    needsVerification: true,
    source: "Catalan / Dyck paths",
  },
  {
    id: "pr-coupon",
    prompt:
      "You roll a fair 6-sided die repeatedly. What is the expected number of rolls to see all six faces at least once?",
    choices: ["14.7", "6", "21", "36"],
    correctIndex: 0,
    explanation:
      "Coupon collector: E = n·H_n = 6·(1 + 1/2 + 1/3 + 1/4 + 1/5 + 1/6) = 6 · 2.45 = 14.7.",
    difficulty: "hard",
    concept: "Coupon collector",
    distractorRationale: [
      "Correct — 6·H₆ = 14.7.",
      "Just the number of faces (ignores the increasing wait for new faces).",
      "Sum 1+2+…+6 — a plausible but wrong shortcut.",
      "6² — over-counts.",
    ],
    needsVerification: true,
    source: "Coupon collector problem",
  },
  {
    id: "pr-grid-collision",
    prompt:
      "On a 2×2 grid of lattice points (coordinates 0–2), person A starts at (0,0) and takes a uniformly random monotone path (steps right/up) to (2,2); person B starts at (2,2) and takes a uniformly random monotone path (steps left/down) to (0,0). Both take one step per second. What is the probability they occupy the same lattice point at the same time?",
    choices: ["1/2", "1/3", "4/9", "1/36"],
    correctIndex: 0,
    explanation:
      "A's position after t steps has coordinate-sum t; B's has coordinate-sum 4−t. They can only coincide when t = 4−t, i.e. t = 2, on the middle anti-diagonal {(2,0),(1,1),(0,2)}. Each walker lands there with distribution (1/6, 4/6, 1/6). P(meet) = (1/6)² + (4/6)² + (1/6)² = 18/36 = 1/2.",
    difficulty: "expert",
    concept: "Lattice-path collision / simultaneous random walks",
    distractorRationale: [
      "Correct — 1/2, summing the product of matching-point probabilities on the middle diagonal.",
      "Assumes the midpoint is uniform over 3 points: 3·(1/3)² = 1/3.",
      "Counts only the center-vs-center meeting (4/6·4/6 = 4/9).",
      "Only the probability both sit at one specific corner.",
    ],
    needsVerification: true,
    source:
      "Two simultaneous monotone lattice walks colliding (user-requested lattice/collision style)",
  },
];

const levels: Level[] = [
  {
    id: "pr-1",
    title: "Foundations of Probability",
    subtitle: "Sample spaces, unions, independence, counting",
    blurb:
      "Sample spaces, the union rule (inclusion–exclusion), independent-AND multiplication, and choosing combinations vs permutations.",
    section: "Core Probability",
    difficulty: "easy",
    masteryThreshold: 0.8,
    generator: mix([G.genUnion, G.genIntersectionIndep, G.genCombinations]),
    questionCount: 5,
    lesson: {
      paragraphs: [
        "Probability starts with a sample space of equally likely outcomes. P(event) = favorable / total. Two rules do most of the early work: for 'A OR B' use inclusion–exclusion P(A)+P(B)−P(A∩B); for independent 'A AND B' multiply P(A)·P(B).",
        "The classic trap: adding probabilities for 'or' without subtracting the overlap, or multiplying for 'or'. And when counting, decide whether ORDER matters — combinations C(n,r) if not, permutations if it does.",
      ],
      keyIdea: "P(A∪B) = P(A)+P(B)−P(A∩B); independent P(A∩B)=P(A)P(B).",
      whyInterviewers:
        "Roughly half of a trader interview is probability; these are the atoms.",
    },
  },
  {
    id: "pr-2",
    title: "Conditional Probability & Bayes",
    subtitle: "Updating on evidence, base rates, at-least-one",
    blurb:
      "Conditional probability, Bayes' rule for updating on evidence, why base rates dominate, and the at-least-one complement trick.",
    section: "Core Probability",
    difficulty: "medium",
    masteryThreshold: 0.8,
    generator: mix([G.genConditional, G.genBayes, G.genAtLeastOne]),
    questionCount: 5,
    lesson: {
      paragraphs: [
        "Conditional probability P(A|B) = P(A∩B)/P(B) — the probability of A within the world where B happened. Do NOT confuse P(A|B) with P(B|A); that inversion is the 'prosecutor's fallacy.'",
        "Bayes' theorem formalizes updating: P(H|E) = P(E|H)P(H) / P(E). With a rare condition, a low PRIOR dominates even an accurate test — the base rate matters. For 'at least one', use the complement: 1 − P(none).",
      ],
      keyIdea: "Bayes: posterior ∝ likelihood × prior; never drop the base rate.",
      whyInterviewers:
        "Bayesian updating under new information is exactly the market-making mindset.",
    },
  },
  {
    id: "pr-3",
    title: "Expectation & Distributions",
    subtitle: "EV, binomial, and geometric waiting times",
    blurb:
      "Expected value as a probability-weighted sum, the binomial formula C(n,k)pᵏ(1−p)ⁿ⁻ᵏ, and geometric waiting times with mean 1/p.",
    section: "Core Probability",
    difficulty: "medium",
    masteryThreshold: 0.8,
    generator: mix([G.genExpectedValue, G.genBinomial, G.genGeometric]),
    questionCount: 5,
    lesson: {
      paragraphs: [
        "Expected value weights each payoff by its probability: E = Σ p·x. The #1 mistake is averaging payoffs without weighting. For k successes in n independent trials, the binomial gives C(n,k)pᵏ(1−p)ⁿ⁻ᵏ — the C(n,k) counts the arrangements you must not forget.",
        "Waiting-time intuition: if each trial succeeds with probability p, the expected number of trials to the first success is 1/p (geometric). A fair coin's first head takes 2 flips on average.",
      ],
      keyIdea: "E = Σ p·x; binomial needs the C(n,k); geometric mean is 1/p.",
      whyInterviewers:
        "EV is the language of every pricing and betting decision on the desk.",
    },
  },
  {
    id: "pr-4",
    title: "Hard Interview Problems",
    subtitle: "Waiting times, random walks, gambler's ruin",
    blurb:
      "Interview-grade problems on pattern waiting times, random walks, gambler's ruin, and geometric probability solved via state recursions.",
    section: "Core Probability",
    difficulty: "hard",
    masteryThreshold: 0.7,
    questions: hardProblems,
    drawCount: 5,
    lesson: {
      paragraphs: [
        "Real interview probability is about setting up STATES and recursions. Expected waiting times for coin patterns (why HH takes 6 flips but HT takes 4), random walks on graphs (the ant on a cube), and gambler's ruin all fall to the same tool: define E for each state and solve the linear system.",
        "Gambler's ruin: in a fair game, the probability of hitting N before 0 from i is simply i/N. Geometric probability (the broken stick) maps the randomness to an area. Set up the equations before reaching for a formula.",
      ],
      keyIdea: "Define states, write E[state] = 1 + Σ transitions, solve.",
      whyInterviewers:
        "These are the exact recursion/EV problems asked on superdays.",
    },
  },
  {
    id: "pr-5",
    title: "Lattice Paths & Collisions",
    subtitle: "Counting paths, ballot problem, colliding walks",
    blurb:
      "Counting monotone lattice paths, Catalan/ballot constraints via reflection, and colliding random walks solved with conserved sums.",
    section: "Core Probability",
    difficulty: "expert",
    masteryThreshold: 0.7,
    questions: latticeProblems,
    drawCount: 5,
    lesson: {
      paragraphs: [
        "Lattice-path counting turns a geometry question into a combinations question: monotone paths to (m,n) number C(m+n,n). Constrain them (stay below the diagonal) and you get Catalan numbers; the reflection principle powers the ballot problem P = (a−b)/(a+b).",
        "For colliding random walkers, exploit a conserved quantity: if both move one step per second, their coordinate-SUMS evolve deterministically, so they can only meet at one specific time. Reduce to the distribution on that anti-diagonal and sum the matching-probability products.",
      ],
      keyIdea:
        "Paths ⇒ C(m+n,n); constraints ⇒ Catalan/reflection; collisions ⇒ conserved sums.",
      whyInterviewers:
        "The 'two walkers on a grid' family is a favorite hard screen — it rewards structure over brute force.",
    },
  },
];

export const probabilityTrack: Track = {
  id: "probability",
  title: "Probability & Statistics",
  tagline: "Probability from the ground up to interview-hard",
  description:
    "Reason under uncertainty — sample spaces, Bayes, and expectation up to Kelly sizing, Markov chains, and game theory, with fresh, exactly-verified problems.",
  motif: "probability",
  // Core probability route, then the Betting & Sizing subcategory (numeric
  // free-entry Kelly factory). Future Probability & Statistics subcategories
  // append via `probabilityStatsSubcategoryLevels`.
  levels: [...levels, ...probabilityStatsSubcategoryLevels],
};
