import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { StampSeal } from "@/components/visuals/StampSeal";
import { ChevronLeftIcon, CandlestickIcon, BoltIcon, GaugeIcon } from "@/components/icons";
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
  validateInterval,
  validateQuote,
  counterpartyInterval,
  counterpartyTight,
  coachAfterRound,
  netPosition,
  markToTrue,
  finalBalance,
  breakEven,
  buildRounds,
  START_BALANCE,
  type Fill,
  type Quote,
  type IntervalQuote,
  type CounterpartyAction,
  type Coaching,
} from "@/lib/games/makeMarket/engine";
import { dealScenario, type Scenario } from "@/content/games/makeMarketScenarios";

/**
 * MAKE ME A MARKET (`/make-market`) — a self-contained, full-screen
 * market-making game built directly from `QuantGames-Mechanics.md` Game 1.
 *
 * The learner is the MARKET MAKER. Round 1 they quote a 95% confidence interval;
 * subsequent rounds they quote a tight two-sided market under a hard max-spread
 * constraint while an informed counterparty trades against them and coaching
 * teaches the SKEW / add-size lessons. The game ends with the position &
 * break-even quiz, then a scored summary settled at the true value.
 *
 * All game logic lives in the pure, unit-tested engine; this component is a
 * thin themed renderer (token-only styling, works across every theme in light +
 * dark). It keeps its own session score and never touches mastery/progress.
 */

type Phase = "setup" | "interval" | "tight" | "quiz" | "summary";

const TIGHT_ROUNDS = 4;

const GAME_ID = "make-market";

/** Durable, reload-proof snapshot of an in-progress game (JSON-serializable). */
interface MakeMarketSession {
  phase: Phase;
  scenario: Scenario;
  fills: Fill[];
  roundIdx: number;
  log: LogEntry[];
  coach: Coaching | null;
}

