import type { Level } from "@/types/content";
import { mixNumeric } from "../coreScaffold";
import {
  genJointMean,
  genJointNorm,
  genJointSum,
  genTransform,
} from "./generators";

/**
 * **Jointly continuous RVs + transformations** — Bucket 2 "Extra Relevant
 * Knowledge" (M362K chs. 6–7; academic for interviews). One `numeric` level.
 */
const SECTION = "Extra Relevant Knowledge";

export const jointDistributionsLevels: Level[] = [
  {
    id: "ek-joint",
    title: "Joint Densities & Transformations",
    subtitle: "Normalise, marginalise, and transform",
    blurb:
      "Jointly continuous RVs: normalise a joint density over a rectangle, get a marginal mean, find P(X+Y≤s) as an area, and transform via the CDF method (Y=X²).",
    section: SECTION,
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 5,
    numericGenerator: mixNumeric([
      genJointNorm,
      genJointSum,
      genJointMean,
      genTransform,
    ]),
    lesson: {
      paragraphs: [
        "A joint density f(x,y) is normalised by a DOUBLE integral to 1 — for f=c·xy on [0,A]×[0,B], each of ∫x and ∫y contributes a factor, giving c = 4/(A²B²) (not the uniform's 1/(AB)). A marginal is obtained by integrating out the other variable: f_X(x)=∫f(x,y)dy; for the product density this leaves a density ∝ x, so E[X]=2A/3. Probabilities over a REGION are 2-D areas/integrals: for (X,Y) uniform on the unit square, P(X+Y≤s) is the lower triangle, area s²/2 — not the 1-D length s or the square s².",
        "To find the distribution of a TRANSFORMED variable, use the CDF method: for Y=X² with X~U(0,1), P(Y≤c)=P(X≤√c)=√c (the Jacobian/derivative then gives the density f_Y). The recurring slips are squaring instead of rooting, and forgetting the transform entirely.",
      ],
      keyIdea: "Double-integral normalises c=4/(A²B²); marginal mean 2A/3; P(X+Y≤s)=s²/2; P(X²≤c)=√c.",
      whyInterviewers:
        "Jacobian/CDF transforms and joint densities are standard coursework, rarely on trading OAs — in Extra Relevant Knowledge for completeness.",
      deepDive: {
        whyItWorks:
          "A joint density lives in two dimensions, so every quantity is a double integral: normalising, marginalising, and computing a probability all reduce to integrating the density over the right region. To find the law of a transformed variable you push the whole distribution through the map by tracking its cumulative distribution, then differentiate to recover the new density.",
        approach: [
          "Fix the normalising constant by integrating the density over its entire support and setting the total to one.",
          "Obtain a marginal density by integrating out the other variable, then use it for that variable's moments.",
          "Compute a probability over an event by integrating the density over the corresponding two-dimensional region (its area, for a uniform).",
          "To transform a variable, rewrite the event for the new variable in terms of the old one and evaluate its cumulative distribution.",
          "Differentiate that transformed cumulative distribution (apply the Jacobian) when you need the new variable's density.",
        ],
        pitfalls: [
          "Reusing the uniform's flat constant for a density that actually grows across the region.",
          "Treating a two-dimensional probability as a one-dimensional length, or using the whole square instead of the region the event carves out.",
          "Forgetting the transform and reading the probability off the original variable directly.",
          "Squaring when the inverse map calls for a square root (or vice versa), and dropping the Jacobian when turning a cumulative distribution into a density.",
        ],
      },
    },
  },
];
