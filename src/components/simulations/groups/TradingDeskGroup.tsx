/**
 * TradingDeskGroup — the "Trading Desk — Live Markets" section of the
 * Simulations tab. Three LIVE, path-dependent market-making simulators rendered
 * via <SimCard>, each driven by a pure, unit-tested engine in `@/lib/simulations`:
 *   • basketball-book          — stream a market on a game's final total
 *   • marble-winner-markets    — quote correlated winner markets, stay arb-free
 *   • etf-creation-redemption  — make an ETF market under NAV latency
 *
 * You tune a market-maker POLICY (spread, inventory skew, de-vig toggle); the
 * full session is recomputed once per (policy, seed) via useMemo and a "session"
 * slider scrubs the streamed P&L, replaying the SAME run. Scoring compares your
 * cumulative P&L + max drawdown to a benchmark desk policy on the identical
 * stream. All colors come from semantic theme tokens, so it themes across all
 * six themes in light + dark.
 */
import { useMemo, useState, type ReactNode } from "react";
import { SimCard } from "@/components/simulations/SimCard";
import { LineChart } from "@/components/simulations/charts/LineChart";
import { SIM_BY_ID } from "@/lib/simulations/catalog";
import { downsample } from "@/lib/simulations/shared";
import { signed, pnlTone as pnlToneClass } from "@/components/tradingFloor/format";
import {
  gradeVsBenchmark,
  maxDrawdown,
  type BenchmarkGrade,
} from "@/lib/simulations/liveMarket";
import {
  DEFAULT_BASKETBALL_CONFIG,
  runBasketball,
} from "@/lib/simulations/basketball";
import {
  DEFAULT_MARBLE_CONFIG,
  runMarbleOlympics,
} from "@/lib/simulations/marbleOlympics";
import {
  DEFAULT_ETF_CONFIG,
  runEtfChallenge,
} from "@/lib/simulations/etfChallenge";

/* ========================================================================== */
/*  Shared themed controls + readouts                                          */
/* ========================================================================== */

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}): JSX.Element {
  const { label, value, min, max, step, onChange, format } = props;
  return (
    <label className="space-y-1 block">
      <span className="label flex items-center justify-between">
        <span>{label}</span>
        <span className="num text-accent">
          {format ? format(value) : value}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </label>
  );
}

/** A signed P&L string like "+12.4" / "−3.0". */
function Stat(props: {
  label: string;
  value: ReactNode;
  toneClass?: string;
}): JSX.Element {
  return (
    <div className="space-y-0.5">
      <div className="label text-[9px]">{props.label}</div>
      <div className={`num text-sm font-semibold ${props.toneClass ?? "text-primary"}`}>
        {props.value}
      </div>
    </div>
  );
}

/** Cumulative P&L chart: your curve (accent) vs the benchmark desk (muted). */
function PnlChart(props: {
  userPnl: number[];
  benchPnl: number[];
  rounds: number;
  ariaLabel: string;
}): JSX.Element {
  const { userPnl, benchPnl, rounds, ariaLabel } = props;
  const { userPts, benchPts } = useMemo(() => {
    const toPts = (full: number[]) =>
      downsample(
        full.slice(0, rounds).map((y, i) => ({ x: i + 1, y })),
        220,
      );
    return { userPts: toPts(userPnl), benchPts: toPts(benchPnl) };
  }, [userPnl, benchPnl, rounds]);

  return (
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
      ariaLabel={ariaLabel}
    />
  );
}

