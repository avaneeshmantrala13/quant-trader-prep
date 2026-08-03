import { describe, expect, it } from "vitest";
import { createEvTimedSession } from "./engine";
import {
  EV_TIMED_STORAGE_KEY,
  clearEvTimedSession,
  loadEvTimedSession,
  saveEvTimedSession,
  type StorageLike,
} from "./persist";

/** A minimal in-memory `StorageLike` for deterministic, jsdom-free tests. */
function memStore(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("evTimed/persist", () => {
  it("round-trips an in-progress session (save → load) intact", () => {
    const store = memStore();
    const session = createEvTimedSession({ seed: 42, nowTs: 1_700_000_000_000 });

    saveEvTimedSession(session, store);
    const loaded = loadEvTimedSession(store);

    expect(loaded).toEqual(session);
    // The absolute deadline (the reload-proof anchor) survives byte-for-byte.
    expect(loaded?.questionDeadlineTs).toBe(session.questionDeadlineTs);
    expect(store.map.has(EV_TIMED_STORAGE_KEY)).toBe(true);
  });

  it("returns undefined when nothing is persisted", () => {
    expect(loadEvTimedSession(memStore())).toBeUndefined();
  });

  it("clear removes the persisted session so re-entry starts fresh", () => {
    const store = memStore();
    saveEvTimedSession(
      createEvTimedSession({ seed: 7, nowTs: 1_700_000_000_000 }),
      store,
    );
    clearEvTimedSession(store);
    expect(loadEvTimedSession(store)).toBeUndefined();
  });

  it("treats a corrupt blob as no-resume rather than throwing", () => {
    const store = memStore();
    store.setItem(EV_TIMED_STORAGE_KEY, "{not json");
    expect(loadEvTimedSession(store)).toBeUndefined();

    store.setItem(EV_TIMED_STORAGE_KEY, JSON.stringify({ version: 1 }));
    expect(loadEvTimedSession(store)).toBeUndefined();
  });
});
