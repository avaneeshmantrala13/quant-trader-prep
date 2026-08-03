import { describe, expect, it } from "vitest";
import { Rng } from "@/lib/rng";
import { createRotation } from "@/lib/content/rotation";
import { MAX_OA_RESULTS } from "./config";
import {
  DEFAULT_OA_ROTATION_WINDOW,
  appendOaResult,
  clearActiveSession,
  emptyOaStore,
  getActiveSession,
  getOaResults,
  getRotationState,
  putActiveSession,
  putRotationState,
  recordServedSignature,
  recordServedSignatures,
  selectSequenceServed,
  selectServed,
} from "./store";
import type {
  OaSessionResult,
  OaSessionState,
  OaTimedStore,
} from "./types";

// A realistic in-progress session with ABSOLUTE epoch-ms deadlines, questions,
// and parallel answers — exercises the reload-proof timestamp model.
function makeSession(overrides: Partial<OaSessionState> = {}): OaSessionState {
  return {
    id: "sprint-default:1700000000000",
    formatId: "sprint-default",
    kind: "sprint",
    startedAtTs: 1_700_000_000_000,
    deadlineTs: 1_700_000_090_000,
    questionDeadlineTs: 1_700_000_090_000,
    questions: [
      {
        id: "q1",
        prompt: "A fair die: P(roll > 4)?",
        choices: ["1/6", "1/3", "1/2", "2/3"],
        correctIndex: 1,
        explanation: "Rolls 5,6 out of 6 → 2/6 = 1/3.",
        concept: "probability",
        difficulty: "medium",
        source: "unit-test",
      },
      {
        id: "q2",
        prompt: "E[X] for X ~ Uniform{1..6}?",
        choices: ["3", "3.5", "4", "4.5"],
        correctIndex: 1,
        explanation: "(1+..+6)/6 = 3.5.",
        difficulty: "easy",
      },
    ],
    answers: [
      { questionId: "q1", chosen: 1, elapsedMs: 4200 },
      { questionId: "q2", chosen: null, elapsedMs: 0 },
    ],
    index: 1,
    status: "running",
    scoring: { correct: 1, wrong: -1, skip: 0 },
    budgetMs: 90_000,
    hardMode: false,
    ...overrides,
  };
}

function makeResult(id: string, completedAtTs: number): OaSessionResult {
  return {
    id,
    formatId: "sprint-default",
    kind: "sprint",
    startedAtTs: completedAtTs - 90_000,
    completedAtTs,
    outcome: "submitted",
    score: 8,
    maxScore: 12,
    total: 12,
    attempted: 10,
    correct: 8,
    accuracy: 0.8,
    medianMsPerQuestion: 5000,
    avgMsPerQuestion: 5200,
    budgetMs: 90_000,
    withinBudget: 7,
    pctWithinBudget: 0.7,
    hardMode: false,
  };
}

describe("emptyOaStore", () => {
  it("has empty results and no active session", () => {
    const store = emptyOaStore();
    expect(store).toEqual({ results: [] });
    expect(store.active).toBeUndefined();
    expect(getActiveSession(store)).toBeUndefined();
    expect(getOaResults(store)).toEqual([]);
  });

  it("returns a fresh object each call (no shared reference)", () => {
    const a = emptyOaStore();
    const b = emptyOaStore();
    expect(a).not.toBe(b);
    expect(a.results).not.toBe(b.results);
  });
});

describe("putActiveSession", () => {
  it("sets the active session and preserves results", () => {
    const base: OaTimedStore = {
      results: [makeResult("r1", 1_700_000_000_000)],
    };
    const session = makeSession();
    const next = putActiveSession(base, session);
    expect(next.active).toEqual(session);
    expect(next.results).toEqual(base.results);
  });

  it("defaults from an empty store when store is undefined", () => {
    const session = makeSession();
    const next = putActiveSession(undefined, session);
    expect(next.active).toEqual(session);
    expect(next.results).toEqual([]);
  });

  it("is immutable — original store is unchanged", () => {
    const base: OaTimedStore = { results: [] };
    const frozen = JSON.parse(JSON.stringify(base));
    const next = putActiveSession(base, makeSession());
    expect(next).not.toBe(base);
    expect(base).toEqual(frozen);
    expect(base.active).toBeUndefined();
  });

  it("overwrites a previously active session", () => {
    const first = makeSession({ id: "first" });
    const second = makeSession({ id: "second", index: 0 });
    const store = putActiveSession(emptyOaStore(), first);
    const next = putActiveSession(store, second);
    expect(next.active?.id).toBe("second");
  });
});

