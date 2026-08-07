import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { GameChrome } from "@/components/games/GameChrome";
import { StampSeal } from "@/components/visuals/StampSeal";
import { CardsIcon, BoltIcon, GaugeIcon } from "@/components/icons";
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
import { netPosition, type Fill, type Side } from "@/lib/games/makeMarket/engine";
import {
  dealGame,
  revealNext,
  addFills,
  playerEV,
  validateQuote,
  botQuote,
  resolvePlayerQuote,
  playerTradesBotQuote,
  settle,
  coachSettlement,
  rankLabel,
  MAX_SPREAD,
  type Card,
  type GameConfig,
  type GameState,
  type Quote,
  type Bot,
  type BotTrade,
  type Settlement,
} from "@/lib/games/marketOfCards/engine";

/**
 * MARKET OF CARDS — GROUP MAKER (`/market-of-cards`) — self-contained,
 * full-screen super-day game built from `QuantGames-Mechanics.md` Game 4.
 *
 * You are the maker. Every player holds 2 hidden cards; 3 community cards sit
 * centre-table and reveal one per round. You quote a ≤20-wide two-sided market
 * on the signed 11-card total, bots trade against you (and you against them),
 * and at settle your net position marks to the true total. The teaching focus:
 * price the expectation, update the instant a card flips, and trade BOTH ways.
 */

type Phase = "setup" | "round" | "settle";
type SubPhase = "quote" | "flow";

const SUIT_TONE = (suit: string) =>
  suit === "♥" || suit === "♦" ? "text-bear" : "text-primary";

const GAME_ID = "market-of-cards";

type Activity = { round: number; text: string; tone: Side | "info" };

/** Durable, reload-proof snapshot of an in-progress game (JSON-serializable). */
interface MarketOfCardsSession {
  numBots: number;
  numRounds: number;
  aceHigh: boolean;
  phase: Phase;
  subPhase: SubPhase;
  game: GameState | null;
  activity: Activity[];
  botMarkets: { bot: Bot; quote: Quote }[];
}

