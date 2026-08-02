import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { StampSeal } from "@/components/visuals/StampSeal";
import { ChevronLeftIcon, CardsIcon, BrainIcon } from "@/components/icons";
import { celebrate } from "@/lib/celebrate";
import { Rng } from "@/lib/rng";
import { PlayingCard, CountUp, RoundPips, ProbBar } from "@/components/games/GameBits";
import {
  freshDeck,
  dealCycle,
  suitsFor,
  evaluateHigherLower,
  evaluateInsideOutside,
  evaluateNewSuit,
  bestOption,
  resolveBet,
  decideWin,
  skillScore,
  sizingScore,
  decisionScore,
  leaderboardScore,
  START_CHIPS,
  type GameConfig,
  type Card,
  type Suit,
  type AceMode,
  type BetType,
  type BetOption,
  type BetContext,
  type PlacedBet,
  type RoundDecision,
} from "@/lib/games/nextCardBetting/engine";

/**
 * NEXT CARD BETTING (`/next-card-betting`) — the card-counting + Kelly drill
 * (QuantGames #9). Every dealt card stays face-up on the table, grouped by
 * cycle, so the player can count what remains, judge each side's true
 * probability, and stake the Kelly fraction of their bankroll. You bet BEFORE
 * seeing the answer; the reveal then shows the exact probabilities and optimal
 * Kelly so the method — not any single deal — is what sticks. All maths lives in
 * the pure engine; this file only themes it.
 */

type Phase = "setup" | "bet" | "reveal" | "summary";

const NUM_CYCLES = 3;

const BET_LABEL: Record<BetType, string> = {
  "higher-lower": "Higher / Lower",
  "inside-outside": "Inside / Outside",
  "new-suit": "New Suit?",
};

interface Opportunity {
  type: BetType;
  options: BetOption[];
  best: BetOption;
}

interface ActiveCycle {
  index: number;
  reference: Card;
  low: Card;
  high: Card;
  visibleSuits: Set<Suit>;
  startBalance: number;
  opps: Opportunity[];
  aceMode: AceMode;
}

interface Selection {
  side: string | null;
  fraction: number; // fraction of cycle-start bankroll
}

interface BetResult {
  type: BetType;
  best: BetOption;
  options: BetOption[];
  chosenSide: string | null;
  stake: number;
  pnl: number;
  won: boolean | null; // null = skipped
}

interface CycleLog {
  index: number;
  reference: Card;
  low: Card;
  high: Card;
  drawn: Card;
  results: BetResult[];
  net: number;
}

