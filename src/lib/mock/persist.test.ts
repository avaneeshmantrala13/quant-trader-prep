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
    saveActiveSession(s, store);
    expect(store.map.has(MOCK_ACTIVE_KEY)).toBe(true);
    expect(loadActiveSession(store)).toEqual(s);
  });

  it("resuming mid-interview restores index, responses, and status", () => {
    const store = fakeStore();
    const s = midInterviewSession();
    saveActiveSession(s, store);

    const resumed = loadActiveSession(store)!;
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
    saveActiveSession(midInterviewSession(), store);
    expect(loadActiveSession(store)).not.toBeNull();
    clearActiveSession(store);
    expect(store.map.has(MOCK_ACTIVE_KEY)).toBe(false);
    expect(loadActiveSession(store)).toBeNull();
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
    store.setItem(MOCK_ACTIVE_KEY, "{ corrupt");
    expect(loadActiveSession(store)).toBeNull();
  });
});

describe("SSR / no-storage safety", () => {
  it("all I/O helpers are safe no-ops when no backend is available", () => {
    const s = midInterviewSession();
    expect(() => saveActiveSession(s, null)).not.toThrow();
    expect(loadActiveSession(null)).toBeNull();
    expect(() => clearActiveSession(null)).not.toThrow();
  });
});
