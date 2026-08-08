import type { PipelineStage } from "@/types/progress";

/**
 * PLACEHOLDER stage screen (Phase P1). Every {@link PipelineStage} maps to a
 * component in the stage registry so the registry is COMPLETE and testable now,
 * even though the real stage screens are owned by later phases (P3 untimed, P4
 * timed, P5 game-OA, P6 diagnosis/drilling, P7 mock/greenlight). Each later
 * phase replaces its stage's registry entry with the real lazy component at the
 * agreed path (see `stageRegistry.tsx` → `StageMeta.plannedPath`).
 *
 * It is NOT the public {@link StageComponent} contract itself — the registry
 * wraps it in a `(props: { onComplete }) => JSX` adapter, binding the per-stage
 * copy — so this stays a plain presentational helper. It still surfaces an
 * `onComplete` affordance so the guided shell is dev-testable end-to-end before
 * the real screens land.
 */
export function ComingSoonStage({
  stage,
  title,
  blurb,
  onComplete,
}: {
  stage: PipelineStage;
  title: string;
  blurb: string;
  onComplete: (result?: unknown) => void;
}) {
  return (
    <section
      className="panel space-y-4 p-6"
      data-testid="coming-soon-stage"
      data-stage={stage}
    >
      <div className="space-y-1">
        <span className="label text-accent">Stage · {stage}</span>
        <h2 className="font-display text-2xl font-bold text-primary">{title}</h2>
        <p className="text-sm text-secondary">{blurb}</p>
      </div>

      <div className="note">
        <p className="label text-accent">This stage is coming soon.</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          The real screen for this stage is built in a later phase and dropped
          into the registry at its agreed path — the guided shell already
          resolves and renders whatever the registry returns.
        </p>
      </div>

      {/* Dev-only affordance so the shell can be exercised end-to-end before the
          real stage screens exist. Real stages call `onComplete` when the user
          finishes the stage's ONE action. */}
      <button
        type="button"
        className="btn-secondary"
        onClick={() => onComplete()}
      >
        Continue (dev)
      </button>
    </section>
  );
}
