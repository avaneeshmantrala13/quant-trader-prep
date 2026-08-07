import type { Level } from "@/types/content";
import { mixNumeric } from "../coreScaffold";
import {
  genJointConditional,
  genJointCovariance,
  genJointIndependence,
  genJointMarginal,
  genJointMean,
  genJointNorm,
  genJointSum,
  genSumDensityRect,
  genTransform,
} from "./generators";

/**
 * **Jointly continuous & discrete RVs, transformations, and dependence**, a
 * first-class course-completeness topic (M362K chs. 6–7; academic for
 * interviews). Three `numeric` levels: (1) continuous joint densities +
 * transforms, (2) discrete joint pmfs, marginals, conditionals & independence,
 * (3) covariance from a pmf and probabilities over a non-uniform region.
 *
 * topicKey/section: `probability::Joint Distributions`, its own mastery bucket
 * / skill-graph node / remediation-DAG node.
 */
const SECTION = "Joint Distributions";

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
        "A joint density f(x,y) is normalised by a DOUBLE integral to 1, for f=c·xy on [0,A]×[0,B], each of ∫x and ∫y contributes a factor, giving c = 4/(A²B²) (not the uniform's 1/(AB)). A marginal is obtained by integrating out the other variable: f_X(x)=∫f(x,y)dy; for the product density this leaves a density ∝ x, so E[X]=2A/3. Probabilities over a REGION are 2-D areas/integrals: for (X,Y) uniform on the unit square, P(X+Y≤s) is the lower triangle, area s²/2, not the 1-D length s or the square s².",
        "To find the distribution of a TRANSFORMED variable, use the CDF method: for Y=X² with X~U(0,1), P(Y≤c)=P(X≤√c)=√c (the Jacobian/derivative then gives the density f_Y). The recurring slips are squaring instead of rooting, and forgetting the transform entirely.",
      ],
      keyIdea: "Double-integral normalises c=4/(A²B²); marginal mean 2A/3; P(X+Y≤s)=s²/2; P(X²≤c)=√c.",
      whyInterviewers:
        "Jacobian/CDF transforms and joint densities are standard coursework, rarely on trading OAs, in Extra Relevant Knowledge for completeness.",
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
  {
    id: "ek-joint-2",
    title: "Joint PMFs: Marginals, Conditionals & Independence",
    subtitle: "Sum out, renormalise, and test the product rule",
    blurb:
      "Discrete joint pmf tables: marginals by summing out a variable, conditionals by renormalising a column, and independence via the product of marginals.",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 5,
    numericGenerator: mixNumeric([
      genJointMarginal,
      genJointConditional,
      genJointIndependence,
    ]),
    lesson: {
      paragraphs: [
        "A discrete joint pmf is a table of P(X=x, Y=y). A MARGINAL collapses one variable by summing the other out: P(X=x) = Σ_y P(X=x, Y=y), the row total over the grand total. A CONDITIONAL zooms into one column and renormalises: P(X=x | Y=y) = P(X=x, Y=y) / P(Y=y), i.e. the cell divided by the COLUMN total, not the grand total. Confusing a joint cell for a marginal or a conditional is the classic table error.",
        "X and Y are INDEPENDENT exactly when the joint factorises: P(X=x, Y=y) = P(X=x)·P(Y=y) for every cell. So the value the joint WOULD take under independence is the product of the two marginals; comparing it to the real entry tells you whether the variables are independent. Adding the marginals, or using just one, breaks the product rule.",
      ],
      keyIdea:
        "Marginal = sum out the other variable; conditional = cell ÷ column total; independent ⇒ joint = product of marginals.",
      whyInterviewers:
        "Joint pmf tables (marginals, conditionals, independence checks) are standard coursework, rarely on trading OAs, in Extra Relevant Knowledge for completeness.",
      deepDive: {
        whyItWorks:
          "A joint table holds all the information about two variables at once, so every one-variable question is a projection of it: marginals sum a slice away, conditionals restrict then rescale to a valid distribution, and independence is the special case where the table is just an outer product of its margins.",
        approach: [
          "For a marginal, add all the cells in the variable's row (or column) and divide by the grand total.",
          "For a conditional, keep only the conditioning line and divide each cell by that line's total.",
          "For an independence check, multiply the two marginals and compare with the actual joint entry.",
          "Interpret equality (for every cell) as independence and any mismatch as dependence.",
        ],
        pitfalls: [
          "Reporting a single joint cell as if it were a marginal.",
          "Dividing by the grand total instead of the conditioning line's total.",
          "Adding the marginals instead of multiplying them for the independence value.",
          "Checking only one cell and declaring independence prematurely.",
        ],
      },
    },
  },
  {
    id: "ek-joint-3",
    title: "Covariance & Non-Uniform Regions",
    subtitle: "Cov = E[XY]−E[X]E[Y]; double-integrate a growing density",
    blurb:
      "Compute Cov(X,Y)=E[XY]−E[X]E[Y] from a joint pmf, and find P(X≤a,Y≤b) for the non-uniform density f=x+y by double integration over a rectangle.",
    section: SECTION,
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 5,
    numericGenerator: mixNumeric([genJointCovariance, genSumDensityRect]),
    lesson: {
      paragraphs: [
        "Covariance measures how two variables move together: Cov(X,Y) = E[XY] − E[X]E[Y]. From a joint pmf, take E[XY] = Σ xy·P(X=x,Y=y), compute the two means E[X], E[Y] from the marginals, and SUBTRACT their product. Reporting E[XY] alone (forgetting the correction) or adding E[X]E[Y] instead of subtracting are the recurring slips; a negative covariance simply signals the variables tend to move oppositely.",
        "For a jointly-CONTINUOUS density, a probability over a region is a DOUBLE integral of f. For the non-uniform f(x,y)=x+y on the unit square, P(X≤a, Y≤b) = ∫₀^a∫₀^b (x+y) dy dx = a·b·(a+b)/2. The temptation is to reuse the uniform's flat area a·b, but a density that grows across the square weights the far corner more, so the integral, not the rectangle's area, gives the probability.",
      ],
      keyIdea:
        "Cov(X,Y)=E[XY]−E[X]E[Y]; for f=x+y on the unit square, P(X≤a,Y≤b)=a·b·(a+b)/2.",
      whyInterviewers:
        "Covariance from a joint pmf and double-integral region probabilities are course staples, rarely on trading OAs, in Extra Relevant Knowledge for completeness.",
      deepDive: {
        whyItWorks:
          "Covariance strips the part of E[XY] that is explained by the two means moving independently, leaving only their genuine co-movement. For a continuous density every probability is the volume under f over the event's region, so a non-flat density must be integrated rather than read off as an area.",
        approach: [
          "Compute E[XY] as the probability-weighted sum of x·y over the joint pmf.",
          "Compute each mean from its marginal and subtract the product E[X]·E[Y].",
          "For the continuous region, set up the double integral of the density over the rectangle.",
          "Integrate in both variables and simplify to a closed form.",
        ],
        pitfalls: [
          "Stopping at E[XY] and forgetting to subtract E[X]E[Y].",
          "Adding the product of means instead of subtracting it.",
          "Reusing the uniform's flat area a·b for a density that grows across the region.",
          "Dropping the ½ that comes from integrating x+y.",
        ],
      },
    },
  },
];
