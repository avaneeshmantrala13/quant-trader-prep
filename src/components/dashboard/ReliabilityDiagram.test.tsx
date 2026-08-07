// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { CalibrationPair } from "@/lib/mastery/reliability";
import { reliabilityDiagram } from "@/lib/calibration/reliability";
import { ReliabilityDiagram } from "./ReliabilityDiagram";

/**
 * The calibration panel must NEVER contradict itself: the verdict chip, the
 * "points sit above/below the diagonal" caption, and the "when you say ~80%,
 * you're right X%" headline all read from ONE signed calibration error, so they
 * always point the same way. These render tests lock that end-to-end (pairs →
 * shared `reliabilityDiagram` shaping → SVG panel), with the exact 80→82
 * screenshot scenario as the headline regression.
 */

afterEach(cleanup);

/** n pairs at a fixed predicted prob, `k` of them correct. */
function group(pred: number, n: number, k: number): CalibrationPair[] {
  return Array.from({ length: n }, (_, i) => ({
    pred,
    outcome: (i < k ? 1 : 0) as 0 | 1,
  }));
}

function renderFor(pairs: CalibrationPair[]): string {
  const { container } = render(
    <ReliabilityDiagram data={reliabilityDiagram(pairs)} />,
  );
  return container.textContent ?? "";
}

describe("ReliabilityDiagram — chip + caption match the signed error sign", () => {
  it("over-confident ⇒ chip 'over-confident' AND caption says BELOW the diagonal", () => {
    const text = renderFor(group(0.9, 40, 20)); // say 90 / right 50
    expect(text).toContain("over-confident");
    expect(text).not.toContain("under-confident");
    expect(text).toContain("sit below the diagonal");
    expect(text).not.toContain("sit above the diagonal");
  });

  it("under-confident ⇒ chip 'under-confident' AND caption says ABOVE the diagonal", () => {
    const text = renderFor(group(0.4, 40, 28)); // say 40 / right 70
    expect(text).toContain("under-confident");
    expect(text).toContain("sit above the diagonal");
    expect(text).not.toContain("sit below the diagonal");
  });

  it("well-calibrated ⇒ chip 'well-calibrated' AND caption says HUG the diagonal", () => {
    const text = renderFor([...group(0.2, 20, 4), ...group(0.8, 20, 16)]);
    expect(text).toContain("well-calibrated");
    expect(text).toContain("hug the diagonal");
  });
});

describe("ReliabilityDiagram — the 80→82 screenshot regression", () => {
  it("say ~80% / right ~82% never renders over-confident and shows the 82% headline", () => {
    const text = renderFor(group(0.8, 28, 23)); // observed ≈ 0.821
    expect(text).not.toContain("over-confident");
    expect(text).not.toContain("sit below the diagonal");
    // Headline surfaced and agrees with the read.
    expect(text).toContain("82%");
    expect(text).toContain("(n=28)");
  });

  it("withholds the contradicting 80% headline when the aggregate is over-confident", () => {
    // 80% band is locally under-confident (right ~82%) but overall over-confident.
    const text = renderFor([...group(0.8, 28, 23), ...group(0.99, 120, 48)]);
    expect(text).toContain("over-confident");
    expect(text).toContain("sit below the diagonal");
    // The self-contradicting "right 82% at ~80% (n=28)" headline is suppressed.
    expect(text).not.toContain("(n=28)");
  });
});
