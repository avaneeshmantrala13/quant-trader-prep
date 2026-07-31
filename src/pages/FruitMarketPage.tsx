import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { StampSeal } from "@/components/visuals/StampSeal";
import { ChevronLeftIcon, SigmaIcon, BoltIcon, GaugeIcon } from "@/components/icons";
import { celebrate } from "@/lib/celebrate";
import { Rng } from "@/lib/rng";
import { CountUp, RoundPips } from "@/components/games/GameBits";
import {
  dealMarket,
  correctAction,
  edge,
  scoreTrade,
  firstClickAccuracy,
  finalScore,
  type FruitMarket,
  type Action,
  type FruitEvent,
  type MarketConfig,
} from "@/lib/games/fruitMarket/engine";

/**
 * FRUIT MARKET (`/fruit-market`) — the speed mental-math game (QuantGames #5).
 *
 * The learner is the TAKER. Each 15-second window deals two fruit bags and a
 * quote; value = (total apples) × (total oranges) after the market event is
 * applied. Buy under the ask, sell over the bid, skip in between — and the
 * earlier the click, the more of the edge you capture. All logic lives in the
 * pure engine; this is a thin themed renderer that keeps its own session score.
 */

type Phase = "setup" | "play" | "summary";

const WINDOW_MS = 15_000;

interface Played {
  market: FruitMarket;
  action: Action;
  correct: Action;
  captured: number; // scored profit (can be negative)
  timeLeftFrac: number;
}

const EVENT_LABEL: Record<FruitEvent, string> = {
  none: "No active event",
  "apple-inflation": "Apple inflation ×2",
  "orange-inflation": "Orange inflation ×2",
  "orange-deflation": "Orange deflation ×0.5 (round up)",
  "no-fruit-a": "No fruit in Bag A",
  "no-fruit-b": "No fruit in Bag B",
};

const EVENT_HINT: Record<FruitEvent, string> = {
  none: "Value the bags as they are.",
  "apple-inflation": "Double the apple total BEFORE you multiply.",
  "orange-inflation": "Double the orange total BEFORE you multiply.",
  "orange-deflation": "Halve the orange total and round UP first.",
  "no-fruit-a": "Bag A contributes nothing — use Bag B only.",
  "no-fruit-b": "Bag B contributes nothing — use Bag A only.",
};

