import { describe, expect, it } from "vitest";
import {
  creditForEpisode,
  NO_HINT_CREDIT,
  RUNG_CREDIT,
  WRONG_AFTER_ALL_RUNGS_CREDIT,
  type HintRungReached,
} from "./creditSchedule";

describe("RUNG_CREDIT schedule", () => {
  it("is the finalized calibrated schedule (100/65/45/20/10/4)", () => {
    expect(RUNG_CREDIT[0]).toBe(1.0);
    expect(RUNG_CREDIT[1]).toBe(0.65);
    expect(RUNG_CREDIT[2]).toBe(0.45);
    expect(RUNG_CREDIT[3]).toBe(0.2);
    expect(RUNG_CREDIT[4]).toBe(0.1);
    expect(RUNG_CREDIT[5]).toBe(0.04);
  });

  it("is strictly monotone decreasing in the rung reached", () => {
    const rungs: HintRungReached[] = [0, 1, 2, 3, 4, 5];
    for (let i = 1; i < rungs.length; i++) {
      expect(RUNG_CREDIT[rungs[i]]).toBeLessThan(RUNG_CREDIT[rungs[i - 1]]);
    }
  });

  it("keeps every credit inside [0,1]", () => {
    for (const v of Object.values(RUNG_CREDIT)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("penalises using ANY help the most (no-hint → rung-1 is the largest drop)", () => {
    const drops = [1, 2, 3, 4, 5].map(
      (k) => RUNG_CREDIT[(k - 1) as HintRungReached] - RUNG_CREDIT[k as HintRungReached],
    );
    const firstHelpDrop = RUNG_CREDIT[0] - RUNG_CREDIT[1];
    expect(Math.max(...drops)).toBe(firstHelpDrop);
  });

  it("has a deliberate cliff at the rung-2→3 (answer-withheld → method-revealed) boundary", () => {
    // Among the HINTED transitions (rung 1→2→3→4→5), rung 2→3 is the largest
    // drop — crossing from answer-withheld EF into method-revealed KCR territory.
    const hintedDrops = [2, 3, 4, 5].map(
      (k) => RUNG_CREDIT[(k - 1) as HintRungReached] - RUNG_CREDIT[k as HintRungReached],
    );
    const cliff = RUNG_CREDIT[2] - RUNG_CREDIT[3];
    expect(Math.max(...hintedDrops)).toBe(cliff);
  });
});

describe("creditForEpisode", () => {
  it("first-try correct earns full credit", () => {
    expect(creditForEpisode(true, 0)).toBe(NO_HINT_CREDIT);
    expect(creditForEpisode(true, 0)).toBe(1.0);
  });

  it("correct-after-rung maps to the schedule", () => {
    expect(creditForEpisode(true, 1)).toBe(0.65);
    expect(creditForEpisode(true, 3)).toBe(0.2);
    expect(creditForEpisode(true, 5)).toBe(0.04);
  });

  it("still-wrong-after-all-rungs earns 0 regardless of rung", () => {
    expect(creditForEpisode(false, 5)).toBe(WRONG_AFTER_ALL_RUNGS_CREDIT);
    expect(creditForEpisode(false, 5)).toBe(0);
    expect(creditForEpisode(false, 0)).toBe(0);
  });
});
