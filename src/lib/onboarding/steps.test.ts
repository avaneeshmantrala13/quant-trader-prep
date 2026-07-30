import { describe, expect, it } from "vitest";
import { ONBOARDING_TOUR_STEPS, type TourTarget } from "./steps";

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
  "arena",
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
    expect(byId.arena).toBe("arena");
    expect(byId.recalibrate).toBe("recalibrate");
    expect(byId.themes).toBe("themes");
    expect(byId.done).toBeUndefined();
  });
});
