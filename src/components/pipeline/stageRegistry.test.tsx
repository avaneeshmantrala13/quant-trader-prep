// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { stageOrder } from "@/lib/pipeline/stateMachine";
import {
  STAGE_REGISTRY,
  allStageMeta,
  stageMetaFor,
} from "./stageRegistry";
import { ComingSoonStage } from "./stages/ComingSoonStage";

afterEach(cleanup);

describe("stage registry — completeness + contract", () => {
  it("resolves EVERY PipelineStage to a component (no gaps)", () => {
    for (const stage of stageOrder) {
      const meta = STAGE_REGISTRY[stage];
      expect(meta, `missing registry entry for ${stage}`).toBeTruthy();
      expect(meta.stage).toBe(stage);
      // The lazy component is a React.lazy exotic component (an object).
      expect(typeof meta.Component).toBe("object");
      expect(meta.Component).toBeTruthy();
    }
    // The registry has exactly the canonical stages — no extras, none missing.
    expect(Object.keys(STAGE_REGISTRY).sort()).toEqual([...stageOrder].sort());
  });

  it("gives every stage well-formed copy + a planned path + owning phase", () => {
    for (const meta of allStageMeta()) {
      expect(meta.label.trim().length).toBeGreaterThan(0);
      expect(meta.title.trim().length).toBeGreaterThan(0);
      expect(meta.blurb.trim().length).toBeGreaterThan(0);
      expect(meta.plannedPath).toMatch(
        /^src\/components\/pipeline\/stages\/.+\.tsx$/,
      );
      expect(meta.ownedBy).toMatch(/^P\d$/);
    }
  });

  it("marks EVERY stage as a real screen after the cutover (no placeholders)", () => {
    // Post-integration: every stage in `stageOrder` is wired to its REAL lazy
    // component via `REAL_STAGES`, so nothing renders the coming-soon placeholder.
    for (const meta of allStageMeta()) {
      expect(meta.placeholder, `${meta.stage} should be a real screen`).toBe(
        false,
      );
    }
  });

  it("stageMetaFor returns the same entry as direct lookup", () => {
    for (const stage of stageOrder) {
      expect(stageMetaFor(stage)).toBe(STAGE_REGISTRY[stage]);
    }
  });

  it("has unique labels + planned paths per stage", () => {
    const labels = allStageMeta().map((m) => m.label);
    const paths = allStageMeta().map((m) => m.plannedPath);
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("keeps ComingSoonStage as a defensive fallback (placeholder contract + onComplete)", () => {
    // The registry falls back to `comingSoon()` for any stage NOT in
    // `REAL_STAGES` (all 7 are wired today, so this asserts the fallback
    // component itself still honours the placeholder + StageComponent contract).
    let completed = false;
    render(
      <ComingSoonStage
        stage="diagnosis"
        title="Your diagnosis"
        blurb="Ranked weakest to strongest."
        onComplete={() => (completed = true)}
      />,
    );
    const el = screen.getByTestId("coming-soon-stage");
    expect(el.getAttribute("data-stage")).toBe("diagnosis");
    expect(screen.getByText(/coming soon/i)).toBeTruthy();
    // The dev "Continue" affordance calls the contract's onComplete.
    screen.getByRole("button", { name: /continue/i }).click();
    expect(completed).toBe(true);
  });
});
