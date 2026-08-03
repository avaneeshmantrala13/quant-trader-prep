import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { StampSeal } from "@/components/visuals/StampSeal";
import { ChevronLeftIcon, CardsIcon, GaugeIcon } from "@/components/icons";
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
import {
  dealRound,
  gradeOutcome,
  maxBuySize,
  maxSellSize,
  payForFirstCard,
  evSum,
  meanCard,
  rankLabel,
  START_BALANCE,
  type Action,
  type Card,
  type CardsRound,
  type RoundOutcome,
  type RoundConfig,
} from "@/lib/games/cardsMarketMaking/engine";

/**
 * CARDS MARKET MAKING — TAKER (`/cards-market-making`) — self-contained,
 * full-screen game built from `QuantGames-Mechanics.md` Game 3.
 *
 * A maker quotes `B at A` on the sum of N hidden cards. You size lots and Buy /
 * Sell / No-Trade against your EV estimate, the cards flip briefly, then you
 * must state the EXACT realized P&L. Wrong LOSS guesses are penalised 2×.
 * A pre-game value-of-information question ("pay to show the first card?")
 * teaches the info calc. Everything deals fresh, so nothing is memorizable.
 */

type Phase = "setup" | "voi" | "quote" | "reveal" | "pnl" | "result" | "summary";

const SUIT_TONE = (suit: string) =>
  suit === "♥" || suit === "♦" ? "text-bear" : "text-primary";

const GAME_ID = "cards-market-making";

/** Durable, reload-proof snapshot of an in-progress game (JSON-serializable). */
interface CardsSession {
  numRounds: number;
  numCards: number;
  aceHigh: boolean;
  phase: Phase;
  balance: number;
  roundIdx: number;
  round: CardsRound | null;
  action: Action;
  size: number;
  pnlGuess: string;
  voiGuess: string;
  outcome: RoundOutcome | null;
  log: RoundOutcome[];
}

