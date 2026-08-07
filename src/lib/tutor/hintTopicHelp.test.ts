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
      { section: "Geometric Probability" },
      { section: "Combinatorial Analysis" },
      // Genuinely-CLT and game-theory-value FAMILIES resolve to a sim even
      // though their broad SECTIONS are deliberate no-links (asserted below).
      { family: "genCltTail" },
      { family: "genValue2x2" },
      { family: "genRuin" },
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

  // ---- RC1: rung-4 simulation mis-mapping regressions -----------------------
  describe("RC1 sim-mapping fixes (no cross-topic mis-pin)", () => {
    it("Markov random-walk / ruin / hitting-time / pattern families reach the Gambler's-Ruin sim (not the stationary sim)", () => {
      const ruinFamilies = [
        "genRuin",
        "genRuinNumeric",
        "genRuinReach",
        "genBoldPlay",
        "genLineWalk",
        "genCubeWalk",
        "genPolygonWalk",
        "genGridWalk",
        "genRunHeads",
        "genTwoInARow",
        "genResetChain",
        "genPatternRace",
        "genPatternWaitNumeric",
      ];
      for (const family of ruinFamilies) {
        expect(simLinkFor({ family, section: "Markov Chains" })?.simId).toBe("gamblers-ruin");
      }
      // Stationary families keep the stationary sim.
      for (const family of ["genTwoStateStationary", "genThreeStateStationary", "genStationaryReward"]) {
        expect(simLinkFor({ family, section: "Markov Chains" })?.simId).toBe("markov-chain");
      }
    });

    it("only the 2×2 mixed-strategy VALUE families reach the game-theory matrix; other game families do not", () => {
      expect(simLinkFor({ family: "genValue2x2", section: "Game Theory & Puzzles" })?.simId).toBe(
        "game-theory-matrix",
      );
      expect(simLinkFor({ family: "genValue3x2", section: "Game Theory & Puzzles" })?.simId).toBe(
        "game-theory-matrix",
      );
      // Dominant-strategy / sequential / spatial / threshold games have no
      // family map, so with the SECTION a no-link they resolve to null.
      for (const family of ["genPD", "genEntry", "genHotelling", "genBeauty", "genVolunteer"]) {
        expect(simLinkFor({ family, section: "Game Theory & Puzzles" })).toBeNull();
      }
    });

    it("genuine CLT families reach the CLT sim, but Cov/ρ/variance-combo families do NOT", () => {
      for (const family of ["genCltTail", "genCltDiffZ", "genCltDiffZNumeric", "genCltStatement"]) {
        expect(
          simLinkFor({ family, section: "Variance, Covariance & the CLT" })?.simId,
        ).toBe("clt");
      }
      // Covariance / correlation / variance-combination / Markov-bound families
      // have no CLT-appropriate sim; with the section a no-link they are null.
      for (const family of ["genCovariance", "genCorrelation", "genVarCombo", "genMarkovBound"]) {
        expect(simLinkFor({ family, section: "Variance, Covariance & the CLT" })).toBeNull();
      }
    });

    it("`complement_confusion` (a 1−p complement) never resolves to the Venn set-overlap sim", () => {
      const link = simLinkFor({ misconceptionTag: MISCONCEPTION.complementConfusion });
      // No confident tag-level sim → falls through; must never be the Venn sim.
      expect(link?.simId).not.toBe("venn-two-events");
      // A ruin complement (family present) resolves to the Gambler's-Ruin sim.
      expect(
        simLinkFor({
          misconceptionTag: MISCONCEPTION.complementConfusion,
          family: "genRuin",
        })?.simId,
      ).toBe("gamblers-ruin");
    });

    it("discrete joint-pmf and single-variable Y=X² transform do NOT get the continuous double-integral heatmap", () => {
      // Only genuine continuous bivariate families get the heatmap.
      for (const family of ["genJointNorm", "genJointSum", "genSumDensityRect"]) {
        expect(simLinkFor({ family, section: "Joint Distributions" })?.simId).toBe(
          "joint-density-integral",
        );
      }
      // Discrete pmf tables / single-variable transform have no heatmap map; with
      // the section a no-link they resolve to null (never the heatmap).
      for (const family of ["genTransform", "genJointMarginal", "genJointConditional", "genJointCovariance"]) {
        const link = simLinkFor({ family, section: "Joint Distributions" });
        expect(link?.simId).not.toBe("joint-density-integral");
        expect(link).toBeNull();
      }
    });

    it("no-link sections resolve to null at SECTION granularity (rung 4 shows generic elicitation, not a misdirection)", () => {
      for (const section of [
        "Variance, Covariance & the CLT",
        "Joint Distributions",
        "Game Theory & Puzzles",
        "Number Theory & Counting",
        "Continuous-Time Markov Chains",
      ]) {
        expect(simLinkFor({ section })).toBeNull();
      }
    });
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
  // Sections with NO confident SECTION-level sim — the fitting sim (if any) is
  // per-FAMILY only, so the section default is deliberately null to avoid the
  // audit's cross-topic mis-pins (Cov/ρ→CLT, discrete pmf→heatmap, all
  // game-theory→2×2 matrix, series→counting, CTMC→discrete stationary).
  "Variance, Covariance & the CLT",
  "Joint Distributions",
  "Game Theory & Puzzles",
  "Number Theory & Counting",
  "Continuous-Time Markov Chains",
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
