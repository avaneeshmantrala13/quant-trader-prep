// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { emptyProgress, type UserProgress } from "@/types/progress";
import type { TopicMastery } from "@/types/mastery";
import { PLAYABLE_TRACKS } from "@/content";
import { topicKeyForLevel } from "@/lib/mastery/topicKey";
import { isFlashcardLevel } from "@/types/content";
import type { Level, Track } from "@/types/content";

/**
 * REGISTRY-WIDE RUNTIME GUARD — "a click on an unlocked lesson is NEVER blank".
 *
 * This is the strongest anti-regression net for the class of bug that shipped a
 * BLANK lesson working area (header + theme chrome render, but `<main>` is empty)
 * for Mental Math / Probability lessons after the MCQ→free-response conversion.
 *
 * Why the previous `tutorServability.test.ts` MISSED it: that test renders with
 * `renderToStaticMarkup` (SSR), which NEVER runs effects. The blank-lesson bug
 * was a runtime effect-ordering race — the numeric/quiz player's mount effect
 * unconditionally set the `"lesson"` phase, clobbering `TutorController`'s
 * one-shot auto-`onStart()` for `independent` learners (θ high, n≥2), stranding
 * them on a phase where `TutorController` renders `null`. SSR can't see it.
 *
 * This test therefore mounts the REAL player in jsdom (effects DO run), for
 * EVERY playable level in EVERY track, in EVERY mode (quiz MCQ, numeric,
 * free-response, flashcard), and across the THREE learner states that reach the
 * players by different paths:
 *   - fresh      (θ=0,  n=0)  ⇒ tutor "worked"      (worked-example prologue)
 *   - rising     (θ=0,  n=6)  ⇒ tutor "faded"       (completion prologue)
 *   - independent(θ=1.5,n=20) ⇒ tutor "independent" (skips straight to questions)
 * and asserts `<main>` contains non-empty INTERACTIVE content (an intro with a
 * Start affordance, or a live question/prompt) — i.e. never blank — and that the
 * render did not throw.
 */

let CURRENT: UserProgress = emptyProgress();
let THEME_ID = "cyberpunk";
vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "runtime-guard",
    loadProgress: () => CURRENT,
    saveProgress: () => {},
    getTheme: () => "dark",
    setTheme: () => {},
    getThemeId: () => THEME_ID,
    setThemeId: () => {},
    logOut: () => {},
    signUp: async () => ({ ok: true }),
    logIn: async () => ({ ok: true }),
  },
}));

// eslint-disable-next-line import/first
import App from "@/App";

type LearnerState = "fresh" | "rising" | "independent";

function masteryFor(state: LearnerState): TopicMastery | null {
  if (state === "fresh") return null; // θ=0, n=0 ⇒ "worked"
  if (state === "rising") {
    return {
      theta: 0,
      n: 6,
      alpha: 4,
      beta: 4,
      lastSeen: "2020-01-01T00:00:00.000Z",
      misconceptions: {},
    };
  }
  return {
    theta: 1.5,
    n: 20,
    alpha: 18,
    beta: 3,
    lastSeen: "2020-01-01T00:00:00.000Z",
    misconceptions: {},
  };
}

/** Unlock `level` by mastering every earlier level in the track; seed its topic. */
function buildProgress(
  track: Track,
  level: Level,
  state: LearnerState,
): UserProgress {
  const p = emptyProgress();
  p.diagnosticDoneAt = "2020-01-01T00:00:00.000Z";
  const idx = track.levels.findIndex((l) => l.id === level.id);
  for (let i = 0; i < idx; i++) {
    p.levelProgress[track.levels[i].id] = {
      bestScore: 1,
      mastered: true,
      attempts: 1,
    };
  }
  const m = masteryFor(state);
  if (m) p.topicMastery = { [topicKeyForLevel(track.id, level)]: m };
  return p;
}

/**
 * Mount the real lesson player and return the inner HTML of its `<main>`.
 *
 * Routes are code-split (React.lazy in `App.tsx`), so the page chunk resolves a
 * microtask AFTER mount — the first synchronous render only paints the Suspense
 * fallback. We therefore `waitFor` the lazy boundary to settle: the standalone
 * player routes render their own `<main>`, so its appearance is the signal the
 * chunk has loaded and effects have run. (`waitFor` wraps each poll in `act`, so
 * this also flushes the player's mount effects.)
 */
async function mountMain(track: Track, level: Level): Promise<string> {
  const { container } = render(
    createElement(
      MemoryRouter,
      { initialEntries: [`/track/${track.id}/level/${level.id}`] },
      createElement(App),
    ),
  );
  // 5s timeout: under full-suite parallelism the first dynamic import() has to
  // transform the (large) LessonPage chunk, which can exceed waitFor's 1s default.
  await waitFor(
    () => {
      if (!container.querySelector("main")) throw new Error("lazy chunk pending");
    },
    { timeout: 5000 },
  );
  const main = container.querySelector("main");
  return main ? main.innerHTML : `__NO_MAIN__:${container.innerHTML.slice(0, 200)}`;
}

