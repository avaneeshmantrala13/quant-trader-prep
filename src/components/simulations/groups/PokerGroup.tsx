/**
 * PokerGroup — the "Real-World Scenarios" POKER sims: a pot-odds / call-vs-fold
 * card where the EV-optimal action follows from the break-even equity, and an
 * all-in equity showdown where the empirical win/tie share converges to each
 * hand's true probability over many random boards. Pure math + the hand
 * evaluator live in `@/lib/simulations/poker`; this file is presentation +
 * controls only, themed entirely through semantic tokens (all six themes, AA).
 */
import { useMemo, useState } from "react";
import { SIM_BY_ID } from "@/lib/simulations/catalog";
import { SimCard } from "@/components/simulations/SimCard";
import { LineChart } from "@/components/simulations/charts/LineChart";
import { BarChart } from "@/components/simulations/charts/BarChart";
import { downsample, roundTo } from "@/lib/simulations/shared";
import {
  breakEvenEquity,
  evOfCall,
  formatCard,
  parseHand,
  potOddsDecision,
  simulateAllInEquity,
  simulateCallPnL,
  simulateWinRate,
  type Card,
} from "@/lib/simulations/poker";

const MAX_PLOT_POINTS = 400;

function pct(x: number): string {
  return `${roundTo(x * 100, 1)}%`;
}

function fmtSigned(x: number): string {
  const r = roundTo(x, 1);
  return r > 0 ? `+${r}` : `${r}`;
}

