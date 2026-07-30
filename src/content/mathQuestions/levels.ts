import type { Level, Track } from "@/types/content";
import {
  ALGEBRA_SYSTEMS,
  COUNTING_NUMERIC,
  GEOMETRY,
  NUMBER_THEORY_NUMERIC,
  RATE_WORK,
  mixNumeric,
} from "./generators";
import { solvingUnknownsFlashcards } from "./flashcards";

/**
 * Math Questions — a NEW top-level track for DETERMINISTIC math word problems,
 * DISTINCT from Probability & Statistics. Answers are exact counts / measures /
 * times (not probabilities in [0,1]), so the track routes by answer SHAPE:
 *
 *   • clean scalar (a count, length, time)      → NUMERIC free-entry + verifier
 *   • rich misconception distractors             → QUIZ (distractor-rationale)
 *   • non-scalar (tuple / two-part / derivation) → FLASHCARD (integrity-based)
 *
 * The path is deliberately LEAN: six levels, one per problem FAMILY, ordered
 * easy → hard, each a `section`-labelled segment. Families are merged wherever a
 * single level teaches the idea (Solving-Unknowns SCALARS ride Algebra & Systems;
 * doubling/growth rides Number Theory; the non-scalar Solving-Unknowns answers
 * get the one flashcard level). Each level bundles its family behind a `mix*`
 * wrapper, so "generate another like this" re-runs the SAME sub-family fresh.
 */

