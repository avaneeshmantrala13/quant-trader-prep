import { describe, expect, it } from "vitest";
import {
  diagnosticToSeeds,
  selfReportToSeed,
  type DiagnosticOutcome,
} from "./diagnosticSeed";
import { applyDiagnosticSeed } from "@/lib/mastery/mastery";

const TOPIC = "probability::Core Probability";

function o(
  tier: DiagnosticOutcome["tier"],
  correct: boolean,
  misconceptionTag?: string,
): DiagnosticOutcome {
  return { topicKey: TOPIC, tier, correct, misconceptionTag };
}

describe("diagnosticToSeeds", () => {
  it("2 successes ⇒ α=3, β=1 via applyDiagnosticSeed", () => {
    const [seed] = diagnosticToSeeds([o("medium", true), o("hard", true)]);
    expect(seed.successes).toBe(2);
    expect(seed.failures).toBe(0);
    const m = applyDiagnosticSeed(undefined, seed);
    expect(m.alpha).toBe(3);
    expect(m.beta).toBe(1);
    expect(m.n).toBe(2);
  });

  it("2 failures ⇒ α=1, β=3", () => {
    const [seed] = diagnosticToSeeds([o("medium", false), o("easy", false)]);
    expect(seed.successes).toBe(0);
    expect(seed.failures).toBe(2);
    const m = applyDiagnosticSeed(undefined, seed);
    expect(m.alpha).toBe(1);
    expect(m.beta).toBe(3);
  });

  it("mixed ⇒ α=2, β=2", () => {
    const [seed] = diagnosticToSeeds([o("medium", true), o("hard", false)]);
    expect(seed.successes).toBe(1);
    expect(seed.failures).toBe(1);
    const m = applyDiagnosticSeed(undefined, seed);
    expect(m.alpha).toBe(2);
    expect(m.beta).toBe(2);
  });

  it("propagates a tripped misconception tag as a namespaced key", () => {
    const [seed] = diagnosticToSeeds([
      o("medium", false, "reversed_conditional"),
      o("easy", true),
    ]);
    expect(seed.misconceptions).toContain(`${TOPIC}::reversed_conditional`);
    // A correct answer contributes no misconception.
    expect(seed.misconceptions).toHaveLength(1);
  });

  it("thetaSeed is monotone in the tier at which the learner succeeds", () => {
    const easy = diagnosticToSeeds([o("easy", true), o("medium", true)])[0];
    const hard = diagnosticToSeeds([o("hard", true), o("expert", true)])[0];
    // Passing harder tiers ⇒ strictly higher θ seed.
    expect(hard.thetaSeed).toBeGreaterThan(easy.thetaSeed);
    // A learner who fails everything seeds below one who passes everything.
    const failed = diagnosticToSeeds([o("medium", false), o("easy", false)])[0];
    expect(failed.thetaSeed).toBeLessThan(easy.thetaSeed);
  });

  it("groups multiple topics independently, preserving first-seen order", () => {
    const seeds = diagnosticToSeeds([
      { topicKey: "a", tier: "medium", correct: true },
      { topicKey: "b", tier: "medium", correct: false },
      { topicKey: "a", tier: "hard", correct: true },
    ]);
    expect(seeds.map((s) => s.topicKey)).toEqual(["a", "b"]);
    expect(seeds[0].successes).toBe(2);
    expect(seeds[1].failures).toBe(1);
  });
});

describe("selfReportToSeed (backup path)", () => {
  it("maps 'took M362K' to a strictly higher prior than 'no'", () => {
    const [yes] = selfReportToSeed({ m362k: "yes" });
    const [no] = selfReportToSeed({ m362k: "no" });
    expect(yes.successes).toBeGreaterThan(no.successes);
    expect(yes.thetaSeed).toBeGreaterThan(no.thetaSeed);
  });

  it("ignores unknown answer keys and skips absent ones", () => {
    const seeds = selfReportToSeed({ mentalMath: "fast", nonsense: "x" });
    expect(seeds).toHaveLength(1);
    expect(seeds[0].topicKey).toBe("mental-math::_core");
  });
});
