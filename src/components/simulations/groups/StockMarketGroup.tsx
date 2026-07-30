/**
 * StockMarketGroup — the "Real-World Scenarios" STOCK sims: a biased random-walk
 * stock where the user calls Buy / Sell / Hold and the EV-optimal action follows
 * from the drift, and a 2-state Markov bull/bear regime whose stationary mix
 * sets the long-run drift. Pure math lives in `@/lib/simulations/stockMarket`;
 * this file is presentation + controls only, themed entirely through semantic
 * tokens so it reads correctly across all six themes (light + dark, AA).
 */
import { useMemo, useState } from "react";
import { SIM_BY_ID } from "@/lib/simulations/catalog";
import { SimCard } from "@/components/simulations/SimCard";
import { LineChart } from "@/components/simulations/charts/LineChart";
import { BarChart } from "@/components/simulations/charts/BarChart";
import { downsample, roundTo } from "@/lib/simulations/shared";
import {
  BULL,
  BEAR,
  bucketize,
  expectedActionPnL,
  expectedFinalPrice,
  overallDrift,
  recommendedAction,
  regimeStationary,
  runningAveragePnL,
  simulateFinalPnLs,
  simulatePricePath,
  simulateRegimePath,
  stepDrift,
  type RegimeModel,
  type TradeAction,
} from "@/lib/simulations/stockMarket";

const S0 = 100;
const TICK = 1;
const MAX_PLOT_POINTS = 400;
const HIST_BINS = 19;

const ACTION_LABEL: Record<TradeAction, string> = {
  buy: "Buy (go long)",
  sell: "Sell / short",
  hold: "Hold (stay flat)",
};

function fmtSigned(x: number): string {
  const r = roundTo(x, 2);
  return r > 0 ? `+${r}` : `${r}`;
}

