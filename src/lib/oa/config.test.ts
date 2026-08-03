import { describe, expect, it } from "vitest";
import {
  BLITZ_FORMAT,
  DEEP_SET_FORMAT,
  DERIVATION_FORMAT,
  MEASURED_FORMAT,
  OA_FORMATS,
  RAPID_BATTERY_FORMAT,
  SECTION_FORMAT,
  SPRINT_FORMAT,
  oaFormatById,
  oaFormatByKind,
  resolveScoring,
} from "./config";
import type { OaFormatConfig } from "./types";
import { OA_CONTENT_POOLS } from "./questionPool";

/** Every timed (non-measured) format's derived per-question budget = window ÷ count. */
function expectedBudgetMs(config: OaFormatConfig): number {
  if (config.kind === "sprint") return (config.perQuestionSec as number) * 1000;
  if (config.kind === "section")
    return Math.round(((config.sectionSec as number) / config.questionCount) * 1000);
  return config.budgetMs; // measured: reference budget only
}

describe("OA_FORMATS catalog", () => {
  it("contains the 3 originals + 4 research-derived formats (7 total)", () => {
    expect(OA_FORMATS).toHaveLength(7);
    const ids = OA_FORMATS.map((f) => f.id);
    expect(ids).toEqual([
      "rapid-battery",
      "blitz",
      "sprint-default",
      "section-default",
      "derivation-set",
      "deep-set",
      "measured-default",
    ]);
  });

  it("has unique ids and resolvable configs", () => {
    const ids = OA_FORMATS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of OA_FORMATS) expect(oaFormatById(f.id)).toBe(f);
  });

  it("every format is structurally valid (positive count, valid scoring, derived budget)", () => {
    for (const f of OA_FORMATS) {
      expect(f.questionCount).toBeGreaterThan(0);
      expect(f.budgetMs).toBeGreaterThan(0);
      expect(f.scoring.correct).toBeGreaterThan(0);
      expect(f.label.length).toBeGreaterThan(0);
      expect(f.blurb.length).toBeGreaterThan(0);
      expect(f.sourceNote.length).toBeGreaterThan(0);
      if (f.kind === "sprint") {
        expect(f.perQuestionSec).toBeGreaterThan(0);
        expect(f.sectionSec).toBeUndefined();
        expect(f.autoAdvance).toBe(true);
        expect(f.freeNavigation).toBe(false);
      }
      if (f.kind === "section") {
        expect(f.sectionSec).toBeGreaterThan(0);
        expect(f.perQuestionSec).toBeUndefined();
      }
      // The budget matches window ÷ count for timed formats.
      expect(f.budgetMs).toBe(expectedBudgetMs(f));
    }
  });

  it("is ordered fastest-pace → slowest, with Measured last", () => {
    const timed = OA_FORMATS.filter((f) => f.kind !== "measured");
    const perQ = timed.map((f) => f.budgetMs);
    for (let i = 1; i < perQ.length; i++) {
      expect(perQ[i]).toBeGreaterThanOrEqual(perQ[i - 1]);
    }
    expect(OA_FORMATS[OA_FORMATS.length - 1].kind).toBe("measured");
  });
});

describe("research-derived formats — exact tuned shapes", () => {
  it("Rapid Mixed Battery (Citadel-style): 40 Q, 15 s/q sprint, +1/−1/0, no back", () => {
    const f = RAPID_BATTERY_FORMAT;
    expect(f.kind).toBe("sprint");
    expect(f.questionCount).toBe(40);
    expect(f.perQuestionSec).toBe(15);
    expect(f.budgetMs).toBe(15_000);
    expect(f.autoAdvance).toBe(true);
    expect(f.freeNavigation).toBe(false);
    expect(f.scoring).toEqual({ correct: 1, wrong: -1, skip: 0 });
    expect(f.firmAttribution).toMatch(/citadel/i);
    expect(f.contentPool).toBe("rapidMixed");
  });

  it("Blitz (Five Rings-style): 20 Q / 16 min (~48 s/q) section, free nav, +1/0/0", () => {
    const f = BLITZ_FORMAT;
    expect(f.kind).toBe("section");
    expect(f.questionCount).toBe(20);
    expect(f.sectionSec).toBe(16 * 60);
    expect(f.budgetMs).toBe(48_000);
    expect(f.freeNavigation).toBe(true);
    expect(f.scoring).toEqual({ correct: 1, wrong: 0, skip: 0 });
    expect(f.firmAttribution).toMatch(/five rings/i);
    expect(f.contentPool).toBe("blitz");
  });

  it("Derivation Set (IMC-style): 12 Q / 36 min (3 min/q) MODULE-LOCKED section, +1/0/0", () => {
    const f = DERIVATION_FORMAT;
    expect(f.kind).toBe("section");
    expect(f.questionCount).toBe(12);
    expect(f.sectionSec).toBe(36 * 60);
    expect(f.budgetMs).toBe(180_000); // 3 min/q
    expect(f.freeNavigation).toBe(false); // ⇒ module-lock (no back)
    expect(f.scoring).toEqual({ correct: 1, wrong: 0, skip: 0 });
    expect(f.firmAttribution).toMatch(/imc/i);
    expect(f.contentPool).toBe("derivation");
  });

  it("Deep Set (DRW-style): 6 Q / 36 min (6 min/q) section, free nav, +1/0/0", () => {
    const f = DEEP_SET_FORMAT;
    expect(f.kind).toBe("section");
    expect(f.questionCount).toBe(6);
    expect(f.sectionSec).toBe(36 * 60);
    expect(f.budgetMs).toBe(360_000); // 6 min/q
    expect(f.freeNavigation).toBe(true);
    expect(f.scoring).toEqual({ correct: 1, wrong: 0, skip: 0 });
    expect(f.firmAttribution).toMatch(/drw/i);
    expect(f.contentPool).toBe("deepSet");
  });

  it("all four are STRICTER than their real-firm benchmark pace", () => {
    // Citadel ≈14.4 s/q → 15 is close/slightly stricter on total window (10 vs 12 min).
    expect(RAPID_BATTERY_FORMAT.perQuestionSec).toBeLessThanOrEqual(15);
    // Five Rings ≈60–75 s/q → 48 s/q is stricter.
    expect(BLITZ_FORMAT.budgetMs).toBeLessThan(60_000);
    // IMC ≈3–4 min/q → 3 min/q sits at/below the lower bound.
    expect(DERIVATION_FORMAT.budgetMs).toBeLessThanOrEqual(180_000);
    // DRW ≈7.5 min/q → 6 min/q is stricter.
    expect(DEEP_SET_FORMAT.budgetMs).toBeLessThan(7.5 * 60 * 1000);
  });
});