export function MarketOfCardsPage() {
  const navigate = useNavigate();
  const { themeDef } = useTheme();
  const { username } = useAuth();

  /* ---- config ---------------------------------------------------------- */
  const [numBots, setNumBots] = useState(3);
  const [numRounds, setNumRounds] = useState(4);
  const [aceHigh, setAceHigh] = useState(true);

  /* ---- session --------------------------------------------------------- */
  const [phase, setPhase] = useState<Phase>("setup");
  const [subPhase, setSubPhase] = useState<SubPhase>("quote");
  const rngRef = useRef<Rng>(new Rng(1));
  const [game, setGame] = useState<GameState | null>(null);
  const [activity, setActivity] = useState<{ round: number; text: string; tone: Side | "info" }[]>([]);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [botMarkets, setBotMarkets] = useState<{ bot: Bot; quote: Quote }[]>([]);

  const config: GameConfig = useMemo(
    () => ({ numBots, numRounds, aceMode: aceHigh ? "high" : "low" }),
    [numBots, numRounds, aceHigh],
  );

  /* ---- durable save/resume (mirrors the OA session pattern) ------------ */
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const env = loadGameSession<MarketOfCardsSession>(
      browserSessionStore(),
      GAME_ID,
      undefined,
      username,
    );
    if (!env || env.status !== "active" || !env.snapshot.game) return;
    const s = env.snapshot;
    rngRef.current = new Rng(Math.floor(Math.random() * 1e9));
    setNumBots(s.numBots);
    setNumRounds(s.numRounds);
    setAceHigh(s.aceHigh);
    setGame(s.game);
    setActivity(s.activity);
    setBotMarkets(s.botMarkets);
    setSubPhase(s.subPhase);
    setPhase(s.phase);
  }, [username]);
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (phase !== "round") return; // only an in-progress round is resumable
    saveGameSession<MarketOfCardsSession>(
      browserSessionStore(),
      GAME_ID,
      { numBots, numRounds, aceHigh, phase, subPhase, game, activity, botMarkets },
      Date.now(),
      "active",
      username,
    );
  }, [phase, subPhase, game, activity, botMarkets, numBots, numRounds, aceHigh, username]);

  /* ---- lifecycle ------------------------------------------------------- */
  const start = () => {
    const rng = new Rng(Math.floor(Math.random() * 1e9));
    rngRef.current = rng;
    const g = dealGame(rng, config);
    setGame(g);
    setActivity([]);
    setSettlement(null);
    refreshBotMarkets(g, rng);
    setSubPhase("quote");
    setPhase("round");
  };

  const refreshBotMarkets = (g: GameState, rng: Rng) => {
    setBotMarkets(g.bots.map((bot) => ({ bot, quote: botQuote(bot, g, rng) })));
  };

  const log = (round: number, text: string, tone: Side | "info") =>
    setActivity((a) => [{ round, text, tone }, ...a]);

  /** Player posts their own two-sided market; bots trade against it. */
  const postQuote = (quote: Quote) => {
    if (!game) return;
    const { fills, trades } = resolvePlayerQuote(quote, game, rngRef.current);
    const g2 = addFills(game, fills);
    setGame(g2);
    if (trades.length === 0) {
      log(game.roundIdx, "You quoted; no bot took it. Your market rests.", "info");
    } else {
      trades.forEach((t: BotTrade) => log(game.roundIdx, t.chatter, t.side));
    }
    setSubPhase("flow");
  };

  /** Player trades against a bot's resting market. */
  const takeBotMarket = (bot: Bot, quote: Quote, side: Side, size: number) => {
    if (!game) return;
    const fill: Fill = playerTradesBotQuote(quote, side, size, game.roundIdx);
    const g2 = addFills(game, [fill]);
    setGame(g2);
    log(
      game.roundIdx,
      side === "buy"
        ? `You lift ${bot.name}'s offer: buy ${size} @ ${quote.ask}.`
        : `You hit ${bot.name}'s bid: sell ${size} @ ${quote.bid}.`,
      side,
    );
  };

  const nextRound = () => {
    if (!game) return;
    if (game.roundIdx >= numRounds) {
      const s = settle(game);
      setSettlement(s);
      setPhase("settle");
      // Score = net position marked to the true total (P&L). Record on the
      // unified leaderboard + optional server board, and clear the session.
      submitLocalScore(browserBoardStore(), GAME_ID, { score: s.markPnl, atMs: Date.now() });
      void submitGameScore(GAME_ID, s.markPnl);
      clearGameSession(browserSessionStore(), GAME_ID, username);
      if (s.markPnl >= 0) setTimeout(themeDef.celebration ?? celebrate, 260);
      return;
    }
    const g2 = revealNext(game);
    setGame(g2);
    const revealed = g2.community[g2.revealedCount - 1];
    log(
      g2.roundIdx,
      `Community card flips: ${rankLabel(revealed.rank)}${revealed.suit} (${signed(revealed.value)}). Re-centre your mid.`,
      "info",
    );
    refreshBotMarkets(g2, rngRef.current);
    setSubPhase("quote");
  };

  /* ---- render ---------------------------------------------------------- */
  return (
    <GameChrome
      title="Market of Cards · Maker"
      onBack={() => navigate("/")}
      maxWidth="4xl"
      subtitle={
        game && phase !== "setup"
          ? `Round ${game.roundIdx} / ${numRounds}`
          : undefined
      }
      headerRight={
        game && phase !== "setup" ? (
          <div className="text-right">
            <div className="label text-muted">Position</div>
            <div className="num text-sm font-semibold text-primary">
              {signed(netPosition(game.fills))} lots
            </div>
          </div>
        ) : undefined
      }
    >
        {phase === "setup" && (
          <SetupScreen
            numBots={numBots}
            setNumBots={setNumBots}
            numRounds={numRounds}
            setNumRounds={setNumRounds}
            aceHigh={aceHigh}
            setAceHigh={setAceHigh}
            onStart={start}
          />
        )}

        {phase === "round" && game && (
          <RoundScreen
            game={game}
            subPhase={subPhase}
            botMarkets={botMarkets}
            activity={activity}
            onPostQuote={postQuote}
            onTakeBotMarket={takeBotMarket}
            onProceed={() => setSubPhase("flow")}
            onNextRound={nextRound}
            isLastRound={game.roundIdx >= numRounds}
          />
        )}

        {phase === "settle" && game && settlement && (
          <SettleScreen
            game={game}
            settlement={settlement}
            onReplay={() => {
              clearGameSession(browserSessionStore(), GAME_ID, username);
              setPhase("setup");
            }}
          />
        )}
    </GameChrome>
  );
}

