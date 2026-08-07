import type { Level } from "@/types/content";
import { mixNumeric } from "../coreScaffold";
import {
  genAffineCorrNumeric,
  genCltDiffZNumeric,
  genCltTail,
  genMarkovBound,
  genMaxCovNumeric,
  genSumSDNumeric,
  genVarCombo,
} from "./generators";
import { varianceCovarianceCltFlashcards } from "./flashcards";

/**
 * Probability & Statistics, **Variance, Covariance & the CLT**: a focused topic
 * (re-homed from the former "General" grab-bag, consolidating the
 * covariance/variance-trap family with the CLT / concentration-bound family —
 * both are second-moment / limit-law reasoning). Three Candy-Crush levels
 * ramping Medium → Hard, each using the mode that best teaches it:
 *
 *   • `numeric`  , vc-1 computes the classic second-moment values as
 *                  free-response with tagged error-mode coaching (Cauchy–Schwarz
 *                  covariance ceiling, affine-correlation sign, the SD-addition
 *                  trap, the variance-doubling z of a difference); vc-2 computes
 *                  variance of a linear combination, CLT normal-approximation
 *                  tails, and a Markov concentration bound.
 *   • `flashcard`, vc-3 is the non-scalar desk: deducing a linear relation from
 *                  perfect correlation (a procedure) and the dependence-aware
 *                  dry-weekend answer (a conditional).
 *
 * Every level sets `section: "Variance, Covariance & the CLT"`. Exact/precise
 * solvers live in `../coreSolvers`; generators + per-family distractor taxonomy
 * in `./generators.ts`; the reasoning specials in `./flashcards.ts`.
 */
const SECTION = "Variance, Covariance & the CLT";