export function FruitMarketPage() {
  const navigate = useNavigate();
  const { themeDef } = useTheme();

  const [phase, setPhase] = useState<Phase>("setup");
  const [config, setConfig] = useState<MarketConfig>({ maxPerBag: 20, eventsEnabled: true });
  const [numMarkets, setNumMarkets] = useState(10);

  const rngRef = useRef<Rng>(new Rng(1));
  const [market, setMarket] = useState<FruitMarket | null>(null);
  const [marketIdx, setMarketIdx] = useState(0);
  const [played, setPlayed] = useState<Played[]>([]);

  // Countdown for the current window.
  const [remainingMs, setRemainingMs] = useState(WINDOW_MS);
  const windowStartRef = useRef<number>(0);
  const [resolved, setResolved] = useState<Played | null>(null);

  const dealNext = useCallback(
    (idx: number) => {
      const m = dealMarket(rngRef.current, config);
      setMarket(m);
      setMarketIdx(idx);
      setResolved(null);
      setRemainingMs(WINDOW_MS);
      windowStartRef.current = performance.now();
    },
    [config],
  );

  const startGame = () => {
    rngRef.current = new Rng(Math.floor(Math.random() * 1e9));
    setPlayed([]);
    setPhase("play");
    dealNext(0);
  };

  // Live countdown — a rAF-driven tick while a window is open and unresolved.
  useEffect(() => {
    if (phase !== "play" || resolved) return;
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - windowStartRef.current;
      const left = Math.max(0, WINDOW_MS - elapsed);
      setRemainingMs(left);
      if (left <= 0) {
        // Time out → auto-skip (a missed decision, scored as a skip).
        handleAction("skip", true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, resolved, marketIdx]);

  const handleAction = (action: Action, timedOut = false) => {
    if (!market || resolved) return;
    const elapsed = performance.now() - windowStartRef.current;
    const timeLeftFrac = timedOut ? 0 : Math.max(0, Math.min(1, (WINDOW_MS - elapsed) / WINDOW_MS));
    const correct = correctAction(market.trueValue, market.quote);
    const captured = scoreTrade(market, action, timeLeftFrac);
    const record: Played = { market, action, correct, captured, timeLeftFrac };
    setResolved(record);
    setPlayed((prev) => [...prev, record]);
  };

  const advance = () => {
    const next = marketIdx + 1;
    if (next >= numMarkets) {
      setPhase("summary");
      const raw = played.reduce((a, p) => a + p.captured, 0);
      if (raw > 0) setTimeout(themeDef.celebration ?? celebrate, 260);
    } else {
      dealNext(next);
    }
  };

  return (
    <div className="relative min-h-[100dvh]">
      <ThemeBackground />

      <header className="sticky top-0 z-20 border-b-[3px] border-border-strong bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <button
            onClick={() => navigate("/games")}
            className="btn-ghost !min-h-0 !px-2 !py-1.5"
            aria-label="Back to games"
          >
            <ChevronLeftIcon width={18} height={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-display text-sm font-semibold text-primary">
                Fruit Market
              </span>
              {phase === "play" && numMarkets <= 12 && (
                <RoundPips total={numMarkets} current={marketIdx} />
              )}
            </div>
            {phase === "play" && (
              <div className="mt-1 h-1.5 w-full border border-subtle bg-surface">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${(marketIdx / numMarkets) * 100}%` }}
                />
              </div>
            )}
          </div>
          {phase === "play" && (
            <span className="num chip border-subtle text-secondary">
              {marketIdx + 1}/{numMarkets}
            </span>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-6">
        {phase === "setup" && (
          <Setup
            config={config}
            setConfig={setConfig}
            numMarkets={numMarkets}
            setNumMarkets={setNumMarkets}
            onStart={startGame}
          />
        )}

        {phase === "play" && market && (
          <PlayView
            market={market}
            remainingMs={remainingMs}
            resolved={resolved}
            onAction={(a) => handleAction(a)}
            onAdvance={advance}
            isLast={marketIdx + 1 >= numMarkets}
          />
        )}

        {phase === "summary" && (
          <SummaryView played={played} onReplay={() => setPhase("setup")} />
        )}
      </main>
    </div>
  );
}

/* ========================================================================== */
/*  Helpers                                                                     */
/* ========================================================================== */

function fmt(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2);
}

function signed(n: number): string {
  const s = n < 0 ? "−" : "+";
  return `${s}${fmt(Math.abs(n))}`;
}

/* ========================================================================== */
/*  Setup                                                                       */
/* ========================================================================== */

function Setup({
  config,
  setConfig,
  numMarkets,
  setNumMarkets,
  onStart,
}: {
  config: MarketConfig;
  setConfig: (c: MarketConfig) => void;
  numMarkets: number;
  setNumMarkets: (n: number) => void;
  onStart: () => void;
}) {
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <div className="flex items-center justify-between">
          <span className="label text-accent">Speed Market-Making Game</span>
          <span className="grid h-9 w-9 place-items-center border border-border-strong text-accent">
            <SigmaIcon width={18} height={18} />
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          Value the basket. Beat the clock.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          Two bags of fruit. The market's true value is{" "}
          <span className="num font-semibold text-primary">
            (total apples) × (total oranges)
          </span>
          . Compare it to the quote and act:{" "}
          <span className="text-bull">buy</span> below the ask,{" "}
          <span className="text-bear">sell</span> above the bid, or skip. Each
          window lasts 15 seconds and the earlier you commit, the more edge you
          bank — but a wrong-direction trade costs you the full edge.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Rule icon={<SigmaIcon width={16} height={16} />} title="Multiply fast">
            Decompose: 13×15 = 130 + 65 = 195. Speed is the whole edge.
          </Rule>
          <Rule icon={<BoltIcon width={16} height={16} />} title="Event first">
            Apply the market event to the counts BEFORE you multiply.
          </Rule>
          <Rule icon={<GaugeIcon width={16} height={16} />} title="First click counts">
            Your first decision in each window is scored — calculate, then commit.
          </Rule>
        </div>
      </article>

      <article className="panel-ruled p-6">
        <div className="label text-accent">Settings</div>
        <div className="mt-4 space-y-5">
          <label className="block">
            <div className="flex items-center justify-between">
              <span className="label text-secondary">Markets this run</span>
              <span className="num text-sm font-semibold text-primary">{numMarkets}</span>
            </div>
            <input
              type="range"
              min={5}
              max={20}
              value={numMarkets}
              onChange={(e) => setNumMarkets(parseInt(e.target.value, 10))}
              className="mt-2 w-full accent-accent"
            />
          </label>

          <label className="block">
            <div className="flex items-center justify-between">
              <span className="label text-secondary">Max fruit per bag</span>
              <span className="num text-sm font-semibold text-primary">{config.maxPerBag}</span>
            </div>
            <input
              type="range"
              min={9}
              max={20}
              value={config.maxPerBag}
              onChange={(e) => setConfig({ ...config, maxPerBag: parseInt(e.target.value, 10) })}
              className="mt-2 w-full accent-accent"
            />
          </label>

          <button
            onClick={() => setConfig({ ...config, eventsEnabled: !config.eventsEnabled })}
            className="flex w-full items-center justify-between border border-subtle bg-surface-muted px-3 py-2.5"
          >
            <span className="label text-secondary">Market events</span>
            <span className={`chip ${config.eventsEnabled ? "border-bull text-bull" : "border-subtle text-muted"}`}>
              {config.eventsEnabled ? "ON" : "OFF"}
            </span>
          </button>
        </div>

        <button onClick={onStart} className="btn-primary mt-6 w-full">
          Open the market →
        </button>
      </article>
    </div>
  );
}

function Rule({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-l-2 border-accent bg-surface-muted px-3 py-2.5">
      <div className="flex items-center gap-2 text-accent">
        {icon}
        <span className="label text-accent">{title}</span>
      </div>
      <p className="mt-1 text-[13px] leading-snug text-secondary">{children}</p>
    </div>
  );
}

/* ========================================================================== */
/*  Play view                                                                   */
/* ========================================================================== */

function PlayView({
  market,
  remainingMs,
  resolved,
  onAction,
  onAdvance,
  isLast,
}: {
  market: FruitMarket;
  remainingMs: number;
  resolved: Played | null;
  onAction: (a: Action) => void;
  onAdvance: () => void;
  isLast: boolean;
}) {
  const secs = (remainingMs / 1000).toFixed(1);
  const frac = remainingMs / WINDOW_MS;
  // Timer drains through three bands: plenty of time (bull) → getting tight
  // (warning) → nearly out (bear). Keeps the edge-decay pressure legible.
  const barTone = frac > 0.6 ? "bg-bull" : frac > 0.33 ? "bg-warning" : "bg-bear";
  const textTone = frac > 0.6 ? "text-secondary" : frac > 0.33 ? "text-warning" : "text-bear";
  const urgent = frac < 0.33;

  return (
    <div className="animate-print-in space-y-5">
      {/* Timer */}
      {!resolved && (
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden border border-subtle bg-surface">
            <div
              className={`h-full transition-colors duration-300 ${barTone}`}
              style={{ width: `${frac * 100}%` }}
            />
          </div>
          <span className={`num text-sm font-bold tabular-nums ${urgent ? "animate-count-pulse" : ""} ${textTone}`}>
            {secs}s
          </span>
        </div>
      )}

      {/* Bags */}
      <div className="grid grid-cols-2 gap-4">
        <BagCard name="Bag A" bag={market.bagA} muted={market.event === "no-fruit-a"} />
        <BagCard name="Bag B" bag={market.bagB} muted={market.event === "no-fruit-b"} />
      </div>

      {/* Event panel */}
      <article
        className={`panel-ruled border-l-4 p-4 ${
          market.event === "none" ? "border-l-subtle" : "border-l-accent-2"
        }`}
      >
        <div className="label text-accent-2">Market event</div>
        <p className="mt-1 font-display text-base font-semibold text-primary">
          {EVENT_LABEL[market.event]}
        </p>
        <p className="mt-0.5 text-[13px] text-secondary">{EVENT_HINT[market.event]}</p>
      </article>

      {/* Quote + actions */}
      <article className="panel-ruled p-5">
        <div className="flex items-center justify-around gap-4">
          <div className="text-center">
            <div className="label text-bull">Bid — you sell</div>
            <div className="num mt-1 font-display text-3xl font-black text-bull">
              {fmt(market.quote.bid)}
            </div>
          </div>
          <div className="h-12 w-px bg-subtle" />
          <div className="text-center">
            <div className="label text-bear">Ask — you buy</div>
            <div className="num mt-1 font-display text-3xl font-black text-bear">
              {fmt(market.quote.ask)}
            </div>
          </div>
        </div>

        {!resolved ? (
          <div className="mt-5 grid grid-cols-3 gap-3">
            <button onClick={() => onAction("sell")} className="btn-secondary !border-bear !text-bear">
              Sell
            </button>
            <button onClick={() => onAction("skip")} className="btn-ghost">
              Skip
            </button>
            <button onClick={() => onAction("buy")} className="btn-secondary !border-bull !text-bull">
              Buy
            </button>
          </div>
        ) : (
          <ResolvedPanel resolved={resolved} onAdvance={onAdvance} isLast={isLast} />
        )}
      </article>
    </div>
  );
}

function BagCard({ name, bag, muted }: { name: string; bag: { apples: number; oranges: number }; muted: boolean }) {
  return (
    <div className={`panel-ruled p-4 ${muted ? "opacity-40" : ""}`}>
      <div className="label text-muted">{name}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm text-secondary">🍎 Apples</span>
        <span className="num text-lg font-bold text-primary">{muted ? 0 : bag.apples}</span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-sm text-secondary">🍊 Oranges</span>
        <span className="num text-lg font-bold text-primary">{muted ? 0 : bag.oranges}</span>
      </div>
    </div>
  );
}

function ResolvedPanel({
  resolved,
  onAdvance,
  isLast,
}: {
  resolved: Played;
  onAdvance: () => void;
  isLast: boolean;
}) {
  const { market, action, correct, captured } = resolved;
  const right = action === correct;
  const fullEdge = edge(market.trueValue, market.quote, correct);

  return (
    <div className="mt-5 animate-print-in space-y-3">
      <div
        className={`border-l-4 px-3 py-2.5 ${
          right ? "border-l-bull bg-surface-muted" : "border-l-bear bg-surface-muted"
        }`}
      >
        <p className={`font-display text-base font-semibold ${right ? "text-bull" : "text-bear"}`}>
          {right ? "Correct" : "Wrong direction"} — you {action === "skip" ? "skipped" : action + "ed"}
        </p>
        <p className="num mt-1 text-sm text-secondary">
          True value <span className="font-semibold text-primary">{fmt(market.trueValue)}</span>{" "}
          {market.rawValue !== market.trueValue && (
            <span className="text-muted">(raw {fmt(market.rawValue)}, rounded to 10)</span>
          )}{" "}
          · correct action{" "}
          <span className="font-semibold text-primary">{correct.toUpperCase()}</span>
          {correct !== "skip" && <> · edge {fmt(fullEdge)}</>}
        </p>
      </div>

      <div className="flex items-center justify-between border border-subtle bg-surface px-3 py-2">
        <span className="label text-muted">Scored this window</span>
        <span className={`num text-lg font-bold ${captured >= 0 ? "text-bull" : "text-bear"}`}>
          {signed(captured)}
        </span>
      </div>

      <button onClick={onAdvance} className="btn-primary w-full">
        {isLast ? "See your score →" : "Next market →"}
      </button>
    </div>
  );
}

/* ========================================================================== */
/*  Summary                                                                     */
/* ========================================================================== */

function SummaryView({ played, onReplay }: { played: Played[]; onReplay: () => void }) {
  const raw = useMemo(() => played.reduce((a, p) => a + p.captured, 0), [played]);
  const acc = useMemo(
    () => firstClickAccuracy(played.map((p) => ({ firstActionCorrect: p.action === p.correct }))),
    [played],
  );
  const score = useMemo(() => finalScore(raw, acc), [raw, acc]);
  const win = score >= 0;

  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled relative overflow-hidden p-6 text-center">
        <StampSeal label={win ? "PROFITABLE" : "UNDERWATER"} tone={win ? "bull" : "bear"} />
        <span className="label text-accent">Final score</span>
        <div className="mt-3 font-display text-5xl font-black text-primary">
          <CountUp value={score} />
        </div>
        <p className="mt-2 text-sm text-secondary">
          Raw profit <span className={`num font-semibold ${raw >= 0 ? "text-bull" : "text-bear"}`}>{signed(raw)}</span>{" "}
          × first-click accuracy{" "}
          <span className="num font-semibold text-primary">{Math.round(acc * 100)}%</span>
        </p>
      </article>

      <article className="panel-ruled p-4">
        <div className="label text-accent">Market replay</div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="label text-muted">
                <th className="py-1.5 pr-2">#</th>
                <th className="py-1.5 pr-2">Value</th>
                <th className="py-1.5 pr-2">Quote</th>
                <th className="py-1.5 pr-2">You</th>
                <th className="py-1.5 pr-2">Right</th>
                <th className="py-1.5 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="num divide-y divide-subtle">
              {played.map((p, i) => (
                <tr key={i}>
                  <td className="py-1.5 pr-2 text-muted">{i + 1}</td>
                  <td className="py-1.5 pr-2 text-primary">{fmt(p.market.trueValue)}</td>
                  <td className="py-1.5 pr-2 text-secondary">
                    {fmt(p.market.quote.bid)}/{fmt(p.market.quote.ask)}
                  </td>
                  <td className="py-1.5 pr-2 text-secondary">{p.action}</td>
                  <td className={`py-1.5 pr-2 ${p.action === p.correct ? "text-bull" : "text-bear"}`}>
                    {p.action === p.correct ? "✓" : p.correct}
                  </td>
                  <td className={`py-1.5 text-right font-semibold ${p.captured >= 0 ? "text-bull" : "text-bear"}`}>
                    {signed(p.captured)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <button onClick={onReplay} className="btn-primary w-full">
        Play again
      </button>
    </div>
  );
}
