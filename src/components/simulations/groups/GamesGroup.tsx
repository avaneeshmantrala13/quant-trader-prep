/**
 * GamesGroup — the "Conditional Probability, Geometry & Games" section of the
 * Simulations tab. Renders four interactive sims via <SimCard>:
 *   • monty-hall               — stay vs switch running win % (→ 1/3 vs 2/3)
 *   • bayes-natural-frequency  — base rate + test accuracy as counts out of 1000
 *   • geometric-dartboard      — uniform darts estimate π/4 (and π)
 *   • game-theory-matrix       — solve a 2×2 zero-sum game (value + mixes)
 *
 * The seedable sims precompute their full running series at MAX games once
 * (useMemo) and slice to the games slider so dragging replays the same run; a
 * "Run again" button bumps the seed. Bayes and the game solver are exact (no
 * RNG). All colors come from semantic theme tokens.
 */
import { useMemo, useState } from "react";
import { SimCard } from "@/components/simulations/SimCard";
import { LineChart } from "@/components/simulations/charts/LineChart";
import { BarChart } from "@/components/simulations/charts/BarChart";
import { SIM_BY_ID } from "@/lib/simulations/catalog";
import { downsample } from "@/lib/simulations/shared";
import {
  simulateMontyHall,
  bayesPosterior,
  naturalFrequencyCounts,
  simulateDartboard,
  mixedStrategySolution,
  CIRCLE_AREA_RATIO,
} from "@/lib/simulations/games";

const MAX_GAMES = 20000;

