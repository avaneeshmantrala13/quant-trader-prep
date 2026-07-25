import { describe, expect, it } from "vitest";
import {
  buildFadedStages,
  deriveWorkedSteps,
  selectFadeOrder,
  type WorkedStep,
} from "./faded";

describe("deriveWorkedSteps", () => {
  it("splits an explanation into ordered steps", () => {
    const steps = deriveWorkedSteps(
      "First, list the survivors. Then count the favorable ones. Divide to finish.",
    );
    expect(steps).toHaveLength(3);
    expect(steps[0].text).toContain("survivors");
  });

  it("flags the trap step as misconception-critical (cue-based)", () => {
    const steps = deriveWorkedSteps(
      "List the ordered pairs. The classic trap is to use unordered pairs. Divide favorable by survivors.",
    );
    const crit = steps.findIndex((s) => s.isMisconceptionCritical);
    expect(crit).toBe(1);
  });

  it("honors an explicit critical index", () => {
    const steps = deriveWorkedSteps("A. B. C. D.", 2);
    expect(steps[2].isMisconceptionCritical).toBe(true);
    expect(steps.filter((s) => s.isMisconceptionCritical)).toHaveLength(1);
  });
});

describe("selectFadeOrder", () => {
  it("fades the misconception-critical step FIRST (Renkl)", () => {
    const steps: WorkedStep[] = [
      { text: "s0", isMisconceptionCritical: false },
      { text: "s1", isMisconceptionCritical: true },
      { text: "s2", isMisconceptionCritical: false },
    ];
    const order = selectFadeOrder(steps);
    expect(order[0]).toBe(1);
    // remaining steps fade from the last backward
    expect(order).toEqual([1, 2, 0]);
  });
});

describe("buildFadedStages", () => {
  it("progresses full → … → bare, blanking the critical step first", () => {
    const steps: WorkedStep[] = [
      { text: "s0", isMisconceptionCritical: false },
      { text: "s1", isMisconceptionCritical: true },
      { text: "s2", isMisconceptionCritical: false },
    ];
    const stages = buildFadedStages(steps);
    expect(stages).toHaveLength(4); // full + 3 fades
    // stage 0: nothing blanked
    expect(stages[0].steps.every((s) => !s.blanked)).toBe(true);
    // stage 1: only the critical step blanked
    expect(stages[1].steps.map((s) => s.blanked)).toEqual([false, true, false]);
    // final stage: all blanked
    expect(stages[3].steps.every((s) => s.blanked)).toBe(true);
  });
});
