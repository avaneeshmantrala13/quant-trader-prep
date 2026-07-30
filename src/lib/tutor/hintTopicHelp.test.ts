import { describe, expect, it } from "vitest";
import { simLinkFor } from "./hintTopicHelp";
import { MISCONCEPTION } from "./misconception";
import { SIM_BY_ID, simAnchorHref } from "@/lib/simulations/catalog";

describe("simLinkFor", () => {
  it("resolves misconceptionTag first (highest priority)", () => {
    const link = simLinkFor({
      // family + section would point elsewhere, but the misconception wins.
      misconceptionTag: MISCONCEPTION.gamblersFallacy,
      family: "genExpectedValue",
      section: "Expected Value",
    });
    expect(link.simId).toBe("coin-flips");
    expect(link.href).toBe(simAnchorHref("coin-flips"));
    expect(link.title).toBe(SIM_BY_ID["coin-flips"].title);
    expect(link.blurb.length).toBeGreaterThan(0);
  });

  it("falls back to family when no misconceptionTag matches", () => {
    const link = simLinkFor({ family: "genUnion", section: "Expected Value" });
    expect(link.simId).toBe("venn-two-events");
    expect(link.href).toBe("/simulations#venn-two-events");
    expect(link.title).toBe(SIM_BY_ID["venn-two-events"].title);
  });

  it("falls back to section when no misconceptionTag or family matches", () => {
    const link = simLinkFor({ section: "Markov Chains" });
    expect(link.simId).toBe("markov-chain");
    expect(link.href).toBe("/simulations#markov-chain");
  });

  it("falls back to the coin-flips default for an unknown/empty context", () => {
    const link = simLinkFor({});
    expect(link.simId).toBe("coin-flips");
    expect(link.href).toBe("/simulations#coin-flips");
  });

  it("always returns an id that exists in the catalog", () => {
    const contexts = [
      { misconceptionTag: MISCONCEPTION.baseRateNeglect },
      { misconceptionTag: MISCONCEPTION.outcomeApproach },
      { misconceptionTag: MISCONCEPTION.conjunctionFallacy },
      { family: "genIntersectionIndep" },
      { family: "genBayes" },
      { family: "genExpectedValue" },
      { family: "genBinomial" },
      { family: "genCombinations" },
      { family: "genGeometric" },
      { family: "genAtLeastOne" },
      { section: "Core Probability" },
      { section: "Conditional Probability" },
      { section: "Betting & Sizing" },
      { section: "Order Statistics" },
      { section: "Variance, Covariance & the CLT" },
      { section: "Geometric Probability" },
      { section: "Combinatorial Analysis" },
      { section: "Game Theory & Puzzles" },
      { family: "totally-unknown", section: "not-a-section" },
      {},
    ];
    for (const ctx of contexts) {
      const link = simLinkFor(ctx);
      expect(SIM_BY_ID[link.simId]).toBeTruthy();
      expect(link.href).toBe(`/simulations#${link.simId}`);
      expect(link.title).toBe(SIM_BY_ID[link.simId].title);
      expect(link.blurb.trim().length).toBeGreaterThan(0);
    }
  });
});