export const varianceCovarianceCltLevels: Level[] = [
  {
    id: "vc-1",
    title: "Variance & Covariance Traps",
    subtitle: "The classic second-moment misfires",
    blurb:
      "Name the misconception: the Cauchy–Schwarz covariance ceiling, affine-correlation signs, the SD-addition trap, and the variance-doubling z of a difference.",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 5,
    numericGenerator: mixNumeric([
      genMaxCovNumeric,
      genAffineCorrNumeric,
      genSumSDNumeric,
      genCltDiffZNumeric,
    ]),
    lesson: {
      paragraphs: [
        "Covariance has a ceiling: Cov(X,Y) ≤ √(VarX·VarY) by Cauchy–Schwarz, and the MEANS are red herrings, forgetting the square root or using the means is the trap. Correlation is scale-and-shift robust: ρ(a+bX, c+dY) = sign(b)·sign(d)·ρ, so only the SIGNS of the slopes survive.",
        "The deadliest variance trap: for a sum of independent variables you add VARIANCES, not standard deviations. σ(X+Y) = √(σ_X² + σ_Y²), never σ_X + σ_Y. The same doubling bites a DIFFERENCE: Var(S − T) = Var(S) + Var(T) = 2nσ², so the z-argument is −thresh/√(2nσ²), using only nσ² (forgetting the doubling) is the classic slip.",
      ],
      keyIdea: "Cov ≤ √(VarX·VarY); ρ keeps only slope signs; variances add (SDs don't); a difference DOUBLES variance.",
      whyInterviewers:
        "These traps (Cauchy–Schwarz, affine ρ, SD-addition, variance-doubling) are perennial screen-out questions.",
      deepDive: {
        whyItWorks:
          "Second moments obey bilinearity and the Cauchy–Schwarz inequality: covariance is capped by the geometric mean of the two variances, correlation is invariant to shifts and positive scaling, and for independent variables it is VARIANCES (not standard deviations) that add.",
        approach: [
          "Bound covariance by √(VarX·VarY) via Cauchy–Schwarz; the means are irrelevant.",
          "Under affine maps, keep only the slope signs: ρ(a+bX, c+dY) = sign(b)·sign(d)·ρ.",
          "For a sum or difference of independent variables, add the VARIANCES, then square-root for the standard deviation.",
          "Remember a difference adds the same variance as a sum, so equal variances DOUBLE.",
        ],
        pitfalls: [
          "Forgetting the square root in the covariance bound, or using the means.",
          "Adding standard deviations instead of variances.",
          "Forgetting that a difference doubles the variance (using nσ² instead of 2nσ²).",
        ],
      },
    },
  },
  {
    id: "vc-2",
    title: "Variance, CLT Tails & Bounds",
    subtitle: "Var(aX+bY), normal tails & Markov",
    blurb:
      "Compute Var(aX+bY)=a²VarX+b²VarY, CLT normal-approximation tails P(X≥k)≈1−Φ(z) with σ²=np(1−p), and a Markov concentration bound E[T]/a.",
    section: SECTION,
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 5,
    numericGenerator: mixNumeric([genVarCombo, genCltTail, genMarkovBound]),
    lesson: {
      paragraphs: [
        "For independent X, Y the variance of a linear combination is Var(aX + bY) = a²Var(X) + b²Var(Y), coefficients enter SQUARED and, under independence, there is no cross term. The CLT approximates a sum by a normal: P(X ≥ k) ≈ 1 − Φ((k − nμ)/√(nσ²)). For a binomial, σ² = np(1−p) (NOT np); dropping the (1−p) is the classic slip.",
        "When a closed-form tail is out of reach, Markov's inequality gives a crude but valid bound using only the mean: P(T ≥ a) ≤ E[T]/a. It is a genuine one-sided bound (never inverted to a/E[T], and never squared as if it were a variance-based Chebyshev bound).",
      ],
      keyIdea: "Var(aX+bY)=a²VarX+b²VarY; P(X≥k)≈1−Φ(z), σ²=np(1−p); Markov ≤ E[T]/a.",
      whyInterviewers:
        "Aggregating independent risks (adding variances), CLT tails, and crude concentration bounds are core desk-quant computations.",
      deepDive: {
        whyItWorks:
          "Variance is bilinear, so coefficients enter squared and independence kills the cross term. The CLT lets a large sum be approximated by a Normal, and Markov's inequality bounds a nonnegative variable's tail using only its mean.",
        approach: [
          "For a linear combination of independent variables, square each coefficient: Var(aX+bY) = a²VarX + b²VarY, with no cross term.",
          "For a CLT tail, standardise the sum with mean nμ and variance nσ² (for a binomial, σ² = np(1−p)) and read 1 − Φ(z).",
          "For a crude tail bound from the mean alone, apply Markov: P(T ≥ a) ≤ E[T]/a.",
        ],
        pitfalls: [
          "Not squaring the coefficients, or adding a cross term despite independence.",
          "Using np instead of np(1−p) for the binomial variance.",
          "Inverting Markov to a/E[T], or squaring it as if it were a variance-based (Chebyshev) bound.",
        ],
      },
    },
  },
  {
    id: "vc-3",
    title: "Variance & Covariance Desk",
    subtitle: "Procedures & conditional answers",
    blurb:
      "Reason through non-scalar specials: deducing a linear relation from perfect correlation (a procedure), and the dry-weekend probability (a conditional).",
    section: SECTION,
    difficulty: "hard",
    mode: "flashcard",
    masteryThreshold: 0.75,
    flashcards: varianceCovarianceCltFlashcards,
    lesson: {
      paragraphs: [
        "Not every second-moment answer is a graded scalar. Perfect correlation (|ρ| = 1) means an exact linear relation X = aY + b, so the deliverable is a PROCEDURE, take two distinct (X, Y) pairs to solve for a and b, not a probability. There is no spread to integrate over.",
        "And a 'dry weekend' probability is CONDITIONAL on the dependence structure: 0.6·0.5 = 0.3 only under independence; otherwise you must demand the covariance (variances + correlation) between the two rain indicators before answering. Work each through, reveal, and self-assess.",
      ],
      keyIdea: "Some answers are a procedure (two pairs ⇒ the line) or a condition (0.3 only if independent), not a forced number.",
      whyInterviewers:
        "The specials reward candidates who recognise when the honest answer is a construction or a stated condition.",
      deepDive: {
        whyItWorks:
          "|ρ| = 1 forces an exact linear relation between the variables, so there is no spread to integrate over. And a joint ('both') probability depends on the dependence structure, so the honest answer is sometimes a construction or a stated condition, not a single number.",
        approach: [
          "When |ρ| = 1, recognise that X and Y lie exactly on a line X = aY + b.",
          "Recover that line by solving for the slope and intercept from two distinct (X, Y) pairs.",
          "For a joint 'both' probability, check the dependence: multiply the marginals only if the events are independent.",
          "Otherwise, demand the covariance (variances + correlation) before committing to a number.",
        ],
        pitfalls: [
          "Multiplying marginal probabilities as if events were independent when they may not be.",
          "Expecting a single numeric answer when the deliverable is a procedure or a condition.",
          "Assuming perfect correlation means equality rather than a general linear relation.",
        ],
      },
    },
  },
];
