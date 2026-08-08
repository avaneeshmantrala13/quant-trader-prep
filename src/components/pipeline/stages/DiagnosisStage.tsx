import { useMemo, useRef } from "react";
import { useProgress } from "@/context/ProgressContext";
import type { StageComponentProps } from "../stageRegistry";
import {
  computeDiagnosis,
  type Diagnosis,
  type DiagnosisMetric,
  type MetricWeakness,
} from "@/lib/pipeline/diagnosis";

/**
 * ============================================================================
 *  STAGE 5 — BACKEND DIAGNOSIS screen  (guided pipeline, Phase P6)
 * ============================================================================
 * A READ-ONLY report (spec §2 Stage 5): the learner's ranked weakest→strongest
 * standing across the FOUR metrics (content · timed · brainteaser · trading)
 * plus the concrete drill plan the loop will follow. All numbers come from the
 * PURE `computeDiagnosis` (`@/lib/pipeline/diagnosis`) over live `UserProgress`
 * — this component renders them and nothing more.
 *
 * CONTRACT: a {@link StageComponent}. It owns no navigation; pressing Continue
 * calls `onComplete(diagnosis)` exactly once, handing the computed diagnosis
 * back so the coordinator can stamp `diagnosisComputedAt` and advance to the
 * drilling loop. (This stage does not write the pipeline field directly — the
 * shell forwards the payload, mirroring the other stages.)
 */
export default function DiagnosisStage({ onComplete }: StageComponentProps) {
  const { progress } = useProgress();
  // Snapshot ONCE on mount so the report is stable while the learner reads it
  // (the live gate is re-derived downstream in the drilling loop anyway).
  const diagnosis = useMemo<Diagnosis>(() => computeDiagnosis(progress), [progress]);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete(diagnosis);
  };

  const contentMastered = diagnosis.content.filter((c) => c.mastered).length;

  return (
    <section className="panel space-y-6 p-6" data-testid="diagnosis-stage">
      <header className="space-y-1">
        <span className="label text-accent">Stage 5 · Your diagnosis</span>
        <h2 className="font-display text-2xl font-bold text-primary">
          Where you stand
        </h2>
        <p className="text-sm text-secondary">
          Ranked weakest → strongest across the four signals we measure. Your
          drilling loop below works this list from the top down.
        </p>
      </header>

      {/* The four sub-gate summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="diagnosis-gates">
        <GateStat
          label="Content"
          value={`${contentMastered}/${diagnosis.content.length}`}
          ok={contentMastered === diagnosis.content.length}
          hint="nodes ≥ 0.80"
        />
        <GateStat
          label="Timed"
          value={boolLabel(diagnosis.timed.length > 0 && diagnosis.timed.every((t) => t.mastered))}
          ok={diagnosis.timed.length > 0 && diagnosis.timed.every((t) => t.mastered)}
          hint="sections ≥ 0.90"
        />
        <GateStat
          label="Brainteaser"
          value={boolLabel(gateOf(diagnosis.competencies, "brainteaser"))}
          ok={gateOf(diagnosis.competencies, "brainteaser")}
          hint="competency ≥ 0.80"
        />
        <GateStat
          label="Trading"
          value={boolLabel(gateOf(diagnosis.competencies, "trading"))}
          ok={gateOf(diagnosis.competencies, "trading")}
          hint="competency ≥ 0.80"
        />
      </div>

      {/* Ranked weakest → strongest */}
      <div className="space-y-2">
        <span className="label text-secondary">Ranked · weakest first</span>
        <ul className="divide-y divide-subtle border border-subtle" data-testid="diagnosis-ranked">
          {diagnosis.ranked.map((w) => (
            <WeaknessRow key={`${w.metric}:${w.key}`} w={w} />
          ))}
        </ul>
      </div>

      {/* Drill plan */}
      <div className="space-y-2">
        <span className="label text-secondary">
          Your drill plan · {diagnosis.plan.length} target
          {diagnosis.plan.length === 1 ? "" : "s"}
        </span>
        {diagnosis.plan.length === 0 ? (
          <p
            className="note border-l-bull text-bull"
            data-testid="diagnosis-plan-empty"
          >
            Every metric already clears its bar — no drilling required.
          </p>
        ) : (
          <ol className="space-y-2" data-testid="diagnosis-plan">
            {diagnosis.plan.map((entry, i) => (
              <li key={`${entry.metric}:${entry.key}`} className="aside flex items-start gap-3">
                <span className="num mt-0.5 text-sm font-semibold text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-primary">
                      {entry.label}
                    </span>
                    <MetricChip metric={entry.metric} />
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-secondary">
                    {entry.reason}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <button
        type="button"
        className="btn-primary w-full"
        onClick={finish}
        data-testid="diagnosis-continue"
      >
        Continue → start drilling
      </button>
    </section>
  );
}

/* ========================================================================== */
/*  Presentational helpers (minimalist, token-only, light + dark)             */
/* ========================================================================== */

function gateOf(
  competencies: MetricWeakness[],
  metric: DiagnosisMetric,
): boolean {
  return competencies.find((c) => c.metric === metric)?.mastered ?? false;
}

function boolLabel(ok: boolean): string {
  return ok ? "Clear" : "Open";
}

const METRIC_LABEL: Record<DiagnosisMetric, string> = {
  content: "Content",
  timed: "Timed",
  brainteaser: "Brainteaser",
  trading: "Trading",
};

function MetricChip({ metric }: { metric: DiagnosisMetric }) {
  return (
    <span className="chip border-subtle text-[10px] text-secondary">
      {METRIC_LABEL[metric]}
    </span>
  );
}

function GateStat({
  label,
  value,
  ok,
  hint,
}: {
  label: string;
  value: string;
  ok: boolean;
  hint: string;
}) {
  return (
    <div className="stat">
      <div className="label text-muted">{label}</div>
      <div className={`num text-lg font-semibold ${ok ? "text-bull" : "text-primary"}`}>
        {value}
      </div>
      <div className="label !normal-case tracking-normal text-[10px] text-muted">
        {hint}
      </div>
    </div>
  );
}

function WeaknessRow({ w }: { w: MetricWeakness }) {
  const pct = Math.round(w.strength * 100);
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${w.mastered ? "bg-bull" : "bg-bear"}`}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-sm text-primary">
        {w.label}
      </span>
      <MetricChip metric={w.metric} />
      <div
        className="hidden h-1 w-16 shrink-0 overflow-hidden rounded-full bg-surface-muted sm:block"
        aria-hidden
      >
        <div
          className={`h-full rounded-full ${w.mastered ? "bg-bull" : "bg-bear"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`num w-12 shrink-0 text-right text-sm font-semibold ${
          w.mastered ? "text-bull" : "text-secondary"
        }`}
      >
        {pct}%
      </span>
    </li>
  );
}
