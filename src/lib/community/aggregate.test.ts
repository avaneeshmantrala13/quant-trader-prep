import { describe, expect, it } from "vitest";
import {
  activeVerifications,
  averageDifficulty,
  buildAuthorIndex,
  buildThread,
  computeReputation,
  deriveReputationEvents,
  isCleanHandle,
  isVerified,
  karmaFor,
  KARMA_WEIGHTS,
  latestVotes,
  rankReports,
  rankSolutions,
  reputationTier,
  resolveVerifiedSolution,
  summarizeItem,
  tallyQuality,
} from "./aggregate";
import type {
  Comment,
  ExperienceReport,
  ReputationEvent,
  SubmittedSolution,
  VerificationFlag,
  Vote,
} from "./types";

// --- tiny deterministic builders -------------------------------------------

let seq = 0;
const id = (p: string) => `${p}${++seq}`;

function report(over: Partial<ExperienceReport> = {}): ExperienceReport {
  return {
    id: id("r"),
    itemId: "item-1",
    authorHandle: "alice",
    title: "T",
    body: "B",
    tags: [],
    createdAtMs: 1000,
    ...over,
  };
}
function solution(over: Partial<SubmittedSolution> = {}): SubmittedSolution {
  return {
    id: id("s"),
    itemId: "item-1",
    authorHandle: "bob",
    body: "return 42;",
    createdAtMs: 1000,
    ...over,
  };
}
function vote(over: Partial<Vote> = {}): Vote {
  return {
    id: id("v"),
    targetKind: "solution",
    targetId: "s1",
    voterHandle: "carol",
    dimension: "quality",
    value: 1,
    createdAtMs: 1000,
    ...over,
  };
}

describe("isCleanHandle (PII screen)", () => {
  it("accepts clean public handles", () => {
    expect(isCleanHandle("alice")).toBe(true);
    expect(isCleanHandle("quant_trader-7")).toBe(true);
  });
  it("rejects emails and out-of-range / bad-char handles", () => {
    expect(isCleanHandle("alice@example.com")).toBe(false); // '@' is PII-ish
    expect(isCleanHandle("ab")).toBe(false);
    expect(isCleanHandle("x".repeat(21))).toBe(false);
    expect(isCleanHandle("bad<name>")).toBe(false);
  });
});

describe("latestVotes (vote hygiene)", () => {
  it("keeps only the latest vote per voter/target/dimension", () => {
    const votes: Vote[] = [
      vote({ id: "a", voterHandle: "carol", targetId: "s1", value: 1, createdAtMs: 1 }),
      vote({ id: "b", voterHandle: "carol", targetId: "s1", value: -1, createdAtMs: 2 }),
      vote({ id: "c", voterHandle: "dave", targetId: "s1", value: 1, createdAtMs: 1 }),
    ];
    const latest = latestVotes(votes);
    expect(latest).toHaveLength(2);
    const carol = latest.find((v) => v.voterHandle === "carol")!;
    expect(carol.value).toBe(-1); // the later downvote wins
  });
});

describe("tallyQuality", () => {
  it("counts up/down and nets the score after de-duping", () => {
    const votes: Vote[] = [
      vote({ id: "a", voterHandle: "c", targetId: "s1", value: 1, createdAtMs: 1 }),
      vote({ id: "b", voterHandle: "c", targetId: "s1", value: 1, createdAtMs: 2 }), // same voter → collapses
      vote({ id: "d", voterHandle: "e", targetId: "s1", value: 1 }),
      vote({ id: "f", voterHandle: "g", targetId: "s1", value: -1 }),
      vote({ id: "h", voterHandle: "i", targetId: "s2", value: 1 }), // other target
    ];
    const t = tallyQuality(votes, "solution", "s1");
    expect(t).toEqual({ up: 2, down: 1, score: 1 });
  });
});

describe("averageDifficulty", () => {
  it("averages difficulty votes and clamps to 1..5", () => {
    const votes: Vote[] = [
      vote({ id: "a", voterHandle: "c", dimension: "difficulty", value: 4, targetKind: "report", targetId: "r1" }),
      vote({ id: "b", voterHandle: "d", dimension: "difficulty", value: 2, targetKind: "report", targetId: "r1" }),
      vote({ id: "e", voterHandle: "f", dimension: "difficulty", value: 99, targetKind: "report", targetId: "r1" }), // clamps to 5
    ];
    const d = averageDifficulty(votes, "report", "r1");
    expect(d.count).toBe(3);
    expect(d.average).toBeCloseTo((4 + 2 + 5) / 3, 2); // rounded to 2 dp by design
  });
  it("returns null average when unrated", () => {
    expect(averageDifficulty([], "report", "r1")).toEqual({ average: null, count: 0 });
  });
});

