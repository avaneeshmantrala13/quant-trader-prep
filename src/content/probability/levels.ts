import type { Level, NumericQuestion, Track } from "@/types/content";
import { mixNumericGenerators } from "@/content/mixFamilies";
import {
  genAtLeastOneNumeric,
  genBayesNumeric,
  genBinomialNumeric,
  genCombinationsNumeric,
  genConditionalNumeric,
  genExpectedValueNumeric,
  genGeometricNumeric,
  genIntersectionIndepNumeric,
  genUnionNumeric,
} from "./generators";
import { probabilityStatsSubcategoryLevels } from "../probabilityStats";

/**
 * Probability track. Levels 1–3 are EXACT parametric families converted to
 * FREE-RESPONSE `numeric` (Phase 2 MCQ→free-response): the learner types a
 * fraction / decimal / whole number, graded by `gradeFreeResponse` with a
 * per-family, misconception-tagged error-mode catalog + verified rung-5
 * explanation (the underlying quiz builders remain exported + byte-stable for
 * the shared registry test). Levels 4–5 are hand-authored STATIC pools (not
 * parametric families) converted MCQ→FREE-RESPONSE `numeric`: each item keeps
 * its verified rung-5 `explanation` and gets a per-ITEM (non-parametric)
 * error-mode catalog (`commonErrors` with misconception tags + rung-1 coaching)
 * mined from the original distractor rationales. The hardest are flagged
 * `needsVerification` for expert review (see CONTENT_NOTES.md). NOTE: being
 * static (no generator/family), these items get rungs 1/2/4/5 but NOT the
 * rung-3 "different-numbers" auto-sibling, an accepted non-parametric limit.
 */

