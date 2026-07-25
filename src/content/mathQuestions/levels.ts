import type { Level, Track } from "@/types/content";
import {
  ALGEBRA_SYSTEMS,
  COUNTING,
  GEOMETRY,
  NUMBER_THEORY,
  RATE_WORK,
  mixNumeric,
  mixQuiz,
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
    mode: "quiz",
    masteryThreshold: 0.8,
    questionCount: 5,
    generator: mixQuiz(NUMBER_THEORY),
    lesson: {
      paragraphs: [
        "Series are counts × averages: the sum of a range is (#terms)·(average), and the odd numbers in a range are their own arithmetic progression — don't accidentally sum everything or reach for n² outside 1,3,5,…",
        "Counting multiples in [lo, hi] is ⌊hi/d⌋ − ⌊(lo−1)/d⌋ (mind the lower boundary). For doubling growth, work BACKWARD by whole periods: if it's full on day D and doubles every k days, it was ¼ covered on day D − 2k — NOT on day D/4.",
      ],
      keyIdea: "Sum = terms × average; multiples via floors; undo doubling by periods.",
      whyInterviewers:
        "These expose whether you reason about structure or pattern-match to a wrong shortcut.",
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
    mode: "quiz",
    masteryThreshold: 0.8,
    questionCount: 5,
    generator: mixQuiz(COUNTING),
    lesson: {
      paragraphs: [
        "Counting is where confident wrong answers live. Packing cubes: FLOOR each dimension THEN multiply — dividing the volumes (30³/4³ ≈ 421) reuses wasted edge space that can't hold a cube (the answer is ⌊30/4⌋³ = 343).",
        "Decide what a choice really is: a rectangle picks 2 of the vertical AND 2 of the horizontal lines (C(n+1,2)²), not just the equal-sided squares; arrangements of repeated letters divide by a factorial PER repeated symbol; a round-robin multiplies C(n,2) by the meetings per pair.",
      ],
      keyIdea: "Name the object exactly: floor-then-multiply, pairs of lines, per-symbol repeats.",
      whyInterviewers:
        "Interviewers plant the tempting over-count; getting the structure right is the test.",
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
