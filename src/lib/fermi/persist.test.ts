import { describe, expect, it } from "vitest";
import { gradeFermi, gradeInterval } from "./grader";
import {
  FERMI_STORAGE_KEY,
  clearFermiRun,
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

    saveFermiRun(run, store);
    const loaded = loadFermiRun(store);

    expect(loaded).toEqual(run);
    // Earned verdicts survive so a resumed run shows the same reveals.
    expect(loaded?.grades[0]).toEqual(run.grades[0]);
    expect(loaded?.intervalGrades[1]).toEqual(run.intervalGrades[1]);
    expect(store.map.has(FERMI_STORAGE_KEY)).toBe(true);
  });

  it("returns undefined when nothing is persisted", () => {
    expect(loadFermiRun(memStore())).toBeUndefined();
  });

  it("clear removes the persisted run so re-entry starts fresh", () => {
    const store = memStore();
    saveFermiRun(sampleRun(), store);
    clearFermiRun(store);
    expect(loadFermiRun(store)).toBeUndefined();
  });

  it("treats a corrupt / malformed blob as no-resume", () => {
    const store = memStore();
    store.setItem(FERMI_STORAGE_KEY, "%%%");
    expect(loadFermiRun(store)).toBeUndefined();

    store.setItem(
      FERMI_STORAGE_KEY,
      JSON.stringify({ version: 1, mode: "bogus", index: 0 }),
    );
    expect(loadFermiRun(store)).toBeUndefined();
  });
});
