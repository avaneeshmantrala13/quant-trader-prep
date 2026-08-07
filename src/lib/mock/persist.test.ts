import { describe, expect, it } from "vitest";
import {
  buildInterview,
  createSession,
  currentStep,
  mockReducer,
  type MockSession,
} from "./engine";
import {
  MOCK_ACTIVE_KEY,
  MOCK_PERSIST_VERSION,
  clearActiveSession,
  deserializeSession,
  loadActiveSession,
  mockActiveKey,
  saveActiveSession,
  serializeSession,
  type KeyValueStore,
} from "./persist";

/**
 * Persistence tests. The mock interview must survive leaving and returning to
 * `/mock`: a save→load round-trip reproduces the session exactly, `clear` wipes
 * it, a malformed/stale blob is ignored (→ null, never throws), and resuming
 * mid-interview restores index/responses/status. Storage is an injected fake so
 * these are pure and window-free (matching the node test env).
 */

/** A minimal in-memory `Storage` slice for injection. */
function fakeStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

const CONFIG = {
  seed: 4242,
  mathCount: 3,
  brainteaserCount: 2,
  behavioralCount: 2,
  tier: "medium" as const,
};

/** A running session partway through, with a couple of recorded responses. */
function midInterviewSession(): MockSession {
  const script = buildInterview(CONFIG);
  let s = createSession(script, { speechSupported: true });
  s = mockReducer(s, { type: "start" });
  // Answer the first math question, then advance to the second.
  const first = currentStep(s);
  s = mockReducer(s, {
    type: "recordMath",
    raw: first && first.kind === "math" ? String(first.answer) : "0",
    viaSpeech: true,
    elapsedMs: 6000,
  });
  s = mockReducer(s, { type: "next" });
  return s;
}

describe("serialize / deserialize — pure round-trip", () => {
  it("reproduces the session exactly (deep-equal)", () => {
    const s = midInterviewSession();
    const restored = deserializeSession(serializeSession(s));
    expect(restored).toEqual(s);
  });

  it("wraps the payload in the current schema version", () => {
    const s = midInterviewSession();
    const parsed = JSON.parse(serializeSession(s));
    expect(parsed.v).toBe(MOCK_PERSIST_VERSION);
    expect(parsed.session.status).toBe("running");
  });
});

describe("save → load round-trip via injected store", () => {
  it("persists under the namespaced key and loads an equal session", () => {
    const store = fakeStore();
    const s = midInterviewSession();
    saveActiveSession(s, "alice", store);
    expect(store.map.has(mockActiveKey("alice"))).toBe(true);
    expect(loadActiveSession("alice", store)).toEqual(s);
  });

  it("resuming mid-interview restores index, responses, and status", () => {
    const store = fakeStore();
    const s = midInterviewSession();
    saveActiveSession(s, "alice", store);

    const resumed = loadActiveSession("alice", store)!;
    expect(resumed.status).toBe("running");
    expect(resumed.index).toBe(s.index);
    expect(resumed.index).toBe(1); // advanced past the first question
    expect(resumed.responses).toHaveLength(1);
    expect(resumed.responses[0]).toEqual(s.responses[0]);
    // The resumed session drives the reducer identically to the original.
    const step = currentStep(resumed);
    expect(step?.id).toBe(currentStep(s)?.id);
  });
});

describe("clear removes the persisted session", () => {
  it("wipes the key so a subsequent load returns null", () => {
    const store = fakeStore();
    saveActiveSession(midInterviewSession(), "alice", store);
    expect(loadActiveSession("alice", store)).not.toBeNull();
    clearActiveSession("alice", store);
    expect(store.map.has(mockActiveKey("alice"))).toBe(false);
    expect(loadActiveSession("alice", store)).toBeNull();
  });
});

