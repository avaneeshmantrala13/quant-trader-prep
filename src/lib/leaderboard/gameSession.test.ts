import { describe, expect, it } from "vitest";
import {
  clearGameSession,
  hasActiveGameSession,
  loadGameSession,
  makeSessionEnvelope,
  parseSessionEnvelope,
  saveGameSession,
  sessionKey,
  SESSION_VERSION,
} from "./gameSession";
import type { KeyValueStore } from "./localBoard";

function memStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

/** A representative page snapshot: plain-JSON multi-round state. */
interface DemoSnapshot {
  phase: string;
  balance: number;
  roundIdx: number;
  log: { round: number; pnl: number }[];
}

const demo: DemoSnapshot = {
  phase: "quote",
  balance: 4980,
  roundIdx: 3,
  log: [
    { round: 1, pnl: -20 },
    { round: 2, pnl: 0 },
  ],
};

describe("makeSessionEnvelope / parseSessionEnvelope", () => {
  it("round-trips an opaque snapshot exactly", () => {
    const env = makeSessionEnvelope("cards-market-making", demo, 1000);
    const parsed = parseSessionEnvelope<DemoSnapshot>(
      JSON.stringify(env),
      "cards-market-making",
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.snapshot).toEqual(demo);
    expect(parsed!.v).toBe(SESSION_VERSION);
    expect(parsed!.status).toBe("active");
  });

  it("rejects a null/garbage/version-mismatched/other-game blob", () => {
    expect(parseSessionEnvelope(null, "g")).toBeNull();
    expect(parseSessionEnvelope("not json", "g")).toBeNull();
    expect(
      parseSessionEnvelope(
        JSON.stringify({ v: 999, gameId: "g", savedAtMs: 1, status: "active", snapshot: {} }),
        "g",
      ),
    ).toBeNull();
    const env = makeSessionEnvelope("g", demo, 1);
    expect(parseSessionEnvelope(JSON.stringify(env), "other")).toBeNull();
  });
});

describe("save / load / clear round-trip through a store", () => {
  it("persists under the namespaced key and resumes the same snapshot", () => {
    const store = memStore();
    saveGameSession(store, "probability-betting", demo, 2000);
    expect(store.map.has(sessionKey("probability-betting"))).toBe(true);

    const env = loadGameSession<DemoSnapshot>(store, "probability-betting");
    expect(env?.snapshot).toEqual(demo);
    expect(hasActiveGameSession(store, "probability-betting")).toBe(true);
  });

  it("clearing makes the session unresumable (empty string is rejected)", () => {
    const store = memStore();
    saveGameSession(store, "dice-and-cards", demo, 1);
    clearGameSession(store, "dice-and-cards");
    expect(loadGameSession(store, "dice-and-cards")).toBeNull();
    expect(hasActiveGameSession(store, "dice-and-cards")).toBe(false);
  });

  it("a finished session is not treated as active/resumable", () => {
    const store = memStore();
    saveGameSession(store, "make-market", demo, 1, "finished");
    expect(hasActiveGameSession(store, "make-market")).toBe(false);
    // ...but it can still be inspected until cleared.
    expect(loadGameSession(store, "make-market")?.status).toBe("finished");
  });

  it("honours a maxAgeMs staleness window", () => {
    const store = memStore();
    saveGameSession(store, "market-of-cards", demo, 1_000);
    expect(
      loadGameSession(store, "market-of-cards", { maxAgeMs: 5_000, nowMs: 4_000 }),
    ).not.toBeNull();
    expect(
      loadGameSession(store, "market-of-cards", { maxAgeMs: 5_000, nowMs: 10_000 }),
    ).toBeNull();
  });

  it("returns null when nothing was ever saved", () => {
    expect(loadGameSession(memStore(), "empty")).toBeNull();
  });
});
