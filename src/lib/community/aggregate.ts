/**
 * community/aggregate.ts — PURE, deterministic aggregation for the Community
 * layer (T13). Nothing here touches storage, the network, `Date.now`, or random
 * numbers: every function is a total function of its inputs, so the same records
 * always produce the same tallies/rankings (client and a future Lambda can
 * share it verbatim, exactly like `leaderboard/rescore.ts`).
 *
 * Responsibilities:
 *  - vote hygiene (one latest vote per voter/target/dimension) + quality tally
 *  - difficulty averaging
 *  - karma/reputation from an append-only event log
 *  - "verified solution" resolution + deterministic solution/report ranking
 *  - deriving a durable reputation ledger from raw votes/verifications
 *  - a rolled-up per-item aggregate + social-proof counts
 *  - a handle-privacy screen (`isCleanHandle`) so no PII sneaks in
 */
import type {
  Comment,
  DifficultyRating,
  ExperienceReport,
  Handle,
  ItemAggregate,
  QualityTally,
  ReputationEvent,
  SubmittedSolution,
  TargetKind,
  VerificationFlag,
  Vote,
} from "./types";

// --- constants (tunable karma weights; documented, not magic) ---------------

/** Karma awarded/deducted per reputation reason. Verified pays the most. */
export const KARMA_WEIGHTS = {
  report_upvoted: 5,
  comment_upvoted: 2,
  solution_upvoted: 10,
  solution_verified: 25,
  /** A downvote costs the author a small, fixed amount. */
  content_downvoted: -2,
} as const;

const HANDLE_MIN = 3;
const HANDLE_MAX = 20;

// --- handle privacy screen --------------------------------------------------

/**
 * True iff `h` is a well-formed PUBLIC display handle — the only identity the
 * community layer accepts. Mirrors the leaderboard's rules (3–20 chars;
 * letters/digits/space/`_`/`-`) and, crucially, rejects anything that looks
 * like PII (an `@`, i.e. an email). Pure; used by the store to refuse PII at
 * the boundary and by tests to assert none is ever stored.
 */
export function isCleanHandle(h: string): boolean {
  const v = String(h ?? "").trim();
  if (v.length < HANDLE_MIN || v.length > HANDLE_MAX) return false;
  return /^[A-Za-z0-9 _-]+$/.test(v);
}

// --- vote hygiene + tallies -------------------------------------------------

const voteKey = (v: Vote): string =>
  `${v.voterHandle}\u0000${v.targetKind}\u0000${v.targetId}\u0000${v.dimension}`;

/**
 * Collapse a vote log to ONE vote per (voter, target, dimension): the latest by
 * `createdAtMs` wins (ties broken by the larger `id` so it's deterministic).
 * This makes re-voting idempotent-ish — a user flipping up→down just replaces
 * their prior vote rather than stacking.
 */
