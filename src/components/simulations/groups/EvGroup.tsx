/**
 * EvGroup — the "Expected Value, Betting & Processes" simulation group.
 *
 * Renders three interactive, seedable sims as SimCards:
 *  - expected-value: a 2-outcome game whose running average payoff converges to E[X].
 *  - kelly:          under- / full- / over-Kelly bankroll growth on a log scale.
 *  - coupon-collector: the empirical mean number of draws tracking n·H_n.
 *
 * All heavy series are precomputed at their MAX horizon in `useMemo` keyed on
 * [params, seed], then sliced to a "trials/rounds" slider and downsampled to
 * 200 points before plotting — cheap re-renders, deterministic per seed.
 */
import { useMemo, useState } from "react";
import { SimCard } from "@/components/simulations/SimCard";
import { LineChart } from "@/components/simulations/charts/LineChart";
import { SIM_BY_ID } from "@/lib/simulations/catalog";
import { downsample, runningMean, roundTo } from "@/lib/simulations/shared";
import type { Outcome } from "@/lib/simulations/evBetting";
import {
  expectedValue,
  simulateRunningAverage,
  kellyFraction,
  simulateBankroll,
  couponCollectorExpectation,
  simulateCouponCollector,
} from "@/lib/simulations/evBetting";

const MAX_POINTS = 200;

