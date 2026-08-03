import { describe, expect, it } from "vitest";
import type { KeyValueStore } from "./localPb";
import { makeAttempt, type WeakSpotAttempt } from "./weakSpot";
import {
  WEAK_SPOT_KEY,
  readWeakSpotHistory,
  recordWeakSpotAttempts,
} from "./weakSpotProfile";

/** Minimal in-memory KeyValueStore for the pure persistence tests. */
function memStore(seed: Record<string, string> = {}): KeyValueStore {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

const sample: WeakSpotAttempt[] = [
  makeAttempt("mul", 300, 7, false),
  makeAttempt("add", 3, 4, true),
];

describe("readWeakSpotHistory", () => {
  it("returns [] when nothing stored", () => {
    expect(readWeakSpotHistory(memStore())).toEqual([]);
  });

  it("returns [] on corrupt JSON (never throws)", () => {
    expect(readWeakSpotHistory(memStore({ [WEAK_SPOT_KEY]: "{not json" }))).toEqual(
      [],
    );
  });

  it("returns [] when the stored value is not an array", () => {
    expect(
      readWeakSpotHistory(memStore({ [WEAK_SPOT_KEY]: '{"x":1}' })),
    ).toEqual([]);
  });
});

describe("recordWeakSpotAttempts", () => {
  it("appends and round-trips through the store", () => {
    const store = memStore();
    recordWeakSpotAttempts(store, sample);
    expect(readWeakSpotHistory(store)).toEqual(sample);
  });

  it("accumulates across calls (oldest → newest)", () => {
    const store = memStore();
    recordWeakSpotAttempts(store, [sample[0]]);
    const out = recordWeakSpotAttempts(store, [sample[1]]);
    expect(out).toEqual(sample);
    expect(readWeakSpotHistory(store)).toEqual(sample);
  });

  it("caps to the last `limit`, dropping oldest", () => {
    const store = memStore();
    const many = Array.from({ length: 10 }, (_, i) =>
      makeAttempt("add", i + 1, 2, true),
    );
    const capped = recordWeakSpotAttempts(store, many, 3);
    expect(capped).toHaveLength(3);
    expect(capped).toEqual(many.slice(-3));
  });

  it("yields an empty history when limit <= 0", () => {
    const store = memStore();
    expect(recordWeakSpotAttempts(store, sample, 0)).toEqual([]);
  });
});
