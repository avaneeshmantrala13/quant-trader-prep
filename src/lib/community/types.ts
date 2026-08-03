/**
 * community/types.ts — the typed data models for the Community & social-proof
 * layer (T13): interview EXPERIENCE REPORTS, per-item DISCUSSION + user
 * SUBMITTED SOLUTIONS, VERIFIED-SOLUTION flags, quality/difficulty VOTES, and a
 * durable REPUTATION/KARMA event log.
 *
 * PRIVACY (hard rule): the ONLY identity a record ever carries is a public
 * display `handle` (see `Handle`). No emails, no real names, no user ids, no
 * tokens — ever. Everything here round-trips through the `CommunityStore` port
 * (see `port.ts`) so the Wave-2 awsStorage-backed implementation can persist the
 * exact same shapes without leaking PII.
 *
 * All timestamps are epoch milliseconds (`number`) so records are trivially
 * serializable and the pure aggregators in `aggregate.ts` stay deterministic.
 */

/**
 * A public, opt-in display handle — the sole identity on every community
 * record. This is intentionally a nominal-ish alias (not an email/username) to
 * document, at every call site, that nothing here is PII. Validation lives in
 * `aggregate.ts` (`isCleanHandle`), mirroring the leaderboard's display-name
 * rules (3–20 chars, letters/digits/space/`_`/`-`).
 */
export type Handle = string;

/** Everything that can be voted on / attributed to a `Handle`. */
export type TargetKind = "report" | "comment" | "solution";

/** The self-reported outcome of an interview loop (never required). */
export type InterviewOutcome =
  | "offer"
  | "no_offer"
  | "pending"
  | "withdrew";

/** The two independent vote dimensions (see `Vote`). */
export type VoteDimension = "quality" | "difficulty";

/**
 * An interview EXPERIENCE REPORT: a first-person write-up attached to a course
 * item (a question, topic, or company loop). `itemId` is the join key the
 * course content already uses elsewhere.
 */
export interface ExperienceReport {
  id: string;
  itemId: string;
  authorHandle: Handle;
  title: string;
  body: string;
  /** Optional, coarse, non-identifying context. */
  company?: string;
  role?: string;
  outcome?: InterviewOutcome;
  /** Free-form, lowercased, de-duplicated topic tags. */
  tags: string[];
  createdAtMs: number;
}

/**
 * A DISCUSSION comment on an item. A flat log with an optional `parentId`
 * builds an arbitrarily-nested thread (resolved by `buildThread` in
 * `aggregate.ts`) without a recursive storage shape.
 */
export interface Comment {
  id: string;
  itemId: string;
  authorHandle: Handle;
  body: string;
  /** `null` for a top-level comment; a `Comment.id` for a reply. */
  parentId: string | null;
  createdAtMs: number;
}

/** A user-SUBMITTED SOLUTION to an item. */
export interface SubmittedSolution {
  id: string;
  itemId: string;
  authorHandle: Handle;
  body: string;
  /** Optional language tag for code solutions (e.g. "python"). */
  language?: string;
  createdAtMs: number;
}

/**
 * A VERIFICATION FLAG marking a solution as "verified" by a trusted reviewer.
 * Modeled as an append-only, optionally-revoked event so history is durable and
 * `resolveVerifiedSolution` can pick the canonical answer deterministically.
 */
export interface VerificationFlag {
  id: string;
  solutionId: string;
  /** The reviewer's public handle (no roles/PII stored). */
  byHandle: Handle;
  atMs: number;
  /** A later revocation supersedes an earlier flag for the same solution. */
  revoked?: boolean;
}

/**
 * A VOTE. Two independent dimensions share one shape:
 *  - `quality`   → `value` is +1 (up) or −1 (down); tallies to a net score.
 *  - `difficulty`→ `value` is an integer 1..5; averages to a difficulty rating.
 * Exactly one vote per (voter, target, dimension) is meaningful — the LATEST by
 * `createdAtMs` wins (see `latestVotes`), so re-voting overwrites cleanly.
 */
export interface Vote {
  id: string;
  targetKind: TargetKind;
  targetId: string;
  voterHandle: Handle;
  dimension: VoteDimension;
  value: number;
  createdAtMs: number;
}

/** Why a handle's karma changed — the durable reputation ledger's reason code. */
export type ReputationReason =
  | "report_upvoted"
  | "comment_upvoted"
  | "solution_upvoted"
  | "solution_verified"
  | "content_downvoted"
  | "manual_adjustment";

/**
 * A single entry in the durable REPUTATION/KARMA ledger. Karma is the SUM of
 * `delta` over a handle's events (see `computeReputation`) — never a mutable
 * counter — so it's reconstructable and auditable.
 */
export interface ReputationEvent {
  id: string;
  /** The handle whose karma this event affects. */
  handle: Handle;
  delta: number;
  reason: ReputationReason;
  /** Optional provenance: what triggered it. */
  sourceKind?: TargetKind;
  sourceId?: string;
  atMs: number;
}

/** Net quality-vote tally for a single target. */
export interface QualityTally {
  up: number;
  down: number;
  /** `up - down`. */
  score: number;
}

/** Aggregated difficulty rating for a target (or `null` when unrated). */
export interface DifficultyRating {
  average: number | null;
  count: number;
}

/** Why a user reported a piece of content — a coarse, non-identifying reason. */
export type FlagReason =
  | "profanity"
  | "harassment"
  | "spam"
  | "off_topic"
  | "misinformation"
  | "other";

/**
 * A user-submitted REPORT/FLAG against a piece of content (a report, comment, or
 * solution). Append-only and local-first: it records only the public reporter
 * `handle`, the target, a coarse reason, and an optional short note — never PII.
 * Human moderators (out of scope for code) triage these; see the legal to-dos.
 */
export interface ContentFlag {
  id: string;
  targetKind: TargetKind;
  targetId: string;
  /** The public handle of the reporter (no PII stored). */
  reporterHandle: Handle;
  reason: FlagReason;
  /** Optional short, free-form context from the reporter. */
  note?: string;
  createdAtMs: number;
}

/** A rolled-up, presentation-ready summary of all activity on one item. */
export interface ItemAggregate {
  itemId: string;
  reportCount: number;
  commentCount: number;
  solutionCount: number;
  /** Distinct contributing handles across reports/comments/solutions. */
  contributorCount: number;
  difficulty: DifficultyRating;
  /** The canonical verified solution id, or `null`. */
  verifiedSolutionId: string | null;
  /** Solution ids ranked best-first (verified, then quality, then recency). */
  topSolutionIds: string[];
}
