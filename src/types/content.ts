import type { Rng } from "@/lib/rng";

export type Difficulty = "intro" | "easy" | "medium" | "hard" | "expert";

export const DIFFICULTY_META: Record<
  Difficulty,
  { label: string; order: number }
> = {
  intro: { label: "Intro", order: 0 },
  easy: { label: "Easy", order: 1 },
  medium: { label: "Medium", order: 2 },
  hard: { label: "Hard", order: 3 },
  expert: { label: "Expert", order: 4 },
};

/**
 * A single multiple-choice question. `choices` are kept parallel to
 * `distractorRationale`: entry i explains WHY choice i is a plausible (but
 * usually wrong) answer — i.e. the specific reasoning error it encodes. This is
 * the core of the "distractors are common mistakes, not giveaways" design.
 */
export interface Question {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  difficulty: Difficulty;
  concept?: string;
  /** Parallel to `choices`. Rationale for each option (why a student might pick it). */
  distractorRationale?: string[];
  /**
   * OPTIONAL, additive (Phase 1 — COORDINATION §6.2). Parallel to `choices`:
   * `misconceptions[i]` is a machine-readable misconception TAG for choice `i`
   * (e.g. "base_rate_neglect"). Phases 2–4 backfill these topic-by-topic; the
   * mastery layer folds `misconceptionKey(topicKey, tag)` when present and falls
   * back to `idx:<chosenIndex>` otherwise, so misconception tracking works even
   * before a topic is tagged. Never required — all 834 existing items omit it.
   */
  misconceptions?: string[];
  /** Hand-authored hard items flagged for expert human verification. */
  needsVerification?: boolean;
  /** Schema / genre reference (e.g. "Green Book style", "Optiver mental math"). */
  source?: string;
  /**
   * STABLE sub-generator ("template") id this item was produced by. A level can
   * bundle several distinct question families behind one `generator` (via the
   * `mix*` wrappers); `family` records WHICH family drew this item so that
   * "Generate another like this" can re-run THAT family with a fresh seed
   * (same concept, new numbers) instead of jumping to a sibling family. Absent
   * for legacy / static items; see `@/content/mixFamilies` + `@/lib/regenerate`.
   */
  family?: string;
}

/**
 * Produces one fresh, exact-verified question from a seeded RNG.
 *
 * A generator may ALSO carry a `families` map: the `mix*` wrappers return such a
 * callable so a specific sub-generator can be re-run by `family` id for
 * family-preserving regeneration. Plain single-family generators omit it.
 */
export interface QuestionGenerator {
  (rng: Rng): Question;
  /** family id → the sub-generator that stamps items with that id. */
  families?: Record<string, QuestionGenerator>;
}

/**
 * A single numeric free-entry problem for the `"numeric"` play mode. There are
 * NO multiple-choice options — the learner types a number, which is graded by
 * EXACT match against `answer` (an integer, e.g. a dollar stake). This is the
 * mode behind the Betting & Sizing (Kelly) section: the answer is a computed
 * exact integer and `explanation` shows the worked derivation.
 */
export interface NumericQuestion {
  id: string;
  prompt: string;
  /**
   * The exact correct value. By default an integer graded by exact match (the
   * Kelly dollar-stake case). When `decimals` is set the answer MAY be a clean
   * non-integer (e.g. a game value 2.8 or a probability 0.0625) and grading
   * rounds both sides to `decimals` places — this is what lets Game Theory /
   * Game Puzzle reuse the numeric mode for mixed-strategy values and
   * probabilities without floating-point flakiness.
   */
  answer: number;
  /**
   * Number of decimal places the answer carries. When present, the answer may
   * be non-integer and grading/display use this precision (rounded compare).
   * When omitted, the answer is an integer graded by exact `===` match.
   */
  decimals?: number;
  difficulty: Difficulty;
  concept?: string;
  /** Full worked "why" shown after a submission (mirrors the quiz explanation). */
  explanation: string;
  /** Unit shown beside the input (default "$"). */
  unit?: string;
  /**
   * Targeted feedback for specific wrong answers: if the learner enters a value
   * matching `value`, `feedback` explains the exact reasoning error (the Kelly
   * error taxonomy: forgot to subtract q, used the implied prob, wrong odds→b
   * conversion, forgot to divide by b, bet the win probability, …).
   */
  commonErrors?: {
    value: number;
    feedback: string;
    /**
     * OPTIONAL, additive (Phase 1 — COORDINATION §6.2). A machine-readable
     * misconception TAG for this specific wrong value. When present the mastery
     * layer folds `misconceptionKey(topicKey, tag)`; otherwise it falls back to
     * `err:<value>`. Never required.
     */
    misconception?: string;
  }[];
  /** Hand-authored / flagged for expert verification. */
  needsVerification?: boolean;
  /** Schema / genre reference. */
  source?: string;
  /** Stable sub-generator ("template") id — see `Question.family`. */
  family?: string;
}

