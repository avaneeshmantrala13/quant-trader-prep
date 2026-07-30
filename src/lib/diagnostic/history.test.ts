import { describe, expect, it } from "vitest";
import {
  computeDiagnosticResult,
  appendDiagnosticResult,
  diagnosticTrend,
  DEFAULT_HISTORY_CAP,
} from "./history";
import type { DiagnosticOutcome } from "./diagnosticSeed";
import type { DiagnosticResult } from "@/types/progress";

function o(
  topicKey: string,
  tier: DiagnosticOutcome["tier"],
  correct: boolean,
): DiagnosticOutcome {
  return { topicKey, tier, correct };
}

function result(overallScore: number, at: string): DiagnosticResult {
  return { at, overallScore, itemsAnswered: 4 };
}

describe("computeDiagnosticResult", () => {
  it("returns a zeroed result for no outcomes", () => {
    const r = computeDiagnosticResult([], "2026-01-01T00:00:00.000Z");
    expect(r.overallScore).toBe(0);
    expect(r.itemsAnswered).toBe(0);
    expect(r.perTopic).toEqual({});
    expect(r.at).toBe("2026-01-01T00:00:00.000Z");
  });

  it("computes the fraction correct overall", () => {
    const r = computeDiagnosticResult(
      [
        o("A", "medium", true),
        o("A", "medium", false),
        o("B", "hard", true),
        o("B", "easy", true),
      ],
      "t",
    );
    expect(r.itemsAnswered).toBe(4);
    expect(r.overallScore).toBe(0.75);
  });

  it("computes per-topic fractions", () => {
    const r = computeDiagnosticResult(
      [
        o("A", "medium", true),
        o("A", "medium", false),
        o("B", "hard", true),
      ],
      "t",
    );
    expect(r.perTopic).toEqual({ A: 0.5, B: 1 });
  });

  it("tier-weights the overall score when requested", () => {
    // easy(1) wrong, hard(3) right ⇒ 3 / (1+3) = 0.75 weighted vs 0.5 plain.
    const outcomes = [o("A", "easy", false), o("A", "hard", true)];
    expect(computeDiagnosticResult(outcomes, "t").overallScore).toBe(0.5);
    expect(
      computeDiagnosticResult(outcomes, "t", { tierWeighted: true })
        .overallScore,
    ).toBe(0.75);
  });
});

describe("appendDiagnosticResult", () => {
  it("appends to an undefined history without mutating", () => {
    const r = result(0.5, "a");
    const out = appendDiagnosticResult(undefined, r);
    expect(out).toEqual([r]);
  });

  it("does not mutate the input array (immutability)", () => {
    const history = [result(0.3, "a")];
    const out = appendDiagnosticResult(history, result(0.6, "b"));
    expect(history).toHaveLength(1);
    expect(out).toHaveLength(2);
    expect(out).not.toBe(history);
    expect(out[1].overallScore).toBe(0.6);
  });

  it("caps the length, dropping the oldest entries", () => {
    let hist: DiagnosticResult[] = [];
    for (let i = 0; i < 5; i++) {
      hist = appendDiagnosticResult(hist, result(i / 10, `t${i}`), 3);
    }
    expect(hist).toHaveLength(3);
    // Oldest two (t0, t1) dropped; newest three kept in order.
    expect(hist.map((r) => r.at)).toEqual(["t2", "t3", "t4"]);
  });

  it("uses DEFAULT_HISTORY_CAP when no cap is given", () => {
    let hist: DiagnosticResult[] = [];
    for (let i = 0; i < DEFAULT_HISTORY_CAP + 10; i++) {
      hist = appendDiagnosticResult(hist, result(0.5, `t${i}`));
    }
    expect(hist).toHaveLength(DEFAULT_HISTORY_CAP);
    expect(hist[hist.length - 1].at).toBe(`t${DEFAULT_HISTORY_CAP + 9}`);
  });
});

describe("diagnosticTrend", () => {
  it("handles empty history", () => {
    const t = diagnosticTrend(undefined);
    expect(t.count).toBe(0);
    expect(t.first).toBeUndefined();
    expect(t.latest).toBeUndefined();
    expect(t.delta).toBe(0);
    expect(t.improving).toBe(false);
    expect(t.points).toEqual([]);
  });

  it("handles a single attempt (no delta, not improving)", () => {
    const t = diagnosticTrend([result(0.6, "a")]);
    expect(t.count).toBe(1);
    expect(t.first).toBe(t.latest);
    expect(t.delta).toBe(0);
    expect(t.improving).toBe(false);
    expect(t.points).toEqual([{ attempt: 1, score: 0.6, at: "a" }]);
  });

  it("computes first-vs-latest delta across multiple attempts", () => {
    const t = diagnosticTrend([
      result(0.4, "a"),
      result(0.5, "b"),
      result(0.7, "c"),
    ]);
    expect(t.count).toBe(3);
    expect(t.first?.at).toBe("a");
    expect(t.latest?.at).toBe("c");
    expect(t.delta).toBeCloseTo(0.3, 10);
    expect(t.improving).toBe(true);
    expect(t.points.map((p) => p.attempt)).toEqual([1, 2, 3]);
  });

  it("is not 'improving' when the latest is worse than the first", () => {
    const t = diagnosticTrend([result(0.8, "a"), result(0.5, "b")]);
    expect(t.delta).toBeCloseTo(-0.3, 10);
    expect(t.improving).toBe(false);
  });
});
