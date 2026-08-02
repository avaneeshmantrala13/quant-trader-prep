import { useMemo } from "react";
import { useProgress } from "@/context/ProgressContext";
import { resolveGoalMode } from "@/lib/mode/goalMode";
import { oaFormatById } from "@/lib/oa/config";
import {
  aggregateByFormat,
  aggregateOaStats,
  avgTimeSeries,
  type OaAggregateStats,
  type OaAvgTimePoint,
} from "@/lib/oa/stats";
import { OaTimeTrendGraph } from "./OaTimeTrendGraph";

const pct = (x: number) => `${Math.round(x * 100)}%`;
/** ms → "Xs" (1 decimal); a plain dash when there's no time data. */
const secTile = (ms: number) => (ms > 0 ? `${(ms / 1000).toFixed(1)}s` : "—");

/** One labelled row of the per-format breakdown table (pre-resolved label). */
export interface OaFormatBreakdownRow {
  formatId: string;
  label: string;
  sessions: number;
  totalAttempted: number;
  accuracy: number;
  medianMsPerQuestion: number;
  avgMsPerQuestion: number;
  pctWithinBudget: number;
}

interface TileProps {
  label: string;
  value: string;
}

function Tile({ label, value }: TileProps) {
  return (
    <div className="panel p-4">
      <div className="label text-muted">{label}</div>
      <div className="num mt-1 text-2xl font-semibold text-primary">{value}</div>
    </div>
  );
}

/**
 * OaTimingPanelView — PURE presentational panel: headline stat tiles + the
 * average-time trend graph. Takes fully-computed stats/series so it's trivial to
 * test and reuse without seeding any context.
 */
export function OaTimingPanelView({
  stats,
  series,
  perFormat = [],
}: {
  stats: OaAggregateStats;
  series: OaAvgTimePoint[];
  /** Per-format breakdown rows (labels pre-resolved). Optional / defaults to []. */
  perFormat?: OaFormatBreakdownRow[];
}) {
  return (
    <div className="panel p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-primary">Timed Sections</h2>
        <p className="mt-1 text-sm text-secondary">
          Your interview-style timed practice — accuracy under the clock and how
          your speed is trending.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Questions attempted" value={String(stats.totalAttempted)} />
        <Tile label="Accuracy" value={pct(stats.accuracy)} />
        <Tile label="Median time / q" value={secTile(stats.medianMsPerQuestion)} />
        <Tile label="Avg time / q" value={secTile(stats.avgMsPerQuestion)} />
        <Tile label="% within budget" value={pct(stats.pctWithinBudget)} />
        <Tile label="Sessions" value={String(stats.sessions)} />
      </div>

      {perFormat.length > 0 && (
        <section className="mt-6">
          <h3 className="label text-muted">By format</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="label text-[10px] text-muted">
                  <th className="py-1 pr-3 font-normal">Format</th>
                  <th className="py-1 pr-3 text-right font-normal">Sessions</th>
                  <th className="py-1 pr-3 text-right font-normal">Attempted</th>
                  <th className="py-1 pr-3 text-right font-normal">Accuracy</th>
                  <th className="py-1 pr-3 text-right font-normal">Median / q</th>
                  <th className="py-1 pr-3 text-right font-normal">Avg / q</th>
                  <th className="py-1 text-right font-normal">In budget</th>
                </tr>
              </thead>
              <tbody className="text-secondary">
                {perFormat.map((row) => (
                  <tr key={row.formatId} className="border-t border-subtle">
                    <td className="py-1.5 pr-3 font-semibold text-primary">
                      {row.label}
                    </td>
                    <td className="num py-1.5 pr-3 text-right">{row.sessions}</td>
                    <td className="num py-1.5 pr-3 text-right">
                      {row.totalAttempted}
                    </td>
                    <td className="num py-1.5 pr-3 text-right">
                      {pct(row.accuracy)}
                    </td>
                    <td className="num py-1.5 pr-3 text-right">
                      {secTile(row.medianMsPerQuestion)}
                    </td>
                    <td className="num py-1.5 pr-3 text-right">
                      {secTile(row.avgMsPerQuestion)}
                    </td>
                    <td className="num py-1.5 text-right">
                      {pct(row.pctWithinBudget)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-6">
        <h3 className="label text-muted">Average time per question over time</h3>
        <div className="mt-2">
          <OaTimeTrendGraph points={series} />
        </div>
      </section>
    </div>
  );
}

/**
 * OaTimingPanel — the container. Renders ONLY in Case B (interview) and ONLY
 * when there's at least one completed timed result, so Case A and the no-data
 * case stay byte-for-byte unchanged (it returns `null`). Otherwise it computes
 * the aggregate stats + time series (memoized over the results) and hands them
 * to the pure view.
 */
export function OaTimingPanel() {
  const { progress } = useProgress();
  const goalMode = resolveGoalMode(progress);
  const results = progress.oaTimed?.results ?? [];

  const { stats, series, perFormat } = useMemo(
    () => ({
      stats: aggregateOaStats(results),
      series: avgTimeSeries(results),
      perFormat: aggregateByFormat(results).map<OaFormatBreakdownRow>((f) => ({
        formatId: f.formatId,
        // Fall back to the raw id if a stored result references a retired format.
        label: oaFormatById(f.formatId)?.label ?? f.formatId,
        sessions: f.sessions,
        totalAttempted: f.totalAttempted,
        accuracy: f.accuracy,
        medianMsPerQuestion: f.medianMsPerQuestion,
        avgMsPerQuestion: f.avgMsPerQuestion,
        pctWithinBudget: f.pctWithinBudget,
      })),
    }),
    [results],
  );

  if (goalMode !== "interview") return null;
  if (results.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-8">
      <OaTimingPanelView stats={stats} series={series} perFormat={perFormat} />
    </section>
  );
}
