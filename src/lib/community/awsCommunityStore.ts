/**
 * awsCommunityStore.ts — the AWS Free-Tier implementation of the `CommunityStore`
 * port (T13 backend / Wave-2). It persists every community record (experience
 * reports, discussion comments, submitted solutions, votes, verification flags,
 * and the durable reputation ledger) to ONE DynamoDB table, and satisfies the
 * exact same interface `InMemoryCommunityStore` does — so swapping backends is a
 * single factory decision (`createCommunityStore`), with zero component or
 * aggregation changes.
 *
 * Bundle note: like `awsStorage.ts`, every `@aws-sdk/*` import is a lazy
 * `import()` so the heavy SDK lands in a SEPARATE async chunk and NEVER enters
 * the default local-first bundle. The Dynamo credential/client path is SHARED
 * with progress storage via `createAwsDynamoContext` (see `awsStorage.ts`), so
 * community and progress writes authenticate through one Cognito Identity-Pool
 * exchange.
 *
 * Single-table design (mirrors the leaderboard's bounded PK/SK model — no GSIs):
 *   PK = collection kind ("REPORT" | "COMMENT" | "SOLUTION" | "VOTE" | "VERIFY"
 *        | "REP"); SK encodes the scoping key(s) + id so a single `Query`
 *   (optionally `begins_with`) serves every port read. All records carry ONLY a
 *   public `handle` (the port's PII screen refuses anything else), so nothing
 *   PII-shaped is ever written.
 *
 * Import-time safety: nothing here runs at module load or touches the network.
 * Constructing the store is inert; the SDK is only imported (and the network is
 * only hit) when a write/read is actually performed against a live session.
 */
import { isCleanHandle, summarizeItem } from "./aggregate";
import {
  PiiRejectedError,
  type CommunityStore,
  type CommunityStoreOptions,
  type NewComment,
  type NewFlag,
  type NewReport,
  type NewSolution,
  type NewVerification,
  type NewVote,
} from "./port";
import type {
  Comment,
  ContentFlag,
  ExperienceReport,
  Handle,
  ItemAggregate,
  ReputationEvent,
  SubmittedSolution,
  TargetKind,
  VerificationFlag,
  Vote,
} from "./types";

/**
 * Minimal structural view of a DynamoDB document client — just the `send` we
 * need. Kept narrow (rather than importing the concrete SDK type) so tests can
 * inject a lightweight stub and the SDK stays out of the default bundle.
 */
export interface CommunityDocClient {
  send(command: unknown): Promise<{
    Items?: Record<string, unknown>[];
    LastEvaluatedKey?: Record<string, unknown>;
  }>;
}

/** Resolves an authenticated doc client, or `null` when logged-out / offline. */
export type CommunityClientProvider = () => Promise<CommunityDocClient | null>;

export interface AwsCommunityStoreOptions extends CommunityStoreOptions {
  /** DynamoDB table name holding all community records. */
  tableName: string;
  /** Lazily resolves the authenticated Dynamo doc client (shared w/ progress). */
  getClient: CommunityClientProvider;
}

/** DynamoDB partition keys — one bounded partition per collection kind. */
const PK = {
  report: "REPORT",
  comment: "COMMENT",
  solution: "SOLUTION",
  vote: "VOTE",
  verification: "VERIFY",
  reputation: "REP",
  flag: "FLAG",
} as const;

/** Deep-copy a report (its `tags` array included) so callers can't mutate. */
const cloneReport = (r: ExperienceReport): ExperienceReport => ({
  ...r,
  tags: [...r.tags],
});

/** Lowercase, trim, and de-dupe tags (matches `InMemoryCommunityStore`). */
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
 * AWS-backed `CommunityStore`. All methods are async (the port is async
 * precisely so this drops in with identical signatures). Reads are
 * offline-graceful: with no live session they resolve empty collections rather
 * than throwing. Writes require a session and surface a clear error otherwise.
 */
export class AwsCommunityStore implements CommunityStore {
  private readonly tableName: string;
  private readonly getClient: CommunityClientProvider;
  private readonly newId: () => string;
  private readonly now: () => number;

