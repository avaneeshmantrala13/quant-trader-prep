import type { Level } from "@/types/content";
import { mixNumeric } from "../coreScaffold";
import { genBranchingMean, genExtinction } from "./generators";

/**
 * **Branching processes** (Galton–Watson), a first-class course-completeness
 * topic (M362M core; academic for interviews). One `numeric` level. Its own
 * `section` (`probability::Branching Processes`) = its own mastery bucket.
 */
const SECTION = "Branching Processes";

export const branchingLevels: Level[] = [
  {
    id: "ek-branching",
    title: "Branching Processes",
    subtitle: "Geometric growth μⁿ & extinction",
    blurb:
      "Galton–Watson processes: expected size grows as E[Zₙ]=μⁿ, and extinction probability is the smallest root of s=G(s) (=p₀/p₂ for 0/1/2 offspring).",
    section: SECTION,
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 5,
    numericGenerator: mixNumeric([genBranchingMean, genExtinction]),
    lesson: {
      paragraphs: [
        "A Galton–Watson branching process: each individual independently leaves a random number of offspring with mean μ. Expected population compounds GEOMETRICALLY. E[Zₙ] = μⁿ starting from one individual, so linear guesses (n·μ) and single-generation answers (μ) are wrong. Whether the line survives hinges entirely on μ: extinction is certain when μ ≤ 1 and possible-but-not-certain when μ > 1.",
        "The extinction probability q is the SMALLEST root in [0,1] of the fixed-point equation q = G(q), where G is the offspring PGF. For 0/1/2 offspring, q = G(q) is a quadratic with roots 1 and p₀/p₂, so extinction = p₀/p₂ (when μ>1). The classic errors are reporting the childless probability p₀ itself, guessing 1/μ, or inverting the ratio.",
      ],
      keyIdea: "E[Zₙ]=μⁿ; extinction = smallest root of q=G(q) (=p₀/p₂ for 0/1/2 offspring); certain iff μ≤1.",
      whyInterviewers:
        "Standard M362M coursework, seldom on trading OAs, included for completeness in Extra Relevant Knowledge.",
      deepDive: {
        whyItWorks:
          "In a Galton–Watson process each individual reproduces independently, so the expected population multiplies by the mean number of offspring every generation, growth is geometric, not linear. Extinction is a self-consistency condition: the line dies out with the probability that equals the offspring generating function evaluated at that same probability, and you take the smallest such root in the unit interval.",
        approach: [
          "Compute the mean number of offspring per individual as the probability-weighted average family size.",
          "Propagate the expected population by multiplying by that mean once per generation (a power of the mean, not the mean times the generation count).",
          "Judge survival by comparing the mean offspring to one: at or below one, extinction is certain.",
          "Set up the extinction equation by equating the extinction probability to the offspring generating function evaluated there.",
          "Solve that fixed-point equation and take the smallest root lying in the unit interval.",
        ],
        pitfalls: [
          "Growing the population linearly (mean times number of generations) instead of geometrically.",
          "Reporting a single generation's expected offspring as the multi-generation population size.",
          "Confusing the probability that an individual has no children with the eventual extinction probability of the whole line.",
          "Guessing the reciprocal of the mean, or inverting the offspring ratio, instead of solving the fixed-point equation.",
        ],
      },
    },
  },
];
