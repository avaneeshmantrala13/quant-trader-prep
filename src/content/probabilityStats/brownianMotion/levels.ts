import type { Level } from "@/types/content";
import { mixNumeric } from "../coreScaffold";
import { genBmMean, genBmProb, genBmStd } from "./generators";

/**
 * Probability & Statistics, **Brownian Motion** (Bucket 1, advanced; UT M362M).
 * A single expert `numeric` level capping the process spine after Markov Chains.
 * Teaches the interview-relevant intuition: X_t ~ N(x₀+μt, σ²t), the mean grows
 * linearly while the std grows like √t. Solvers in `./brownian.ts`.
 */
const SECTION = "Brownian Motion";

export const brownianMotionLevels: Level[] = [
  {
    id: "bm-1",
    title: "Brownian Motion Intuition",
    subtitle: "Drift is linear, spread grows like √t",
    blurb:
      "Brownian motion X_t ~ N(x₀+μt, σ²t): the mean drifts linearly (x₀+μt) while the standard deviation grows like σ√t; probabilities via Φ(z).",
    section: SECTION,
    difficulty: "expert",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 5,
    numericGenerator: mixNumeric([genBmMean, genBmStd, genBmProb]),
    lesson: {
      paragraphs: [
        "Brownian motion is the continuous-time limit of a random walk: over time t, X_t ~ N(x₀+μt, σ²t). Two scalings matter and they are DIFFERENT. The MEAN drifts LINEARLY: E[X_t] = x₀ + μt. The SPREAD grows like the SQUARE ROOT of time: sd(X_t) = σ√t (variance σ²t). Confusing σ√t with the linear σt, or with the variance σ²t, is the classic error; the √t law is the whole signature of diffusion (uncertainty accumulates, but sub-linearly).",
        "Increments are independent and stationary, so an increment over any window of length Δt is N(μΔt, σ²Δt) regardless of where it starts (a continuous analogue of memorylessness). To find a probability, standardise exactly as for the Normal: z = (x − (x₀+μt))/(σ√t), then read Φ(z). This drift-plus-√t-diffusion picture is the mental model behind Black–Scholes-style reasoning.",
      ],
      keyIdea: "X_t ~ N(x₀+μt, σ²t): mean is linear (x₀+μt), std is √t (σ√t); standardise for Φ(z).",
      whyInterviewers:
        "Quant-research/derivatives desks probe √t scaling and drift/variance intuition even when the formal Itô theory isn't required.",
      deepDive: {
        whyItWorks:
          "Brownian motion is the continuous-time limit of a random walk, so at any time its position is Normal with a mean that drifts linearly and a variance that accumulates linearly, which means the standard deviation, and hence the typical spread, grows only like the square root of elapsed time. That √t law is the signature of diffusion: uncertainty builds up, but sub-linearly.",
        approach: [
          "Write the position at a given time as Normal with mean equal to the start plus drift times time.",
          "Take the spread as volatility times the square root of the elapsed time.",
          "For a probability, standardise by subtracting the mean and dividing by that spread.",
          "Read the standard Normal CDF at the resulting z-score.",
        ],
        pitfalls: [
          "Scaling the standard deviation linearly in time instead of by the square root of time.",
          "Confusing the variance with the standard deviation.",
          "Forgetting to subtract the accumulated drift before standardising.",
        ],
      },
    },
  },
];