describe("per-user scoping — no cross-account session leak", () => {
  it("does NOT resume one user's mock session under a different user", () => {
    const store = fakeStore();
    const aliceSession = midInterviewSession();
    saveActiveSession(aliceSession, "alice", store);

    // Bob logs in on the same browser: he must NOT see Alice's in-progress
    // interview — this is the cross-account leak the scoping fixes.
    expect(loadActiveSession("bob", store)).toBeNull();
    // ...and the logged-out / anonymous namespace is separate too.
    expect(loadActiveSession(null, store)).toBeNull();

    // Alice still resumes her own session on the same device.
    expect(loadActiveSession("alice", store)).toEqual(aliceSession);
  });

  it("keeps each account's session independent (switch back and forth)", () => {
    const store = fakeStore();
    const alice = midInterviewSession();
    const bob = midInterviewSession();

    saveActiveSession(alice, "alice", store);
    saveActiveSession(bob, "bob", store);

    // Each user resumes ONLY their own session; keys don't collide.
    expect(loadActiveSession("alice", store)).toEqual(alice);
    expect(loadActiveSession("bob", store)).toEqual(bob);

    // Clearing Bob's session leaves Alice's untouched.
    clearActiveSession("bob", store);
    expect(loadActiveSession("bob", store)).toBeNull();
    expect(loadActiveSession("alice", store)).toEqual(alice);
  });

  it("treats username casing as the same user (stable scope)", () => {
    const store = fakeStore();
    const s = midInterviewSession();
    saveActiveSession(s, "Alice", store);
    expect(loadActiveSession("alice", store)).toEqual(s);
  });

  it("derives the per-user key from the versioned base key", () => {
    expect(mockActiveKey("alice")).toBe(`${MOCK_ACTIVE_KEY}::alice`);
    expect(mockActiveKey(null)).toBe(`${MOCK_ACTIVE_KEY}::anon`);
    // Distinct users get distinct keys (that's what prevents the leak).
    expect(mockActiveKey("alice")).not.toBe(mockActiveKey("bob"));
  });
});

describe("malformed / stale blobs are ignored (never throw)", () => {
  it("returns null for absent, non-JSON, or empty input", () => {
    expect(deserializeSession(null)).toBeNull();
    expect(deserializeSession("")).toBeNull();
    expect(deserializeSession("{ not json")).toBeNull();
    expect(deserializeSession("null")).toBeNull();
  });

  it("returns null for a wrong / missing schema version", () => {
    const s = midInterviewSession();
    const wrongVersion = JSON.stringify({ v: 999, session: s });
    expect(deserializeSession(wrongVersion)).toBeNull();
    const noVersion = JSON.stringify({ session: s });
    expect(deserializeSession(noVersion)).toBeNull();
  });

  it("returns null when the session shape is invalid", () => {
    // Right version, but session is missing required fields / bad types.
    const bad = [
      { v: MOCK_PERSIST_VERSION, session: { status: "running" } },
      { v: MOCK_PERSIST_VERSION, session: { ...midInterviewSession(), status: "bogus" } },
      { v: MOCK_PERSIST_VERSION, session: { ...midInterviewSession(), index: -1 } },
      { v: MOCK_PERSIST_VERSION, session: { ...midInterviewSession(), script: null } },
      { v: MOCK_PERSIST_VERSION, session: { ...midInterviewSession(), responses: "nope" } },
    ];
    for (const b of bad) {
      expect(deserializeSession(JSON.stringify(b))).toBeNull();
    }
  });

  it("loadActiveSession ignores a corrupt stored blob", () => {
    const store = fakeStore();
    store.setItem(mockActiveKey("alice"), "{ corrupt");
    expect(loadActiveSession("alice", store)).toBeNull();
  });
});

describe("SSR / no-storage safety", () => {
  it("all I/O helpers are safe no-ops when no backend is available", () => {
    const s = midInterviewSession();
    expect(() => saveActiveSession(s, "alice", null)).not.toThrow();
    expect(loadActiveSession("alice", null)).toBeNull();
    expect(() => clearActiveSession("alice", null)).not.toThrow();
  });
});
