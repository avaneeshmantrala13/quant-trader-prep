import type { Level } from "@/types/content";
import { mixNumeric } from "../coreScaffold";
import {
  genDensityMean,
  genDensityNorm,
  genDensityProb,
  genExpMemoryless,
  genExpMin,
  genExpTail,
  genNormalBelow,
  genNormalSymmetric,
  genUniformProb,
  genUniformVar,
} from "./generators";

/**
 * Probability & Statistics, **Continuous Distributions** (Bucket 1, UT M362K
 * ch. 5): the taught continuous-RV unit. Three `numeric` levels ramping medium →
 * hard, placed after Order Statistics and before Variance/CLT (so the Normal
 * density is taught before the CLT normal-approximation reuses Φ(z)). Exact
 * rational solvers (density integration, Uniform) + `Φ(z)`/`e^{−λt}` decimals in
 * `./continuous.ts`; generators + distractor taxonomy in `./generators.ts`.
 */
const SECTION = "Continuous Distributions";

export const continuousDistributionsLevels: Level[] = [
  {
    id: "cd-1",
    title: "Densities & Integration",
    subtitle: "Normalise, integrate, expect",
    blurb:
      "The core continuous skill: normalise a density (∫f=1), find probabilities by integrating f over an interval, and compute E[X]=∫x·f(x)dx.",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 5,
    numericGenerator: mixNumeric([genDensityNorm, genDensityProb, genDensityMean]),
    lesson: {
      paragraphs: [
        "A continuous random variable is described by a probability DENSITY f(x), not point masses. Three operations do everything. (1) NORMALISE: f must integrate to 1 over its support, which pins down the constant, for f(x)=c·xⁿ on [0,L], ∫₀ᴸ c·xⁿ dx = c·L^{n+1}/(n+1) = 1 ⇒ c = (n+1)/L^{n+1}. (2) PROBABILITY is area: P(a≤X≤b) = ∫ₐᵇ f(x) dx, you INTEGRATE, you don't multiply the density by a width or read it like a uniform.",
        "(3) EXPECTATION weights x by the density: E[X] = ∫ x·f(x) dx, which for a rising density xⁿ lands at (n+1)/(n+2)·L, above the uniform's L/2 because more mass sits near L. The recurring traps are treating a non-flat density as uniform, and off-by-one errors in the exponent when integrating (∫xⁿ raises the power to n+1).",
      ],
      keyIdea: "∫f=1 sets c; P=∫f over [a,b]; E[X]=∫x·f(x)dx, integrate, don't sample.",
      whyInterviewers:
        "Density integration is the prerequisite skill behind every continuous-distribution question; interviewers watch you set up the integral.",
      deepDive: {
        whyItWorks:
          "A continuous variable spreads probability as a density rather than point masses, so probability is AREA under the density and expectation is the density-weighted average of x. Both come from integration, never from reading a single density value.",
        approach: [
          "Normalise: choose the constant so the density integrates to 1 over its support.",
          "Get a probability by integrating the density across the interval.",
          "Get the mean by integrating x·f(x) over the support.",
          "When integrating a power xⁿ, remember the antiderivative raises the exponent to n+1.",
        ],
        pitfalls: [
          "Treating a non-flat density as uniform (multiplying the density by a width or using length ratios).",
          "Off-by-one errors in the exponent when integrating xⁿ.",
          "Reading the density value as a probability instead of integrating.",
        ],
      },
    },
  },
  {
    id: "cd-2",
    title: "Uniform & Exponential",
    subtitle: "Length ratios, tails & memorylessness",
    blurb:
      "Continuous Uniform (length-ratio probability, variance (U−L)²/12) and the Exponential (tail e^{−λt}, memorylessness, and the min of exponentials being Exp(Σλ)).",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 5,
    numericGenerator: mixNumeric([
      genUniformProb,
      genUniformVar,
      genExpTail,
      genExpMemoryless,
      genExpMin,
    ]),
    lesson: {
      paragraphs: [
        "The continuous Uniform on [L,U] has constant density 1/(U−L), so probability is just a length ratio: P(a≤X≤b) = (b−a)/(U−L), and its variance is (U−L)²/12 (square the range, divide by 12). The Exponential Exp(λ) models waiting times: its tail is P(X>t) = e^{−λt} and its CDF is 1 − e^{−λt}.",
        "The Exponential's signature property is MEMORYLESSNESS: P(X>s+t | X>s) = P(X>t) = e^{−λt}, so how long you've already waited is irrelevant. And the MINIMUM of independent exponentials Exp(λᵢ) is itself Exp(Σλᵢ): the first of many events arrives at the summed rate, so E[min of n iid Exp(λ)] = 1/(nλ). This min-of-exponentials fact underlies competing-risk and arrival models.",
      ],
      keyIdea: "Uniform: P=(b−a)/(U−L), Var=(U−L)²/12. Exp: P(X>t)=e^{−λt}, memoryless, min ~ Exp(Σλ).",
      whyInterviewers:
        "Exponential memorylessness and min-of-exponentials are staples of probability rounds and microstructure reasoning.",
      deepDive: {
        whyItWorks:
          "The uniform spreads mass evenly, so probability is just a length ratio. The exponential has a constant hazard rate, which makes it memoryless, only elapsed-independent extra time matters, and means the first of several competing exponentials arrives at the summed rate.",
        approach: [
          "For a uniform, take probability as the interval length over the total support length, and variance as the squared range over 12.",
          "For an exponential tail, use P(X > t) = e^{−λt} (its CDF is 1 − e^{−λt}).",
          "For a conditional survival, apply memorylessness: only the extra time matters, so P(X > s+t | X > s) = e^{−λt}.",
          "For the first of n independent exponentials, add the rates: the minimum is Exp(Σλ), so its mean is 1/(Σλ).",
        ],
        pitfalls: [
          "Forgetting to square the range (or dividing by 4 instead of 12) for the uniform variance.",
          "Conditioning on the elapsed time instead of using memorylessness.",
          "Confusing the tail e^{−λt} with the CDF 1 − e^{−λt}.",
        ],
      },
    },
  },
  {
    id: "cd-3",
    title: "The Normal Distribution",
    subtitle: "Standardise & read Φ(z)",
    blurb:
      "Standardise to z=(x−μ)/σ and read the standard-normal CDF Φ(z): tail and interval probabilities, and the symmetric μ±kσ masses (2Φ(k)−1).",
    section: SECTION,
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 5,
    numericGenerator: mixNumeric([genNormalBelow, genNormalSymmetric]),
    lesson: {
      paragraphs: [
        "Every Normal question reduces to the STANDARD normal by standardising: z = (x−μ)/σ (subtract the mean, divide by the standard deviation, never the variance). Then P(X≤x) = Φ(z), where Φ is the standard-normal CDF read from a table. For an upper tail use 1−Φ(z); for an interval use Φ(z_b)−Φ(z_a).",
        "By symmetry Φ(−z) = 1−Φ(z), so a symmetric band μ±kσ captures 2Φ(k)−1 of the mass, the empirical rule's 68% (k=1), 95% (k=2), 99.7% (k=3). The classic slips are forgetting to center by μ, dividing by σ² instead of σ, and reporting the wrong tail.",
      ],
      keyIdea: "z=(x−μ)/σ; P(X≤x)=Φ(z); Φ(−z)=1−Φ(z); μ±kσ mass = 2Φ(k)−1.",
      whyInterviewers:
        "Standardising to Φ(z) is expected on any probability round touching returns, errors, or the CLT.",
      deepDive: {
        whyItWorks:
          "Every Normal is a shifted, scaled copy of the standard Normal, so standardising to z = (x−μ)/σ lets a single Φ table answer any Normal probability. Its symmetry, Φ(−z) = 1 − Φ(z), then handles tails and centered bands cleanly.",
        approach: [
          "Standardise the value: z = (x − μ)/σ (subtract the mean, divide by the standard deviation, not the variance).",
          "For a lower probability, read P(X ≤ x) = Φ(z).",
          "For an upper tail use 1 − Φ(z); for an interval use Φ(z_b) − Φ(z_a).",
          "For a symmetric band μ ± kσ, use 2Φ(k) − 1.",
        ],
        pitfalls: [
          "Dividing by the variance σ² instead of the standard deviation σ.",
          "Forgetting to center by μ before scaling.",
          "Reporting the wrong tail, confusing Φ(z) with 1 − Φ(z).",
        ],
      },
    },
  },
];