// ============================================================================
//  monty-hall
// ============================================================================
function MontyHall(): JSX.Element {
  const meta = SIM_BY_ID["monty-hall"];
  const [games, setGames] = useState(2000);
  const [seed, setSeed] = useState(1);

  // Precompute both full running series at MAX_GAMES once per seed; slice to
  // the games slider so dragging replays the SAME run converging smoothly.
  const switchFull = useMemo(
    () => simulateMontyHall(true, MAX_GAMES, seed),
    [seed],
  );
  const stayFull = useMemo(
    () => simulateMontyHall(false, MAX_GAMES, seed),
    [seed],
  );

  const { switchPoints, stayPoints } = useMemo(() => {
    const toPts = (full: number[]) =>
      downsample(
        full.slice(0, games).map((y, i) => ({ x: i + 1, y })),
        200,
      );
    return { switchPoints: toPts(switchFull), stayPoints: toPts(stayFull) };
  }, [switchFull, stayFull, games]);

  const switchWin = games > 0 ? switchFull[games - 1] : 0;
  const stayWin = games > 0 ? stayFull[games - 1] : 0;

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="Green is your win rate if you always SWITCH doors; red if you always STAY. More games ⇒ switching converges to ~2/3 and staying to ~1/3, because the host's reveal transfers the other two doors' odds onto the switch door."
    >
      <div className="space-y-4">
        <label className="space-y-1 block">
          <span className="label flex items-center justify-between">
            <span>Games</span>
            <span className="num text-accent">{games.toLocaleString()}</span>
          </span>
          <input
            type="range"
            min={10}
            max={MAX_GAMES}
            step={10}
            value={games}
            onChange={(e) => setGames(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-secondary">
            Switch{" "}
            <span className="num text-bull">
              {(switchWin * 100).toFixed(1)}%
            </span>{" "}
            · Stay{" "}
            <span className="num text-bear">{(stayWin * 100).toFixed(1)}%</span>
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
          series={[
            { points: switchPoints, colorClass: "stroke-bull", label: "switch" },
            { points: stayPoints, colorClass: "stroke-bear", label: "stay" },
          ]}
          xLabel="games"
          yLabel="win proportion"
          yDomain={[0, 1]}
          refLines={[
            { y: 2 / 3, label: "2/3" },
            { y: 1 / 3, label: "1/3" },
          ]}
          annotations={[
            {
              x: games * 0.5,
              y: 2 / 3,
              side: "up",
              text: "switch wins ~2/3",
            },
            {
              x: games * 0.5,
              y: 1 / 3,
              side: "down",
              text: "stay wins ~1/3",
            },
          ]}
          formatX={(x) => Math.round(x).toLocaleString()}
          ariaLabel="Running win proportion for staying versus switching in Monty Hall"
        />
      </div>
    </SimCard>
  );
}

// ============================================================================
//  bayes-natural-frequency
// ============================================================================
function BayesNaturalFrequency(): JSX.Element {
  const meta = SIM_BY_ID["bayes-natural-frequency"];
  const [prior, setPrior] = useState(0.01);
  const [sens, setSens] = useState(0.9);
  const [fpr, setFpr] = useState(0.09);

  const counts = naturalFrequencyCounts(prior, sens, fpr);
  const posterior = bayesPosterior(prior, sens, fpr);
  const have = counts.haveAndPos + counts.haveAndNeg;
  const noCond = counts.noAndPos + counts.noAndNeg;

  const bars = [
    { label: "TP", value: counts.haveAndPos },
    { label: "FN", value: counts.haveAndNeg },
    { label: "FP", value: counts.noAndPos },
    { label: "TN", value: counts.noAndNeg },
  ];

  const sliders: {
    key: string;
    label: string;
    value: number;
    set: (v: number) => void;
  }[] = [
    { key: "prior", label: "Base rate P(disease)", value: prior, set: setPrior },
    { key: "sens", label: "Sensitivity P(+ | disease)", value: sens, set: setSens },
    {
      key: "fpr",
      label: "False-positive P(+ | healthy)",
      value: fpr,
      set: setFpr,
    },
  ];

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="Of 1000 people, only a few actually have the disease (TP + FN). The bars are the four groups: true/false positives and negatives. Because the healthy group is huge, its false positives (FP) usually outnumber the true positives (TP), so P(disease | +) = TP ÷ (TP + FP) stays small even with an accurate test."
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {sliders.map((s) => (
            <label key={s.key} className="space-y-1 block">
              <span className="label flex items-center justify-between">
                <span>{s.label}</span>
                <span className="num text-accent">
                  {(s.value * 100).toFixed(1)}%
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.005}
                value={s.value}
                onChange={(e) => s.set(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </label>
          ))}
        </div>

        {/* Natural-frequency tree out of 1000 */}
        <div className="panel-ruled space-y-3 p-4">
          <div className="label text-secondary">
            Out of{" "}
            <span className="num text-primary">
              {counts.total.toLocaleString()}
            </span>{" "}
            people
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm text-secondary">
                Have disease{" "}
                <span className="num text-primary">{have}</span>
              </div>
              <div className="flex gap-2">
                <span className="chip text-bull">
                  Test + <span className="num">{counts.haveAndPos}</span>
                </span>
                <span className="chip text-muted">
                  Test − <span className="num">{counts.haveAndNeg}</span>
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-secondary">
                Healthy{" "}
                <span className="num text-primary">{noCond}</span>
              </div>
              <div className="flex gap-2">
                <span className="chip bg-accent text-accent-contrast">
                  Test + <span className="num">{counts.noAndPos}</span>
                </span>
                <span className="chip text-muted">
                  Test − <span className="num">{counts.noAndNeg}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="text-xs text-muted">
            The highlighted{" "}
            <span className="num text-accent">{counts.noAndPos}</span> healthy
            people who test positive are the false alarms that make a positive
            result far less alarming than it seems.
          </div>
        </div>

        <div className="text-sm text-secondary">
          P(disease | positive) ={" "}
          <span className="num text-primary">
            {(posterior * 100).toFixed(1)}%
          </span>
          , only{" "}
          <span className="num text-accent">{counts.haveAndPos}</span> of{" "}
          <span className="num text-primary">
            {counts.haveAndPos + counts.noAndPos}
          </span>{" "}
          positives are true positives.
        </div>

        <BarChart
          bars={bars}
          yLabel="people"
          colorClass="fill-accent-2"
          annotations={[
            {
              barIndex: 2,
              side: "up",
              text: "false positives (healthy, test +) dominate",
            },
          ]}
          ariaLabel="Natural-frequency breakdown of true/false positives and negatives"
        />
      </div>
    </SimCard>
  );
}

// ============================================================================
//  geometric-dartboard
// ============================================================================
const DART_VIEW = 320;

function Dartboard(): JSX.Element {
  const meta = SIM_BY_ID["geometric-dartboard"];
  const [darts, setDarts] = useState(2000);
  const [seed, setSeed] = useState(1);

  const result = useMemo(
    () => simulateDartboard(darts, seed, 1500),
    [darts, seed],
  );

  const piEstimate = result.proportion * 4;

  // Map unit-square coords → SVG (y flipped so the arc bulges to the corner).
  const sx = (x: number): number => x * DART_VIEW;
  const sy = (y: number): number => DART_VIEW - y * DART_VIEW;
  const arc = `M ${sx(1)} ${sy(0)} A ${DART_VIEW} ${DART_VIEW} 0 0 1 ${sx(
    0,
  )} ${sy(1)}`;

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="Darts land uniformly at random in the unit square. Green dots fall inside the quarter-circle, red dots outside. Since the darts are uniform, the fraction landing inside estimates the shape's area ratio (here π/4); more darts ⇒ a sharper estimate, so 4× the inside fraction approximates π."
    >
      <div className="space-y-4">
        <label className="space-y-1 block">
          <span className="label flex items-center justify-between">
            <span>Darts</span>
            <span className="num text-accent">{darts.toLocaleString()}</span>
          </span>
          <input
            type="range"
            min={10}
            max={MAX_GAMES}
            step={10}
            value={darts}
            onChange={(e) => setDarts(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-secondary">
            Inside{" "}
            <span className="num text-primary">
              {result.proportion.toFixed(4)}
            </span>{" "}
            vs π/4 ={" "}
            <span className="num text-primary">
              {CIRCLE_AREA_RATIO.toFixed(4)}
            </span>{" "}
            · π ≈{" "}
            <span className="num text-accent">{piEstimate.toFixed(4)}</span>{" "}
            (true {Math.PI.toFixed(4)})
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSeed((s) => s + 1)}
          >
            Run again
          </button>
        </div>

        <div className="flex justify-center">
          <svg
            viewBox={`0 0 ${DART_VIEW} ${DART_VIEW}`}
            className="h-auto w-full max-w-xs"
            role="img"
            aria-label="Uniformly random darts in a unit square estimating the area of a quarter circle"
          >
            <rect
              x={0}
              y={0}
              width={DART_VIEW}
              height={DART_VIEW}
              className="fill-surface-muted stroke-border-strong"
              strokeWidth={1.5}
            />
            <path
              d={arc}
              fill="none"
              className="stroke-accent"
              strokeWidth={1.5}
            />
            {result.points.map((p, i) => (
              <circle
                key={i}
                cx={sx(p.x)}
                cy={sy(p.y)}
                r={1.4}
                className={p.inside ? "fill-bull" : "fill-bear"}
              />
            ))}
            <text
              x={sx(0.26)}
              y={sy(0.26)}
              textAnchor="middle"
              fontSize={11}
              className="fill-primary font-mono"
            >
              inside ≈ area (π/4)
            </text>
            <text
              x={sx(0.82)}
              y={sy(0.86)}
              textAnchor="middle"
              fontSize={11}
              className="fill-muted font-mono"
            >
              outside
            </text>
          </svg>
        </div>
      </div>
    </SimCard>
  );
}

// ============================================================================
//  game-theory-matrix
// ============================================================================
type Matrix = [[number, number], [number, number]];

const PRESETS: { key: string; label: string; matrix: Matrix }[] = [
  { key: "pennies", label: "Matching pennies", matrix: [[1, -1], [-1, 1]] },
  { key: "saddle", label: "Saddle example", matrix: [[4, 3], [2, 1]] },
];

function GameTheoryMatrix(): JSX.Element {
  const meta = SIM_BY_ID["game-theory-matrix"];
  const [matrix, setMatrix] = useState<Matrix>([
    [1, -1],
    [-1, 1],
  ]);

  const sol = useMemo(() => mixedStrategySolution(matrix), [matrix]);

  const setCell = (r: number, c: number, v: number): void => {
    setMatrix((prev) => {
      const next: Matrix = [
        [prev[0][0], prev[0][1]],
        [prev[1][0], prev[1][1]],
      ];
      next[r][c] = v;
      return next;
    });
  };

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="Enter the row player's payoffs (the column player gets the negative, so it's zero-sum). The game value is the payoff both players can guarantee with optimal play. If there's a pure saddle point, both play one action; otherwise each must MIX their two actions with the probabilities shown so the opponent can't exploit a pattern."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className="btn btn-secondary"
              onClick={() => setMatrix(p.matrix)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="label text-secondary">Payoff matrix A (row)</div>
            <div className="grid grid-cols-2 gap-2 max-w-[16rem]">
              {[0, 1].map((r) =>
                [0, 1].map((c) => (
                  <input
                    key={`${r}-${c}`}
                    type="number"
                    step={1}
                    value={matrix[r][c]}
                    onChange={(e) => setCell(r, c, Number(e.target.value))}
                    className="input w-full num"
                    aria-label={`A row ${r + 1} column ${c + 1}`}
                  />
                )),
              )}
            </div>
          </div>

          <div className="panel-ruled space-y-2 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-secondary">Game value</span>
              <span className="num text-primary">{sol.value.toFixed(4)}</span>
            </div>
            <p className="text-[11px] leading-tight text-muted">
              The value both players can guarantee; the mixes below are each
              player's optimal (unexploitable) strategy.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-secondary">Pure saddle point?</span>
              <span
                className={`num ${sol.saddle ? "text-bull" : "text-bear"}`}
              >
                {sol.saddle ? "yes" : "no"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-secondary">Row mix (r1, r2)</span>
              <span className="num text-primary">
                {sol.rowStrategy[0].toFixed(3)}, {sol.rowStrategy[1].toFixed(3)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-secondary">Col mix (c1, c2)</span>
              <span className="num text-primary">
                {sol.colStrategy[0].toFixed(3)}, {sol.colStrategy[1].toFixed(3)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </SimCard>
  );
}

export function GamesGroup(): JSX.Element {
  return (
    <div className="space-y-6">
      <MontyHall />
      <BayesNaturalFrequency />
      <Dartboard />
      <GameTheoryMatrix />
    </div>
  );
}