/**
 * Produces one fresh, exact-verified numeric question from a seeded RNG. May
 * carry a `families` map (populated by the `mix*` wrappers) for family-preserving
 * regeneration — see `QuestionGenerator`.
 */
export interface NumericQuestionGenerator {
  (rng: Rng): NumericQuestion;
  families?: Record<string, NumericQuestionGenerator>;
}

/**
 * A single open-ended flashcard problem for the integrity-based flashcard mode
 * (used by the brainteasers track). There are NO multiple-choice options — the
 * learner reasons on their own, hits "Reveal", then self-assesses. `answer` is
 * the concise solution shown on reveal; `explanation` is the full "why".
 */
export interface Flashcard {
  id: string;
  prompt: string;
  /** The concise, explicit answer revealed after the learner thinks. */
  answer: string;
  /** Strong, self-contained reasoning for WHY the answer is correct. */
  explanation: string;
  difficulty: Difficulty;
  concept?: string;
  /** Hand-authored hard items flagged for expert human verification. */
  needsVerification?: boolean;
  /** Schema / genre reference (e.g. "Monty Hall problem"). */
  source?: string;
  /** Stable family ("template") id of the flashcard generator — see `Question.family`. */
  family?: string;
}

/**
 * Produces one fresh, exact-verified flashcard from a seeded RNG — the
 * flashcard analog of `QuestionGenerator` / `NumericQuestionGenerator`. Each
 * call returns a fully-populated `Flashcard` (prompt, answer, explanation,
 * difficulty, concept, source) whose `answer` is computed by an EXACT solver
 * (rational arithmetic / exact DP / exact linear-algebra), so infinitely many
 * fresh instances of a brainteaser "family" can be drawn with no LLM/API. The
 * prompt/explanation are templated (several phrasing variants) around the drawn
 * numbers so wording varies deterministically per seed.
 */
export interface FlashcardGenerator {
  (rng: Rng): Flashcard;
  families?: Record<string, FlashcardGenerator>;
}

/**
 * OPTIONAL, additive (back-compatible) DEEPER explanation for a level's intro
 * worked example — surfaced by the "Explain in more detail" action on the
 * lesson-intro / worked-example screen (see `src/components/tutor/DeepDivePanel`).
 *
 * ACCURACY CONTRACT: every field here is CONCEPTUAL framing only (the mental
 * model, the general method, and pitfalls stated in words). It must NOT restate
 * concrete numeric results — all concrete numbers in the deep-dive panel are
 * rendered from the level's OWN solver output (the worked steps, answer, and the
 * distractor / common-error rationale), so the authored prose can never drift
 * from what the questions actually test. When a level omits `deepDive`, the
 * panel still renders a complete, solver-grounded walk-through as the fallback.
 */
export interface DeepDive {
  /**
   * One–three sentences: WHY this approach works — the underlying principle /
   * mental model, in general terms (no problem-specific numbers).
   */
  whyItWorks?: string;
  /**
   * The general method as an ordered, conceptual checklist ("set up the sample
   * space", "condition on the first step", …). Not tied to specific numbers —
   * the concrete worked steps come from the solver and render alongside these.
   */
  approach?: string[];
  /**
   * Common misconceptions / traps for a confused beginner, stated in words.
   * These are ADDED to the solver's own distractor / common-error rationale.
   */
  pitfalls?: string[];
}

export interface LessonContent {
  /** Short teaching paragraphs shown before the questions (skippable). */
  paragraphs: string[];
  keyIdea?: string;
  whyInterviewers?: string;
  /**
   * OPTIONAL deeper, solver-grounded walk-through surfaced by the intro's
   * "Explain in more detail" action. Purely additive — see {@link DeepDive}.
   */
  deepDive?: DeepDive;
}

