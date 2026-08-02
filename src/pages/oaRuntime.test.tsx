// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import {
  BLITZ_FORMAT,
  DEEP_SET_FORMAT,
  DERIVATION_FORMAT,
  MEASURED_FORMAT,
  RAPID_BATTERY_FORMAT,
  SECTION_FORMAT,
  SPRINT_FORMAT,
} from "@/lib/oa/config";
import { createOaSession } from "@/lib/oa/timedSession";
import {
  drawOaQuestions,
  drawOaQuestionsForFormat,
} from "@/lib/oa/questionPool";
import type { OaSessionState } from "@/lib/oa/types";
import { OaRunner } from "@/components/oa/OaRunner";

/**
 * Runtime servability of the Timed OA runner. These exercise OaRunner directly
 * with hand-built sessions (the component is fully controlled via props, so it
 * needs neither the page nor the ProgressContext to render/behave). The pure
 * engine is unit-tested separately; here we only assert the UI wires to it.
 */

afterEach(cleanup);

/** A tiny controlled host: mirrors the page's `onChange = setSession` wiring. */
function Harness({
  initial,
  onFinish,
}: {
  initial: OaSessionState;
  onFinish: (s: OaSessionState) => void;
}) {
  const [session, setSession] = useState<OaSessionState>(initial);
  return (
    <OaRunner session={session} onChange={setSession} onFinish={onFinish} />
  );
}

/** The 4 selectable choice buttons carry `aria-pressed`. */
function choiceButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]"),
  );
}

const MMSS = /^\d{1,2}:\d{2}$/;

describe("OaRunner — SPRINT", () => {
  it("renders the prompt + choices + a per-question countdown, and a choice advances", () => {
    const session = createOaSession(SPRINT_FORMAT, drawOaQuestions(1, 3), {
      nowTs: Date.now(),
    });
    const onFinish = vi.fn();
    const { container } = render(
      <Harness initial={session} onFinish={onFinish} />,
    );

    // Prompt of the first question is shown.
    expect(screen.getByText(session.questions[0].prompt)).toBeTruthy();
    // Four selectable choices.
    expect(choiceButtons(container)).toHaveLength(4);
    // A mm:ss per-question countdown (90s ⇒ "1:30").
    expect(screen.getAllByText(MMSS).length).toBeGreaterThan(0);
    // First question index label.
    expect(screen.getByText("1 / 3")).toBeTruthy();

    // Selecting a choice auto-advances (sprint).
    fireEvent.click(choiceButtons(container)[0]);
    expect(screen.getByText("2 / 3")).toBeTruthy();
    expect(onFinish).not.toHaveBeenCalled();
  });
});

describe("OaRunner — SECTION", () => {
  it("renders the section clock + free-navigation controls", () => {
    const session = createOaSession(SECTION_FORMAT, drawOaQuestions(2, 4), {
      nowTs: Date.now(),
    });
    const onFinish = vi.fn();
    const { container } = render(
      <Harness initial={session} onFinish={onFinish} />,
    );

    // The running section clock (30:00) and its label.
    expect(screen.getByText("Section time")).toBeTruthy();
    expect(screen.getAllByText(MMSS).length).toBeGreaterThan(0);
    // Free navigation: prev / next + submit.
    expect(screen.getByText("Previous")).toBeTruthy();
    expect(screen.getByText("Next")).toBeTruthy();
    expect(screen.getByText("Submit section")).toBeTruthy();
    // Four choice buttons for the current question.
    expect(choiceButtons(container)).toHaveLength(4);

    // Next advances the index without finishing.
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("2 / 4")).toBeTruthy();
    expect(onFinish).not.toHaveBeenCalled();
  });
});

describe("OaRunner — MEASURED", () => {
  it("renders untimed (no section clock) and Finish submits", () => {
    const session = createOaSession(MEASURED_FORMAT, drawOaQuestions(3, 3), {
      nowTs: Date.now(),
    });
    const onFinish = vi.fn();
    render(<Harness initial={session} onFinish={onFinish} />);

    // No section countdown clock in measured mode.
    expect(screen.queryByText("Section time")).toBeNull();
    expect(screen.getByText(session.questions[0].prompt)).toBeTruthy();

    // Finish ends the session (submitted).
    fireEvent.click(screen.getByText("Finish"));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0][0].status).toBe("submitted");
  });
});