export function MakeMarketPage() {
  const navigate = useNavigate();
  const { themeDef } = useTheme();

  /* ---- session state --------------------------------------------------- */
  const [phase, setPhase] = useState<Phase>("setup");
  // Deal an initial scenario lazily so `scenario` is always defined; it's
  // re-dealt on every game start so the player never faces a fixed answer.
  const [scenario, setScenario] = useState<Scenario>(() =>
    dealScenario(new Rng(Math.floor(Math.random() * 1e9))),
  );
  const rngRef = useRef<Rng>(new Rng(1));
  const [fills, setFills] = useState<Fill[]>([]);
  const [roundIdx, setRoundIdx] = useState(1); // 1-based
  const [log, setLog] = useState<LogEntry[]>([]);
  const [coach, setCoach] = useState<Coaching | null>(null);

  const rounds = useMemo(
    () => buildRounds(TIGHT_ROUNDS, scenario.suggestedMaxSpread),
    [scenario],
  );
  const net = netPosition(fills);

  /* ---- durable save/resume (mirrors the OA session pattern) ------------ */
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const env = loadGameSession<MakeMarketSession>(browserSessionStore(), GAME_ID);
    if (!env || env.status !== "active") return;
    const s = env.snapshot;
    rngRef.current = new Rng(Math.floor(Math.random() * 1e9));
    setScenario(s.scenario);
    setFills(s.fills);
    setRoundIdx(s.roundIdx);
    setLog(s.log);
    setCoach(s.coach);
    setPhase(s.phase);
  }, []);
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (phase === "setup" || phase === "summary") return;
    saveGameSession<MakeMarketSession>(
      browserSessionStore(),
      GAME_ID,
      { phase, scenario, fills, roundIdx, log, coach },
      Date.now(),
    );
  }, [phase, scenario, fills, roundIdx, log, coach]);

  /* ---- lifecycle ------------------------------------------------------- */
  // Deal a fresh, randomized scenario and open the market. The player never
  // chooses — memorizing specific answers is useless because guesstimates
  // recompute their true value from randomized inputs each deal.
  const startGame = () => {
    const seed = Math.floor(Math.random() * 1e9);
    const rng = new Rng(seed);
    setScenario(dealScenario(rng));
    rngRef.current = rng;
    setFills([]);
    setRoundIdx(1);
    setLog([]);
    setCoach(null);
    setPhase("interval");
  };

  const pushLog = (e: LogEntry) => setLog((prev) => [...prev, e]);

  const applyAction = (action: CounterpartyAction, quoteLabel: string) => {
    const nextFills = action.fill ? [...fills, action.fill] : fills;
    if (action.fill) setFills(nextFills);
    pushLog({
      round: roundIdx,
      quoteLabel,
      chatter: action.chatter,
      fill: action.fill,
    });
    setCoach(coachAfterRound(nextFills, action));
  };

  const advance = () => {
    setCoach(null);
    if (roundIdx >= rounds.length) {
      setPhase("quiz");
    } else {
      setRoundIdx(roundIdx + 1);
      const nextKind = rounds[roundIdx].kind; // rounds is 0-based array, roundIdx now points at next
      setPhase(nextKind === "interval" ? "interval" : "tight");
    }
  };

  const submitInterval = (q: IntervalQuote) => {
    const action = counterpartyInterval(q, scenario.trueValue, roundIdx);
    applyAction(action, `CI ${fmtNum(q.lower)} – ${fmtNum(q.upper)}`);
  };

  const submitTight = (q: Quote) => {
    const action = counterpartyTight(
      q,
      scenario.trueValue,
      scenario.suggestedMaxSpread,
      roundIdx,
      rngRef.current,
      0.8,
    );
    applyAction(action, `${q.bidSize}×${fmtNum(q.bid)} / ${fmtNum(q.ask)}×${q.askSize}`);
  };

  const finishQuiz = () => {
    setPhase("summary");
    const bal = finalBalance(fills, scenario.trueValue);
    // Score = final settlement balance (higher-is-better). Record on the unified
    // leaderboard + optional server board, and clear the durable session.
    submitLocalScore(browserBoardStore(), GAME_ID, { score: bal, atMs: Date.now() });
    void submitGameScore(GAME_ID, bal);
    clearGameSession(browserSessionStore(), GAME_ID);
    if (bal >= START_BALANCE) setTimeout(themeDef.celebration ?? celebrate, 260);
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
              Make Me a Market
            </div>
            {(phase === "interval" || phase === "tight") && (
              <div className="mt-1 h-1.5 w-full border border-subtle bg-surface">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${((roundIdx - 1) / rounds.length) * 100}%` }}
                />
              </div>
            )}
          </div>
          {(phase === "interval" || phase === "tight" || phase === "quiz") && (
            <PositionPill net={net} />
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-6">
        {phase === "setup" && <Setup onDeal={startGame} />}

        {(phase === "interval" || phase === "tight") && (
          <RoundView
            scenario={scenario}
            phase={phase}
            roundIdx={roundIdx}
            totalRounds={rounds.length}
            maxSpread={scenario.suggestedMaxSpread}
            log={log}
            coach={coach}
            hasCoach={coach !== null || log.length > 0}
            onSubmitInterval={submitInterval}
            onSubmitTight={submitTight}
            onAdvance={advance}
            lastLogRound={log.length ? log[log.length - 1].round : 0}
          />
        )}

        {phase === "quiz" && (
          <QuizView fills={fills} onFinish={finishQuiz} />
        )}

        {phase === "summary" && (
          <SummaryView
            scenario={scenario}
            fills={fills}
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
/*  Types + helpers                                                            */
/* ========================================================================== */

interface LogEntry {
  round: number;
  quoteLabel: string;
  chatter: string;
  fill: Fill | null;
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2);
}

function fmtMoney(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/* ========================================================================== */
/*  Position pill                                                              */
/* ========================================================================== */

function PositionPill({ net }: { net: number }) {
  const flat = net === 0;
  const long = net > 0;
  const cls = flat
    ? "border-subtle text-secondary"
    : long
      ? "border-bull text-bull"
      : "border-bear text-bear";
  return (
    <span className={`chip num ${cls}`} title="Your net position">
      {flat ? "FLAT" : long ? `LONG ${net}` : `SHORT ${Math.abs(net)}`}
    </span>
  );
}

/* ========================================================================== */
/*  Setup                                                                      */
/* ========================================================================== */

function Setup({ onDeal }: { onDeal: () => void }) {
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <div className="flex items-center justify-between">
          <span className="label text-accent">Market-Making Game</span>
          <span className="grid h-9 w-9 place-items-center border border-border-strong text-accent">
            <CandlestickIcon width={18} height={18} />
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          Make me a market.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          You're the <strong className="text-primary">market maker</strong>. First quote a{" "}
          <strong className="text-primary">95% confidence interval</strong>, then tighten into a
          two-sided market under a hard max-spread. Informed traders pick off any price you leave
          stale, but <strong className="text-primary">uninformed flow pays your spread</strong> — so
          quote tight and well-centred to earn it, recentre when you get picked off, and manage your
          position to a break-even you can defend.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Rule icon={<GaugeIcon width={16} height={16} />} title="Quote both sides">
            Bid you'll buy at, ask you'll sell at. Keep it tight and centred to earn the spread.
          </Rule>
          <Rule icon={<BoltIcon width={16} height={16} />} title="Read the flow">
            Picked off repeatedly means your mid is off — recentre first. Add size only once it's right.
          </Rule>
          <Rule icon={<CandlestickIcon width={16} height={16} />} title="Defend break-even">
            End on your net position, max loss, and the exact break-even price.
          </Rule>
        </div>
      </article>

      <article className="panel-ruled p-6 text-center">
        <div className="label text-accent">Blind deal</div>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-secondary">
          You don't pick the question — one is <strong className="text-primary">dealt at random</strong>{" "}
          and you price it cold, like a real interview. Estimation questions{" "}
          <strong className="text-primary">re-roll their numbers every deal</strong> (the city size,
          the ownership rates), so the true value moves and there's nothing to memorize — only the
          method transfers.
        </p>
        <button onClick={onDeal} className="btn-primary mx-auto mt-5 w-full max-w-xs">
          Deal &amp; open the market →
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
/*  Round view (interval + tight share this shell)                             */
/* ========================================================================== */

function RoundView(props: {
  scenario: Scenario;
  phase: "interval" | "tight";
  roundIdx: number;
  totalRounds: number;
  maxSpread: number;
  log: LogEntry[];
  coach: Coaching | null;
  hasCoach: boolean;
  lastLogRound: number;
  onSubmitInterval: (q: IntervalQuote) => void;
  onSubmitTight: (q: Quote) => void;
  onAdvance: () => void;
}) {
  const {
    scenario,
    phase,
    roundIdx,
    totalRounds,
    maxSpread,
    log,
    coach,
    lastLogRound,
    onSubmitInterval,
    onSubmitTight,
    onAdvance,
  } = props;

  // A round is "resolved" once its quote has produced a log entry.
  const resolved = lastLogRound === roundIdx;

  return (
    <div className="animate-print-in space-y-5">
      {/* Prompt card */}
      <article className="panel-ruled p-6">
        <div className="flex items-center justify-between">
          <span className="label text-accent">
            Round {roundIdx} / {totalRounds} ·{" "}
            {phase === "interval" ? "95% interval" : `max spread ${maxSpread}`}
          </span>
          <span
            className={`chip ${
              scenario.kind === "fact" ? "border-accent-2 text-accent-2" : "border-accent text-accent"
            }`}
          >
            {scenario.kind}
          </span>
        </div>
        <h2 className="mt-2 font-display text-xl font-semibold leading-tight text-primary">
          {scenario.prompt}
        </h2>
        <p className="label mt-2 !normal-case tracking-normal text-muted">
          Answer in {scenario.unit}
        </p>

        {phase === "interval" ? (
          <IntervalForm onSubmit={onSubmitInterval} disabled={resolved} unit={scenario.unit} />
        ) : (
          <TightForm
            onSubmit={onSubmitTight}
            maxSpread={maxSpread}
            disabled={resolved}
            unit={scenario.unit}
          />
        )}
      </article>

      {/* Counterparty response + coaching */}
      {resolved && (
        <>
          <CounterpartyCard entry={log[log.length - 1]} unit={scenario.unit} />
          {coach && <CoachCard coach={coach} />}
          <button onClick={onAdvance} className="btn-primary w-full">
            {roundIdx >= totalRounds ? "Close out → position quiz" : "Next round →"}
          </button>
        </>
      )}

      {/* Trade blotter */}
      {log.length > 0 && <Blotter log={log} />}
    </div>
  );
}

/* ---- interval form ------------------------------------------------------- */

function IntervalForm({
  onSubmit,
  disabled,
  unit,
}: {
  onSubmit: (q: IntervalQuote) => void;
  disabled: boolean;
  unit: string;
}) {
  const [lower, setLower] = useState("");
  const [upper, setUpper] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    const q = { lower: parseFloat(lower), upper: parseFloat(upper) };
    const v = validateInterval(q);
    if (!v.ok) return setErr(v.error ?? "Invalid interval");
    setErr(null);
    onSubmit(q);
  };

  return (
    <div className="mt-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Bid — lower bound (${unit})`} tone="bull">
          <input
            className="input"
            inputMode="decimal"
            value={lower}
            disabled={disabled}
            onChange={(e) => setLower(e.target.value)}
            placeholder="e.g. 150"
          />
        </Field>
        <Field label={`Ask — upper bound (${unit})`} tone="bear">
          <input
            className="input"
            inputMode="decimal"
            value={upper}
            disabled={disabled}
            onChange={(e) => setUpper(e.target.value)}
            placeholder="e.g. 450"
          />
        </Field>
      </div>
      {err && <p className="mt-2 text-sm text-bear">{err}</p>}
      {!disabled && (
        <button onClick={submit} className="btn-secondary mt-4 w-full">
          Quote interval
        </button>
      )}
    </div>
  );
}

