import type { Level } from "@/types/content";
import {
  genBoldPlay,
  genCubeWalk,
  genGridWalk,
  genLineWalk,
  genMigrations,
  genPatternRace,
  genPatternWait,
  genPolygonWalk,
  genResetChain,
  genRuinReach,
  genRunHeads,
  genSpinner,
  genTwoInARow,
  markovChainsFlashcards,
  mixNumeric,
  mixQuiz,
} from "./generators";
// Re-homed from the former "General" subcategory (random-walk / ruin family).
import { genAllForward, genDeuce, genRestart, genRuin } from "./genGeneralWalks";
import { markovGeneralFlashcards } from "./generalFlashcards";

/**
 * Markov Chain Probability — the SIXTH Probability & Statistics subcategory.
 * Every question in the 16-item dataset is an absorbing-Markov-chain setup
 * solved by FIRST-STEP ANALYSIS (E[s] = 1 + Σ P(s→s')·E[s'], E = 0 at absorbing
 * states) or the gambler's-ruin recurrence. The three families — expected
 * hitting time, gambler's ruin / reaching a target, and pattern races — are
 * clustered into 6 Candy-Crush levels ramping Easy → Hard, each using the mode
 * that best teaches it:
 *
 *   • `numeric`   — where a clean expected value is the point: two-state return
 *                   times / spinners / line walks (mc-1), coin-pattern & reset
 *                   waits (mc-2), and random walks on the cube/polygon/2-D grid
 *                   (mc-4).
 *   • `quiz`      — where NAMING the misconception teaches: pattern waits (the
 *                   "THH behaves like HHH" overlap trap) & pattern races (naive
 *                   ½) (mc-3), and gambler's-ruin symmetric-vs-biased & bold-play
 *                   traps (mc-5).
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
    mode: "quiz",
    masteryThreshold: 0.75,
    questionCount: 5,
    generator: mixQuiz([genPatternWait, genPatternRace]),
    lesson: {
      paragraphs: [
        "A pattern's expected wait depends on its SELF-OVERLAP, not just its probability. Conway's rule: E[wait for A] = 2·corr(A,A), where corr sums 2^{k−1} over each k for which A's last k symbols equal its first k. HHH overlaps itself heavily (→ 14); THH has no proper overlap (→ 8), so it's strictly faster even though both are 1/8 to appear in a fixed window. Assuming all length-3 patterns wait the same is the classic mistake.",
        "Pattern RACES are just as counterintuitive. Two patterns are NOT equally likely to appear first — Conway's odds formula turns their self- and cross-overlaps into the win odds. The famous case: HHH beats THH only if the first three flips are exactly HHH, so P = 1/8, not the naive ½. Weighting by expected speed is also wrong; it's the overlap structure that decides.",
      ],
      keyIdea: "Overlap sets both the wait (2·corr(A,A)) and the race — the naive ½ and 'equal waits' are traps.",
      whyInterviewers:
        "Pattern races are a favourite because the naive-½ answer is so tempting and so wrong.",
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
    mode: "quiz",
    masteryThreshold: 0.7,
    questionCount: 5,
    generator: mixQuiz([genRuinReach, genBoldPlay, genRuin]),
    lesson: {
      paragraphs: [
        "Gambler's ruin: starting with k units and winning each round w.p. p, the probability of reaching N before 0 is k/N ONLY for a fair game (p = ½). With any edge, use (1 − rᵏ)/(1 − rᴺ) where r = q/p. Reflexively reaching for k/N when p ≠ ½ is the signature error; also watch for inverting r (q/p vs p/q) and solving for the wrong player.",
        "Strategy matters too. In an UNFAVOURABLE game, BOLD play — staking as much as you can each round — strictly beats timid unit-stake betting, because it minimizes the number of rounds the house edge can grind you down. Solving the bold-play chain (e.g. start 3, target 5, p = 1/3 → 29/77 ≈ 0.377) gives a higher win probability than the timid ruin value.",
      ],
      keyIdea: "Biased ruin = (1−rᵏ)/(1−rᴺ), r=q/p; k/N is fair-game only; bold play beats timid when p<½.",
      whyInterviewers:
        "Ruin problems test whether you know when the symmetric shortcut fails and how strategy shifts the odds.",
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
        "Some Markov answers are not a single graded scalar. The Drunkard's Walk (a semi-infinite gambler's ruin one step from a cliff) is PIECEWISE: falling is certain when p ≤ ½ and only (1−p)/p when p > ½ — for p = 2/3 that's exactly 1/2, despite a 2:1 push toward safety. The birthday-repeat question is a judgment plus a number: a shuffle of 2000 tracks repeats after only ≈ 57 tracks, so a 'first 100 clean' bet is a loser.",
        "The rest are intuition checks: why HHH-before-THH is 1/8 (HHH can only win in the first three flips), why THH waits 8 while HHH waits 14 (self-overlap lengthens the wait), and how a steady 2/3 edge over an equal stake compounds into near-certain ruin for the opponent. Work each one through, reveal, and self-assess — there's no number to type.",
      ],
      keyIdea: "Piecewise/judgment answers: state the cases (Drunkard's Walk), quantify the risk (birthday), and name the intuition.",
      whyInterviewers:
        "The specials reward candidates who report the full piecewise picture rather than a single memorized number.",
    },
  },
];
