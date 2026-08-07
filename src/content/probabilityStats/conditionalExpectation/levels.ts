import type { Level } from "@/types/content";
import { mixNumeric } from "../coreScaffold";
import {
  genCondMean,
  genMixture,
  genRandomSumMean,
  genRandomSumVar,
  genTowerTable,
} from "./generators";

/**
 * Probability & Statistics, **Conditional Expectation & the Tower Rule** (UT
 * M362M ch. 1; also M362K expectation). The genuinely-missing E[X|Y] / law-of-
 * total-expectation unit: conditional means from a joint table, the mixture form
 * of iterated expectation, Wald's random-sum identity, and the law of total
 * variance. Two `numeric` Candy-Crush levels ramping medium → hard, placed right
 * after Expected Value (they extend E[X] by conditioning). Exact rational solvers
 * in `./condExp.ts`; generators + distractor taxonomy in `./generators.ts`.
 *
 * topicKey/section: `probability::Conditional Expectation`, maps to UT **M362M**
 * (shared with the M362K expectation chapter) for the Case-A course projection.
 */
const SECTION = "Conditional Expectation";

export const conditionalExpectationLevels: Level[] = [
  {
    id: "ce-1",
    title: "Conditioning & the Tower Rule",
    subtitle: "E[X|Y=y] and the law of total expectation",
    blurb:
      "Read a conditional mean E[X|Y=y] off a joint table, blend branch means by the law of total expectation, and price a random sum with E[S]=E[N]E[X].",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 5,
    numericGenerator: mixNumeric([genCondMean, genMixture, genRandomSumMean]),
    lesson: {
      paragraphs: [
        "A conditional expectation E[X|Y=y] is just an ordinary mean computed in the REDUCED world where Y=y. From a joint table you keep only that column and RENORMALISE by its probability P(Y=y): E[X|Y=y] = Σ_x x·P(X=x,Y=y) / P(Y=y). The two classic slips are forgetting to renormalise (dividing by the grand total instead of the column total) and ignoring the mass entirely (averaging the x-values).",
        "The law of total expectation (the tower rule) rebuilds the unconditional mean by AVERAGING the conditional means, each weighted by how likely its condition is: E[X] = Σ_y P(Y=y)·E[X|Y=y]. Its most useful shape is the random sum: if you add up a random number N of independent pieces each of mean E[X], then E[S] = E[N]·E[X], you MULTIPLY, never add.",
      ],
      keyIdea:
        "E[X|Y=y] renormalises to the column; E[X]=Σ_y P(Y=y)E[X|Y=y]; a random sum has E[S]=E[N]E[X].",
      whyInterviewers:
        "Conditioning to simplify (‘given the first step / the hidden state, what's the mean?’) and Wald's E[N]E[X] are staple quant-interview moves.",
      deepDive: {
        whyItWorks:
          "Conditioning splits a hard average into easy pieces: fix the value of a second variable, take the mean in that simpler world, then average those answers back together weighted by how often each world occurs. That two-step 'condition, then average' is exactly the tower rule, and it collapses a random sum into a single product because each of the random number of pieces contributes its mean.",
        approach: [
          "To get a conditional mean, restrict to the outcomes where the condition holds and renormalise their probabilities to sum to one.",
          "Take the ordinary probability-weighted mean of X inside that restricted world.",
          "To recover the overall mean, average the conditional means, weighting each by the probability of its condition.",
          "For a random sum, recognise that conditioning on the count leaves a fixed multiple of the piece mean, so the totals multiply.",
        ],
        pitfalls: [
          "Dividing by the grand total instead of the conditioning event's probability (skipping the renormalisation).",
          "Averaging the branch means with equal weights instead of by their probabilities.",
          "Adding E[N] and E[X] for a random sum instead of multiplying them.",
          "Reporting a single branch or the plain average of the values while ignoring the distribution.",
        ],
      },
    },
  },
  {
    id: "ce-2",
    title: "Iterated Expectation & Total Variance",
    subtitle: "E[E[X|Y]] = E[X] and Var(S) for a random sum",
    blurb:
      "Recover E[X] from a joint table via iterated expectation, and decompose the variance of a random sum with Var(S)=E[N]Var(X)+Var(N)E[X]².",
    section: SECTION,
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 5,
    numericGenerator: mixNumeric([
      genTowerTable,
      genRandomSumMean,
      genRandomSumVar,
    ]),
    lesson: {
      paragraphs: [
        "Iterated expectation, E[X] = E[E[X|Y]], says you can always compute a mean by first conditioning on a helper variable Y and then averaging the results. Concretely, E[X] = Σ_y P(Y=y)·E[X|Y=y]: the tower rule weights each conditional mean by the probability of its condition. NOT by an equal split. Getting the weights wrong (or reporting a single conditional mean) is the recurring error.",
        "Variance decomposes the same way, but with TWO sources of spread. For a random sum S = X₁+…+X_N with N independent of the iid pieces, the law of total variance gives Var(S) = E[N]·Var(X) + Var(N)·E[X]². The first term is the within-batch spread; the second is the extra variability from the count N itself being random, and E[X] is SQUARED there. Dropping the second term, or forgetting to square E[X], are the two signature mistakes.",
      ],
      keyIdea:
        "E[X]=Σ_y P(Y=y)E[X|Y=y]; Var(S)=E[N]Var(X)+Var(N)E[X]² for a random sum.",
      whyInterviewers:
        "The law of total variance for compound/random sums (insurance, order flow, aggregated risk) is a favourite ‘do you know the second term?’ screen.",
      deepDive: {
        whyItWorks:
          "Iterated expectation lets you trade one hard average for a family of easy conditional averages plus a final weighted blend. Variance needs two pieces because a random total wiggles both from the pieces varying inside a batch and from the number of pieces varying between batches; the law of total variance adds exactly those two contributions.",
        approach: [
          "Compute each conditional mean E[X|Y=y] in its reduced world.",
          "Blend them with the tower rule, weighting by P(Y=y), to recover E[X].",
          "For a random sum's variance, add the within-batch term E[N]·Var(X).",
          "Add the between-batch term Var(N)·E[X]², remembering to square the piece mean.",
        ],
        pitfalls: [
          "Weighting the conditional means equally instead of by their probabilities.",
          "Reporting a single conditional mean as if it were the overall mean.",
          "Keeping only one of the two variance terms.",
          "Using Var(N)·E[X] instead of Var(N)·E[X]² (forgetting to square the mean).",
        ],
      },
    },
  },
];
