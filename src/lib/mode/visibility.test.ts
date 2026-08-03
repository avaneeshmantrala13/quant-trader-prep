import { describe, expect, it } from "vitest";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import {
  dashboardFocus,
  EXTRA_RELEVANT_KNOWLEDGE_TOPIC_KEYS,
  featureEmphasis,
  gatingPriority,
  isExtraRelevantKnowledge,
  isFeatureVisible,
  navFor,
  topicCategory,
} from "./visibility";

describe("feature visibility", () => {
  it("only shows the Extra-Relevant-Knowledge display grouping in Case B", () => {
    expect(isFeatureVisible("interview", "extra-relevant-knowledge")).toBe(true);
    expect(isFeatureVisible("course", "extra-relevant-knowledge")).toBe(false);
  });

  it("keeps quant-only content VISIBLE in both modes (Case A de-emphasizes, never hides)", () => {
    for (const f of ["speed-arena", "interview-games", "fermi", "timing"] as const) {
      expect(isFeatureVisible("course", f)).toBe(true);
      expect(isFeatureVisible("interview", f)).toBe(true);
    }
  });

  it("de-emphasizes quant-only content in Case A but keeps it prominent in Case B", () => {
    expect(featureEmphasis("course", "speed-arena")).toBe("beyond");
    expect(featureEmphasis("interview", "speed-arena")).toBe("prominent");
  });

  it("wires the double-integral sim: prominent in Case A, available-but-not-emphasized in Case B", () => {
    expect(isFeatureVisible("course", "double-integral-sim")).toBe(true);
    expect(isFeatureVisible("interview", "double-integral-sim")).toBe(true);
    expect(featureEmphasis("course", "double-integral-sim")).toBe("prominent");
    expect(featureEmphasis("interview", "double-integral-sim")).toBe("beyond");
  });
});

describe("Extra Relevant Knowledge grouping", () => {
  it("lists the seven ex-ERK topics", () => {
    expect(EXTRA_RELEVANT_KNOWLEDGE_TOPIC_KEYS).toHaveLength(7);
    expect(isExtraRelevantKnowledge(topicKeyOf("probability", "Joint Distributions"))).toBe(true);
    expect(isExtraRelevantKnowledge(topicKeyOf("probability", "Expected Value"))).toBe(false);
  });
});

describe("topic categorisation + gating priority", () => {
  it("categorises course / foundation / beyond topics", () => {
    expect(topicCategory(topicKeyOf("probability", "Expected Value"))).toBe("course");
    expect(topicCategory(topicKeyOf("mental-math"))).toBe("foundation");
    expect(topicCategory(topicKeyOf("probability", "Betting & Sizing"))).toBe("beyond");
  });

  it("prioritizes course topics in Case A and foundations-first in Case B", () => {
    const course = topicKeyOf("probability", "Expected Value");
    const foundation = topicKeyOf("mental-math");
    expect(gatingPriority("course", course)).toBeLessThan(
      gatingPriority("course", foundation),
    );
    expect(gatingPriority("interview", foundation)).toBeLessThan(
      gatingPriority("interview", course),
    );
  });
});

describe("dashboard focus", () => {
  it("is course-readiness in Case A, weakness ranking in Case B", () => {
    expect(dashboardFocus("course")).toBe("courses");
    expect(dashboardFocus("interview")).toBe("weaknesses");
  });
});

describe("navFor", () => {
  it("Case B organises the menu into collapsible subsections", () => {
    const groups = navFor("interview");
    const headings = groups.map((g) => g.heading);
    // The logical subsections a growing interview-prep menu needs.
    expect(headings).toEqual([
      "Overview",
      "Learn",
      "Practice",
      "Games",
      "Interview Prep",
      "Community",
      "Settings",
    ]);
    // Overview leads with Home.
    expect(groups[0].items[0].label).toBe("Home");
    const labels = groups.flatMap((g) => g.items.map((i) => i.label));
    expect(labels).toContain("Speed Arena");
    expect(labels).toContain("Fermi Drill");
    expect(labels).toContain("Simulations");
    // No course-only links leak into Case B.
    expect(labels).not.toContain("Intro to Probability");
  });

  it("Case A keeps course groups prominent and quant-heavy groups 'beyond the course'", () => {
    const groups = navFor("course");
    const headings = groups.map((g) => g.heading);
    expect(headings).toContain("Courses");
    expect(headings).toContain("Foundations");
    expect(headings).toContain("Beyond the course");
    // The two course tracks live in the prominent Courses group.
    const courses = groups.find((g) => g.id === "courses")!;
    const courseRoutes = courses.items.map((i) => i.to);
    expect(courseRoutes).toContain("/course/m362k");
    expect(courseRoutes).toContain("/course/m362m");
    // Course-relevant groups are prominent (no beyond marker); quant-heavy ones
    // are de-emphasized (visible, not hidden) via a group-level beyond marker.
    expect(courses.emphasis).toBeUndefined();
    for (const id of ["extra-topics", "practice", "games", "interview-prep", "community"]) {
      const g = groups.find((x) => x.id === id)!;
      expect(g.emphasis).toBe("beyond");
      expect(g.items.every((i) => i.emphasis === "beyond")).toBe(true);
      // Beyond groups start collapsed to reduce scroll for a course learner.
      expect(g.defaultOpen).toBe(false);
    }
    const labels = groups.flatMap((g) => g.items.map((i) => i.label));
    expect(labels).toContain("Speed Arena");
  });
});

