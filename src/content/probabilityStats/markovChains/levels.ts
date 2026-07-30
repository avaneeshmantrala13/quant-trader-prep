import type { Level } from "@/types/content";
import {
  genBoldPlayNumeric,
  genCubeWalk,
  genGridWalk,
  genLineWalk,
  genMigrations,
  genPatternRaceNumeric,
  genPatternWaitNumeric,
  genPolygonWalk,
  genResetChain,
  genRuinReachNumeric,
  genRunHeads,
  genSpinner,
  genTwoInARow,
  markovChainsFlashcards,
  mixNumeric,
} from "./generators";
// Re-homed from the former "General" subcategory (random-walk / ruin family).
import { genAllForward, genDeuce, genRestart, genRuinNumeric } from "./genGeneralWalks";
import { markovGeneralFlashcards } from "./generalFlashcards";
// Bucket 1 (UT M362M): stationary / limiting distributions (long-run fraction of time).
import {
  genStationaryReward,
  genThreeStateStationary,
  genTwoStateStationary,
} from "./stationaryGenerators";

/**
 * Markov Chain Probability — the SIXTH Probability & Statistics subcategory.
 * Every question in the 16-item dataset is an absorbing-Markov-chain setup
 * solved by FIRST-STEP ANALYSIS (E[s] = 1 + Σ P(s→s')·E[s'], E = 0 at absorbing
 * states) or the gambler's-ruin recurrence. The three families — expected
 * hitting time, gambler's ruin / reaching a target, and pattern races — are
 * clustered into 6 Candy-Crush levels ramping Easy → Hard, each using the mode
 * that best teaches it:
 *
 *   • `numeric`   — where a clean value is the point: two-state return times /
 *                   spinners / line walks (mc-1), coin-pattern & reset waits
 *                   (mc-2), pattern waits & races (mc-3), random walks on the
 *                   cube/polygon/2-D grid (mc-4), and the gambler's-ruin
 *                   reach / bold-play / biased-ruin probabilities (mc-5, now
 *                   free-response with tagged error-mode coaching).
 *   • `flashcard` — the reasoning specials whose answer is piecewise or a
 *                   judgment + number (the Drunkard's-Walk piecewise fall, the
 *                   birthday-repeat bet, and the overlap/edge intuitions) (mc-6).
 *
 * Every level sets `section: "Markov Chains"` so the map / Table of Contents
 * render a labeled segment. Exact solvers live in `./markov.ts`; the generators
 * + per-family distractor taxonomy in `./generators.ts`. NONE of the 16 source
 * questions are user-facing — they live only in `./markovChains.test.ts`.
 */
const SECTION = "Markov Chains";

