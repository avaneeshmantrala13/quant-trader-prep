import { describe, expect, it } from "vitest";
import {
  ARBITRAGE_STORAGE_KEY,
  arbitrageRunKey,
  clearArbitrageRun,
  loadArbitrageRun,
  saveArbitrageRun,
  type ArbitrageRunState,
  type StorageLike,
} from "./persist";

function memStore(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function sampleRun(): ArbitrageRunState {
  return {
    version: 1,
    seed: 123456,
    index: 3,
    responses: [true, false, true, null, null, null, null, null],
    committed: false,
    chosen: null,
    typed: "",
  };
}

describe("arbitrage/persist", () => {
  it("round-trips an in-progress run (save → load) intact", () => {
    const store = memStore();
    const run = sampleRun();

    saveArbitrageRun(run, "alice", store);
    const loaded = loadArbitrageRun("alice", store);

    expect(loaded).toEqual(run);
    // The seed re-materializes the identical battery, so responses line up.
    expect(loaded?.seed).toBe(run.seed);
    expect(loaded?.responses).toEqual(run.responses);
    expect(store.map.has(arbitrageRunKey("alice"))).toBe(true);
  });

  it("preserves a committed current item's chosen index + typed entry", () => {
    const store = memStore();
    const run: ArbitrageRunState = {
      ...sampleRun(),
      committed: true,
      chosen: 2,
      typed: "0.42",
    };
    saveArbitrageRun(run, "alice", store);
    expect(loadArbitrageRun("alice", store)).toEqual(run);
  });

  it("returns undefined when nothing is persisted", () => {
    expect(loadArbitrageRun("alice", memStore())).toBeUndefined();
  });

  it("clear removes the persisted run so re-entry starts fresh", () => {
    const store = memStore();
    saveArbitrageRun(sampleRun(), "alice", store);
    clearArbitrageRun("alice", store);
    expect(loadArbitrageRun("alice", store)).toBeUndefined();
  });

  it("treats a corrupt / malformed blob as no-resume", () => {
    const store = memStore();
    store.setItem(arbitrageRunKey("alice"), "not-json");
    expect(loadArbitrageRun("alice", store)).toBeUndefined();

    store.setItem(arbitrageRunKey("alice"), JSON.stringify({ version: 1 }));
    expect(loadArbitrageRun("alice", store)).toBeUndefined();
  });

  it("does NOT leak a run across different users (per-user scoping)", () => {
    const store = memStore();
    const aliceRun = sampleRun();
    saveArbitrageRun(aliceRun, "alice", store);

    // Bob (a different account on the same browser) starts fresh.
    expect(loadArbitrageRun("bob", store)).toBeUndefined();
    expect(loadArbitrageRun(null, store)).toBeUndefined();
    // Alice still resumes her own run.
    expect(loadArbitrageRun("alice", store)).toEqual(aliceRun);
    // Clearing Bob's (empty) run never touches Alice's.
    clearArbitrageRun("bob", store);
    expect(loadArbitrageRun("alice", store)).toEqual(aliceRun);
  });

  it("derives per-user keys from the base key", () => {
    expect(arbitrageRunKey("alice")).toBe(`${ARBITRAGE_STORAGE_KEY}::alice`);
    expect(arbitrageRunKey(null)).toBe(`${ARBITRAGE_STORAGE_KEY}::anon`);
  });
});
