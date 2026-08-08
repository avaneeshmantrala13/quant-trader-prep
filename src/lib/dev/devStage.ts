import { stageIndex, type Stage } from "@/lib/pipeline/stateMachine";

/**
 * lib/dev/devStage.ts — the PURE dev-only stage-override resolver for the guided
 * pipeline.
 *
 * The whole pipeline navigates off {@link resolveStage} (the live, gate-aware
 * stage). To let a DEVELOPER demo any stage without satisfying the gates, we
 * layer a dev-only override ON TOP of that resolved stage rather than faking
 * mastery data: when (and ONLY when) the session is a developer AND a
 * `forcedStage` is set, the effective stage is that forced stage. Every real
 * user path is untouched — `resolveStage`/`gates` stay authoritative.
 *
 * This function is the single source of truth every nav authority
 * (`RequirePipelineStage`, `HomeRoute`, `GuidedShell`) consults, so the bypass
 * lives in exactly one testable place.
 */

/** Narrow an arbitrary persisted value to a known {@link Stage}. */
export function isValidStage(value: string | null | undefined): value is Stage {
  return typeof value === "string" && stageIndex(value as Stage) >= 0;
}

/**
 * The stage the shell should DISPLAY. For a developer with a `forcedStage` set
 * it is that stage (the demo escape hatch); otherwise — and for EVERY
 * non-developer regardless of `forcedStage` — it is the live `resolved` stage.
 * Non-developers therefore can NEVER be moved off the gate-derived stage.
 */
export function devEffectiveStage(
  resolved: Stage,
  opts: { isDeveloper: boolean; forcedStage: Stage | null },
): Stage {
  if (opts.isDeveloper && opts.forcedStage && stageIndex(opts.forcedStage) >= 0) {
    return opts.forcedStage;
  }
  return resolved;
}
