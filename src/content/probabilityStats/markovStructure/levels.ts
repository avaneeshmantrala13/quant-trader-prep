import type { Level } from "@/types/content";
import { mixNumeric, mixQuiz } from "../coreScaffold";
import { genClassify, genPnEntry } from "./generators";

/**
 * **Markov structural theory**, a first-class course-completeness topic
 * (M362M): the transition-matrix / n-step (Pⁿ, Chapman–Kolmogorov) formalism
 * (numeric) and state classification (quiz). Two levels. Its own `section`
 * (`probability::Markov Chain Structure`) = its own mastery bucket.
 */
const SECTION = "Markov Chain Structure";

export const markovStructureLevels: Level[] = [
  {
    id: "ek-markov-pn",
    title: "n-Step Transitions (Pⁿ)",
    subtitle: "Chapman–Kolmogorov: (P²)ᵢⱼ=Σ PᵢₖPₖⱼ",
    blurb:
      "The transition-matrix formalism: compute a 2-step probability (P²)ᵢⱼ by summing over the intermediate state (Chapman–Kolmogorov), not by squaring an entry.",
    section: SECTION,
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.7,
    questionCount: 5,
    numericGenerator: mixNumeric([genPnEntry]),
    lesson: {
      paragraphs: [
        "The n-step transition probabilities are the entries of Pⁿ. The Chapman–Kolmogorov equation makes this concrete: (P^{m+n})_{ij} = Σ_k (Pᵐ)_{ik}(Pⁿ)_{kj}, so a 2-step probability is (P²)_{ij} = Σ_k P_{ik}P_{kj}, sum over every intermediate state k of 'go to k, then to j'. This is MATRIX multiplication, not squaring a single entry.",
        "Two traps: reporting the one-step P_{ij} (forgetting there are two steps), and squaring the entry P_{ij}² instead of multiplying the matrix by itself. Remember each row of P sums to 1, but an individual 2-step entry is usually well below 1.",
      ],
      keyIdea: "(Pⁿ)ᵢⱼ are the n-step probabilities; (P²)ᵢⱼ = Σₖ PᵢₖPₖⱼ (Chapman–Kolmogorov).",
      whyInterviewers:
        "The Pⁿ formalism is standard M362M coursework, included for completeness in Extra Relevant Knowledge.",
      deepDive: {
        whyItWorks:
          "Multi-step transition probabilities are the entries of powers of the transition matrix, because getting from one state to another in two steps means passing through some intermediate state. Summing 'go to the intermediate state, then to the target' over every intermediate state is exactly matrix multiplication, the Chapman–Kolmogorov equation.",
        approach: [
          "Recognise that an n-step probability is an entry of the n-th power of the transition matrix.",
          "For two steps, sum over every intermediate state the product of the first-step and second-step probabilities.",
          "Build longer horizons by chaining shorter ones through a common intermediate state (Chapman–Kolmogorov).",
          "Sanity-check that each row of the transition matrix sums to one, while individual multi-step entries stay below one.",
        ],
        pitfalls: [
          "Reporting the one-step probability when the question asks for two or more steps.",
          "Squaring a single entry instead of multiplying the whole matrix by itself and summing over the intermediate state.",
          "Keeping only one intermediate path instead of summing over all intermediate states.",
          "Expecting an individual multi-step entry to equal one just because the rows sum to one.",
        ],
      },
    },
  },
  {
    id: "ek-markov-class",
    title: "State Classification",
    subtitle: "Recurrence, transience, periodicity, classes",
    blurb:
      "Classify Markov states: recurrent vs transient (return probability), periodicity (self-loops ⇒ aperiodic), and when two states communicate.",
    section: SECTION,
    difficulty: "hard",
    mode: "quiz",
    masteryThreshold: 0.75,
    questionCount: 4,
    generator: mixQuiz([genClassify]),
    lesson: {
      paragraphs: [
        "States are classified by their long-run behaviour. RECURRENT = you return with probability 1 (visited infinitely often); TRANSIENT = you return with probability < 1 (visited only finitely often). In a FINITE, irreducible chain (one where every state is reachable from every other) every state is recurrent: probability can't leak away. PERIODICITY is the gcd of possible return times; a self-loop (P_{ii}>0) forces period 1 (aperiodic).",
        "Two states COMMUNICATE when each is reachable from the other with positive probability (mutual accessibility, possibly in several steps); communication partitions the state space into classes. Don't confuse communication with one-step adjacency or with sharing a stationary probability, and don't confuse periodicity (timing of returns) with recurrence (whether you return at all).",
      ],
      keyIdea: "Recurrent=return w.p.1; transient=return<1; self-loop⇒aperiodic; communicate=mutually reachable.",
      whyInterviewers:
        "Structural classification is core M362M theory, seldom on trading OAs, in Extra Relevant Knowledge for completeness.",
      deepDive: {
        whyItWorks:
          "State classification describes a chain's long-run structure through two independent questions: whether you ever return (recurrent versus transient) and, if you do, with what timing (periodicity). Communication, mutual reachability, groups states that share these properties into classes, and in a finite irreducible chain probability cannot escape, so every state must be recurrent.",
        approach: [
          "Decide recurrence versus transience by whether the return probability is exactly one or strictly less than one.",
          "Use the structural shortcut: in a finite, irreducible chain every state is recurrent.",
          "Find a state's period as the gcd of its possible return times; a self-loop forces period one (aperiodic).",
          "Test whether two states communicate by checking each is reachable from the other in some number of steps.",
          "Group mutually communicating states into classes to see the chain's overall structure.",
        ],
        pitfalls: [
          "Confusing recurrence (whether you return at all) with periodicity (the timing of returns).",
          "Equating communication with one-step adjacency, when reachability may take several steps.",
          "Thinking two states communicate merely because they share the same stationary probability.",
          "Calling a state transient in a finite irreducible chain, where no probability can leak away.",
        ],
      },
    },
  },
];
