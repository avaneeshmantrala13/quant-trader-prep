import { describe, it, expect } from "vitest";
import { Rng } from "@/lib/rng";
import { computeFermiReference } from "@/lib/fermi/grader";
import { gradeFermi } from "@/lib/fermi/grader";
import {
  FERMI_GENERATORS,
  buildFermiDrill,
} from "./fermiGenerators";

/**
 * The parametric Fermi generators must stay numerically self-consistent (the
 * coded product of the sampled factors IS the reference — the same invariant the
 * static bank enforces) and reproducible from a seed, so the battery station can
 * draw fresh-but-verifiable estimation problems.
 */

describe("fermi generators — self-consistency", () => {
  it("every generator's stated reference equals the coded product of its factors", () => {
    for (const [name, gen] of Object.entries(FERMI_GENERATORS)) {
      for (let s = 0; s < 40; s += 1) {
        const item = gen(new Rng(s));
        expect(item.factors.length, name).toBeGreaterThanOrEqual(2);
        expect(item.reference, name).toBeCloseTo(
          computeFermiReference(item.factors),
          6,
        );
        expect(item.reference, name).toBeGreaterThan(0);
        expect(Number.isFinite(item.reference), name).toBe(true);
      }
    }
  });
});

describe("buildFermiDrill — determinism + freshness", () => {
  it("same seed ⇒ identical items", () => {
    const a = buildFermiDrill(1234, 6);
    const b = buildFermiDrill(1234, 6);
    expect(a).toHaveLength(6);
    expect(a.map((it) => [it.prompt, it.reference])).toEqual(
      b.map((it) => [it.prompt, it.reference]),
    );
  });

  it("different seeds draw different content", () => {
    const a = buildFermiDrill(1, 6);
    const b = buildFermiDrill(2, 6);
    const sameRefs = a.every((it, i) => it.reference === b[i]?.reference);
    expect(sameRefs).toBe(false);
  });

  it("ids are unique within a drawn drill", () => {
    const items = buildFermiDrill(99, 6);
    const ids = new Set(items.map((it) => it.id));
    expect(ids.size).toBe(items.length);
  });
});

describe("generated items grade against the coded reference", () => {
  it("typing the exact reference scores full credit", () => {
    for (let s = 0; s < 20; s += 1) {
      const item = buildFermiDrill(s, 3)[0];
      const grade = gradeFermi(item.reference, String(item.reference));
      expect(grade.score).toBe(1);
      expect(grade.band).toBe("correct");
    }
  });

  it("an order-of-magnitude miss is scored incorrect", () => {
    const item = buildFermiDrill(7, 1)[0];
    const grade = gradeFermi(item.reference, String(item.reference * 1000));
    expect(grade.band).toBe("incorrect");
    expect(grade.score).toBe(0);
  });
});
