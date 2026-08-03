// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import { ArbitragePage } from "./ArbitragePage";

// jsdom lacks matchMedia; ThemeProvider probes prefers-color-scheme on mount.
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
});

/**
 * Runtime servability of the self-contained Arbitrage drill page. The pure
 * drawing/grading engine is unit-tested separately (`engine.test.ts`); here we
 * only assert the page mounts, starts, drives through every problem (quiz OR
 * numeric), and lands on the summary — proving the UI wires to the engine.
 */

afterEach(cleanup);

function renderPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <ArbitragePage />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("ArbitragePage", () => {
  it("renders the intro with the booksum rule", () => {
    renderPage();
    expect(screen.getByText(/Strip the vig/i)).toBeTruthy();
    expect(screen.getByText(/⇒ arbitrage/)).toBeTruthy();
  });

  it("drives from intro through all problems to the scorecard", () => {
    const { container } = renderPage();
    fireEvent.click(screen.getByText(/Start Drilling/i));

    // Walk every problem: answer whichever mode is shown, then advance.
    for (let step = 0; step < 8; step++) {
      const input = container.querySelector<HTMLInputElement>(
        'input[inputmode="decimal"]',
      );
      if (input && !input.disabled) {
        fireEvent.change(input, { target: { value: "1" } });
        fireEvent.click(screen.getByText(/Lock In/i));
      } else {
        const choices = Array.from(
          container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]"),
        );
        expect(choices.length).toBe(4);
        fireEvent.click(choices[0]);
      }
      // Advance (either "Next Problem" or, on the last, "See Results").
      const advance = screen.getByText(/Next Problem|See Results/i);
      fireEvent.click(advance);
    }

    expect(screen.getByText(/Arbitrage Scorecard/i)).toBeTruthy();
    expect(screen.getByText(/Accuracy/i)).toBeTruthy();
  });
});
