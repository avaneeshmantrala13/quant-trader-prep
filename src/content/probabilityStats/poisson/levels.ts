import type { Level } from "@/types/content";
import { mixNumeric } from "../coreScaffold";
import {
  genPoissonAtLeastOne,
  genPoissonCompound,
  genPoissonCondUniform,
  genPoissonFirstStream,
  genPoissonInterarrival,
  genPoissonInterval,
  genPoissonKthArrival,
  genPoissonNoEvent,
  genPoissonPmf,
  genPoissonSplit,
  genPoissonSuper,
  genPoissonVariance,
} from "./generators";

/**
 * Probability & Statistics — **Poisson Distribution & Process** (Bucket 1, UT
 * M362K ch. 4.7 + M362M Poisson-process core; interview-relevant per
 * FIRM_TIMED_ASSESSMENTS). Two `numeric` Candy-Crush levels ramping medium →
 * hard, placed right after Expected Value (they use E[X] = λ). Exact/precise
 * solvers in `./poisson.ts`; generators + distractor taxonomy in `./generators.ts`.
 */
const SECTION = "Poisson Distribution & Process";

export const poissonLevels: Level[] = [
  {
    id: "po-1",
    title: "The Poisson Distribution",
    subtitle: "e^{−λ}λ^k/k!, mean = variance = λ",
    blurb:
      "The Poisson pmf e^{−λ}λ^k/k!, the at-least-one complement 1−e^{−λ}, and the signature fact that a Poisson's variance equals its mean λ.",
    section: SECTION,
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.75,
    questionCount: 5,
    numericGenerator: mixNumeric([
      genPoissonVariance,
      genPoissonPmf,
      genPoissonAtLeastOne,
    ]),
    lesson: {
      paragraphs: [
        "The Poisson distribution models counts of rare, independent events with a known average λ. Its pmf is P(X=k) = e^{−λ}·λ^k/k!. The e^{−λ} factor is the normaliser that makes the probabilities sum to 1 — dropping it (reporting just λ^k/k!) is the #1 mistake. For 'at least one', complement the single easy term: P(X≥1) = 1 − P(X=0) = 1 − e^{−λ}.",
        "A Poisson has the unusual property that its mean AND variance both equal λ, so its standard deviation is √λ. Don't reach for λ² (that would be mean-squared) or confuse the SD √λ with the variance. This mean=variance identity is a fast interview tell that a count is Poisson.",
      ],
      keyIdea: "P(X=k)=e^{−λ}λ^k/k!; P(X≥1)=1−e^{−λ}; mean = variance = λ.",
      whyInterviewers:
        "Rare-event / arrival counts on OAs are Poisson; the e^{−λ} factor and mean=variance identity are the fast checks.",
      deepDive: {
        whyItWorks:
          "The Poisson is the limit of many independent trials each with a tiny success chance, so it counts rare, independent events at a known average rate λ. The e^{−λ}·λ^k/k! form is the unique distribution with that property, and it is special in that its mean and variance are both λ.",
        approach: [
          "Identify the mean count λ for the situation.",
          "For an exact count, apply the pmf P(X=k)=e^{−λ}λ^k/k!, keeping the e^{−λ} normaliser.",
          "For 'at least one', complement the single easy term: 1 − P(X=0) = 1 − e^{−λ}.",
          "For spread, recall the variance equals the mean λ (so the standard deviation is √λ).",
        ],
        pitfalls: [
          "Dropping the e^{−λ} factor and reporting just λ^k/k!.",
          "Summing a whole tail for 'at least one' instead of complementing P(X=0).",
          "Treating the variance as λ² or confusing the standard deviation √λ with the variance.",
        ],
      },
    },
  },
  {
    id: "po-2",
    title: "The Poisson Process",
    subtitle: "Arrivals, splitting & superposition",
    blurb:
      "Poisson processes: the count over t is Poisson(λt); thinning gives rate λp; independent streams superpose to λ₁+λ₂; the next event is stream 1 w.p. λ₁/(λ₁+λ₂).",
    section: SECTION,
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 5,
    numericGenerator: mixNumeric([
      genPoissonSuper,
      genPoissonInterval,
      genPoissonSplit,
      genPoissonFirstStream,
    ]),
    lesson: {
      paragraphs: [
        "A Poisson process with rate λ produces, over a window of length t, a Poisson count with mean λt — the window length scales the mean, so always use λt (not λ). Two structural facts do most of the interview work. SPLITTING/THINNING: if each event is independently 'type A' with probability p, the type-A events form a Poisson process of rate λp, so their expected count over t is λpt. SUPERPOSITION: independent streams with rates λ₁, λ₂ merge into one Poisson process of rate λ₁+λ₂ (add the rates — never multiply or average).",
        "Because the streams are memoryless, the competition 'which stream fires next?' is settled purely by the rates: the next event is from stream 1 with probability λ₁/(λ₁+λ₂). This is the same min-of-exponentials split used in market-microstructure arrival models.",
      ],
      keyIdea: "Count over t ~ Poisson(λt); thin → λp; superpose → λ₁+λ₂; next-event split λ₁/(λ₁+λ₂).",
      whyInterviewers:
        "Splitting, superposition, and 'expected # of events' are the genuinely-asked Poisson-process framings on quant screens.",
      deepDive: {
        whyItWorks:
          "A Poisson process has independent, memoryless increments, so the count over a window scales with the window's length and independent streams combine linearly. That linearity is what makes thinning, superposition, and the 'which stream is next' split so clean.",
        approach: [
          "Scale the rate by the window length: the count over a window of length t is Poisson with mean λt.",
          "For a subtype, thin the process by multiplying the rate by the subtype probability (rate λp).",
          "For merged independent streams, superpose by ADDING the rates.",
          "For 'which stream fires next', split the merged rate: stream 1 wins with probability λ₁/(λ₁+λ₂).",
        ],
        pitfalls: [
          "Using λ instead of λt — forgetting the window length scales the mean.",
          "Multiplying or averaging rates when superposing, instead of adding them.",
          "Reporting the odds λ₁/λ₂ instead of the probability λ₁/(λ₁+λ₂) for which stream is first.",
        ],
      },
    },
  },
  {
    id: "po-3",
    title: "Interarrivals, Waiting Times & Conditional Uniformity",
    subtitle: "Exp gaps, Erlang waits, order-stat arrivals, compounding",
    blurb:
      "Poisson-process depth: interarrival mean 1/λ, waiting-tail e^{−λt}, the Erlang k/λ, conditional-uniformity jT/(n+1), and compound mean λtμ.",
    section: SECTION,
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 5,
    numericGenerator: mixNumeric([
      genPoissonInterarrival,
      genPoissonNoEvent,
      genPoissonKthArrival,
      genPoissonCondUniform,
      genPoissonCompound,
    ]),
    lesson: {
      paragraphs: [
        "The times BETWEEN Poisson events are independent Exponential(λ) gaps, so the mean interarrival is 1/λ and the chance of NO event before time t is P(T>t) = e^{−λt} (the first arrival lands after t). The waiting time to the k-th arrival stacks k of those gaps into an Erlang(k, λ), with mean k/λ. Watch the reciprocal: λ is events-per-time, 1/λ is time-per-event.",
        "Two deeper facts finish the process toolkit. CONDITIONAL UNIFORMITY: given exactly n events in [0, T], the arrival times look like the order statistics of n Uniform(0, T) points, so they split the window into n+1 equal expected gaps and the j-th arrival has expected time j·T/(n+1). COMPOUND POISSON: if each of the λt expected events carries an independent mark of mean μ, the expected total is λ·t·μ (Wald over a Poisson count) — miss any of the three factors and the total is wrong.",
      ],
      keyIdea:
        "Interarrival mean 1/λ, P(T>t)=e^{−λt}; k-th arrival mean k/λ; E[S₍ⱼ₎|N=n]=jT/(n+1); compound mean λtμ.",
      whyInterviewers:
        "Interarrival/exponential timing, waiting-time tails, and the order-statistic (conditional-uniformity) property are the deeper Poisson-process facts quant screens probe once the basics are in.",
      deepDive: {
        whyItWorks:
          "A Poisson process is built from memoryless exponential gaps, so waiting times add those gaps (giving Erlang means) and the no-event probability is just one exponential tail. Because the process is uniform in time given the count, the arrivals behave like sorted uniform points, and summing independent marks over a random Poisson count multiplies the three rates together.",
        approach: [
          "For gaps and waits, work in time-per-event (1/λ) and stack k gaps for the k-th arrival (k/λ).",
          "For 'no event yet', use the exponential tail e^{−λt} of the first interarrival.",
          "Given a fixed count in a window, treat the arrivals as sorted uniform points and use j·T/(n+1).",
          "For a compound total, multiply the arrival rate, the window length, and the mean mark.",
        ],
        pitfalls: [
          "Reporting λ (rate) instead of 1/λ (mean gap), or using the wrong power of λ.",
          "Using the complement 1−e^{−λt}, or dropping t, for the no-event probability.",
          "Dividing the window by n instead of n+1 for the conditional-uniformity arrival time.",
          "Forgetting one of the three factors (rate, time, or mark mean) in the compound total.",
        ],
      },
    },
  },
];