describe("the three ORIGINAL formats are unchanged", () => {
  it("Sprint stays 12 Q / 90 s/q / +1/−1/0", () => {
    expect(SPRINT_FORMAT.id).toBe("sprint-default");
    expect(SPRINT_FORMAT.kind).toBe("sprint");
    expect(SPRINT_FORMAT.questionCount).toBe(12);
    expect(SPRINT_FORMAT.perQuestionSec).toBe(90);
    expect(SPRINT_FORMAT.budgetMs).toBe(90_000);
    expect(SPRINT_FORMAT.scoring).toEqual({ correct: 1, wrong: -1, skip: 0 });
    expect(SPRINT_FORMAT.contentPool).toBeUndefined(); // default mixed pool
  });

  it("Section stays 17 Q / 30 min / free nav / +1/0/0 (hard-mode −1)", () => {
    expect(SECTION_FORMAT.id).toBe("section-default");
    expect(SECTION_FORMAT.kind).toBe("section");
    expect(SECTION_FORMAT.questionCount).toBe(17);
    expect(SECTION_FORMAT.sectionSec).toBe(30 * 60);
    expect(SECTION_FORMAT.freeNavigation).toBe(true);
    expect(SECTION_FORMAT.hardModePenalty).toBe(-1);
    expect(SECTION_FORMAT.contentPool).toBeUndefined();
  });

  it("Measured stays untimed / free nav", () => {
    expect(MEASURED_FORMAT.id).toBe("measured-default");
    expect(MEASURED_FORMAT.kind).toBe("measured");
    expect(MEASURED_FORMAT.sectionSec).toBeUndefined();
    expect(MEASURED_FORMAT.perQuestionSec).toBeUndefined();
    expect(MEASURED_FORMAT.contentPool).toBeUndefined();
  });
});

describe("format ↔ content pool wiring (T11)", () => {
  it("every research-derived format points at a defined, non-empty pool", () => {
    for (const f of OA_FORMATS) {
      if (!f.contentPool) continue;
      const pool = OA_CONTENT_POOLS[f.contentPool];
      expect(pool, f.id).toBeDefined();
      expect(pool.length, f.id).toBeGreaterThan(0);
    }
  });

  it("the four research-derived formats each declare a wired pool", () => {
    expect(RAPID_BATTERY_FORMAT.contentPool).toBe("rapidMixed");
    expect(BLITZ_FORMAT.contentPool).toBe("blitz");
    expect(DERIVATION_FORMAT.contentPool).toBe("derivation");
    expect(DEEP_SET_FORMAT.contentPool).toBe("deepSet");
    for (const key of ["rapidMixed", "blitz", "derivation", "deepSet"] as const) {
      expect(OA_CONTENT_POOLS[key], key).toBeDefined();
    }
  });
});

describe("oaFormatByKind + resolveScoring", () => {
  it("oaFormatByKind returns a format of the requested kind", () => {
    expect(oaFormatByKind("sprint").kind).toBe("sprint");
    expect(oaFormatByKind("section").kind).toBe("section");
    expect(oaFormatByKind("measured").kind).toBe("measured");
  });

  it("resolveScoring folds the hard-mode penalty only when a format offers one", () => {
    // Blitz offers a hard-mode −1 penalty.
    expect(resolveScoring(BLITZ_FORMAT, true).wrong).toBe(-1);
    expect(resolveScoring(BLITZ_FORMAT, false).wrong).toBe(0);
    // Derivation/Deep have no hard-mode toggle ⇒ unchanged.
    expect(resolveScoring(DERIVATION_FORMAT, true).wrong).toBe(0);
    expect(resolveScoring(DEEP_SET_FORMAT, true).wrong).toBe(0);
    // Rapid battery already penalizes wrong; no hard-mode toggle.
    expect(resolveScoring(RAPID_BATTERY_FORMAT, true).wrong).toBe(-1);
  });
});