export function NextCardBettingPage() {
  const navigate = useNavigate();
  const { themeDef } = useTheme();

  const [phase, setPhase] = useState<Phase>("setup");
  const [config, setConfig] = useState<GameConfig>({ numSuits: 2, aceMode: "high" });

  const rngRef = useRef<Rng>(new Rng(1));
  const deckRef = useRef<Card[]>([]);
  const visibleRef = useRef<Card[]>([]);

  const [balance, setBalance] = useState(START_CHIPS);
  const [active, setActive] = useState<ActiveCycle | null>(null);
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [log, setLog] = useState<CycleLog[]>([]);
  const [lastCycle, setLastCycle] = useState<CycleLog | null>(null);

  // accumulated scoring inputs across all cycles
  const placedRef = useRef<PlacedBet[]>([]);
  const decisionsRef = useRef<RoundDecision[]>([]);

  const buildOpps = (
    reference: Card,
    low: Card,
    high: Card,
    remaining: Card[],
    visibleSuits: Set<Suit>,
  ): Opportunity[] => {
    const opps: Opportunity[] = [];
    const hl = evaluateHigherLower(reference, remaining, config.aceMode);
    opps.push({ type: "higher-lower", options: hl, best: bestOption(hl) });
    const io = evaluateInsideOutside(low, high, remaining, config.aceMode);
    opps.push({ type: "inside-outside", options: io, best: bestOption(io) });
    if (config.numSuits > 1) {
      const ns = evaluateNewSuit(visibleSuits, remaining);
      opps.push({ type: "new-suit", options: ns, best: bestOption(ns) });
    }
    return opps;
  };

  const dealCycleAt = (index: number, startBalance: number) => {
    if (deckRef.current.length < 3) {
      // not enough to deal + resolve — reshuffle a fresh deck (visible resets).
      deckRef.current = freshDeck(config);
      visibleRef.current = [];
    }
    const state = dealCycle(rngRef.current, deckRef.current, config, visibleRef.current);
    deckRef.current = state.deck;
    visibleRef.current = state.visible;

    const visibleSuits = new Set<Suit>(state.visible.map((c) => c.suit));
    const opps = buildOpps(state.reference, state.low, state.high, state.deck, visibleSuits);

    setActive({
      index,
      reference: state.reference,
      low: state.low,
      high: state.high,
      visibleSuits,
      startBalance,
      opps,
      aceMode: config.aceMode,
    });
    // default every bet to "skip"
    const fresh: Record<string, Selection> = {};
    for (const o of opps) fresh[o.type] = { side: null, fraction: 0.25 };
    setSelections(fresh);
    setPhase("bet");
  };

  const startGame = () => {
    rngRef.current = new Rng(Math.floor(Math.random() * 1e9));
    deckRef.current = freshDeck(config);
    visibleRef.current = [];
    placedRef.current = [];
    decisionsRef.current = [];
    setBalance(START_CHIPS);
    setLog([]);
    setLastCycle(null);
    dealCycleAt(0, START_CHIPS);
  };

  const resolveCycle = () => {
    if (!active) return;
    // Draw the resolving card from the remaining deck.
    const shuffled = rngRef.current.shuffle(deckRef.current);
    const drawn = shuffled[0];
    deckRef.current = shuffled.slice(1);

    const results: BetResult[] = [];
    let net = 0;
    let anyGoodBet = false;
    let bestPThisCycle = 0;

    for (const opp of active.opps) {
      const sel = selections[opp.type];
      const ctx: BetContext = {
        aceMode: config.aceMode,
        reference: active.reference,
        low: active.low,
        high: active.high,
        visibleSuits: active.visibleSuits,
      };
      const stake =
        sel && sel.side ? Math.min(active.startBalance, Math.round(active.startBalance * sel.fraction)) : 0;
      const pnl = sel && sel.side ? resolveBet(opp.type, sel.side, stake, drawn, ctx) : 0;
      const won = sel && sel.side ? decideWin(opp.type, sel.side, drawn, ctx) : null;
      net += pnl;

      const betOnBest = !!sel && sel.side === opp.best.side && stake > 0;
      placedRef.current.push({
        p: opp.best.p,
        kelly: opp.best.kelly,
        actualFraction: betOnBest ? sel!.fraction : 0,
        staked: betOnBest,
      });
      if (opp.best.p > 0.5 && betOnBest) anyGoodBet = true;
      bestPThisCycle = Math.max(bestPThisCycle, opp.best.p);

      results.push({
        type: opp.type,
        best: opp.best,
        options: opp.options,
        chosenSide: sel?.side ?? null,
        stake,
        pnl,
        won,
      });
    }

    decisionsRef.current.push({ bestP: bestPThisCycle, bet: anyGoodBet });

    // The resolving card now joins the table (grouped as this cycle's draw).
    visibleRef.current = [...visibleRef.current, drawn];

    const entry: CycleLog = {
      index: active.index,
      reference: active.reference,
      low: active.low,
      high: active.high,
      drawn,
      results,
      net,
    };
    setLog((prev) => [...prev, entry]);
    setLastCycle(entry);
    setBalance((b) => b + net);
    setPhase("reveal");
  };

  const advance = () => {
    const next = (active?.index ?? 0) + 1;
    if (next >= NUM_CYCLES) {
      setPhase("summary");
      if (balance >= START_CHIPS) setTimeout(themeDef.celebration ?? celebrate, 260);
    } else {
      dealCycleAt(next, balance);
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
                Next Card Betting
              </span>
              {phase !== "setup" && phase !== "summary" && (
                <RoundPips total={NUM_CYCLES} current={active?.index ?? 0} />
              )}
            </div>
            {phase !== "setup" && phase !== "summary" && (
              <div className="mt-1 h-1.5 w-full border border-subtle bg-surface">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${((active?.index ?? 0) / NUM_CYCLES) * 100}%` }}
                />
              </div>
            )}
          </div>
          {phase !== "setup" && (
            <span className="chip border-accent text-accent" title="Chip balance">
              <CountUp value={balance} />
            </span>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-6">
        {phase === "setup" && <Setup config={config} setConfig={setConfig} onStart={startGame} />}

        {phase === "bet" && active && (
          <BetScreen
            active={active}
            visible={visibleRef.current}
            selections={selections}
            setSelections={setSelections}
            onResolve={resolveCycle}
          />
        )}

        {phase === "reveal" && lastCycle && (
          <RevealScreen cycle={lastCycle} aceMode={config.aceMode} onAdvance={advance} isLast={(active?.index ?? 0) + 1 >= NUM_CYCLES} />
        )}

        {phase === "summary" && (
          <SummaryView
            balance={balance}
            placed={placedRef.current}
            decisions={decisionsRef.current}
            log={log}
            aceMode={config.aceMode}
            onReplay={() => setPhase("setup")}
          />
        )}
      </main>
    </div>
  );
}

/* ========================================================================== */
/*  Card + shared bits                                                          */
/* ========================================================================== */

// Face/counting value under the active ace mode.
function faceOf(card: Card, aceMode: AceMode): number {
  return card.rank === 14 ? (aceMode === "high" ? 14 : 1) : card.rank;
}

function CardChip({
  card,
  aceMode,
  small,
  flip,
  still,
}: {
  card: Card;
  aceMode: AceMode;
  small?: boolean;
  flip?: boolean;
  still?: boolean;
}) {
  return (
    <PlayingCard
      card={card}
      faceValue={faceOf(card, aceMode)}
      size={small ? "sm" : "md"}
      flip={flip}
      still={still}
    />
  );
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function signed(n: number): string {
  const s = n < 0 ? "−" : "+";
  return `${s}${Math.abs(n).toLocaleString()}`;
}

/* ========================================================================== */
/*  Setup                                                                       */
/* ========================================================================== */

function Setup({
  config,
  setConfig,
  onStart,
}: {
  config: GameConfig;
  setConfig: (c: GameConfig) => void;
  onStart: () => void;
}) {
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <div className="flex items-center justify-between">
          <span className="label text-accent">Card-Counting · Kelly Sizing</span>
          <span className="grid h-9 w-9 place-items-center border border-border-strong text-accent">
            <CardsIcon width={18} height={18} />
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          Count what's left. Bet the edge.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          Every card dealt stays on the table. Use them to count what remains,
          judge the <span className="font-semibold text-primary">true probability</span> of each
          side, and stake the <span className="font-semibold text-primary">Kelly fraction</span> of
          your bankroll. Payouts are even money, so the optimal stake on a side with probability{" "}
          <span className="num">p</span> is <span className="num">2p − 1</span> — anything at or
          below 50% is a skip.
        </p>
        <p className="mt-3 border-l-2 border-accent-2 bg-surface-muted px-3 py-2 text-[13px] text-secondary">
          <span className="label text-accent-2">You bet blind</span>
          <br />
          You choose your side and stake before the answer shows. The reveal then gives you the exact
          probabilities and the ideal Kelly size — so the counting method transfers, not the deal.
        </p>
      </article>

      <article className="panel-ruled p-6">
        <div className="label text-accent">Settings</div>
        <div className="mt-4 space-y-4">
          <div>
            <span className="label mb-1 block text-secondary">Suits in the deck</span>
            <div className="flex overflow-hidden rounded-sm border border-border-strong">
              {([1, 2, 3, 4] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setConfig({ ...config, numSuits: n })}
                  className={`flex-1 px-4 py-2 font-mono text-xs uppercase tracking-label transition-colors ${
                    config.numSuits === n
                      ? "bg-accent text-accent-contrast"
                      : "bg-surface text-secondary hover:bg-surface-muted"
                  }`}
                >
                  {n} ({suitsFor(n).join(" ")})
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted">
              1 suit = 13 cards. More suits enable the “new suit?” bet and slow the count.
            </p>
          </div>
          <div>
            <span className="label mb-1 block text-secondary">Ace value</span>
            <div className="flex overflow-hidden rounded-sm border border-border-strong">
              {(["low", "high"] as AceMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setConfig({ ...config, aceMode: m })}
                  className={`flex-1 px-4 py-2 font-mono text-xs uppercase tracking-label transition-colors ${
                    config.aceMode === m
                      ? "bg-accent text-accent-contrast"
                      : "bg-surface text-secondary hover:bg-surface-muted"
                  }`}
                >
                  {m === "low" ? "Low (1)" : "High (14)"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={onStart} className="btn-primary mt-6 w-full">
          Sit down with {START_CHIPS.toLocaleString()} chips →
        </button>
      </article>
    </div>
  );
}

/* ========================================================================== */
/*  Counting table (visible cards, grouped by cycle)                            */
/* ========================================================================== */

function CountingTable({ visible, aceMode }: { visible: Card[]; aceMode: AceMode }) {
  if (visible.length === 0) return null;
  return (
    <article className="panel-ruled p-4">
      <div className="flex items-center justify-between">
        <span className="label text-accent">On the table · count what's left</span>
        <span className="num text-xs text-muted">{visible.length} seen</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {visible.map((c, i) => (
          <CardChip key={i} card={c} aceMode={aceMode} small still />
        ))}
      </div>
    </article>
  );
}

/* ========================================================================== */
/*  Bet screen                                                                  */
/* ========================================================================== */

const QUICK: { label: string; f: number }[] = [
  { label: "Skip", f: 0 },
  { label: "10%", f: 0.1 },
  { label: "25%", f: 0.25 },
  { label: "50%", f: 0.5 },
  { label: "Max", f: 1 },
];

function BetScreen({
  active,
  visible,
  selections,
  setSelections,
  onResolve,
}: {
  active: ActiveCycle;
  visible: Card[];
  selections: Record<string, Selection>;
  setSelections: (s: Record<string, Selection>) => void;
  onResolve: () => void;
}) {
  const setSide = (type: BetType, side: string) => {
    const cur = selections[type];
    // toggling the selected side off = skip
    const nextSide = cur?.side === side ? null : side;
    setSelections({ ...selections, [type]: { side: nextSide, fraction: cur?.fraction ?? 0.25 } });
  };
  const setFraction = (type: BetType, fraction: number) => {
    const cur = selections[type];
    setSelections({ ...selections, [type]: { side: cur?.side ?? null, fraction } });
  };

  return (
    <div className="animate-print-in space-y-5">
      <CountingTable visible={visible} aceMode={active.aceMode} />

      {/* This cycle's key cards */}
      <article className="panel-ruled p-5">
        <span className="label text-accent">Cycle {active.index + 1} · this deal</span>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <div className="label text-muted">Reference (Higher / Lower)</div>
            <div className="mt-1">
              <CardChip card={active.reference} aceMode={active.aceMode} />
            </div>
          </div>
          <div>
            <div className="label text-muted">Range (Inside / Outside)</div>
            <div className="mt-1 flex items-center gap-2">
              <CardChip card={active.low} aceMode={active.aceMode} />
              <span className="text-muted">–</span>
              <CardChip card={active.high} aceMode={active.aceMode} />
            </div>
          </div>
        </div>
      </article>

      {/* Bets */}
      <div className="space-y-4">
        {active.opps.map((opp) => (
          <BetCard
            key={opp.type}
            opp={opp}
            startBalance={active.startBalance}
            selection={selections[opp.type]}
            onSide={(s) => setSide(opp.type, s)}
            onFraction={(f) => setFraction(opp.type, f)}
          />
        ))}
      </div>

      <button onClick={onResolve} className="btn-primary w-full">
        Deal the next card →
      </button>
    </div>
  );
}

function BetCard({
  opp,
  startBalance,
  selection,
  onSide,
  onFraction,
}: {
  opp: Opportunity;
  startBalance: number;
  selection: Selection | undefined;
  onSide: (side: string) => void;
  onFraction: (f: number) => void;
}) {
  const side = selection?.side ?? null;
  const fraction = selection?.fraction ?? 0.25;
  const stake = side ? Math.round(startBalance * fraction) : 0;

  return (
    <article className="panel-ruled p-5">
      <div className="label text-accent">{BET_LABEL[opp.type]}</div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {opp.options.map((o) => (
          <button
            key={o.side}
            onClick={() => onSide(o.side)}
            className={`rounded-sm border-2 px-3 py-2.5 text-center transition-colors ${
              side === o.side
                ? "border-accent bg-accent text-accent-contrast"
                : "border-border-strong text-secondary hover:border-accent hover:text-primary"
            }`}
          >
            <span className="font-display text-sm font-semibold">{o.label}</span>
          </button>
        ))}
      </div>

      {side && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="label text-secondary">Stake</span>
            <span className="num text-sm font-semibold text-primary">
              {stake.toLocaleString()} chips · {pct(fraction)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(fraction * 100)}
            onChange={(e) => onFraction(parseInt(e.target.value, 10) / 100)}
            className="mt-2 w-full accent-accent"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button
                key={q.label}
                onClick={() => onFraction(q.f)}
                className={`chip ${
                  Math.abs(fraction - q.f) < 0.001
                    ? "border-accent bg-accent text-accent-contrast"
                    : "border-subtle text-secondary"
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {!side && <p className="mt-3 text-[12px] text-muted">Pick a side to stake, or leave it to skip (0 chips).</p>}
    </article>
  );
}

/* ========================================================================== */
/*  Reveal                                                                      */
/* ========================================================================== */

function RevealScreen({
  cycle,
  aceMode,
  onAdvance,
  isLast,
}: {
  cycle: CycleLog;
  aceMode: AceMode;
  onAdvance: () => void;
  isLast: boolean;
}) {
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6 text-center">
        <span className="label text-accent">The next card was</span>
        <div className="mt-3 flex justify-center">
          <CardChip card={cycle.drawn} aceMode={aceMode} flip />
        </div>
        <p className={`num mt-3 text-lg font-bold ${cycle.net >= 0 ? "text-bull" : "text-bear"}`}>
          {signed(cycle.net)} chips this cycle
        </p>
      </article>

      <div className="space-y-3">
        {cycle.results.map((r) => (
          <BetResultCard key={r.type} r={r} />
        ))}
      </div>

      <button onClick={onAdvance} className="btn-primary w-full">
        {isLast ? "See results →" : "Next cycle →"}
      </button>
    </div>
  );
}

function BetResultCard({ r }: { r: BetResult }) {
  const skipped = r.chosenSide === null;
  const tone = skipped ? "border-l-subtle" : r.won ? "border-l-bull" : "border-l-bear";

  return (
    <article className={`panel-ruled border-l-4 p-4 ${tone}`}>
      <div className="flex items-center justify-between">
        <span className="label text-accent">{BET_LABEL[r.type]}</span>
        {skipped ? (
          <span className="chip border-subtle text-muted">Skipped</span>
        ) : (
          <span className={`num text-sm font-bold ${r.pnl >= 0 ? "text-bull" : "text-bear"}`}>
            {signed(r.pnl)}
          </span>
        )}
      </div>

      {!skipped && (
        <p className="num mt-1.5 text-[13px] text-secondary">
          You bet <span className="font-semibold text-primary">{sideLabel(r, r.chosenSide!)}</span> with{" "}
          {r.stake.toLocaleString()} chips — {r.won ? "won" : "lost"}.
        </p>
      )}

      {/* Teaching viz: each side's true probability as a bar, best side marked
          with its Kelly slice. Turns the numbers into something you can see. */}
      <div className="mt-3 space-y-2 border-t border-subtle pt-3">
        {r.options.map((o) => (
          <ProbBar
            key={o.side}
            p={o.p}
            kelly={o.side === r.best.side ? o.kelly : undefined}
            label={o.label}
            highlight={o.side === r.best.side}
          />
        ))}
        <p className="num pt-0.5 text-[12px] text-muted">
          Best: <span className="text-accent">{r.best.label}</span> at {pct(r.best.p)} → stake Kelly{" "}
          <span className="text-accent-2">{pct(r.best.kelly)}</span> of bankroll
          {r.best.kelly === 0 && " (no edge — skip)"}
        </p>
      </div>
    </article>
  );
}

function sideLabel(r: BetResult, side: string): string {
  return r.options.find((o) => o.side === side)?.label ?? side;
}

/* ========================================================================== */
/*  Summary                                                                     */
/* ========================================================================== */

function SummaryView({
  balance,
  placed,
  decisions,
  log,
  aceMode,
  onReplay,
}: {
  balance: number;
  placed: PlacedBet[];
  decisions: RoundDecision[];
  log: CycleLog[];
  aceMode: AceMode;
  onReplay: () => void;
}) {
  const sizing = sizingScore(placed);
  const decision = decisionScore(decisions);
  const skill = skillScore(placed, decisions);
  const board = leaderboardScore(balance, skill);
  const win = balance >= START_CHIPS;

  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled relative overflow-hidden p-6 text-center">
        <StampSeal label={win ? "AHEAD" : "BEHIND"} tone={win ? "bull" : "bear"} />
        <span className="label text-accent">Leaderboard score</span>
        <div className="mt-3 font-display text-5xl font-black text-primary">
          <CountUp value={board} />
        </div>
        <p className="mt-1 text-sm text-secondary">
          bankroll {balance.toLocaleString()} × skill {skill.toFixed(1)}/10 ÷ 10
        </p>
      </article>

      <article className="panel-ruled p-5">
        <div className="flex items-center gap-2">
          <BrainIcon width={16} height={16} />
          <span className="label text-accent">Skill breakdown</span>
        </div>
        <div className="mt-3 space-y-3">
          <ScoreBar label="Sizing (Kelly accuracy)" value={sizing} max={7} />
          <ScoreBar label="Decision (took the +EV bets)" value={decision} max={3} />
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          Sizing rewards staking close to <span className="num">2p − 1</span> on every side with an
          edge. Decision rewards not skipping the bets where the best side cleared 50%.
        </p>
      </article>

      <article className="panel-ruled p-4">
        <div className="label text-accent">Cycle review</div>
        <div className="mt-3 space-y-3">
          {log.map((c) => (
            <div key={c.index} className="border border-subtle bg-surface p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="label text-muted">C{c.index + 1}</span>
                  <CardChip card={c.reference} aceMode={aceMode} small still />
                  <span className="text-muted">·</span>
                  <CardChip card={c.low} aceMode={aceMode} small still />
                  <CardChip card={c.high} aceMode={aceMode} small still />
                  <span className="label text-muted">→</span>
                  <CardChip card={c.drawn} aceMode={aceMode} small still />
                </div>
                <span className={`num text-sm font-semibold ${c.net >= 0 ? "text-bull" : "text-bear"}`}>
                  {signed(c.net)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </article>

      <button onClick={onReplay} className="btn-primary w-full">
        Play again
      </button>
    </div>
  );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pctFill = Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-secondary">{label}</span>
        <span className="num font-semibold text-primary">
          {value.toFixed(1)}/{max}
        </span>
      </div>
      <div className="mt-1 h-2 w-full border border-subtle bg-surface">
        <div className="h-full bg-accent transition-all" style={{ width: `${pctFill}%` }} />
      </div>
    </div>
  );
}
