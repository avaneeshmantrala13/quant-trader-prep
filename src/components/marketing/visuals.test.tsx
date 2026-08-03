// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as visuals from "./visuals";
import { HintLadderVisual } from "./visuals";

afterEach(cleanup);

describe("HintLadderVisual (accurate feature representation)", () => {
  it("depicts the real 5-rung answer-withholding hint ladder", () => {
    render(<HintLadderVisual />);
    expect(screen.getByText("The Hint Ladder")).toBeTruthy();
    // The four coaching rungs, in order — matching src/lib/tutor/hintLadder.ts.
    expect(screen.getByText(/Name the trap/i)).toBeTruthy();
    expect(screen.getByText(/Make a plan of attack/i)).toBeTruthy();
    expect(screen.getByText(/Study a worked sibling/i)).toBeTruthy();
    expect(screen.getByText(/Confront it/i)).toBeTruthy();
    // Rung 5 is the withheld full solution.
    expect(screen.getByText(/Full solution/i)).toBeTruthy();
    expect(screen.getByText(/revealed only after you've tried/i)).toBeTruthy();
  });

  it("does NOT misrepresent the product as a conversational Socratic tutor", () => {
    render(<HintLadderVisual />);
    expect(screen.queryByText(/Socratic/i)).toBeNull();
    expect(screen.queryByText(/^Tutor$/)).toBeNull();
    // The retired chat visual export is gone.
    expect("TutorVisual" in visuals).toBe(false);
  });
});

describe("landing marketing visuals map to real features", () => {
  it("curriculum coverage lists only real, playable tracks", () => {
    render(
      <MemoryRouter>
        <visuals.CurriculumVisual />
      </MemoryRouter>,
    );
    expect(screen.getByText("Probability")).toBeTruthy();
    expect(screen.getByText("Mental Math")).toBeTruthy();
    expect(screen.getByText("Brainteasers")).toBeTruthy();
    expect(screen.getByText("Interview Games")).toBeTruthy();
  });
});
