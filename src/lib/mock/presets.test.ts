import { describe, expect, it } from "vitest";
import { buildInterview } from "./engine";
import { computePerformance } from "./diagnosis";
import { MOCK_PRESETS, PRESET_ORDER } from "./presets";
import type { MockSession } from "./engine";
import type { MathStep, MockStep, PresetId } from "./types";

/**
 * Firm-style preset tests. Prove that each preset:
 *   • has >= 10 questions with the EXACT documented ordered mix,
 *   • requires no finance knowledge (structural: only reasoning/math kinds),
 *   • appends behavioral prompts at the VERY END as unscored flashcards,
 *   • builds deterministically from a seed with full deterministic fallbacks,
 *   • yields a scored performance that EXCLUDES behavioral entirely.
 */

/** Map a preset item kind to the concrete built step kind it produces. */
function stepKindFor(itemKind: string): MockStep["kind"] {
  if (itemKind === "brainteaser") return "brainteaser";
  if (itemKind === "market-making") return "marketMaking";
  return "math"; // mental-math / probability-ev / sequences / estimation
}

describe("firm presets — mix, order, and size", () => {
  for (const id of PRESET_ORDER) {
    const preset = MOCK_PRESETS[id];

    it(`${preset.name} has >= 10 scored questions`, () => {
      expect(preset.items.length).toBeGreaterThanOrEqual(10);
    });

    it(`${preset.name} builds the documented ordered mix (+ behavioral at the END)`, () => {
      const script = buildInterview({ seed: 4242, preset: id });
      const nonBehavioral = script.steps.filter((s) => s.kind !== "behavioral");
      const behavioral = script.steps.filter((s) => s.kind === "behavioral");

      // Scored steps match the preset items 1:1, in ORDER, by kind.
      expect(nonBehavioral.length).toBe(preset.items.length);
      preset.items.forEach((item, i) => {
        expect(nonBehavioral[i].kind).toBe(stepKindFor(item.kind));
        // Numeric kinds carry their qtype so grading/labelling stays exact.
        const st = nonBehavioral[i];
        if (st.kind === "math" && item.kind !== "brainteaser" && item.kind !== "market-making") {
          expect(st.qtype).toBe(item.kind);
        }
      });

      // Behavioral prompts are the FINAL steps (unscored flashcards).
      expect(behavioral.length).toBe(preset.behavioralCount);
      const tail = script.steps.slice(-preset.behavioralCount);
      expect(tail.every((s) => s.kind === "behavioral")).toBe(true);
    });

    it(`${preset.name} is deterministic by seed`, () => {
      const a = buildInterview({ seed: 7, preset: id });
      const b = buildInterview({ seed: 7, preset: id });
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it(`${preset.name} CONCEPTUAL math steps carry two DISTINCT follow-ups; mental-math carries NONE`, () => {
      const script = buildInterview({ seed: 99, preset: id });
      const mathSteps = script.steps.filter((s) => s.kind === "math");
      expect(mathSteps.length).toBeGreaterThan(0);
      let sawConceptual = false;
      for (const s of mathSteps) {
        if (s.kind !== "math") continue;
        if (s.qtype === "mental-math") {
          // A speed gate gets NO conceptual/arithmetic-on-answer follow-up.
          expect(s.authoredProbe).toBeUndefined();
          expect(s.authoredAdversarial).toBeUndefined();
          continue;
        }
        sawConceptual = true;
        expect(s.authoredProbe).toBeDefined();
        expect(s.authoredAdversarial).toBeDefined();
        expect(s.authoredProbe!.role).toBe("probe");
        expect(s.authoredAdversarial!.role).toBe("adversarial");
        expect(s.authoredProbe!.prompt).not.toBe(s.authoredAdversarial!.prompt);
        // The probe is a genuine new computation, never the same numeric target.
        expect(s.authoredProbe!.answer).not.toBe(s.authoredAdversarial!.answer);
      }
      expect(sawConceptual).toBe(true);
    });
  }

  it("Optiver / Jane Street / SIG have the specified sizes", () => {
    expect(MOCK_PRESETS.optiver.items.length).toBe(12);
    expect(MOCK_PRESETS.janestreet.items.length).toBe(11);
    expect(MOCK_PRESETS.sig.items.length).toBe(12);
  });

  it("SIG allows a calculator and opens with exactly ONE numeric warm-up", () => {
    expect(MOCK_PRESETS.sig.calculatorAllowed).toBe(true);
    const mm = MOCK_PRESETS.sig.items.filter((i) => i.kind === "mental-math");
    expect(mm).toHaveLength(1);
    expect(MOCK_PRESETS.sig.items[0].kind).toBe("mental-math");
  });
});

describe("firm presets — arithmetic placement matches each firm's real format", () => {
  /** The built (non-behavioral) steps in preset order, for kind/qtype checks. */
  function scoredSteps(id: PresetId): MockStep[] {
    return buildInterview({ seed: 123, preset: id }).steps.filter(
      (s) => s.kind !== "behavioral",
    );
  }
  const isMentalMath = (s: MockStep) => s.kind === "math" && s.qtype === "mental-math";

  it("Optiver (2026 format) has NO arithmetic gate — leads with sequences + prob/EV", () => {
    // Optiver phased out the 80-in-8 arithmetic sprint in 2026: at most one
    // numeric opener, and the lead signal is NumberLogic sequences + Beat-the-
    // Odds probability/EV — never a block of mental-math.
    const mmItems = MOCK_PRESETS.optiver.items.filter((i) => i.kind === "mental-math");
    expect(mmItems.length).toBeLessThanOrEqual(1);

    const steps = scoredSteps("optiver");
    // No two mental-math steps back-to-back at the front (no sprint gate).
    expect(isMentalMath(steps[0]) && isMentalMath(steps[1])).toBe(false);
    // The first two scored steps are sequences, then probability/EV appears early.
    expect(steps[0].kind).toBe("math");
    expect((steps[0] as MathStep).qtype).toBe("sequences");
    expect((steps[1] as MathStep).qtype).toBe("sequences");
    expect(
      steps.slice(0, 6).some((s) => s.kind === "math" && (s as MathStep).qtype === "probability-ev"),
    ).toBe(true);
  });

  it("Jane Street leads with exactly ONE numeric warm-up, then NO more mental-math", () => {
    const steps = scoredSteps("janestreet");
    expect(isMentalMath(steps[0])).toBe(true);
    expect(steps.slice(1).some(isMentalMath)).toBe(false);
  });

  it("SIG leads with exactly ONE numeric warm-up, then NO more mental-math", () => {
    const steps = scoredSteps("sig");
    expect(isMentalMath(steps[0])).toBe(true);
    expect(steps.slice(1).some(isMentalMath)).toBe(false);
  });
});

describe("Optiver preset — pinned first question (demo)", () => {
  it("opens with the exact 5, 11, 23, 41, 65 quadratic sequence across many seeds", () => {
    const SEEDS = Array.from({ length: 60 }, (_, i) => i * 17 + 3);
    for (const seed of SEEDS) {
      const script = buildInterview({ seed, preset: "optiver" });
      const first = script.steps[0];
      expect(first.kind).toBe("math");
      const st = first as MathStep;
      expect(st.qtype).toBe("sequences");
      // The literal pinned prompt sequence — question 1 EVERY run.
      expect(st.prompt).toContain("5, 11, 23, 41, 65");
      expect(st.answer).toBe(95);
      expect(st.concept).toBe("Polynomial sequence (constant second difference)");
      // Its cascade: probe → 131 (numeric), adversarial → an²+bn+c (reasoning).
      expect(st.authoredProbe?.answer).toBe(131);
      expect(st.authoredAdversarial?.answerKind).toBe("reasoning");
      expect(st.authoredAdversarial?.prompt).toMatch(/a·n² \+ b·n \+ c|a, b, and c/);
    }
  });
});

describe("firm presets — behavioral is EXCLUDED from the score", () => {
  it("scored performance ignores behavioral steps entirely", () => {
    const id: PresetId = "optiver";
    const script = buildInterview({ seed: 3, preset: id });

    // Simulate a finished session with NO responses recorded at all.
    const session: MockSession = {
      script,
      speechSupported: false,
      status: "summary",
      index: script.steps.length - 1,
      responses: [],
    };
    const perf = computePerformance(session);

    // Total scored items = math + both follow-ups + brainteasers; behavioral
    // never contributes to mathTotal / followupTotal / brainteaserTotal.
    const mathCount = script.steps.filter((s) => s.kind === "math").length;
    const btCount = script.steps.filter((s) => s.kind === "brainteaser").length;
    expect(perf.mathTotal).toBe(mathCount);
    expect(perf.brainteaserTotal).toBe(btCount);
    // No behavioral leakage: there is no "behavioralTotal" contribution anywhere.
    expect(perf.scorePct).toBe(0); // nothing answered → 0%, behavioral irrelevant
  });
});
