import type { Level } from "@/types/content";
import { mixNumeric } from "../coreScaffold";
import { genGammaMean, genGammaSumExp, genGammaVar } from "./generators";

/**
 * **Gamma distribution** — a first-class course-completeness topic (M362K
 * completeness; academic for interviews). One `numeric` level. Its own
 * `section` (`probability::Gamma Distribution`) = its own mastery bucket.
 */
const SECTION = "Gamma Distribution";

export const gammaLevels: Level[] = [
  {
    id: "ek-gamma",
    title: "The Gamma Distribution",
    subtitle: "Sum of exponentials: mean k/λ, var k/λ²",
    blurb:
      "Gamma(k,λ) as the sum of k iid Exp(λ) (the time to the k-th Poisson arrival): mean k/λ, variance k/λ², and how it differs from a single exponential.",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 5,
    numericGenerator: mixNumeric([genGammaMean, genGammaSumExp, genGammaVar]),
    lesson: {
      paragraphs: [
        "A Gamma(shape k, rate λ) is the sum of k independent Exp(λ) waiting times — equivalently, the time until the k-th arrival of a rate-λ Poisson process. Because expectations and (for independent sums) variances add, its mean is k/λ and its variance is k/λ². Contrast a single exponential (k=1): mean 1/λ, variance 1/λ².",
        "The recurring confusions are treating a Gamma like one exponential (dropping the k), and swapping mean and variance (the variance is the one carrying λ²). Note k enters LINEARLY in both, because you are summing k independent pieces — not squaring anything.",
      ],
      keyIdea: "Gamma(k,λ)=Σ Exp(λ): mean k/λ, variance k/λ²; it's the time to the k-th arrival.",
      whyInterviewers:
        "Standard coursework, rarely on trading OAs — included for M362K completeness in Extra Relevant Knowledge.",
      deepDive: {
        whyItWorks:
          "A Gamma with shape k is literally the sum of k independent exponential waiting times, so it is the time until the k-th arrival of a Poisson process at that rate. Because expectations always add, and variances add for independent pieces, both the mean and the variance scale linearly in the number of stages.",
        approach: [
          "Read a Gamma as a sum of independent, identical exponential stages — one per unit of the shape parameter.",
          "Get the mean by adding the identical exponential means, so the shape multiplies a single exponential's mean.",
          "Get the variance by adding the identical exponential variances, valid because the stages are independent.",
          "Keep the rate in its correct place: the mean divides by the rate once, the variance by the rate squared.",
          "When it fits, interpret the value as the expected waiting time until a given arrival number in a Poisson process.",
        ],
        pitfalls: [
          "Treating a Gamma like a single exponential and dropping the shape parameter entirely.",
          "Swapping mean and variance — only the variance carries the rate squared.",
          "Squaring the shape parameter in the variance; because the stages are summed (not multiplied), the shape enters linearly.",
          "Confusing the time to the k-th arrival of one stream with the minimum over several competing streams.",
        ],
      },
    },
  },
];
