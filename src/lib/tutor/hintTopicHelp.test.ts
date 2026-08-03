import { describe, expect, it } from "vitest";
import { simLinkFor } from "./hintTopicHelp";
import { MISCONCEPTION } from "./misconception";
import { SIM_BY_ID, simAnchorHref } from "@/lib/simulations/catalog";
import { PLAYABLE_TRACKS } from "@/content";

describe("simLinkFor", () => {
  it("resolves misconceptionTag first (highest priority)", () => {
    const link = simLinkFor({
      // family + section would point elsewhere, but the misconception wins.
      misconceptionTag: MISCONCEPTION.gamblersFallacy,
      family: "genExpectedValue",
      section: "Expected Value",
    });
    expect(link).not.toBeNull();
    expect(link!.simId).toBe("coin-flips");
    expect(link!.href).toBe(simAnchorHref("coin-flips"));
    expect(link!.title).toBe(SIM_BY_ID["coin-flips"].title);
    expect(link!.blurb.length).toBeGreaterThan(0);
  });

  it("falls back to family when no misconceptionTag matches", () => {
    const link = simLinkFor({ family: "genUnion", section: "Expected Value" });
    expect(link).not.toBeNull();
    expect(link!.simId).toBe("venn-two-events");
    expect(link!.href).toBe("/simulations#venn-two-events");
    expect(link!.title).toBe(SIM_BY_ID["venn-two-events"].title);
  });

  it("falls back to section when no misconceptionTag or family matches", () => {
    const link = simLinkFor({ section: "Markov Chains" });
    expect(link).not.toBeNull();
    expect(link!.simId).toBe("markov-chain");
    expect(link!.href).toBe("/simulations#markov-chain");
  });

  it("returns NO link (never the silent coin-flips default) for an unknown/empty context", () => {
    // The old behaviour silently misdirected every unresolved item to
    // coin-flips; now rung 4 renders its inline confront / generic elicitation.
    expect(simLinkFor({})).toBeNull();
    expect(simLinkFor({ family: "totally-unknown", section: "not-a-section" })).toBeNull();
    expect(simLinkFor({ misconceptionTag: "not-a-real-tag" })).toBeNull();
  });

  it("never resolves to coin-flips unless it is genuinely appropriate", () => {
    // coin-flips is reachable ONLY via the gambler's-fallacy tag or the Core
    // Probability section — never as a catch-all default.
    expect(simLinkFor({ section: "Order Statistics" })?.simId).not.toBe("coin-flips");
    expect(simLinkFor({ family: "genUnknownXyz" })).toBeNull();
    expect(simLinkFor({ misconceptionTag: MISCONCEPTION.gamblersFallacy })?.simId).toBe(
      "coin-flips",
    );
    expect(simLinkFor({ section: "Core Probability" })?.simId).toBe("coin-flips");
  });

  it("always returns a catalog-valid id (or null) for every resolved context", () => {
    const contexts = [
      { misconceptionTag: MISCONCEPTION.baseRateNeglect },
      { misconceptionTag: MISCONCEPTION.outcomeApproach },
      { misconceptionTag: MISCONCEPTION.conjunctionFallacy },
      { misconceptionTag: MISCONCEPTION.andMeansAdd },
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
    ];
    for (const ctx of contexts) {
      const link = simLinkFor(ctx);
      expect(link).not.toBeNull();
      expect(SIM_BY_ID[link!.simId]).toBeTruthy();
      expect(link!.href).toBe(`/simulations#${link!.simId}`);
      expect(link!.title).toBe(SIM_BY_ID[link!.simId].title);
      expect(link!.blurb.trim().length).toBeGreaterThan(0);
    }
  });

  it("regression (P(A and B) bug): `and_means_add` resolves to a joint/Venn sim, not coin-flips", () => {
    // The reported bug: a P(A and B) item (misconception `and_means_add`)
    // suggested coin-flips instead of a Venn/joint sim.
    const link = simLinkFor({ misconceptionTag: MISCONCEPTION.andMeansAdd });
    expect(link).not.toBeNull();
    expect(link!.simId).not.toBe("coin-flips");
    expect([
      "two-independent-events",
      "venn-two-events",
      "joint-density-integral",
    ]).toContain(link!.simId);
  });
});

/**
 * Sections that legitimately have NO sim link (mental-math / word problems /
 * pure derivations / brainteaser technique drills / advanced distributions with
 * no bespoke visualization). For these, rung 4 renders inline text — returning
 * `null` is the CORRECT answer, not a bug.
 */
const EXPECTED_NO_LINK_SECTIONS = new Set<string>([
  "Sequences & Pattern Recognition",
  "Rates, Algebra & Word Problems",
  "Geometry & Derivations",
  "Core Puzzles",
  "Techniques Toolkit",
  "Moment Generating Functions",
  "Gamma Distribution",
  "Continuous Distributions",
  "Poisson Distribution & Process",
  "Branching Processes",
]);

describe("simLinkFor — full section coverage (self-maintaining via catalog inversion)", () => {
  /** Every real `Level.section` reachable through the playable tracks. */
  const trackSections = new Set<string>();
  for (const track of PLAYABLE_TRACKS) {
    for (const level of track.levels) {
      if (level.section) trackSections.add(level.section);
    }
  }
  // Content sections authored by the build swarm that aren't yet wired into a
  // playable track but must still resolve sensibly through the ladder.
  const extraSections = ["Sequences & Pattern Recognition", "No-Arbitrage"];
  const allSections = [...new Set([...trackSections, ...extraSections])].sort();

  it.each(allSections)(
    "section %s → a topic-appropriate sim OR an explicit no-link (never silent coin-flips)",
    (section) => {
      const link = simLinkFor({ section });
      if (link === null) {
        // A null result is only acceptable for sections we deliberately leave
        // unlinked; anything else would be a silent coverage gap.
        expect(EXPECTED_NO_LINK_SECTIONS.has(section)).toBe(true);
        return;
      }
      // The resolved sim must actually declare this section among its topics
      // (i.e. the link is topic-appropriate, not a misdirection).
      expect(SIM_BY_ID[link.simId], `unknown sim id ${link.simId}`).toBeTruthy();
      expect(SIM_BY_ID[link.simId].topics).toContain(section);
      // coin-flips may ONLY surface for Core Probability, never as a default.
      if (link.simId === "coin-flips") {
        expect(section).toBe("Core Probability");
      }
      expect(link.href).toBe(`/simulations#${link.simId}`);
      expect(link.blurb.trim().length).toBeGreaterThan(0);
    },
  );

  it("no section silently falls to the coin-flips default", () => {
    for (const section of allSections) {
      const link = simLinkFor({ section });
      if (link?.simId === "coin-flips") {
        expect(section).toBe("Core Probability");
      }
    }
  });
});
