import type { Level } from "@/types/content";
import { mixQuiz } from "../coreScaffold";
import {
  genChebyshev,
  genCltCondition,
  genCltStatement,
  genLlnStatement,
} from "./generators";

/**
 * **Formal LLN, CLT & Chebyshev** — Bucket 2 "Extra Relevant Knowledge" (M362K
 * ch. 8). A `quiz` level: theorem statements/conditions + the Chebyshev bound,
 * taught by naming the misconceptions (LLN-vs-CLT, Chebyshev's a², CLT myths).
 */
const SECTION = "Extra Relevant Knowledge";

export const limitTheoremsLevels: Level[] = [
  {
    id: "ek-limit",
    title: "Chebyshev, LLN & the Formal CLT",
    subtitle: "The theorems, stated precisely",
    blurb:
      "Chebyshev's inequality (σ²/a²), what the Law of Large Numbers vs the Central Limit Theorem each actually claim, and the CLT's real conditions.",
    section: SECTION,
    difficulty: "hard",
    mode: "quiz",
    masteryThreshold: 0.75,
    questionCount: 5,
    generator: mixQuiz([
      genChebyshev,
      genLlnStatement,
      genCltStatement,
      genCltCondition,
    ]),
    lesson: {
      paragraphs: [
        "Chebyshev's inequality is the distribution-free concentration bound: P(|X−μ| ≥ a) ≤ σ²/a² (equivalently ≤ 1/k² at k standard deviations). It uses only the variance, so it is loose but universal — the classic error is forgetting to SQUARE the threshold. It's the engine behind the (weak) Law of Large Numbers.",
        "Keep the two limit laws distinct. The LAW OF LARGE NUMBERS says the sample MEAN converges to the true mean μ. The CENTRAL LIMIT THEOREM says the STANDARDISED sum (S_n−nμ)/(σ√n) converges in DISTRIBUTION to N(0,1) — describing the fluctuations AROUND μ, for ANY finite-variance distribution. The CLT does not require the data to be Normal, a sample under 30, or a zero mean; those are myths.",
      ],
      keyIdea: "Chebyshev ≤ σ²/a² (=1/k²); LLN: mean → μ; CLT: standardised sum → N(0,1) (finite variance).",
      whyInterviewers:
        "Occasionally asked ('what does the CLT actually say?'); mostly here for M362K completeness in Extra Relevant Knowledge.",
      deepDive: {
        whyItWorks:
          "Chebyshev's inequality turns a variance into a universal, distribution-free bound on how often a variable strays far from its mean — enough by itself to force the sample mean toward the true mean (the Law of Large Numbers). The Central Limit Theorem is a separate, sharper statement: after centring and rescaling, the shape of the sum — not the shape of the data — converges to a standard Normal for any distribution with finite variance.",
        approach: [
          "Bound a deviation with Chebyshev by dividing the variance by the SQUARE of the threshold (equivalently, one over the number of standard deviations squared).",
          "Keep the two limit laws separate: the Law of Large Numbers is about the mean settling at its true value; the CLT is about the shape of the fluctuations around it.",
          "State the CLT on the standardised sum — centre by the mean and scale by the standard deviation times the square root of the sample size.",
          "Before invoking the CLT, verify only its real conditions: independent, identically distributed, and finite variance.",
        ],
        pitfalls: [
          "Dividing the variance by the threshold rather than its square in Chebyshev.",
          "Swapping the two limit laws — thinking the CLT says the mean converges, or that the Law of Large Numbers says the sum becomes Normal.",
          "Believing the CLT requires the underlying data to be Normal, or that it makes the individual observations Normal.",
          "Treating 'sample size under 30' or 'zero mean' as CLT requirements — the first is a rough approximation guideline, the second is removed by standardising.",
        ],
      },
    },
  },
];