/** A labeled range slider that shows its current value inline. */
function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display?: string;
}): JSX.Element {
  const { label, value, min, max, step, onChange, display } = props;
  return (
    <label className="block space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="label text-secondary">{label}</span>
        <span className="num text-primary">{display ?? value}</span>
      </div>
      <input
        type="range"
        className="w-full accent-accent"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

/** A labeled number input (allows negative values). */
function NumberField(props: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}): JSX.Element {
  const { label, value, step = 1, onChange } = props;
  return (
    <label className="block space-y-1">
      <span className="label text-secondary">{label}</span>
      <input
        type="number"
        className="input w-full"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function RunAgainButton(props: { onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      className="btn btn-secondary"
      onClick={props.onClick}
    >
      Run again
    </button>
  );
}

/* ========================================================================== */
/*  EXPECTED VALUE                                                            */
/* ========================================================================== */

const EV_MAX_TRIALS = 20000;

function ExpectedValueSim(): JSX.Element {
  const [p, setP] = useState(0.5);
  const [win, setWin] = useState(2);
  const [loss, setLoss] = useState(-1);
  const [trials, setTrials] = useState(2000);
  const [seed, setSeed] = useState(1);

  const outcomes: Outcome[] = [
    { value: win, prob: p },
    { value: loss, prob: 1 - p },
  ];
  const ev = expectedValue(outcomes);

  const full = useMemo(
    () => simulateRunningAverage(outcomes, EV_MAX_TRIALS, seed),
    // outcomes rebuilt each render; depend on its primitive parts + seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p, win, loss, seed],
  );

  const sliced = full.slice(0, trials);
  const points = downsample(
    sliced.map((y, i) => ({ x: i + 1, y })),
    MAX_POINTS,
  );
  const empirical = sliced.length > 0 ? sliced[sliced.length - 1] : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Slider
          label="P(win)"
          value={p}
          min={0}
          max={1}
          step={0.01}
          onChange={setP}
          display={p.toFixed(2)}
        />
        <NumberField label="Win payoff" value={win} onChange={setWin} />
        <NumberField label="Loss payoff" value={loss} onChange={setLoss} />
      </div>
      <Slider
        label="Trials"
        value={trials}
        min={10}
        max={EV_MAX_TRIALS}
        step={10}
        onChange={setTrials}
        display={String(trials)}
      />

      <LineChart
        series={[{ points, colorClass: "stroke-accent", label: "Running avg" }]}
        xLabel="trial"
        yLabel="average payoff"
        refLines={[{ y: ev, label: "E[X]", colorClass: "stroke-bear" }]}
        annotations={[
          {
            x: Math.max(2, trials * 0.5),
            y: ev,
            side: "up",
            text: "E[X]: the long-run average",
          },
        ]}
        ariaLabel="Running average payoff converging to the expected value"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-secondary">
          Empirical average:{" "}
          <span className="num text-primary">{roundTo(empirical, 3)}</span>{" "}
          &nbsp;·&nbsp; E[X]:{" "}
          <span className="num text-accent">{roundTo(ev, 3)}</span>
        </div>
        <RunAgainButton onClick={() => setSeed((s) => s + 1)} />
      </div>
    </div>
  );
}

/* ========================================================================== */
/*  KELLY                                                                     */
/* ========================================================================== */

const KELLY_MAX_ROUNDS = 2000;
const LOG_FLOOR = 1e-9;

function toLog10Points(bankroll: number[]): { x: number; y: number }[] {
  return bankroll.map((b, i) => ({
    x: i,
    y: Math.log10(Math.max(b, LOG_FLOOR)),
  }));
}

function KellySim(): JSX.Element {
  const meta = SIM_BY_ID["kelly"];
  const [p, setP] = useState(0.6);
  const [b, setB] = useState(1);
  const [rounds, setRounds] = useState(500);
  const [seed, setSeed] = useState(1);

  const fStar = kellyFraction(p, b);
  const fractions = useMemo(
    () => [0.5 * fStar, fStar, 1.5 * fStar] as const,
    [fStar],
  );

  // Simulate all three staking fractions with the SAME seed so paths compare.
  const full = useMemo(
    () =>
      fractions.map((f) =>
        simulateBankroll(p, b, f, KELLY_MAX_ROUNDS, seed),
      ),
    [p, b, fractions, seed],
  );

  const labels = ["half-Kelly", "full-Kelly", "over-Kelly"] as const;
  const colors = ["stroke-accent-2", "stroke-bull", "stroke-bear"] as const;

  const series = full.map((traj, i) => {
    const sliced = traj.slice(0, rounds + 1);
    return {
      points: downsample(toLog10Points(sliced), MAX_POINTS),
      colorClass: colors[i],
      label: labels[i],
    };
  });

  const finals = full.map((traj) => traj[Math.min(rounds, traj.length - 1)]);

  const lastPoint = (i: number): { x: number; y: number } | null => {
    const pts = series[i].points;
    return pts.length ? pts[pts.length - 1] : null;
  };
  const fullEnd = lastPoint(1);
  const overEnd = lastPoint(2);
  const kellyAnnotations = [
    fullEnd
      ? {
          x: fullEnd.x,
          y: fullEnd.y,
          side: "left" as const,
          text: "full-Kelly: fastest long-run growth",
        }
      : null,
    overEnd
      ? {
          x: overEnd.x,
          y: overEnd.y,
          side: "left" as const,
          text: "over-Kelly: more variance, ruin risk",
        }
      : null,
  ].filter((a): a is NonNullable<typeof a> => a !== null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Slider
          label="P(win)"
          value={p}
          min={0}
          max={1}
          step={0.01}
          onChange={setP}
          display={p.toFixed(2)}
        />
        <Slider
          label="Odds b (win pays b-to-1)"
          value={b}
          min={0.1}
          max={5}
          step={0.1}
          onChange={setB}
          display={b.toFixed(1)}
        />
      </div>
      <Slider
        label="Rounds"
        value={rounds}
        min={10}
        max={KELLY_MAX_ROUNDS}
        step={10}
        onChange={setRounds}
        display={String(rounds)}
      />

      <div className="flex flex-wrap gap-2">
        <span className="chip text-secondary">
          f* = <span className="num text-accent">{roundTo(fStar, 3)}</span>
        </span>
        <span className="chip text-secondary">half = {roundTo(0.5 * fStar, 3)}</span>
        <span className="chip text-secondary">full = {roundTo(fStar, 3)}</span>
        <span className="chip text-secondary">over = {roundTo(1.5 * fStar, 3)}</span>
      </div>

      <LineChart
        series={series}
        xLabel="round"
        yLabel="log10 bankroll"
        annotations={kellyAnnotations}
        ariaLabel="Bankroll growth for half-, full-, and over-Kelly staking on a log scale"
      />

      <p className="text-sm text-secondary">
        Full-Kelly (
        <span className="text-bull">green</span>) maximizes the long-run growth
        rate: under-Kelly grows too slowly, while over-Kelly takes on so much
        variance that growth falls — and can spiral toward ruin.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-secondary">
          Final bankroll —{" "}
          {labels.map((l, i) => (
            <span key={l}>
              {i > 0 ? " · " : ""}
              {l}:{" "}
              <span className="num text-primary">{roundTo(finals[i], 3)}×</span>
            </span>
          ))}
        </div>
        <RunAgainButton onClick={() => setSeed((s) => s + 1)} />
      </div>

      <p className="sr-only">{meta.whatShows}</p>
    </div>
  );
}

/* ========================================================================== */
/*  COUPON COLLECTOR                                                          */
/* ========================================================================== */

const COUPON_MAX_TRIALS = 20000;

function CouponCollectorSim(): JSX.Element {
  const meta = SIM_BY_ID["coupon-collector"];
  const [n, setN] = useState(10);
  const [trials, setTrials] = useState(2000);
  const [seed, setSeed] = useState(1);

  const full = useMemo(
    () => runningMean(simulateCouponCollector(n, COUPON_MAX_TRIALS, seed)),
    [n, seed],
  );

  const expectation = couponCollectorExpectation(n);
  const sliced = full.slice(0, trials);
  const points = downsample(
    sliced.map((y, i) => ({ x: i + 1, y })),
    MAX_POINTS,
  );
  const empirical = sliced.length > 0 ? sliced[sliced.length - 1] : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Slider
          label="Coupons n"
          value={n}
          min={2}
          max={50}
          step={1}
          onChange={setN}
          display={String(n)}
        />
        <Slider
          label="Trials"
          value={trials}
          min={10}
          max={COUPON_MAX_TRIALS}
          step={10}
          onChange={setTrials}
          display={String(trials)}
        />
      </div>

      <LineChart
        series={[
          { points, colorClass: "stroke-accent", label: "Empirical mean" },
        ]}
        xLabel="trial"
        yLabel="mean draws to collect all n"
        refLines={[
          { y: expectation, label: "n·H_n", colorClass: "stroke-bear" },
        ]}
        annotations={[
          {
            x: Math.max(2, trials * 0.5),
            y: expectation,
            side: "down",
            text: "n·H_N: predicted mean draws",
          },
        ]}
        ariaLabel="Empirical mean number of draws converging to n times the nth harmonic number"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-secondary">
          Empirical mean:{" "}
          <span className="num text-primary">{roundTo(empirical, 2)}</span>{" "}
          &nbsp;·&nbsp; n·H_n:{" "}
          <span className="num text-accent">{roundTo(expectation, 2)}</span>
        </div>
        <RunAgainButton onClick={() => setSeed((s) => s + 1)} />
      </div>

      <p className="sr-only">{meta.whatShows}</p>
    </div>
  );
}

/* ========================================================================== */

export function EvGroup(): JSX.Element {
  const evMeta = SIM_BY_ID["expected-value"];
  const kellyMeta = SIM_BY_ID["kelly"];
  const couponMeta = SIM_BY_ID["coupon-collector"];

  return (
    <div className="space-y-6">
      <SimCard
        id={evMeta.id}
        title={evMeta.title}
        whatShows={evMeta.whatShows}
        topics={evMeta.topics}
        howToRead="The solid line is your average payoff so far; the dashed line is the theoretical E[X] = Σ payoff·probability. More trials ⇒ the running average converges to E[X] (a run of luck is averaged away)."
      >
        <ExpectedValueSim />
      </SimCard>

      <SimCard
        id={kellyMeta.id}
        title={kellyMeta.title}
        whatShows={kellyMeta.whatShows}
        topics={kellyMeta.topics}
        howToRead="Each curve is a bankroll (log scale) staking a different fraction with the SAME luck. Full-Kelly (green) climbs fastest over the long run; under-Kelly grows too slowly; over-Kelly (red) swings wildly and can spiral toward ruin."
      >
        <KellySim />
      </SimCard>

      <SimCard
        id={couponMeta.id}
        title={couponMeta.title}
        whatShows={couponMeta.whatShows}
        topics={couponMeta.topics}
        howToRead="The solid line is the empirical mean number of draws to collect all N coupons; the dashed line is the prediction n·H_N (H_N = 1 + ½ + … + 1/N). More trials ⇒ the empirical mean tracks that prediction."
      >
        <CouponCollectorSim />
      </SimCard>
    </div>
  );
}