/* ========================================================================== */
/*  helpers                                                                    */
/* ========================================================================== */

function signed(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`;
}

function PlayingCard({ card, faceDown, small }: { card?: Card; faceDown?: boolean; small?: boolean }) {
  const dims = small ? "h-16 w-11" : "h-20 w-14";
  if (faceDown || !card) {
    return (
      <div className={`grid ${dims} place-items-center rounded-md border-2 border-border-strong bg-surface-muted`}>
        <div className="h-3/4 w-2/3 rounded-sm border border-subtle bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgb(var(--color-subtle))_4px,rgb(var(--color-subtle))_5px)]" />
      </div>
    );
  }
  return (
    <div className={`animate-print-in relative grid ${dims} place-items-center rounded-md border-2 border-border-strong bg-surface`}>
      <span className={`font-display ${small ? "text-lg" : "text-xl"} font-bold ${SUIT_TONE(card.suit)}`}>
        {rankLabel(card.rank)}
      </span>
      <span className={`absolute bottom-0.5 right-1 ${small ? "text-sm" : "text-base"} ${SUIT_TONE(card.suit)}`}>
        {card.suit}
      </span>
      <span className="num absolute left-1 top-0.5 text-[9px] text-muted">{signed(card.value)}</span>
    </div>
  );
}

/* ========================================================================== */
/*  Setup                                                                      */
/* ========================================================================== */

function SetupScreen(props: {
  numBots: number;
  setNumBots: (n: number) => void;
  numRounds: number;
  setNumRounds: (n: number) => void;
  aceHigh: boolean;
  setAceHigh: (b: boolean) => void;
  onStart: () => void;
}) {
  const { numBots, setNumBots, numRounds, setNumRounds, aceHigh, setAceHigh, onStart } = props;
  const totalCards = 2 * (numBots + 1) + 3;
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <div className="flex items-center justify-between">
          <span className="label text-accent">Market-Making Game · Super-day</span>
          <span className="grid h-9 w-9 place-items-center border border-border-strong text-accent">
            <CardsIcon width={18} height={18} />
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          Make the market. Trade both ways.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          You and {numBots} bots each hold <strong className="text-primary">2 hidden cards</strong>;{" "}
          <strong className="text-primary">3 community cards</strong> reveal one per round.{" "}
          {totalCards} signed cards settle the total (numbers ×10, red faces +, black faces −).
          Quote a ≤{MAX_SPREAD}-wide market around your EV, trade against the bots, and re-centre the
          moment a card flips. Score = your net position marked to the true total, but the real test
          is showing <em>two-sided</em> trading, not one-way risk.
        </p>
      </article>

      <article className="panel-ruled p-5">
        <div className="label text-accent">Game settings</div>
        <div className="mt-4 space-y-5">
          <Slider label="Bot opponents" value={numBots} min={1} max={5} onChange={setNumBots} hint={`${totalCards} cards total`} />
          <Slider label="Number of rounds" value={numRounds} min={2} max={4} onChange={setNumRounds} hint="1 community card reveals per round after the first" />
          <div>
            <span className="label mb-1 block text-accent">Ace value</span>
            <div className="flex overflow-hidden rounded-sm border border-border-strong">
              {[
                { on: !aceHigh, label: "Lowest (+10)", set: () => setAceHigh(false) },
                { on: aceHigh, label: "Highest (±140)", set: () => setAceHigh(true) },
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
          Sit down at the table →
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
/*  Round screen                                                               */
/* ========================================================================== */

function RoundScreen({
  game,
  subPhase,
  botMarkets,
  activity,
  onPostQuote,
  onTakeBotMarket,
  onProceed,
  onNextRound,
  isLastRound,
}: {
  game: GameState;
  subPhase: SubPhase;
  botMarkets: { bot: Bot; quote: Quote }[];
  activity: { round: number; text: string; tone: Side | "info" }[];
  onPostQuote: (q: Quote) => void;
  onTakeBotMarket: (bot: Bot, q: Quote, side: Side, size: number) => void;
  onProceed: () => void;
  onNextRound: () => void;
  isLastRound: boolean;
}) {
  const ev = playerEV(game);
  const unknown = game.totalCards - game.playerHand.length - game.revealedCount;

  return (
    <div className="animate-print-in space-y-5">
      {/* Table state */}
      <article className="panel-ruled p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="label text-accent">Your hand</div>
            <div className="mt-2 flex gap-2">
              {game.playerHand.map((c, i) => (
                <PlayingCard key={i} card={c} />
              ))}
            </div>
            <p className="num mt-2 text-sm text-secondary">
              Hand value{" "}
              <span className="font-semibold text-primary">
                {signed(game.playerHand.reduce((a, c) => a + c.value, 0))}
              </span>
            </p>
          </div>
          <div>
            <div className="label text-accent">Community</div>
            <div className="mt-2 flex gap-2">
              {game.community.map((c, i) => (
                <PlayingCard key={i} card={c} faceDown={i >= game.revealedCount} small />
              ))}
            </div>
            <p className="label mt-2 !normal-case tracking-normal text-muted">
              {game.revealedCount}/3 revealed
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-subtle pt-4 text-center">
          <MiniStat label="Your EV" value={String(ev)} />
          <MiniStat label="Unknown cards" value={`${unknown} × ${game.evPerCard}`} />
          <MiniStat label="Position" value={`${signed(netPosition(game.fills))} lots`} />
        </div>
      </article>

      {subPhase === "quote" ? (
        <QuotePanel ev={ev} onPost={onPostQuote} />
      ) : (
        <>
          <BotMarkets game={game} botMarkets={botMarkets} onTake={onTakeBotMarket} />
          <button onClick={onNextRound} className="btn-primary w-full">
            {isLastRound ? "Settle & reveal all cards →" : "End round: reveal next card →"}
          </button>
        </>
      )}

      {subPhase === "quote" && (
        <button onClick={onProceed} className="btn-ghost w-full">
          Skip quoting this round (rest, no market)
        </button>
      )}

      {/* Activity feed */}
      {activity.length > 0 && (
        <article className="panel-ruled p-4">
          <div className="flex items-center gap-2 text-accent">
            <BoltIcon width={14} height={14} />
            <span className="label text-accent">Game activity</span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {activity.slice(0, 8).map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px]">
                <span className="label shrink-0 text-muted">R{a.round}</span>
                <span
                  className={
                    a.tone === "buy" ? "text-bull" : a.tone === "sell" ? "text-bear" : "text-secondary"
                  }
                >
                  {a.text}
                </span>
              </li>
            ))}
          </ul>
        </article>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label text-muted">{label}</div>
      <div className="num text-sm font-semibold text-primary">{value}</div>
    </div>
  );
}

/* ========================================================================== */
/*  Quote panel — quick-quotes that slide with EV + manual entry               */
/* ========================================================================== */

function QuotePanel({ ev, onPost }: { ev: number; onPost: (q: Quote) => void }) {
  const [bid, setBid] = useState(String(Math.round(ev - 10)));
  const [ask, setAsk] = useState(String(Math.round(ev + 10)));
  const [size, setSize] = useState(2);

  const quote: Quote = {
    bid: parseInt(bid, 10),
    ask: parseInt(ask, 10),
    bidSize: size,
    askSize: size,
  };
  const valid = validateQuote(quote);

  // Six pre-built spread-20 markets sliding around EV (like the real UI).
  const quickCenters = [-20, -10, 0, 10, 20].map((d) => Math.round(ev + d));

  return (
    <article className="panel-ruled p-5">
      <div className="flex items-center gap-2 text-accent">
        <GaugeIcon width={16} height={16} />
        <span className="label text-accent">Make your market · spread ≤ {MAX_SPREAD}</span>
      </div>

      <p className="mt-2 text-[13px] text-muted">
        Quick markets (20-wide, centred near your EV of{" "}
        <span className="num text-secondary">{ev}</span>):
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {quickCenters.map((mid) => {
          const qb = mid - 10;
          const qa = mid + 10;
          return (
            <button
              key={mid}
              onClick={() => {
                setBid(String(qb));
                setAsk(String(qa));
              }}
              className="btn-ghost !min-h-0 num !px-3 !py-1.5 text-xs"
            >
              {qb} / {qa}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Bid (you buy sellers)" value={bid} onChange={setBid} tone="bull" />
        <Field label="Ask (you sell buyers)" value={ask} onChange={setAsk} tone="bear" />
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <span className="label text-accent">Size each side</span>
          <span
            className={`num text-sm ${
              quote.ask - quote.bid > MAX_SPREAD ? "text-bear" : "text-muted"
            }`}
          >
            spread {Number.isFinite(quote.ask - quote.bid) ? quote.ask - quote.bid : "—"}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          {[1, 2, 3, 5].map((n) => (
            <button
              key={n}
              onClick={() => setSize(n)}
              className={`btn-ghost !min-h-0 num !px-3 !py-1 text-xs ${
                size === n ? "!border-accent !text-accent" : ""
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {!valid.ok && bid !== "" && ask !== "" && (
        <p className="mt-3 text-[13px] text-bear">{valid.error}</p>
      )}

      <button
        onClick={() => valid.ok && onPost(quote)}
        disabled={!valid.ok}
        className="btn-primary mt-4 w-full"
      >
        Post my market →
      </button>
    </article>
  );
}

