import type { Level } from "@/types/content";
import {
  SEQUENCE_NUMERIC_GENERATORS,
  SEQUENCE_QUIZ_GENERATORS,
  mixSequenceNumeric,
  mixSequenceQuiz,
} from "./generators";

/**
 * Ready-to-slot `Level` definitions for the Sequences & Pattern-Recognition
 * family (T2). These are NOT registered anywhere here — a future integrator
 * (T11 / track owner) can drop them into a track, the diagnostic, or an OA pool.
 * They exercise both play modes:
 *   - `quiz`    — MCQ "what comes next?" across numeric, alphabetic, and
 *                 matrix/odd-one-out/analogy families.
 *   - `numeric` — free-entry "type the next number" across the numeric families.
 *
 * The intros are purely CONCEPTUAL; every concrete number rendered in the lesson
 * comes from the generators' own solver output, so the prose can never drift.
 */

const Q = SEQUENCE_QUIZ_GENERATORS;
const N = SEQUENCE_NUMERIC_GENERATORS;

const PATTERN_METHOD =
  "A sequence puzzle asks you to recover the GENERATING RULE from a few terms, then apply it exactly once more. Name the rule first (add a constant? multiply by a ratio? sum the previous two? two interwoven strands?), verify it against every gap you can see, and only then extend it.";

const TRAP_METHOD =
  "The classic traps are all one-step-off: continuing one term too far, applying the wrong operation in an alternating cycle, or simply repeating the last term. Check your candidate against the WHOLE sequence, not just the final gap.";

export const sequenceLevels: Level[] = [
  {
    id: "seq-quiz-foundations",
    title: "What Comes Next?",
    subtitle: "Arithmetic, geometric & Fibonacci-like patterns",
    blurb:
      "Spot the generating rule (add a constant, multiply by a ratio, or sum the previous two) and extend the sequence one exact step.",
    section: "Sequences & Pattern Recognition",
    difficulty: "easy",
    mode: "quiz",
    masteryThreshold: 0.8,
    questionCount: 6,
    generator: mixSequenceQuiz([
      Q.arithmeticNext,
      Q.geometricNext,
      Q.fibonacciNext,
    ]),
    lesson: {
      paragraphs: [
        PATTERN_METHOD,
        TRAP_METHOD,
        "Here you get the three workhorse numeric rules: a constant difference (arithmetic), a constant ratio (geometric), and each term as the sum of the two before it (Fibonacci-like).",
      ],
      keyIdea: "Name the rule, verify it on every gap, then extend once.",
      whyInterviewers:
        "Pattern recognition under time pressure is exactly the signal quant OAs probe with sequence items.",
    },
  },
  {
    id: "seq-quiz-advanced",
    title: "Hidden Structure",
    subtitle: "Second differences, interleaving & alternating operations",
    blurb:
      "Extend quadratic (constant second-difference), interwoven two-strand, and alternating add/multiply sequences without falling for one-step-off traps.",
    section: "Sequences & Pattern Recognition",
    difficulty: "hard",
    mode: "quiz",
    masteryThreshold: 0.8,
    questionCount: 6,
    generator: mixSequenceQuiz([
      Q.polynomialNext,
      Q.interleavedNext,
      Q.alternatingOpNext,
    ]),
    lesson: {
      paragraphs: [
        PATTERN_METHOD,
        "When the first differences aren't constant, take differences AGAIN — a constant second difference means the sequence is quadratic. When terms zig-zag, suspect two interwoven strands or an alternating operation.",
        TRAP_METHOD,
      ],
      keyIdea:
        "If first differences vary, difference again or split into strands.",
      whyInterviewers:
        "Harder OA items hide the rule one layer down; the skill is knowing which second-order structure to test for.",
    },
  },
  {
    id: "seq-quiz-alpha-matrix",
    title: "Letters, Odd-Ones & Analogies",
    subtitle: "Alphabet shifts, which-doesn't-belong & A:B::C:?",
    blurb:
      "Map letters to positions to solve alphabet-shift puzzles, spot the value that breaks an encoded rule, and transfer an analogy's rule to a new term.",
    section: "Sequences & Pattern Recognition",
    difficulty: "medium",
    mode: "quiz",
    masteryThreshold: 0.8,
    questionCount: 6,
    generator: mixSequenceQuiz([
      Q.caesarNext,
      Q.alternatingShiftNext,
      Q.oddOneOut,
      Q.analogyNext,
    ]),
    lesson: {
      paragraphs: [
        "Letter puzzles become arithmetic once you map A→1 … Z→26 (wrapping past Z back to A). A constant +k shift, or alternating shifts, are then just the numeric rules on positions.",
        "Odd-one-out and analogy items encode a hidden rule too: find the property the group shares (e.g. divisibility) to spot the intruder, or extract the mapping from A→B and apply it to C.",
        TRAP_METHOD,
      ],
      keyIdea: "Letters are positions; odd-one-out is a shared-property test.",
      whyInterviewers:
        "Abstract-reasoning sections mix symbolic and numeric patterns to test rule extraction, not arithmetic speed alone.",
    },
  },
  {
    id: "seq-numeric-typeit",
    title: "Type the Next Number",
    subtitle: "Free-entry continuation across numeric families",
    blurb:
      "Recover the rule and type the exact next term for arithmetic, geometric, quadratic, interleaved, Fibonacci-like, and alternating-operation sequences.",
    section: "Sequences & Pattern Recognition",
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.8,
    questionCount: 6,
    numericGenerator: mixSequenceNumeric([
      N.arithmeticNumeric,
      N.geometricNumeric,
      N.polynomialNumeric,
      N.interleavedNumeric,
      N.fibonacciNumeric,
      N.alternatingOpNumeric,
    ]),
    lesson: {
      paragraphs: [
        PATTERN_METHOD,
        "Free entry removes the safety net of multiple choice: you must produce the exact next term, so verifying the rule on every visible gap matters even more.",
        TRAP_METHOD,
      ],
      keyIdea: "No options to reverse-engineer — commit to the rule and extend.",
      whyInterviewers:
        "Free-entry continuation shows you can derive and apply a rule cleanly, not just recognize a plausible option.",
    },
  },
];