  // Lazily-loaded command classes (kept out of the default bundle).
  private cmds: typeof import("@aws-sdk/lib-dynamodb") | null = null;

  constructor(opts: AwsCommunityStoreOptions) {
    this.tableName = opts.tableName;
    this.getClient = opts.getClient;
    // Distributed default id: no shared counter across clients. Deterministic
    // when tests inject `idFactory`.
    this.newId =
      opts.idFactory ??
      (() =>
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
    this.now = opts.now ?? (() => Date.now());
  }

  // ------------------------------------------------------------- low-level I/O
  private async commands(): Promise<typeof import("@aws-sdk/lib-dynamodb")> {
    if (!this.cmds) this.cmds = await import("@aws-sdk/lib-dynamodb");
    return this.cmds;
  }

  private requireHandle(h: Handle, field: string): Handle {
    if (!isCleanHandle(h)) throw new PiiRejectedError(field);
    return h.trim();
  }

  /** Put one item (throws if there is no live session — writes need one). */
  private async put(item: Record<string, unknown>): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      throw new Error(
        "community: no AWS session — sign in to persist community data.",
      );
    }
    const { PutCommand } = await this.commands();
    await client.send(new PutCommand({ TableName: this.tableName, Item: item }));
  }

  /**
   * Query one partition (optionally by an SK `begins_with` prefix), paging
   * through every page. Returns raw items with `PK`/`SK` stripped. Offline
   * (no session) resolves `[]`.
   */
  private async query(
    pk: string,
    skPrefix?: string,
  ): Promise<Record<string, unknown>[]> {
    const client = await this.getClient();
    if (!client) return [];
    const { QueryCommand } = await this.commands();

    const out: Record<string, unknown>[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const res = await client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: skPrefix
            ? "#pk = :pk AND begins_with(#sk, :sk)"
            : "#pk = :pk",
          ExpressionAttributeNames: skPrefix
            ? { "#pk": "PK", "#sk": "SK" }
            : { "#pk": "PK" },
          ExpressionAttributeValues: skPrefix
            ? { ":pk": pk, ":sk": skPrefix }
            : { ":pk": pk },
          ExclusiveStartKey: startKey,
        }),
      );
      for (const raw of res.Items ?? []) {
        const { PK: _pk, SK: _sk, ...rest } = raw as Record<string, unknown>;
        void _pk;
        void _sk;
        out.push(rest);
      }
      startKey = res.LastEvaluatedKey;
    } while (startKey);
    return out;
  }

  // ----------------------------------------------------------------- reports
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
    await this.put({
      PK: PK.report,
      SK: `${report.itemId}#${report.createdAtMs}#${report.id}`,
      ...report,
    });
    return cloneReport(report);
  }

  async listReports(itemId?: string): Promise<ExperienceReport[]> {
    const rows = await this.query(
      PK.report,
      itemId ? `${itemId}#` : undefined,
    );
    return rows.map((r) => cloneReport(r as unknown as ExperienceReport));
  }

  // -------------------------------------------------------------- discussion
  async addComment(input: NewComment): Promise<Comment> {
    const comment: Comment = {
      id: this.newId(),
      itemId: input.itemId,
      authorHandle: this.requireHandle(input.authorHandle, "authorHandle"),
      body: input.body,
      parentId: input.parentId ?? null,
      createdAtMs: this.now(),
    };
    await this.put({
      PK: PK.comment,
      SK: `${comment.itemId}#${comment.createdAtMs}#${comment.id}`,
      ...comment,
    });
    return { ...comment };
  }

  async listComments(itemId: string): Promise<Comment[]> {
    const rows = await this.query(PK.comment, `${itemId}#`);
    return rows.map((r) => ({ ...(r as unknown as Comment) }));
  }

  // ---------------------------------------------------------------- solutions
  async addSolution(input: NewSolution): Promise<SubmittedSolution> {
    const solution: SubmittedSolution = {
      id: this.newId(),
      itemId: input.itemId,
      authorHandle: this.requireHandle(input.authorHandle, "authorHandle"),
      body: input.body,
      language: input.language,
      createdAtMs: this.now(),
    };
    await this.put({
      PK: PK.solution,
      SK: `${solution.itemId}#${solution.createdAtMs}#${solution.id}`,
      ...solution,
    });
    return { ...solution };
  }

  async listSolutions(itemId: string): Promise<SubmittedSolution[]> {
    const rows = await this.query(PK.solution, `${itemId}#`);
    return rows.map((r) => ({ ...(r as unknown as SubmittedSolution) }));
  }

  // -------------------------------------------------------------------- votes
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
    await this.put({
      PK: PK.vote,
      SK: `${vote.targetKind}#${vote.targetId}#${vote.id}`,
      ...vote,
    });
    return { ...vote };
  }

  async listVotes(targetKind?: TargetKind, targetId?: string): Promise<Vote[]> {
    // begins_with only when we have the leading key (targetKind). A stray
    // targetId with no kind falls back to a full-partition scan + filter, so
    // the port's independent-filter semantics are preserved.
    const prefix =
      targetKind !== undefined
        ? targetId !== undefined
          ? `${targetKind}#${targetId}#`
          : `${targetKind}#`
        : undefined;
    const rows = await this.query(PK.vote, prefix);
    const votes = rows.map((r) => ({ ...(r as unknown as Vote) }));
    return votes.filter(
      (v) =>
        (targetKind === undefined || v.targetKind === targetKind) &&
        (targetId === undefined || v.targetId === targetId),
    );
  }

  // ------------------------------------------------------- verified-solution
  async flagVerified(input: NewVerification): Promise<VerificationFlag> {
    const flag: VerificationFlag = {
      id: this.newId(),
      solutionId: input.solutionId,
      byHandle: this.requireHandle(input.byHandle, "byHandle"),
      atMs: this.now(),
      revoked: input.revoked,
    };
    await this.put({
      PK: PK.verification,
      SK: `${flag.solutionId}#${flag.id}`,
      ...flag,
    });
    return { ...flag };
  }

  async listVerifications(): Promise<VerificationFlag[]> {
    const rows = await this.query(PK.verification);
    return rows.map((r) => ({ ...(r as unknown as VerificationFlag) }));
  }

  // ------------------------------------------------------- user report/flag
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
    await this.put({
      PK: PK.flag,
      SK: `${flag.targetKind}#${flag.targetId}#${flag.id}`,
      ...flag,
    });
    return { ...flag };
  }

  async listFlags(
    targetKind?: TargetKind,
    targetId?: string,
  ): Promise<ContentFlag[]> {
    const prefix =
      targetKind !== undefined
        ? targetId !== undefined
          ? `${targetKind}#${targetId}#`
          : `${targetKind}#`
        : undefined;
    const rows = await this.query(PK.flag, prefix);
    const flags = rows.map((r) => ({ ...(r as unknown as ContentFlag) }));
    return flags.filter(
      (f) =>
        (targetKind === undefined || f.targetKind === targetKind) &&
        (targetId === undefined || f.targetId === targetId),
    );
  }

  // --------------------------------------------------------- reputation ledger
  async appendReputation(
    event: Omit<ReputationEvent, "id">,
  ): Promise<ReputationEvent> {
    const stored: ReputationEvent = {
      ...event,
      handle: this.requireHandle(event.handle, "handle"),
      id: this.newId(),
    };
    await this.put({
      PK: PK.reputation,
      SK: `${stored.handle}#${stored.id}`,
      ...stored,
    });
    return { ...stored };
  }

  async listReputation(handle?: Handle): Promise<ReputationEvent[]> {
    const rows = await this.query(
      PK.reputation,
      handle ? `${handle}#` : undefined,
    );
    return rows.map((r) => ({ ...(r as unknown as ReputationEvent) }));
  }

  // ------------------------------------------------------------- rolled-up read
  async getItemAggregate(itemId: string): Promise<ItemAggregate> {
    const [reports, comments, solutions, votes, verifications] =
      await Promise.all([
        this.listReports(itemId),
        this.listComments(itemId),
        this.listSolutions(itemId),
        this.listVotes(),
        this.listVerifications(),
      ]);
    return summarizeItem(
      itemId,
      reports,
      comments,
      solutions,
      votes,
      verifications,
    );
  }
}