const hardProblemsNumeric: NumericQuestion[] = [
  {
    id: "pr-hh-ht",
    prompt:
      "You flip a fair coin repeatedly. What is the expected number of flips until you first see the pattern H then T (HT)? (Enter a whole number.)",
    answer: 4,
    unit: "",
    explanation:
      "Wait for the first H (expected 2 flips). After an H, each subsequent flip is T with prob 1/2, so you wait 2 more on average. E[HT] = 2 + 2 = 4. (Contrast E[HH] = 6: after an H a 'failure' T restarts you completely, which costs more.)",
    difficulty: "hard",
    concept: "Pattern waiting times / Markov states",
    commonErrors: [
      {
        value: 6,
        feedback:
          "Close! That's the wait for HH, where a stray tails after a head wipes out all progress. But for H-then-T, does a tails following your first head actually undo anything?",
        misconception: "ht_treated_like_hh",
      },
      {
        value: 3,
        feedback:
          "Not quite, that looks like a guess near the pattern's length. Try splitting the wait into 'time to the first H' plus 'time from that H to the next T'; what does each piece average?",
        misconception: "guessed_pattern_length",
      },
      {
        value: 2,
        feedback:
          "That's just the wait for a single head. The pattern needs an H followed by a T, what extra wait happens after that first head lands?",
        misconception: "single_symbol_wait_only",
      },
    ],
    needsVerification: true,
    source: "Expected waiting time for HT vs HH (Green Book style)",
  },
  {
    id: "pr-hh",
    prompt:
      "You flip a fair coin repeatedly. What is the expected number of flips until you first see two heads in a row (HH)? (Enter a whole number.)",
    answer: 6,
    unit: "",
    explanation:
      "Let E be the answer. From scratch: with prob 1/2 you get T (1 flip, restart); with prob 1/2 an H, then 1/2 HH (done in 2), 1/2 HT (2 flips, restart). Solving E = 1/2(1+E) + 1/4(2) + 1/4(2+E) gives E = 6.",
    difficulty: "hard",
    concept: "Pattern waiting times / recursion",
    commonErrors: [
      {
        value: 4,
        feedback:
          "Close! That's the wait for HT, where a tails after a head still leaves you ready. But for HH, what happens to your progress when the flip after a head comes up tails?",
        misconception: "hh_treated_like_ht",
      },
      {
        value: 3,
        feedback:
          "Not quite, this ignores how costly a reset is. When you're one head in and then flip tails, how many flips of progress do you actually lose?",
        misconception: "reset_cost_ignored",
      },
      {
        value: 8,
        feedback:
          "That's too high. Set up the state recursion E = ½(1+E) + ¼·2 + ¼(2+E) and solve it, does the wait really climb that far?",
        misconception: "overestimated_reset_cost",
      },
    ],
    needsVerification: true,
    source: "Expected waiting time for HH",
  },
  {
    id: "pr-ant-cube",
    prompt:
      "An ant sits on a vertex of a cube and each step walks along a random edge to an adjacent vertex. What is the expected number of steps to reach the diagonally opposite vertex? (Enter a whole number.)",
    answer: 10,
    unit: "",
    explanation:
      "By symmetry group vertices by distance from start: A(0), B(1 away, 3 of them), C(2 away, 3), D(opposite). Set up E_A=1+E_B, E_B=1+ (1/3)E_A+(2/3)E_C, E_C=1+(2/3)E_B+(1/3)E_D, E_D=0. Solving gives E_A = 10.",
    difficulty: "hard",
    concept: "Random walk on a graph / expected hitting time",
    commonErrors: [
      {
        value: 6,
        feedback:
          "Close, but multiplying the graph distance (3) by 2 is a shortcut that doesn't hold on this walk. Have you written the hitting-time equations for each symmetry class of vertex?",
        misconception: "graph_distance_times_two",
      },
      {
        value: 8,
        feedback:
          "Not quite, that underestimates by ignoring how often the ant wanders back toward the start. Do your state equations allow for steps that move away from the target?",
        misconception: "ignored_backtracking",
      },
      {
        value: 12,
        feedback:
          "That's an overestimate. Group the vertices by distance and solve E_A=1+E_B, E_B=1+⅓E_A+⅔E_C, …, where does the system actually settle?",
        misconception: "overestimated_hitting_time",
      },
    ],
    needsVerification: true,
    source: "Ant on a cube (expected hitting time)",
  },
  {
    id: "pr-gamblers-ruin",
    prompt:
      "You start with $3 and repeatedly make fair $1 even-money bets, stopping when you reach $0 (broke) or $10 (goal). What is the probability you reach $10 first? (Enter a fraction or decimal.)",
    answer: 0.3,
    decimals: 2,
    unit: "",
    explanation:
      "For a fair game, the probability of reaching N before 0 starting from i is exactly i/N. Here i = 3, N = 10, so P = 3/10 = 0.3.",
    difficulty: "hard",
    concept: "Gambler's ruin (fair game)",
    commonErrors: [
      {
        value: 0.5,
        feedback:
          "Close! But a 50/50 coin-flip ignores where you start. In fair gambler's ruin, how should starting at $3 out of a $10 goal shift the probability of winning?",
        misconception: "ignored_start_position",
      },
      {
        value: 0.7,
        feedback:
          "Careful, that's the probability of going broke, (N−i)/N, not of reaching the goal. Which direction does the i/N formula actually measure?",
        misconception: "complement_confusion",
      },
      {
        value: 0.03,
        feedback:
          "Check your decimal placement, recompute i/N and count the decimal places carefully. Is 3 out of 10 really that small?",
        misconception: "misplaced_decimal",
      },
    ],
    needsVerification: true,
    source: "Gambler's ruin",
  },
  {
    id: "pr-broken-stick",
    prompt:
      "A stick is broken at two points chosen independently and uniformly at random along its length, making three pieces. What is the probability the three pieces can form a triangle? (Enter a fraction or decimal.)",
    answer: 0.25,
    decimals: 2,
    unit: "",
    explanation:
      "A triangle needs every piece shorter than 1/2 (no piece exceeds the sum of the others). Mapping the two cut points to the unit square and removing the regions where some piece > 1/2 leaves area 1/4.",
    difficulty: "expert",
    concept: "Geometric probability",
    commonErrors: [
      {
        value: 0.5,
        feedback:
          "Close! That overestimate slips because it enforces only one of the triangle inequalities. How many of the three pieces must be shorter than half the stick for a triangle to form?",
        misconception: "ignored_one_triangle_inequality",
      },
      {
        value: 1 / 3,
        feedback:
          "Not quite, this assumes three orderings are equally likely by symmetry, which they aren't here. Have you mapped the two cut points to the unit square and measured the valid area directly?",
        misconception: "false_symmetry_thirds",
      },
      {
        value: 1 / 8,
        feedback:
          "Careful, that halves things one time too many, double-counting the excluded corners. When you remove the regions where some piece exceeds ½, do those regions actually overlap?",
        misconception: "double_counted_excluded_region",
      },
    ],
    needsVerification: true,
    source: "Broken-stick triangle probability",
  },
  {
    id: "pr-birthday",
    prompt:
      "In a room of randomly chosen people (365 equally likely birthdays, ignore leap years), what is the SMALLEST group size for which the probability that at least two share a birthday exceeds 50%? (Enter a whole number.)",
    answer: 23,
    unit: "",
    explanation:
      "P(all distinct) = 365/365 · 364/365 · … drops below 1/2 once the group reaches 23 people, so the shared-birthday probability first exceeds 50% at 23.",
    difficulty: "hard",
    concept: "Birthday problem / complement",
    commonErrors: [
      {
        value: 183,
        feedback:
          "That's the 'about half of 365' instinct, but that compares each person to one fixed date. Here we count matches among all PAIRS of people, how fast does the number of pairs grow with group size?",
        misconception: "pairs_vs_people",
      },
      {
        value: 30,
        feedback:
          "A bit high, you're over-guessing. Track the product 365/365 · 364/365 · … and find where it first dips below ½; is 30 really the earliest such size?",
        misconception: "birthday_overguess",
      },
      {
        value: 20,
        feedback:
          "Close, but a touch low. Multiply the 'all distinct' probabilities one person at a time, has the collision probability already crossed ½ by 20 people?",
        misconception: "birthday_underguess",
      },
    ],
    needsVerification: true,
    source: "Birthday paradox",
  },
];

