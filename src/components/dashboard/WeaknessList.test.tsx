// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import type { DashboardTopicEntry } from "@/themes/types";
import {
  describeMisconception,
  topicSubskill,
} from "@/lib/dashboard/misconceptionLabels";
import { misconceptionKey } from "@/lib/mastery/topicKey";
import { WeaknessList } from "./WeaknessList";

/**
 * FIX 3 — the weakness list must show SPECIFIC, actionable mistakes (ranked by
 * frequency), never a bare "recurring mistakes in {topic}" restatement, and must
 * fall back to a concrete sub-skill when no misconception is tracked yet.
 */

function entry(
  overrides: Partial<DashboardTopicEntry> & Pick<DashboardTopicEntry, "topicKey" | "name">,
): DashboardTopicEntry {
  return {
    trackTitle: "Probability & Statistics",
    verdict: "WEAK",
    hasEvidence: true,
    mean: 0.4,
    ciLow: 0.28,
    ciHigh: 0.55,
    theta: -0.4,
    gradedCount: 12,
    reviewDue: false,
    misconceptions: [],
    href: "/track/probability/level/pr-1",
    ...overrides,
  };
}

/** Build a display-ready misconception from a REAL canonical tag (real pipeline). */
function mc(topicKey: string, tag: string, topicName: string) {
  const key = misconceptionKey(topicKey, tag);
  return { key, label: describeMisconception(key, { topicName }) };
}

function wrap(children: ReactNode) {
  return render(<MemoryRouter>{children}</MemoryRouter>);
}

afterEach(cleanup);

describe("WeaknessList renders specific misconception sentences", () => {
  it("shows the concrete misconception description, not a topic restatement", () => {
    const topicKey = "probability::Core Probability";
    const name = "Meaning of Probability & Sample Space";
    wrap(
      <WeaknessList
        topics={[
          entry({
            topicKey,
            name,
            misconceptions: [mc(topicKey, "or_means_add_no_overlap", name)],
          }),
        ]}
      />,
    );
    expect(
      screen.getByText('Adding for “A or B” without subtracting the overlap'),
    ).toBeTruthy();
    // The useless placeholder must NOT appear anywhere.
    expect(screen.queryByText(/Recurring mistakes in/)).toBeNull();
  });

  it("ranks by frequency: the pre-ordered top misconceptions show first", () => {
    const topicKey = "probability::Conditional Probability";
    const name = "Conditional Probability & Bayes";
    // Already frequency-ranked upstream (topMisconceptions); component takes the top 2.
    wrap(
      <WeaknessList
        topics={[
          entry({
            topicKey,
            name,
            misconceptions: [
              mc(topicKey, "reversed_conditional", name),
              mc(topicKey, "base_rate_neglect", name),
              mc(topicKey, "ignored_conditioning", name),
            ],
          }),
        ]}
      />,
    );
    const row = screen.getByText(name).closest("li")!;
    expect(within(row).getByText("Confusing P(A|B) with P(B|A)")).toBeTruthy();
    expect(within(row).getByText("Ignoring the base rate")).toBeTruthy();
    // Capped at two — the third does not render.
    expect(
      within(row).queryByText("Not restricting to the conditioning event"),
    ).toBeNull();
  });

  it("falls back to the concrete CORE SUB-SKILL when no misconception is tracked", () => {
    const topicKey = "probability::Combinatorial Analysis";
    const name = "Counting & Combinatorics";
    wrap(<WeaknessList topics={[entry({ topicKey, name, misconceptions: [] })]} />);
    const expected = topicSubskill(topicKey, name);
    expect(expected).toBe(
      "Choosing permutations vs. combinations and counting cleanly",
    );
    expect(screen.getByText(expected)).toBeTruthy();
    expect(screen.queryByText(/Recurring mistakes in/)).toBeNull();
  });
});
