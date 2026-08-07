import { describe, expect, it } from "vitest";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import {
  COURSE_ONLY_ROUTES,
  dashboardFocus,
  EXTRA_RELEVANT_KNOWLEDGE_TOPIC_KEYS,
  featureEmphasis,
  gatingPriority,
  isExtraRelevantKnowledge,
  isFeatureVisible,
  navFor,
  navRouteBases,
  QUANT_ONLY_ROUTES,
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

  it("Case A is a lean, course-scoped menu (no quant-only groups)", () => {
    const groups = navFor("course");
    const headings = groups.map((g) => g.heading);
    // Only the course-relevant subsections remain — the quant-heavy groups
    // (Practice / Games / Interview Prep / Community / Beyond the course) are
    // gone from course mode entirely.
    expect(headings).toEqual([
      "Overview",
      "Courses",
      "Foundations",
      "Settings",
    ]);
    for (const dropped of [
      "extra-topics",
      "practice",
      "games",
      "interview-prep",
      "community",
    ]) {
      expect(groups.some((g) => g.id === dropped)).toBe(false);
    }

    // The two course tracks live in the prominent Courses group.
    const courses = groups.find((g) => g.id === "courses")!;
    const courseRoutes = courses.items.map((i) => i.to);
    expect(courseRoutes).toContain("/course/m362k");
    expect(courseRoutes).toContain("/course/m362m");

    // Every remaining group is prominent (course mode no longer de-emphasizes
    // anything — the irrelevant stuff is simply absent, not greyed out).
    for (const g of groups) {
      expect(g.emphasis).toBeUndefined();
      expect(g.items.every((i) => i.emphasis === undefined)).toBe(true);
    }

    // Foundations stay first-class for a course learner (not "beyond").
    const foundations = groups.find((g) => g.id === "foundations")!;
    expect(foundations.defaultOpen).toBe(true);

    // None of the quant-only competitive surfaces are advertised here.
    const labels = groups.flatMap((g) => g.items.map((i) => i.label));
    for (const gone of [
      "Speed Arena",
      "Fermi Drill",
      "Quant Games",
      "The Trading Floor",
      "Leaderboard",
      "Mock Interview",
      "Verified Bank",
      "Community",
      "Timed Sections",
    ]) {
      expect(labels).not.toContain(gone);
    }
  });
});

describe("navFor — mode scoping invariants", () => {
  const base = (mode: "interview" | "course") => new Set(navRouteBases(mode));

  it("the quant-only and course-only exclusion sets are disjoint", () => {
    const quant = new Set(QUANT_ONLY_ROUTES);
    for (const r of COURSE_ONLY_ROUTES) expect(quant.has(r)).toBe(false);
  });

  it("no quant-only route is surfaced in the course menu", () => {
    const course = base("course");
    for (const route of QUANT_ONLY_ROUTES) {
      expect(course.has(route)).toBe(false);
    }
  });

  it("every quant-only route stays reachable from the interview menu", () => {
    const interview = base("interview");
    for (const route of QUANT_ONLY_ROUTES) {
      expect(interview.has(route)).toBe(true);
    }
  });

  it("no course-only route leaks into the interview menu", () => {
    const interview = base("interview");
    for (const route of COURSE_ONLY_ROUTES) {
      expect(interview.has(route)).toBe(false);
    }
  });

  it("every course-only route is surfaced in the course menu", () => {
    const course = base("course");
    for (const route of COURSE_ONLY_ROUTES) {
      expect(course.has(route)).toBe(true);
    }
  });

  it("keeps the genuinely-shared surfaces in BOTH menus", () => {
    const SHARED = [
      "/",
      "/dashboard",
      "/roadmap",
      "/contents",
      "/simulations",
      "/themes",
      "/track/mental-math",
      "/track/math-questions",
    ];
    const interview = base("interview");
    const course = base("course");
    for (const route of SHARED) {
      expect(interview.has(route)).toBe(true);
      expect(course.has(route)).toBe(true);
    }
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
      "themes",
    ],
    // Course mode is lean: only the course-relevant anchors survive (the
    // Intro-to-Probability card carries the `probability` anchor).
    course: [
      "dashboard",
      "contents",
      "probability",
      "simulations",
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
      "/mock",
      "/themes",
    ],
    // Course mode surfaces ONLY the course-relevant routes.
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

      it("never advertises the Leaderboard or Community in either mode (UI removed; libs/routes kept for re-enable)", () => {
        const labels = groups.flatMap((g) => g.items.map((i) => i.label));
        const routes = groups.flatMap((g) => g.items.map((i) => i.to));
        expect(labels).not.toContain("Leaderboard");
        expect(routes).not.toContain("/leaderboard");
        expect(labels).not.toContain("Community");
        expect(routes).not.toContain("/community");
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