const latticeProblemsNumeric: NumericQuestion[] = [
  {
    id: "pr-lattice-count",
    prompt:
      "Moving only right or up along grid lines, how many distinct monotonic lattice paths go from (0,0) to (4,3)? (Enter a whole number.)",
    answer: 35,
    unit: "",
    explanation:
      "Any path is a sequence of 4 R's and 3 U's; choose which 3 of the 7 steps are U: C(7,3) = 35.",
    difficulty: "medium",
    concept: "Lattice paths / combinations",
    commonErrors: [
      {
        value: 12,
        feedback:
          "Close! Multiplying 4·3 counts something else entirely. A path is a sequence of R's and U's, in how many ways can you choose which of the steps are the up-moves?",
        misconception: "multiplied_coordinates",
      },
      {
        value: 7,
        feedback:
          "That's just 4+3, the total number of steps, not the number of orderings. Of those 7 steps, which are the up-moves, how many ways to pick them?",
        misconception: "added_coordinates",
      },
      {
        value: 343,
        feedback:
          "Careful, 7³ counts ordered choices with replacement, but here you have a fixed number of each step. Shouldn't you instead choose positions for the 3 U's among 7 slots?",
        misconception: "ordered_with_replacement",
      },
    ],
    source: "Lattice path counting",
  },
  {
    id: "pr-ballot",
    prompt:
      "In an election, candidate A gets 5 votes and B gets 3. If the 8 votes are counted in a uniformly random order, what is the probability A is strictly ahead of B throughout the entire count? (Enter a fraction or decimal.)",
    answer: 0.25,
    decimals: 2,
    unit: "",
    explanation:
      "By the Ballot Theorem, P(A always strictly ahead) = (a − b)/(a + b) = (5 − 3)/(5 + 3) = 2/8 = 1/4.",
    difficulty: "expert",
    concept: "Ballot problem / reflection principle",
    commonErrors: [
      {
        value: 5 / 8,
        feedback:
          "Close! 5/8 is A's overall share of the vote, but the question asks about staying strictly ahead the WHOLE count. Which formula uses the difference (a−b), not a alone?",
        misconception: "final_share_not_ballot",
      },
      {
        value: 2 / 5,
        feedback:
          "Not quite, that looks like a miscount of the favorable orderings. Try the ballot formula built directly from a and b rather than enumerating sequences.",
        misconception: "miscounted_favorable_orderings",
      },
      {
        value: 0.5,
        feedback:
          "A coin-flip guess won't capture the vote imbalance. With A leading 5 to 3, should being 'always ahead' really be an even split?",
        misconception: "must_be_half",
      },
    ],
    needsVerification: true,
    source: "Bertrand's ballot problem",
  },
  {
    id: "pr-catalan",
    prompt:
      "Moving right or up from (0,0) to (3,3) WITHOUT ever going above the main diagonal (staying in y ≤ x), how many such paths are there? (Enter a whole number.)",
    answer: 5,
    unit: "",
    explanation:
      "These are Dyck paths, counted by the Catalan number C₃ = C(6,3)/(3+1) = 20/4 = 5.",
    difficulty: "expert",
    concept: "Catalan numbers / constrained paths",
    commonErrors: [
      {
        value: 20,
        feedback:
          "Close! C(6,3)=20 counts EVERY monotone path, but many cross above the diagonal. How do you discount the paths that violate y ≤ x?",
        misconception: "all_paths_ignore_diagonal",
      },
      {
        value: 6,
        feedback:
          "Not quite, that's a small miscount. Take the total monotone paths C(6,3) and divide by (n+1); what does that give for a 3×3 grid?",
        misconception: "catalan_miscount",
      },
      {
        value: 10,
        feedback:
          "Careful, that's a different Catalan number than the one for this grid. Which index n applies when you travel from (0,0) to (3,3)?",
        misconception: "wrong_catalan_index",
      },
    ],
    needsVerification: true,
    source: "Catalan / Dyck paths",
  },
  {
    id: "pr-coupon",
    prompt:
      "You roll a fair 6-sided die repeatedly. What is the expected number of rolls to see all six faces at least once? (Enter a fraction or decimal.)",
    answer: 14.7,
    decimals: 1,
    unit: "",
    explanation:
      "Coupon collector: E = n·H_n = 6·(1 + 1/2 + 1/3 + 1/4 + 1/5 + 1/6) = 6 · 2.45 = 14.7.",
    difficulty: "hard",
    concept: "Coupon collector",
    commonErrors: [
      {
        value: 6,
        feedback:
          "Close, but 6 is just the number of faces, it ignores how the wait for each NEW face grows. After you've already seen 5 faces, how long on average until the last one?",
        misconception: "count_faces_not_wait",
      },
      {
        value: 21,
        feedback:
          "That's 1+2+…+6, a tempting shortcut. Coupon collector sums the RECIPROCALS 1/k, not the integers, what is 6·(1 + 1/2 + … + 1/6)?",
        misconception: "summed_1_to_n",
      },
      {
        value: 36,
        feedback:
          "6² over-counts. The expected total is n times a harmonic sum, not n·n, which harmonic terms should you be adding?",
        misconception: "n_squared_overcount",
      },
    ],
    needsVerification: true,
    source: "Coupon collector problem",
  },
  {
    id: "pr-grid-collision",
    prompt:
      "On a 2×2 grid of lattice points (coordinates 0–2), person A starts at (0,0) and takes a uniformly random monotone path (steps right/up) to (2,2); person B starts at (2,2) and takes a uniformly random monotone path (steps left/down) to (0,0). Both take one step per second. What is the probability they occupy the same lattice point at the same time? (Enter a fraction or decimal.)",
    answer: 0.5,
    decimals: 2,
    unit: "",
    explanation:
      "A's position after t steps has coordinate-sum t; B's has coordinate-sum 4−t. They can only coincide when t = 4−t, i.e. t = 2, on the middle anti-diagonal {(2,0),(1,1),(0,2)}. Each walker lands there with distribution (1/6, 4/6, 1/6). P(meet) = (1/6)² + (4/6)² + (1/6)² = 18/36 = 1/2.",
    difficulty: "expert",
    concept: "Lattice-path collision / simultaneous random walks",
    commonErrors: [
      {
        value: 1 / 3,
        feedback:
          "Close! But the three middle anti-diagonal points aren't equally likely. What's the actual landing distribution, is reaching (1,1) as likely as reaching a corner?",
        misconception: "uniform_midpoint_assumption",
      },
      {
        value: 4 / 9,
        feedback:
          "Not quite, that counts only the center-to-center meeting and skips the two corner meetings. Shouldn't you add the matching-probability products over ALL points on the middle diagonal?",
        misconception: "center_meeting_only",
      },
      {
        value: 1 / 36,
        feedback:
          "That's just both walkers sitting at one specific corner. Have you summed over every point where the two could coincide, not only one?",
        misconception: "single_corner_only",
      },
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
    mode: "numeric",
    masteryThreshold: 0.8,
    numericGenerator: mixNumericGenerators([
      genUnionNumeric,
      genIntersectionIndepNumeric,
      genCombinationsNumeric,
    ]),
    questionCount: 5,
    lesson: {
      paragraphs: [
        "Probability starts with a sample space of equally likely outcomes. P(event) = favorable / total. Two rules do most of the early work: for 'A OR B' use inclusion–exclusion P(A)+P(B)−P(A∩B); for independent 'A AND B' multiply P(A)·P(B).",
        "The classic trap: adding probabilities for 'or' without subtracting the overlap, or multiplying for 'or'. And when counting, decide whether ORDER matters, combinations C(n,r) if not, permutations if it does.",
      ],
      keyIdea: "P(A∪B) = P(A)+P(B)−P(A∩B); independent P(A∩B)=P(A)P(B).",
      whyInterviewers:
        "Roughly half of a trader interview is probability; these are the atoms.",
      deepDive: {
        whyItWorks:
          "Probability of an event is the fraction of equally likely outcomes it covers. The union rule corrects for double-counting the shared overlap, independence lets a joint probability factor into a product, and choosing combinations vs permutations fixes whether order is part of the sample space.",
        approach: [
          "Fix the sample space and check the outcomes are equally likely.",
          "Decide whether the event is an OR (union), an AND (joint), or a pure count.",
          "For a union, add the individual probabilities and subtract the overlap.",
          "For independent events, multiply the individual probabilities.",
          "When counting, decide whether order matters before choosing combinations or permutations.",
        ],
        pitfalls: [
          "Adding probabilities for 'or' without subtracting the shared overlap.",
          "Multiplying probabilities for 'or' as if it were an independent 'and'.",
          "Assuming events are independent when one actually affects the other.",
          "Using ordered permutations when the selection is really unordered.",
        ],
      },
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
    mode: "numeric",
    masteryThreshold: 0.8,
    numericGenerator: mixNumericGenerators([
      genConditionalNumeric,
      genBayesNumeric,
      genAtLeastOneNumeric,
    ]),
    questionCount: 5,
    lesson: {
      paragraphs: [
        "Conditional probability P(A|B) = P(A∩B)/P(B), the probability of A within the world where B happened. Do NOT confuse P(A|B) with P(B|A); that inversion is the 'prosecutor's fallacy.'",
        "Bayes' theorem formalizes updating: P(H|E) = P(E|H)P(H) / P(E). With a rare condition, a low PRIOR dominates even an accurate test, the base rate matters. For 'at least one', use the complement: 1 − P(none).",
      ],
      keyIdea: "Bayes: posterior ∝ likelihood × prior; never drop the base rate.",
      whyInterviewers:
        "Bayesian updating under new information is exactly the market-making mindset.",
      deepDive: {
        whyItWorks:
          "Conditioning restricts attention to the world where the evidence holds, so you renormalize by the probability of that evidence. Bayes reverses a conditional by weighting each likelihood by its prior, which is why a rare base rate can dominate even an accurate test.",
        approach: [
          "Restrict to the outcomes where the conditioning event holds.",
          "Divide the joint probability by the probability of that event.",
          "To reverse a conditional, weight each likelihood by its prior probability.",
          "Normalize over all the ways the evidence can occur.",
          "For 'at least one', compute one minus the probability of none.",
        ],
        pitfalls: [
          "Confusing P(A|B) with P(B|A), the prosecutor's fallacy.",
          "Ignoring the base rate/prior when the condition is rare.",
          "Forgetting to renormalize by the probability of the evidence.",
          "Adding per-trial probabilities instead of using the complement for 'at least one'.",
        ],
      },
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
    mode: "numeric",
    masteryThreshold: 0.8,
    numericGenerator: mixNumericGenerators([
      genExpectedValueNumeric,
      genBinomialNumeric,
      genGeometricNumeric,
    ]),
    questionCount: 5,
    lesson: {
      paragraphs: [
        "Expected value weights each payoff by its probability: E = Σ p·x. The #1 mistake is averaging payoffs without weighting. For k successes in n independent trials, the binomial gives C(n,k)pᵏ(1−p)ⁿ⁻ᵏ, the C(n,k) counts the arrangements you must not forget.",
        "Waiting-time intuition: if each trial succeeds with probability p, the expected number of trials to the first success is 1/p (geometric). A fair coin's first head takes 2 flips on average.",
      ],
      keyIdea: "E = Σ p·x; binomial needs the C(n,k); geometric mean is 1/p.",
      whyInterviewers:
        "EV is the language of every pricing and betting decision on the desk.",
      deepDive: {
        whyItWorks:
          "Expected value is a probability-weighted average, so each payoff must be scaled by how likely it is. The binomial coefficient counts the equally likely arrangements of successes among the trials, and a geometric waiting time averages to the reciprocal of the per-trial success probability.",
        approach: [
          "Weight each possible payoff by its probability and sum.",
          "For a fixed number of independent trials, count the arrangements of successes with a binomial coefficient.",
          "Multiply that count by the probability of one specific success/failure pattern.",
          "For a waiting time, take the reciprocal of the single-trial success probability.",
        ],
        pitfalls: [
          "Averaging payoffs equally instead of weighting each by its probability.",
          "Dropping the C(n,k) arrangement factor in the binomial.",
          "Reporting the probability of one specific sequence instead of all matching ones.",
          "Confusing the mean wait 1/p with the success probability p itself.",
        ],
      },
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
    mode: "numeric",
    masteryThreshold: 0.7,
    numericQuestions: hardProblemsNumeric,
    drawCount: 5,
    lesson: {
      paragraphs: [
        "Real interview probability is about setting up STATES and recursions. Expected waiting times for coin patterns (why HH takes 6 flips but HT takes 4), random walks on graphs (the ant on a cube), and gambler's ruin all fall to the same tool: define E for each state and solve the linear system.",
        "Gambler's ruin: in a fair game, the probability of hitting N before 0 from i is simply i/N. Geometric probability (the broken stick) maps the randomness to an area. Set up the equations before reaching for a formula.",
      ],
      keyIdea: "Define states, write E[state] = 1 + Σ transitions, solve.",
      whyInterviewers:
        "These are the exact recursion/EV problems asked on superdays.",
      deepDive: {
        whyItWorks:
          "Most of these problems have no plug-in formula but a hidden recursive structure: define an unknown (expected time or hitting probability) for each state, relate the states by conditioning on the first step, and solve the linear system. Geometric-probability problems instead map the randomness to a region and compare areas.",
        approach: [
          "Identify the distinct states the process can be in.",
          "Let each state's expected value or hitting probability be an unknown.",
          "Condition on the first step to relate each state to its neighbors.",
          "Add one per step taken when writing expected-time equations.",
          "Solve the linear system, or measure the favorable region for geometric problems.",
        ],
        pitfalls: [
          "Assuming a wrong step costs only one move instead of resetting progress (why HH is slower than HT).",
          "Ignoring the starting position in gambler's ruin, the answer is i/N, not ½.",
          "Comparing people to one fixed date instead of comparing all pairs (birthday problem).",
          "Forgetting one of the triangle inequalities when carving a geometric-probability region.",
        ],
      },
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
    mode: "numeric",
    masteryThreshold: 0.7,
    numericQuestions: latticeProblemsNumeric,
    drawCount: 5,
    lesson: {
      paragraphs: [
        "Lattice-path counting turns a geometry question into a combinations question: monotone paths to (m,n) number C(m+n,n). Constrain them (stay below the diagonal) and you get Catalan numbers; the reflection principle powers the ballot problem P = (a−b)/(a+b).",
        "For colliding random walkers, exploit a conserved quantity: if both move one step per second, their coordinate-SUMS evolve deterministically, so they can only meet at one specific time. Reduce to the distribution on that anti-diagonal and sum the matching-probability products.",
      ],
      keyIdea:
        "Paths ⇒ C(m+n,n); constraints ⇒ Catalan/reflection; collisions ⇒ conserved sums.",
      whyInterviewers:
        "The 'two walkers on a grid' family is a favorite hard screen, it rewards structure over brute force.",
      deepDive: {
        whyItWorks:
          "A monotone lattice path is just a sequence of right/up steps, so counting paths reduces to choosing which steps go one way, a combination. A boundary constraint (stay below the diagonal) is handled by the reflection principle, giving Catalan/ballot counts, and colliding walkers are tamed by a conserved coordinate-sum that pins down when they can meet.",
        approach: [
          "Encode each path as a sequence of steps and count it with a binomial coefficient.",
          "For a boundary constraint, subtract the reflected 'bad' paths (reflection principle).",
          "For collisions, find a conserved quantity that fixes the possible meeting time.",
          "Reduce to the distribution over the meeting locations and sum the matching-probability products.",
        ],
        pitfalls: [
          "Multiplying or adding the coordinates instead of using a combination.",
          "Counting all monotone paths while ignoring the below-diagonal constraint (C(m+n,n) vs Catalan).",
          "Using the final vote share a/(a+b) instead of the ballot formula (a−b)/(a+b).",
          "Treating the meeting points as uniform instead of binomially weighted.",
        ],
      },
    },
  },
];

export const probabilityTrack: Track = {
  id: "probability",
  title: "Probability & Statistics",
  tagline: "Probability from the ground up to interview-hard",
  description:
    "Reason under uncertainty, sample spaces, Bayes, and expectation up to Kelly sizing, Markov chains, and game theory, with fresh, exactly-verified problems.",
  motif: "probability",
  // Core probability route, then the Betting & Sizing subcategory (numeric
  // free-entry Kelly factory). Future Probability & Statistics subcategories
  // append via `probabilityStatsSubcategoryLevels`.
  levels: [...levels, ...probabilityStatsSubcategoryLevels],
};