/**
 * A served lesson exposes at least one way to engage: a Start/Continue on an
 * intro/worked/faded prologue, OR a live question/prompt (numeric/quiz/flashcard).
 */
function offersInteraction(mainHtml: string): boolean {
  return /Start|Continue|Reveal|Submit|Question\s*\d|Your answer|Your stake|Fill in the missing step|Worked Example|I've studied this|Ready — start/i.test(
    mainHtml,
  );
}

afterEach(cleanup);

describe("every level, every mode, every learner state renders a working (non-blank) lesson", () => {
  const states: LearnerState[] = ["fresh", "rising", "independent"];

  for (const track of PLAYABLE_TRACKS) {
    for (const level of track.levels) {
      // Flashcard levels have no tutor-phase branch; one mount per is enough.
      const levelStates = isFlashcardLevel(level) ? (["fresh"] as LearnerState[]) : states;
      for (const state of levelStates) {
        it(`${track.id}/${level.id} (${level.mode ?? "quiz"}) — ${state}`, async () => {
          CURRENT = buildProgress(track, level, state);
          const main = await mountMain(track, level);
          expect(main.startsWith("__NO_MAIN__"), `no <main> for ${level.id}`).toBe(
            false,
          );
          expect(
            main.length > 40 && offersInteraction(main),
            `BLANK/dead lesson for ${track.id}/${level.id} [${state}]: ${main.slice(0, 300)}`,
          ).toBe(true);
        });
      }
    }
  }
});

describe("standalone drill routes render (Speed Arena, Fermi) — never blank", () => {
  // Routes are lazy (see `mountMain`), so wait for the page to paint before
  // reading the DOM — the first render is only the Suspense fallback (`null`).
  // These standalone routes (Fermi, Speed Arena) don't all render a `<main>`, so
  // we gate on the container growing past the empty fallback shell instead.
  async function mountRoute(path: string): Promise<string> {
    const { container } = render(
      createElement(
        MemoryRouter,
        { initialEntries: [path] },
        createElement(App),
      ),
    );
    await waitFor(
      () => {
        if (container.innerHTML.length < 200) {
          throw new Error("lazy chunk pending");
        }
      },
      { timeout: 5000 },
    );
    return container.innerHTML;
  }

  it("/fermi renders its intro with a Start affordance", async () => {
    CURRENT = (() => {
      const p = emptyProgress();
      p.diagnosticDoneAt = "2020-01-01T00:00:00.000Z";
      return p;
    })();
    const html = await mountRoute("/fermi");
    expect(html.length > 200 && /Fermi|Estimat|Start|Begin/i.test(html)).toBe(true);
  });

  it("/arena renders its preset picker / start affordance", async () => {
    CURRENT = (() => {
      const p = emptyProgress();
      p.diagnosticDoneAt = "2020-01-01T00:00:00.000Z";
      return p;
    })();
    const html = await mountRoute("/arena");
    expect(html.length > 200 && /Arena|Preset|Start|Begin|Play/i.test(html)).toBe(
      true,
    );
  });
});

describe("theme chrome renders the player on default + cyberpunk (spot-check)", () => {
  const samples: Array<[string, string]> = [
    ["mental-math", "mm-1"],
    ["probability", "pr-1"],
    ["probability", "pr-4"], // static-pool numeric
    ["brainteasers", ""], // filled below
  ];
  // Resolve a flashcard sample dynamically (first brainteaser level).
  const bt = PLAYABLE_TRACKS.find((t) => t.id === "brainteasers");
  if (bt && bt.levels[0]) samples[3] = ["brainteasers", bt.levels[0].id];

  beforeEach(() => {
    THEME_ID = "cyberpunk";
  });
  afterEach(() => {
    THEME_ID = "cyberpunk";
  });

  // "broadsheet" is the default theme; "cyberpunk" is the one in the bug report.
  for (const themeId of ["broadsheet", "cyberpunk"]) {
    for (const [trackId, levelId] of samples) {
      if (!levelId) continue;
      it(`${themeId} · ${trackId}/${levelId} renders interactive content`, async () => {
        THEME_ID = themeId;
        const track = PLAYABLE_TRACKS.find((t) => t.id === trackId)!;
        const level = track.levels.find((l) => l.id === levelId)!;
        CURRENT = buildProgress(track, level, "independent");
        const main = await mountMain(track, level);
        expect(
          main.length > 40 && offersInteraction(main),
          `theme ${themeId} blank for ${trackId}/${levelId}: ${main.slice(0, 200)}`,
        ).toBe(true);
      });
    }
  }
});