/** The shared score readout: P&L, drawdown, vs-desk grade, and extras. */
function ScorePanel(props: {
  userFinal: number;
  benchFinal: number;
  drawdown: number;
  grade: BenchmarkGrade;
  extras: { label: string; value: ReactNode; toneClass?: string }[];
}): JSX.Element {
  const { userFinal, benchFinal, drawdown, grade, extras } = props;
  return (
    <div className="panel-ruled space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Your P&L"
          value={signed(userFinal)}
          toneClass={pnlToneClass(userFinal)}
        />
        <Stat label="Desk P&L" value={signed(benchFinal)} />
        <Stat
          label="vs Desk"
          value={signed(grade.delta)}
          toneClass={pnlToneClass(grade.delta)}
        />
        <Stat label="Max drawdown" value={drawdown.toFixed(1)} toneClass="text-bear" />
        {extras.map((e) => (
          <Stat key={e.label} label={e.label} value={e.value} toneClass={e.toneClass} />
        ))}
      </div>
      <div className="text-xs leading-relaxed text-secondary">
        <span
          className={`num font-semibold ${
            grade.delta >= 0 && userFinal > 0 ? "text-bull" : "text-primary"
          }`}
        >
          {grade.label}.
        </span>{" "}
        {benchFinal > 0
          ? `You captured ${grade.pct.toFixed(0)}% of the desk's edge.`
          : "The desk was flat-to-down on this stream too; the market gave little edge."}
      </div>
    </div>
  );
}

/** Slice a full run to a display length and derive the sliceable stats. */
function usePrefix(userPnl: number[], benchPnl: number[], rounds: number) {
  return useMemo(() => {
    const u = userPnl.slice(0, rounds);
    const b = benchPnl.slice(0, rounds);
    const userFinal = u.length > 0 ? u[u.length - 1] : 0;
    const benchFinal = b.length > 0 ? b[b.length - 1] : 0;
    return {
      userFinal,
      benchFinal,
      drawdown: maxDrawdown(u),
      grade: gradeVsBenchmark(userFinal, benchFinal),
    };
  }, [userPnl, benchPnl, rounds]);
}

function NewGameButton(props: { onClick: () => void }): JSX.Element {
  return (
    <button type="button" className="btn btn-secondary" onClick={props.onClick}>
      New game
    </button>
  );
}

/* ========================================================================== */
/*  1 · Basketball — live book management                                      */
/* ========================================================================== */

function BasketballSim(): JSX.Element {
  const meta = SIM_BY_ID["basketball-book"];
  const cfg = DEFAULT_BASKETBALL_CONFIG;
  const [halfSpread, setHalfSpread] = useState(2);
  const [skew, setSkew] = useState(0.25);
  const [seed, setSeed] = useState(1);
  const [rounds, setRounds] = useState(cfg.rounds);

  const run = useMemo(
    () => runBasketball({ halfSpread, skew }, seed, cfg),
    [halfSpread, skew, seed, cfg],
  );
  const prefix = usePrefix(run.userPnl, run.benchPnl, rounds);
  const invNow = rounds > 0 ? run.userInventory[rounds - 1] : 0;

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="You quote a two-sided market on the game's FINAL total. Fair value = points already scored + expected points still to come. A wider spread earns more per fill but wins less flow; too tight (or a mispriced mid) and informed flow picks you off. Carrying inventory while the score swings is what drives drawdown; raise skew to lean your quotes against your position and stay flat. Green line is your cumulative P&L, dashed grey is the benchmark desk on the same game."
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Slider
            label="Your half-spread"
            value={halfSpread}
            min={0}
            max={5}
            step={0.25}
            onChange={setHalfSpread}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            label="Inventory skew"
            value={skew}
            min={0}
            max={1}
            step={0.05}
            onChange={setSkew}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            label="Watch through round"
            value={rounds}
            min={5}
            max={cfg.rounds}
            step={1}
            onChange={setRounds}
            format={(v) => `${v}/${cfg.rounds}`}
          />
        </div>

        <ScorePanel
          userFinal={prefix.userFinal}
          benchFinal={prefix.benchFinal}
          drawdown={prefix.drawdown}
          grade={prefix.grade}
          extras={[
            { label: "Inventory", value: signed(invNow, 0), toneClass: pnlToneClass(invNow) },
            { label: "Picked off", value: `${run.pickedOff}`, toneClass: run.pickedOff > 0 ? "text-bear" : "text-primary" },
            { label: "Final total", value: `${run.finalTotal}` },
          ]}
        />

        <PnlChart
          userPnl={run.userPnl}
          benchPnl={run.benchPnl}
          rounds={rounds}
          ariaLabel="Cumulative P&L of your basketball market-making policy versus the benchmark desk"
        />

        <div className="flex justify-end">
          <NewGameButton onClick={() => setSeed((s) => s + 1)} />
        </div>
      </div>
    </SimCard>
  );
}