export const markovChainsLevels: Level[] = [
  {
    id: "mc-1",
    title: "First-Step Analysis",
    subtitle: "One step, then recurse",
    blurb:
      "Set up E[s] = 1 + Σ P(s→s')·E[s'] with E=0 at absorbing states: two-state return times, spinner waits, and short symmetric walks.",
    section: SECTION,
    difficulty: "easy",
    mode: "numeric",
    masteryThreshold: 0.8,
    questionCount: 5,
    numericGenerator: mixNumeric([genMigrations, genSpinner, genLineWalk]),
    lesson: {
      paragraphs: [
        "Almost every Markov-chain interview question is solved the same way: define E[s] as the expected number of steps to absorption from state s, then write one equation per state — E[s] = 1 + Σ P(s→s')·E[s'] — with E = 0 at the absorbing (goal) states, and solve the small linear system. The '+1' is the step you just took; forgetting it is the single most common slip.",
        "Three easy shapes drill this. A two-state chain (a regime that persists then flips) gives E = 1 + (1−stay)/(1−otherStay). A spinner's wait to see two distinct regions is 1 + Σ P(r)/(1−P(r)) — you must weight each region's follow-on geometric wait by the chance you land there first. And a symmetric ±1 walk on a short line exits in startSite·(sites+1−startSite) steps — the gambler's-ruin duration i·(N−i).",
      ],
      keyIdea: "E[s] = 1 + Σ P(s→s')·E[s'], E=0 at absorbing states — never drop the +1.",
      whyInterviewers:
        "First-step analysis is the universal tool; desks check you can set up the equations before touching arithmetic.",
      deepDive: {
        whyItWorks:
          "Every expected-hitting-time question decomposes by conditioning on the very first move: the expected time equals one step plus the probability-weighted expected time from wherever that step lands you, and a goal/absorbing state has zero time remaining. That single identity turns an unbounded random process into a small, solvable set of linear equations.",
        approach: [
          "Give each state an unknown for its expected steps to absorption.",
          "Set the expected time at every goal/absorbing state to zero.",
          "For each remaining state, write one step plus the probability-weighted average of its neighbours' unknowns.",
          "Merge states that behave identically by symmetry to shrink the system.",
          "Solve the resulting linear system for the state you started in.",
        ],
        pitfalls: [
          "Dropping the leading '+1' — the transition you just took is itself a step.",
          "Reporting the shortest-path distance instead of the (larger) expected number of steps.",
          "Forgetting to weight each branch's follow-on wait by the chance you actually take it.",
        ],
      },
    },
  },
  {
    id: "mc-2",
    title: "Coin Pattern Waits",
    subtitle: "Runs, streaks & resets",
    blurb:
      "Expected waits for a run of n (2^{n+1}−2), two-in-a-row ((1+p)/p²), and reset chains — dodging the 1/pⁿ and n/p traps.",
    section: SECTION,
    difficulty: "easy",
    mode: "numeric",
    masteryThreshold: 0.8,
    questionCount: 5,
    numericGenerator: mixNumeric([genRunHeads, genTwoInARow, genResetChain]),
    lesson: {
      paragraphs: [
        "Waiting for a streak is a first-step recursion. For a run of n fair-coin successes, s_k = 1 + ½·s_{k+1} + ½·s_0 collapses to 2^{n+1}−2 (HHH → 14). The same skeleton governs a 'reset chain': need n things in a row and any failure wipes ALL progress (the parking-meter problem) — again 2^{n+1}−2. The trap is n/p, which pretends a failure costs only one step.",
        "For two successes in a row at general probability p, the two-state recursion gives (1+p)/p². The tempting 1/p² drops the +1 term — it would be right only if partial progress never reset, but after one success a failure knocks you back a step. Notice the pattern: overlap and reset behavior, not just per-trial probability, sets the wait.",
      ],
      keyIdea: "Run of n → 2^{n+1}−2; two-in-a-row → (1+p)/p²; a reset wipes ALL progress (not one step).",
      whyInterviewers:
        "Streak-waiting problems separate people who set up the recursion from those who guess 1/pⁿ.",
      deepDive: {
        whyItWorks:
          "Waiting for a streak is a first-step recursion over how much of the target you currently hold: from each partial-progress state you take one trial and either advance or fall back. Because a single failure can erase accumulated progress, the wait grows far faster than the per-trial probability alone would suggest.",
        approach: [
          "Define a state for each level of partial progress toward the target streak.",
          "Write each state's expected wait as one trial plus the weighted wait of where success and failure send you.",
          "Track exactly how far a failure knocks you back — one step, or all the way to the start.",
          "Back-substitute from the completed streak down to the start to get the closed form.",
        ],
        pitfalls: [
          "Assuming a failure costs only one trial when it actually wipes out all accumulated progress.",
          "Using the reciprocal of the streak's probability, which ignores overlapping restarts.",
          "Dropping the '+1' and reporting a plain geometric wait instead of the recursion's answer.",
        ],
      },
    },
  },
  {
    id: "mc-3",
    title: "Pattern Races & Overlap",
    subtitle: "Which pattern wins, and why",
    blurb:
      "Conway's rule for expected pattern waits and pattern races: overlap makes THH faster than HHH, and HHH-before-THH is 1/8, not ½.",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 5,
    numericGenerator: mixNumeric([genPatternWaitNumeric, genPatternRaceNumeric]),
    lesson: {
      paragraphs: [
        "A pattern's expected wait depends on its SELF-OVERLAP, not just its probability. Conway's rule: E[wait for A] = 2·corr(A,A), where corr sums 2^{k−1} over each k for which A's last k symbols equal its first k. HHH overlaps itself heavily (→ 14); THH has no proper overlap (→ 8), so it's strictly faster even though both are 1/8 to appear in a fixed window. Assuming all length-3 patterns wait the same is the classic mistake.",
        "Pattern RACES are just as counterintuitive. Two patterns are NOT equally likely to appear first — Conway's odds formula turns their self- and cross-overlaps into the win odds. The famous case: HHH beats THH only if the first three flips are exactly HHH, so P = 1/8, not the naive ½. Weighting by expected speed is also wrong; it's the overlap structure that decides.",
      ],
      keyIdea: "Overlap sets both the wait (2·corr(A,A)) and the race — the naive ½ and 'equal waits' are traps.",
      whyInterviewers:
        "Pattern races are a favourite because the naive-½ answer is so tempting and so wrong.",
      deepDive: {
        whyItWorks:
          "A pattern's waiting time and its head-to-head odds are governed by its self-overlap, not just its 1-in-2^L probability: when a near-miss leaves a usable suffix, you don't restart from scratch. Conway's leading-number rule converts these overlaps directly into expected waits and race odds.",
        approach: [
          "Compare each pattern's ending segments against its own beginning to measure self-overlap.",
          "Turn that self-overlap into the expected wait via Conway's rule.",
          "For a race, also compare each pattern's endings against the other pattern (cross-overlap).",
          "Combine the self- and cross-overlaps into the win odds instead of guessing.",
        ],
        pitfalls: [
          "Believing all equal-length patterns wait the same or are equally likely to appear first.",
          "Defaulting to a 50/50 answer in a race between two patterns.",
          "Assuming the faster-to-appear pattern wins in proportion to its speed.",
        ],
      },
    },
  },
  {
    id: "mc-4",
    title: "Random Walks on Graphs",
    subtitle: "Cubes, rings & lattices",
    blurb:
      "Expected hitting times on a cube (10), a polygon with a 'stay' move, and a 2-D grid center-to-boundary — via symmetry + a linear solve.",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 5,
    numericGenerator: mixNumeric([genCubeWalk, genPolygonWalk, genGridWalk]),
    lesson: {
      paragraphs: [
        "On a symmetric graph, group states into symmetry classes to shrink the system. A random walk from a cube corner to the opposite corner reduces to a 4-state distance chain and solves to 10 steps; a beetle on a polygon (with a 'stay' move that stretches every time by 1/(1−P(stay))) reduces to a distance chain along the ring. The graph DISTANCE is only the minimum — expected times are always larger.",
        "When symmetry runs out, just solve the linear system directly: for a walker on a 2-D grid, E = 1 + ¼·(sum of the four neighbours) at every interior point, with E = 0 on the boundary. A common trap is using the 1-D exit time m² for the center of a grid — in two dimensions there are twice as many escape routes, so the true expected time is smaller.",
      ],
      keyIdea: "Reduce by symmetry, else solve E = 1 + Σ P·E' directly; graph distance is a floor, not the answer.",
      whyInterviewers:
        "Ant-on-a-cube and grid-escape problems test whether you can exploit symmetry and set up a solvable system.",
      deepDive: {
        whyItWorks:
          "On a graph the expected hitting time still obeys 'one step plus the average of the neighbours', but symmetry lets you collapse many equivalent vertices into a single distance class, shrinking the system to something solvable by hand. When symmetry runs out you simply solve the interior linear system directly.",
        approach: [
          "Group vertices into classes that the graph's symmetry makes interchangeable.",
          "Write one equation per class: a step plus the average over neighbouring classes.",
          "Account for any 'stay' move that wastes a turn before real progress.",
          "Set the target/boundary to zero expected time and solve the reduced system.",
        ],
        pitfalls: [
          "Reporting the shortest-path (graph-distance) count as the expected time.",
          "Reusing a one-dimensional exit-time formula when extra dimensions add escape routes.",
          "Ignoring self-loops or 'stay' probabilities that stretch every expected time.",
        ],
      },
    },
  },
  {
    id: "mc-walk",
    title: "Random Walks & Recursion",
    subtitle: "All-forward walks, deuce & restart",
    blurb:
      "Short random-walk and self-referential recursions: all-forward walks (½ per step), the win-by-two deuce recursion, and restart-game geometric series.",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 5,
    numericGenerator: mixNumeric([genAllForward, genDeuce, genRestart]),
    lesson: {
      paragraphs: [
        "Many walk problems collapse to a product of ½'s: to arrive in the minimum time, EVERY remaining step must go forward, so if the first step is forced the probability is (½)^{steps−1}. Watch which steps are free versus forced. The complement ('takes longer than the minimum') is then 1 minus that.",
        "Self-referential games use the fact that a state repeats. In a win-by-two ('deuce') game from a tie, P(win) = p² + 2p(1−p)·P(win), because a split returns you to the identical tied state; solving gives p²/(p² + (1−p)²). Restart games (nobody wins ⇒ replay) are a geometric series: P(A wins) = x/(x+y) where x, y are the per-round ending probabilities.",
      ],
      keyIdea: "All-forward = (½)^{free steps}; deuce = p²/(p²+(1−p)²); restart = x/(x+y).",
      whyInterviewers:
        "Deuce and restart recursions test whether you can exploit a repeating state instead of summing infinitely.",
      deepDive: {
        whyItWorks:
          "Many short-walk and repeated-game problems collapse because a state recurs: a 'split' or 'no-decision' round returns you to an identical situation, so you can write one equation in the unknown probability and solve it rather than summing an infinite series. For minimum-time events you simply multiply the independent per-step probabilities.",
        approach: [
          "Separate forced steps from freely random ones, and multiply the free probabilities for a minimum-time event.",
          "Spot any state the process can return to completely unchanged.",
          "Write the win probability as 'resolve now, or return to the same state and try again'.",
          "Solve that single equation, or normalise the per-round ending probabilities.",
        ],
        pitfalls: [
          "Treating a forced first step as if it were a random coin flip.",
          "Summing an infinite series instead of exploiting the repeating state.",
          "Forgetting to normalise by the total chance the round actually ends.",
        ],
      },
    },
  },
  {
    id: "mc-5",
    title: "Gambler's Ruin",
    subtitle: "Reach the target before ruin",
    blurb:
      "Biased ruin (1−rᵏ)/(1−rᴺ) vs the fair-game k/N trap, plus bold play — which beats timid betting in an unfavourable game.",
    section: SECTION,
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 5,
    numericGenerator: mixNumeric([genRuinReachNumeric, genBoldPlayNumeric, genRuinNumeric]),
    lesson: {
      paragraphs: [
        "Gambler's ruin: starting with k units and winning each round w.p. p, the probability of reaching N before 0 is k/N ONLY for a fair game (p = ½). With any edge, use (1 − rᵏ)/(1 − rᴺ) where r = q/p. Reflexively reaching for k/N when p ≠ ½ is the signature error; also watch for inverting r (q/p vs p/q) and solving for the wrong player.",
        "Strategy matters too. In an UNFAVOURABLE game, BOLD play — staking as much as you can each round — strictly beats timid unit-stake betting, because it minimizes the number of rounds the house edge can grind you down. Solving the bold-play chain (e.g. start 3, target 5, p = 1/3 → 29/77 ≈ 0.377) gives a higher win probability than the timid ruin value.",
      ],
      keyIdea: "Biased ruin = (1−rᵏ)/(1−rᴺ), r=q/p; k/N is fair-game only; bold play beats timid when p<½.",
      whyInterviewers:
        "Ruin problems test whether you know when the symmetric shortcut fails and how strategy shifts the odds.",
      deepDive: {
        whyItWorks:
          "Gambler's ruin is a birth–death walk between broke and a target; solving its first-step recursion gives a clean formula whose shape depends entirely on whether the game is fair. With any per-round edge the reach probability becomes a ratio of powers of the loss-to-win odds, and strategy also matters because bold betting limits how many edged rounds the house can grind you through.",
        approach: [
          "Form the odds ratio of losing to winning a single round.",
          "Use the fair-game linear shortcut only when the per-round odds are exactly even.",
          "Otherwise apply the biased ratio-of-powers formula with the correct start and target.",
          "In an unfavourable game, prefer a strategy that reaches the target in fewer edged rounds.",
        ],
        pitfalls: [
          "Using the fair-game start/target shortcut when the per-round odds are not even.",
          "Inverting the odds ratio (win-over-loss instead of loss-over-win).",
          "Solving for the wrong player's outcome.",
          "Assuming timid unit-stake betting is never beaten by bold play in an edged game.",
        ],
      },
    },
  },
  {
    id: "mc-stationary",
    title: "Stationary & Limiting Distributions",
    subtitle: "Solve πP=π for the long-run fraction of time",
    blurb:
      "Steady state: solve πP=π with Σπ=1 for the long-run fraction of time in a state (π₀=b/(a+b) for 2 states), plus long-run average reward and a 3-state solve.",
    section: SECTION,
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 5,
    numericGenerator: mixNumeric([
      genTwoStateStationary,
      genStationaryReward,
      genThreeStateStationary,
    ]),
    lesson: {
      paragraphs: [
        "An irreducible, aperiodic Markov chain forgets where it started: the fraction of time it spends in each state converges to a STATIONARY distribution π solving πP = π together with Σπ = 1. This is a small linear system — the same 'balance' idea as first-step analysis, but now for long-run occupancy rather than hitting times. For a 2-state chain with switch rates a (leave state 0) and b (enter state 0), the closed form is π₀ = b/(a+b), π₁ = a/(a+b): the steady-state weight of a state is proportional to the rate of flowing INTO it. It is 50/50 only when a = b.",
        "Two moves cover most interview questions. 'Long-run fraction of time' IS π. And a 'long-run average reward/cost' weights each state's payoff by its stationary probability: Σ πᵢ rᵢ — not an unweighted average. For 3+ states, just solve πP = π with the normalisation; a uniform answer (1/n) only occurs for a doubly-stochastic chain.",
      ],
      keyIdea: "π solves πP=π, Σπ=1; 2-state π₀=b/(a+b); long-run reward = Σπᵢrᵢ (weighted, not averaged).",
      whyInterviewers:
        "'Long-run fraction of time' and steady-state questions are a real interview genre; the πP=π setup is the tell.",
      deepDive: {
        whyItWorks:
          "An irreducible, aperiodic chain forgets its start, so the long-run fraction of time in each state converges to a stationary distribution that balances inflow against outflow (πP = π) and sums to one. A state's steady-state weight is proportional to the rate of flowing into it, and any long-run average weights each state's payoff by this stationary probability.",
        approach: [
          "Write the balance equations setting each state's inflow equal to its outflow.",
          "Add the normalisation that all the stationary probabilities sum to one.",
          "Solve the small linear system for the stationary vector.",
          "For a long-run average, weight each state's reward by its stationary probability.",
        ],
        pitfalls: [
          "Assuming the steady state is uniform or 50/50 regardless of the transition rates.",
          "Reporting the ratio of switch rates (odds) instead of a normalised probability.",
          "Taking an unweighted average of rewards instead of weighting by the stationary distribution.",
        ],
      },
    },
  },
  {
    id: "mc-6",
    title: "Markov Reasoning Desk",
    subtitle: "Piecewise answers & judgment calls",
    blurb:
      "Reason through the specials whose answer is piecewise or a judgment + number: the Drunkard's Walk, the birthday-repeat bet, overlap & edge intuition.",
    section: SECTION,
    difficulty: "hard",
    mode: "flashcard",
    masteryThreshold: 0.75,
    flashcards: [...markovChainsFlashcards, ...markovGeneralFlashcards],
    lesson: {
      paragraphs: [
        "Some Markov answers are not a single graded scalar. The Drunkard's Walk (a semi-infinite gambler's ruin one step from a cliff) is PIECEWISE: falling is certain when p ≤ ½ and only (1−p)/p when p > ½ — for p = 3/4 that's exactly 1/3, despite a 3:1 push toward safety. The birthday-repeat question is a judgment plus a number: a shuffle of 1500 tracks repeats after only ≈ 49 tracks, so a 'first 90 clean' bet is a loser.",
        "The rest are intuition checks: why HHH-before-THH is 1/8 (HHH can only win in the first three flips), why THH waits 8 while HHH waits 14 (self-overlap lengthens the wait), and how a steady 2/3 edge over an equal stake compounds into near-certain ruin for the opponent. Work each one through, reveal, and self-assess — there's no number to type.",
      ],
      keyIdea: "Piecewise/judgment answers: state the cases (Drunkard's Walk), quantify the risk (birthday), and name the intuition.",
      whyInterviewers:
        "The specials reward candidates who report the full piecewise picture rather than a single memorized number.",
      deepDive: {
        whyItWorks:
          "Some Markov questions don't reduce to a single graded number: the answer is a piecewise rule that switches behaviour at a threshold (like a fair-versus-biased boundary) or a judgment call backed by an order-of-magnitude estimate. The same first-step and overlap tools apply, but the deliverable is the full case analysis, not one value.",
        approach: [
          "Set up the same first-step or overlap recursion you would for a scalar answer.",
          "Watch for a critical threshold where the qualitative behaviour flips, and split into cases.",
          "State each regime's behaviour explicitly rather than collapsing everything to one number.",
          "For 'is this bet safe?' questions, estimate the typical scale and compare it to the claim.",
        ],
        pitfalls: [
          "Reporting a single number when the honest answer is piecewise.",
          "Assuming a strong per-step bias guarantees the favourable outcome.",
          "Trusting that a small-looking count is safe when coincidences accumulate faster than intuition expects.",
        ],
      },
    },
  },
];
