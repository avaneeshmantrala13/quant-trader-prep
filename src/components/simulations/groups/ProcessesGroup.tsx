/**
 * ProcessesGroup — the "Markov Chains & Processes" sims: a 2-state Markov chain
 * converging to its stationary distribution, and Gambler's Ruin / random walk
 * where the empirical reach-target probability meets the closed-form answer.
 * Pure math lives in `@/lib/simulations/processes`; this file is presentation
 * + controls only, themed entirely through semantic tokens.
 */
import { useMemo, useState } from "react";
import { SIM_BY_ID } from "@/lib/simulations/catalog";
import { SimCard } from "@/components/simulations/SimCard";
import { LineChart } from "@/components/simulations/charts/LineChart";
import { downsample, range, roundTo } from "@/lib/simulations/shared";
import {
  stationaryDistribution,
  evolveDistribution,
  simulateChainOccupancy,
  gamblersRuinReachTarget,
  simulateGamblersRuinReach,
  simulateWalkTrajectory,
} from "@/lib/simulations/processes";

const MARKOV_STEPS = 40;
const OCCUPANCY_STEPS = 20000;
const MAX_PLOT_POINTS = 400;

function MarkovChainSim(): JSX.Element {
  const meta = SIM_BY_ID["markov-chain"];
  const [a, setA] = useState(0.9); // P(stay in State 1)
  const [b, setB] = useState(0.6); // P(stay in State 2)
  const [startState, setStartState] = useState(0); // 0 → State 1, 1 → State 2
  const [seed, setSeed] = useState(1);

  const P = useMemo(
    () => [
      [a, 1 - a],
      [1 - b, b],
    ],
    [a, b],
  );

  const stationary = useMemo(() => stationaryDistribution(P), [P]);

  const initial = useMemo(
    () => (startState === 0 ? [1, 0] : [0, 1]),
    [startState],
  );

  const trajectory = useMemo(
    () => evolveDistribution(P, initial, MARKOV_STEPS),
    [P, initial],
  );

  const occupancy = useMemo(
    () => simulateChainOccupancy(P, startState, OCCUPANCY_STEPS, seed),
    [P, startState, seed],
  );

  const steps = range(trajectory.length);
  const series = useMemo(
    () => [
      {
        points: steps.map((s) => ({ x: s, y: trajectory[s][0] })),
        colorClass: "stroke-accent",
        label: "P(State 1)",
      },
      {
        points: steps.map((s) => ({ x: s, y: trajectory[s][1] })),
        colorClass: "stroke-accent-2",
        label: "P(State 2)",
      },
    ],
    [steps, trajectory],
  );

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="The two solid lines are the probability of being in each state after each step, starting from your chosen state; the dashed lines are the stationary distribution π. More steps ⇒ the state probabilities forget the start and settle onto π, regardless of where you began."
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <div className="label text-secondary">
              a = P(stay in State 1):{" "}
              <span className="num text-primary">{roundTo(a, 2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={a}
              onChange={(e) => setA(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
          <label className="space-y-1">
            <div className="label text-secondary">
              b = P(stay in State 2):{" "}
              <span className="num text-primary">{roundTo(b, 2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={b}
              onChange={(e) => setB(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="label text-secondary">Start in:</span>
          <button
            type="button"
            className={startState === 0 ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setStartState(0)}
          >
            State 1
          </button>
          <button
            type="button"
            className={startState === 1 ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setStartState(1)}
          >
            State 2
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
          series={series}
          xLabel="step"
          yLabel="probability"
          xDomain={[0, MARKOV_STEPS]}
          yDomain={[0, 1]}
          refLines={[
            {
              y: stationary[0],
              label: `π(State 1) = ${roundTo(stationary[0], 3)}`,
              colorClass: "stroke-accent",
            },
            {
              y: stationary[1],
              label: `π(State 2) = ${roundTo(stationary[1], 3)}`,
              colorClass: "stroke-accent-2",
            },
          ]}
          annotations={[
            {
              x: MARKOV_STEPS * 0.6,
              y: stationary[0],
              side: stationary[0] >= 0.5 ? "down" : "up",
              text: "stationary π: the long-run mix",
            },
          ]}
          ariaLabel="State distribution converging to the stationary distribution"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="panel-ruled p-3">
            <div className="label text-secondary">Stationary distribution</div>
            <div className="num text-lg text-primary">
              [{roundTo(stationary[0], 3)}, {roundTo(stationary[1], 3)}]
            </div>
          </div>
          <div className="panel-ruled p-3">
            <div className="label text-secondary">
              Simulated occupancy ({OCCUPANCY_STEPS.toLocaleString()} steps)
            </div>
            <div className="num text-lg text-primary">
              [{roundTo(occupancy[0], 3)}, {roundTo(occupancy[1], 3)}]
            </div>
          </div>
        </div>
      </div>
    </SimCard>
  );
}

function GamblersRuinSim(): JSX.Element {
  const meta = SIM_BY_ID["gamblers-ruin"];
  const [p, setP] = useState(0.5);
  const [target, setTarget] = useState(10);
  const [start, setStart] = useState(4);
  const [games, setGames] = useState(4000);
  const [seed, setSeed] = useState(1);

  // Keep start strictly inside (0, target).
  const safeStart = Math.min(Math.max(1, start), target - 1);

  const closedForm = useMemo(
    () => gamblersRuinReachTarget(p, safeStart, target),
    [p, safeStart, target],
  );

  const reachSeries = useMemo(
    () => simulateGamblersRuinReach(p, safeStart, target, games, seed),
    [p, safeStart, target, games, seed],
  );

  const empirical = reachSeries.length > 0 ? reachSeries[reachSeries.length - 1] : 0;

  const reachPoints = useMemo(() => {
    const idx = range(reachSeries.length);
    const paired = idx.map((i) => ({ x: i + 1, y: reachSeries[i] }));
    return downsample(paired, MAX_PLOT_POINTS);
  }, [reachSeries]);

  const walk = useMemo(
    () => simulateWalkTrajectory(p, safeStart, target, seed),
    [p, safeStart, target, seed],
  );

  const walkPoints = useMemo(() => {
    const paired = walk.map((pos, i) => ({ x: i, y: pos }));
    return downsample(paired, MAX_PLOT_POINTS);
  }, [walk]);

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="Top chart: the empirical share of games that reached the target before hitting 0 — more games ⇒ it converges to the closed-form P(reach). Bottom chart: one sample walk between the two absorbing barriers, 0 (ruin) and the target; the walk ends the instant it touches either."
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <div className="label text-secondary">
              P(up) = <span className="num text-primary">{roundTo(p, 2)}</span>
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
              target = <span className="num text-primary">{target}</span>
            </div>
            <input
              type="range"
              min={2}
              max={50}
              step={1}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
          <label className="space-y-1">
            <div className="label text-secondary">
              start ={" "}
              <span className="num text-primary">{safeStart}</span>
            </div>
            <input
              type="range"
              min={1}
              max={Math.max(1, target - 1)}
              step={1}
              value={safeStart}
              onChange={(e) => setStart(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
          <label className="space-y-1">
            <div className="label text-secondary">
              games ={" "}
              <span className="num text-primary">
                {games.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={200}
              max={20000}
              step={200}
              value={games}
              onChange={(e) => setGames(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
              points: reachPoints,
              colorClass: "stroke-accent",
              label: "empirical reach-target proportion",
            },
          ]}
          xLabel="games played"
          yLabel="P(reach target)"
          yDomain={[0, 1]}
          refLines={[
            {
              y: closedForm,
              label: `closed form = ${roundTo(closedForm, 3)}`,
              colorClass: "stroke-bull",
            },
          ]}
          annotations={[
            {
              x: Math.max(2, games * 0.5),
              y: closedForm,
              side: closedForm >= 0.5 ? "down" : "up",
              text: "closed-form P(reach target)",
            },
          ]}
          ariaLabel="Empirical reach-target proportion converging to the closed-form probability"
        />

        <LineChart
          series={[
            {
              points: walkPoints,
              colorClass: "stroke-accent-2",
              label: "sample walk position",
            },
          ]}
          xLabel="step"
          yLabel="position"
          yDomain={[0, target]}
          refLines={[
            { y: 0, label: "ruin (0)", colorClass: "stroke-bear" },
            { y: target, label: `target (${target})`, colorClass: "stroke-bull" },
          ]}
          annotations={[
            {
              x: walkPoints.length ? walkPoints[walkPoints.length - 1].x * 0.5 : 1,
              y: target,
              side: "down",
              text: "absorbing barrier: target",
            },
            {
              x: walkPoints.length ? walkPoints[walkPoints.length - 1].x * 0.5 : 1,
              y: 0,
              side: "up",
              text: "absorbing barrier: ruin",
            },
          ]}
          ariaLabel="A single sample random walk between ruin and target"
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="panel-ruled p-3">
            <div className="label text-secondary">Closed form P(reach)</div>
            <div className="num text-lg text-primary">
              {roundTo(closedForm, 4)}
            </div>
          </div>
          <div className="panel-ruled p-3">
            <div className="label text-secondary">P(ruin) = 1 − P(reach)</div>
            <div className="num text-lg text-primary">
              {roundTo(1 - closedForm, 4)}
            </div>
          </div>
          <div className="panel-ruled p-3">
            <div className="label text-secondary">Empirical P(reach)</div>
            <div className="num text-lg text-primary">
              {roundTo(empirical, 4)}
            </div>
          </div>
        </div>
      </div>
    </SimCard>
  );
}

export function ProcessesGroup(): JSX.Element {
  return (
    <div className="space-y-6">
      <MarkovChainSim />
      <GamblersRuinSim />
    </div>
  );
}
