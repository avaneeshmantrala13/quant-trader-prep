// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QuizView } from "./MakeMarketPage";
import type { Fill } from "@/lib/games/makeMarket/engine";

/**
 * BUG 1 regression: the break-even quiz has a fixed side (BUY/SELL toggle) plus
 * a single PRICE box, but the revealed answer format ("SELL 2 @ 600") invites
 * typing the WHOLE trade. Typing "2 @ 600" used to grade on parseFloat → 2 (the
 * size), marking a correct answer wrong. With the lenient parser, entering the
 * full-trade string with the correct side now grades as CORRECT.
 */

afterEach(cleanup);

// Two buys at 600 → net +2 long; break-even is SELL 2 @ 600 (maxLoss 0).
const FILLS: Fill[] = [
  { side: "buy", price: 600, size: 1, round: 2 },
  { side: "buy", price: 600, size: 1, round: 3 },
];

describe("QuizView — break-even grading (BUG 1)", () => {
  it("grades the full-trade string '2 @ 600' with the correct side as correct", () => {
    render(<QuizView fills={FILLS} onFinish={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /^sell$/i }));
    fireEvent.change(screen.getByPlaceholderText(/price per lot/i), {
      target: { value: "2 @ 600" },
    });
    fireEvent.click(screen.getByRole("button", { name: /check answers/i }));

    // The break-even reveal ("SELL 2 @ 600") turns bull-green only when both the
    // side and the parsed price are correct.
    const reveal = screen.getByText("SELL 2 @ 600");
    expect(reveal.className).toContain("text-bull");
    expect(reveal.className).not.toContain("text-bear");
  });

  it("still grades a bare price '600' with the correct side as correct", () => {
    render(<QuizView fills={FILLS} onFinish={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /^sell$/i }));
    fireEvent.change(screen.getByPlaceholderText(/price per lot/i), {
      target: { value: "600" },
    });
    fireEvent.click(screen.getByRole("button", { name: /check answers/i }));

    const reveal = screen.getByText("SELL 2 @ 600");
    expect(reveal.className).toContain("text-bull");
  });
});