function RandomWalkStockSim(): JSX.Element {
  const meta = SIM_BY_ID["stock-random-walk"];
  const [p, setP] = useState(0.55);
  const [steps, setSteps] = useState(60);
  const [trials, setTrials] = useState(4000);
  const [action, setAction] = useState<TradeAction>("buy");
  const [seed, setSeed] = useState(1);

  const drift = stepDrift(p, TICK);
  const best = recommendedAction(p, TICK);
  const evByAction = {
    buy: expectedActionPnL("buy", p, TICK, steps),
    sell: expectedActionPnL("sell", p, TICK, steps),
    hold: 0,
  };
  const chosenEv = evByAction[action];
  const bestEv = evByAction[best];
  const isOptimal = action === best;

  const path = useMemo(
    () => simulatePricePath(S0, p, TICK, steps, seed),
    [p, steps, seed],
  );
  const pathPoints = useMemo(
    () => downsample(path.map((price, i) => ({ x: i, y: price })), MAX_PLOT_POINTS),
    [path],
  );
  const expFinal = expectedFinalPrice(S0, p, TICK, steps);

  const pnls = useMemo(
    () => simulateFinalPnLs(action, S0, p, TICK, steps, trials, seed + 1000),
    [action, p, steps, trials, seed],
  );

  const buckets = useMemo(() => bucketize(pnls, HIST_BINS), [pnls]);
  const bars = useMemo(
    () => buckets.map((b) => ({ label: String(Math.round(b.center)), value: b.count })),
    [buckets],
  );
  const evBucketIndex = useMemo(() => {
    if (buckets.length === 0) return 0;
    let idx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < buckets.length; i++) {
      const d = Math.abs(buckets[i].center - chosenEv);
      if (d < bestDist) {
        bestDist = d;
        idx = i;
      }
    }
    return idx;
  }, [buckets, chosenEv]);

  const convergence = useMemo(() => {
    const avg = runningAveragePnL(pnls);
    const paired = avg.map((y, i) => ({ x: i + 1, y }));
    return downsample(paired, MAX_PLOT_POINTS);
  }, [pnls]);
  const empiricalMean = convergence.length
    ? convergence[convergence.length - 1].y
    : 0;

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="Top: one sample price path — a biased random walk that ticks up with probability p, down otherwise. The dashed line is E[price] = S0 + steps·(per-step drift). Middle: the spread of your trade's final P&L over many independent runs; its mean sits at the EV. Bottom: the running-average P&L converging to that EV as trials pile up. The max-EV action is whichever side the drift points — buy if the stock drifts up, short if it drifts down, hold when the coin is fair."
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1">
            <div className="label text-secondary">
              P(up each step) ={" "}
              <span className="num text-primary">{roundTo(p, 2)}</span>
            </div>
            <input
              type="range"
              min={0.05}
              max={0.95}
              step={0.01}
              value={p}
              onChange={(e) => setP(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
          <label className="space-y-1">
            <div className="label text-secondary">
              steps (horizon) ={" "}
              <span className="num text-primary">{steps}</span>
            </div>
            <input
              type="range"
              min={10}
              max={200}
              step={5}
              value={steps}
              onChange={(e) => setSteps(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
          <label className="space-y-1">
            <div className="label text-secondary">
              trials ={" "}
              <span className="num text-primary">{trials.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={200}
              max={20000}
              step={200}
              value={trials}
              onChange={(e) => setTrials(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="label text-secondary">Your call:</span>
          {(["buy", "sell", "hold"] as TradeAction[]).map((a) => (
            <button
              key={a}
              type="button"
              className={action === a ? "btn btn-primary" : "btn btn-secondary"}
              onClick={() => setAction(a)}
            >
              {ACTION_LABEL[a]}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSeed((s) => s + 1)}
          >
            Run again
          </button>
        </div>

        <LineChart
          series={[
            {
              points: pathPoints,
              colorClass: drift >= 0 ? "stroke-bull" : "stroke-bear",
              label: "sample price path",
            },
          ]}
          xLabel="step"
          yLabel="price"
          refLines={[
            { y: S0, label: `S0 = ${S0}`, colorClass: "stroke-subtle" },
            {
              y: expFinal,
              label: `E[price] = ${roundTo(expFinal, 1)}`,
              colorClass: "stroke-accent",
            },
          ]}
          annotations={[
            {
              x: steps * 0.3,
              y: path[Math.floor(steps * 0.3)] ?? S0,
              side: "up",
              text: "biased random walk",
            },
            {
              x: steps * 0.62,
              y: expFinal,
              side: drift >= 0 ? "up" : "down",
              text: "E[price]: S0 + steps·drift",
            },
          ]}
          ariaLabel="A sample biased random-walk price path with its expected final price"
        />

        <BarChart
          bars={bars}
          yLabel="count of trials"
          colorClass="fill-accent"
          annotations={[
            {
              barIndex: evBucketIndex,
              text: `mean P&L ≈ EV = ${fmtSigned(chosenEv)}`,
              side: "up",
            },
          ]}
          ariaLabel="Distribution of final P&L for your action across many trials"
        />

        <LineChart
          series={[
            {
              points: convergence,
              colorClass: "stroke-accent",
              label: "running average P&L",
            },
          ]}
          xLabel="trials"
          yLabel="avg P&L"
          refLines={[
            {
              y: chosenEv,
              label: `EV = ${fmtSigned(chosenEv)}`,
              colorClass: "stroke-bull",
            },
          ]}
          annotations={[
            {
              x: Math.max(2, trials * 0.5),
              y: chosenEv,
              side: chosenEv >= 0 ? "down" : "up",
              text: "running avg → EV",
            },
          ]}
          ariaLabel="Running-average P&L converging to the expected value"
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="panel-ruled p-3">
            <div className="label text-secondary">Per-step drift (EV)</div>
            <div className="num text-lg text-primary">{fmtSigned(drift)}</div>
          </div>
          <div className="panel-ruled p-3">
            <div className="label text-secondary">EV of your call</div>
            <div className="num text-lg text-primary">{fmtSigned(chosenEv)}</div>
          </div>
          <div className="panel-ruled p-3">
            <div className="label text-secondary">Empirical mean P&L</div>
            <div className="num text-lg text-primary">
              {fmtSigned(empiricalMean)}
            </div>
          </div>
          <div className="panel-ruled p-3">
            <div className="label text-secondary">Max-EV action</div>
            <div className="num text-lg text-primary">{ACTION_LABEL[best]}</div>
          </div>
        </div>

        <div
          className={
            isOptimal
              ? "panel-ruled border-l-4 border-bull p-3"
              : "panel-ruled border-l-4 border-bear p-3"
          }
        >
          <div className="label text-secondary">Verdict</div>
          <p className="mt-1 text-sm text-primary">
            {isOptimal ? (
              <>
                Your call is the max-EV action — you side with the drift, earning{" "}
                <span className="num">{fmtSigned(chosenEv)}</span> per run on
                average.
              </>
            ) : (
              <>
                Your call is <span className="num">−EV</span> vs the optimum:{" "}
                <span className="num">{fmtSigned(chosenEv)}</span> against{" "}
                <span className="num">{fmtSigned(bestEv)}</span> for{" "}
                {ACTION_LABEL[best]}. Follow the drift.
              </>
            )}
          </p>
        </div>
      </div>
    </SimCard>
  );
}

const REGIME_STEPS = 240;

function BullBearRegimeSim(): JSX.Element {
  const meta = SIM_BY_ID["stock-regime-markov"];
  const [pBull, setPBull] = useState(0.58);
  const [pBear, setPBear] = useState(0.42);
  const [stayBull, setStayBull] = useState(0.92);
  const [stayBear, setStayBear] = useState(0.85);
  const [startRegime, setStartRegime] = useState(BULL);
  const [seed, setSeed] = useState(1);

  const model: RegimeModel = useMemo(
    () => ({ pBull, pBear, stayBull, stayBear, tick: TICK }),
    [pBull, pBear, stayBull, stayBear],
  );

  const stationary = useMemo(() => regimeStationary(model), [model]);
  const drift = useMemo(() => overallDrift(model), [model]);

  const rp = useMemo(
    () => simulateRegimePath(model, S0, startRegime, REGIME_STEPS, seed),
    [model, startRegime, seed],
  );

  const pathPoints = useMemo(
    () =>
      downsample(
        rp.prices.map((price, i) => ({ x: i, y: price })),
        MAX_PLOT_POINTS,
      ),
    [rp],
  );

  // First step index in each regime, so we can point a callout at a real
  // bull segment and a real bear segment on the sample path.
  const firstBull = rp.regimes.findIndex((r) => r === BULL);
  const firstBear = rp.regimes.findIndex((r) => r === BEAR);
  const annotations = [];
  if (firstBull >= 0) {
    annotations.push({
      x: firstBull,
      y: rp.prices[firstBull],
      side: "up" as const,
      text: "bull: upward drift",
    });
  }
  if (firstBear >= 0) {
    annotations.push({
      x: firstBear,
      y: rp.prices[firstBear],
      side: "down" as const,
      text: "bear: downward drift",
    });
  }

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="A two-state Markov chain flips the market between a bull regime (P(up) high, upward drift) and a bear regime (P(up) low, downward drift). The stay-sliders are the diagonal of the transition matrix; the further they are from 1, the more often the regime switches. The long-run mix π is the chain's stationary distribution, and the stock's overall drift is π-weighted across the two regimes — that weighted drift is the EV the price trends along once the regimes have mixed."
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <div className="label text-secondary">
              Bull P(up) ={" "}
              <span className="num text-primary">{roundTo(pBull, 2)}</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={0.9}
              step={0.01}
              value={pBull}
              onChange={(e) => setPBull(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
          <label className="space-y-1">
            <div className="label text-secondary">
              Bear P(up) ={" "}
              <span className="num text-primary">{roundTo(pBear, 2)}</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={0.5}
              step={0.01}
              value={pBear}
              onChange={(e) => setPBear(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
          <label className="space-y-1">
            <div className="label text-secondary">
              P(stay Bull) ={" "}
              <span className="num text-primary">{roundTo(stayBull, 2)}</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={0.99}
              step={0.01}
              value={stayBull}
              onChange={(e) => setStayBull(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
          <label className="space-y-1">
            <div className="label text-secondary">
              P(stay Bear) ={" "}
              <span className="num text-primary">{roundTo(stayBear, 2)}</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={0.99}
              step={0.01}
              value={stayBear}
              onChange={(e) => setStayBear(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="label text-secondary">Start in:</span>
          <button
            type="button"
            className={startRegime === BULL ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setStartRegime(BULL)}
          >
            Bull
          </button>
          <button
            type="button"
            className={startRegime === BEAR ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setStartRegime(BEAR)}
          >
            Bear
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSeed((s) => s + 1)}
          >
            Run again
          </button>
        </div>

        <LineChart
          series={[
            {
              points: pathPoints,
              colorClass: drift >= 0 ? "stroke-bull" : "stroke-bear",
              label: "regime-switching price path",
            },
          ]}
          xLabel="step"
          yLabel="price"
          refLines={[{ y: S0, label: `S0 = ${S0}`, colorClass: "stroke-subtle" }]}
          annotations={annotations}
          ariaLabel="A regime-switching stock price path with bull and bear segments annotated"
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="panel-ruled p-3">
            <div className="label text-secondary">π (long-run mix)</div>
            <div className="num text-lg text-primary">
              bull {roundTo(stationary[BULL], 3)} · bear{" "}
              {roundTo(stationary[BEAR], 3)}
            </div>
          </div>
          <div className="panel-ruled p-3">
            <div className="label text-secondary">Simulated occupancy</div>
            <div className="num text-lg text-primary">
              bull {roundTo(rp.occupancy[BULL], 3)} · bear{" "}
              {roundTo(rp.occupancy[BEAR], 3)}
            </div>
          </div>
          <div className="panel-ruled p-3">
            <div className="label text-secondary">Bull / Bear drift</div>
            <div className="num text-lg text-primary">
              {fmtSigned(stepDrift(pBull, TICK))} /{" "}
              {fmtSigned(stepDrift(pBear, TICK))}
            </div>
          </div>
          <div className="panel-ruled p-3">
            <div className="label text-secondary">Overall drift (EV)</div>
            <div className="num text-lg text-primary">{fmtSigned(drift)}</div>
          </div>
        </div>
      </div>
    </SimCard>
  );
}

export function StockMarketGroup(): JSX.Element {
  return (
    <div className="space-y-6">
      <RandomWalkStockSim />
      <BullBearRegimeSim />
    </div>
  );
}
