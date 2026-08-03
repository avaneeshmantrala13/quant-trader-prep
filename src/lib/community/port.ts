/**
 * community/port.ts — the PERSISTENCE PORT for the Community layer (T13) plus a
 * ready-to-use in-memory implementation.
 *
 * This mirrors the `StorageProvider` port style in `src/lib/storage.ts`: the app
 * only ever talks to the `CommunityStore` INTERFACE, so persistence can be
 * swapped without touching any component or aggregation code. Today we ship
 * `InMemoryCommunityStore` (fully functional, offline, zero backend). WAVE-2
 * will add an `awsStorage`-backed implementation of THIS SAME interface — that
 * backend/infra edit is intentionally NOT done here (it's a separate serialized
 * step); the port is ready for it.
 *
 * Every method is `async` (returns a `Promise`) precisely so the Wave-2 network
 * implementation drops in with an identical signature. The in-memory store just
 * resolves synchronously.
 *
 * PRIVACY: the store REFUSES any record whose handle isn't a clean public handle
 * (`isCleanHandle`), so PII (e.g. an email) can never be persisted.
 */
import { isCleanHandle, summarizeItem } from "./aggregate";
import type {
  Comment,
  ContentFlag,
  ExperienceReport,
  FlagReason,
  Handle,
  InterviewOutcome,
  ItemAggregate,
  ReputationEvent,
  SubmittedSolution,
  TargetKind,
  VerificationFlag,
  Vote,
  VoteDimension,
} from "./types";

// --- input shapes (ids + timestamps are assigned by the store) --------------

export interface NewReport {
  itemId: string;
  authorHandle: Handle;
  title: string;
  body: string;
  company?: string;
  role?: string;
  outcome?: InterviewOutcome;
  tags?: string[];
}

export interface NewComment {
  itemId: string;
  authorHandle: Handle;
  body: string;
  parentId?: string | null;
}

export interface NewSolution {
  itemId: string;
  authorHandle: Handle;
  body: string;
  language?: string;
}

export interface NewVote {
  targetKind: TargetKind;
  targetId: string;
  voterHandle: Handle;
  dimension: VoteDimension;
  value: number;
}

export interface NewVerification {
  solutionId: string;
  byHandle: Handle;
  revoked?: boolean;
}

export interface NewFlag {
  targetKind: TargetKind;
  targetId: string;
  reporterHandle: Handle;
  reason: FlagReason;
  note?: string;
}

/**
 * The Community persistence PORT. Create/list content, cast votes, flag verified
 * solutions, append the reputation ledger, and read a rolled-up per-item
 * aggregate. Reads never throw on an unknown item — they return empty
 * collections so the UI is offline-graceful.
 */
export interface CommunityStore {
  // reports
  createReport(input: NewReport): Promise<ExperienceReport>;
  listReports(itemId?: string): Promise<ExperienceReport[]>;

  // discussion
  addComment(input: NewComment): Promise<Comment>;
  listComments(itemId: string): Promise<Comment[]>;

  // solutions
  addSolution(input: NewSolution): Promise<SubmittedSolution>;
  listSolutions(itemId: string): Promise<SubmittedSolution[]>;

  // votes
  castVote(input: NewVote): Promise<Vote>;
  listVotes(targetKind?: TargetKind, targetId?: string): Promise<Vote[]>;

  // verified-solution flags
  flagVerified(input: NewVerification): Promise<VerificationFlag>;
  listVerifications(): Promise<VerificationFlag[]>;

  // user report/flag (moderation queue, local-first)
  flagContent(input: NewFlag): Promise<ContentFlag>;
  listFlags(targetKind?: TargetKind, targetId?: string): Promise<ContentFlag[]>;

  // durable reputation ledger
  appendReputation(event: Omit<ReputationEvent, "id">): Promise<ReputationEvent>;
  listReputation(handle?: Handle): Promise<ReputationEvent[]>;

  // rolled-up read
  getItemAggregate(itemId: string): Promise<ItemAggregate>;
}

/** Injectable id + clock so tests can be fully deterministic. */
export interface CommunityStoreOptions {
  /** Monotonic id factory; default is an internal counter (`c1`, `c2`, …). */
  idFactory?: () => string;
  /** Clock in epoch ms; default `Date.now`. */
  now?: () => number;
}

/** Raised when a record carries something other than a clean public handle. */
export class PiiRejectedError extends Error {
  constructor(field: string) {
    super(`community: refused record — "${field}" is not a clean public handle`);
    this.name = "PiiRejectedError";
  }
}

/** Deep-copy a report (its `tags` array included) so callers can't mutate the store. */
const cloneReport = (r: ExperienceReport): ExperienceReport => ({
  ...r,
  tags: [...r.tags],
});

const dedupeTags = (tags: readonly string[] | undefined): string[] => {
  if (!tags) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = String(raw).trim().toLowerCase();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
};

/**
 * In-memory `CommunityStore`. Round-trips every content type, is fully
 * functional with NO backend (offline-graceful), and never persists PII.
 * Deterministic when constructed with explicit `idFactory`/`now`.
 */