export function CardsMarketMakingPage() {
  const navigate = useNavigate();
  const { themeDef } = useTheme();

  /* ---- config ---------------------------------------------------------- */
  const [numRounds, setNumRounds] = useState(5);
  const [numCards, setNumCards] = useState(3);
  const [aceHigh, setAceHigh] = useState(true);

  /* ---- session --------------------------------------------------------- */
  const [phase, setPhase] = useState<Phase>("setup");
  const rngRef = useRef<Rng>(new Rng(1));
  const [balance, setBalance] = useState(START_BALANCE);
  const [roundIdx, setRoundIdx] = useState(1);
  const [round, setRound] = useState<CardsRound | null>(null);

  const [action, setAction] = useState<Action>("none");
  const [size, setSize] = useState(1);
  const [pnlGuess, setPnlGuess] = useState("");
  const [voiGuess, setVoiGuess] = useState("");
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const [log, setLog] = useState<RoundOutcome[]>([]);

  const config: RoundConfig = useMemo(
    () => ({ numCards, aceValue: aceHigh ? 14 : 1, replace: false }),
    [numCards, aceHigh],
  );

  /* ---- durable save/resume (mirrors the OA session pattern) ------------ */
  const hydratedRef = useRef(false);
  // Resume a partly-played game on re-entry (a fresh Rng powers future deals;
  // the games are random every deal, so only the user's PROGRESS must persist).
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const env = loadGameSession<CardsSession>(browserSessionStore(), GAME_ID);
    if (!env || env.status !== "active") return;
    const s = env.snapshot;
    rngRef.current = new Rng(Math.floor(Math.random() * 1e9));
    setNumRounds(s.numRounds);
    setNumCards(s.numCards);
    setAceHigh(s.aceHigh);
    setBalance(s.balance);
    setRoundIdx(s.roundIdx);
    setRound(s.round);
    setAction(s.action);
    setSize(s.size);
    setPnlGuess(s.pnlGuess);
    setVoiGuess(s.voiGuess);
    setOutcome(s.outcome);
    setLog(s.log);
    setPhase(s.phase);
  }, []);
  // Persist every meaningful change while a run is in progress.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (phase === "setup" || phase === "summary") return;
    saveGameSession<CardsSession>(
      browserSessionStore(),
      GAME_ID,
      { numRounds, numCards, aceHigh, phase, balance, roundIdx, round, action, size, pnlGuess, voiGuess, outcome, log },
      Date.now(),
    );
  }, [phase, balance, roundIdx, round, action, size, pnlGuess, voiGuess, outcome, log, numRounds, numCards, aceHigh]);

  /* ---- lifecycle ------------------------------------------------------- */
  const start = () => {
    const rng = new Rng(Math.floor(Math.random() * 1e9));
    rngRef.current = rng;
    setBalance(START_BALANCE);
    setRoundIdx(1);
    setLog([]);
    const r = dealRound(rng, config);
    setRound(r);
    setVoiGuess("");
    setPhase("voi");
  };

  const beginQuote = () => {
    resetTrade();
    setPhase("quote");
  };

  const resetTrade = () => {
    setAction("none");
    setSize(1);
    setPnlGuess("");
    setOutcome(null);
  };

  const submitTrade = () => {
    setPhase("reveal");
  };

  const submitPnl = () => {
    if (!round) return;
    const guess = parseInt(pnlGuess, 10) || 0;
    const o = gradeOutcome(round, action, action === "none" ? 0 : size, guess);
    setOutcome(o);
    setBalance((b) => b + o.score);
    setLog((l) => [...l, o]);
    setPhase("result");
  };

  const advance = () => {
    if (roundIdx >= numRounds) {
      setPhase("summary");
      // Score = ending points balance. Record on the unified leaderboard and
      // clear the durable session (a finished run is not resumable).
      submitLocalScore(browserBoardStore(), GAME_ID, { score: balance, atMs: Date.now() });
      void submitGameScore(GAME_ID, balance);
      clearGameSession(browserSessionStore(), GAME_ID);
      if (balance >= START_BALANCE) setTimeout(themeDef.celebration ?? celebrate, 260);
      return;
    }
    const next = roundIdx + 1;
    setRoundIdx(next);
    const r = dealRound(rngRef.current, config);
    setRound(r);
    resetTrade();
    setPhase("quote");
  };

  /* ---- render ---------------------------------------------------------- */
  return (
    <div className="relative min-h-[100dvh]">
      <ThemeBackground />

      <header className="sticky top-0 z-20 border-b-[3px] border-border-strong bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <button
            onClick={() => navigate("/")}
            className="btn-ghost !min-h-0 !px-2 !py-1.5"
            aria-label="Back home"
          >
            <ChevronLeftIcon width={18} height={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-semibold text-primary">
              Cards Market Making · Taker
            </div>
            {phase !== "setup" && phase !== "voi" && (
              <div className="label mt-0.5 text-muted">
                Round {roundIdx} / {numRounds}
              </div>
            )}
          </div>
          {phase !== "setup" && (
            <div className="text-right">
              <div className="label text-muted">Balance</div>
              <div
                className={`num text-sm font-semibold ${
                  balance >= START_BALANCE ? "text-bull" : "text-bear"
                }`}
              >
                {balance} pts
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-6">
        {phase === "setup" && (
          <SetupScreen
            numRounds={numRounds}
            setNumRounds={setNumRounds}
            numCards={numCards}
            setNumCards={setNumCards}
            aceHigh={aceHigh}
            setAceHigh={setAceHigh}
            onStart={start}
          />
        )}

        {phase === "voi" && round && (
          <VoiScreen
            round={round}
            guess={voiGuess}
            setGuess={setVoiGuess}
            aceValue={config.aceValue}
            onContinue={beginQuote}
          />
        )}

        {(phase === "quote" || phase === "reveal") && round && (
          <TradeScreen
            round={round}
            revealed={phase === "reveal"}
            action={action}
            setAction={setAction}
            size={size}
            setSize={setSize}
            balance={balance}
            aceValue={config.aceValue}
            onSubmitTrade={submitTrade}
            onProceedToPnl={() => setPhase("pnl")}
          />
        )}

        {phase === "pnl" && round && (
          <PnlScreen
            round={round}
            action={action}
            size={size}
            pnlGuess={pnlGuess}
            setPnlGuess={setPnlGuess}
            onSubmit={submitPnl}
          />
        )}

        {phase === "result" && outcome && (
          <ResultScreen
            outcome={outcome}
            isLast={roundIdx >= numRounds}
            onAdvance={advance}
          />
        )}

        {phase === "summary" && (
          <SummaryScreen
            balance={balance}
            log={log}
            onReplay={() => {
              clearGameSession(browserSessionStore(), GAME_ID);
              setPhase("setup");
            }}
          />
        )}
      </main>
    </div>
  );
}

/* ========================================================================== */
/*  shared bits                                                                */
/* ========================================================================== */

function PlayingCard({ card, faceDown }: { card?: Card; faceDown?: boolean }) {
  if (faceDown || !card) {
    return (
      <div className="grid h-24 w-16 place-items-center rounded-md border-2 border-border-strong bg-surface-muted">
        <div className="h-16 w-10 rounded-sm border border-subtle bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgb(var(--color-subtle))_4px,rgb(var(--color-subtle))_5px)]" />
      </div>
    );
  }
  return (
    <div className="animate-print-in relative grid h-24 w-16 place-items-center rounded-md border-2 border-border-strong bg-surface">
      <span className={`font-display text-2xl font-bold ${SUIT_TONE(card.suit)}`}>
        {rankLabel(card.rank)}
      </span>
      <span className={`absolute bottom-1 right-1.5 text-lg ${SUIT_TONE(card.suit)}`}>
        {card.suit}
      </span>
      <span className="num absolute left-1.5 top-1 text-[10px] text-muted">
        {card.value}
      </span>
    </div>
  );
}

function QuoteBadge({ round }: { round: CardsRound }) {
  return (
    <div className="flex items-center justify-center gap-4 border border-border-strong bg-surface-muted px-5 py-3">
      <div className="text-center">
        <div className="label text-bull">Bid · you sell</div>
        <div className="num text-2xl font-bold text-primary">{round.quote.bid}</div>
      </div>
      <span className="text-muted">at</span>
      <div className="text-center">
        <div className="label text-bear">Ask · you buy</div>
        <div className="num text-2xl font-bold text-primary">{round.quote.ask}</div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/*  Setup                                                                      */
/* ========================================================================== */

function SetupScreen(props: {
  numRounds: number;
  setNumRounds: (n: number) => void;
  numCards: number;
  setNumCards: (n: number) => void;
  aceHigh: boolean;
  setAceHigh: (b: boolean) => void;
  onStart: () => void;
}) {
  const { numRounds, setNumRounds, numCards, setNumCards, aceHigh, setAceHigh, onStart } = props;
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <div className="flex items-center justify-between">
          <span className="label text-accent">Market-Making Game · Taker</span>
          <span className="grid h-9 w-9 place-items-center border border-border-strong text-accent">
            <CardsIcon width={18} height={18} />
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          Take the quote only when it's wrong.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          A maker quotes <span className="num">B at A</span> on the sum of{" "}
          {numCards} hidden cards. Expected sum is{" "}
          <span className="num text-primary">
            {evSum(numCards, aceHigh ? 14 : 1)}
          </span>{" "}
          ({numCards} × {meanCard(aceHigh ? 14 : 1)}/card).{" "}
          <strong className="text-primary">Buy</strong> when the ask sits below EV,{" "}
          <strong className="text-primary">Sell</strong> when the bid sits above it, otherwise{" "}
          <strong className="text-primary">pass</strong>. The cards flip for a moment — then you
          state the <em>exact</em> P&amp;L. A wrong loss guess costs double.
        </p>
      </article>

      <article className="panel-ruled p-5">
        <div className="label text-accent">Game settings</div>
        <div className="mt-4 space-y-5">
          <Slider label="Number of rounds" value={numRounds} min={3} max={10} onChange={setNumRounds} />
          <Slider
            label="Cards per round"
            value={numCards}
            min={2}
            max={4}
            onChange={setNumCards}
            hint={`EV of the sum = ${evSum(numCards, aceHigh ? 14 : 1)}`}
          />
          <div>
            <span className="label mb-1 block text-accent">Ace value</span>
            <div className="flex overflow-hidden rounded-sm border border-border-strong">
              {[
                { on: !aceHigh, label: "Low (1)", set: () => setAceHigh(false) },
                { on: aceHigh, label: "High (14)", set: () => setAceHigh(true) },
              ].map((o) => (
                <button
                  key={o.label}
                  onClick={o.set}
                  className={`flex-1 px-4 py-2 font-mono text-xs uppercase tracking-label transition-colors ${
                    o.on ? "bg-accent text-accent-contrast" : "bg-surface text-secondary hover:bg-surface-muted"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button onClick={onStart} className="btn-primary mt-6 w-full">
          Deal the first market →
        </button>
      </article>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label text-accent">{label}</span>
        <span className="num text-sm font-semibold text-primary">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="mt-2 w-full accent-[rgb(var(--color-accent))]"
      />
      {hint && <p className="label mt-1 !normal-case tracking-normal text-muted">{hint}</p>}
    </div>
  );
}

/* ========================================================================== */
/*  Value-of-information pre-game question                                      */
/* ========================================================================== */

function VoiScreen({
  round,
  guess,
  setGuess,
  aceValue,
  onContinue,
}: {
  round: CardsRound;
  guess: string;
  setGuess: (s: string) => void;
  aceValue: number;
  onContinue: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const answer = payForFirstCard(round.quote, round.config.numCards, aceValue);
  const g = parseFloat(guess);
  const close = Number.isFinite(g) && Math.abs(g - answer) <= 0.5;

  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <span className="label text-accent-2">Warm-up · value of information</span>
        <h2 className="mt-2 font-display text-xl font-semibold text-primary">
          How much would you pay to see the first card?
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          The maker quotes the market below and you're <em>forced to trade</em>. For each possible
          first-card value, you'd re-centre EV and take the least-bad side. Averaged over all card
          values, what is one look worth?
        </p>
        <div className="mt-4">
          <QuoteBadge round={round} />
        </div>

        <div className="mt-5 flex items-end gap-3">
          <div className="flex-1">
            <span className="label text-accent">Your answer (points)</span>
            <input
              className="input num mt-1 w-full"
              inputMode="decimal"
              placeholder="0.00"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
            />
          </div>
          {!revealed ? (
            <button onClick={() => setRevealed(true)} className="btn-secondary">
              Check
            </button>
          ) : null}
        </div>

        {revealed && (
          <div className="animate-print-in mt-4 border-l-2 border-accent bg-surface-muted px-4 py-3">
            <p className="text-sm text-secondary">
              Exact value:{" "}
              <span className="num font-semibold text-primary">{answer.toFixed(2)} pts</span>
              {Number.isFinite(g) && (
                <span className={`ml-2 ${close ? "text-bull" : "text-bear"}`}>
                  {close ? "· nicely done" : "· off — see the method"}
                </span>
              )}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              Mid-centred quotes converge to <span className="num">29/13 ≈ 2.23</span>. A skewed
              quote is worth more, but subtract the baseline edge you already have at the quote.
            </p>
          </div>
        )}
      </article>

      <button onClick={onContinue} className="btn-primary w-full">
        Start the round →
      </button>
    </div>
  );
}

/* ========================================================================== */
/*  Trade screen (quote → act; then brief reveal)                              */
/* ========================================================================== */

function TradeScreen({
  round,
  revealed,
  action,
  setAction,
  size,
  setSize,
  balance,
  aceValue,
  onSubmitTrade,
  onProceedToPnl,
}: {
  round: CardsRound;
  revealed: boolean;
  action: Action;
  setAction: (a: Action) => void;
  size: number;
  setSize: (n: number) => void;
  balance: number;
  aceValue: number;
  onSubmitTrade: () => void;
  onProceedToPnl: () => void;
}) {
  const maxBuy = maxBuySize(balance, round.quote.ask);
  const maxSell = maxSellSize(balance, round.quote.bid, round.config.numCards, aceValue);

  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-5">
        <div className="label text-accent">
          {revealed ? "The cards" : `${round.config.numCards} face-down cards`}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          {round.cards.map((c, i) => (
            <PlayingCard key={i} card={c} faceDown={!revealed} />
          ))}
        </div>
        {revealed && (
          <p className="num mt-3 text-center text-sm text-secondary">
            Sum ={" "}
            <span className="text-lg font-bold text-primary">{round.sum}</span>
          </p>
        )}
        <div className="mt-4">
          <QuoteBadge round={round} />
        </div>
      </article>

      {!revealed ? (
        <>
          <article className="panel-ruled p-5">
            <div className="label text-accent">Your trade</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(
                [
                  { a: "buy" as Action, label: "Buy (lift ask)", cls: "border-bear text-bear" },
                  { a: "sell" as Action, label: "Sell (hit bid)", cls: "border-bull text-bull" },
                  { a: "none" as Action, label: "No trade", cls: "border-subtle text-muted" },
                ]
              ).map((o) => (
                <button
                  key={o.a}
                  onClick={() => setAction(o.a)}
                  className={`rounded-sm border-2 px-2 py-3 text-sm font-semibold transition-colors ${
                    action === o.a ? `${o.cls} bg-surface-muted` : "border-subtle text-secondary hover:bg-surface-muted"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {action !== "none" && (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <span className="label text-accent">Size (lots)</span>
                  <span className="label !normal-case tracking-normal text-muted">
                    max {action === "buy" ? maxBuy : maxSell === Infinity ? "∞" : maxSell}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {[1, 5, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => setSize(n)}
                      className={`btn-ghost !min-h-0 !px-3 !py-1 num text-xs ${
                        size === n ? "!border-accent !text-accent" : ""
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <input
                    className="input num !py-1 w-24 text-center text-sm"
                    inputMode="numeric"
                    value={size}
                    onChange={(e) => setSize(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                </div>
              </div>
            )}
          </article>

          <button onClick={onSubmitTrade} className="btn-primary w-full">
            {action === "none" ? "Pass — reveal the cards" : "Place order & reveal →"}
          </button>
        </>
      ) : (
        <>
          <article className="panel-ruled bg-surface-muted p-4 text-center">
            <p className="text-sm text-secondary">
              Study the sum. Next you'll state your{" "}
              <strong className="text-primary">exact P&amp;L</strong> — the cards go away.
            </p>
          </article>
          <button onClick={onProceedToPnl} className="btn-primary w-full">
            I've got it — state my P&amp;L →
          </button>
        </>
      )}
    </div>
  );
}

/* ========================================================================== */
/*  P&L input (cards hidden again)                                             */
/* ========================================================================== */

function PnlScreen({
  round,
  action,
  size,
  pnlGuess,
  setPnlGuess,
  onSubmit,
}: {
  round: CardsRound;
  action: Action;
  size: number;
  pnlGuess: string;
  setPnlGuess: (s: string) => void;
  onSubmit: () => void;
}) {
  const side =
    action === "buy"
      ? `Bought ${size} @ ${round.quote.ask}`
      : action === "sell"
        ? `Sold ${size} @ ${round.quote.bid}`
        : "No trade";
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <div className="flex items-center gap-2 text-accent">
          <GaugeIcon width={16} height={16} />
          <span className="label text-accent">State your P&amp;L</span>
        </div>
        <p className="mt-3 text-[15px] text-secondary">
          Your trade: <strong className="text-primary">{side}</strong>. What is your profit or
          loss? Use a minus sign for a loss.
        </p>
        {action !== "none" && (
          <p className="num mt-2 text-[13px] text-muted">
            {action === "buy"
              ? `(sum − ${round.quote.ask}) × ${size}`
              : `(${round.quote.bid} − sum) × ${size}`}
          </p>
        )}
        <input
          className="input num mt-4 w-full text-center text-lg"
          inputMode="numeric"
          placeholder="0"
          value={pnlGuess}
          onChange={(e) => setPnlGuess(e.target.value)}
          autoFocus
        />
      </article>
      <button onClick={onSubmit} className="btn-primary w-full">
        Lock it in →
      </button>
    </div>
  );
}

/* ========================================================================== */
/*  Result                                                                     */
/* ========================================================================== */

function ResultScreen({
  outcome,
  isLast,
  onAdvance,
}: {
  outcome: RoundOutcome;
  isLast: boolean;
  onAdvance: () => void;
}) {
  const { round, action, actualPnl, guessCorrect, score, decisionCorrect, edge } = outcome;
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-5">
        <div className="label text-accent">The cards</div>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          {round.cards.map((c, i) => (
            <PlayingCard key={i} card={c} />
          ))}
        </div>
        <p className="num mt-3 text-center text-sm text-secondary">
          Sum = <span className="text-lg font-bold text-primary">{round.sum}</span> · EV was{" "}
          {round.evSum} · quote {round.quote.bid} at {round.quote.ask}
        </p>
      </article>

      <article className="panel-ruled p-5">
        <div className="grid grid-cols-2 gap-4">
          <ResultStat
            label="Correct P&L"
            value={`${actualPnl >= 0 ? "+" : "−"}${Math.abs(actualPnl)}`}
            tone={actualPnl}
          />
          <ResultStat
            label={`Score (${guessCorrect ? "exact" : actualPnl < 0 ? "wrong loss ×2" : "wrong — 0"})`}
            value={`${score >= 0 ? "+" : "−"}${Math.abs(score)}`}
            tone={score}
          />
        </div>
        <div className="mt-4 space-y-2 border-t border-subtle pt-4 text-[13px]">
          <Verdict
            ok={decisionCorrect}
            label="Decision"
            detail={
              edge.correctAction === "none"
                ? "No edge — passing was right"
                : `Edge was to ${edge.correctAction} (${edge.edgePerLot.toFixed(0)}/lot). You ${
                    action === "none" ? "passed" : action + "ed"
                  }.`
            }
          />
          <Verdict
            ok={guessCorrect}
            label="P&L precision"
            detail={
              guessCorrect
                ? "Exact — full credit"
                : actualPnl < 0
                  ? "Missed a loss → penalty doubled"
                  : "Missed a profit → zero credit"
            }
          />
        </div>
      </article>

      <button onClick={onAdvance} className="btn-primary w-full">
        {isLast ? "See your score →" : "Next round →"}
      </button>
    </div>
  );
}

function ResultStat({ label, value, tone }: { label: string; value: string; tone: number }) {
  const color = tone > 0 ? "text-bull" : tone < 0 ? "text-bear" : "text-secondary";
  return (
    <div className="text-center">
      <div className="label text-muted">{label}</div>
      <div className={`num text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function Verdict({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`chip shrink-0 ${ok ? "border-bull text-bull" : "border-bear text-bear"}`}>
        {ok ? "✓" : "✕"}
      </span>
      <p className="text-secondary">
        <span className="font-semibold text-primary">{label}:</span> {detail}
      </p>
    </div>
  );
}

/* ========================================================================== */
/*  Summary                                                                    */
/* ========================================================================== */

function SummaryScreen({
  balance,
  log,
  onReplay,
}: {
  balance: number;
  log: RoundOutcome[];
  onReplay: () => void;
}) {
  const pnl = balance - START_BALANCE;
  const win = pnl >= 0;
  const decisions = log.filter((o) => o.decisionCorrect).length;
  const precise = log.filter((o) => o.guessCorrect).length;

  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled relative overflow-hidden p-6 text-center">
        <StampSeal label={win ? "IN THE GREEN" : "IN THE RED"} tone={win ? "bull" : "bear"} />
        <span className="label text-accent">Final balance</span>
        <div className="num mt-3 font-display text-5xl font-black text-primary">{balance}</div>
        <p className={`num mt-1 text-lg font-semibold ${win ? "text-bull" : "text-bear"}`}>
          {pnl >= 0 ? "+" : "−"}
          {Math.abs(pnl)} pts
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <ResultStat label="Correct decisions" value={`${decisions}/${log.length}`} tone={1} />
          <ResultStat label="Exact P&L calls" value={`${precise}/${log.length}`} tone={1} />
        </div>
      </article>

      <article className="panel-ruled p-4">
        <div className="label text-accent">Round review</div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="label text-muted">
                <th className="py-1 pr-2 font-normal">#</th>
                <th className="py-1 px-2 font-normal">Cards</th>
                <th className="py-1 px-2 text-right font-normal">Sum</th>
                <th className="py-1 px-2 text-right font-normal">Quote</th>
                <th className="py-1 px-2 text-right font-normal">You</th>
                <th className="py-1 px-2 text-right font-normal">P&L</th>
                <th className="py-1 pl-2 text-right font-normal">Score</th>
              </tr>
            </thead>
            <tbody className="num">
              {log.map((o, i) => (
                <tr key={i} className="border-t border-subtle">
                  <td className="py-1.5 pr-2 text-muted">{i + 1}</td>
                  <td className="py-1.5 px-2 font-sans text-secondary">
                    {o.round.cards.map((c) => `${rankLabel(c.rank)}${c.suit}`).join(" ")}
                  </td>
                  <td className="py-1.5 px-2 text-right">{o.round.sum}</td>
                  <td className="py-1.5 px-2 text-right text-muted">
                    {o.round.quote.bid}/{o.round.quote.ask}
                  </td>
                  <td className="py-1.5 px-2 text-right">
                    {o.action === "none" ? "pass" : `${o.action} ${o.size}`}
                  </td>
                  <td
                    className={`py-1.5 px-2 text-right ${
                      o.actualPnl > 0 ? "text-bull" : o.actualPnl < 0 ? "text-bear" : "text-muted"
                    }`}
                  >
                    {o.actualPnl >= 0 ? "+" : "−"}
                    {Math.abs(o.actualPnl)}
                  </td>
                  <td
                    className={`py-1.5 pl-2 text-right font-semibold ${
                      o.score > 0 ? "text-bull" : o.score < 0 ? "text-bear" : "text-muted"
                    }`}
                  >
                    {o.score >= 0 ? "+" : "−"}
                    {Math.abs(o.score)}
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
