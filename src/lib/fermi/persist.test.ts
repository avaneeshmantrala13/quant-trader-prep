import { describe, expect, it } from "vitest";
import { gradeFermi, gradeInterval } from "./grader";
import {
  FERMI_STORAGE_KEY,
  clearFermiRun,
  fermiRunKey,
  loadFermiRun,
  saveFermiRun,
  type FermiRunState,
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

function sampleRun(): FermiRunState {
  return {
    version: 1,
    mode: "point",
    index: 1,
    // Real grade objects from the pure grader — plain, JSON-serializable data.
    grades: [gradeFermi(300_000, "250000"), null],
    intervalGrades: [null, gradeInterval({ lo: 10, hi: 1000 }, 300)],
  };
}

describe("fermi/persist", () => {
  it("round-trips an in-progress run (save → load) intact", () => {
    const store = memStore();
    const run = sampleRun();

    saveFermiRun(run, "alice", store);
    const loaded = loadFermiRun("alice", store);

    expect(loaded).toEqual(run);
    // Earned verdicts survive so a resumed run shows the same reveals.
    expect(loaded?.grades[0]).toEqual(run.grades[0]);
    expect(loaded?.intervalGrades[1]).toEqual(run.intervalGrades[1]);
    expect(store.map.has(fermiRunKey("alice"))).toBe(true);
  });

  it("returns undefined when nothing is persisted", () => {
    expect(loadFermiRun("alice", memStore())).toBeUndefined();
  });

  it("clear removes the persisted run so re-entry starts fresh", () => {
    const store = memStore();
    saveFermiRun(sampleRun(), "alice", store);
    clearFermiRun("alice", store);
    expect(loadFermiRun("alice", store)).toBeUndefined();
  });

  it("treats a corrupt / malformed blob as no-resume", () => {
    const store = memStore();
    store.setItem(fermiRunKey("alice"), "%%%");
    expect(loadFermiRun("alice", store)).toBeUndefined();

    store.setItem(
      fermiRunKey("alice"),
      JSON.stringify({ version: 1, mode: "bogus", index: 0 }),
    );
    expect(loadFermiRun("alice", store)).toBeUndefined();
  });

  it("does NOT leak a run across different users (per-user scoping)", () => {
    const store = memStore();
    const aliceRun = sampleRun();
    saveFermiRun(aliceRun, "alice", store);

    // A different account on the same browser starts fresh.
    expect(loadFermiRun("bob", store)).toBeUndefined();
    expect(loadFermiRun(null, store)).toBeUndefined();
    // Alice still resumes her own run.
    expect(loadFermiRun("alice", store)).toEqual(aliceRun);
  });

  it("derives per-user keys from the base key", () => {
    expect(fermiRunKey("alice")).toBe(`${FERMI_STORAGE_KEY}::alice`);
    expect(fermiRunKey(null)).toBe(`${FERMI_STORAGE_KEY}::anon`);
  });
});
