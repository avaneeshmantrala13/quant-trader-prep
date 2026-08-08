// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HintLadder, type SiblingWorked } from "./HintLadder";
import { buildHintLadder } from "@/lib/tutor/hintLadder";
import type { NumericQuestion } from "@/types/content";

/**
 * The rung-3 worked-sibling INVARIANT (header ⇔ steps): the "same kind of
 * problem with different numbers" header must render IF AND ONLY IF a genuine,
 * non-empty worked calculation renders beneath it. When no valid sibling is
 * supplied the rung must be DROPPED (no orphan header) and the ladder must fall
 * back to the next meaningful rung.
 */

afterEach(cleanup);

const q: NumericQuestion = {
  id: "hl-inv-1",
  prompt: "What is the probability?",
  answer: 0.2,
  decimals: 4,
  difficulty: "easy",
  explanation: "It is 0.2 by the complement rule.",
  unit: "",
  commonErrors: [],
};

function ladder() {
  return buildHintLadder({
    question: q,
    chosenValue: 0.19,
    section: "Core Probability",
  });
}

/** The distinctive worked-sibling header wording produced by `buildHintLadder`. */
const HEADER = /worked one step at a time/i;
/** The rung label the view renders for the worked-sibling rung. */
const WORKED_LABEL = /Study a worked sibling/i;

function renderLadder(sw: SiblingWorked | null | undefined) {
  return render(
    <MemoryRouter>
      <HintLadder rungs={ladder()} siblingWorked={sw} controlledRevealed={5} />
    </MemoryRouter>,
  );
}

const validSibling: SiblingWorked = {
  prompt: "A fresh same-family instance with other numbers?",
  steps: [
    "Take the complement: 1 − (5/6)² for these numbers.",
    "Evaluate to reach the sibling's own answer of 0.31.",
  ],
  answer: "0.31",
};

describe("HintLadder rung-3 invariant (header ⇔ non-empty worked steps)", () => {
  it("renders the header AND the worked steps when a valid sibling is supplied", () => {
    renderLadder(validSibling);
    // The rung is present...
    expect(screen.getByText(WORKED_LABEL)).toBeTruthy();
    // ...its header shows...
    expect(screen.getByText(HEADER)).toBeTruthy();
    // ...AND real steps render beneath it.
    expect(screen.getByText(/Take the complement/i)).toBeTruthy();
    expect(screen.getByText(/sibling's own answer of 0\.31/i)).toBeTruthy();
  });

  it("DROPS the rung (no orphan header) when NO sibling is supplied — falls back to the next hint", () => {
    renderLadder(null);
    expect(screen.queryByText(WORKED_LABEL)).toBeNull();
    expect(screen.queryByText(HEADER)).toBeNull();
    // The ladder still discloses the following meaningful rung.
    expect(screen.getByText(/Confront it/i)).toBeTruthy();
    expect(screen.getByText(/Full solution/i)).toBeTruthy();
  });

  it("DROPS the rung when siblingWorked is undefined (e.g. a caller that omits it)", () => {
    renderLadder(undefined);
    expect(screen.queryByText(WORKED_LABEL)).toBeNull();
    expect(screen.queryByText(HEADER)).toBeNull();
  });

  it("DROPS the rung when the sibling has an empty / whitespace-only steps array", () => {
    renderLadder({ prompt: "x?", steps: [], answer: "5" });
    expect(screen.queryByText(WORKED_LABEL)).toBeNull();
    expect(screen.queryByText(HEADER)).toBeNull();

    cleanup();
    renderLadder({ prompt: "x?", steps: ["   ", "\n"], answer: "5" });
    expect(screen.queryByText(WORKED_LABEL)).toBeNull();
    expect(screen.queryByText(HEADER)).toBeNull();
  });

  it("keeps the disclosure count consistent when the rung is dropped (no gap, sequential numbering)", () => {
    renderLadder(null);
    // 5-rung ladder minus the dropped worked-sibling rung ⇒ 4 hints.
    expect(screen.getByText(/Hint 4 \/ 4/i)).toBeTruthy();
    // No visible "Rung 5" gap — numbering is sequential.
    expect(screen.queryByText(/Rung 5 ·/i)).toBeNull();
  });

  it("shows all 5 rungs (worked sibling included) when a valid sibling IS supplied", () => {
    renderLadder(validSibling);
    expect(screen.getByText(/Hint 5 \/ 5/i)).toBeTruthy();
    expect(screen.getByText(WORKED_LABEL)).toBeTruthy();
  });
});
