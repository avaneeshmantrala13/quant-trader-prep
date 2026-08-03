/**
 * FloorDebrief — the scored post-session report. Fully prop-driven from a
 * `FloorResult` (plus optional local-PB context), so it renders without router /
 * progress / theme providers and is unit-testable in isolation.
 *
 * Shows the final P&L vs the honest desk (grade + % of edge captured), max
 * drawdown, pick-off recap, consistency, and the you-vs-desk cumulative P&L line
 * chart. For BINARY packs it also renders the reliability diagram over the
 * session's (mid, outcome) pairs plus a short "why this is calibration"
 * explainer (the mid is a proper scoring-rule probability).
 */
import type { FloorResult } from "@/lib/tradingFloor";
import { LineChart } from "@/components/simulations/charts/LineChart";
import { ReliabilityDiagram } from "@/components/dashboard/ReliabilityDiagram";
import { reliabilityDiagram } from "@/lib/calibration/reliability";
import { StampSeal } from "@/components/visuals/StampSeal";
import type { PersonalBest } from "@/lib/arena/localPb";
import { fmtNum, signed, fmtPct, pnlTone } from "./format";

export interface FloorDebriefProps {
  result: FloorResult;
  pb?: PersonalBest | null;
  isNewBest?: boolean;
  median7d?: number | null;
  onRestart: () => void;
}

function Stat(props: {
  label: string;
  value: string;
  toneClass?: string;
}): JSX.Element {
  return (
    <div className="space-y-0.5">
      <div className="label text-[9px] text-muted">{props.label}</div>
      <div className={`num text-sm font-semibold ${props.toneClass ?? "text-primary"}`}>
        {props.value}
      </div>
    </div>
  );
}

export function FloorDebrief(props: FloorDebriefProps): JSX.Element {
  const { result, pb, isNewBest, median7d, onRestart } = props;
  const beat = result.userFinal >= result.benchFinal;
  const binary = result.kind === "binary";

  const userPts = result.userPnl.map((y, i) => ({ x: i + 1, y }));
  const benchPts = result.benchPnl.map((y, i) => ({ x: i + 1, y }));

  const truthLabel = binary
    ? result.finalTruth > 0.5
      ? "YES (over the line)"
      : "NO (under the line)"
    : fmtNum(result.finalTruth);

  return (
    <div className="animate-print-in space-y-5">
      {/* Hero: final settlement vs the desk */}
      <article className="panel-ruled relative overflow-hidden p-6 text-center">
        <StampSeal
          label={beat ? "BEAT THE DESK" : "DESK WINS"}
          tone={beat ? "bull" : "bear"}
        />
        <span className="label text-accent">Final settlement</span>
        <div className={`num mt-3 font-display text-5xl font-black ${pnlTone(result.userFinal)}`}>
          {signed(result.userFinal)}
        </div>
        <p className="mt-2 text-sm text-secondary">
          <span
            className={`num font-semibold ${beat && result.userFinal > 0 ? "text-bull" : "text-primary"}`}
          >
            {result.grade.label}.
          </span>{" "}
          {result.benchFinal > 0
            ? `You captured ${result.grade.pct.toFixed(0)}% of the desk's edge (desk ${signed(result.benchFinal)}).`
            : `The desk was flat-to-down on this stream too (desk ${signed(result.benchFinal)}).`}
        </p>
        <p className="mt-1 text-xs text-muted">
          Settled truth:{" "}
          <span className="num font-semibold text-primary">{truthLabel}</span>
        </p>
      </article>

      {/* Score grid */}
      <article className="panel-ruled p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Your P&L" value={signed(result.userFinal)} toneClass={pnlTone(result.userFinal)} />
          <Stat label="Desk P&L" value={signed(result.benchFinal)} />
          <Stat
            label="vs Desk"
            value={signed(result.grade.delta)}
            toneClass={pnlTone(result.grade.delta)}
          />
          <Stat label="Max drawdown" value={result.userMaxDrawdown.toFixed(1)} toneClass="text-bear" />
          <Stat label="Consistency" value={result.consistency.toFixed(2)} />
          <Stat
            label="Picked off"
            value={`${result.pickedOff} / ${result.fills}`}
            toneClass={result.pickedOff > 0 ? "text-bear" : "text-primary"}
          />
          <Stat label="Rounds traded" value={`${result.fills} / ${result.rounds}`} />
          {binary && <Stat label="Brier" value={result.brier.toFixed(3)} />}
        </div>
      </article>

      {/* You vs desk cumulative P&L */}
      <article className="panel-ruled p-4">
        <div className="label text-accent">Cumulative P&amp;L — you vs the desk</div>
        <div className="mt-3">
          <LineChart
            series={[
              { points: benchPts, colorClass: "stroke-muted", dashed: true, label: "desk" },
              { points: userPts, colorClass: "stroke-accent", label: "you" },
            ]}
            xLabel="round"
            yLabel="cumulative P&L"
            refLines={[{ y: 0, label: "break-even", colorClass: "stroke-subtle" }]}
            formatX={(x) => Math.round(x).toLocaleString()}
            formatY={(y) => y.toFixed(0)}
            ariaLabel="Cumulative P&L of your market versus the honest desk"
          />
        </div>
      </article>

      {/* Binary calibration debrief */}
      {binary && (
        <article className="panel-ruled p-5">
          <div className="label text-accent">Calibration</div>
          <div className="mt-3">
            <ReliabilityDiagram data={reliabilityDiagram(result.calibrationPairs)} />
          </div>
          <div className="mt-4 border-l-2 border-accent bg-surface-muted px-4 py-3">
            <div className="label text-accent">Why this is calibration</div>
            <p className="mt-1 text-sm leading-relaxed text-secondary">
              On a 0/1 contract your <strong className="text-primary">mid is your probability</strong>.
              An informed counterparty only trades when your price is on the wrong
              side of the truth, so you get picked off exactly when you're
              over-confident. That makes this a{" "}
              <strong className="text-primary">proper scoring rule</strong>:
              minimizing your Brier score — quoting your honest probability — is
              the same as maximizing your expected P&amp;L.
            </p>
          </div>
        </article>
      )}

      {/* Local personal best + 7-day trend */}
      {pb && (
        <article className="panel-ruled p-4">
          <div className="flex items-center justify-between">
            <div className="label text-accent">Personal best</div>
            {isNewBest && (
              <span className="chip border-bull text-bull">New best!</span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Best P&L" value={signed(pb.bestScore)} toneClass={pnlTone(pb.bestScore)} />
            <Stat label="Attempts" value={`${pb.attempts}`} />
            <Stat
              label="7-day median"
              value={median7d == null ? "—" : signed(median7d)}
            />
          </div>
        </article>
      )}

      <button type="button" onClick={onRestart} className="btn-primary w-full">
        New session
      </button>

      {/* An unobtrusive footnote to make % capture legible even if desk flat. */}
      <p className="text-center text-[11px] text-muted">
        {binary
          ? `Your mid averaged a ${fmtPct(0.5)} coin-flip at the open — edge comes from updating faster than the desk.`
          : "Edge comes from a tighter, better-centred market than the honest desk on the same flow."}
      </p>
    </div>
  );
}