function Field({
  label,
  value,
  onChange,
  tone,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  tone: "bull" | "bear";
}) {
  return (
    <div>
      <span className={`label ${tone === "bull" ? "text-bull" : "text-bear"}`}>{label}</span>
      <input
        className="input num mt-1 w-full text-center text-lg"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* ========================================================================== */
/*  Bot markets — the player trades against them                               */
/* ========================================================================== */

function BotMarkets({
  game,
  botMarkets,
  onTake,
}: {
  game: GameState;
  botMarkets: { bot: Bot; quote: Quote }[];
  onTake: (bot: Bot, q: Quote, side: Side, size: number) => void;
}) {
  const ev = playerEV(game);
  return (
    <article className="panel-ruled p-5">
      <div className="label text-accent">Bot markets: you have first right to trade</div>
      <p className="mt-1 text-[13px] text-muted">
        Lift an offer that's below your EV of <span className="num text-secondary">{ev}</span>; hit a
        bid that's above it. Look to trade the side that <em>closes</em> your position.
      </p>
      <div className="mt-3 space-y-2">
        {botMarkets.map(({ bot, quote }) => {
          const buyEdge = ev - quote.ask; // lift offer
          const sellEdge = quote.bid - ev; // hit bid
          return (
            <div key={bot.id} className="rounded-sm border border-subtle p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-primary">{bot.name}</span>
                <span className="num text-sm text-secondary">
                  {quote.bid} / {quote.ask}
                  <span className="ml-2 text-muted">×{quote.bidSize}</span>
                </span>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => onTake(bot, quote, "buy", quote.askSize)}
                  className={`flex-1 rounded-sm border px-2 py-1.5 text-xs font-semibold transition-colors ${
                    buyEdge > 0
                      ? "border-bull text-bull hover:bg-surface-muted"
                      : "border-subtle text-muted hover:bg-surface-muted"
                  }`}
                >
                  Buy {quote.askSize} @ {quote.ask}
                  {buyEdge > 0 ? ` · +${buyEdge}/lot` : ""}
                </button>
                <button
                  onClick={() => onTake(bot, quote, "sell", quote.bidSize)}
                  className={`flex-1 rounded-sm border px-2 py-1.5 text-xs font-semibold transition-colors ${
                    sellEdge > 0
                      ? "border-bear text-bear hover:bg-surface-muted"
                      : "border-subtle text-muted hover:bg-surface-muted"
                  }`}
                >
                  Sell {quote.bidSize} @ {quote.bid}
                  {sellEdge > 0 ? ` · +${sellEdge}/lot` : ""}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

/* ========================================================================== */
/*  Settle                                                                     */
/* ========================================================================== */

function SettleScreen({
  game,
  settlement,
  onReplay,
}: {
  game: GameState;
  settlement: Settlement;
  onReplay: () => void;
}) {
  const win = settlement.markPnl >= 0;
  const be = settlement.breakEven;
  const coaching = coachSettlement(game, settlement);
  const coachBorder =
    coaching.tone === "good"
      ? "border-l-bull"
      : coaching.tone === "bad"
        ? "border-l-bear"
        : "border-l-accent";
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled relative overflow-hidden p-6 text-center">
        <StampSeal label={win ? "PROFIT" : "LOSS"} tone={win ? "bull" : "bear"} />
        <span className="label text-accent">Marked to true total {signed(settlement.trueTotal)}</span>
        <div className={`num mt-3 font-display text-5xl font-black ${win ? "text-bull" : "text-bear"}`}>
          {signed(settlement.markPnl)}
        </div>
        <p className="mt-1 text-sm text-secondary">
          Net position {signed(settlement.position)} lots
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {settlement.twoSided ? (
            <span className="chip border-bull text-bull">Two-sided</span>
          ) : (
            <span className="chip border-bear text-bear">One-way book</span>
          )}
          <span
            className={`chip ${coaching.adverseFrac >= 0.5 ? "border-bear text-bear" : coaching.adverseFrac < 0.2 ? "border-bull text-bull" : "border-accent text-accent"}`}
          >
            {Math.round(coaching.adverseFrac * 100)}% picked off
          </span>
        </div>
      </article>

      {/* The real "why": pricing quality first, risk second */}
      <article className={`panel-ruled border-l-4 ${coachBorder} p-4 text-left`}>
        <div className="label text-accent">Coach · why you {win ? "won" : "lost"}</div>
        <p className="mt-1 font-display text-lg font-semibold text-primary">{coaching.headline}</p>
        <p className="mt-1 text-sm leading-relaxed text-secondary">{coaching.detail}</p>
      </article>

      {/* Post-game questions */}
      <article className="panel-ruled p-5">
        <div className="label text-accent">Post-game desk questions</div>
        <div className="mt-3 space-y-2 text-sm">
          <Row label="Signed net position" value={`${signed(settlement.position)} lots`} />
          <Row label="Max guaranteed loss" value={`${be.maxGuaranteedLoss}`} />
          <Row
            label="Break-even on the leftover"
            value={
              be.net === 0
                ? "flat, nothing to break even"
                : be.possible
                  ? `${be.side} ${Math.abs(be.net)} @ ${be.price}`
                  : "impossible (price < 0)"
            }
          />
        </div>
      </article>

      {/* Full reveal */}
      <article className="panel-ruled p-5">
        <div className="label text-accent">All hands revealed</div>
        <div className="mt-3 space-y-3">
          <HandRow label="You" cards={game.playerHand} />
          {game.bots.map((b) => (
            <HandRow key={b.id} label={b.name} cards={b.hand} />
          ))}
          <HandRow label="Community" cards={game.community} />
        </div>
      </article>

      <button onClick={onReplay} className="btn-primary w-full">
        Play again
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-subtle pb-2 last:border-0">
      <span className="text-secondary">{label}</span>
      <span className="num font-semibold text-primary">{value}</span>
    </div>
  );
}

function HandRow({ label, cards }: { label: string; cards: Card[] }) {
  return (
    <div className="flex items-center gap-3">
      <span className="label w-24 shrink-0 text-muted">{label}</span>
      <div className="flex gap-1.5">
        {cards.map((c, i) => (
          <PlayingCard key={i} card={c} small />
        ))}
      </div>
      <span className="num ml-auto text-sm text-secondary">
        {signed(cards.reduce((a, c) => a + c.value, 0))}
      </span>
    </div>
  );
}
