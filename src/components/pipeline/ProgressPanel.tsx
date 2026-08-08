import { useMemo } from "react";
import type { PipelineStage } from "@/types/progress";
import { useProgress } from "@/context/ProgressContext";
import { useRoadmapData } from "@/components/roadmap/useRoadmapData";
import { resolveStage, stageIndex, stageOrder } from "@/lib/pipeline/stateMachine";
import { computeDiagnosis } from "@/lib/pipeline/diagnosis";
import { stageMetaFor } from "./stageRegistry";

/**
 * Stages where the live readiness/mastery section is HIDDEN. During the two
 * diagnostics (and the make-a-market game) there is no meaningful live mastery
 * yet, and surfacing a number that moves in front of the user is noise — the
 * panel collapses to just the enlarged "Your journey" block. Every other stage
 * (`diagnosis`/`drilling`/`mock`/`greenlight`) keeps the full mastery readout.
 */
const MASTERY_HIDDEN_STAGES: readonly PipelineStage[] = [
  "diagnostic-untimed",
  "diagnostic-timed",
  "game-oa",
];

/**
 * The guided shell's read-only Progress / Roadmap panel (spec §2, P8). It is a
 * PURE projection — it never mutates state and never navigates (the stage router
 * owns navigation). It surfaces, top to bottom:
 *   • the login→greenlight JOURNEY: the current stage title + "Step N of 8",
 *   • overall READINESS + a mastered/total headline,
 *   • the current FOCUS topic (from the shared roadmap projection),
 *   • a per-tier mastered/total breakdown, and
 *   • (once the diagnosis has run) the weakest→strongest topic ranking, read-only.
 *
 * Mastery math lives in exactly one place: it reuses the existing
 * `useRoadmapData` DATA helper (the same hook the free-roam roadmap used) and the
 * pure `computeDiagnosis`, so the guided panel never re-implements any scoring.
 */
export interface ProgressPanelProps {
  /**
   * The stage the shell is currently showing. Drives BOTH the "Your journey"
   * copy and whether the live mastery section is shown (hidden during the
   * diagnostics / game — see {@link MASTERY_HIDDEN_STAGES}). When omitted the
   * panel derives the live stage from `progress` and shows the full readout.
   */
  stage?: PipelineStage;
}

export function ProgressPanel({ stage: stageProp }: ProgressPanelProps = {}) {
  const { progress } = useProgress();
  const model = useRoadmapData();
  const { state, tiers, currentRow } = model;

  // The live pipeline position (relock-aware): step 1 is Login, then the 7
  // in-app stages. Prefer the stage the shell passes in (may be an override);
  // otherwise `resolveStage` re-derives from stamps + live gates.
  const stage = stageProp ?? resolveStage(progress);
  const meta = stageMetaFor(stage);
  const stepNumber = stageIndex(stage) + 2; // +1 for 0-based, +1 for Login = step 1
  const totalSteps = stageOrder.length + 1;

  // When the panel is passed an explicit stage, gate the mastery block on it.
  // Standalone usage (no prop) keeps the full readout for backwards-compat.
  const showMastery = stageProp == null || !MASTERY_HIDDEN_STAGES.includes(stageProp);

  // The P6 ranked diagnosis (weakest→strongest), surfaced read-only once it has
  // been computed. Memoized on progress so it recomputes only when mastery moves.
  const ranked = useMemo(
    () =>
      progress.pipeline?.diagnosisComputedAt
        ? computeDiagnosis(progress).ranked.slice(0, 4)
        : [],
    [progress],
  );

  return (
    <aside
      aria-label="Your progress"
      data-testid="progress-panel"
      className="panel space-y-4 p-4"
    >
      {/* Login → greenlight journey. When the mastery readout is hidden this is
          the panel's ONE element, so it scales up to read as the headline. */}
      <div
        className={`rounded border border-subtle bg-surface-muted ${showMastery ? "p-3" : "p-5"}`}
        style={{ borderLeft: `3px solid rgb(var(--color-accent))` }}
        data-testid="journey"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className={`label text-muted ${showMastery ? "text-[9px]" : "text-[10px]"}`}>
            Your journey
          </span>
          <span
            className={`num text-muted ${showMastery ? "text-[10px]" : "text-xs font-semibold text-secondary"}`}
            data-testid="journey-step"
          >
            Step {stepNumber} of {totalSteps}
          </span>
        </div>
        {showMastery ? (
          <>
            <p className="mt-1 text-sm font-semibold text-primary">{meta.title}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-secondary">{meta.blurb}</p>
          </>
        ) : (
          <>
            <p className="mt-2 font-display text-2xl font-bold leading-tight text-primary">
              {meta.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-secondary">{meta.blurb}</p>
          </>
        )}
      </div>

      {showMastery && (
        <>
      <header className="space-y-1 border-b border-border-strong pb-3">
        <span className="label text-accent">Progress</span>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-primary">
            Readiness
          </h2>
          <span
            className="num text-2xl font-bold tabular-nums text-primary"
            data-testid="overall-readiness"
          >
            {state.overallReadiness}%
          </span>
        </div>
        <p className="text-[11px] text-muted">
          {state.masteredCount} of {state.totalCount} topics mastered
        </p>
      </header>

      {currentRow && (
        <div className="rounded border border-subtle bg-surface-muted p-3">
          <span className="label text-[9px] text-muted">Current focus</span>
          <p className="mt-1 text-sm font-semibold text-primary">
            {currentRow.name}
          </p>
          <p className="mt-0.5 text-[11px] text-secondary">
            {currentRow.progress.masteryPct}% toward mastery
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {tiers.map((tier) => {
          const pct =
            tier.totalCount > 0
              ? Math.round((100 * tier.masteredCount) / tier.totalCount)
              : 0;
          return (
            <li key={tier.id} data-testid="tier-row" className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-primary">
                  {tier.label}
                </span>
                <span className="num text-[10px] text-muted">
                  {tier.masteredCount}/{tier.totalCount}
                </span>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${tier.label} mastery`}
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {ranked.length > 0 && (
        <div className="space-y-2 border-t border-subtle pt-3" data-testid="panel-ranked">
          <span className="label text-[9px] text-muted">Weakest first</span>
          <ul className="space-y-1">
            {ranked.map((w) => (
              <li
                key={`${w.metric}:${w.key}`}
                className="flex items-center gap-2 text-[11px]"
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    w.mastered ? "bg-bull" : "bg-bear"
                  }`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-secondary">
                  {w.label}
                </span>
                <span className="num shrink-0 text-muted">
                  {Math.round(w.strength * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
        </>
      )}
    </aside>
  );
}
