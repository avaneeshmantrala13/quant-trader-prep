import type { Level } from "@/types/content";
import { mixQuiz } from "../coreScaffold";
import { genMgfIdentify, genMgfMean, genMgfSum, genMgfVar } from "./generators";

/**
 * **Moment Generating Functions**, a first-class course-completeness topic
 * (untested at firms; added for M362K completeness). A `quiz` level: MGF
 * concepts are derivation/identity based, so multiple-choice with misconception
 * distractors is the right routing.
 *
 * Its own `section` (`probability::Moment Generating Functions`) so it is an
 * independent mastery bucket / skill-graph node / remediation-DAG node.
 */
const SECTION = "Moment Generating Functions";

export const mgfLevels: Level[] = [
  {
    id: "ek-mgf",
    title: "Moment Generating Functions",
    subtitle: "E[X]=M'(0), Var=M''(0)−M'(0)², sums multiply",
    blurb:
      "The MGF method: moments from derivatives at 0 (E[X]=M'(0), Var=M''(0)−M'(0)²), spotting standard MGFs, and multiplying MGFs for independent sums.",
    section: SECTION,
    difficulty: "medium",
    mode: "quiz",
    masteryThreshold: 0.75,
    questionCount: 5,
    generator: mixQuiz([genMgfMean, genMgfVar, genMgfIdentify, genMgfSum]),
    lesson: {
      paragraphs: [
        "The moment generating function M(t)=E[e^{tX}] packages all moments: because M(0)=1 always, the information is in its DERIVATIVES at 0. E[X]=M'(0), E[X²]=M''(0), and so Var(X)=M''(0)−(M'(0))². The two classic errors are reading E[X] off M(0) (which is 1 for every distribution) and reporting the second moment M''(0) as the variance without subtracting the mean squared.",
        "MGFs identify distributions (a uniqueness theorem), e.g. e^{λ(e^t−1)} is Poisson, e^{μt+σ²t²/2} is Normal, λ/(λ−t) is Exponential. Their headline use is the MGF METHOD for sums: for INDEPENDENT variables the MGF of a sum is the PRODUCT of the MGFs, so a sum of n iid has MGF M(t)ⁿ, turning a hard convolution into multiplication.",
      ],
      keyIdea: "E[X]=M'(0); Var=M''(0)−M'(0)²; independent sum ⇒ product of MGFs.",
      whyInterviewers:
        "Rarely asked on trading OAs (a proof tool), included for M362K completeness in the Extra Relevant Knowledge section.",
      deepDive: {
        whyItWorks:
          "The MGF M(t)=E[e^{tX}] is a bookkeeping device for a distribution: differentiating it at t=0 pulls down the successive moments one by one. And because independence turns the expectation of a product into a product of expectations, the transform converts an otherwise hard convolution of a sum into simple multiplication.",
        approach: [
          "To extract a moment, differentiate the MGF and evaluate the derivative at zero, the first derivative gives the mean, the second gives E[X²].",
          "Build the variance from the second moment minus the square of the first, rather than reading it off a single derivative.",
          "Identify a standard distribution by matching its MGF against the known catalogue of forms.",
          "For a sum of independent variables, multiply their MGFs; for identical independent copies, raise a single MGF to the appropriate power.",
          "Recognise the resulting product as a known MGF to read off the sum's distribution.",
        ],
        pitfalls: [
          "Evaluating the MGF itself at zero and calling that the mean. M(0) equals one for every distribution and carries no information; the moments live in the derivatives.",
          "Treating the second derivative at zero as the variance, forgetting to subtract the square of the mean.",
          "Adding or additively scaling MGFs for a sum instead of multiplying them, or confusing scaling the variable with adding an independent copy.",
          "Multiplying MGFs when the variables are not independent, the product rule requires independence.",
        ],
      },
    },
  },
];
