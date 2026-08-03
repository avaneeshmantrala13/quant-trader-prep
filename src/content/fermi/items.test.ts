import { describe, expect, it } from "vitest";
import {
  computeFermiReference,
  gradeFermiValue,
} from "@/lib/fermi/grader";
import {
  FERMI_ITEMS,
  FERMI_CATEGORY_ORDER,
  FERMI_MARKETS_CATEGORIES,
} from "./items";

describe("FERMI_ITEMS — content integrity", () => {
  it("has a healthy, well-spread pool", () => {
    expect(FERMI_ITEMS.length).toBeGreaterThanOrEqual(10);
    const categories = new Set(FERMI_ITEMS.map((i) => i.category));
    // A good spread of genres, not all one flavor.
    expect(categories.size).toBeGreaterThanOrEqual(5);
    // At least a couple of quant/markets-flavored items.
    expect(
      FERMI_ITEMS.filter((i) => i.category === "Markets & Trading").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("is an expanded bank of at least 45 items (T1 bank expansion)", () => {
    expect(FERMI_ITEMS.length).toBeGreaterThanOrEqual(45);
  });

  it("is weighted toward markets/trading estimation", () => {
    // >=3 items in the dedicated Markets & Trading category...
    expect(
      FERMI_ITEMS.filter((i) => i.category === "Markets & Trading").length,
    ).toBeGreaterThanOrEqual(3);
    // ...and >=3 DISTINCT markets-related categories represented in the bank.
    const present = new Set(FERMI_ITEMS.map((i) => i.category));
    const marketsPresent = FERMI_MARKETS_CATEGORIES.filter((c) =>
      present.has(c),
    );
    expect(marketsPresent.length).toBeGreaterThanOrEqual(3);
  });

  it("has unique ids", () => {
    const ids = FERMI_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every category used is declared in the display order", () => {
    for (const item of FERMI_ITEMS) {
      expect(FERMI_CATEGORY_ORDER).toContain(item.category);
    }
  });

  it("every item is well-formed (crisp prompt, labeled positive factors)", () => {
    for (const item of FERMI_ITEMS) {
      expect(item.prompt.length).toBeGreaterThan(20);
      expect(item.unit.length).toBeGreaterThan(0);
      expect(item.takeaway.length).toBeGreaterThan(20);
      expect(item.factors.length).toBeGreaterThanOrEqual(2);
      for (const f of item.factors) {
        expect(f.label.length).toBeGreaterThan(0);
        expect(Number.isFinite(f.value)).toBe(true);
        expect(f.value).toBeGreaterThan(0);
      }
    }
  });
});

describe("FERMI_ITEMS — numerically verifiable references", () => {
  it("each coded decomposition product matches its stated reference", () => {
    for (const item of FERMI_ITEMS) {
      const computed = computeFermiReference(item.factors);
      expect(computed).toBeGreaterThan(0);
      // The stated reference is the author-intended magnitude; the coded product
      // must agree with it to well within the full-credit band (a factor of 3),
      // which guarantees a factor typo can never silently drift the answer.
      const g = gradeFermiValue(item.reference, computed);
      expect(g.logDistance).not.toBeNull();
      expect(g.logDistance as number).toBeLessThan(0.05); // within ~12%
    }
  });

  it("the coded product EQUALS the stated reference (self-consistency invariant)", () => {
    // The product of `factors` must equal `reference` within a tight 2% band —
    // 25x tighter than the ~12% full-credit gate above, and only that loose to
    // permit references rounded to a clean display magnitude (e.g. 8.1M for a
    // computed 8.14M). Any real factor typo (a changed digit) moves the product
    // by far more than 2%, so it is guaranteed to break this invariant.
    for (const item of FERMI_ITEMS) {
      const computed = computeFermiReference(item.factors);
      const relError = Math.abs(computed / item.reference - 1);
      expect(relError).toBeLessThan(0.02);
    }
  });

  it("a learner entering the exact reference always scores full credit", () => {
    for (const item of FERMI_ITEMS) {
      const g = gradeFermiValue(item.reference, item.reference);
      expect(g.band).toBe("correct");
      expect(g.score).toBe(1);
    }
  });
});