/* ========================================================================== */
/*  2 · Marble Olympics — winner markets                                       */
/* ========================================================================== */

const MARBLE_NAMES = ["Red", "Blue", "Green", "Gold", "Violet", "Onyx"];

function MarbleSim(): JSX.Element {
  const meta = SIM_BY_ID["marble-winner-markets"];
  const cfg = DEFAULT_MARBLE_CONFIG;
  const [halfSpread, setHalfSpread] = useState(0.04);
  const [normalize, setNormalize] = useState(true);
  const [seed, setSeed] = useState(1);
  const [rounds, setRounds] = useState(cfg.rounds);

  const run = useMemo(
    () => runMarbleOlympics({ halfSpread, normalize }, seed, cfg),
    [halfSpread, normalize, seed, cfg],
  );
  const prefix = usePrefix(run.userPnl, run.benchPnl, rounds);

  // The maker's book sums: normalized ⇒ mids sum to 1 exactly ⇒ arb-free for
  // any spread; raw ⇒ mids sum to ~1 and a tight book can leak a Dutch book.
  const nLegs = run.trueProbs.length;
  const sumAskIfNorm = 1 + nLegs * halfSpread;
  const sumBidIfNorm = 1 - nLegs * halfSpread;

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="Each race you quote a two-sided market on EVERY marble's 'to win' contract (pays 1 if it wins). Because exactly one marble wins, your prices must be coherent: if your asks sum below 1 (or bids above 1) an arbitrageur lifts your whole book for a RISK-FREE profit: a Dutch book. Renormalizing your mids to sum to 1 (de-vigging your own quotes) GUARANTEES the book is arbitrage-free for any spread. Winner markets settle with high variance, so watch the trend, not one race. Green is your cumulative P&L, dashed grey the arbitrage-free desk."
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Slider
            label="Your half-spread (vig)"
            value={halfSpread}
            min={0}
            max={0.1}
            step={0.005}
            onChange={setHalfSpread}
            format={(v) => v.toFixed(3)}
          />
          <label className="space-y-1 block">
            <span className="label">Renormalize book (de-vig)</span>
            <button
              type="button"
              role="switch"
              aria-checked={normalize}
              onClick={() => setNormalize((n) => !n)}
              className={`btn w-full ${normalize ? "btn-primary" : "btn-secondary"}`}
            >
              {normalize ? "ON: arbitrage-free" : "OFF: raw book"}
            </button>
          </label>
          <Slider
            label="Watch through race"
            value={rounds}
            min={5}
            max={cfg.rounds}
            step={1}
            onChange={setRounds}
            format={(v) => `${v}/${cfg.rounds}`}
          />
        </div>

        {/* True win probabilities of the marbles */}
        <div className="panel-ruled space-y-2 p-4">
          <div className="label text-secondary">True win probabilities (Σ = 1)</div>
          <div className="flex flex-wrap gap-2">
            {run.trueProbs.map((p, i) => (
              <span key={i} className="chip text-secondary">
                {MARBLE_NAMES[i] ?? `M${i + 1}`}{" "}
                <span className="num text-primary">{(p * 100).toFixed(1)}%</span>
              </span>
            ))}
          </div>
          <div className="text-xs leading-relaxed text-muted">
            {normalize ? (
              <>
                Your book is renormalized: mids sum to{" "}
                <span className="num text-primary">1.00</span>, so Σ ask ={" "}
                <span className="num text-bull">{sumAskIfNorm.toFixed(2)}</span> ≥ 1
                and Σ bid ={" "}
                <span className="num text-bull">{sumBidIfNorm.toFixed(2)}</span> ≤ 1,{" "}
                <span className="text-bull">provably arbitrage-free</span>.
              </>
            ) : (
              <>
                Raw book (not renormalized): when your estimates don't sum to 1, a
                tight spread can push Σ ask below 1 (or Σ bid above 1) and leak a
                Dutch book.
              </>
            )}
          </div>
        </div>

        <ScorePanel
          userFinal={prefix.userFinal}
          benchFinal={prefix.benchFinal}
          drawdown={prefix.drawdown}
          grade={prefix.grade}
          extras={[
            {
              label: "Dutch books lost",
              value: `${run.bookLeaks}`,
              toneClass: run.bookLeaks > 0 ? "text-bear" : "text-bull",
            },
            {
              label: "Legs picked off",
              value: `${run.pickedOff}`,
              toneClass: run.pickedOff > 0 ? "text-bear" : "text-primary",
            },
          ]}
        />

        <PnlChart
          userPnl={run.userPnl}
          benchPnl={run.benchPnl}
          rounds={rounds}
          ariaLabel="Cumulative P&L of your marble winner-market policy versus the arbitrage-free desk"
        />

        <div className="flex justify-end">
          <NewGameButton onClick={() => setSeed((s) => s + 1)} />
        </div>
      </div>
    </SimCard>
  );
}

