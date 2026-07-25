import { describe, expect, it } from "vitest";
import type { TopicVerdict } from "@/lib/mastery/verdict";
import type { ReliabilityDiagramData } from "@/lib/calibration/reliability";
import { misconceptionKey } from "@/lib/mastery/topicKey";
import { MISCONCEPTION } from "@/lib/tutor/misconception";
import { buildDashboardViewProps, type DashboardLinks } from "./dashboardView";
import type { DashboardModel, DashboardTopic } from "./useDashboardData";

const LINKS: DashboardLinks = {
  practiceHref: (trackId, levelId) => `/track/${trackId}/level/${levelId}`,
  diagnosticHref: "/diagnostic",
  contentsHref: "/contents",
};

const RELIABILITY: ReliabilityDiagramData = {
  bins: [],
  relGap: 0,
  brier: 0,
  count: 0,
};

function verdict(partial: Partial<TopicVerdict>): TopicVerdict {
  return {
    topicKey: "probability::Conditional Probability",
    state: "WEAK",
    mean: 0.55,
    lo: 0.4,
    hi: 0.7,
    n: 8,
    theta: 0.3,
    namedMisconceptions: [],
    mastered: false,
    ...partial,
  };
}

function topic(partial: Partial<DashboardTopic>): DashboardTopic {
  return {
    topicKey: "probability::Conditional Probability",
    trackId: "probability",
    trackTitle: "Probability & Statistics",
    label: "Conditional Probability",
    firstLevelId: "cp-1",
    unlocked: true,
    verdict: verdict({}),
    ...partial,
  };
}

function model(partial: Partial<DashboardModel>): DashboardModel {
  const t = topic({});
  return {
    topics: [t],
    evidenced: [t],
    weaknesses: [t],
    recommended: t,
    due: [],
    reliability: RELIABILITY,
    diagnosticDone: false,
    ...partial,
  };
}

describe("buildDashboardViewProps", () => {
  it("carries routes + diagnostic state straight through", () => {
    const props = buildDashboardViewProps(model({}), LINKS);
    expect(props.diagnosticHref).toBe("/diagnostic");
    expect(props.contentsHref).toBe("/contents");
    expect(props.diagnosticDone).toBe(false);
    expect(props.reliability).toBe(RELIABILITY);
  });

  it("maps a topic to a display-ready entry with a nice name + deep link", () => {
    const props = buildDashboardViewProps(model({}), LINKS);
    const entry = props.topics[0];
    expect(entry.name).toBe("Conditional Probability & Bayes"); // curated nice name
    expect(entry.trackTitle).toBe("Probability & Statistics");
    expect(entry.verdict).toBe("WEAK");
    expect(entry.hasEvidence).toBe(true);
    expect(entry.mean).toBeCloseTo(0.55);
    expect(entry.ciLow).toBeCloseTo(0.4);
    expect(entry.ciHigh).toBeCloseTo(0.7);
    expect(entry.gradedCount).toBe(8);
    expect(entry.href).toBe("/track/probability/level/cp-1");
  });

  it("resolves FRIENDLY misconception labels, never raw keys", () => {
    const key = misconceptionKey(
      "probability::Conditional Probability",
      MISCONCEPTION.reversedConditional,
    );
    const props = buildDashboardViewProps(
      model({
        topics: [
          topic({ verdict: verdict({ namedMisconceptions: [key] }) }),
        ],
      }),
      LINKS,
    );
    const chip = props.topics[0].misconceptions[0];
    expect(chip.key).toBe(key); // stable id preserved for React
    expect(chip.label).toBe("Confusing P(A|B) with P(B|A)");
  });

  it("degrades an idx: fallback misconception to a topic phrasing", () => {
    const key = "probability::Conditional Probability::idx:2";
    const props = buildDashboardViewProps(
      model({
        topics: [topic({ verdict: verdict({ namedMisconceptions: [key] }) })],
      }),
      LINKS,
    );
    const chip = props.topics[0].misconceptions[0];
    expect(chip.label).toBe("Recurring mistakes in Conditional Probability & Bayes");
    expect(chip.label).not.toContain("idx");
    expect(chip.label).not.toContain("::");
  });

  it("uses the section label as the topic name when no curated name exists", () => {
    const props = buildDashboardViewProps(
      model({
        topics: [
          topic({
            topicKey: "probability::Markov Chain Probability",
            label: "Markov Chain Probability",
            verdict: verdict({ topicKey: "probability::Markov Chain Probability" }),
          }),
        ],
      }),
      LINKS,
    );
    expect(props.topics[0].name).toBe("Markov Chain Probability");
  });

  it("maps the recommended focus with its CI_low + deep link", () => {
    const props = buildDashboardViewProps(model({}), LINKS);
    expect(props.recommended).toEqual({
      topicKey: "probability::Conditional Probability",
      name: "Conditional Probability & Bayes",
      trackTitle: "Probability & Statistics",
      ciLow: 0.4,
      href: "/track/probability/level/cp-1",
    });
  });

  it("omits the recommendation when there is no clear weak spot", () => {
    const props = buildDashboardViewProps(model({ recommended: undefined }), LINKS);
    expect(props.recommended).toBeUndefined();
  });

  it("flags review-due topics and maps the due list", () => {
    const due = topic({
      verdict: verdict({ reviewDue: "2026-01-01T00:00:00.000Z" }),
    });
    const props = buildDashboardViewProps(model({ due: [due] }), LINKS);
    expect(props.due).toHaveLength(1);
    expect(props.due[0].reviewDue).toBe(true);
  });
});
