// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { stageOrder } from "@/lib/pipeline/stateMachine";
import { STAGE_REGISTRY } from "./stageRegistry";
import { StageStepper, stepperSteps } from "./StageStepper";

afterEach(cleanup);

describe("stepperSteps (pure state derivation)", () => {
  it("always shows 8 steps: Login + the 7 pipeline stages", () => {
    const steps = stepperSteps("diagnostic-untimed");
    expect(steps).toHaveLength(8);
    expect(steps[0].key).toBe("login");
    expect(steps.slice(1).map((s) => s.key)).toEqual([...stageOrder]);
  });

  it("marks login done, the current stage active, earlier stages done, later upcoming", () => {
    const steps = stepperSteps("game-oa"); // index 2 of the pipeline stages
    const byKey = Object.fromEntries(steps.map((s) => [s.key, s.state]));
    expect(byKey.login).toBe("done");
    expect(byKey["diagnostic-untimed"]).toBe("done");
    expect(byKey["diagnostic-timed"]).toBe("done");
    expect(byKey["game-oa"]).toBe("active");
    expect(byKey.diagnosis).toBe("upcoming");
    expect(byKey.mock).toBe("upcoming");
    expect(byKey.greenlight).toBe("upcoming");
  });

  it("has exactly one active step for every stage", () => {
    for (const stage of stageOrder) {
      const active = stepperSteps(stage).filter((s) => s.state === "active");
      expect(active).toHaveLength(1);
      expect(active[0].key).toBe(stage);
    }
  });

  it("uses the stage registry labels for the pipeline steps", () => {
    const steps = stepperSteps("drilling");
    for (const stage of stageOrder) {
      const step = steps.find((s) => s.key === stage)!;
      expect(step.label).toBe(STAGE_REGISTRY[stage].label);
    }
  });
});

describe("StageStepper (render)", () => {
  it("renders every step and marks the current one with aria-current", () => {
    render(<StageStepper current="diagnosis" />);
    const nav = screen.getByTestId("stage-stepper");
    const items = within(nav).getAllByRole("listitem");
    expect(items).toHaveLength(8);

    const active = items.filter((li) => li.getAttribute("aria-current") === "step");
    expect(active).toHaveLength(1);
    expect(active[0].getAttribute("data-step")).toBe("diagnosis");
    expect(active[0].getAttribute("data-state")).toBe("active");
  });

  it("reflects a different current stage", () => {
    render(<StageStepper current="mock" />);
    const nav = screen.getByTestId("stage-stepper");
    const active = within(nav)
      .getAllByRole("listitem")
      .find((li) => li.getAttribute("data-state") === "active");
    expect(active?.getAttribute("data-step")).toBe("mock");
  });
});
