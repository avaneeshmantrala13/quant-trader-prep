import type { RunReport } from "@/lib/arena/analytics";
import type { PersonalBest } from "@/lib/arena/localPb";
import type { SpeedStats } from "@/lib/arena/speedStats";

/**
 * PostRunReport — thin view of the pure `RunReport`. The per-question strip is
 * a hand-rolled SVG (correct = bull, wrong = bear); everything numeric comes
 * straight from `buildReport`.
 */
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel p-3 text-center">
      <div className="label text-[9px]">{label}</div>
      <div className="num mt-1 text-xl font-bold text-primary">{value}</div>
    </div>
  );
}

export function PostRunReport({
  report,
  pb,
  isNewBest,
  trend,
  speed,
  nextBudgetMs,
  onAgain,
}: {
  report: RunReport;
  pb: PersonalBest | null;
  isNewBest: boolean;
  trend: number | null;
  /** Interview-overlay speed stats; omitted for casual (non-interview) runs. */
  speed?: SpeedStats | null;
  /** Adaptively-tightened budget (ms) suggested for the next run, if any. */
  nextBudgetMs?: number | null;
  onAgain: () => void;
}) {
  const strip = report.perQuestion;
  const w = 100;
  const cell = strip.length > 0 ? w / strip.length : w;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <span className="label">Final score</span>
        <div className="num text-6xl font-black text-accent">{report.score}</div>
        {isNewBest && (
          <div className="label mt-1 text-gold">★ New personal best</div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <Stat label="Accuracy" value={`${Math.round(report.accuracy * 100)}%`} />
        <Stat label="Attempt rate" value={`${Math.round(report.attemptRate * 100)}%`} />
        <Stat label="Median" value={`${(report.medianMs / 1000).toFixed(1)}s`} />
        <Stat label="p90" value={`${(report.p90Ms / 1000).toFixed(1)}s`} />
        <Stat label="Mean" value={`${(report.meanMs / 1000).toFixed(1)}s`} />
        <Stat label="Projected" value={report.pacing.projected} />
        <Stat label="Best" value={pb ? pb.bestScore : report.score} />
        <Stat label="7-day med" value={trend ?? "—"} />
      </div>

      {/* Interview-overlay SPEED panel — time-to-solve vs the OA budget,
          surfaced alongside accuracy. Only present on interview-pacing runs. */}
      {speed && (
        <div className="panel-ruled space-y-3 p-3">
          <div className="flex items-center justify-between">
            <span className="label text-accent">Speed vs budget</span>
            <span
              className={`num text-xs font-bold ${
                speed.beatTarget ? "text-bull" : "text-gold"
              }`}
            >
              {speed.beatTarget ? "★ beat the target" : "keep pushing pace"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label="Median solve"
              value={`${(speed.medianSolveMs / 1000).toFixed(1)}s`}
            />
            <Stat
              label="Budget"
              value={`${(speed.budgetMs / 1000).toFixed(1)}s`}
            />
            <Stat
              label="Within budget"
              value={`${Math.round(speed.pctWithinBudget * 100)}%`}
            />
            <Stat
              label="Correct + in time"
              value={`${Math.round(speed.pctCorrectWithinBudget * 100)}%`}
            />
          </div>
          {nextBudgetMs != null && nextBudgetMs < speed.budgetMs && (
            <p className="text-sm text-primary">
              Accuracy is holding, so tightening next run's budget to{" "}
              <span className="num font-semibold">
                {(nextBudgetMs / 1000).toFixed(1)}s/q
              </span>
              . Keep beating the clock.
            </p>
          )}
        </div>
      )}

      {/* Per-question strip: each attempted item colored by correctness. */}
      <div className="panel p-3">
        <div className="label mb-2">Per-question · correct / wrong</div>
        <svg viewBox={`0 0 ${w} 12`} preserveAspectRatio="none" className="h-6 w-full">
          {strip.map((q, i) => (
            <rect
              key={q.id}
              x={i * cell}
              y={0}
              width={Math.max(cell - 0.3, 0.3)}
              height={12}
              fill={
                q.correct ? "rgb(var(--color-bull))" : "rgb(var(--color-bear))"
              }
              opacity={report.rushErrors.includes(q.id) ? 0.55 : 1}
            />
          ))}
        </svg>
      </div>

      {report.carelessSignal && (
        <div className="panel border-danger bg-danger-soft p-3 text-sm text-primary">
          <strong>Careless / rushing signal.</strong> A large share of your
          errors came in unusually fast for you. Slow down slightly on the ones
          you're unsure about; accuracy beats raw speed here.
        </div>
      )}

      {report.evCoaching && (
        <div className="panel bg-success-soft p-3 text-sm text-primary">
          {report.evCoaching}
        </div>
      )}

      <div className="panel-ruled p-3">
        <div className="label mb-2">By operation</div>
        <div className="space-y-1 text-sm">
          {Object.entries(report.byOp).map(([op, s]) => (
            <div key={op} className="flex justify-between text-secondary">
              <span className="num uppercase">{op}</span>
              <span className="num">
                {s.attempts - s.wrong}/{s.attempts} · {(s.avgMs / 1000).toFixed(1)}s avg
              </span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onAgain} className="btn-primary w-full">
        Run again
      </button>
    </div>
  );
}
