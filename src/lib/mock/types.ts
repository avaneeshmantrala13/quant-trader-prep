/**
 * TASK T10 — Mock-interview layer (verbal, AI-voice).
 *
 * A self-contained, deterministic interview engine that stitches together three
 * parts of a real quant screen:
 *   (a) spoken MENTAL-MATH with follow-up probes (scored),
 *   (b) BRAINTEASERS under a soft time limit with probing (reflect + self-assess),
 *   (c) BEHAVIORAL / fit questions (reflect-only, never scored).
 *
 * Everything in `src/lib/mock` is PURE: no React, no DOM, no storage, no network.
 * Question selection is fully seedable (same seed ⇒ same interview), and math
 * grading is deterministic. Speech I/O lives behind a feature-detected wrapper
 * (`./speech`) that degrades to typed input when unavailable, so the drill is
 * always usable — including in SSR / test environments with no `window`.
 *
 * PRIVACY: transcripts (spoken or typed) are treated as transient. Nothing here
 * ever writes to `localStorage`, cookies, or the network, and the persistable
 * summary (see `./engine#toPersistableSummary`) deliberately OMITS raw response
 * text so no PII can leak out of the session.
 */

/** Which of the three interview parts a step belongs to. */
export type MockStage = "math" | "brainteaser" | "behavioral";

/** How the learner answers a step — spoken (with typed fallback) or reflect-only. */
export type StepMode = "answer" | "reflect";

/**
 * (a) A scored spoken mental-math question. `answer`/`decimals`/`commonErrors`
 * mirror the shape `@/lib/numeric` grades against, so a spoken or typed answer
 * string can be graded deterministically. `followUps` are reflect-only verbal
 * probes the interviewer asks after the answer (never scored).
 */
export interface MathStep {
  kind: "math";
  id: string;
  /** Spoken/displayed question prompt. */
  prompt: string;
  /** Exact correct value (graded via `@/lib/numeric`). */
  answer: number;
  /** Decimal precision the answer carries (see `NumericQuestion.decimals`). */
  decimals?: number;
  concept?: string;
  /** Worked solution revealed after answering. */
  explanation: string;
  /** Known wrong values → targeted coaching (mirrors `NumericQuestion.commonErrors`). */
  commonErrors?: { value: number; feedback: string; misconception?: string }[];
  /** Reflect-only follow-up probes (e.g. "walk me through your method"). */
  followUps: string[];
  /** Timing target in ms; scoring bands are derived from this. */
  targetMs: number;
  source?: string;
}

/**
 * (b) A brainteaser posed under a soft time limit. Reveal-and-self-assess (no
 * deterministic scoring — the "aha" is the point), with probing follow-ups.
 */
export interface BrainteaserStep {
  kind: "brainteaser";
  id: string;
  prompt: string;
  /** Concise answer revealed after the learner reasons / time expires. */
  answer: string;
  /** Full reasoning shown on reveal. */
  explanation: string;
  concept?: string;
  /** Probing follow-ups the interviewer asks (reflect-only). */
  probes: string[];
  /** Soft time budget in seconds (UI hint; does not gate the flow). */
  timeLimitSec: number;
  source?: string;
}

/**
 * (c) A behavioral / fit question. Reflect-only: the learner speaks or types a
 * response for their own review; nothing is graded or judged.
 */
export interface BehavioralStep {
  kind: "behavioral";
  id: string;
  prompt: string;
  /** Optional single probing follow-up. */
  followUp?: string;
  /** Bulleted things a strong answer tends to cover (self-review hints). */
  reflectionHints: string[];
}

export type MockStep = MathStep | BrainteaserStep | BehavioralStep;

/** Difficulty tier that selects the mental-math pool. */
export type MathTier = "easy" | "medium" | "hard";

/**
 * Deterministic interview configuration. The same `seed` (and counts/tier)
 * always produces byte-identical questions.
 */
export interface MockConfig {
  seed: number;
  /** Number of scored math questions (default 3). */
  mathCount?: number;
  /** Number of timed brainteasers (default 2). */
  brainteaserCount?: number;
  /** Number of behavioral questions (default 2). */
  behavioralCount?: number;
  /** Mental-math difficulty pool (default "medium"). */
  tier?: MathTier;
}

/** A fully-built, deterministic interview script. */
export interface MockScript {
  seed: number;
  tier: MathTier;
  /** A friendly, deterministic opening line from the AI interviewer. */
  intro: string;
  steps: MockStep[];
}

/** Timing verdict for a math answer. */
export type TimingBand = "fast" | "ok" | "slow";

/** Deterministic grade for one spoken/typed math answer. */
export interface MathScore {
  /** Parsed numeric value (after spoken-number normalization), or null. */
  parsed: number | null;
  correct: boolean;
  /** Targeted feedback if the wrong answer matched a known error. */
  matchedError?: { value: number; feedback: string; misconception?: string };
  elapsedMs: number;
  targetMs: number;
  timing: TimingBand;
  /** 0..1 correctness score (timing is reported separately, never penalizes it). */
  score: number;
}

/**
 * One in-memory response record. `raw` is the TRANSIENT transcript (spoken or
 * typed) and is intentionally excluded from any persistable summary — see the
 * `PersistableResponse` type and `toPersistableSummary`.
 */
export interface MockResponse {
  stepId: string;
  stage: MockStage;
  /** Raw transcript — TRANSIENT, in-memory only, never persisted. */
  raw: string;
  /** Whether the input arrived via speech recognition (vs typed fallback). */
  viaSpeech: boolean;
  /** Present only for math steps. */
  score?: MathScore;
  /** Learner self-assessment for brainteasers ("got it" / "missed it"). */
  selfAssessed?: "got" | "missed";
}

/**
 * PII-free projection of a response, safe to persist/export. Note the ABSENCE
 * of `raw` — no transcript text ever appears here.
 */
export interface PersistableResponse {
  stepId: string;
  stage: MockStage;
  viaSpeech: boolean;
  correct?: boolean;
  timing?: TimingBand;
  score?: number;
  selfAssessed?: "got" | "missed";
}

/** Aggregate, PII-free session summary. */
export interface MockSummary {
  seed: number;
  tier: MathTier;
  mathTotal: number;
  mathCorrect: number;
  mathAvgElapsedMs: number | null;
  brainteaserSeen: number;
  brainteaserGotIt: number;
  behavioralAnswered: number;
  responses: PersistableResponse[];
}
