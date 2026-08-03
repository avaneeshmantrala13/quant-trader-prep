import { describe, expect, it } from "vitest";
import {
  COURSE_ONBOARDING_TOUR_STEPS,
  ONBOARDING_TOUR_STEPS,
  onboardingStepsForMode,
  type TourTarget,
} from "./steps";

/**
 * The tour anchors steps to elements via `data-tour` hooks (wired in
 * `AppShell`). `menu` is the hamburger button; the rest are items inside the
 * menu it opens. Guard the step → target mapping so a renamed/removed hook can't
 * silently break the coach-mark anchoring. Keep this in sync with the
 * `data-tour` attributes rendered in the shell.
 */
const KNOWN_TARGETS: TourTarget[] = [
  "menu",
  "dashboard",
  "probability",
  "contents",
  "simulations",
  "games",
  "trading-floor",
  "arena",
  "timed-oa",
  "mock",
  "verified-bank",
  "community",
  "recalibrate",
  "themes",
];

describe("ONBOARDING_TOUR_STEPS", () => {
  it("is a non-empty, ordered script that starts on the welcome and ends on a wrap-up", () => {
    expect(ONBOARDING_TOUR_STEPS.length).toBeGreaterThanOrEqual(3);
    expect(ONBOARDING_TOUR_STEPS[0].id).toBe("welcome");
    expect(ONBOARDING_TOUR_STEPS[ONBOARDING_TOUR_STEPS.length - 1].id).toBe(
      "done",
    );
  });

  it("has unique ids and non-empty title + body for every step", () => {
    const ids = new Set<string>();
    for (const step of ONBOARDING_TOUR_STEPS) {
      expect(step.id).toBeTruthy();
      expect(ids.has(step.id)).toBe(false);
      ids.add(step.id);
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.body.trim().length).toBeGreaterThan(0);
    }
  });

  it("only anchors to known target hooks, and each target is used at most once", () => {
    const seen = new Set<TourTarget>();
    for (const step of ONBOARDING_TOUR_STEPS) {
      if (step.target === undefined) continue;
      expect(KNOWN_TARGETS).toContain(step.target);
      // Every anchor points at a distinct element — no two boxes fight over
      // the same hook.
      expect(seen.has(step.target)).toBe(false);
      seen.add(step.target);
    }
  });

  it("leaves the welcome + wrap-up steps centered (no anchor) and anchors the middle steps", () => {
    const first = ONBOARDING_TOUR_STEPS[0];
    const last = ONBOARDING_TOUR_STEPS[ONBOARDING_TOUR_STEPS.length - 1];
    expect(first.target).toBeUndefined();
    expect(last.target).toBeUndefined();

    const middle = ONBOARDING_TOUR_STEPS.slice(1, -1);
    expect(middle.length).toBeGreaterThan(0);
    for (const step of middle) {
      expect(step.target).toBeTruthy();
    }
  });

  it("introduces the hamburger menu before anchoring to items inside it", () => {
    const ids = ONBOARDING_TOUR_STEPS.map((s) => s.id);
    const menuIdx = ids.indexOf("menu");
    expect(menuIdx).toBeGreaterThan(0);
    // The menu step must precede every step that targets a menu ITEM (i.e. any
    // anchored step other than the menu button itself), so the shell has been
    // introduced before the tour starts opening it.
    ONBOARDING_TOUR_STEPS.forEach((step, i) => {
      if (step.target && step.target !== "menu") {
        expect(i).toBeGreaterThan(menuIdx);
      }
    });
  });

  it("maps each step id to the expected anchor target", () => {
    const byId = Object.fromEntries(
      ONBOARDING_TOUR_STEPS.map((s) => [s.id, s.target]),
    );
    expect(byId.welcome).toBeUndefined();
    expect(byId.menu).toBe("menu");
    expect(byId.dashboard).toBe("dashboard");
    expect(byId.probability).toBe("probability");
    expect(byId.tracks).toBe("contents");
    expect(byId.simulations).toBe("simulations");
    expect(byId.games).toBe("games");
    expect(byId["trading-floor"]).toBe("trading-floor");
    expect(byId.arena).toBe("arena");
    expect(byId.timed).toBe("timed-oa");
    expect(byId.mock).toBe("mock");
    expect(byId["verified-bank"]).toBe("verified-bank");
    expect(byId.community).toBe("community");
    expect(byId.recalibrate).toBe("recalibrate");
    expect(byId.themes).toBe("themes");
    expect(byId.done).toBeUndefined();
  });

  it("teaches the Wave-1 features a new interview-prep user must know", () => {
    const joined = ONBOARDING_TOUR_STEPS.map(
      (s) => `${s.title}\n${s.body}`,
    ).join("\n");
    // The header mode toggle + both modes.
    expect(joined).toContain("Interview prep");
    expect(joined).toContain("Course mastery");
    // The competitive surfaces + the unified leaderboard that ranks them.
    expect(joined).toContain("Quant Games");
    expect(joined).toContain("Trading Floor");
    expect(joined).toContain("Speed Arena");
    expect(joined).toContain("Leaderboard");
    // Timed / assessment surfaces + the AI mock.
    expect(joined).toContain("Timed Sections");
    expect(joined).toContain("Mock Interview");
    // The new drills that feed the timed pool.
    expect(joined).toContain("Arbitrage & De-vig");
    expect(joined).toContain("EV Under Time");
    // Trusted-content surfaces.
    expect(joined).toContain("Verified Bank");
    expect(joined).toContain("Community");
    // Weak-spot practice.
    expect(joined).toContain("weak-spot");
  });
});

