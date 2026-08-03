import { describe, expect, it } from "vitest";
import {
  validateVerifiedItem,
  VERIFIED_CATEGORY_ORDER,
  type VerifiedCategory,
} from "./schema";
import { VERIFIED_ITEMS } from "./items";
import {
  getByCategory,
  getByDifficulty,
  getByFirm,
  getById,
  getFirms,
  getVerifiedItemCount,
  getVerifiedItems,
} from "./loader";

describe("Verified Bank — schema validity", () => {
  it("every item passes validateVerifiedItem", () => {
    for (const item of VERIFIED_ITEMS) {
      expect(validateVerifiedItem(item)).toEqual([]);
    }
  });

  it("every item carries required provenance + a full worked solution", () => {
    for (const item of VERIFIED_ITEMS) {
      expect(item.provenance.genre.trim().length).toBeGreaterThan(0);
      expect(item.workedSolution.trim().length).toBeGreaterThanOrEqual(40);
      expect(item.verifiedBy.trim().length).toBeGreaterThan(0);
      expect(item.distinctnessReviewed).toBe(true);
      expect(item.tags.length).toBeGreaterThan(0);
      // answer is a real string or a finite number
      if (typeof item.answer === "number") {
        expect(Number.isFinite(item.answer)).toBe(true);
      } else {
        expect(item.answer.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("rejects a malformed item (validator actually catches errors)", () => {
    const bad = {
      id: "",
      prompt: "too short",
      category: "not-a-category",
      difficulty: "impossible",
      answer: {},
      workedSolution: "",
      provenance: { genre: "" },
      tags: [],
      verifiedBy: "",
      distinctnessReviewed: false,
      // deliberately violates the type; cast for the negative test
    } as unknown as (typeof VERIFIED_ITEMS)[number];
    expect(validateVerifiedItem(bad).length).toBeGreaterThan(0);
  });
});

describe("Verified Bank — ids and distinctness", () => {
  it("has unique ids", () => {
    const ids = VERIFIED_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no verbatim-duplicated prompts", () => {
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const prompts = VERIFIED_ITEMS.map((i) => norm(i.prompt));
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  it("has no verbatim-duplicated worked solutions", () => {
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const sols = VERIFIED_ITEMS.map((i) => norm(i.workedSolution));
    expect(new Set(sols).size).toBe(sols.length);
  });
});

describe("Verified Bank — scale and category spread", () => {
  it("meets the >= 50-item seed-set target", () => {
    expect(VERIFIED_ITEMS.length).toBeGreaterThanOrEqual(50);
    expect(getVerifiedItemCount()).toBe(VERIFIED_ITEMS.length);
  });

  it("covers every declared category", () => {
    const used = new Set(VERIFIED_ITEMS.map((i) => i.category));
    for (const cat of VERIFIED_CATEGORY_ORDER) {
      expect(used.has(cat)).toBe(true);
    }
  });

  it("only uses declared categories", () => {
    const allowed = new Set<VerifiedCategory>(VERIFIED_CATEGORY_ORDER);
    for (const item of VERIFIED_ITEMS) {
      expect(allowed.has(item.category)).toBe(true);
    }
  });
});

describe("Verified Bank — loader query API", () => {
  it("getVerifiedItems returns a defensive copy of the full pool", () => {
    const a = getVerifiedItems();
    expect(a.length).toBe(VERIFIED_ITEMS.length);
    a.pop();
    // mutating the returned array must not shrink the source
    expect(VERIFIED_ITEMS.length).toBe(getVerifiedItemCount());
  });

  it("getByCategory returns exactly the items in that category", () => {
    for (const cat of VERIFIED_CATEGORY_ORDER) {
      const subset = getByCategory(cat);
      expect(subset.length).toBeGreaterThan(0);
      expect(subset.every((i) => i.category === cat)).toBe(true);
    }
    const partition = VERIFIED_CATEGORY_ORDER.reduce(
      (sum, cat) => sum + getByCategory(cat).length,
      0,
    );
    expect(partition).toBe(VERIFIED_ITEMS.length);
  });

  it("getByDifficulty returns only matching items", () => {
    const hard = getByDifficulty("hard");
    expect(hard.length).toBeGreaterThan(0);
    expect(hard.every((i) => i.difficulty === "hard")).toBe(true);
  });

  it("getByFirm matches provenance.firm case-insensitively", () => {
    const firms = getFirms();
    expect(firms.length).toBeGreaterThan(0);
    const first = firms[0];
    const byExact = getByFirm(first);
    expect(byExact.length).toBeGreaterThan(0);
    expect(byExact.every((i) => i.provenance.firm === first)).toBe(true);
    // case-insensitivity
    expect(getByFirm(first.toUpperCase()).length).toBe(byExact.length);
    // an unknown firm yields nothing
    expect(getByFirm("definitely-not-a-real-firm-xyz")).toEqual([]);
  });

  it("getById round-trips every item and misses gracefully", () => {
    for (const item of VERIFIED_ITEMS) {
      expect(getById(item.id)?.id).toBe(item.id);
    }
    expect(getById("vb-nonexistent")).toBeUndefined();
  });
});