describe("computeReputation / karmaFor / tiers", () => {
  const events: ReputationEvent[] = [
    { id: "e1", handle: "alice", delta: 10, reason: "solution_upvoted", atMs: 1 },
    { id: "e2", handle: "alice", delta: 25, reason: "solution_verified", atMs: 2 },
    { id: "e3", handle: "bob", delta: -2, reason: "content_downvoted", atMs: 3 },
  ];
  it("sums the durable ledger per handle", () => {
    expect(computeReputation(events)).toEqual({ alice: 35, bob: -2 });
    expect(karmaFor(events, "alice")).toBe(35);
    expect(karmaFor(events, "nobody")).toBe(0);
  });
  it("maps karma to a tier deterministically", () => {
    expect(reputationTier(0).id).toBe("newcomer");
    expect(reputationTier(20).id).toBe("contributor");
    expect(reputationTier(100).id).toBe("trusted");
    expect(reputationTier(300).id).toBe("expert");
    expect(reputationTier(5000).id).toBe("legend");
  });
});

describe("deriveReputationEvents (votes/verifications → durable ledger)", () => {
  it("credits authors for upvotes + the verified bonus", () => {
    const reports = [report({ id: "r1", authorHandle: "alice" })];
    const solutions = [solution({ id: "s1", authorHandle: "bob" })];
    const idx = buildAuthorIndex(reports, [], solutions);
    const votes: Vote[] = [
      vote({ id: "v1", targetKind: "report", targetId: "r1", voterHandle: "x", value: 1 }),
      vote({ id: "v2", targetKind: "solution", targetId: "s1", voterHandle: "y", value: 1 }),
      vote({ id: "v3", targetKind: "solution", targetId: "s1", voterHandle: "z", value: -1 }),
    ];
    const flags: VerificationFlag[] = [
      { id: "f1", solutionId: "s1", byHandle: "mod", atMs: 5 },
    ];
    const events = deriveReputationEvents(votes, flags, idx);
    const rep = computeReputation(events);
    expect(rep["alice"]).toBe(KARMA_WEIGHTS.report_upvoted); // +5
    // bob: +10 (upvote) −2 (downvote) +25 (verified) = 33
    expect(rep["bob"]).toBe(
      KARMA_WEIGHTS.solution_upvoted +
        KARMA_WEIGHTS.content_downvoted +
        KARMA_WEIGHTS.solution_verified,
    );
  });
  it("is deterministic (stable ids + order) so re-deriving is idempotent", () => {
    const solutions = [solution({ id: "s1", authorHandle: "bob" })];
    const idx = buildAuthorIndex([], [], solutions);
    const votes: Vote[] = [
      vote({ id: "v2", targetKind: "solution", targetId: "s1", voterHandle: "y", value: 1 }),
    ];
    const a = deriveReputationEvents(votes, [], idx);
    const b = deriveReputationEvents(votes, [], idx);
    expect(a).toEqual(b);
    expect(a[0].id).toBe("rep:vote:v2");
  });
});

describe("verified-solution resolution", () => {
  it("treats the latest non-revoked flag as authoritative", () => {
    const flags: VerificationFlag[] = [
      { id: "f1", solutionId: "s1", byHandle: "mod", atMs: 1 },
      { id: "f2", solutionId: "s1", byHandle: "mod", atMs: 2, revoked: true }, // later revoke wins
      { id: "f3", solutionId: "s2", byHandle: "mod", atMs: 1 },
    ];
    const active = activeVerifications(flags).map((f) => f.solutionId);
    expect(active).toEqual(["s2"]);
    expect(isVerified("s1", flags)).toBe(false);
    expect(isVerified("s2", flags)).toBe(true);
  });

  it("resolveVerifiedSolution picks the top-ranked verified solution", () => {
    const s1 = solution({ id: "s1", createdAtMs: 1 });
    const s2 = solution({ id: "s2", createdAtMs: 2 });
    const s3 = solution({ id: "s3", createdAtMs: 3 });
    const votes: Vote[] = [
      vote({ id: "v1", targetId: "s2", voterHandle: "a", value: 1 }),
      vote({ id: "v2", targetId: "s2", voterHandle: "b", value: 1 }),
      vote({ id: "v3", targetId: "s3", voterHandle: "c", value: 1 }),
    ];
    const flags: VerificationFlag[] = [
      { id: "f1", solutionId: "s2", byHandle: "mod", atMs: 5 },
      { id: "f2", solutionId: "s3", byHandle: "mod", atMs: 5 },
    ];
    // s1 not verified; among verified {s2,s3}, s2 has higher score → canonical.
    expect(resolveVerifiedSolution([s1, s2, s3], votes, flags)).toBe("s2");
  });

  it("returns null when nothing is verified", () => {
    expect(resolveVerifiedSolution([solution({ id: "s1" })], [], [])).toBeNull();
  });
});

