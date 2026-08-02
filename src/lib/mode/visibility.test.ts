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
  it("Case B reproduces today's flat nav as a single un-headed group", () => {
    const groups = navFor("interview");
    expect(groups).toHaveLength(1);
    expect(groups[0].heading).toBeUndefined();
    const labels = groups[0].items.map((i) => i.label);
    expect(labels[0]).toBe("Home");
    expect(labels).toContain("Speed Arena");
    expect(labels).toContain("Fermi Drill");
    expect(labels).toContain("Simulations");
    // No course links leak into Case B.
    expect(labels).not.toContain("Intro to Probability");
  });

  it("Case A surfaces the two course tracks and a Beyond-the-course group", () => {
    const groups = navFor("course");
    const headings = groups.map((g) => g.heading);
    expect(headings).toContain("Foundations");
    expect(headings).toContain("Beyond the course");
    const main = groups[0].items.map((i) => i.to);
    expect(main).toContain("/course/m362k");
    expect(main).toContain("/course/m362m");
    // Beyond items are marked de-emphasized (visible, not hidden).
    const beyond = groups.find((g) => g.heading === "Beyond the course")!;
    expect(beyond.items.every((i) => i.emphasis === "beyond")).toBe(true);
    expect(beyond.items.map((i) => i.label)).toContain("Speed Arena");
  });
});
