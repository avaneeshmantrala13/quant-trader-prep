import { describe, expect, it } from "vitest";
import { buildInterview } from "./engine";
import { buildFollowupPresentations, gradeFollowup } from "./followups";
import { drawArchetype } from "./questionPools";
import { Rng } from "@/lib/rng";
import { ELICITED_CONFIDENCE_SOURCES } from "@/lib/calibration/reliability";
import type { MathStep } from "./types";

/**
 * FIRM-SIGNATURE adversarial patterns folded in from
 * `datasets/FIRM_INTERVIEW_LIVE_RESEARCH_2026.md`. Each is a CONCEPT-SPECIFIC,
 * deterministically-graded follow-up cascade — never arithmetic on the answer —
 * and every reasoning follow-up is graded on a conclusion value + keyword groups.
 */

const T = 15000;

function mathStepsOf(preset: "optiver" | "janestreet" | "sig"): MathStep[] {
  return buildInterview({ seed: 99, preset })
    .steps.filter((s): s is MathStep => s.kind === "math");
}

/* -------------------------------------------------------------------------- */
/*  1) Jane Street "mutation cascade" — bank-or-roll                            */
/* -------------------------------------------------------------------------- */

describe("Jane Street bank-or-roll mutation cascade", () => {
  it("probe CHANGES A RULE (numeric, distinct) and adversarial GENERALIZES (reasoning)", () => {
    const q = drawArchetype(new Rng(1), "bank-or-roll");
    expect(q.answer).toBe(4.25);
    const { probe, adversarial } = buildFollowupPresentations(q.followups!, T);

    // Probe = structural rule change (reroll cost), a real new computation.
    expect(probe.answerKind).toBe("numeric");
    expect(probe.prompt).toMatch(/change the rule|cost/i);
    expect(probe.answer).toBe(4.0);
    expect(probe.answer).not.toBe(q.answer);
    expect(gradeFollowup(probe, "4", 3000)?.correct).toBe(true);
    expect(gradeFollowup(probe, "4.25", 3000)?.correct).toBe(false); // ignored the cost

    // Adversarial = generalize-to-n, reasoning-graded on the limiting value.
    expect(adversarial.answerKind).toBe("reasoning");
    expect(adversarial.prompt).toMatch(/generali[sz]e|n →|n->|→ ∞|up to n/i);
    expect(adversarial.prompt).not.toBe(probe.prompt);
    expect(
      gradeFollowup(adversarial, "it approaches 6 — you keep rerolling for a higher value", 5000)?.correct,
    ).toBe(true);
    expect(gradeFollowup(adversarial, "it approaches 3.5", 5000)?.correct).toBe(false);
  });

  it("is pinned into the Jane Street preset", () => {
    const step = mathStepsOf("janestreet").find(
      (s) => s.concept === "Optimal stopping (bank-or-roll)",
    );
    expect(step).toBeDefined();
    expect(step!.authoredProbe?.prompt).toMatch(/change the rule|cost/i);
    expect(step!.authoredAdversarial?.answerKind).toBe("reasoning");
    expect(step!.authoredAdversarial?.prompt).toMatch(/generali[sz]e|up to n/i);
  });
});

/* -------------------------------------------------------------------------- */
/*  2) IMC "challenge a correct answer" — hold firm (Monty Hall)                */
/* -------------------------------------------------------------------------- */

