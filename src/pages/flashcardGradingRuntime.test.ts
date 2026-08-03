// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { emptyProgress, type UserProgress } from "@/types/progress";
import type { ItemAttempt } from "@/types/mastery";
import { topicKeyForLevel } from "@/lib/mastery/topicKey";
import { brainteasersTrack } from "@/content/brainteasers/levels";

/**
 * T7 RUNTIME — the inline flashcard player's COMMIT-THEN-REVEAL flow for
 * gradable brainteasers. We mount the REAL player in jsdom and assert:
 *   • a GRADABLE card gates the reveal behind a committed numeric answer, and
 *     committing emits EXACTLY ONE graded `ItemAttempt` (mode "flashcard") with
 *     the right topicKey / tier / correctness / chosenValue;
 *   • a wrong commit records `correct: false`;
 *   • a NON-gradable (open-ended) card keeps the pure reveal flow and records
 *     NOTHING.
 *
 * Emission is observed by spying `applyItemAttempt` — the single mastery fold
 * `recordItemAttempt` calls — so the count is exactly the number of graded
 * evidences emitted (we never edit the mastery layer, only call it).
 */

let CURRENT: UserProgress = emptyProgress();
vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "t7-runtime",
    loadProgress: () => CURRENT,
    saveProgress: () => {},
    getTheme: () => "dark",
    setTheme: () => {},
    getThemeId: () => "broadsheet",
    setThemeId: () => {},
    logOut: () => {},
    signUp: async () => ({ ok: true }),
    logIn: async () => ({ ok: true }),
  },
}));

// Spy the single mastery fold that `recordItemAttempt` invokes. Preserve the
// real behaviour; only observe call count + the ItemAttempt payload.
vi.mock("@/lib/mastery/mastery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mastery/mastery")>();
  return { ...actual, applyItemAttempt: vi.fn(actual.applyItemAttempt) };
});

// eslint-disable-next-line import/first
import { applyItemAttempt } from "@/lib/mastery/mastery";
// eslint-disable-next-line import/first
import App from "@/App";

const applySpy = applyItemAttempt as unknown as ReturnType<typeof vi.fn>;

const btTrack = brainteasersTrack;
const bt1 = btTrack.levels[0]; // "bt-1", section "Core Puzzles", difficulty "easy"
const TOPIC = topicKeyForLevel(btTrack.id, bt1);

/** Committed `ItemAttempt`s (3rd arg to each applyItemAttempt call). */
function emittedAttempts(): ItemAttempt[] {
  return applySpy.mock.calls.map((c) => c[2] as ItemAttempt);
}

function baseProgress(): UserProgress {
  const p = emptyProgress();
  p.diagnosticDoneAt = "2020-01-01T00:00:00.000Z";
  return p;
}

function mount() {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [`/track/${btTrack.id}/level/${bt1.id}`] },
      createElement(App),
    ),
  );
}

beforeEach(() => {
  applySpy.mockClear();
});
afterEach(cleanup);

describe("gradable brainteaser flashcard — commit-then-reveal", () => {
  it("gates the reveal, then a CORRECT commit emits exactly one flashcard ItemAttempt", () => {
    CURRENT = baseProgress();
    const { container } = mount();

    // Enter the deck.
    fireEvent.click(screen.getByRole("button", { name: /Start Flashcards/i }));

    // The first warm-up (bt-ropes, answer 45) is gradable ⇒ commit gates reveal.
    const input = screen.getByLabelText("Your numeric answer");
    expect(input).toBeTruthy();
    // No self-serve reveal button on a gradable card, and the prose answer is hidden.
    expect(screen.queryByRole("button", { name: /Reveal answer/i })).toBeNull();
    expect(container.innerHTML.includes("Light rope A at BOTH ends")).toBe(false);
    // Nothing recorded before committing.
    expect(applySpy).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: /Commit & reveal/i }));

    // Exactly one graded evidence, mode "flashcard", correct topic/tier/value.
    const attempts = emittedAttempts();
    expect(attempts.length).toBe(1);
    expect(attempts[0].mode).toBe("flashcard");
    expect(attempts[0].topicKey).toBe(TOPIC);
    expect(attempts[0].tier).toBe(bt1.difficulty);
    expect(attempts[0].correct).toBe(true);
    expect(attempts[0].chosenValue).toBe(45);

    // The answer is now revealed.
    expect(container.innerHTML.includes("Light rope A at BOTH ends")).toBe(true);
  });

  it("a WRONG commit records correct: false with the committed value", () => {
    CURRENT = baseProgress();
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Start Flashcards/i }));

    const input = screen.getByLabelText("Your numeric answer");
    fireEvent.change(input, { target: { value: "44" } });
    fireEvent.click(screen.getByRole("button", { name: /Commit & reveal/i }));

    const attempts = emittedAttempts();
    expect(attempts.length).toBe(1);
    expect(attempts[0].correct).toBe(false);
    expect(attempts[0].chosenValue).toBe(44);
    expect(attempts[0].mode).toBe("flashcard");
  });

  it("a NON-gradable (open-ended) card keeps the pure reveal flow and records NOTHING", () => {
    // Resume directly on bt-switches (index 4, gradable:false) by marking the
    // four earlier warm-ups as already understood.
    const p = baseProgress();
    const earlier = (bt1.flashcards ?? []).slice(0, 4).map((c) => c.id);
    p.levelProgress[bt1.id] = {
      bestScore: 0,
      mastered: false,
      attempts: 0,
      understood: earlier,
    };
    CURRENT = p;
    const { container } = mount();

    fireEvent.click(screen.getByRole("button", { name: /Start Flashcards/i }));

    // Pure reveal flow: a Reveal button exists, no commit input.
    expect(screen.queryByLabelText("Your numeric answer")).toBeNull();
    const reveal = screen.getByRole("button", { name: /Reveal answer/i });
    fireEvent.click(reveal);

    // Answer revealed (heat-as-a-signal switch puzzle) but NO graded evidence.
    expect(container.innerHTML.includes("heat")).toBe(true);
    expect(applySpy).not.toHaveBeenCalled();
  });
});