export function latestVotes(votes: readonly Vote[]): Vote[] {
  const best = new Map<string, Vote>();
  for (const v of votes) {
    const k = voteKey(v);
    const cur = best.get(k);
    if (
      !cur ||
      v.createdAtMs > cur.createdAtMs ||
      (v.createdAtMs === cur.createdAtMs && v.id > cur.id)
    ) {
      best.set(k, v);
    }
  }
  // Sort for a stable, deterministic return order.
  return [...best.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const isTarget = (v: Vote, kind: TargetKind, id: string): boolean =>
  v.targetKind === kind && v.targetId === id;

/**
 * Net quality tally (up/down/score) for a single target. De-dupes first, then
 * counts each latest quality vote by the sign of its `value`.
 */
export function tallyQuality(
  votes: readonly Vote[],
  kind: TargetKind,
  targetId: string,
): QualityTally {
  let up = 0;
  let down = 0;
  for (const v of latestVotes(votes)) {
    if (v.dimension !== "quality" || !isTarget(v, kind, targetId)) continue;
    if (v.value > 0) up += 1;
    else if (v.value < 0) down += 1;
  }
  return { up, down, score: up - down };
}

const clampDifficulty = (n: number): number => Math.min(5, Math.max(1, Math.round(n)));

/**
 * Average difficulty (1..5) for a target from the latest difficulty votes.
 * Returns `{ average: null, count: 0 }` when nobody has rated it. The average
 * is rounded to 2 decimals so it's stable to compare/serialize.
 */
export function averageDifficulty(
  votes: readonly Vote[],
  kind: TargetKind,
  targetId: string,
): DifficultyRating {
  const vals: number[] = [];
  for (const v of latestVotes(votes)) {
    if (v.dimension !== "difficulty" || !isTarget(v, kind, targetId)) continue;
    vals.push(clampDifficulty(v.value));
  }
  if (vals.length === 0) return { average: null, count: 0 };
  const mean = vals.reduce((s, n) => s + n, 0) / vals.length;
  return { average: Math.round(mean * 100) / 100, count: vals.length };
}

// --- reputation / karma -----------------------------------------------------

/**
 * Reduce the append-only reputation ledger to `{ handle → total karma }`. Sum
 * of deltas — never a mutable counter — so it's always reconstructable. Keys are
 * only handles that appear in the log.
 */
export function computeReputation(
  events: readonly ReputationEvent[],
): Record<Handle, number> {
  const out: Record<Handle, number> = {};
  for (const e of events) {
    out[e.handle] = (out[e.handle] ?? 0) + e.delta;
  }
  return out;
}

/** Karma for a single handle (0 when it has no events). */
export function karmaFor(
  events: readonly ReputationEvent[],
  handle: Handle,
): number {
  let sum = 0;
  for (const e of events) if (e.handle === handle) sum += e.delta;
  return sum;
}

/** A named reputation tier for the badge UI. */
export interface ReputationTier {
  id: "newcomer" | "contributor" | "trusted" | "expert" | "legend";
  label: string;
  /** Inclusive lower karma bound for this tier. */
  min: number;
}

const TIERS: ReputationTier[] = [
  { id: "legend", label: "Legend", min: 1000 },
  { id: "expert", label: "Expert", min: 250 },
  { id: "trusted", label: "Trusted", min: 75 },
  { id: "contributor", label: "Contributor", min: 15 },
  { id: "newcomer", label: "Newcomer", min: Number.NEGATIVE_INFINITY },
];

/** Map a karma total to its reputation tier (deterministic, total). */
export function reputationTier(karma: number): ReputationTier {
  return TIERS.find((t) => karma >= t.min) ?? TIERS[TIERS.length - 1];
}

// --- author index (who owns which target) ----------------------------------

/**
 * Build a `${kind}:${id} → authorHandle` lookup so vote-driven reputation can
 * credit the right author without a DB join. Pure over the three content lists.
 */
export function buildAuthorIndex(
  reports: readonly ExperienceReport[],
  comments: readonly Comment[],
  solutions: readonly SubmittedSolution[],
): Map<string, Handle> {
  const idx = new Map<string, Handle>();
  for (const r of reports) idx.set(`report:${r.id}`, r.authorHandle);
  for (const c of comments) idx.set(`comment:${c.id}`, c.authorHandle);
  for (const s of solutions) idx.set(`solution:${s.id}`, s.authorHandle);
  return idx;
}

const UPVOTE_REASON: Record<
  TargetKind,
  "report_upvoted" | "comment_upvoted" | "solution_upvoted"
> = {
  report: "report_upvoted",
  comment: "comment_upvoted",
  solution: "solution_upvoted",
};

/**
 * DERIVE a durable reputation ledger from raw votes + verification flags. This
 * is the pure bridge the integrator persists: each *latest* quality vote credits
 * (or debits) the target's author, and every active verification flag awards the
 * solution author the verified bonus. Event ids are deterministic (derived from
 * the source), so re-deriving is stable and de-dupable.
 */
export function deriveReputationEvents(
  votes: readonly Vote[],
  verifications: readonly VerificationFlag[],
  authorIndex: Map<string, Handle>,
): ReputationEvent[] {
  const events: ReputationEvent[] = [];

  for (const v of latestVotes(votes)) {
    if (v.dimension !== "quality" || v.value === 0) continue;
    const author = authorIndex.get(`${v.targetKind}:${v.targetId}`);
    if (!author) continue;
    const up = v.value > 0;
    events.push({
      id: `rep:vote:${v.id}`,
      handle: author,
      delta: up ? KARMA_WEIGHTS[UPVOTE_REASON[v.targetKind]] : KARMA_WEIGHTS.content_downvoted,
      reason: up ? UPVOTE_REASON[v.targetKind] : "content_downvoted",
      sourceKind: v.targetKind,
      sourceId: v.targetId,
      atMs: v.createdAtMs,
    });
  }

  for (const f of activeVerifications(verifications)) {
    const author = authorIndex.get(`solution:${f.solutionId}`);
    if (!author) continue;
    events.push({
      id: `rep:verify:${f.solutionId}`,
      handle: author,
      delta: KARMA_WEIGHTS.solution_verified,
      reason: "solution_verified",
      sourceKind: "solution",
      sourceId: f.solutionId,
      atMs: f.atMs,
    });
  }

  return events.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// --- verified-solution resolution + ranking ---------------------------------

/**
 * The set of solution ids that are currently verified. A solution is verified
 * iff its LATEST flag (by `atMs`, tie-broken by id) is not revoked.
 */
export function activeVerifications(
  flags: readonly VerificationFlag[],
): VerificationFlag[] {
  const latest = new Map<string, VerificationFlag>();
  for (const f of flags) {
    const cur = latest.get(f.solutionId);
    if (
      !cur ||
      f.atMs > cur.atMs ||
      (f.atMs === cur.atMs && f.id > cur.id)
    ) {
      latest.set(f.solutionId, f);
    }
  }
  return [...latest.values()]
    .filter((f) => !f.revoked)
    .sort((a, b) => (a.solutionId < b.solutionId ? -1 : a.solutionId > b.solutionId ? 1 : 0));
}

/** True iff `solutionId` is currently verified. */
export function isVerified(
  solutionId: string,
  flags: readonly VerificationFlag[],
): boolean {
  return activeVerifications(flags).some((f) => f.solutionId === solutionId);
}

/**
 * Rank solutions best-first: verified before unverified, then higher quality
 * score, then more recent, then id (fully deterministic total order). Does not
 * mutate the input.
 */
export function rankSolutions(
  solutions: readonly SubmittedSolution[],
  votes: readonly Vote[],
  flags: readonly VerificationFlag[],
): SubmittedSolution[] {
  const verified = new Set(activeVerifications(flags).map((f) => f.solutionId));
  return [...solutions].sort((a, b) => {
    const va = verified.has(a.id) ? 1 : 0;
    const vb = verified.has(b.id) ? 1 : 0;
    if (va !== vb) return vb - va;
    const sa = tallyQuality(votes, "solution", a.id).score;
    const sb = tallyQuality(votes, "solution", b.id).score;
    if (sa !== sb) return sb - sa;
    if (a.createdAtMs !== b.createdAtMs) return b.createdAtMs - a.createdAtMs;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Resolve the single CANONICAL verified solution for an item: the top-ranked
 * solution that is actually verified, or `null` when none is verified. This is
 * the "verified solution" the UI pins to the top.
 */
export function resolveVerifiedSolution(
  solutions: readonly SubmittedSolution[],
  votes: readonly Vote[],
  flags: readonly VerificationFlag[],
): string | null {
  const verified = new Set(activeVerifications(flags).map((f) => f.solutionId));
  const ranked = rankSolutions(
    solutions.filter((s) => verified.has(s.id)),
    votes,
    flags,
  );
  return ranked.length > 0 ? ranked[0].id : null;
}

/**
 * Rank experience reports best-first: higher quality score, then more recent,
 * then id. Deterministic; non-mutating.
 */
export function rankReports(
  reports: readonly ExperienceReport[],
  votes: readonly Vote[],
): ExperienceReport[] {
  return [...reports].sort((a, b) => {
    const sa = tallyQuality(votes, "report", a.id).score;
    const sb = tallyQuality(votes, "report", b.id).score;
    if (sa !== sb) return sb - sa;
    if (a.createdAtMs !== b.createdAtMs) return b.createdAtMs - a.createdAtMs;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// --- per-item rollup / social proof -----------------------------------------

/**
 * Roll everything about one item into a presentation-ready `ItemAggregate`:
 * counts, distinct contributors, an item-level difficulty average (from
 * difficulty votes on its reports), the canonical verified solution, and the
 * best-first solution ordering. All inputs may be the full, unfiltered logs —
 * this filters by `itemId` itself.
 */
export function summarizeItem(
  itemId: string,
  reports: readonly ExperienceReport[],
  comments: readonly Comment[],
  solutions: readonly SubmittedSolution[],
  votes: readonly Vote[],
  flags: readonly VerificationFlag[],
): ItemAggregate {
  const itemReports = reports.filter((r) => r.itemId === itemId);
  const itemComments = comments.filter((c) => c.itemId === itemId);
  const itemSolutions = solutions.filter((s) => s.itemId === itemId);

  const contributors = new Set<Handle>();
  for (const r of itemReports) contributors.add(r.authorHandle);
  for (const c of itemComments) contributors.add(c.authorHandle);
  for (const s of itemSolutions) contributors.add(s.authorHandle);

  // Item-level difficulty = average of difficulty votes across its reports.
  const diffVals: number[] = [];
  for (const r of itemReports) {
    const d = averageDifficulty(votes, "report", r.id);
    if (d.average !== null) diffVals.push(d.average);
  }
  const difficulty: DifficultyRating =
    diffVals.length === 0
      ? { average: null, count: 0 }
      : {
          average:
            Math.round((diffVals.reduce((s, n) => s + n, 0) / diffVals.length) * 100) / 100,
          count: diffVals.length,
        };

  const ranked = rankSolutions(itemSolutions, votes, flags);

  return {
    itemId,
    reportCount: itemReports.length,
    commentCount: itemComments.length,
    solutionCount: itemSolutions.length,
    contributorCount: contributors.size,
    difficulty,
    verifiedSolutionId: resolveVerifiedSolution(itemSolutions, votes, flags),
    topSolutionIds: ranked.map((s) => s.id),
  };
}

// --- discussion threading ---------------------------------------------------

/** A comment plus its (recursively-built) replies, for the thread UI. */
export interface ThreadNode {
  comment: Comment;
  replies: ThreadNode[];
}

/**
 * Build a nested discussion tree from a flat comment log. Top-level comments
 * (`parentId === null`, or a dangling parent) become roots; replies attach to
 * their parent. Siblings are ordered oldest-first (then id) so the thread reads
 * chronologically and deterministically. Cycles/dangling parents are handled
 * gracefully (orphans are promoted to roots).
 */
export function buildThread(comments: readonly Comment[]): ThreadNode[] {
  const nodes = new Map<string, ThreadNode>();
  for (const c of comments) nodes.set(c.id, { comment: c, replies: [] });

  const roots: ThreadNode[] = [];
  for (const c of comments) {
    const node = nodes.get(c.id)!;
    const parent = c.parentId ? nodes.get(c.parentId) : undefined;
    if (parent && parent !== node) parent.replies.push(node);
    else roots.push(node);
  }

  const sortRec = (list: ThreadNode[]): void => {
    list.sort((a, b) =>
      a.comment.createdAtMs !== b.comment.createdAtMs
        ? a.comment.createdAtMs - b.comment.createdAtMs
        : a.comment.id < b.comment.id
          ? -1
          : a.comment.id > b.comment.id
            ? 1
            : 0,
    );
    for (const n of list) sortRec(n.replies);
  };
  sortRec(roots);
  return roots;
}