function PotOddsSim(): JSX.Element {
  const meta = SIM_BY_ID["poker-pot-odds"];
  const [pot, setPot] = useState(100);
  const [bet, setBet] = useState(50);
  const [w, setW] = useState(0.3);
  const [hands, setHands] = useState(5000);
  const [action, setAction] = useState<"call" | "fold">("call");
  const [seed, setSeed] = useState(1);

  const breakeven = breakEvenEquity(pot, bet);
  const ev = evOfCall(pot, bet, w);
  const best = potOddsDecision(pot, bet, w);
  const isOptimal = action === best;

  const winRate = useMemo(
    () => simulateWinRate(w, hands, seed),
    [w, hands, seed],
  );
  const winRatePoints = useMemo(
    () =>
      downsample(
        winRate.map((y, i) => ({ x: i + 1, y })),
        MAX_PLOT_POINTS,
      ),
    [winRate],
  );
  const empiricalWin = winRate.length ? winRate[winRate.length - 1] : 0;

  const callPnL = useMemo(
    () => simulateCallPnL(pot, bet, w, hands, seed + 500),
    [pot, bet, w, hands, seed],
  );
  const callPnLPoints = useMemo(
    () =>
      downsample(
        callPnL.map((y, i) => ({ x: i + 1, y })),
        MAX_PLOT_POINTS,
      ),
    [callPnL],
  );

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="Pot odds set a break-even equity = bet / (pot + 2·bet): the win chance at which calling is exactly EV 0. If your equity beats that line, calling is +EV; if not, fold. Top chart: the empirical win rate over many hands settling onto your true win probability w. Bottom chart: the running-average profit of always calling settling onto EV(call). The green threshold line is the pot-odds break-even — being to its right is what makes the call correct."
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <div className="label text-secondary">
              pot = <span className="num text-primary">{pot}</span>
            </div>
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={pot}
              onChange={(e) => setPot(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
          <label className="space-y-1">
            <div className="label text-secondary">
              bet to call = <span className="num text-primary">{bet}</span>
            </div>
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={bet}
              onChange={(e) => setBet(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
          <label className="space-y-1">
            <div className="label text-secondary">
              your equity w ={" "}
              <span className="num text-primary">{roundTo(w, 2)}</span>
            </div>
            <input
              type="range"
              min={0.05}
              max={0.95}
              step={0.01}
              value={w}
              onChange={(e) => setW(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
          <label className="space-y-1">
            <div className="label text-secondary">
              hands ={" "}
              <span className="num text-primary">{hands.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={200}
              max={20000}
              step={200}
              value={hands}
              onChange={(e) => setHands(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="label text-secondary">Your call:</span>
          <button
            type="button"
            className={action === "call" ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setAction("call")}
          >
            Call
          </button>
          <button
            type="button"
            className={action === "fold" ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setAction("fold")}
          >
            Fold
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
              points: winRatePoints,
              colorClass: "stroke-accent",
              label: "empirical win rate",
            },
          ]}
          xLabel="hands"
          yLabel="win rate"
          yDomain={[0, 1]}
          refLines={[
            {
              y: w,
              label: `true equity w = ${roundTo(w, 2)}`,
              colorClass: "stroke-accent",
            },
            {
              y: breakeven,
              label: `pot-odds break-even = ${roundTo(breakeven, 3)}`,
              colorClass: "stroke-bull",
            },
          ]}
          annotations={[
            {
              x: Math.max(2, hands * 0.5),
              y: w,
              side: w >= breakeven ? "up" : "down",
              text: "empirical equity → true w",
            },
            {
              x: Math.max(2, hands * 0.25),
              y: breakeven,
              side: breakeven >= w ? "up" : "down",
              text: "break-even: call iff w is above",
            },
          ]}
          ariaLabel="Empirical win rate converging to the true equity, versus the pot-odds break-even"
        />

        <LineChart
          series={[
            {
              points: callPnLPoints,
              colorClass: "stroke-accent-2",
              label: "avg P&L of calling",
            },
          ]}
          xLabel="hands"
          yLabel="avg P&L"
          refLines={[
            {
              y: ev,
              label: `EV(call) = ${fmtSigned(ev)}`,
              colorClass: ev >= 0 ? "stroke-bull" : "stroke-bear",
            },
            { y: 0, label: "fold = 0", colorClass: "stroke-subtle" },
          ]}
          annotations={[
            {
              x: Math.max(2, hands * 0.5),
              y: ev,
              side: ev >= 0 ? "down" : "up",
              text: "running avg → EV(call)",
            },
          ]}
          ariaLabel="Running-average profit of calling converging to the expected value of calling"
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="panel-ruled p-3">
            <div className="label text-secondary">Break-even equity</div>
            <div className="num text-lg text-primary">{pct(breakeven)}</div>
          </div>
          <div className="panel-ruled p-3">
            <div className="label text-secondary">EV(call)</div>
            <div className="num text-lg text-primary">{fmtSigned(ev)}</div>
          </div>
          <div className="panel-ruled p-3">
            <div className="label text-secondary">Empirical win rate</div>
            <div className="num text-lg text-primary">{pct(empiricalWin)}</div>
          </div>
          <div className="panel-ruled p-3">
            <div className="label text-secondary">EV-optimal action</div>
            <div className="num text-lg text-primary">
              {best === "call" ? "Call" : "Fold"}
            </div>
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
                Correct: with equity <span className="num">{pct(w)}</span>{" "}
                {best === "call" ? "above" : "below"} the break-even{" "}
                <span className="num">{pct(breakeven)}</span>, {best === "call" ? "calling" : "folding"} is EV-optimal
                {best === "call" ? (
                  <>
                    {" "}
                    (<span className="num">{fmtSigned(ev)}</span> per hand).
                  </>
                ) : (
                  <> — calling would be {fmtSigned(ev)}.</>
                )}
              </>
            ) : (
              <>
                Not optimal: with equity <span className="num">{pct(w)}</span> vs
                break-even <span className="num">{pct(breakeven)}</span>, the
                EV-optimal play is to {best}. Calling here is{" "}
                <span className="num">{fmtSigned(ev)}</span> per hand.
              </>
            )}
          </p>
        </div>
      </div>
    </SimCard>
  );
}

interface Matchup {
  name: string;
  a: string;
  b: string;
}

const MATCHUPS: Matchup[] = [
  { name: "Aces vs Kings", a: "As Ah", b: "Kc Kd" },
  { name: "Pair vs two overcards (race)", a: "8s 8d", b: "Ac Kh" },
  { name: "Dominated: A-K vs A-Q", a: "As Kh", b: "Ac Qd" },
  { name: "Flush edge: suited connectors vs bigger pair", a: "7h 6h", b: "Ts Td" },
];

function HandRow(props: { label: string; hand: Card[] }): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span className="label text-secondary">{props.label}</span>
      {props.hand.map((c, i) => (
        <span key={i} className="chip num text-primary">
          {formatCard(c)}
        </span>
      ))}
    </div>
  );
}

const REF_DEALS = 20000;
const REF_SEED = 999;

function HandEquitySim(): JSX.Element {
  const meta = SIM_BY_ID["poker-hand-equity"];
  const [matchupIdx, setMatchupIdx] = useState(0);
  const [deals, setDeals] = useState(5000);
  const [seed, setSeed] = useState(1);

  const matchup = MATCHUPS[matchupIdx];
  const handA = useMemo(() => parseHand(matchup.a), [matchup]);
  const handB = useMemo(() => parseHand(matchup.b), [matchup]);

  // A large, fixed-seed run gives a stable "true" equity reference line that the
  // live (slider-controlled) run converges toward.
  const reference = useMemo(
    () => simulateAllInEquity(handA, handB, REF_DEALS, REF_SEED),
    [handA, handB],
  );
  const refEquity = reference.equity[reference.equity.length - 1] ?? 0.5;

  const result = useMemo(
    () => simulateAllInEquity(handA, handB, deals, seed),
    [handA, handB, deals, seed],
  );

  const equityPoints = useMemo(
    () =>
      downsample(
        result.equity.map((y, i) => ({ x: i + 1, y })),
        MAX_PLOT_POINTS,
      ),
    [result],
  );

  const total = Math.max(1, result.winsA + result.winsB + result.ties);
  const winA = result.winsA / total;
  const winB = result.winsB / total;
  const tie = result.ties / total;

  const bars = [
    { label: "A wins", value: roundTo(winA * 100, 1) },
    { label: "tie", value: roundTo(tie * 100, 1) },
    { label: "B wins", value: roundTo(winB * 100, 1) },
  ];

  return (
    <SimCard
      id={meta.id}
      title={meta.title}
      whatShows={meta.whatShows}
      topics={meta.topics}
      howToRead="Both hands are all-in; each deal draws five community cards at random and the best five-card hand wins (a tie counts as half). The line is Hand A's running equity (wins + ½·ties) over the deals; the dashed line is its true probability from a large reference run. More deals ⇒ the empirical equity converges to the true equity — the law of large numbers on a real poker matchup. The bars show the final win / tie / loss split."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label text-secondary">Matchup:</span>
          {MATCHUPS.map((m, i) => (
            <button
              key={m.name}
              type="button"
              className={matchupIdx === i ? "btn btn-primary" : "btn btn-secondary"}
              onClick={() => setMatchupIdx(i)}
            >
              {m.name}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <HandRow label="Hand A" hand={handA} />
          <HandRow label="Hand B" hand={handB} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <div className="label text-secondary">
              deals ={" "}
              <span className="num text-primary">{deals.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={200}
              max={20000}
              step={200}
              value={deals}
              onChange={(e) => setDeals(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSeed((s) => s + 1)}
            >
              Run again
            </button>
          </div>
        </div>

        <LineChart
          series={[
            {
              points: equityPoints,
              colorClass: "stroke-accent",
              label: "Hand A running equity",
            },
          ]}
          xLabel="deals"
          yLabel="equity (A)"
          yDomain={[0, 1]}
          refLines={[
            {
              y: refEquity,
              label: `true equity ≈ ${pct(refEquity)}`,
              colorClass: "stroke-bull",
            },
          ]}
          annotations={[
            {
              x: Math.max(2, deals * 0.5),
              y: refEquity,
              side: refEquity >= 0.5 ? "down" : "up",
              text: "empirical equity → true probability",
            },
          ]}
          ariaLabel="Hand A's running equity converging to its true probability"
        />

        <BarChart
          bars={bars}
          yLabel="% of deals"
          colorClass="fill-accent"
          yDomain={[0, 100]}
          annotations={[
            { barIndex: 0, text: `A ${pct(winA)}`, side: "up" },
          ]}
          ariaLabel="Final win, tie, and loss split for the matchup"
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="panel-ruled p-3">
            <div className="label text-secondary">Hand A wins</div>
            <div className="num text-lg text-primary">{pct(winA)}</div>
          </div>
          <div className="panel-ruled p-3">
            <div className="label text-secondary">Tie (split)</div>
            <div className="num text-lg text-primary">{pct(tie)}</div>
          </div>
          <div className="panel-ruled p-3">
            <div className="label text-secondary">Hand B wins</div>
            <div className="num text-lg text-primary">{pct(winB)}</div>
          </div>
        </div>
      </div>
    </SimCard>
  );
}

export function PokerGroup(): JSX.Element {
  return (
    <div className="space-y-6">
      <PotOddsSim />
      <HandEquitySim />
    </div>
  );
}