describe("IMC challenge-a-correct-answer (hold firm)", () => {
  it("credits holding 2/3 WITH justification and DINGS caving to 50/50", () => {
    const q = drawArchetype(new Rng(1), "monty-hold-firm");
    expect(q.answer).toBeCloseTo(2 / 3, 4);
    const { adversarial } = buildFollowupPresentations(q.followups!, T);
    expect(adversarial.answerKind).toBe("reasoning");
    expect(adversarial.prompt).toMatch(/are you sure|50\/50|not 1\/2/i);

    // Holds firm with correct justification → credited.
    expect(
      gradeFollowup(
        adversarial,
        "No — it's 2/3. The host KNOWS where the prize is and always opens an empty door, so that's conditional information, not independent.",
        6000,
      )?.correct,
    ).toBe(true);

    // Caves to the interviewer's wrong 50/50 → dinged (wrong conclusion value).
    expect(
      gradeFollowup(adversarial, "You're right, with two doors left it's 50/50, so 0.5.", 6000)?.correct,
    ).toBe(false);
  });

  it("the deepen probe scales the SAME principle to 10 doors", () => {
    const q = drawArchetype(new Rng(1), "monty-hold-firm");
    const { probe } = buildFollowupPresentations(q.followups!, T);
    expect(probe.answerKind).toBe("numeric");
    expect(probe.answer).toBeCloseTo(0.9, 4);
    expect(gradeFollowup(probe, "0.9", 3000)?.correct).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  3) SIG "how confident? how much would you bet?" — confidence → bet-size     */
/* -------------------------------------------------------------------------- */

describe("SIG confidence → bet-size", () => {
  it("exists in the SIG preset as a reasoning-graded bet-size follow-up", () => {
    const step = mathStepsOf("sig").find(
      (s) => s.concept === "Confidence → bet-sizing (edge)",
    );
    expect(step).toBeDefined();
    const adv = step!.authoredAdversarial;
    expect(adv?.answerKind).toBe("reasoning");
    expect(adv?.prompt).toMatch(/how much|bet|stake|bankroll/i);

    // Correct: $50 at f = 2p−1, and MORE than at 60% confidence.
    expect(gradeFollowup(adv!, "Stake $50 — more than at 60%.", 6000)?.correct).toBe(true);
    // Wrong direction / wrong size → dinged.
    expect(gradeFollowup(adv!, "$20, and less.", 6000)?.correct).toBe(false);
  });

  it("is NOT wired into the dashboard calibration source (stays Fermi + Trading Floor)", () => {
    // The calibration panel's elicited-confidence sources are gated to exactly
    // Fermi + Trading Floor. Mock confidence is for mock coaching only and must
    // NEVER appear here.
    const keys = Object.keys(ELICITED_CONFIDENCE_SOURCES);
    expect(keys).toHaveLength(2);
    expect(keys.some((k) => /mock/i.test(k))).toBe(false);
    expect(
      Object.values(ELICITED_CONFIDENCE_SOURCES).some((v) => /mock/i.test(v)),
    ).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  4) Citadel "bet on your own probability"                                    */
/* -------------------------------------------------------------------------- */

describe("Citadel bet-on-your-own-probability", () => {
  it("makes the candidate ACT on their posterior (take/pass + EV), reasoning-graded", () => {
    const q = drawArchetype(new Rng(1), "citadel-bet");
    expect(q.answer).toBe(0.75);
    const { adversarial } = buildFollowupPresentations(q.followups!, T);
    expect(adversarial.answerKind).toBe("reasoning");
    expect(adversarial.prompt).toMatch(/bet|take or pass|EV/i);

    // Correct: pass the −EV bet; EV = −0.5 per $1.
    expect(
      gradeFollowup(adversarial, "Pass — betting on white is negative EV; the EV is -0.5 per $1.", 6000)?.correct,
    ).toBe(true);
    // Caves and takes the losing side → dinged.
    expect(gradeFollowup(adversarial, "Sure, I'll take it.", 6000)?.correct).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  5) No dated / firm-branded arithmetic-gate wording in the mock module       */
/* -------------------------------------------------------------------------- */

describe("neutral arithmetic-gate wording", () => {
  it("no preset note / intro / scoringNote uses dated or firm-branded gate names", () => {
    // Built without a contiguous literal so this file itself stays clean.
    const datedGate = new RegExp(["80", "in", "8"].join("-"), "i");
    const brandedGate = new RegExp("zeta" + "mac", "i");
    for (const preset of ["optiver", "janestreet", "sig"] as const) {
      const script = buildInterview({ seed: 1, preset });
      const blob = [
        script.intro,
        script.scoringNote ?? "",
        ...script.steps.map((s) => ("prompt" in s ? s.prompt : "")),
      ].join(" ");
      expect(blob).not.toMatch(datedGate);
      expect(blob).not.toMatch(brandedGate);
    }
  });
});
