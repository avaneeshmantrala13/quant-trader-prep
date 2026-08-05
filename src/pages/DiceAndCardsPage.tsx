import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { GameChrome } from "@/components/games/GameChrome";
import { StampSeal } from "@/components/visuals/StampSeal";
import { DiceIcon } from "@/components/icons";
import { celebrate } from "@/lib/celebrate";
import { Rng } from "@/lib/rng";
import { browserBoardStore, submitLocalScore } from "@/lib/leaderboard/localBoard";
import { submitGameScore } from "@/lib/leaderboard/client";
import {
  browserSessionStore,
  clearGameSession,
  loadGameSession,
  saveGameSession,
} from "@/lib/leaderboard/gameSession";
import { PlayingCard, Die, CountUp, RoundPips } from "@/components/games/GameBits";
import { signedInt as signed } from "@/lib/games/format";
import {
  freshDeck,
  dealRound,
  productSD,
  productEV,
  realizedPnl,
  scoreRound,
  playerPriceFor,
  maxBuy,
  maxSell,
  START_BALANCE,
  type GameConfig,
  type Round,
  type Action,
  type Card,
  type AceMode,
} from "@/lib/games/diceAndCards/engine";

/**
 * DICE & CARDS (`/dice-and-cards`) — the multiplicative taker game (QuantGames
 * #6). Table value = product of 1–2 cards × 1–2 dice. Each round: answer the
 * standard-deviation question, read the computer's quote (phrased from ITS
 * side), size and trade, then state your P&L from memory once the table hides.
 * Scoring is asymmetric — an unrecognised loss is doubled. The final round asks
 * you to state your own running score. All logic lives in the pure engine.
 */

type Phase = "setup" | "sd" | "trade" | "reveal" | "pnl" | "score" | "final" | "summary";

const NUM_ROUNDS = 4;

const GAME_ID = "dice-and-cards";

interface RoundLog {
  round: Round;
  action: Action;
  size: number;
  realized: number;
  guess: number;
  guessCorrect: boolean;
  points: number;
}

/** Durable, reload-proof snapshot of an in-progress game (JSON-serializable). */
interface DiceCardsSession {
  config: GameConfig;
  phase: Phase;
  roundIdx: number;
  balance: number;
  log: RoundLog[];
  round: Round | null;
  action: Action | null;
  size: number;
  pnlGuess: string;
  current: RoundLog | null;
}

