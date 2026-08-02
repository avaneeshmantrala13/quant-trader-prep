// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { OaAggregateStats, OaAvgTimePoint } from "@/lib/oa/stats";
import { OaTimeTrendGraph } from "./OaTimeTrendGraph";
import {
  OaTimingPanelView,
  type OaFormatBreakdownRow,
} from "./OaTimingPanel";

afterEach(cleanup);

/* --------------------------- fake data builders --------------------------- */

function point(
  i: number,
  avgSec: number,
  kind: OaAvgTimePoint["kind"] = "sprint",
): OaAvgTimePoint {
  return {
    at: Date.UTC(2026, 0, i + 1),
    avgMsPerQuestion: avgSec * 1000,
    kind,
  };
}

const STATS: OaAggregateStats = {
  sessions: 3,
  totalAttempted: 41,
  totalCorrect: 30,
  accuracy: 30 / 41, // ≈ 73%
  medianMsPerQuestion: 42_100,
  avgMsPerQuestion: 45_600,
  pctWithinBudget: 0.66,
};

/* ---------------------------- OaTimeTrendGraph ---------------------------- */

describe("OaTimeTrendGraph", () => {
  it("renders one circle per point for N points", () => {
    const points = [point(0, 40), point(1, 38), point(2, 42, "section")];
    const { container } = render(<OaTimeTrendGraph points={points} />);
    expect(container.querySelectorAll("circle")).toHaveLength(3);
    // A ≥2-point series draws a trend line.
    expect(container.querySelector("polyline")).not.toBeNull();
  });

  it("renders an honest placeholder (no svg) for 0 points", () => {
    const { container } = render(<OaTimeTrendGraph points={[]} />);
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.getByText(/no timed sessions yet/i)).toBeTruthy();
  });

  it("renders a single dot and no line for 1 point", () => {
    const { container } = render(<OaTimeTrendGraph points={[point(0, 55)]} />);
    expect(container.querySelectorAll("circle")).toHaveLength(1);
    expect(container.querySelector("polyline")).toBeNull();
  });
});

/* --------------------------- OaTimingPanelView ---------------------------- */

describe("OaTimingPanelView", () => {
  it("renders the headline tiles (accuracy %, attempted count, avg time)", () => {
    const series = [point(0, 45), point(1, 46, "section")];
    render(<OaTimingPanelView stats={STATS} series={series} />);

    // Attempted count tile.
    expect(screen.getByText("41")).toBeTruthy();
    // Accuracy rendered as a rounded percentage (30/41 ≈ 73%).
    expect(screen.getByText("73%")).toBeTruthy();
    // Avg time / q tile: 45_600ms → "45.6s".
    expect(screen.getByText("45.6s")).toBeTruthy();
    // Median time / q tile: 42_100ms → "42.1s".
    expect(screen.getByText("42.1s")).toBeTruthy();
    // Section heading + graph both present.
    expect(screen.getByText(/Timed Sections/i)).toBeTruthy();
    expect(
      screen.getByText(/Average time per question over time/i),
    ).toBeTruthy();
  });

  it("omits the per-format breakdown table when no perFormat rows are given", () => {
    render(<OaTimingPanelView stats={STATS} series={[]} />);
    expect(screen.queryByText(/By format/i)).toBeNull();
  });

  it("renders a per-format breakdown row for each format across ALL formats", () => {
    const perFormat: OaFormatBreakdownRow[] = [
      {
        formatId: "rapid-battery",
        label: "Rapid Mixed Battery",
        sessions: 2,
        totalAttempted: 60,
        accuracy: 0.5, // → "50%"
        medianMsPerQuestion: 12_000, // → "12.0s"
        avgMsPerQuestion: 13_000,
        pctWithinBudget: 0.4,
      },
      {
        formatId: "deep-set",
        label: "Deep Set",
        sessions: 1,
        totalAttempted: 6,
        accuracy: 1, // → "100%"
        medianMsPerQuestion: 300_000, // → "300.0s"
        avgMsPerQuestion: 305_000,
        pctWithinBudget: 1,
      },
    ];
    render(<OaTimingPanelView stats={STATS} series={[]} perFormat={perFormat} />);
    expect(screen.getByText(/By format/i)).toBeTruthy();
    expect(screen.getByText("Rapid Mixed Battery")).toBeTruthy();
    expect(screen.getByText("Deep Set")).toBeTruthy();
    // A per-format cell value renders (12.0s median for the rapid battery).
    expect(screen.getByText("12.0s")).toBeTruthy();
    expect(screen.getByText("300.0s")).toBeTruthy();
  });
});
