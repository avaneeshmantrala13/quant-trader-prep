// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { FloorResult, UserQuote } from "@/lib/tradingFloor";
import type { CalibrationPair } from "@/lib/mastery/reliability";
import { FloorDebrief } from "@/components/tradingFloor/FloorDebrief";
import { QuotePad } from "@/components/tradingFloor/QuotePad";

/**
 * Runtime servability of THE TRADING FLOOR UI. Both sub-components are fully
 * controlled/presentational (they take a hand-built `FloorResult` / plain
 * props), so we can render them WITHOUT the page's router / progress / theme
 * providers — mirroring `oaRuntime.test.tsx`, which drives `OaRunner` directly.
 * The pure engine is unit-tested separately; here we only assert the UI wiring.
 */

afterEach(cleanup);

/** A hand-built BINARY result with enough calibration pairs to be "sufficient". */
function binaryResult(): FloorResult {
  const rounds = 8;
  const userPnl = [1, 2, 3, 4, 6, 8, 10, 12.5];
  const benchPnl = [1, 1, 2, 2, 3, 4, 6, 8];
  const fairPath = [0.5, 0.52, 0.55, 0.6, 0.58, 0.63, 0.7, 0.78];
  const inventoryPath = [1, 0, -1, 0, 1, 2, 1, 0];
  const pairs: CalibrationPair[] = Array.from({ length: 30 }, (_, i) => ({
    pred: 0.3 + (i % 5) * 0.1,
    outcome: (i % 2) as 0 | 1,
  }));
  return {
    rounds,
    userPnl,
    benchPnl,
    userFinal: 12.5,
    benchFinal: 8,
    userMaxDrawdown: 1.2,
    fills: 7,
    pickedOff: 2,
    scenarioId: "dice-over-under-8",
    kind: "binary",
    configId: "interview",
    finalTruth: 1,
    fairPath,
    inventoryPath,
    calibrationPairs: pairs,
    consistency: 0.9,
    brier: 0.21,
    grade: { delta: 4.5, pct: 156, label: "You beat the desk" },
  };
}

describe("FloorDebrief", () => {
  it("renders the final P&L, the vs-desk grade, and a binary reliability diagram", () => {
    render(<FloorDebrief result={binaryResult()} onRestart={vi.fn()} />);

    // A P&L number (the signed final) is rendered (hero + stat grid ⇒ ≥1).
    expect(screen.getAllByText("+12.5").length).toBeGreaterThan(0);
    // The vs-desk grade verdict surfaces.
    expect(screen.getByText(/You beat the desk/i)).toBeTruthy();
    // The binary calibration debrief + its reliability diagram render (30 pairs
    // is past the sufficiency gate, so the real diagram — not the progress state
    // — is shown, carrying its accessible name).
    expect(screen.getByText(/Why this is calibration/i)).toBeTruthy();
    expect(
      screen.getByRole("img", { name: /reliability diagram/i }),
    ).toBeTruthy();
  });

  it("shows the reliability progress (insufficient-data) state with too few pairs", () => {
    const sparse: FloorResult = {
      ...binaryResult(),
      calibrationPairs: [
        { pred: 0.6, outcome: 1 },
        { pred: 0.4, outcome: 0 },
      ],
    };
    render(<FloorDebrief result={sparse} onRestart={vi.fn()} />);
    // Below MIN_PAIRS the diagram refuses to show numbers and nudges for more.
    expect(screen.getByText(/Calibration needs a bit more data/i)).toBeTruthy();
  });
});

describe("QuotePad", () => {
  it("renders a live bid/ask from mid/half/skew and submits a UserQuote", () => {
    const onSubmit = vi.fn<(quote: UserQuote) => void>();
    render(
      <QuotePad
        kind="quantity"
        unit="pips"
        maxSize={5}
        inventory={0}
        onSubmit={onSubmit}
        defaults={{ mid: "30", half: "2", skew: "0", size: "3" }}
      />,
    );

    // center = 30 − 0·0 = 30 ⇒ bid 28, ask 32.
    expect(screen.getByText("28")).toBeTruthy();
    expect(screen.getByText("32")).toBeTruthy();

    fireEvent.click(screen.getByText("Quote market"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      mid: 30,
      half: 2,
      skew: 0,
      size: 3,
    });
  });

  it("skews the quote off inventory (center = mid − skew·inventory)", () => {
    const onSubmit = vi.fn<(quote: UserQuote) => void>();
    render(
      <QuotePad
        kind="quantity"
        unit="pips"
        maxSize={5}
        inventory={2}
        onSubmit={onSubmit}
        defaults={{ mid: "30", half: "2", skew: "1", size: "1" }}
      />,
    );
    // center = 30 − 1·2 = 28 ⇒ bid 26, ask 30.
    expect(screen.getByText("26")).toBeTruthy();
    expect(screen.getByText("30")).toBeTruthy();
  });
});
