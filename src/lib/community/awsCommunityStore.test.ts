import { describe, expect, it, vi } from "vitest";
import {
  AwsCommunityStore,
  type CommunityDocClient,
} from "./awsCommunityStore";
import { createCommunityStore } from "./createCommunityStore";
import {
  InMemoryCommunityStore,
  PiiRejectedError,
  type CommunityStore,
} from "./port";
import type { EnvLike } from "../awsConfig";

/**
 * A tiny in-memory fake of a DynamoDB document client. It understands the two
 * commands `AwsCommunityStore` issues (`PutCommand` / `QueryCommand`) by reading
 * their `.input`, so we can round-trip real data through the store with NO
 * network and NO real AWS SDK client.
 */
class FakeDynamo implements CommunityDocClient {
  readonly items = new Map<string, Record<string, unknown>>();
  sends = 0;

  async send(command: unknown): Promise<{
    Items?: Record<string, unknown>[];
    LastEvaluatedKey?: Record<string, unknown>;
  }> {
    this.sends += 1;
    const input = (command as { input: Record<string, unknown> }).input;

    // PutCommand
    if ("Item" in input) {
      const item = input.Item as Record<string, unknown>;
      this.items.set(`${String(item.PK)}\u0000${String(item.SK)}`, item);
      return {};
    }

    // QueryCommand
    const values = (input.ExpressionAttributeValues ?? {}) as Record<
      string,
      unknown
    >;
    const pk = values[":pk"];
    const skPrefix = values[":sk"] as string | undefined;
    const matched = [...this.items.values()]
      .filter((it) => {
        if (it.PK !== pk) return false;
        if (skPrefix !== undefined) return String(it.SK).startsWith(skPrefix);
        return true;
      })
      // DynamoDB returns a Query sorted by SK ascending.
      .sort((a, b) => (String(a.SK) < String(b.SK) ? -1 : 1));
    return { Items: matched };
  }
}

/** A deterministic AWS store wired to an in-memory fake Dynamo. */
function freshAwsStore(): {
  store: AwsCommunityStore;
  fake: FakeDynamo;
  getClient: ReturnType<typeof vi.fn>;
} {
  const fake = new FakeDynamo();
  const getClient = vi.fn(async () => fake as CommunityDocClient);
  let t = 0;
  let seq = 0;
  const store = new AwsCommunityStore({
    tableName: "test-community",
    getClient,
    now: () => ++t,
    idFactory: () => `c${++seq}`,
  });
  return { store, fake, getClient };
}

const AWS_ENV: EnvLike = {
  VITE_STORAGE_BACKEND: "aws",
  VITE_AWS_REGION: "us-east-1",
  VITE_COGNITO_USER_POOL_ID: "us-east-1_pool",
  VITE_COGNITO_USER_POOL_CLIENT_ID: "client",
  VITE_COGNITO_IDENTITY_POOL_ID: "us-east-1:idpool",
  VITE_DYNAMODB_TABLE: "quant-trader-prep-progress",
};

describe("createCommunityStore — offline fallback (no AWS env)", () => {
  it("returns an offline in-memory store when no AWS backend is configured", () => {
    const store = createCommunityStore({});
    expect(store).toBeInstanceOf(InMemoryCommunityStore);
  });

  it("falls back to in-memory when the AWS flag is set but config is incomplete", () => {
    // Only the flag, none of the required Cognito/DynamoDB vars → readAwsConfig
    // returns null → in-memory fallback (app never left without a store).
    const store = createCommunityStore({ VITE_STORAGE_BACKEND: "aws" });
    expect(store).toBeInstanceOf(InMemoryCommunityStore);
  });

  it("the offline store round-trips content and enforces PII rules", async () => {
    const store = createCommunityStore({});
    const r = await store.createReport({
      itemId: "item-1",
      authorHandle: "alice",
      title: "Optiver onsite",
      body: "Three rounds of mental math.",
      tags: ["Mental-Math", "mental-math", " Speed "],
    });
    expect(r.tags).toEqual(["mental-math", "speed"]);
    expect(await store.listReports("item-1")).toHaveLength(1);
    expect(await store.listReports("ghost")).toEqual([]); // offline-graceful

    await expect(
      store.createReport({
        itemId: "item-1",
        authorHandle: "alice@example.com", // email = PII
        title: "T",
        body: "B",
      }),
    ).rejects.toBeInstanceOf(PiiRejectedError);
  });
});

