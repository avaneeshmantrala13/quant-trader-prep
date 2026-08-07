import { describe, expect, it } from "vitest";
import { createEvTimedSession } from "./engine";
import {
  EV_TIMED_STORAGE_KEY,
  clearEvTimedSession,
  evTimedSessionKey,
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

    saveEvTimedSession(session, "alice", store);
    const loaded = loadEvTimedSession("alice", store);

    expect(loaded).toEqual(session);
    // The absolute deadline (the reload-proof anchor) survives byte-for-byte.
    expect(loaded?.questionDeadlineTs).toBe(session.questionDeadlineTs);
    expect(store.map.has(evTimedSessionKey("alice"))).toBe(true);
  });

  it("returns undefined when nothing is persisted", () => {
    expect(loadEvTimedSession("alice", memStore())).toBeUndefined();
  });

  it("clear removes the persisted session so re-entry starts fresh", () => {
    const store = memStore();
    saveEvTimedSession(
      createEvTimedSession({ seed: 7, nowTs: 1_700_000_000_000 }),
      "alice",
      store,
    );
    clearEvTimedSession("alice", store);
    expect(loadEvTimedSession("alice", store)).toBeUndefined();
  });

  it("treats a corrupt blob as no-resume rather than throwing", () => {
    const store = memStore();
    store.setItem(evTimedSessionKey("alice"), "{not json");
    expect(loadEvTimedSession("alice", store)).toBeUndefined();

    store.setItem(evTimedSessionKey("alice"), JSON.stringify({ version: 1 }));
    expect(loadEvTimedSession("alice", store)).toBeUndefined();
  });

  it("does NOT leak a session across different users (per-user scoping)", () => {
    const store = memStore();
    const aliceSession = createEvTimedSession({
      seed: 42,
      nowTs: 1_700_000_000_000,
    });
    saveEvTimedSession(aliceSession, "alice", store);

    // Bob logs in on the same browser and starts fresh.
    expect(loadEvTimedSession("bob", store)).toBeUndefined();
    expect(loadEvTimedSession(null, store)).toBeUndefined();
    // Alice still resumes her own session.
    expect(loadEvTimedSession("alice", store)).toEqual(aliceSession);
  });

  it("derives per-user keys from the base key", () => {
    expect(evTimedSessionKey("alice")).toBe(`${EV_TIMED_STORAGE_KEY}::alice`);
    expect(evTimedSessionKey(null)).toBe(`${EV_TIMED_STORAGE_KEY}::anon`);
  });
});
