/**
 * CoreGroup — the "Core Probability" section of the Simulations tab. Renders
 * three interactive, seedable sims via <SimCard>:
 *   • coin-flips   — running proportion of heads converging to P(heads)
 *   • dice-rolls   — per-face frequency of an N-sided die approaching 1/N
 *   • sample-space — the 36 two-dice outcomes as a grid + event probabilities
 *
 * Each sim is deterministic given its seed; a "Run again" button bumps that
 * seed. The coin sim precomputes the full running series at MAX trials once
 * (useMemo) and slices to the trials-slider value so dragging shows smooth
 * convergence. All colors come from semantic theme tokens.
 */
import { useMemo, useState } from "react";
import { SimCard } from "@/components/simulations/SimCard";
import { LineChart } from "@/components/simulations/charts/LineChart";
import { BarChart } from "@/components/simulations/charts/BarChart";
import { SIM_BY_ID } from "@/lib/simulations/catalog";
import { downsample } from "@/lib/simulations/shared";
import {
  simulateCoinFlips,
  dieFaceCounts,
  twoDiceSumDistribution,
  twoDiceEventCount,
} from "@/lib/simulations/probability";

const MAX_TRIALS = 20000;

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

// ============================================================================
//  coin-flips
// ============================================================================
function CoinFlips(): JSX.Element {
  const meta = SIM_BY_ID["coin-flips"];
  const [pHeads, setPHeads] = useState(0.5);
  const [trials, setTrials] = useState(2000);
  const [seed, setSeed] = useState(1);

  // Precompute the full running series at MAX_TRIALS once per (p, seed); slice
  // to the trials slider so dragging replays the SAME run converging smoothly.
  const full = useMemo(
    () => simulateCoinFlips(pHeads, MAX_TRIALS, seed),
    [pHeads, seed],
  );

  const points = useMemo(() => {
    const sliced = full.slice(0, trials).map((y, i) => ({ x: i + 1, y }));
    return downsample(sliced, 200);
  }, [full, trials]);

  const empirical = trials > 0 ? full[trials - 1] : 0;

  // Callouts: point at the "true p" target line and at an early wiggle of the
  // running series so the chart reads without prior context.
  const earlyIdx = Math.max(1, Math.floor(trials * 0.15));
  const earlyY = full[earlyIdx - 1] ?? empirical;

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="The jagged line is your observed share of heads; the dashed line is the true P(heads) you set. More flips ⇒ the observed proportion settles ever closer to that line — the Law of Large Numbers."
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 block">
            <span className="label flex items-center justify-between">
              <span>P(heads)</span>
              <span className="num text-accent">{pHeads.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={pHeads}
              onChange={(e) => setPHeads(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
          <label className="space-y-1 block">
            <span className="label flex items-center justify-between">
              <span>Flips</span>
              <span className="num text-accent">{trials.toLocaleString()}</span>
            </span>
            <input
              type="range"
              min={10}
              max={MAX_TRIALS}
              step={10}
              value={trials}
              onChange={(e) => setTrials(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-secondary">
            Empirical{" "}
            <span className="num text-primary">{empirical.toFixed(4)}</span>{" "}
            vs theoretical{" "}
            <span className="num text-primary">{pHeads.toFixed(4)}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSeed((s) => s + 1)}
          >
            Run again
          </button>
        </div>

        <LineChart
          series={[{ points, colorClass: "stroke-accent", label: "empirical" }]}
          xLabel="flips"
          yLabel="P(heads)"
          yDomain={[0, 1]}
          refLines={[{ y: pHeads, label: "true p" }]}
          annotations={[
            {
              x: trials * 0.55,
              y: pHeads,
              side: pHeads > 0.5 ? "down" : "up",
              text: "true P(heads): LLN target",
            },
            {
              x: earlyIdx,
              y: earlyY,
              side: earlyY >= pHeads ? "up" : "down",
              text: "running observed proportion",
            },
          ]}
          formatX={(x) => Math.round(x).toLocaleString()}
          ariaLabel="Running proportion of heads converging to the true probability"
        />
      </div>
    </SimCard>
  );
}

// ============================================================================
//  dice-rolls
// ============================================================================
function DiceRolls(): JSX.Element {
  const meta = SIM_BY_ID["dice-rolls"];
  const [sides, setSides] = useState(6);
  const [rolls, setRolls] = useState(2000);
  const [seed, setSeed] = useState(1);

  const counts = useMemo(
    () => dieFaceCounts(sides, rolls, seed),
    [sides, rolls, seed],
  );

  const theoretical = 1 / sides;
  const bars = counts.map((c, i) => ({
    label: String(i + 1),
    value: rolls > 0 ? c / rolls : 0,
    theoretical,
  }));

  const maxDev = bars.reduce(
    (m, b) => Math.max(m, Math.abs(b.value - theoretical)),
    0,
  );

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="Each bar is how often a face actually came up; the flat dashed markers are the fair target 1/N. More rolls ⇒ every bar flattens toward its 1/N marker (max deviation shrinks)."
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 block">
            <span className="label flex items-center justify-between">
              <span>Sides</span>
              <span className="num text-accent">{sides}</span>
            </span>
            <input
              type="number"
              min={2}
              max={20}
              value={sides}
              onChange={(e) =>
                setSides(clamp(Math.round(Number(e.target.value)), 2, 20))
              }
              className="input w-full"
            />
          </label>
          <label className="space-y-1 block">
            <span className="label flex items-center justify-between">
              <span>Rolls</span>
              <span className="num text-accent">{rolls.toLocaleString()}</span>
            </span>
            <input
              type="range"
              min={10}
              max={MAX_TRIALS}
              step={10}
              value={rolls}
              onChange={(e) => setRolls(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-secondary">
            Theoretical 1/N ={" "}
            <span className="num text-primary">{theoretical.toFixed(4)}</span> ·
            max empirical deviation{" "}
            <span className="num text-primary">{maxDev.toFixed(4)}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSeed((s) => s + 1)}
          >
            Run again
          </button>
        </div>

        <BarChart
          bars={bars}
          yLabel="P(face)"
          theoreticalAs="marker"
          theoreticalColorClass="stroke-bear"
          maxXLabels={20}
          annotations={[
            {
              barIndex: 0,
              y: theoretical,
              side: "up",
              text: "1/N: fair target for every face",
            },
          ]}
          ariaLabel="Empirical proportion of each die face versus the theoretical 1/N"
        />
      </div>
    </SimCard>
  );
}

// ============================================================================
//  sample-space
// ============================================================================
type EventId = "sum-eq" | "doubles" | "sum-ge-8" | "one-six";

function makePredicate(
  event: EventId,
  targetSum: number,
): (a: number, b: number) => boolean {
  switch (event) {
    case "sum-eq":
      return (a, b) => a + b === targetSum;
    case "doubles":
      return (a, b) => a === b;
    case "sum-ge-8":
      return (a, b) => a + b >= 8;
    case "one-six":
      return (a, b) => a === 6 || b === 6;
  }
}

function SampleSpace(): JSX.Element {
  const meta = SIM_BY_ID["sample-space"];
  const [event, setEvent] = useState<EventId>("sum-eq");
  const [targetSum, setTargetSum] = useState(7);

  const predicate = makePredicate(event, targetSum);
  const count = twoDiceEventCount(predicate);
  const prob = count / 36;

  const dist = twoDiceSumDistribution();
  const bars = dist.map((d) => ({ label: String(d.sum), value: d.prob }));

  const dice = [1, 2, 3, 4, 5, 6];

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="The 6×6 grid is every equally-likely (die A, die B) outcome. Highlighted cells are the ones your event counts, so its probability = highlighted ÷ 36. The bar chart below is the distribution of the two-dice sum — it peaks at 7 because 7 has the most cell combinations."
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 block">
            <span className="label">Event</span>
            <select
              value={event}
              onChange={(e) => setEvent(e.target.value as EventId)}
              className="input w-full"
            >
              <option value="sum-eq">Sum = {targetSum}</option>
              <option value="doubles">Doubles</option>
              <option value="sum-ge-8">Sum ≥ 8</option>
              <option value="one-six">At least one 6</option>
            </select>
          </label>
          <label className="space-y-1 block">
            <span className="label flex items-center justify-between">
              <span>Target sum</span>
              <span className="num text-accent">{targetSum}</span>
            </span>
            <input
              type="range"
              min={2}
              max={12}
              step={1}
              value={targetSum}
              onChange={(e) => setTargetSum(Number(e.target.value))}
              disabled={event !== "sum-eq"}
              className="w-full accent-accent disabled:opacity-40"
            />
          </label>
        </div>

        <div className="text-sm text-secondary">
          Favorable outcomes{" "}
          <span className="num text-primary">{count}</span>/36 · probability{" "}
          <span className="num text-primary">{prob.toFixed(4)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-accent" />
            favorable outcome (counted)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm border border-subtle bg-surface-muted" />
            other outcome
          </span>
          <span>P(event) = favorable ÷ 36</span>
        </div>

        <div className="grid grid-cols-6 gap-1">
          {dice.map((a) =>
            dice.map((b) => {
              const hit = predicate(a, b);
              return (
                <div
                  key={`${a}-${b}`}
                  className={`flex aspect-square items-center justify-center rounded border border-subtle text-xs num ${
                    hit
                      ? "bg-accent text-accent-contrast"
                      : "bg-surface-muted text-secondary"
                  }`}
                >
                  {a},{b}
                </div>
              );
            }),
          )}
        </div>

        <BarChart
          bars={bars}
          yLabel="P(sum)"
          colorClass="fill-accent-2"
          annotations={[
            {
              barIndex: 5,
              side: "up",
              text: "peak at 7: most combinations",
            },
          ]}
          ariaLabel="Probability distribution of the sum of two dice"
        />
      </div>
    </SimCard>
  );
}

export function CoreGroup(): JSX.Element {
  return (
    <div className="space-y-6">
      <CoinFlips />
      <DiceRolls />
      <SampleSpace />
    </div>
  );
}