/* ---- tight form ---------------------------------------------------------- */

function TightForm({
  onSubmit,
  maxSpread,
  disabled,
  unit,
}: {
  onSubmit: (q: Quote) => void;
  maxSpread: number;
  disabled: boolean;
  unit: string;
}) {
  const [bid, setBid] = useState("");
  const [ask, setAsk] = useState("");
  const [bidSize, setBidSize] = useState("1");
  const [askSize, setAskSize] = useState("1");
  const [err, setErr] = useState<string | null>(null);

  const spread =
    bid && ask && Number.isFinite(parseFloat(bid)) && Number.isFinite(parseFloat(ask))
      ? parseFloat(ask) - parseFloat(bid)
      : null;
  const spreadOk = spread !== null && spread > 0 && spread < maxSpread;

  const submit = () => {
    const q: Quote = {
      bid: parseFloat(bid),
      ask: parseFloat(ask),
      bidSize: parseInt(bidSize, 10),
      askSize: parseInt(askSize, 10),
    };
    const v = validateQuote(q, maxSpread);
    if (!v.ok) return setErr(v.error ?? "Invalid quote");
    setErr(null);
    onSubmit(q);
  };

  return (
    <div className="mt-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Bid size`} tone="bull">
          <input
            className="input"
            inputMode="numeric"
            value={bidSize}
            disabled={disabled}
            onChange={(e) => setBidSize(e.target.value)}
          />
        </Field>
        <Field label={`Ask size`} tone="bear">
          <input
            className="input"
            inputMode="numeric"
            value={askSize}
            disabled={disabled}
            onChange={(e) => setAskSize(e.target.value)}
          />
        </Field>
        <Field label={`Bid — buy at (${unit})`} tone="bull">
          <input
            className="input"
            inputMode="decimal"
            value={bid}
            disabled={disabled}
            onChange={(e) => setBid(e.target.value)}
          />
        </Field>
        <Field label={`Ask — sell at (${unit})`} tone="bear">
          <input
            className="input"
            inputMode="decimal"
            value={ask}
            disabled={disabled}
            onChange={(e) => setAsk(e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-3 flex items-center justify-between border border-subtle bg-surface-muted px-3 py-2">
        <span className="label text-muted">Spread</span>
        <span className={`num text-sm font-semibold ${spread === null ? "text-muted" : spreadOk ? "text-bull" : "text-bear"}`}>
          {spread === null ? "—" : fmtNum(spread)}{" "}
          <span className="text-muted">/ must be &lt; {maxSpread}</span>
        </span>
      </div>

      {err && <p className="mt-2 text-sm text-bear">{err}</p>}
      {!disabled && (
        <button onClick={submit} className="btn-secondary mt-4 w-full" disabled={!spreadOk}>
          Show market
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "bull" | "bear";
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={`label mb-1 block ${tone === "bull" ? "text-bull" : "text-bear"}`}>
        {label}
      </span>
      {children}
    </label>
  );
}

/* ---- counterparty + coach + blotter -------------------------------------- */

function CounterpartyCard({ entry, unit }: { entry: LogEntry; unit: string }) {
  const traded = entry.fill !== null;
  return (
    <article
      className={`panel-ruled border-l-4 p-4 ${traded ? "border-l-bear" : "border-l-bull"}`}
    >
      <div className="label text-muted">Counterparty</div>
      <p className="mt-1 font-display text-lg font-semibold text-primary">“{entry.chatter}”</p>
      {traded && entry.fill && (
        <p className="num mt-2 text-sm text-secondary">
          You{" "}
          <span className={entry.fill.side === "buy" ? "text-bull" : "text-bear"}>
            {entry.fill.side === "buy" ? "BOUGHT" : "SOLD"} {entry.fill.size}
          </span>{" "}
          @ {fmtNum(entry.fill.price)} {unit}
        </p>
      )}
    </article>
  );
}

function CoachCard({ coach }: { coach: Coaching }) {
  return (
    <article className="border-l-2 border-accent bg-surface-muted px-4 py-3">
      <div className="label text-accent">Coach</div>
      <p className="mt-1 text-sm font-semibold text-primary">{coach.headline}</p>
      <p className="mt-1 text-sm leading-relaxed text-secondary">{coach.detail}</p>
    </article>
  );
}

function Blotter({ log }: { log: LogEntry[] }) {
  return (
    <article className="panel-ruled p-4">
      <div className="label text-accent">Trade blotter</div>
      <div className="mt-2 divide-y divide-subtle">
        {log.map((e, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 text-sm">
            <span className="num text-muted">R{e.round}</span>
            <span className="num text-secondary">{e.quoteLabel}</span>
            <span className="num">
              {e.fill ? (
                <span className={e.fill.side === "buy" ? "text-bull" : "text-bear"}>
                  {e.fill.side === "buy" ? "+" : "−"}
                  {e.fill.size} @ {fmtNum(e.fill.price)}
                </span>
              ) : (
                <span className="text-muted">no trade</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

/* ========================================================================== */
/*  Quiz (position → max loss → break-even)                                    */
/* ========================================================================== */

function QuizView({ fills, onFinish }: { fills: Fill[]; onFinish: () => void }) {
  const truth = useMemo(() => breakEven(fills), [fills]);
  const trueNet = netPosition(fills);

  const [posAns, setPosAns] = useState("");
  const [lossAns, setLossAns] = useState("");
  const [beSideAns, setBeSideAns] = useState<"buy" | "sell" | "">("");
  const [bePriceAns, setBePriceAns] = useState("");
  const [checked, setChecked] = useState(false);

  const posOk = parseInt(posAns, 10) === trueNet;
  const lossOk = Math.abs(parseFloat(lossAns) - truth.maxGuaranteedLoss) < 0.5;
  const beSideOk = truth.side === null ? true : beSideAns === truth.side;
  const bePriceOk =
    truth.price === null
      ? true
      : Math.abs(parseFloat(bePriceAns) - truth.price) < 0.5;

  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <span className="label text-accent">Closing questions</span>
        <h2 className="mt-2 font-display text-xl font-semibold text-primary">
          Defend your book.
        </h2>
        <p className="mt-2 text-sm text-secondary">
          The desk quizzes you on the position you built. Signed net: a short of 3 is{" "}
          <span className="num">−3</span>, a long of 2 is <span className="num">2</span>.
        </p>

        <div className="mt-5 space-y-5">
          <QuizField
            label="Your signed net position"
            value={posAns}
            onChange={setPosAns}
            checked={checked}
            ok={posOk}
            reveal={String(trueNet)}
            placeholder="e.g. −8"
          />
          <QuizField
            label="Max guaranteed loss ($)"
            value={lossAns}
            onChange={setLossAns}
            checked={checked}
            ok={lossOk}
            reveal={fmtMoney(truth.maxGuaranteedLoss)}
            placeholder="e.g. 1200"
          />

          {truth.net !== 0 && (
            <div>
              <span className="label mb-1 block text-accent">Break-even trade</span>
              <div className="flex gap-2">
                <div className="flex overflow-hidden rounded-sm border border-border-strong">
                  {(["buy", "sell"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setBeSideAns(s)}
                      disabled={checked}
                      className={`px-4 py-2 font-mono text-xs uppercase tracking-label transition-colors ${
                        beSideAns === s
                          ? "bg-accent text-accent-contrast"
                          : "bg-surface text-secondary hover:bg-surface-muted"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <input
                  className="input flex-1"
                  inputMode="decimal"
                  value={bePriceAns}
                  disabled={checked}
                  onChange={(e) => setBePriceAns(e.target.value)}
                  placeholder={`${Math.abs(truth.net)} lots @ price`}
                />
              </div>
              {checked && (
                <p className={`mt-1 text-sm ${beSideOk && bePriceOk ? "text-bull" : "text-bear"}`}>
                  {truth.possible
                    ? `${truth.side?.toUpperCase()} ${Math.abs(truth.net)} @ ${fmtNum(truth.price ?? 0)}`
                    : `Impossible — the break-even price would be ${fmtNum(truth.price ?? 0)} (negative).`}
                </p>
              )}
            </div>
          )}
        </div>

        {!checked ? (
          <button onClick={() => setChecked(true)} className="btn-secondary mt-6 w-full">
            Check answers
          </button>
        ) : (
          <button onClick={onFinish} className="btn-primary mt-6 w-full">
            See your score →
          </button>
        )}
      </article>
    </div>
  );
}

function QuizField({
  label,
  value,
  onChange,
  checked,
  ok,
  reveal,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  checked: boolean;
  ok: boolean;
  reveal: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="label mb-1 block text-accent">{label}</span>
      <input
        className="input"
        value={value}
        disabled={checked}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="text"
      />
      {checked && (
        <p className={`num mt-1 text-sm ${ok ? "text-bull" : "text-bear"}`}>
          {ok ? "✓ correct" : `✗ answer: ${reveal}`}
        </p>
      )}
    </label>
  );
}

/* ========================================================================== */
/*  Summary                                                                    */
/* ========================================================================== */

function SummaryView({
  scenario,
  fills,
  onReplay,
}: {
  scenario: Scenario;
  fills: Fill[];
  onReplay: () => void;
}) {
  const pnl = markToTrue(fills, scenario.trueValue);
  const bal = finalBalance(fills, scenario.trueValue);
  const net = netPosition(fills);
  const win = pnl >= 0;

  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled relative overflow-hidden p-6 text-center">
        <StampSeal label={win ? "IN THE MONEY" : "OFFSIDE"} tone={win ? "bull" : "bear"} />
        <span className="label text-accent">Final settlement</span>
        <div className="num mt-3 font-display text-5xl font-black text-primary">
          {fmtMoney(bal)}
        </div>
        <p className={`num mt-1 text-lg font-semibold ${win ? "text-bull" : "text-bear"}`}>
          {pnl >= 0 ? "+" : "−"}
          {fmtMoney(Math.abs(pnl))} P&L
        </p>
        <p className="mt-3 text-sm text-secondary">
          Settled at the true value:{" "}
          <span className="num font-semibold text-primary">
            {fmtNum(scenario.trueValue)} {scenario.unit}
          </span>
          . You finished{" "}
          <span className="num">
            {net === 0 ? "flat" : net > 0 ? `long ${net}` : `short ${Math.abs(net)}`}
          </span>
          .
        </p>
      </article>

      {/* Teaching payoff: the defensible decomposition */}
      <article className="panel-ruled p-5">
        <div className="label text-accent">A defensible path</div>
        <ol className="mt-3 space-y-2">
          {scenario.decomposition.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-secondary">
              <span className="num shrink-0 font-semibold text-accent">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 border-l-2 border-accent bg-surface-muted px-3 py-2 text-sm text-secondary">
          <span className="label text-accent">Anchor</span>
          <br />
          {scenario.anchor}
        </p>
      </article>

      <div className="flex gap-3">
        <button onClick={onReplay} className="btn-primary flex-1">
          Play again
        </button>
      </div>
    </div>
  );
}