describe("ranking (deterministic)", () => {
  it("rankSolutions: verified first, then quality, then recency", () => {
    const s1 = solution({ id: "s1", createdAtMs: 1 });
    const s2 = solution({ id: "s2", createdAtMs: 2 });
    const s3 = solution({ id: "s3", createdAtMs: 3 });
    const votes: Vote[] = [
      vote({ id: "v1", targetId: "s1", voterHandle: "a", value: 1 }),
      vote({ id: "v2", targetId: "s1", voterHandle: "b", value: 1 }),
    ];
    const flags: VerificationFlag[] = [
      { id: "f1", solutionId: "s3", byHandle: "mod", atMs: 9 },
    ];
    const order = rankSolutions([s1, s2, s3], votes, flags).map((s) => s.id);
    // s3 verified → first; then s1 (score 2) > s2 (score 0).
    expect(order).toEqual(["s3", "s1", "s2"]);
  });

  it("rankReports: quality desc, then recency", () => {
    const r1 = report({ id: "r1", createdAtMs: 1 });
    const r2 = report({ id: "r2", createdAtMs: 2 });
    const votes: Vote[] = [
      vote({ id: "v1", targetKind: "report", targetId: "r2", voterHandle: "a", value: 1 }),
    ];
    expect(rankReports([r1, r2], votes).map((r) => r.id)).toEqual(["r2", "r1"]);
  });
});

describe("buildThread (nested discussion)", () => {
  const c = (over: Partial<Comment>): Comment => ({
    id: id("c"),
    itemId: "item-1",
    authorHandle: "alice",
    body: "hi",
    parentId: null,
    createdAtMs: 1000,
    ...over,
  });

  it("nests replies under parents and orders siblings chronologically", () => {
    const root = c({ id: "root", parentId: null, createdAtMs: 1 });
    const reply1 = c({ id: "reply1", parentId: "root", createdAtMs: 3 });
    const reply2 = c({ id: "reply2", parentId: "root", createdAtMs: 2 });
    const tree = buildThread([reply1, reply2, root]);
    expect(tree).toHaveLength(1);
    expect(tree[0].comment.id).toBe("root");
    expect(tree[0].replies.map((n) => n.comment.id)).toEqual(["reply2", "reply1"]);
  });

  it("promotes orphans (dangling parent) to roots gracefully", () => {
    const orphan = c({ id: "orphan", parentId: "missing", createdAtMs: 1 });
    const tree = buildThread([orphan]);
    expect(tree.map((n) => n.comment.id)).toEqual(["orphan"]);
  });
});

describe("summarizeItem (per-item rollup)", () => {
  it("rolls counts, contributors, difficulty, and verified solution", () => {
    const reports = [
      report({ id: "r1", itemId: "item-1", authorHandle: "alice" }),
      report({ id: "r2", itemId: "item-2", authorHandle: "zoe" }), // other item
    ];
    const comments: Comment[] = [
      { id: "c1", itemId: "item-1", authorHandle: "bob", body: "x", parentId: null, createdAtMs: 1 },
    ];
    const solutions = [
      solution({ id: "s1", itemId: "item-1", authorHandle: "carol" }),
    ];
    const votes: Vote[] = [
      vote({ id: "dv1", targetKind: "report", targetId: "r1", dimension: "difficulty", voterHandle: "p", value: 4 }),
      vote({ id: "dv2", targetKind: "report", targetId: "r1", dimension: "difficulty", voterHandle: "q", value: 2 }),
    ];
    const flags: VerificationFlag[] = [
      { id: "f1", solutionId: "s1", byHandle: "mod", atMs: 5 },
    ];
    const agg = summarizeItem("item-1", reports, comments, solutions, votes, flags);
    expect(agg.reportCount).toBe(1);
    expect(agg.commentCount).toBe(1);
    expect(agg.solutionCount).toBe(1);
    expect(agg.contributorCount).toBe(3); // alice, bob, carol
    expect(agg.difficulty.average).toBeCloseTo(3, 5);
    expect(agg.verifiedSolutionId).toBe("s1");
    expect(agg.topSolutionIds).toEqual(["s1"]);
  });

  it("is empty-safe for an item with no activity (offline cold start)", () => {
    const agg = summarizeItem("nope", [], [], [], [], []);
    expect(agg).toEqual({
      itemId: "nope",
      reportCount: 0,
      commentCount: 0,
      solutionCount: 0,
      contributorCount: 0,
      difficulty: { average: null, count: 0 },
      verifiedSolutionId: null,
      topSolutionIds: [],
    });
  });
});