export function DiceAndCardsPage() {
  const navigate = useNavigate();
  const { themeDef } = useTheme();

  const [phase, setPhase] = useState<Phase>("setup");
  const [config, setConfig] = useState<GameConfig>({ numCards: 1, numDice: 1, aceMode: "high" });

  const rngRef = useRef<Rng>(new Rng(1));
  const deckRef = useRef<Card[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [roundIdx, setRoundIdx] = useState(0);
  const [balance, setBalance] = useState(START_BALANCE);
  const [log, setLog] = useState<RoundLog[]>([]);

  // per-round working state
  const [action, setAction] = useState<Action | null>(null);
  const [size, setSize] = useState(1);
  const [pnlGuess, setPnlGuess] = useState("");
  const [current, setCurrent] = useState<RoundLog | null>(null);

  const dealNext = (idx: number) => {
    const { round: r, deck } = dealRound(rngRef.current, deckRef.current, config);
    deckRef.current = deck.length >= config.numCards ? deck : rngRef.current.shuffle(freshDeck());
    setRound(r);
    setRoundIdx(idx);
    setAction(null);
    setSize(1);
    setPnlGuess("");
    setCurrent(null);
    setPhase("sd");
  };

  const startGame = () => {
    rngRef.current = new Rng(Math.floor(Math.random() * 1e9));
    deckRef.current = rngRef.current.shuffle(freshDeck());
    setBalance(START_BALANCE);
    setLog([]);
    dealNext(0);
  };

  /* ---- durable save/resume (mirrors the OA session pattern) ------------ */
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const env = loadGameSession<DiceCardsSession>(browserSessionStore(), GAME_ID);
    if (!env || env.status !== "active") return;
    const s = env.snapshot;
    // Fresh Rng + deck power future deals; the in-progress round is preserved.
    rngRef.current = new Rng(Math.floor(Math.random() * 1e9));
    deckRef.current = rngRef.current.shuffle(freshDeck());
    setConfig(s.config);
    setRoundIdx(s.roundIdx);
    setBalance(s.balance);
    setLog(s.log);
    setRound(s.round);
    setAction(s.action);
    setSize(s.size);
    setPnlGuess(s.pnlGuess);
    setCurrent(s.current);
    setPhase(s.phase);
  }, []);
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (phase === "setup" || phase === "summary") return;
    saveGameSession<DiceCardsSession>(
      browserSessionStore(),
      GAME_ID,
      { config, phase, roundIdx, balance, log, round, action, size, pnlGuess, current },
      Date.now(),
    );
  }, [phase, roundIdx, balance, log, round, action, size, pnlGuess, current, config]);

  const submitTrade = (a: Action, n: number) => {
    setAction(a);
    setSize(n);
    setPhase("reveal"); // brief reveal of the table
  };

  const submitPnl = () => {
    if (!round || !action) return;
    const realized = realizedPnl(action, size, round.quote, round.product);
    const guess = Math.round(parseFloat(pnlGuess) || 0);
    const guessCorrect = guess === realized;
    const points = scoreRound(realized, guessCorrect);
    const entry: RoundLog = { round, action, size, realized, guess, guessCorrect, points };
    setCurrent(entry);
    setLog((prev) => [...prev, entry]);
    setBalance((b) => b + points);
    setPhase("score");
  };

  const advance = () => {
    const next = roundIdx + 1;
    if (next >= NUM_ROUNDS) {
      setPhase("final");
    } else {
      dealNext(next);
    }
  };

  const finishFinal = () => {
    setPhase("summary");
    // Score = ending points balance. Record on the unified leaderboard +
    // optional server board, and clear the durable session.
    submitLocalScore(browserBoardStore(), GAME_ID, { score: balance, atMs: Date.now() });
    void submitGameScore(GAME_ID, balance);
    clearGameSession(browserSessionStore(), GAME_ID);
    if (balance >= START_BALANCE) setTimeout(themeDef.celebration ?? celebrate, 260);
  };

  return (
    <GameChrome
      title="Dice & Cards"
      onBack={() => navigate("/games")}
      backLabel="Back to games"
      titleExtra={
        phase !== "setup" && phase !== "summary" ? (
          <RoundPips total={NUM_ROUNDS} current={roundIdx} />
        ) : undefined
      }
      progress={
        phase !== "setup" && phase !== "summary"
          ? roundIdx / NUM_ROUNDS
          : undefined
      }
      headerRight={
        phase !== "setup" ? (
          <span className="chip border-accent text-accent" title="Points balance">
            <CountUp value={balance} />
          </span>
        ) : undefined
      }
    >
        {phase === "setup" && (
          <Setup config={config} setConfig={setConfig} onStart={startGame} />
        )}

        {phase === "sd" && round && (
          <SdScreen config={config} roundIdx={roundIdx} onContinue={() => setPhase("trade")} />
        )}

        {phase === "trade" && round && (
          <TradeScreen
            round={round}
            config={config}
            balance={balance}
            size={size}
            setSize={setSize}
            onTrade={submitTrade}
          />
        )}

        {phase === "reveal" && round && action && (
          <RevealScreen round={round} config={config} onDone={() => setPhase("pnl")} />
        )}

        {phase === "pnl" && round && action && (
          <PnlScreen
            action={action}
            size={size}
            quote={round.quote}
            value={pnlGuess}
            setValue={setPnlGuess}
            onSubmit={submitPnl}
          />
        )}

        {phase === "score" && current && (
          <ScoreScreen entry={current} config={config} onAdvance={advance} isLast={roundIdx + 1 >= NUM_ROUNDS} />
        )}

        {phase === "final" && (
          <FinalScreen log={log} onDone={finishFinal} />
        )}

        {phase === "summary" && (
          <SummaryView
            log={log}
            balance={balance}
            onReplay={() => {
              clearGameSession(browserSessionStore(), GAME_ID);
              setPhase("setup");
            }}
          />
        )}
    </GameChrome>
  );
}

