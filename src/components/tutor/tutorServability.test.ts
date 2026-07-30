import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createElement } from "react";
import { emptyProgress, type UserProgress } from "@/types/progress";
import { probabilityTrack } from "@/content/probability/levels";
import { groupLevelsIntoTopics } from "@/lib/topics";

/**
 * REGRESSION (lesson servability): a learner must ALWAYS be able to start a
 * level and reach its questions. The adaptive tutor prologue
 * (`TutorController`) builds a worked-example from a FRESH parametric sibling;
 * STATIC-pool levels (hand-authored `questions`/`numericQuestions`, no
 * generator — e.g. "Hard Interview Problems", "Lattice Paths & Collisions")
 * have no such sibling, so `generateFreshQuestion` returns null. The prologue
 * used to `return null` for those in the worked/faded phases, rendering a
 * COMPLETELY BLANK lesson with no Start button and no questions — a hard
 * progression lock-out ("the section shows no questions / no way to get
 * questions"). The fix falls back to the level's own briefing + a Start action.
 *
 * This renders EVERY playable quiz/numeric level's lesson intro with a FRESH
 * topic (θ=0, n=0 ⇒ the "worked" phase, the previously-broken path) and asserts
 * a way forward is present — no blank screen.
 */

let CURRENT: UserProgress = emptyProgress();
vi.mock("@/lib/storage", () => ({
  storage: {
    getSession: () => "repro",
    loadProgress: () => CURRENT,
    saveProgress: () => {},
    getTheme: () => "dark",
    setTheme: () => {},
    getThemeId: () => "cyberpunk",
    setThemeId: () => {},
    logOut: () => {},
    signUp: async () => ({ ok: true }),
    logIn: async () => ({ ok: true }),
  },
}));

// eslint-disable-next-line import/first
import App from "@/App";

const track = probabilityTrack;

/** Unlock the target level by mastering everything before it; keep its topic fresh. */
function unlockThrough(levelId: string): UserProgress {
  const p = emptyProgress();
  p.diagnosticDoneAt = "2020-01-01T00:00:00.000Z";
  const idx = track.levels.findIndex((l) => l.id === levelId);
  for (let i = 0; i < idx; i++) {
    p.levelProgress[track.levels[i].id] = {
      bestScore: 1,
      mastered: true,
      attempts: 1,
    };
  }
  return p; // no topicMastery ⇒ θ=0, n=0 ⇒ "worked" phase
}

function renderLessonIntro(levelId: string): string {
  CURRENT = unlockThrough(levelId);
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [`/track/${track.id}/level/${levelId}`] },
      createElement(App),
    ),
  );
}

/** A lesson intro offers a way forward when a start/continue/answer affordance exists. */
function offersWayForward(html: string): boolean {
  return /Start|Continue|Reveal|Submit|Question 0/i.test(html);
}

describe("every playable level's fresh lesson intro is servable (no blank screen)", () => {
  const playable = track.levels.filter((l) => l.mode !== "flashcard");

  for (const level of playable) {
    it(`${level.id} (${level.section ?? "-"}) offers a way to start`, () => {
      const html = renderLessonIntro(level.id);
      expect(offersWayForward(html), `${level.id} rendered a blank lesson`).toBe(
        true,
      );
    });
  }

  it("the static-pool interview levels specifically show the Start fallback", () => {
    // These have no parametric generator — the previously-broken path.
    for (const id of ["pr-4", "pr-5"]) {
      const level = track.levels.find((l) => l.id === id)!;
      expect(level.generator, `${id} unexpectedly has a generator`).toBeUndefined();
      const html = renderLessonIntro(id);
      expect(html).toContain("Start Practice");
    }
  });

  it("first level of every section is servable from a fresh profile", () => {
    const topics = groupLevelsIntoTopics(track.levels);
    for (const t of topics) {
      const first = track.levels[t.startIndex];
      if (first.mode === "flashcard") continue;
      const html = renderLessonIntro(first.id);
      expect(offersWayForward(html), `first-of-section ${first.id} blank`).toBe(
        true,
      );
    }
  });
});
