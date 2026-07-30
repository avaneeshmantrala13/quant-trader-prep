import { describe, expect, it } from "vitest";
import { emptyProgress } from "@/types/progress";
import { migrateProgress } from "@/lib/mastery/migrate";
import {
  markOnboardingTourDoneInPlace,
  ONBOARDING_TOUR_EXEMPT_PATHS,
  shouldShowOnboardingTour,
} from "./tour";

const STAMP = "2026-07-27T00:00:00.000Z";

describe("shouldShowOnboardingTour (auto-trigger for the new-user tour)", () => {
  it("does NOT show until the diagnostic is done", () => {
    expect(shouldShowOnboardingTour(undefined, undefined, "/contents")).toBe(
      false,
    );
    expect(shouldShowOnboardingTour("", undefined, "/contents")).toBe(false);
    expect(shouldShowOnboardingTour(undefined, undefined, "/dashboard")).toBe(
      false,
    );
  });

  it("shows once the diagnostic is done and the tour is NOT done, on in-app routes", () => {
    for (const path of [
      "/contents",
      "/track/probability",
      "/track/probability/level/pr-1",
      "/dashboard",
      "/arena",
      "/themes",
    ]) {
      expect(shouldShowOnboardingTour(STAMP, undefined, path)).toBe(true);
    }
  });

  it("never shows once the tour has been done (any non-empty stamp)", () => {
    expect(shouldShowOnboardingTour(STAMP, STAMP, "/contents")).toBe(false);
    expect(shouldShowOnboardingTour(STAMP, STAMP, "/track/probability")).toBe(
      false,
    );
    expect(
      shouldShowOnboardingTour(STAMP, "2020-01-01T00:00:00.000Z", "/arena"),
    ).toBe(false);
  });

  it("never auto-shows on the exempt paths (login + diagnostic), even when eligible", () => {
    expect(shouldShowOnboardingTour(STAMP, undefined, "/login")).toBe(false);
    expect(shouldShowOnboardingTour(STAMP, undefined, "/diagnostic")).toBe(
      false,
    );
    // Nested diagnostic paths are also exempt.
    expect(shouldShowOnboardingTour(STAMP, undefined, "/diagnostic/step")).toBe(
      false,
    );
  });

  it("exposes the exempt paths for reuse", () => {
    expect(ONBOARDING_TOUR_EXEMPT_PATHS).toEqual(["/login", "/diagnostic"]);
  });
});

describe("markOnboardingTourDoneInPlace (additive UI flag setter)", () => {
  it("stamps the provided timestamp and returns the same object", () => {
    const p = emptyProgress();
    const out = markOnboardingTourDoneInPlace(p, STAMP);
    expect(out).toBe(p);
    expect(p.onboardingTourDoneAt).toBe(STAMP);
  });

  it("defaults to a valid ISO timestamp when none is given", () => {
    const p = emptyProgress();
    markOnboardingTourDoneInPlace(p);
    expect(p.onboardingTourDoneAt).toBeTruthy();
    expect(Number.isNaN(Date.parse(p.onboardingTourDoneAt as string))).toBe(
      false,
    );
  });

  it("is additive — touches no other progress field", () => {
    const before = emptyProgress();
    before.xp = 42;
    before.streak = 3;
    before.diagnosticDoneAt = STAMP;
    before.levelProgress = { "pr-1": { bestScore: 1, mastered: true, attempts: 2 } };
    const snapshot = structuredClone(before);

    markOnboardingTourDoneInPlace(before, STAMP);

    // Everything except the new flag is untouched.
    expect(before.version).toBe(snapshot.version);
    expect(before.xp).toBe(snapshot.xp);
    expect(before.streak).toBe(snapshot.streak);
    expect(before.diagnosticDoneAt).toBe(snapshot.diagnosticDoneAt);
    expect(before.levelProgress).toEqual(snapshot.levelProgress);
    expect(before.onboardingTourDoneAt).toBe(STAMP);
  });

  it("is last-write-wins (idempotent enough to re-run safely)", () => {
    const p = emptyProgress();
    markOnboardingTourDoneInPlace(p, "2026-01-01T00:00:00.000Z");
    markOnboardingTourDoneInPlace(p, STAMP);
    expect(p.onboardingTourDoneAt).toBe(STAMP);
  });
});

/**
 * End-to-end trigger lifecycle. The "reload" is modeled exactly as the app does
 * it: a JSON round-trip through localStorage followed by `migrateProgress`
 * (which runs on every load in `ProgressProvider`). This is the deterministic
 * regression guard for the bug where the tour re-auto-opened on every reload
 * because the additive `onboardingTourDoneAt` flag was dropped during migration.
 */
describe("onboarding tour lifecycle: shows once, never again on reload, replayable on demand", () => {
  /** Faithfully mimics save → hard reload → load in ProgressProvider. */
  const reload = (p: unknown) => migrateProgress(JSON.parse(JSON.stringify(p)));

  it("auto-shows the first time (after first diagnostic completion) then never again across reloads", () => {
    // Fresh user finishes the diagnostic for the first time and lands in-app.
    const p = emptyProgress();
    p.diagnosticDoneAt = STAMP;
    expect(
      shouldShowOnboardingTour(
        p.diagnosticDoneAt,
        p.onboardingTourDoneAt,
        "/dashboard",
      ),
    ).toBe(true);

    // Auto-open stamps the "shown once" flag (as AppShell does on open).
    markOnboardingTourDoneInPlace(p, STAMP);
    expect(
      shouldShowOnboardingTour(
        p.diagnosticDoneAt,
        p.onboardingTourDoneAt,
        "/dashboard",
      ),
    ).toBe(false);

    // Reload after reload: the flag survives migration, so it stays false.
    let loaded = reload(p);
    for (let i = 0; i < 3; i++) {
      expect(loaded.onboardingTourDoneAt).toBe(STAMP);
      expect(
        shouldShowOnboardingTour(
          loaded.diagnosticDoneAt,
          loaded.onboardingTourDoneAt,
          "/dashboard",
        ),
      ).toBe(false);
      loaded = reload(loaded);
    }
  });

  it("does not auto-show for a user who finished the diagnostic but reloaded before ever seeing the tour, once it has since been marked done", () => {
    // Simulate the pre-fix persisted blob: diagnostic done, tour NOT yet done.
    const first = reload({ ...emptyProgress(), diagnosticDoneAt: STAMP });
    expect(
      shouldShowOnboardingTour(
        first.diagnosticDoneAt,
        first.onboardingTourDoneAt,
        "/contents",
      ),
    ).toBe(true);

    // It shows, gets marked done, and that survives the next reload.
    markOnboardingTourDoneInPlace(first, STAMP);
    const second = reload(first);
    expect(
      shouldShowOnboardingTour(
        second.diagnosticDoneAt,
        second.onboardingTourDoneAt,
        "/contents",
      ),
    ).toBe(false);
  });

  it("manual replay ('Show tutorial') is independent of the auto-trigger — the flag stays set and auto-show stays false", () => {
    // After the tour has been seen, the manual affordance opens it directly
    // (AppShell calls setTourOpen(true)); it never consults shouldShow* and
    // never clears the flag, so auto-show remains permanently off.
    const p = emptyProgress();
    p.diagnosticDoneAt = STAMP;
    markOnboardingTourDoneInPlace(p, STAMP);
    const loaded = reload(p);
    expect(loaded.onboardingTourDoneAt).toBe(STAMP);
    expect(
      shouldShowOnboardingTour(
        loaded.diagnosticDoneAt,
        loaded.onboardingTourDoneAt,
        "/dashboard",
      ),
    ).toBe(false);
  });
});