describe("clearActiveSession", () => {
  it("clears active and preserves results", () => {
    const base = putActiveSession(
      { results: [makeResult("r1", 1_700_000_000_000)] },
      makeSession(),
    );
    const next = clearActiveSession(base);
    expect(next.active).toBeUndefined();
    expect(next.results).toEqual(base.results);
  });

  it("is a no-op-safe new store when store is undefined", () => {
    const next = clearActiveSession(undefined);
    expect(next).toEqual({ active: undefined, results: [] });
  });

  it("is immutable — original active is unchanged", () => {
    const base = putActiveSession(emptyOaStore(), makeSession());
    const next = clearActiveSession(base);
    expect(next).not.toBe(base);
    expect(base.active).toBeDefined();
  });
});

describe("appendOaResult", () => {
  it("appends a result oldest → newest", () => {
    const r1 = makeResult("r1", 1_700_000_000_000);
    const r2 = makeResult("r2", 1_700_000_100_000);
    const store = appendOaResult({ results: [r1] }, r2);
    expect(store.results.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("clears the active session when a result is recorded", () => {
    const base = putActiveSession(emptyOaStore(), makeSession());
    const next = appendOaResult(base, makeResult("r1", 1_700_000_000_000));
    expect(next.active).toBeUndefined();
    expect(next.results).toHaveLength(1);
  });

  it("caps to the last `cap` entries, keeping the newest", () => {
    let store: OaTimedStore = emptyOaStore();
    for (let i = 0; i < 5; i++) {
      store = appendOaResult(store, makeResult(`r${i}`, 1_700_000_000_000 + i), 3);
    }
    expect(store.results.map((r) => r.id)).toEqual(["r2", "r3", "r4"]);
  });

  it("defaults cap to MAX_OA_RESULTS", () => {
    let store: OaTimedStore = emptyOaStore();
    for (let i = 0; i < MAX_OA_RESULTS + 10; i++) {
      store = appendOaResult(store, makeResult(`r${i}`, 1_700_000_000_000 + i));
    }
    expect(store.results).toHaveLength(MAX_OA_RESULTS);
    // Oldest dropped: first retained is the (10th) entry.
    expect(store.results[0].id).toBe("r10");
    expect(store.results[store.results.length - 1].id).toBe(
      `r${MAX_OA_RESULTS + 9}`,
    );
  });

  it("defaults from an empty store when store is undefined", () => {
    const next = appendOaResult(undefined, makeResult("r1", 1_700_000_000_000));
    expect(next.results.map((r) => r.id)).toEqual(["r1"]);
    expect(next.active).toBeUndefined();
  });

  it("is immutable — original store/results are unchanged", () => {
    const base: OaTimedStore = { results: [makeResult("r1", 1)] };
    const snapshot = JSON.parse(JSON.stringify(base));
    const next = appendOaResult(base, makeResult("r2", 2));
    expect(next).not.toBe(base);
    expect(next.results).not.toBe(base.results);
    expect(base).toEqual(snapshot);
  });

  it("yields an empty history when cap <= 0", () => {
    const next = appendOaResult(
      { results: [makeResult("r1", 1)] },
      makeResult("r2", 2),
      0,
    );
    expect(next.results).toEqual([]);
  });
});

describe("getters", () => {
  it("getActiveSession / getOaResults handle undefined store", () => {
    expect(getActiveSession(undefined)).toBeUndefined();
    expect(getOaResults(undefined)).toEqual([]);
  });

  it("getActiveSession / getOaResults read a populated store", () => {
    const session = makeSession();
    const results = [makeResult("r1", 1), makeResult("r2", 2)];
    const store: OaTimedStore = { active: session, results };
    expect(getActiveSession(store)).toEqual(session);
    expect(getOaResults(store)).toEqual(results);
  });
});

describe("persistence round-trip (plain-serializable)", () => {
  it("survives JSON.parse(JSON.stringify(...)) deep-equal", () => {
    const store: OaTimedStore = {
      active: makeSession(),
      results: [
        makeResult("r1", 1_700_000_000_000),
        makeResult("r2", 1_700_000_100_000),
      ],
    };
    const round = JSON.parse(JSON.stringify(store)) as OaTimedStore;
    expect(round).toEqual(store);
    expect(round).not.toBe(store);
  });

  it("preserves absolute-timestamp fields exactly", () => {
    const store: OaTimedStore = {
      active: makeSession(),
      results: [makeResult("r1", 1_700_000_050_000)],
    };
    const round = JSON.parse(JSON.stringify(store)) as OaTimedStore;
    expect(round.active?.deadlineTs).toBe(store.active?.deadlineTs);
    expect(round.active?.questionDeadlineTs).toBe(
      store.active?.questionDeadlineTs,
    );
    expect(round.active?.startedAtTs).toBe(store.active?.startedAtTs);
    expect(round.results[0].completedAtTs).toBe(store.results[0].completedAtTs);
    // Nested arrays (questions/answers) survive intact.
    expect(round.active?.questions).toEqual(store.active?.questions);
    expect(round.active?.answers).toEqual(store.active?.answers);
  });

  it("a round-tripped store feeds back through the pure helpers unchanged", () => {
    const store: OaTimedStore = {
      active: makeSession(),
      results: [makeResult("r1", 1_700_000_000_000)],
    };
    const round = JSON.parse(JSON.stringify(store)) as OaTimedStore;
    expect(getActiveSession(round)).toEqual(store.active);
    expect(getOaResults(round)).toEqual(store.results);
    // Recording a result on the resumed store clears active + keeps history.
    const finished = appendOaResult(round, makeResult("r2", 1_700_000_200_000));
    expect(finished.active).toBeUndefined();
    expect(finished.results.map((r) => r.id)).toEqual(["r1", "r2"]);
  });
});

/* ------------------------------------------------------------------------- *
 * T8 anti-repeat rotation wiring (served-signature state on the OA store).
 * ------------------------------------------------------------------------- */
describe("rotation — served-signature state", () => {
  it("getRotationState initializes an empty ring when absent (old saves load)", () => {
    // An OLD save has NO `rotation` field — it must still load and yield a fresh
    // ring rather than throwing or returning undefined.
    const oldSave: OaTimedStore = { results: [] };
    expect(oldSave.rotation).toBeUndefined();
    const rot = getRotationState(oldSave);
    expect(rot).toEqual(createRotation(DEFAULT_OA_ROTATION_WINDOW));
    // Undefined store initializes too.
    expect(getRotationState(undefined, 5)).toEqual(createRotation(5));
  });

  it("returns an existing ring as-is (its own window wins)", () => {
    const store: OaTimedStore = {
      results: [],
      rotation: { windowSize: 3, recent: ["a", "b"] },
    };
    expect(getRotationState(store, 99)).toEqual({
      windowSize: 3,
      recent: ["a", "b"],
    });
  });

  it("putRotationState preserves active + results, immutably", () => {
    const base = putActiveSession(
      { results: [makeResult("r1", 1)] },
      makeSession(),
    );
    const next = putRotationState(base, createRotation(8));
    expect(next.rotation).toEqual(createRotation(8));
    expect(next.active).toEqual(base.active);
    expect(next.results).toEqual(base.results);
    expect(next).not.toBe(base);
    expect(base.rotation).toBeUndefined();
  });

  it("recordServedSignature appends into the (lazily created) ring", () => {
    let store: OaTimedStore | undefined = undefined;
    store = recordServedSignature(store, "sig-1");
    store = recordServedSignature(store, "sig-2");
    expect(store.rotation?.recent).toEqual(["sig-1", "sig-2"]);
    expect(store.rotation?.windowSize).toBe(DEFAULT_OA_ROTATION_WINDOW);
  });

  it("recordServedSignatures batches in order and trims to the window", () => {
    const store = recordServedSignatures(
      { results: [], rotation: createRotation(2) },
      ["a", "b", "c"],
    );
    // Window of 2 keeps only the two most-recent signatures.
    expect(store.rotation?.recent).toEqual(["b", "c"]);
  });

  it("rotation state persists/round-trips through JSON with results", () => {
    const store: OaTimedStore = {
      active: makeSession(),
      results: [makeResult("r1", 1_700_000_000_000)],
      rotation: { windowSize: 4, recent: ["q1", "q2", "q3"] },
    };
    const round = JSON.parse(JSON.stringify(store)) as OaTimedStore;
    expect(round.rotation).toEqual(store.rotation);
    // The resumed store keeps advancing the SAME ring.
    const advanced = recordServedSignature(round, "q4");
    expect(advanced.rotation?.recent).toEqual(["q1", "q2", "q3", "q4"]);
    expect(getOaResults(advanced)).toEqual(store.results);
  });

  it("survives clear/append without losing the ring", () => {
    let store = putRotationState(emptyOaStore(), createRotation(6));
    store = recordServedSignatures(store, ["a", "b"]);
    store = putActiveSession(store, makeSession());
    expect(store.rotation?.recent).toEqual(["a", "b"]);
    store = clearActiveSession(store);
    expect(store.rotation?.recent).toEqual(["a", "b"]);
    store = appendOaResult(store, makeResult("r1", 1));
    expect(store.rotation?.recent).toEqual(["a", "b"]);
    expect(store.results.map((r) => r.id)).toEqual(["r1"]);
  });

  it("selectServed biases away from in-window signatures and records the pick", () => {
    // Seed the ring so every candidate BUT one is in-window.
    const store: OaTimedStore = {
      results: [],
      rotation: { windowSize: 4, recent: ["a", "b", "c"] },
    };
    const { chosen, store: next } = selectServed(
      store,
      ["a", "b", "c", "d"],
      new Rng(1),
    );
    // "d" is the only eligible candidate ⇒ it MUST be chosen.
    expect(chosen).toBe("d");
    expect(next.rotation?.recent).toEqual(["a", "b", "c", "d"]);
  });

  it("selectSequenceServed yields no in-window repeat and is deterministic-by-seed", () => {
    const candidates = ["q1", "q2", "q3", "q4", "q5", "q6"];
    const base: OaTimedStore = { results: [], rotation: createRotation(3) };

    const runA = selectSequenceServed(base, candidates, new Rng(7), 6);
    const runB = selectSequenceServed(base, candidates, new Rng(7), 6);
    expect(runA.chosen).toEqual(runB.chosen); // deterministic by seed

    // No signature repeats within the 3-wide window.
    const picks = runA.chosen;
    for (let i = 1; i < picks.length; i++) {
      const window = picks.slice(Math.max(0, i - 3), i);
      expect(window).not.toContain(picks[i]);
    }
    // The final ring reflects the last `windowSize` served signatures.
    expect(runA.store.rotation?.recent).toEqual(picks.slice(-3));
  });

  it("selectServed supports a custom signatureOf mapper", () => {
    const items = [
      { id: 1, family: "alpha" },
      { id: 2, family: "beta" },
    ];
    const store: OaTimedStore = {
      results: [],
      rotation: { windowSize: 2, recent: ["alpha"] },
    };
    const { chosen, store: next } = selectServed(
      store,
      items,
      new Rng(1),
      (it) => it.family,
    );
    expect(chosen.family).toBe("beta"); // "alpha" is in-window
    expect(next.rotation?.recent).toEqual(["alpha", "beta"]);
  });
});
