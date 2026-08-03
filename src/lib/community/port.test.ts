import { describe, expect, it } from "vitest";
import {
  InMemoryCommunityStore,
  PiiRejectedError,
  type CommunityStore,
} from "./port";
import { computeReputation, deriveReputationEvents, buildAuthorIndex } from "./aggregate";

/** A fresh, fully deterministic store (fixed clock + counter ids). */
function freshStore(): CommunityStore {
  let t = 0;
  return new InMemoryCommunityStore({ now: () => ++t });
}

describe("InMemoryCommunityStore round-trips (offline, no backend)", () => {
  it("creates + lists experience reports (filtered by item), de-duping tags", async () => {
    const store = freshStore();
    const r = await store.createReport({
      itemId: "item-1",
      authorHandle: "alice",
      title: "Optiver onsite",
      body: "Three rounds of mental math.",
      company: "Optiver",
      role: "Trader",
      outcome: "offer",
      tags: ["Mental-Math", "mental-math", " Speed "],
    });
    expect(r.id).toBeTruthy();
    expect(r.tags).toEqual(["mental-math", "speed"]); // lowercased + de-duped
    await store.createReport({
      itemId: "item-2",
      authorHandle: "bob",
      title: "Other",
      body: "x",
    });
    const forItem1 = await store.listReports("item-1");
    expect(forItem1).toHaveLength(1);
    expect(forItem1[0]).toMatchObject({ title: "Optiver onsite", outcome: "offer" });
    expect(await store.listReports()).toHaveLength(2); // all
  });

  it("adds + lists comments and solutions per item", async () => {
    const store = freshStore();
    const c = await store.addComment({
      itemId: "item-1",
      authorHandle: "alice",
      body: "How did you approach it?",
    });
    await store.addComment({
      itemId: "item-1",
      authorHandle: "bob",
      body: "Break into sub-problems.",
      parentId: c.id,
    });
    const comments = await store.listComments("item-1");
    expect(comments).toHaveLength(2);
    expect(comments[1].parentId).toBe(c.id);

    const s = await store.addSolution({
      itemId: "item-1",
      authorHandle: "carol",
      body: "def f(): return 42",
      language: "python",
    });
    const solutions = await store.listSolutions("item-1");
    expect(solutions).toEqual([s]);
  });

  it("casts + lists votes and flags verified solutions", async () => {
    const store = freshStore();
    const s = await store.addSolution({
      itemId: "item-1",
      authorHandle: "carol",
      body: "answer",
    });
    await store.castVote({
      targetKind: "solution",
      targetId: s.id,
      voterHandle: "dave",
      dimension: "quality",
      value: 1,
    });
    const votes = await store.listVotes("solution", s.id);
    expect(votes).toHaveLength(1);
    expect(votes[0]).toMatchObject({ value: 1, dimension: "quality" });

    await store.flagVerified({ solutionId: s.id, byHandle: "mod" });
    const flags = await store.listVerifications();
    expect(flags).toHaveLength(1);
    expect(flags[0].solutionId).toBe(s.id);

    const agg = await store.getItemAggregate("item-1");
    expect(agg.verifiedSolutionId).toBe(s.id);
    expect(agg.solutionCount).toBe(1);
    expect(agg.contributorCount).toBe(1);
  });

  it("appends + reads the durable reputation ledger", async () => {
    const store = freshStore();
    await store.appendReputation({
      handle: "alice",
      delta: 10,
      reason: "solution_upvoted",
      atMs: 1,
    });
    await store.appendReputation({
      handle: "alice",
      delta: 25,
      reason: "solution_verified",
      atMs: 2,
    });
    const events = await store.listReputation("alice");
    expect(events).toHaveLength(2);
    expect(computeReputation(events)).toEqual({ alice: 35 });
  });

  it("stored records are copies (mutating a returned object can't corrupt the store)", async () => {
    const store = freshStore();
    const r = await store.createReport({
      itemId: "item-1",
      authorHandle: "alice",
      title: "T",
      body: "B",
    });
    r.title = "MUTATED";
    r.tags.push("hacked");
    const again = (await store.listReports("item-1"))[0];
    expect(again.title).toBe("T");
    expect(again.tags).toEqual([]);
  });
});