/**
 * How a level is played:
 *  - `"quiz"` (default): scored multiple-choice; mastery = fraction correct ≥
 *    `masteryThreshold`.
 *  - `"flashcard"`: integrity-based reveal-and-self-assess; no options, no
 *    score. Mastery = every pool problem marked "Got it", OR the learner
 *    explicitly declares they understand the topic.
 *  - `"numeric"`: scored free-entry; the learner types a number, graded by
 *    EXACT match. Mastery works exactly like `"quiz"` (fraction correct ≥
 *    `masteryThreshold`). Used by the Betting & Sizing (Kelly) section.
 */
export type LevelMode = "quiz" | "flashcard" | "numeric";

export interface Level {
  id: string;
  title: string;
  subtitle: string;
  /**
   * A single, self-contained sentence describing what this lesson teaches —
   * shown on the Table of Contents (`/contents`). Concrete and accurate to the
   * level's actual content, kept tight (≈ ≤ 140 chars). Required for every
   * playable level (enforced by `src/content/levels.test.ts`).
   */
  blurb: string;
  /**
   * Optional subcategory/section this level belongs to within its track (e.g.
   * "Betting & Sizing", "Game Theory", "Expected Value"). When a track bundles
   * several distinct topic families into one flat Candy-Crush path, consecutive
   * levels sharing a `section` form a labeled segment; the map / Table of
   * Contents render a divider whenever `section` changes. Levels with no
   * `section` (or the track's core levels) render without a banner.
   */
  section?: string;
  difficulty: Difficulty;
  lesson: LessonContent;
  /** Play style; defaults to `"quiz"` when omitted. */
  mode?: LevelMode;
  /** Fraction correct required to pass / master the level (e.g. 0.8). */
  masteryThreshold: number;
  /**
   * Content source. Exactly one of:
   *  - `questions`: a fixed hand-authored pool (optionally sampled to `drawCount`)
   *  - `generator`: a parametric generator producing `questionCount` fresh items
   *  - `flashcards`: a fixed pool of open-ended problems (mode `"flashcard"`)
   */
  questions?: Question[];
  drawCount?: number;
  generator?: QuestionGenerator;
  questionCount?: number;
  flashcards?: Flashcard[];
  /**
   * OPTIONAL parametric flashcard families (mode `"flashcard"`). A level may
   * carry BOTH a fixed `flashcards` pool AND one or more `flashcardGenerators`:
   * the static pool is the mastery deck (unchanged famous classics + the six
   * canonical originals), while each generator is a family that can produce
   * INFINITELY many fresh, exact-verified instances. The flashcard player draws
   * from these for "Give me another at this difficulty" (a new seed each time).
   * These generated cards are BONUS practice only — like the quiz/numeric
   * regenerate path they never touch mastery/streak/understood accounting.
   */
  flashcardGenerators?: FlashcardGenerator[];
  /**
   * Numeric (free-entry) content, mode `"numeric"`. Exactly one of:
   *  - `numericGenerator`: a parametric generator producing `questionCount`
   *    fresh numeric items (the Kelly factory).
   *  - `numericQuestions`: a fixed hand-authored pool (optionally `drawCount`).
   */
  numericGenerator?: NumericQuestionGenerator;
  numericQuestions?: NumericQuestion[];
}

export type MotifKey =
  | "probability"
  | "mathQuestions"
  | "mentalMath"
  | "brainteasers"
  | "interviewGames"
  | "calibration";

export interface Track {
  id: string;
  title: string;
  tagline: string;
  description: string;
  motif: MotifKey;
  levels: Level[];
  /** Teaser-only track (e.g. Calibration Gym) — shown but not playable yet. */
  comingSoon?: boolean;
}

export function totalQuestions(level: Level): number {
  if (level.numericGenerator) return level.questionCount ?? 5;
  if (level.numericQuestions)
    return level.drawCount ?? level.numericQuestions.length;
  if (level.generator) return level.questionCount ?? 5;
  if (level.questions) return level.drawCount ?? level.questions.length;
  if (level.flashcards) return level.flashcards.length;
  return 0;
}

/** True for levels played as an integrity-based flashcard deck. */
export function isFlashcardLevel(level: Level): boolean {
  return level.mode === "flashcard";
}

/** True for levels played as scored numeric free-entry (Betting & Sizing). */
export function isNumericLevel(level: Level): boolean {
  return level.mode === "numeric";
}
