import { describe, expect, it } from "vitest";
import {
  SIMULATIONS,
  SIM_GROUPS,
  SIM_BY_ID,
  simsInGroup,
  simAnchorHref,
  type SimGroupId,
} from "./catalog";

describe("simulations catalog", () => {
  it("has unique, url-safe ids and non-empty required fields", () => {
    const ids = new Set<string>();
    for (const s of SIMULATIONS) {
      expect(ids.has(s.id)).toBe(false);
      ids.add(s.id);
      // ids double as DOM anchors / URL hashes: lowercase, dash-separated.
      expect(s.id).toMatch(/^[a-z0-9-]+$/);
      expect(s.title.trim().length).toBeGreaterThan(0);
      expect(s.whatShows.trim().length).toBeGreaterThan(0);
    }
    expect(SIMULATIONS.length).toBeGreaterThanOrEqual(12);
  });

  it("only references declared groups, and every group has ≥1 sim", () => {
    const groupIds = new Set<SimGroupId>(SIM_GROUPS.map((g) => g.id));
    for (const s of SIMULATIONS) {
      expect(groupIds.has(s.group)).toBe(true);
    }
    for (const g of SIM_GROUPS) {
      expect(simsInGroup(g.id).length).toBeGreaterThan(0);
    }
  });

  it("indexes every sim in SIM_BY_ID", () => {
    for (const s of SIMULATIONS) {
      expect(SIM_BY_ID[s.id]).toBe(s);
    }
    expect(Object.keys(SIM_BY_ID)).toHaveLength(SIMULATIONS.length);
  });

  it("builds a route+hash deep link", () => {
    expect(simAnchorHref("coin-flips")).toBe("/simulations#coin-flips");
  });

  it("exposes the live Trading Desk group and its simulators", () => {
    expect(SIM_GROUPS.some((g) => g.id === "trading-desk")).toBe(true);
    const deskIds = simsInGroup("trading-desk").map((s) => s.id);
    expect(deskIds).toEqual([
      "trading-floor-live",
      "basketball-book",
      "marble-winner-markets",
      "etf-creation-redemption",
    ]);
  });

  it("exposes the Real-World Scenarios group and its stock + poker sims", () => {
    expect(SIM_GROUPS.some((g) => g.id === "real-world")).toBe(true);
    const ids = simsInGroup("real-world").map((s) => s.id);
    expect(ids).toEqual([
      "stock-random-walk",
      "stock-regime-markov",
      "poker-pot-odds",
      "poker-hand-equity",
    ]);
  });

  it("exposes the concrete sims the hint ladder deep-links to", () => {
    // Subtask B4 (hint #4) names these exact ids — guard against renames.
    const required = [
      "coin-flips",
      "dice-rolls",
      "two-independent-events",
      "bayes-natural-frequency",
      "expected-value",
      "kelly",
      "markov-chain",
      "clt",
      "order-statistics",
      "geometric-dartboard",
      "monty-hall",
    ];
    for (const id of required) {
      expect(SIM_BY_ID[id], `missing sim: ${id}`).toBeTruthy();
    }
  });
});
