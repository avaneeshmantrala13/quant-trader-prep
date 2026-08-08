import { Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProgress } from "@/context/ProgressContext";
import { useTheme } from "@/context/ThemeContext";
import { useDevPipeline } from "@/context/DevPipelineContext";
import { devEffectiveStage } from "@/lib/dev/devStage";
import type { PipelineStage } from "@/types/progress";
import { resolveStage } from "@/lib/pipeline/stateMachine";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import {
  CandlestickIcon,
  LogoutIcon,
  MoonIcon,
  SunIcon,
} from "@/components/icons";
import { ProgressPanel } from "./ProgressPanel";
import { StageStepper } from "./StageStepper";
import { DevStageControl } from "./DevStageControl";
import { DevKstView } from "./DevKstView";
import { DevResetControl } from "./DevResetControl";
import { stageMetaFor, type StageResult } from "./stageRegistry";

/**
 * THE GUIDED SHELL (spec §2) — one persistent layout that IS the whole app once
 * the pipeline is live. It has no free navigation: a single "Your Next Task"
 * area (rendering the current stage's screen from the registry), a read-only
 * Progress/Roadmap panel, a compact 8-step stepper, and header controls (Sign
 * out + the light/dark toggle, RESOLVED DECISION §10.7).
 *
 * SEQUENCING (Phase P1): this shell is BUILT but NOT mounted as the live nav
 * authority yet — `PIPELINE_ENABLED` stays `false` and `App.tsx` keeps the
 * free-roam routes (the real stage screens don't exist yet; a later integration
 * phase flips the flag and mounts this via `RequirePipelineStage`). It is fully
 * dev-testable now: rendered directly (or with a `stageOverride`) it resolves
 * and renders whatever the stage registry returns.
 */
export interface GuidedShellProps {
  /**
   * Force a specific stage (dev / tests). When omitted the shell derives the
   * live stage from `progress` via the pure {@link resolveStage} (relock-aware).
   */
  stageOverride?: PipelineStage;
  /**
   * Called when the current stage reports completion. DEFAULTS to the live
   * ProgressContext writer {@link completePipelineStage} (persist the stage's
   * field(s) + stamp, then re-derive `pipeline.stage`) — the integration cutover
   * wires the seam here. An explicit override is still accepted for dev/tests.
   */
  onStageComplete?: (stage: PipelineStage, result?: StageResult) => void;
}

export function GuidedShell({
  stageOverride,
  onStageComplete,
}: GuidedShellProps) {
  const { username, logOut, isDeveloper } = useAuth();
  const { progress, completePipelineStage } = useProgress();
  const { theme, toggleTheme } = useTheme();
  const { forcedStage } = useDevPipeline();

  // Live seam: an unspecified handler advances the pipeline through the
  // ProgressContext writer (which re-derives the authoritative stage).
  const handleStageComplete = onStageComplete ?? completePipelineStage;

  // A developer's forced stage overrides the gate-derived stage (demo escape
  // hatch); real users always follow the live `resolveStage`. `stageOverride`
  // (dev/tests) still wins so the shell stays directly renderable.
  const stage =
    stageOverride ??
    devEffectiveStage(resolveStage(progress), { isDeveloper, forcedStage });
  const meta = stageMetaFor(stage);
  const StageComponent = meta.Component;

  return (
    <div className="relative min-h-[100dvh]">
      <ThemeBackground />

      <header className="relative z-40 border-b-[3px] border-border-strong bg-surface">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-6 py-3.5 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center border border-border-strong bg-surface-muted text-accent">
              <CandlestickIcon width={20} height={20} />
            </span>
            <span className="font-display text-xl font-black tracking-tight text-primary">
              The Quant Factory
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              className="btn-ghost !min-h-0 !px-2 !py-1.5"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title="Toggle light or dark mode"
            >
              {theme === "dark" ? (
                <SunIcon width={16} height={16} />
              ) : (
                <MoonIcon width={16} height={16} />
              )}
            </button>
            <button
              type="button"
              onClick={logOut}
              className="btn-ghost !min-h-0 gap-1.5 !px-2 !py-1.5"
              aria-label="Sign out"
              title={`Sign out ${username ?? ""}`}
            >
              <LogoutIcon width={16} height={16} />
              <span className="label hidden text-[9px] sm:inline">Sign out</span>
            </button>
          </div>
        </div>

        {/* Compact 8-step stepper under the nameplate. */}
        <div className="border-t border-subtle bg-surface-muted/40">
          <div className="mx-auto w-full max-w-7xl px-6 py-2.5 lg:px-8">
            <StageStepper current={stage} />
          </div>
        </div>

        {/* Developer-only controls (demo escape hatch): stage skip-gating, the
            on-demand Knowledge State Tree viewer, and a full demo-progress reset.
            Renders nothing for real users — each self-gates on useIsDeveloper. */}
        {isDeveloper && (
          <div className="border-t border-subtle">
            <div className="mx-auto w-full max-w-7xl space-y-px px-2 lg:px-4">
              <DevStageControl current={stage} />
              <DevKstView />
              <DevResetControl />
            </div>
          </div>
        )}
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_22rem] lg:gap-10 lg:px-8">
        {/* Your Next Task */}
        <section aria-label="Your next task" data-testid="next-task">
          <div className="mb-4 flex items-center gap-3 border-b border-subtle pb-2.5">
            <span className="label text-accent">Your next task</span>
            <span aria-hidden className="h-px flex-1 bg-subtle" />
          </div>
          <Suspense
            fallback={
              <div className="panel flex items-center gap-2.5 p-6 font-mono text-sm text-muted">
                <span className="cursor" aria-hidden />
                Loading stage…
              </div>
            }
          >
            <StageComponent
              onComplete={(result) => handleStageComplete(stage, result)}
            />
          </Suspense>
        </section>

        {/* Read-only progress / roadmap projection. Stage-aware: the live
            mastery readout is hidden during the diagnostics / game. */}
        <ProgressPanel stage={stage} />
      </main>
    </div>
  );
}
