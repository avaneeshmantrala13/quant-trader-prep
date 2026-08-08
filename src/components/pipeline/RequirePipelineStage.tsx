import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useProgress } from "@/context/ProgressContext";
import { useIsDeveloper } from "@/context/AuthContext";
import { useDevPipeline } from "@/context/DevPipelineContext";
import { devEffectiveStage } from "@/lib/dev/devStage";
import { resolveStage, type Stage } from "@/lib/pipeline/stateMachine";

/**
 * MASTER FLAG for the guided pipeline (Phase P0). While `false` the pipeline is
 * completely DORMANT at runtime — {@link RequirePipelineStage} is an inert
 * pass-through and the existing App routes remain the sole navigation authority.
 * Phase P1 flips this to `true` during the strip-down cutover, mounts the real
 * stage screens behind this guard, and makes it the single nav authority
 * (spec §7.1). Kept in this module (not `App.tsx`) so both the guard and the
 * wiring import one source of truth.
 */
export const PIPELINE_ENABLED = true;

/**
 * Route → stage screen map (spec §3.4 stages). PLACEHOLDER paths for P1: the
 * real stage components are owned by later phases (P3 untimed, P4 timed, P5
 * game-OA, P6 diagnosis/drilling, P7 mock/greenlight). Kept here so the router
 * has one table to redirect against once `PIPELINE_ENABLED` is flipped.
 */
export const STAGE_PATH: Record<Stage, string> = {
  "diagnostic-untimed": "/pipeline/untimed",
  "diagnostic-timed": "/pipeline/timed",
  "game-oa": "/pipeline/game-oa",
  diagnosis: "/pipeline/diagnosis",
  drilling: "/pipeline/drilling",
  mock: "/pipeline/mock",
  greenlight: "/pipeline/greenlight",
};

export interface RequirePipelineStageProps {
  /** The stage this route is allowed to render. */
  stage: Stage;
  children: ReactNode;
}

/**
 * Stage-router guard modeled on the existing `RequireDiagnostic` / `Guarded`
 * wrappers in `src/App.tsx`. Given the route's required `stage`, it compares
 * against the LIVE resolved stage ({@link resolveStage}, which re-derives from
 * the pipeline stamps + live gates, so relock can pull a user back) and, when
 * they differ, redirects to the resolved stage's screen.
 *
 * P0 CONTRACT: it is NOT yet the navigation authority. While `PIPELINE_ENABLED`
 * is `false` it renders its children unchanged — a pure pass-through — so wiring
 * it into `App.tsx` cannot change current behavior. P1 flips the flag.
 */
export function RequirePipelineStage({
  stage,
  children,
}: RequirePipelineStageProps) {
  const { progress } = useProgress();
  const isDeveloper = useIsDeveloper();
  const { forcedStage } = useDevPipeline();
  if (!PIPELINE_ENABLED) return <>{children}</>;
  // Developers with a forced stage override the gate-derived stage (demo escape
  // hatch); every real user follows the live `resolveStage` unchanged.
  const resolved = devEffectiveStage(resolveStage(progress), {
    isDeveloper,
    forcedStage,
  });
  if (resolved !== stage) {
    return <Navigate to={STAGE_PATH[resolved]} replace />;
  }
  return <>{children}</>;
}
