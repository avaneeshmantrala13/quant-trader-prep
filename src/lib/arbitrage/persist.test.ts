import { describe, expect, it } from "vitest";
import {
  ARBITRAGE_STORAGE_KEY,
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

    saveArbitrageRun(run, store);
    const loaded = loadArbitrageRun(store);

    expect(loaded).toEqual(run);
    // The seed re-materializes the identical battery, so responses line up.
    expect(loaded?.seed).toBe(run.seed);
    expect(loaded?.responses).toEqual(run.responses);
    expect(store.map.has(ARBITRAGE_STORAGE_KEY)).toBe(true);
  });

  it("preserves a committed current item's chosen index + typed entry", () => {
    const store = memStore();
    const run: ArbitrageRunState = {
      ...sampleRun(),
      committed: true,
      chosen: 2,
      typed: "0.42",
    };
    saveArbitrageRun(run, store);
    expect(loadArbitrageRun(store)).toEqual(run);
  });

  it("returns undefined when nothing is persisted", () => {
    expect(loadArbitrageRun(memStore())).toBeUndefined();
  });

  it("clear removes the persisted run so re-entry starts fresh", () => {
    const store = memStore();
    saveArbitrageRun(sampleRun(), store);
    clearArbitrageRun(store);
    expect(loadArbitrageRun(store)).toBeUndefined();
  });

  it("treats a corrupt / malformed blob as no-resume", () => {
    const store = memStore();
    store.setItem(ARBITRAGE_STORAGE_KEY, "not-json");
    expect(loadArbitrageRun(store)).toBeUndefined();

    store.setItem(ARBITRAGE_STORAGE_KEY, JSON.stringify({ version: 1 }));
    expect(loadArbitrageRun(store)).toBeUndefined();
  });
});