describe("onboardingStepsForMode", () => {
  it("selects the course-mastery script in course mode and the original otherwise", () => {
    expect(onboardingStepsForMode("course")).toBe(COURSE_ONBOARDING_TOUR_STEPS);
    // Interview / default mode keeps the original interview tour EXACTLY.
    expect(onboardingStepsForMode("interview")).toBe(ONBOARDING_TOUR_STEPS);
  });
});

describe("COURSE_ONBOARDING_TOUR_STEPS (Case A · course mastery)", () => {
  const joinedCopy = COURSE_ONBOARDING_TOUR_STEPS.map(
    (s) => `${s.title}\n${s.body}`,
  ).join("\n");

  it("mirrors the interview tour's shape: same step ids, order, and anchors", () => {
    expect(COURSE_ONBOARDING_TOUR_STEPS.map((s) => s.id)).toEqual(
      ONBOARDING_TOUR_STEPS.map((s) => s.id),
    );
    expect(COURSE_ONBOARDING_TOUR_STEPS.map((s) => s.target)).toEqual(
      ONBOARDING_TOUR_STEPS.map((s) => s.target),
    );
  });

  it("has non-empty, unique-id, course-focused copy that differs from the interview tour", () => {
    const ids = new Set<string>();
    COURSE_ONBOARDING_TOUR_STEPS.forEach((step, i) => {
      expect(ids.has(step.id)).toBe(false);
      ids.add(step.id);
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.body.trim().length).toBeGreaterThan(0);
      // The body copy is genuinely rewritten for at least the framing steps.
      if (step.id === "welcome" || step.id === "done") {
        expect(step.body).not.toBe(ONBOARDING_TOUR_STEPS[i].body);
      }
    });
  });

  it("orients the learner to the two course tracks", () => {
    expect(joinedCopy).toContain("Intro to Probability");
    expect(joinedCopy).toContain("Intro to Stochastic Processes");
    // Course-mastery navigation landmarks that actually exist in Case A.
    expect(joinedCopy).toContain("Course Readiness");
    expect(joinedCopy).toContain("Foundations");
    expect(joinedCopy).toContain("Beyond the course");
    // The mode toggle used to switch goals.
    expect(joinedCopy).toContain("Course mastery");
  });

  it("drops all quant-trader framing and Case-B-only menu references", () => {
    // No "become a quant trader" / quant-interview framing.
    expect(joinedCopy).not.toMatch(/quant/i);
    expect(joinedCopy).not.toMatch(/become a trader/i);
    // The standalone "Probability & Statistics" track is not in the Case-A menu.
    expect(joinedCopy).not.toContain("Probability & Statistics");
    expect(joinedCopy).not.toContain("Fermi Drill");
  });

  it("still surfaces the Wave-1 extras — but framed as OPTIONAL beyond-the-course items", () => {
    // The competitive/assessment surfaces are taught, just de-emphasized. The
    // leaderboard is covered in-body (it has no nav anchor of its own).
    expect(joinedCopy).toContain("Leaderboard");
    expect(joinedCopy).toContain("Trading Floor");
    expect(joinedCopy).toContain("Speed Arena");
    expect(joinedCopy).toContain("Timed Sections");
    expect(joinedCopy).toContain("Mock Interview");
    expect(joinedCopy).toContain("Verified Bank");
    expect(joinedCopy).toContain("Community");
    expect(joinedCopy).toContain("Arbitrage & De-vig");
    expect(joinedCopy).toContain("EV Under Time");
    expect(joinedCopy).toContain("weak-spot");
    // Every one of those extras is repeatedly framed as optional.
    expect(joinedCopy).toMatch(/optional|not required|not needed|isn't required/i);
  });
});