const levels: Level[] = [
  {
    id: "mq-1",
    title: "Rate, Work & Motion",
    subtitle: "Combined rates, trips, currents, escalators",
    blurb:
      "Rate, work, and motion problems — combined fill-and-drain, two-leg trips, river currents, and escalator step counts, solved by net rates.",
    section: "Rates, Algebra & Word Problems",
    difficulty: "easy",
    mode: "numeric",
    masteryThreshold: 0.8,
    questionCount: 5,
    numericGenerator: mixNumeric(RATE_WORK),
    lesson: {
      paragraphs: [
        "Rate problems yield to one idea: combine rates, don't average them. Two inflows against a drain give a NET rate (add the fills, subtract the drain); time = amount ÷ net rate.",
        "For motion, watch what the medium does to your speed: a current adds to a drifting object but the same current must be untangled from a boat's own speed. Set up one equation per trip and eliminate the unknown.",
      ],
      keyIdea: "Combine rates (add/subtract), then time = work ÷ net rate.",
      whyInterviewers:
        "Rate/work setups are the bread-and-butter warm-ups on quant screens.",
      deepDive: {
        whyItWorks:
          "Rates measured per unit of time are additive over the same interval: processes acting together on one quantity add, and an opposing process subtracts, because in any fixed time the amounts they move simply combine. Speeds obey the same rule — a current or moving surface adds to (or resists) an object's own speed.",
        approach: [
          "Identify the quantity being changed and write every process's rate in the same units.",
          "Add the rates that help and subtract the rates that oppose to get a single net rate.",
          "For motion, adjust the object's own speed by the medium — add when carried, subtract when resisted.",
          "Write one equation per trip or scenario using time = amount ÷ rate.",
          "Eliminate the shared unknown across the equations and solve for what is asked.",
        ],
        pitfalls: [
          "Averaging the rates or the times instead of combining the rates.",
          "Dropping the opposing process (drain or current) or flipping its sign.",
          "Mixing units — per-minute against per-hour — before combining.",
          "Stopping at an intermediate value (a speed or one leg) instead of the quantity asked.",
        ],
      },
    },
  },
  {
    id: "mq-3",
    title: "Algebra & Systems",
    subtitle: "Triangular sums, systems, solving unknowns",
    blurb:
      "Set up and solve equations: triangular stacks, heads-and-legs systems, win/loss ledgers, self-referential lengths, and unknowns from pairwise products.",
    section: "Rates, Algebra & Word Problems",
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 5,
    numericGenerator: mixNumeric(ALGEBRA_SYSTEMS),
    lesson: {
      paragraphs: [
        "Translate words into equations, then solve. A triangular stack totals n(n+1)/2 (invert it — don't take a plain square root). A heads/legs count is a 2×2 system; a win/loss ledger backs the losses out of the net.",
        "'Solving unknowns' with clean numbers lives here too: a self-referential length (tail = head + ½ body, body = head + tail) collapses to a single multiple of the head, and three pairwise products hand you each value via a square root.",
      ],
      keyIdea: "Name the unknowns, write one equation per fact, then eliminate.",
      whyInterviewers:
        "Fast, correct algebra from a word problem is exactly what the desk rewards.",
      deepDive: {
        whyItWorks:
          "Each stated fact is a linear (or linearly reducible) equation in named unknowns; with as many independent equations as unknowns, the system has a single solution reachable by substitution and elimination. Some setups also carry an exact structure — a triangular total n(n+1)/2, or the product of the three pairwise products equalling the square of the overall product — that a closed form inverts directly.",
        approach: [
          "Give each unknown quantity its own letter.",
          "Translate every fact in the problem into its own equation.",
          "Substitute or eliminate to collapse the system down to a single unknown.",
          "Recognize an exact structure when it fits (triangular sum, pairwise-product identity) and invert it rather than guessing.",
          "Solve, then back-substitute to recover any remaining values.",
        ],
        pitfalls: [
          "Taking a plain square root of a triangular total instead of inverting n(n+1)/2.",
          "Writing fewer independent equations than there are unknowns.",
          "Reporting an intermediate unknown rather than the quantity actually asked.",
          "Forgetting the final square root after multiplying pairwise products together.",
        ],
      },
    },
  },
  {
    id: "mq-4",
    title: "Number Theory & Growth",
    subtitle: "Series, multiples, and doubling",
    blurb:
      "Number theory and growth — summing odd ranges, contiguous sums, counting multiples in an interval, and doubling growth (beware the half-in-time trap).",
    section: "Number Theory & Counting",
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.8,
    questionCount: 5,
    numericGenerator: mixNumeric(NUMBER_THEORY_NUMERIC),
    lesson: {
      paragraphs: [
        "Series are counts × averages: the sum of a range is (#terms)·(average), and the odd numbers in a range are their own arithmetic progression — don't accidentally sum everything or reach for n² outside 1,3,5,…",
        "Counting multiples in [lo, hi] is ⌊hi/d⌋ − ⌊(lo−1)/d⌋ (mind the lower boundary). For doubling growth, work BACKWARD by whole periods: if it's full on day D and doubles every k days, it was ¼ covered on day D − 2k — NOT on day D/4.",
      ],
      keyIdea: "Sum = terms × average; multiples via floors; undo doubling by periods.",
      whyInterviewers:
        "These expose whether you reason about structure or pattern-match to a wrong shortcut.",
      deepDive: {
        whyItWorks:
          "An arithmetic series sums to (number of terms) × (average of first and last term), because pairing terms inward from both ends gives equal sums. Multiples of d sit evenly among the integers, so counting them in an interval is a difference of floor divisions; and doubling multiplies by two each period, so undoing it means dividing by two once per whole period.",
        approach: [
          "Decide exactly which terms are included — all integers, only the odds, only the evens, or only the multiples.",
          "For a series, count the terms, average the first and last, and multiply.",
          "For multiples in [lo, hi], subtract ⌊(lo−1)/d⌋ from ⌊hi/d⌋.",
          "For doubling growth, work in whole periods, halving the coverage once per period as you step backward.",
        ],
        pitfalls: [
          "Summing every integer when only the odd (or only the even) ones are wanted.",
          "Misapplying 'the sum of the first n odds is n²' to a range that does not start at 1.",
          "Mishandling the lower boundary when counting multiples (an off-by-one).",
          "Applying the fraction to the day number instead of stepping back whole doubling periods.",
        ],
      },
    },
  },
  {
    id: "mq-2",
    title: "Counting & Arrangements",
    subtitle: "Packing, grids, multisets, schedules",
    blurb:
      "Counting done right — floor-then-multiply packing (343 not 421), rectangles vs squares on a grid, multiset arrangements, and round-robin schedules.",
    section: "Number Theory & Counting",
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.8,
    questionCount: 5,
    numericGenerator: mixNumeric(COUNTING_NUMERIC),
    lesson: {
      paragraphs: [
        "Counting is where confident wrong answers live. Packing cubes: FLOOR each dimension THEN multiply — dividing the volumes (30³/4³ ≈ 421) reuses wasted edge space that can't hold a cube (the answer is ⌊30/4⌋³ = 343).",
        "Decide what a choice really is: a rectangle picks 2 of the vertical AND 2 of the horizontal lines (C(n+1,2)²), not just the equal-sided squares; arrangements of repeated letters divide by a factorial PER repeated symbol; a round-robin multiplies C(n,2) by the meetings per pair.",
      ],
      keyIdea: "Name the object exactly: floor-then-multiply, pairs of lines, per-symbol repeats.",
      whyInterviewers:
        "Interviewers plant the tempting over-count; getting the structure right is the test.",
      deepDive: {
        whyItWorks:
          "Counting is exact when each object is built from independent choices you can multiply. Whole units must fit in each dimension, so you floor per edge (leftover space can't hold another unit); a rectangle is one pair of vertical lines and one pair of horizontal lines; identical items are interchangeable, so you divide by the factorial of each repeated symbol; and each unordered pair contributes one C(n,2) matchup.",
        approach: [
          "State precisely what a single valid object is.",
          "Break it into independent choices and multiply their counts.",
          "Floor each dimension first (never divide the total volumes) when whole units must fit.",
          "Divide by the factorial of each repeated element to cancel interchangeable duplicates.",
          "Use combinations for unordered pairs, then multiply by any repeats or meetings stated.",
        ],
        pitfalls: [
          "Dividing the volumes instead of flooring each dimension and then multiplying.",
          "Counting only the equal-sided squares when any rectangle is allowed (or the reverse).",
          "Treating repeated identical items as distinct, which over-counts the arrangements.",
          "Double-counting ordered pairs, or including an item paired with itself.",
        ],
      },
    },
  },
  {
    id: "mq-5",
    title: "Geometry",
    subtitle: "Angles, coverage, volumes, radii",
    blurb:
      "Geometry with clean answers — clock-hand angles, paint cans by ceiling division, box volume from edge clues, and a circle's radius by completing the square.",
    section: "Geometry & Derivations",
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 5,
    numericGenerator: mixNumeric(GEOMETRY),
    lesson: {
      paragraphs: [
        "Geometry rewards the exact relationship. The clock angle is |30·h − 5.5·m| because the HOUR hand also creeps as the minutes pass. Buying whole paint cans is ceiling division: round the area ÷ coverage UP.",
        "Sometimes the geometry is hidden in algebra: three linear clues on a box's edges pin its dimensions before you multiply for the volume, and a circle equation gives its radius once you complete the square: r = √((D/2)²+(E/2)²−F).",
      ],
      keyIdea: "Use the exact formula; round coverage up; complete the square for r.",
      whyInterviewers:
        "The clean-number geometry problem checks precision under time pressure.",
      deepDive: {
        whyItWorks:
          "Each answer follows from an exact relationship rather than an estimate: the hour hand keeps creeping as the minutes pass (half a degree per minute), items sold whole force you to round up, linear clues on the edges pin a box's dimensions before you multiply, and completing the square rewrites a circle equation as (x−h)² + (y−k)² = r².",
        approach: [
          "Write the exact formula for the quantity, not a rounded approximation.",
          "For the clock, account for BOTH hands moving, then take the smaller arc.",
          "Round up to the next whole unit whenever only whole units can be bought.",
          "Solve any hidden linear system for the individual edges before combining them.",
          "Complete the square to read off a circle's centre and radius.",
        ],
        pitfalls: [
          "Treating the minute hand as the only moving hand and ignoring the hour hand's creep.",
          "Rounding coverage down and leaving part of the surface bare.",
          "Adding the clue numbers instead of solving for the edges, or confusing surface area with volume.",
          "Forgetting the square root and reporting r² as the radius.",
        ],
      },
    },
  },
  {
    id: "mq-6",
    title: "Solving Unknowns & Derivations",
    subtitle: "Diophantine tuples, two-part & strategy answers",
    blurb:
      "Reason-it-out cards for non-scalar answers: Diophantine 5-tuples, the 2/3–1/3 glass split, and river-width / optimal-path / balance derivations.",
    section: "Geometry & Derivations",
    difficulty: "hard",
    mode: "flashcard",
    masteryThreshold: 0.7,
    flashcards: solvingUnknownsFlashcards,
    lesson: {
      paragraphs: [
        "Some answers aren't a single number to type. A linear Diophantine puzzle wants a full 5-tuple (A,B,C,D,E) — solve by substitution and elimination, using distinctness (and the odd inequality) to pin the last ambiguity.",
        "Others are two-part (the 2/3 & 1/3 glass split) or a whole derivation (a river's width from two crossings, the fastest road-then-field path, a balance mobile). Reason each out honestly, reveal, and grade yourself.",
      ],
      keyIdea: "Substitute, eliminate, and use distinctness/invariants to finish.",
      whyInterviewers:
        "Interviewers want your reasoning narrated — these reward derivation over recall.",
      deepDive: {
        whyItWorks:
          "These answers aren't a single scalar (a full tuple, a two-part split, or a derived measurement), so the method is structured reasoning rather than one formula. Substitution narrows the possibilities, and an invariant or extremal principle — distinctness of the digits, a combined-distance ratio, a geometric-series limit, or a speed-ratio optimum — pins the final answer exactly.",
        approach: [
          "Name the unknowns and translate every constraint into an equation or relation.",
          "Substitute and eliminate to shrink the set of candidate solutions.",
          "Use a distinctness condition or an inequality to break any remaining tie.",
          "For a derivation, identify the governing invariant or optimality condition before computing.",
          "State the complete answer (every part), then check it against every constraint.",
        ],
        pitfalls: [
          "Reporting one partial value instead of the whole tuple or two-part answer.",
          "Ignoring a distinctness or inequality clue that resolves the ambiguity.",
          "Summing a geometric series with the wrong first term or common ratio.",
          "Guessing the crossover/leave-the-road point instead of using the speed-ratio (refraction) condition.",
        ],
      },
    },
  },
];

export const mathQuestionsTrack: Track = {
  id: "math-questions",
  title: "Applied Math & Number Puzzles",
  tagline: "Applied Math & Number Puzzles",
  description:
    "Deterministic math word-problems with exact answers — rates & work, algebra & systems, number theory & counting, and geometry — verifier-checked and fresh every attempt.",
  motif: "mathQuestions",
  levels,
};