describe("createCommunityStore — AWS backend selection", () => {
  it("returns the DynamoDB-backed store when the AWS backend is configured", () => {
    const store = createCommunityStore(AWS_ENV);
    expect(store).toBeInstanceOf(AwsCommunityStore);
  });
});

describe("AwsCommunityStore — construction is inert (no network at construct time)", () => {
  it("does not resolve the Dynamo client just to construct the store", () => {
    const { store, getClient } = freshAwsStore();
    // Constructed fine, and the client provider was NOT called yet.
    const asPort: CommunityStore = store; // conforms to the port interface
    expect(asPort).toBeInstanceOf(AwsCommunityStore);
    expect(getClient).not.toHaveBeenCalled();
  });
});

describe("AwsCommunityStore — round-trips through a stubbed Dynamo client", () => {
  it("creates + lists experience reports (filtered by item), de-duping tags", async () => {
    const { store } = freshAwsStore();
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
    expect(r.id).toBe("c1");
    expect(r.tags).toEqual(["mental-math", "speed"]);
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

  it("adds comments/solutions, casts votes, flags verified, and aggregates", async () => {
    const { store } = freshAwsStore();
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
    expect(await store.listComments("item-1")).toHaveLength(2);

    const s = await store.addSolution({
      itemId: "item-1",
      authorHandle: "carol",
      body: "def f(): return 42",
      language: "python",
    });
    expect(await store.listSolutions("item-1")).toEqual([s]);

    await store.castVote({
      targetKind: "solution",
      targetId: s.id,
      voterHandle: "dave",
      dimension: "quality",
      value: 1,
    });
    expect(await store.listVotes("solution", s.id)).toHaveLength(1);

    await store.flagVerified({ solutionId: s.id, byHandle: "mod" });
    expect(await store.listVerifications()).toHaveLength(1);

    const agg = await store.getItemAggregate("item-1");
    expect(agg.verifiedSolutionId).toBe(s.id);
    expect(agg.solutionCount).toBe(1);
    expect(agg.commentCount).toBe(2);
    expect(agg.contributorCount).toBe(3); // alice, bob, carol
  });

  it("appends + reads the durable reputation ledger (per handle + all)", async () => {
    const { store } = freshAwsStore();
    await store.appendReputation({
      handle: "alice",
      delta: 10,
      reason: "solution_upvoted",
      atMs: 1,
    });
    await store.appendReputation({
      handle: "bob",
      delta: 25,
      reason: "solution_verified",
      atMs: 2,
    });
    expect(await store.listReputation("alice")).toHaveLength(1);
    expect(await store.listReputation()).toHaveLength(2);
  });

  it("enforces the PII hard rule on writes", async () => {
    const { store } = freshAwsStore();
    await expect(
      store.createReport({
        itemId: "item-1",
        authorHandle: "alice@example.com",
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

  it("nothing PII-shaped is ever written to the underlying table", async () => {
    const { store, fake } = freshAwsStore();
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
    await store.flagVerified({ solutionId: s.id, byHandle: "mod" });

    const snapshot = JSON.stringify([...fake.items.values()]);
    expect(snapshot).not.toMatch(/@/);
    expect(snapshot).not.toMatch(/\bemail\b/i);
    expect(snapshot).not.toMatch(/\bpassword\b/i);
    expect(snapshot).not.toMatch(/"userId"|"realName"|"phone"/i);
  });

  it("reads are offline-graceful when there is no live session", async () => {
    // getClient resolves null (logged-out / offline): reads return empty.
    const store = new AwsCommunityStore({
      tableName: "test-community",
      getClient: async () => null,
    });
    expect(await store.listReports("item-1")).toEqual([]);
    expect(await store.listComments("item-1")).toEqual([]);
    expect(await store.listVotes()).toEqual([]);
    const agg = await store.getItemAggregate("item-1");
    expect(agg.reportCount).toBe(0);
    expect(agg.verifiedSolutionId).toBeNull();
  });
});