describe("OaRunner — RAPID MIXED BATTERY (Citadel-style sprint)", () => {
  it("renders a ~15s per-question countdown and a choice auto-advances", () => {
    const session = createOaSession(
      RAPID_BATTERY_FORMAT,
      drawOaQuestionsForFormat(RAPID_BATTERY_FORMAT, 5, 4),
      { nowTs: Date.now() },
    );
    const onFinish = vi.fn();
    const { container } = render(
      <Harness initial={session} onFinish={onFinish} />,
    );
    // 15s per-question clock ⇒ "0:15".
    expect(screen.getByText("0:15")).toBeTruthy();
    expect(screen.getByText("1 / 4")).toBeTruthy();
    // Selecting a choice auto-advances (sprint), never going back.
    fireEvent.click(choiceButtons(container)[0]);
    expect(screen.getByText("2 / 4")).toBeTruthy();
    expect(onFinish).not.toHaveBeenCalled();
  });
});

describe("OaRunner — BLITZ (Five Rings-style free-nav section)", () => {
  it("renders a section clock + free navigation controls", () => {
    const session = createOaSession(
      BLITZ_FORMAT,
      drawOaQuestionsForFormat(BLITZ_FORMAT, 6, 4),
      { nowTs: Date.now() },
    );
    render(<Harness initial={session} onFinish={vi.fn()} />);
    expect(screen.getByText("Section time")).toBeTruthy();
    expect(screen.getByText("Previous")).toBeTruthy();
    expect(screen.getByText("Next")).toBeTruthy();
    expect(screen.getByText("Submit section")).toBeTruthy();
  });
});

describe("OaRunner — DEEP SET (DRW-style free-nav section)", () => {
  it("renders a section clock + free navigation controls", () => {
    const session = createOaSession(
      DEEP_SET_FORMAT,
      drawOaQuestionsForFormat(DEEP_SET_FORMAT, 7, 4),
      { nowTs: Date.now() },
    );
    render(<Harness initial={session} onFinish={vi.fn()} />);
    expect(screen.getByText("Section time")).toBeTruthy();
    expect(screen.getByText("Next")).toBeTruthy();
  });
});

describe("OaRunner — DERIVATION SET (IMC-style module-locked section)", () => {
  it("is forward-only: shows a module-lock notice + 'Next question', no Previous/palette", () => {
    const session = createOaSession(
      DERIVATION_FORMAT,
      drawOaQuestionsForFormat(DERIVATION_FORMAT, 8, 4),
      { nowTs: Date.now() },
    );
    const onFinish = vi.fn();
    render(<Harness initial={session} onFinish={onFinish} />);

    // A single running section clock, not a per-question sprint clock.
    expect(screen.getByText("Section time")).toBeTruthy();
    // Module-lock affordances: no free-nav back button, a forward-only advance.
    expect(screen.getByText(/Module-locked/i)).toBeTruthy();
    expect(screen.queryByText("Previous")).toBeNull();
    expect(screen.getByText("Next question →")).toBeTruthy();
    expect(screen.getByText("1 / 4")).toBeTruthy();

    // Advancing moves forward without finishing.
    fireEvent.click(screen.getByText("Next question →"));
    expect(screen.getByText("2 / 4")).toBeTruthy();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("shows 'Submit section' (not 'Next question') on the final question", () => {
    const session = createOaSession(
      DERIVATION_FORMAT,
      drawOaQuestionsForFormat(DERIVATION_FORMAT, 9, 3),
      { nowTs: Date.now() },
    );
    render(<Harness initial={session} onFinish={vi.fn()} />);
    // Walk forward to the last question (module-locked = forward-only).
    fireEvent.click(screen.getByText("Next question →"));
    fireEvent.click(screen.getByText("Next question →"));
    expect(screen.getByText("3 / 3")).toBeTruthy();
    expect(screen.getByText("Submit section")).toBeTruthy();
    expect(screen.queryByText("Next question →")).toBeNull();
  });
});

describe("OaRunner — reload/resume of an expired section", () => {
  it("auto-submits (expired) on mount when the deadline already passed", async () => {
    // Started 40 min ago ⇒ its 30-min deadline is 10 min in the past.
    const session = createOaSession(SECTION_FORMAT, drawOaQuestions(4, 3), {
      nowTs: Date.now() - 40 * 60 * 1000,
    });
    expect(session.status).toBe("running");

    const onFinish = vi.fn();
    render(
      <OaRunner session={session} onChange={() => {}} onFinish={onFinish} />,
    );

    await waitFor(() => expect(onFinish).toHaveBeenCalled());
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0][0].status).toBe("expired");
  });
});
