import { describe, expect, it } from "vitest";
import {
  BUDGET_DRIFT_TOLERANCE,
  OA_FORMATS,
  auditCatalog,
  auditOaFormat,
  auditPresetBudget,
  benchmarkBudgetMs,
  derivePerQuestionSec,
  oaFormatById,
  presetImpliedBudgetMs,
  type OaFormat,
} from "./oaFormats";
import { OPTIVER_DEFAULT, ZETAMAC_DEFAULT } from "@/lib/arena/config";

describe("derivePerQuestionSec", () => {
  it("is totalSec / count rounded to 0.1s", () => {
    expect(derivePerQuestionSec(480, 80)).toBe(6); // 80 Qs / 8 min sprint
    expect(derivePerQuestionSec(720, 50)).toBe(14.4); // 50-Q / 12-min battery
    expect(derivePerQuestionSec(0, 0)).toBe(0);
  });
});

describe("OA benchmark catalog", () => {
  it("passes its own audit checklist entirely (no drift, all sourced)", () => {
    expect(auditCatalog()).toEqual([]);
  });

  it("every format's perQuestionSec matches its derived shape", () => {
    for (const f of OA_FORMATS) {
      expect(f.perQuestionSec).toBe(
        derivePerQuestionSec(f.totalSec, f.questionCount),
      );
    }
  });

  it("the arithmetic sprint is 6.0 s/q, grounded in the research doc", () => {
    const opt = oaFormatById("optiver-80-8")!;
    expect(opt.perQuestionSec).toBe(6);
    expect(opt.archetype).toBe("arithmetic-sprint");
    expect(opt.sourceDoc).toMatch(/FIRM_TIMED_ASSESSMENTS/);
    expect(benchmarkBudgetMs("optiver-80-8")).toBe(6000);
  });

  it("benchmarkBudgetMs is undefined for an unknown id", () => {
    expect(benchmarkBudgetMs("nope")).toBeUndefined();
  });
});

describe("auditOaFormat", () => {
  const good = oaFormatById("optiver-80-8")!;

  it("flags a hand-edited benchmark that lies about the shape", () => {
    const tampered: OaFormat = { ...good, perQuestionSec: 3 };
    const r = auditOaFormat(tampered);
    expect(r.passed).toBe(false);
    expect(r.checks.find((c) => c.id === "budget-derived")!.ok).toBe(false);
  });

  it("flags a mis-tagged archetype (a sprint that is minutes-per-q)", () => {
    const tampered: OaFormat = {
      ...good,
      questionCount: 6,
      totalSec: 3600,
      perQuestionSec: derivePerQuestionSec(3600, 6), // 600s
    };
    const r = auditOaFormat(tampered);
    expect(r.passed).toBe(false);
    expect(r.checks.find((c) => c.id === "archetype-pace")!.ok).toBe(false);
  });

  it("flags missing provenance", () => {
    const tampered: OaFormat = { ...good, sourceDoc: "", asOf: "nope" };
    const r = auditOaFormat(tampered);
    expect(r.checks.find((c) => c.id === "provenance")!.ok).toBe(false);
  });
});

describe("auditPresetBudget — parity of a preset vs the real OA", () => {
  it("marks the arithmetic sprint preset faithful (6000ms == 6000ms benchmark)", () => {
    const budget = presetImpliedBudgetMs(OPTIVER_DEFAULT);
    expect(budget).toBe(6000);
    const audit = auditPresetBudget("optiver-80-8", budget)!;
    expect(audit.drift).toBe(0);
    expect(audit.faithful).toBe(true);
  });

  it("flags a drifted budget beyond tolerance", () => {
    // 9000ms vs 6000ms benchmark = 50% drift > 15% tolerance.
    const audit = auditPresetBudget("optiver-80-8", 9000)!;
    expect(audit.drift).toBeCloseTo(0.5, 6);
    expect(audit.faithful).toBe(false);
  });

  it("accepts a small drift within tolerance", () => {
    // 6600ms vs 6000ms = 10% ≤ 15%.
    const audit = auditPresetBudget("optiver-80-8", 6600)!;
    expect(audit.drift).toBeCloseTo(0.1, 6);
    expect(audit.faithful).toBe(true);
    expect(BUDGET_DRIFT_TOLERANCE).toBe(0.15);
  });

  it("returns undefined for an unknown format id", () => {
    expect(auditPresetBudget("nope", 6000)).toBeUndefined();
  });
});

describe("presetImpliedBudgetMs", () => {
  it("is 0 for an uncapped window (Zetamac) — no fixed per-q OA pace", () => {
    expect(presetImpliedBudgetMs(ZETAMAC_DEFAULT)).toBe(0);
  });
});