/* ========================================================================== */
/*  Helpers + shared bits                                                       */
/* ========================================================================== */

// The counting/face value under the active ace mode (ace = 14 high / 1 low).
function faceOf(card: Card, aceMode: AceMode): number {
  return card.rank === 14 ? (aceMode === "high" ? 14 : 1) : card.rank;
}

function TableCard({ card, aceMode, flip, still }: { card: Card; aceMode: AceMode; flip?: boolean; still?: boolean }) {
  return <PlayingCard card={card} faceValue={faceOf(card, aceMode)} flip={flip} still={still} />;
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
          <span className="label text-accent">Multiplicative Market-Making Game</span>
          <span className="grid h-9 w-9 place-items-center border border-border-strong text-accent">
            <DiceIcon width={18} height={18} />
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          Price the product. Know its spread.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          The table value is the <span className="font-semibold text-primary">product</span> of every
          card and die on it. Each round you first answer the{" "}
          <span className="font-semibold text-primary">standard-deviation</span> question, then read
          the computer's quote, size your trade, and — once the table hides — state your P&amp;L from
          memory. A loss you fail to recognise is scored{" "}
          <span className="text-bear">double</span>.
        </p>
        <p className="mt-3 border-l-2 border-accent-2 bg-surface-muted px-3 py-2 text-[13px] text-secondary">
          <span className="label text-accent-2">Quote phrasing</span>
          <br />
          The quote is from the computer's side: “Buy at 33 / Sell at 37” means it buys at 33 (
          <span className="text-bull">your sell</span>) and sells at 37 (
          <span className="text-bear">your buy</span>). If you buy, you pay the higher number.
        </p>
      </article>

      <article className="panel-ruled p-6">
        <div className="label text-accent">Settings</div>
        <div className="mt-4 space-y-4">
          <Choice
            label="Cards on the table"
            value={config.numCards}
            options={[1, 2]}
            onChange={(v) => setConfig({ ...config, numCards: v as 1 | 2 })}
          />
          <Choice
            label="Dice on the table"
            value={config.numDice}
            options={[1, 2]}
            onChange={(v) => setConfig({ ...config, numDice: v as 1 | 2 })}
          />
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

        <div className="mt-4 flex items-center justify-between border border-subtle bg-surface-muted px-3 py-2 text-sm">
          <span className="label text-muted">Mean product (EV)</span>
          <span className="num font-semibold text-primary">
            {productEV(config).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>

        <button onClick={onStart} className="btn-primary mt-6 w-full">
          Start with {START_BALANCE.toLocaleString()} points →
        </button>
      </article>
    </div>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <span className="label mb-1 block text-secondary">{label}</span>
      <div className="flex overflow-hidden rounded-sm border border-border-strong">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`flex-1 px-4 py-2 font-mono text-xs uppercase tracking-label transition-colors ${
              value === o
                ? "bg-accent text-accent-contrast"
                : "bg-surface text-secondary hover:bg-surface-muted"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ========================================================================== */
/*  SD pre-question                                                             */
/* ========================================================================== */

function SdScreen({
  config,
  roundIdx,
  onContinue,
}: {
  config: GameConfig;
  roundIdx: number;
  onContinue: () => void;
}) {
  const trueSd = useMemo(() => productSD(config), [config]);
  const [val, setVal] = useState("");
  const [checked, setChecked] = useState(false);
  const ok = Math.abs((parseFloat(val) || 0) - trueSd) <= Math.max(1, trueSd * 0.05);

  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <span className="label text-accent">Round {roundIdx + 1} · Pre-trade question</span>
        <h2 className="mt-2 font-display text-xl font-semibold text-primary">
          What is the standard deviation of the product with these settings?
        </h2>
        <p className="mt-2 text-sm text-secondary">
          {config.numCards} card{config.numCards > 1 ? "s" : ""} × {config.numDice} di
          {config.numDice > 1 ? "ce" : "e"}, ace{" "}
          {config.aceMode === "high" ? "high (14)" : "low (1)"}. SD comes from the full joint
          distribution of the product — enter it to 2 decimals.
        </p>

        <div className="mt-4 flex gap-2">
          <input
            className="input flex-1"
            inputMode="decimal"
            value={val}
            disabled={checked}
            onChange={(e) => setVal(e.target.value)}
            placeholder="e.g. 19.97"
          />
          {!checked ? (
            <button onClick={() => setChecked(true)} className="btn-secondary">
              Check
            </button>
          ) : (
            <button onClick={onContinue} className="btn-primary">
              Trade →
            </button>
          )}
        </div>

        {checked && (
          <p className={`num mt-2 text-sm ${ok ? "text-bull" : "text-bear"}`}>
            {ok ? "✓ within range" : "✗"} · true σ ={" "}
            <span className="font-semibold">{trueSd.toFixed(2)}</span>
          </p>
        )}
      </article>
    </div>
  );
}

/* ========================================================================== */
/*  Trade                                                                       */
/* ========================================================================== */

function TradeScreen({
  round,
  config,
  balance,
  size,
  setSize,
  onTrade,
}: {
  round: Round;
  config: GameConfig;
  balance: number;
  size: number;
  setSize: (n: number) => void;
  onTrade: (a: Action, n: number) => void;
}) {
  const mb = maxBuy(balance, round.quote);
  const ms = maxSell(balance, round.quote, config);

  return (
    <div className="animate-print-in space-y-5">
      {/* Table (face-up while trading) */}
      <article className="panel-ruled p-5">
        <div className="label text-accent">The table</div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {round.cards.map((c, i) => (
            <TableCard key={`c${i}`} card={c} aceMode={config.aceMode} />
          ))}
          {round.dice.map((d, i) => (
            <Die key={`d${i}`} value={d} />
          ))}
        </div>
        <p className="mt-3 text-[13px] text-muted">
          Value = product of every face. Compute it now — it hides once you trade.
        </p>
      </article>

      {/* Quote */}
      <article className="panel-ruled p-5">
        <div className="label text-accent">The computer quotes</div>
        <div className="mt-3 flex items-center justify-around gap-4">
          <div className="text-center">
            <div className="label text-bull">Buys at {round.quote.bid}</div>
            <div className="num mt-1 text-xs text-muted">you SELL @ {round.quote.bid}</div>
          </div>
          <div className="h-10 w-px bg-subtle" />
          <div className="text-center">
            <div className="label text-bear">Sells at {round.quote.ask}</div>
            <div className="num mt-1 text-xs text-muted">you BUY @ {round.quote.ask}</div>
          </div>
        </div>

        {/* Size */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <span className="label text-secondary">Shares</span>
            <span className="num text-xs text-muted">
              max buy {mb.toLocaleString()} · max sell {Number.isFinite(ms) ? ms.toLocaleString() : "∞"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[1, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => setSize(n)}
                className={`chip ${size === n ? "border-accent bg-accent text-accent-contrast" : "border-subtle text-secondary"}`}
              >
                {n}
              </button>
            ))}
            <input
              className="input num w-24"
              inputMode="numeric"
              value={size}
              onChange={(e) => setSize(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => onTrade("sell", size)} className="btn-secondary !border-bull !text-bull">
            Sell {size} @ {round.quote.bid}
          </button>
          <button onClick={() => onTrade("buy", size)} className="btn-secondary !border-bear !text-bear">
            Buy {size} @ {round.quote.ask}
          </button>
        </div>
      </article>
    </div>
  );
}

/* ========================================================================== */
/*  Brief reveal (table flashes, then hides)                                    */
/* ========================================================================== */

function RevealScreen({
  round,
  config,
  onDone,
}: {
  round: Round;
  config: GameConfig;
  onDone: () => void;
}) {
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6 text-center">
        <span className="label text-accent">Memorise the table</span>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {round.cards.map((c, i) => (
            <TableCard key={`c${i}`} card={c} aceMode={config.aceMode} />
          ))}
          {round.dice.map((d, i) => (
            <Die key={`d${i}`} value={d} />
          ))}
        </div>
        <p className="mt-4 text-sm text-secondary">
          You traded at the quote. Next you'll state your P&amp;L{" "}
          <span className="font-semibold text-primary">from memory</span> — the table hides.
        </p>
        <button onClick={onDone} className="btn-primary mx-auto mt-5 w-full max-w-xs">
          Hide the table →
        </button>
      </article>
    </div>
  );
}

/* ========================================================================== */
/*  P&L input (from memory)                                                     */
/* ========================================================================== */

function PnlScreen({
  action,
  size,
  quote,
  value,
  setValue,
  onSubmit,
}: {
  action: Action;
  size: number;
  quote: { bid: number; ask: number };
  value: string;
  setValue: (v: string) => void;
  onSubmit: () => void;
}) {
  const price = playerPriceFor(action, quote);
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <span className="label text-accent">From memory</span>
        <h2 className="mt-2 font-display text-xl font-semibold text-primary">
          What is your profit or loss?
        </h2>
        <p className="mt-2 num text-sm text-secondary">
          You{" "}
          <span className={action === "buy" ? "text-bear" : "text-bull"}>
            {action === "buy" ? "BOUGHT" : "SOLD"} {size}
          </span>{" "}
          @ {price}.{" "}
          {action === "buy" ? "(product − ask) × N" : "(bid − product) × N"}. Use a minus sign for a
          loss.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            className="input num flex-1"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. −310"
          />
          <button onClick={onSubmit} className="btn-primary" disabled={value.trim() === ""}>
            Lock it in →
          </button>
        </div>
      </article>
    </div>
  );
}

/* ========================================================================== */
/*  Score reveal                                                                */
/* ========================================================================== */

function ScoreScreen({
  entry,
  config,
  onAdvance,
  isLast,
}: {
  entry: RoundLog;
  config: GameConfig;
  onAdvance: () => void;
  isLast: boolean;
}) {
  const { round, realized, guess, guessCorrect, points } = entry;
  const loss = realized < 0;

  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <div className="label text-accent">Reveal</div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {round.cards.map((c, i) => (
            <TableCard key={`c${i}`} card={c} aceMode={config.aceMode} flip />
          ))}
          {round.dice.map((d, i) => (
            <Die key={`d${i}`} value={d} />
          ))}
        </div>
        <p className="num mt-3 text-sm text-secondary">
          Product ={" "}
          <span className="font-semibold text-primary">
            <CountUp value={round.product} />
          </span>
        </p>
      </article>

      <article
        className={`panel-ruled border-l-4 p-5 ${guessCorrect ? "border-l-bull" : "border-l-bear"}`}
      >
        <p className={`font-display text-lg font-semibold ${guessCorrect ? "text-bull" : "text-bear"}`}>
          {guessCorrect ? "P&L correct" : "P&L wrong"}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
          <Stat label="Your answer" value={signed(guess)} />
          <Stat label="Actual P&L" value={signed(realized)} tone={loss ? "bear" : "bull"} />
        </div>
        <p className="mt-3 border-l-2 border-accent bg-surface-muted px-3 py-2 text-[13px] text-secondary">
          {guessCorrect
            ? loss
              ? "You recognised the loss — scored once."
              : "Correct profit, scored in full."
            : loss
              ? "You missed a loss — it's scored DOUBLE."
              : "A profit you couldn't verify scores zero."}
        </p>
        <div className="mt-3 flex items-center justify-between border border-subtle bg-surface px-3 py-2">
          <span className="label text-muted">Points change</span>
          <span className={`num text-lg font-bold ${points >= 0 ? "text-bull" : "text-bear"}`}>
            {signed(points)}
          </span>
        </div>
      </article>

      <button onClick={onAdvance} className="btn-primary w-full">
        {isLast ? "Final question →" : "Next round →"}
      </button>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "bull" | "bear" }) {
  return (
    <div className="border border-subtle bg-surface px-3 py-2">
      <div className="label text-muted">{label}</div>
      <div
        className={`num text-base font-semibold ${
          tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-primary"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

/* ========================================================================== */
/*  Final "state your score" question                                          */
/* ========================================================================== */

function FinalScreen({ log, onDone }: { log: RoundLog[]; onDone: () => void }) {
  const trueBalance = START_BALANCE + log.reduce((a, e) => a + e.points, 0);
  const [val, setVal] = useState("");
  const [checked, setChecked] = useState(false);
  const ok = Math.round(parseFloat(val.replace(/[, ]/g, "")) || 0) === trueBalance;

  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <span className="label text-accent">Final question</span>
        <h2 className="mt-2 font-display text-xl font-semibold text-primary">
          You started with {START_BALANCE.toLocaleString()} points. What is your final score?
        </h2>
        <p className="mt-2 text-sm text-secondary">
          You had to track your running P&amp;L across the round scores. Enter your final balance.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            className="input num flex-1"
            inputMode="numeric"
            value={val}
            disabled={checked}
            onChange={(e) => setVal(e.target.value)}
            placeholder="e.g. 498894"
          />
          {!checked ? (
            <button onClick={() => setChecked(true)} className="btn-secondary">
              Check
            </button>
          ) : (
            <button onClick={onDone} className="btn-primary">
              See summary →
            </button>
          )}
        </div>
        {checked && (
          <p className={`num mt-2 text-sm ${ok ? "text-bull" : "text-bear"}`}>
            {ok ? "✓ you tracked it" : "✗"} · actual final score{" "}
            <span className="font-semibold">{trueBalance.toLocaleString()}</span>
          </p>
        )}
      </article>
    </div>
  );
}

/* ========================================================================== */
/*  Summary                                                                     */
/* ========================================================================== */

function SummaryView({
  log,
  balance,
  onReplay,
}: {
  log: RoundLog[];
  balance: number;
  onReplay: () => void;
}) {
  const netPnl = balance - START_BALANCE;
  const correct = log.filter((e) => e.guessCorrect).length;
  const win = netPnl >= 0;

  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled relative overflow-hidden p-6 text-center">
        <StampSeal label={win ? "IN THE MONEY" : "DOWN"} tone={win ? "bull" : "bear"} />
        <span className="label text-accent">Final score</span>
        <div className="num mt-3 font-display text-5xl font-black text-primary">
          {balance.toLocaleString()}
        </div>
        <p className={`num mt-1 text-lg font-semibold ${win ? "text-bull" : "text-bear"}`}>
          {signed(netPnl)} net P&L
        </p>
        <p className="mt-2 text-sm text-secondary">
          {correct}/{log.length} P&amp;L answers correct
        </p>
      </article>

      <article className="panel-ruled p-4">
        <div className="label text-accent">Game review</div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="label text-muted">
                <th className="py-1.5 pr-2">R</th>
                <th className="py-1.5 pr-2">Product</th>
                <th className="py-1.5 pr-2">Act</th>
                <th className="py-1.5 pr-2">Sz</th>
                <th className="py-1.5 pr-2">You</th>
                <th className="py-1.5 pr-2">Actual</th>
                <th className="py-1.5 text-right">Δ Pts</th>
              </tr>
            </thead>
            <tbody className="num divide-y divide-subtle">
              {log.map((e, i) => (
                <tr key={i}>
                  <td className="py-1.5 pr-2 text-muted">{i + 1}</td>
                  <td className="py-1.5 pr-2 text-primary">{e.round.product.toLocaleString()}</td>
                  <td className="py-1.5 pr-2 text-secondary">{e.action}</td>
                  <td className="py-1.5 pr-2 text-secondary">{e.size}</td>
                  <td className={`py-1.5 pr-2 ${e.guessCorrect ? "text-bull" : "text-bear"}`}>
                    {signed(e.guess)}
                  </td>
                  <td className="py-1.5 pr-2 text-secondary">{signed(e.realized)}</td>
                  <td className={`py-1.5 text-right font-semibold ${e.points >= 0 ? "text-bull" : "text-bear"}`}>
                    {signed(e.points)}
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