/* ========================================================================== */
/*  3 · ETF Challenge — creation / redemption                                  */
/* ========================================================================== */

function EtfSim(): JSX.Element {
  const meta = SIM_BY_ID["etf-creation-redemption"];
  const cfg = DEFAULT_ETF_CONFIG;
  const [halfSpread, setHalfSpread] = useState(2);
  const [skew, setSkew] = useState(0.3);
  const [seed, setSeed] = useState(1);
  const [rounds, setRounds] = useState(cfg.rounds);

  const run = useMemo(
    () => runEtfChallenge({ halfSpread, skew }, seed, cfg),
    [halfSpread, skew, seed, cfg],
  );
  const prefix = usePrefix(run.userPnl, run.benchPnl, rounds);
  const navNow = rounds > 0 ? run.navFill[rounds - 1] : run.navSeen[0];
  const invNow = rounds > 0 ? run.userInventory[rounds - 1] : 0;

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="You make a two-sided market on an ETF whose fair value is its NAV = Σ shares × component price. The catch is LATENCY: you quote off the NAV you see now, but fills resolve after the components tick, so a creation/redemption arbitrageur picks you off whenever your quote is stale. Your spread must be wide enough to COVER the likely NAV move over that window; too tight and you're arbitraged, too wide and you win no flow. Skew your quotes to keep ETF inventory flat and control drawdown. Green is your cumulative P&L, dashed grey the benchmark desk."
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Slider
            label="Your half-spread"
            value={halfSpread}
            min={0}
            max={5}
            step={0.25}
            onChange={setHalfSpread}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            label="Inventory skew"
            value={skew}
            min={0}
            max={0.8}
            step={0.05}
            onChange={setSkew}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            label="Watch through round"
            value={rounds}
            min={5}
            max={cfg.rounds}
            step={1}
            onChange={setRounds}
            format={(v) => `${v}/${cfg.rounds}`}
          />
        </div>

        <ScorePanel
          userFinal={prefix.userFinal}
          benchFinal={prefix.benchFinal}
          drawdown={prefix.drawdown}
          grade={prefix.grade}
          extras={[
            { label: "NAV now", value: navNow.toFixed(0) },
            { label: "Inventory", value: signed(invNow, 0), toneClass: pnlToneClass(invNow) },
            {
              label: "Arbitraged",
              value: `${run.pickedOff}`,
              toneClass: run.pickedOff > 0 ? "text-bear" : "text-primary",
            },
          ]}
        />

        <PnlChart
          userPnl={run.userPnl}
          benchPnl={run.benchPnl}
          rounds={rounds}
          ariaLabel="Cumulative P&L of your ETF market-making policy versus the benchmark desk"
        />

        <div className="flex justify-end">
          <NewGameButton onClick={() => setSeed((s) => s + 1)} />
        </div>
      </div>
    </SimCard>
  );
}

export function TradingDeskGroup(): JSX.Element {
  return (
    <div className="space-y-6">
      <BasketballSim />
      <MarbleSim />
      <EtfSim />
    </div>
  );
}