export class InMemoryCommunityStore implements CommunityStore {
  private reports: ExperienceReport[] = [];
  private comments: Comment[] = [];
  private solutions: SubmittedSolution[] = [];
  private votes: Vote[] = [];
  private verifications: VerificationFlag[] = [];
  private reputation: ReputationEvent[] = [];
  private flags: ContentFlag[] = [];

  private readonly newId: () => string;
  private readonly now: () => number;

  constructor(opts: CommunityStoreOptions = {}) {
    let seq = 0;
    this.newId = opts.idFactory ?? (() => `c${++seq}`);
    this.now = opts.now ?? (() => Date.now());
  }

  private requireHandle(h: Handle, field: string): Handle {
    if (!isCleanHandle(h)) throw new PiiRejectedError(field);
    return h.trim();
  }

  async createReport(input: NewReport): Promise<ExperienceReport> {
    const report: ExperienceReport = {
      id: this.newId(),
      itemId: input.itemId,
      authorHandle: this.requireHandle(input.authorHandle, "authorHandle"),
      title: input.title,
      body: input.body,
      company: input.company,
      role: input.role,
      outcome: input.outcome,
      tags: dedupeTags(input.tags),
      createdAtMs: this.now(),
    };
    this.reports.push(report);
    return cloneReport(report);
  }

  async listReports(itemId?: string): Promise<ExperienceReport[]> {
    const rows = itemId
      ? this.reports.filter((r) => r.itemId === itemId)
      : this.reports;
    return rows.map(cloneReport);
  }

  async addComment(input: NewComment): Promise<Comment> {
    const comment: Comment = {
      id: this.newId(),
      itemId: input.itemId,
      authorHandle: this.requireHandle(input.authorHandle, "authorHandle"),
      body: input.body,
      parentId: input.parentId ?? null,
      createdAtMs: this.now(),
    };
    this.comments.push(comment);
    return { ...comment };
  }

  async listComments(itemId: string): Promise<Comment[]> {
    return this.comments.filter((c) => c.itemId === itemId).map((c) => ({ ...c }));
  }

  async addSolution(input: NewSolution): Promise<SubmittedSolution> {
    const solution: SubmittedSolution = {
      id: this.newId(),
      itemId: input.itemId,
      authorHandle: this.requireHandle(input.authorHandle, "authorHandle"),
      body: input.body,
      language: input.language,
      createdAtMs: this.now(),
    };
    this.solutions.push(solution);
    return { ...solution };
  }

  async listSolutions(itemId: string): Promise<SubmittedSolution[]> {
    return this.solutions.filter((s) => s.itemId === itemId).map((s) => ({ ...s }));
  }

  async castVote(input: NewVote): Promise<Vote> {
    const vote: Vote = {
      id: this.newId(),
      targetKind: input.targetKind,
      targetId: input.targetId,
      voterHandle: this.requireHandle(input.voterHandle, "voterHandle"),
      dimension: input.dimension,
      value: input.value,
      createdAtMs: this.now(),
    };
    this.votes.push(vote);
    return { ...vote };
  }

  async listVotes(targetKind?: TargetKind, targetId?: string): Promise<Vote[]> {
    return this.votes
      .filter(
        (v) =>
          (targetKind === undefined || v.targetKind === targetKind) &&
          (targetId === undefined || v.targetId === targetId),
      )
      .map((v) => ({ ...v }));
  }

  async flagVerified(input: NewVerification): Promise<VerificationFlag> {
    const flag: VerificationFlag = {
      id: this.newId(),
      solutionId: input.solutionId,
      byHandle: this.requireHandle(input.byHandle, "byHandle"),
      atMs: this.now(),
      revoked: input.revoked,
    };
    this.verifications.push(flag);
    return { ...flag };
  }

  async listVerifications(): Promise<VerificationFlag[]> {
    return this.verifications.map((f) => ({ ...f }));
  }

  async flagContent(input: NewFlag): Promise<ContentFlag> {
    const flag: ContentFlag = {
      id: this.newId(),
      targetKind: input.targetKind,
      targetId: input.targetId,
      reporterHandle: this.requireHandle(input.reporterHandle, "reporterHandle"),
      reason: input.reason,
      note: input.note,
      createdAtMs: this.now(),
    };
    this.flags.push(flag);
    return { ...flag };
  }

  async listFlags(
    targetKind?: TargetKind,
    targetId?: string,
  ): Promise<ContentFlag[]> {
    return this.flags
      .filter(
        (f) =>
          (targetKind === undefined || f.targetKind === targetKind) &&
          (targetId === undefined || f.targetId === targetId),
      )
      .map((f) => ({ ...f }));
  }

  async appendReputation(
    event: Omit<ReputationEvent, "id">,
  ): Promise<ReputationEvent> {
    const stored: ReputationEvent = {
      ...event,
      handle: this.requireHandle(event.handle, "handle"),
      id: this.newId(),
    };
    this.reputation.push(stored);
    return { ...stored };
  }

  async listReputation(handle?: Handle): Promise<ReputationEvent[]> {
    return this.reputation
      .filter((e) => handle === undefined || e.handle === handle)
      .map((e) => ({ ...e }));
  }

  async getItemAggregate(itemId: string): Promise<ItemAggregate> {
    return summarizeItem(
      itemId,
      this.reports,
      this.comments,
      this.solutions,
      this.votes,
      this.verifications,
    );
  }
}