describe("content flags (report/moderation hook)", () => {
  it("stores + lists flags, filtered by target, and refuses PII", async () => {
    const store = freshStore();
    const flag = await store.flagContent({
      targetKind: "report",
      targetId: "r1",
      reporterHandle: "alice",
      reason: "harassment",
      note: "name-calling",
    });
    expect(flag.id).toBeTruthy();
    expect(flag.reason).toBe("harassment");

    await store.flagContent({
      targetKind: "comment",
      targetId: "c9",
      reporterHandle: "bob",
      reason: "spam",
    });

    expect(await store.listFlags()).toHaveLength(2); // all
    expect(await store.listFlags("report")).toHaveLength(1);
    expect(await store.listFlags("report", "r1")).toHaveLength(1);
    expect(await store.listFlags("report", "ghost")).toEqual([]); // graceful

    await expect(
      store.flagContent({
        targetKind: "report",
        targetId: "r1",
        reporterHandle: "x@y.com", // email = PII
        reason: "other",
      }),
    ).rejects.toBeInstanceOf(PiiRejectedError);
  });
});

describe("offline-graceful reads", () => {
  it("returns empty collections for unknown items without throwing", async () => {
    const store = freshStore();
    expect(await store.listReports("ghost")).toEqual([]);
    expect(await store.listComments("ghost")).toEqual([]);
    expect(await store.listSolutions("ghost")).toEqual([]);
    expect(await store.listVotes("solution", "ghost")).toEqual([]);
    const agg = await store.getItemAggregate("ghost");
    expect(agg.reportCount).toBe(0);
    expect(agg.verifiedSolutionId).toBeNull();
  });
});

describe("PII refusal (privacy hard rule)", () => {
  it("rejects any record whose handle is not a clean public handle", async () => {
    const store = freshStore();
    await expect(
      store.createReport({
        itemId: "item-1",
        authorHandle: "alice@example.com", // email = PII
        title: "T",
        body: "B",
      }),
    ).rejects.toBeInstanceOf(PiiRejectedError);
    await expect(
      store.castVote({
        targetKind: "solution",
        targetId: "s1",
        voterHandle: "no", // too short
        dimension: "quality",
        value: 1,
      }),
    ).rejects.toBeInstanceOf(PiiRejectedError);
  });

  it("nothing PII-shaped is ever present in the serialized store contents", async () => {
    const store = freshStore();
    await store.createReport({
      itemId: "item-1",
      authorHandle: "alice",
      title: "Onsite",
      body: "Great loop.",
      company: "Optiver",
      role: "Trader",
      tags: ["speed"],
    });
    const s = await store.addSolution({
      itemId: "item-1",
      authorHandle: "bob",
      body: "answer",
    });
    await store.castVote({
      targetKind: "solution",
      targetId: s.id,
      voterHandle: "carol",
      dimension: "quality",
      value: 1,
    });
    await store.flagVerified({ solutionId: s.id, byHandle: "mod" });
    await store.appendReputation({
      handle: "bob",
      delta: 10,
      reason: "solution_upvoted",
      atMs: 1,
    });

    const snapshot = JSON.stringify([
      await store.listReports(),
      await store.listComments("item-1"),
      await store.listSolutions("item-1"),
      await store.listVotes(),
      await store.listVerifications(),
      await store.listReputation(),
    ]);

    // No emails, and no PII-ish keys ever serialized.
    expect(snapshot).not.toMatch(/@/);
    expect(snapshot).not.toMatch(/\bemail\b/i);
    expect(snapshot).not.toMatch(/\bpassword\b/i);
    expect(snapshot).not.toMatch(/"userId"|"realName"|"phone"/i);
  });
});

describe("end-to-end: raw store data → derived reputation", () => {
  it("derives a durable ledger from votes + verifications persisted in the store", async () => {
    const store = freshStore();
    const sol = await store.addSolution({
      itemId: "item-1",
      authorHandle: "bob",
      body: "answer",
    });
    await store.castVote({
      targetKind: "solution",
      targetId: sol.id,
      voterHandle: "carol",
      dimension: "quality",
      value: 1,
    });
    await store.flagVerified({ solutionId: sol.id, byHandle: "mod" });

    const idx = buildAuthorIndex(
      await store.listReports(),
      await store.listComments("item-1"),
      await store.listSolutions("item-1"),
    );
    const events = deriveReputationEvents(
      await store.listVotes(),
      await store.listVerifications(),
      idx,
    );
    // Persist the derived ledger back through the port, then read karma.
    for (const e of events) {
      const { id: _drop, ...rest } = e;
      await store.appendReputation(rest);
    }
    const rep = computeReputation(await store.listReputation());
    expect(rep["bob"]).toBe(10 + 25); // upvote + verified
  });
});