describe("navFor — grouped structure is well-formed", () => {
  // The tour anchors each mode's menu is expected to expose (menu = hamburger
  // button, not a nav item, so it never appears here). Guards that regrouping
  // never drops a `data-tour` hook the onboarding coach-marks rely on.
  const EXPECTED_TOUR: Record<string, string[]> = {
    interview: [
      "dashboard",
      "contents",
      "probability",
      "simulations",
      "timed-oa",
      "arena",
      "games",
      "trading-floor",
      "mock",
      "verified-bank",
      "community",
      "recalibrate",
      "themes",
    ],
    course: [
      "dashboard",
      "contents",
      "simulations",
      "arena",
      "games",
      "trading-floor",
      "mock",
      "verified-bank",
      "community",
      "recalibrate",
      "themes",
    ],
  };

  // Every route the menu must keep reachable, per mode.
  const EXPECTED_ROUTES: Record<string, string[]> = {
    interview: [
      "/",
      "/dashboard",
      "/roadmap",
      "/contents",
      "/track/probability",
      "/track/math-questions",
      "/track/mental-math",
      "/track/brainteasers",
      "/track/interview-games",
      "/simulations",
      "/oa",
      "/arena",
      "/arbitrage",
      "/ev-timed",
      "/fermi",
      "/games",
      "/trading-floor",
      "/leaderboard",
      "/mock",
      "/verified-bank",
      "/community",
      "/diagnostic",
      "/themes",
    ],
    course: [
      "/",
      "/dashboard",
      "/roadmap",
      "/contents",
      "/course/m362k",
      "/course/m362m",
      "/simulations",
      "/track/mental-math",
      "/track/math-questions",
      "/track/probability?topic=betting-and-sizing",
      "/track/probability?topic=game-theory-and-puzzles",
      "/track/interview-games",
      "/track/brainteasers",
      "/arena",
      "/arbitrage",
      "/ev-timed",
      "/fermi",
      "/games",
      "/trading-floor",
      "/leaderboard",
      "/mock",
      "/verified-bank",
      "/community",
      "/diagnostic",
      "/themes",
    ],
  };

  for (const mode of ["interview", "course"] as const) {
    describe(`${mode} mode`, () => {
      const groups = navFor(mode);

      it("has unique, stable group ids and a heading + non-empty items per group", () => {
        const ids = new Set<string>();
        for (const g of groups) {
          expect(g.id).toBeTruthy();
          expect(ids.has(g.id)).toBe(false);
          ids.add(g.id);
          expect(g.heading.trim().length).toBeGreaterThan(0);
          expect(g.items.length).toBeGreaterThan(0);
          expect(typeof g.defaultOpen).toBe("boolean");
        }
      });

      it("keeps every item well-formed (unique route + non-empty label)", () => {
        const routes = new Set<string>();
        for (const g of groups) {
          for (const item of g.items) {
            expect(item.to).toBeTruthy();
            expect(item.label.trim().length).toBeGreaterThan(0);
            expect(routes.has(item.to)).toBe(false);
            routes.add(item.to);
          }
        }
      });

      it("keeps every expected route reachable (nothing dropped by regrouping)", () => {
        const routes = groups.flatMap((g) => g.items.map((i) => i.to));
        for (const route of EXPECTED_ROUTES[mode]) {
          expect(routes).toContain(route);
        }
      });

      it("adds the Leaderboard to the nav", () => {
        const labels = groups.flatMap((g) => g.items.map((i) => i.label));
        const routes = groups.flatMap((g) => g.items.map((i) => i.to));
        expect(labels).toContain("Leaderboard");
        expect(routes).toContain("/leaderboard");
      });

      it("preserves exactly the expected tour anchors", () => {
        const anchors = groups
          .flatMap((g) => g.items.map((i) => i.tour))
          .filter((t): t is string => Boolean(t));
        expect([...anchors].sort()).toEqual([...EXPECTED_TOUR[mode]].sort());
        // No anchor is duplicated across the whole menu.
        expect(new Set(anchors).size).toBe(anchors.length);
      });

      it("has at least one open-by-default group so the menu isn't fully collapsed", () => {
        expect(groups.some((g) => g.defaultOpen)).toBe(true);
      });
    });
  }
});
