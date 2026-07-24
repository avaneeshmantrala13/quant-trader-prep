import type { Level } from "@/types/content";
import { mixNumeric, mixQuiz } from "../coreScaffold";
import { genGeoArea, genGlance, genMeeting, genTileFit } from "./generators";

/**
 * Probability & Statistics — **Geometric Probability**: a focused topic
 * (re-homed from the former "General" grab-bag) on measure-ratio reasoning,
 * where a probability is the ratio of a favourable AREA or LENGTH to the total.
 * Two Candy-Crush levels ramping Easy → Hard:
 *
 *   • `quiz`    — geo-1 names the signature r-vs-r² area trap (distance is not
 *                 uniform; probability accumulates like the area x²).
 *   • `numeric` — geo-2 sets up the favourable region explicitly (a disk fitting
 *                 in a tile, two arrival windows overlapping, a glance catching a
 *                 cyclic event).
 *
 * Every level sets `section: "Geometric Probability"`. Exact solvers live in
 * `../coreSolvers`; generators + per-family distractor taxonomy in
 * `./generators.ts`. All playable items are freshly generated.
 */
const SECTION = "Geometric Probability";

export const geometricProbabilityLevels: Level[] = [
  {
    id: "geo-1",
    title: "Spot the Area Trap",
    subtitle: "r² (area), never r (distance)",
    blurb:
      "Name the geometric-probability trap: for a point uniform in a disk, P(within radius r) grows like the AREA r²/R², not the distance r/R.",
    section: SECTION,
    difficulty: "easy",
    mode: "quiz",
    masteryThreshold: 0.75,
    questionCount: 5,
    generator: mixQuiz([genGeoArea]),
    lesson: {
      paragraphs: [
        "The signature geometric-probability trap is treating distance as uniform. For a point landing uniformly in a disk, P(within radius r) = r²/R², NOT r/R, because outer rings hold more AREA. Using the linear r/R (e.g. 2/5 instead of 4/25) is the classic linear-vs-quadratic mistake.",
        "Geometric probability is always a ratio of areas (or lengths), so square what needs squaring. Watch two cousin errors too: answering the complement (the opposite event), and the dimensional slip r²/R (squaring the numerator but leaving the denominator linear). Both numerator and denominator must live in the same dimension.",
      ],
      keyIdea: "Disk probability ∝ r² (area), never r (distance); keep numerator and denominator the same dimension.",
      whyInterviewers:
        "This is a 'do you simplify or over-complicate' check — the tempting linear answer is exactly the wrong one.",
    },
  },
  {
    id: "geo-2",
    title: "Areas, Bands & Length Ratios",
    subtitle: "Draw the region, take the ratio",
    blurb:
      "Geometric probability as area/length ratios: a disk fitting inside a tile, two arrival windows overlapping, and a glance catching a cyclic change.",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 5,
    numericGenerator: mixNumeric([genTileFit, genMeeting, genGlance]),
    lesson: {
      paragraphs: [
        "Geometric probability = favourable measure ÷ total measure. A disk of radius r lands fully inside a tile iff its centre stays ≥ r from all four edges, shrinking the favourable region to a (side − 2r)² square. Two people arriving uniformly in [0,T] and each waiting w minutes MEET iff |x − y| ≤ w — a diagonal band in the T×T square whose area is T² minus two corner triangles.",
        "On a cycle, a glance of length g starting uniformly catches a change-instant iff it starts within g before it; if the pre-windows don't overlap, the favourable length is (number of changes)·g out of the period. In every case the recipe is the same: draw the sample space, shade the favourable set, take the ratio. Don't collapse a 2-D area to a 1-D length.",
      ],
      keyIdea: "Draw the sample space, shade the favourable set, divide — areas for 2-D, lengths for 1-D.",
      whyInterviewers:
        "Meeting-in-a-square and chip-on-a-tile problems test whether you can set up the right geometric region.",
    },
  },
];
