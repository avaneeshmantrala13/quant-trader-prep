import type { Level } from "@/types/content";
import { mixNumeric } from "../coreScaffold";
import { genCtmcHolding, genCtmcStationary, genMM1 } from "./generators";

/**
 * **Continuous-time Markov chains (+ queues)**, a first-class course-
 * completeness topic (M362M / Ross IPM; academic for interviews). One `numeric`
 * level. Its own `section` (`probability::Continuous-Time Markov Chains`) = its
 * own mastery bucket.
 */
const SECTION = "Continuous-Time Markov Chains";

export const ctmcLevels: Level[] = [
  {
    id: "ek-ctmc",
    title: "Continuous-Time Markov Chains",
    subtitle: "Holding times, balance & the M/M/1 queue",
    blurb:
      "CTMCs: holding time 1/(Σ out-rates), 2-state stationary μ/(λ+μ) from flow balance, and the M/M/1 queue's mean number in system L=ρ/(1−ρ).",
    section: SECTION,
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 5,
    numericGenerator: mixNumeric([genCtmcHolding, genCtmcStationary, genMM1]),
    lesson: {
      paragraphs: [
        "A continuous-time Markov chain waits in each state for an exponential time and then jumps. Because the exits are competing exponentials whose RATES add, the holding time is Exp(total out-rate), with mean 1/(Σ rates), not the reciprocal of a single rate, and not the sum of the individual mean times. The long-run distribution comes from FLOW BALANCE: for a 2-state chain with 0→1 rate λ and 1→0 rate μ, λπ₀ = μπ₁ gives π₀ = μ/(λ+μ).",
        "Queues are the classic application. The M/M/1 queue (Poisson arrivals λ, exponential service μ, one server) has utilisation ρ = λ/μ and, when ρ < 1, a mean number in system L = ρ/(1−ρ) = λ/(μ−λ). Don't confuse L with ρ (utilisation), with 1/(1−ρ), or with the number merely WAITING Lq = ρ²/(1−ρ) (which excludes the job in service).",
      ],
      keyIdea: "Holding = 1/(Σrates); 2-state π₀=μ/(λ+μ); M/M/1 L=ρ/(1−ρ)=λ/(μ−λ).",
      whyInterviewers:
        "Academic for trading OAs, included for M362M completeness in Extra Relevant Knowledge.",
      deepDive: {
        whyItWorks:
          "A continuous-time Markov chain sits in each state for an exponential time and then jumps; because the competing exits are independent exponentials, their rates add and the holding time is exponential with that total rate. Long-run fractions come from flow balance (the rate of probability entering a state must equal the rate leaving it), and queues are just this balance applied to a birth–death chain (one whose state only steps up or down by one, like a queue length that rises or falls by a single customer at a time).",
        approach: [
          "Find a state's expected holding time by adding all of its out-rates and taking the reciprocal of that total.",
          "Treat competing exits as a race of exponentials (rates add), not as separate waiting times to be summed.",
          "Get long-run state fractions from the flow-balance equations, then normalise the probabilities to sum to one.",
          "For a birth–death queue, form the utilisation as the arrival rate over the service rate and check it is below one for stability.",
          "Read the mean number in system from the utilisation, keeping it distinct from utilisation and from the number merely waiting.",
        ],
        pitfalls: [
          "Using a single exit's rate, or summing the individual mean times, instead of the reciprocal of the total out-rate.",
          "Confusing a rate with a mean time, they are reciprocals of each other.",
          "Assigning a state's long-run probability in proportion to the rate leaving it rather than the rate entering it.",
          "Conflating utilisation, the mean number in system, and the mean number waiting in line (which excludes the one being served).",
        ],
      },
    },
  },
];
