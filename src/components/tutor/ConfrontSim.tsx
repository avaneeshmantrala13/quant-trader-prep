import { useMemo } from "react";
import { Rng } from "@/lib/rng";
import { runMonteCarlo, type MonteCarloSpec } from "@/lib/tutor/monteCarlo";

/**
 * Thin view for an elicit-then-confront Monte-Carlo run (GAISE 2016; Fischbein &
 * Schnarch 1997). Runs the DETERMINISTIC seeded simulation once (memoised — never
 * on every render, per PHASE_2 §9) and shows the empirical frequency converging.
 * A coarse text sparkline keeps the view dependency-free and functional with the
 * AI flag OFF.
 */
export function ConfrontSim({ spec }: { spec: MonteCarloSpec }) {
  const result = useMemo(
    () => runMonteCarlo(spec, new Rng(spec.seed)),
    [spec],
  );

  // Downsample the running frequency into a few checkpoints for display.
  const checkpoints = useMemo(() => {
    const n = result.runningFrequency.length;
    if (n === 0) return [] as { trial: number; freq: number }[];
    const marks = [0.01, 0.05, 0.1, 0.25, 0.5, 1];
    return marks.map((m) => {
      const idx = Math.max(0, Math.min(n - 1, Math.round(m * n) - 1));
      return { trial: idx + 1, freq: result.runningFrequency[idx] };
    });
  }, [result]);

  const label =
    spec.kind === "coin"
      ? "Heads frequency"
      : spec.kind === "dice"
        ? "Target-face frequency"
        : "Success frequency";

  return (
    <div className="panel-ruled p-4">
      <div className="label text-accent">Run the simulation</div>
      <p className="mt-1 text-sm text-secondary">
        {spec.trials.toLocaleString("en-US")} independent trials, seeded and
        reproducible. Watch the frequency settle; the streak carried no
        information.
      </p>
      <ul className="mt-3 space-y-1">
        {checkpoints.map((c) => (
          <li key={c.trial} className="flex items-center gap-2">
            <span className="num w-24 shrink-0 text-xs text-muted">
              {c.trial.toLocaleString("en-US")} trials
            </span>
            <span
              className="h-2 bg-accent"
              style={{ width: `${Math.round(c.freq * 100)}%` }}
              aria-hidden
            />
            <span className="num text-xs font-semibold text-primary">
              {c.freq.toFixed(3)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-subtle pt-2 text-sm text-secondary">
        {label} after {spec.trials.toLocaleString("en-US")} trials ·{" "}
        <span className="num font-semibold text-primary">
          {result.final.toFixed(4)}
        </span>
      </div>
    </div>
  );
}
