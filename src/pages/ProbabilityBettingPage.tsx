import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { GameChrome } from "@/components/games/GameChrome";
import { StampSeal } from "@/components/visuals/StampSeal";
import { browserBoardStore, submitLocalScore } from "@/lib/leaderboard/localBoard";
import { submitGameScore } from "@/lib/leaderboard/client";
import {
  browserSessionStore,
  clearGameSession,
  loadGameSession,
  saveGameSession,
} from "@/lib/leaderboard/gameSession";
import { DiceIcon, CardsIcon, SigmaIcon, BoltIcon } from "@/components/icons";
import { celebrate } from "@/lib/celebrate";
import { Rng } from "@/lib/rng";
import {
  settleRound,
  gradeRound,
  skillScore,
  findInsuranceArb,
  START_BALANCE,
  round2,
  type BettingEvent,
  type Category,
  type RoundEvents,
  type Stake,
  type SpecialStake,
  type RoundSettlement,
  type EventGrade,
} from "@/lib/games/probabilityBetting/engine";
import { buildRound } from "@/content/games/probabilityBettingEvents";

/**
 * PROBABILITY BETTING (`/probability-betting`) — self-contained, full-screen
 * betting game built from `QuantGames-Mechanics.md` Game 2.
 *
 * The house quotes fractional odds on random dice / cards / coins events; the
 * player computes true probabilities, bets only positive-edge events, and sizes
 * with Kelly. Two specials (Insurance / Boost) resolve against the sign of the
 * regular P&L. Events, probabilities and mispricing are randomized every round,
 * so nothing is memorizable. The end screen is the teaching payoff: the full
 * Odds / Fair / Edge / Kelly / Efficiency review table.
 */

type Phase = "setup" | "bet" | "settled" | "summary";

const GAME_ID = "probability-betting";

/** Durable, reload-proof snapshot of an in-progress game (JSON-serializable). */
interface ProbBettingSession {
  numRounds: number;
  perCategory: number;
  aceHigh: boolean;
  phase: Phase;
  balance: number;
  roundIdx: number;
  round: RoundEvents | null;
  stakes: Record<string, number>;
  specialStakes: Record<string, number>;
  settlement: RoundSettlement | null;
  gradeLog: { round: number; grades: EventGrade[] }[];
}

const CATEGORY_META: Record<
  Category,
  { title: string; icon: (p: { width: number; height: number }) => JSX.Element }
> = {
  dice: { title: "Dice", icon: DiceIcon },
  cards: { title: "Cards", icon: CardsIcon },
  coins: { title: "Coins", icon: SigmaIcon },
};

export function ProbabilityBettingPage() {
  const navigate = useNavigate();
  const { themeDef } = useTheme();
  const { username } = useAuth();

  /* ---- config ---------------------------------------------------------- */
  const [numRounds, setNumRounds] = useState(5);
  const [perCategory, setPerCategory] = useState(2);
  const [aceHigh, setAceHigh] = useState(true);

  /* ---- session state --------------------------------------------------- */
  const [phase, setPhase] = useState<Phase>("setup");
  const rngRef = useRef<Rng>(new Rng(1));
  const [balance, setBalance] = useState(START_BALANCE);
  const [roundIdx, setRoundIdx] = useState(1);
  const [round, setRound] = useState<RoundEvents | null>(null);
  const [stakes, setStakes] = useState<Record<string, number>>({});
  const [specialStakes, setSpecialStakes] = useState<Record<string, number>>({});
  const [settlement, setSettlement] = useState<RoundSettlement | null>(null);
  const [gradeLog, setGradeLog] = useState<{ round: number; grades: EventGrade[] }[]>([]);

  /* ---- durable save/resume (mirrors the OA session pattern) ------------ */
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const env = loadGameSession<ProbBettingSession>(
      browserSessionStore(),
      GAME_ID,
      undefined,
      username,
    );
    if (!env || env.status !== "active") return;
    const s = env.snapshot;
    rngRef.current = new Rng(Math.floor(Math.random() * 1e9));
    setNumRounds(s.numRounds);
    setPerCategory(s.perCategory);
    setAceHigh(s.aceHigh);
    setBalance(s.balance);
    setRoundIdx(s.roundIdx);
    setRound(s.round);
    setStakes(s.stakes);
    setSpecialStakes(s.specialStakes);
    setSettlement(s.settlement);
    setGradeLog(s.gradeLog);
    setPhase(s.phase);
  }, [username]);
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (phase === "setup" || phase === "summary") return;
    saveGameSession<ProbBettingSession>(
      browserSessionStore(),
      GAME_ID,
      { numRounds, perCategory, aceHigh, phase, balance, roundIdx, round, stakes, specialStakes, settlement, gradeLog },
      Date.now(),
      "active",
      username,
    );
  }, [phase, balance, roundIdx, round, stakes, specialStakes, settlement, gradeLog, numRounds, perCategory, aceHigh, username]);

  /* ---- lifecycle ------------------------------------------------------- */
  const start = () => {
    const rng = new Rng(Math.floor(Math.random() * 1e9));
    rngRef.current = rng;
    setBalance(START_BALANCE);
    setRoundIdx(1);
    setGradeLog([]);
    dealRound(rng, 1);
    setPhase("bet");
  };

  const dealRound = (rng: Rng, _idx: number) => {
    setRound(buildRound(rng, perCategory, aceHigh));
    setStakes({});
    setSpecialStakes({});
    setSettlement(null);
  };

  const totalStaked =
    Object.values(stakes).reduce((a, b) => a + b, 0) +
    Object.values(specialStakes).reduce((a, b) => a + b, 0);
  const remaining = round2(balance - totalStaked);

  const submit = () => {
    if (!round) return;
    const stakeArr: Stake[] = Object.entries(stakes)
      .filter(([, a]) => a > 0)
      .map(([eventId, amount]) => ({ eventId, amount }));
    const specialArr: SpecialStake[] = Object.entries(specialStakes)
      .filter(([, a]) => a > 0)
      .map(([specialId, amount]) => ({ specialId, amount }));

    const s = settleRound(round, stakeArr, specialArr, rngRef.current);
    setSettlement(s);
    setBalance((b) => round2(b + s.totalNet));
    setGradeLog((log) => [
      ...log,
      { round: roundIdx, grades: gradeRound(round, stakeArr, balance) },
    ]);
    setPhase("settled");
  };

  const advance = () => {
    if (roundIdx >= numRounds) {
      setPhase("summary");
      // Score = composite skill × P&L leaderboard score (matches SummaryScreen).
      const allGrades = gradeLog.flatMap((g) => g.grades);
      const skill = skillScore(allGrades);
      const pnl = round2(balance - START_BALANCE);
      const board = round2(skill.total * pnl);
      submitLocalScore(browserBoardStore(), GAME_ID, {
        score: board,
        atMs: Date.now(),
        meta: { skill: round2(skill.total), pnl },
      });
      void submitGameScore(GAME_ID, board);
      clearGameSession(browserSessionStore(), GAME_ID, username);
      if (balance >= START_BALANCE) setTimeout(themeDef.celebration ?? celebrate, 260);
      return;
    }
    const next = roundIdx + 1;
    setRoundIdx(next);
    dealRound(rngRef.current, next);
    setPhase("bet");
  };

  const arb = useMemo(
    () => (round ? findInsuranceArb(round, balance) : null),
    [round, balance],
  );

  /* ---- render ---------------------------------------------------------- */
  return (
    <GameChrome
      title="Probability Betting"
      onBack={() => navigate("/")}
      maxWidth="4xl"
      subtitle={
        phase !== "setup" ? `Round ${roundIdx} / ${numRounds}` : undefined
      }
      headerRight={
        phase !== "setup" ? (
          <div className="text-right">
            <div className="label text-muted">Balance</div>
            <div
              className={`num text-sm font-semibold ${
                balance >= START_BALANCE ? "text-bull" : "text-bear"
              }`}
            >
              {fmtMoney(balance)}
            </div>
          </div>
        ) : undefined
      }
    >
        {phase === "setup" && (
          <SetupScreen
            numRounds={numRounds}
            setNumRounds={setNumRounds}
            perCategory={perCategory}
            setPerCategory={setPerCategory}
            aceHigh={aceHigh}
            setAceHigh={setAceHigh}
            onStart={start}
          />
        )}

        {(phase === "bet" || phase === "settled") && round && (
          <BetScreen
            round={round}
            stakes={stakes}
            setStakes={setStakes}
            specialStakes={specialStakes}
            setSpecialStakes={setSpecialStakes}
            remaining={remaining}
            settled={phase === "settled"}
            settlement={settlement}
            arb={arb}
            onSubmit={submit}
            onAdvance={advance}
            isLastRound={roundIdx >= numRounds}
          />
        )}

        {phase === "summary" && (
          <SummaryScreen
            balance={balance}
            gradeLog={gradeLog}
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

function fmtMoney(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function fmtPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}
function fmtEdge(n: number): string {
  const s = n >= 0 ? "+" : "−";
  return `${s}${Math.abs(n * 100).toFixed(0)}%`;
}
function fmtOdds(n: number): string {
  return `${n.toFixed(2)}:1`;
}

/* ========================================================================== */
/*  Setup                                                                      */
/* ========================================================================== */

function SetupScreen(props: {
  numRounds: number;
  setNumRounds: (n: number) => void;
  perCategory: number;
  setPerCategory: (n: number) => void;
  aceHigh: boolean;
  setAceHigh: (b: boolean) => void;
  onStart: () => void;
}) {
  const { numRounds, setNumRounds, perCategory, setPerCategory, aceHigh, setAceHigh, onStart } =
    props;
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <div className="flex items-center justify-between">
          <span className="label text-accent">Market-Making Game · Sizing</span>
          <span className="grid h-9 w-9 place-items-center border border-border-strong text-accent">
            <DiceIcon width={18} height={18} />
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          Bet the edge. Size with Kelly.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          The house quotes <strong className="text-primary">fractional odds</strong> on random dice,
          card, and coin events. Each quote implies a probability{" "}
          <span className="num">1/(b+1)</span>. Compute the true probability, bet{" "}
          <strong className="text-primary">only where the house pays more than fair</strong>, and
          size each stake with Kelly <span className="num">f* = (bp − q)/b</span>. Passing is free;
          betting a fair or unfavourable event costs you skill points.
        </p>
      </article>

      <article className="panel-ruled p-5">
        <div className="label text-accent">Game settings</div>
        <div className="mt-4 space-y-5">
          <Slider label="Number of rounds" value={numRounds} min={3} max={10} onChange={setNumRounds} />
          <Slider
            label="Events per category"
            value={perCategory}
            min={1}
            max={5}
            onChange={setPerCategory}
            hint={`${perCategory * 3} events/round + 2 specials`}
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
          Start betting →
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
/*  Bet screen                                                                 */
/* ========================================================================== */

function BetScreen(props: {
  round: RoundEvents;
  stakes: Record<string, number>;
  setStakes: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  specialStakes: Record<string, number>;
  setSpecialStakes: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  remaining: number;
  settled: boolean;
  settlement: RoundSettlement | null;
  arb: ReturnType<typeof findInsuranceArb>;
  onSubmit: () => void;
  onAdvance: () => void;
  isLastRound: boolean;
}) {
  const {
    round,
    stakes,
    setStakes,
    specialStakes,
    setSpecialStakes,
    remaining,
    settled,
    settlement,
    arb,
    onSubmit,
    onAdvance,
    isLastRound,
  } = props;

  const categories: Category[] = ["dice", "cards", "coins"];
  const settleMap = new Map(settlement?.results.map((r) => [r.event.id, r]) ?? []);
  const specialSettleMap = new Map(
    settlement?.specials.map((r) => [r.special.id, r]) ?? [],
  );

  return (
    <div className="animate-print-in space-y-5">
      {!settled && (
        <div className="flex items-center justify-between border border-subtle bg-surface-muted px-4 py-2.5">
          <span className="label text-muted">Remaining to stake</span>
          <span
            className={`num text-sm font-semibold ${remaining < 0 ? "text-bear" : "text-primary"}`}
          >
            {fmtMoney(remaining)}
          </span>
        </div>
      )}

      {categories.map((cat) => {
        const evs = round.events.filter((e) => e.category === cat);
        const Meta = CATEGORY_META[cat];
        return (
          <article key={cat} className="panel-ruled p-5">
            <div className="flex items-center gap-2 text-accent">
              <Meta.icon width={16} height={16} />
              <span className="label text-accent">{Meta.title}</span>
            </div>
            <div className="mt-3 space-y-2">
              {evs.map((e) => (
                <EventRow
                  key={e.id}
                  event={e}
                  stake={stakes[e.id] ?? 0}
                  onStake={(amt) => setStakes((s) => ({ ...s, [e.id]: amt }))}
                  settled={settled}
                  result={settleMap.get(e.id)}
                />
              ))}
            </div>
          </article>
        );
      })}

      {/* Specials */}
      <article className="panel-ruled p-5">
        <div className="flex items-center gap-2 text-accent">
          <BoltIcon width={16} height={16} />
          <span className="label text-accent">Special bets</span>
        </div>
        {arb && !settled && (
          <p className="mt-2 border-l-2 border-accent-2 bg-surface-muted px-3 py-2 text-[13px] text-secondary">
            <span className="label text-accent-2">Arb watch</span>
            <br />
            Pairing a high-odds event with Insurance can lock a guaranteed profit here; stake
            structure exists this round.
          </p>
        )}
        <div className="mt-3 space-y-2">
          {round.specials.map((sp) => (
            <SpecialRow
              key={sp.id}
              label={sp.label}
              odds={sp.houseOdds}
              stake={specialStakes[sp.id] ?? 0}
              onStake={(amt) => setSpecialStakes((s) => ({ ...s, [sp.id]: amt }))}
              settled={settled}
              won={specialSettleMap.get(sp.id)?.won}
              net={specialSettleMap.get(sp.id)?.net}
            />
          ))}
        </div>
      </article>

      {/* Round summary + actions */}
      {settled && settlement ? (
        <>
          <article className="panel-ruled p-5">
            <div className="label text-accent">Round result</div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <Stat label="Regular" value={fmtMoney(settlement.regularNet)} tone={settlement.regularNet} />
              <Stat label="Specials" value={fmtMoney(settlement.specialNet)} tone={settlement.specialNet} />
              <Stat label="Net" value={fmtMoney(settlement.totalNet)} tone={settlement.totalNet} big />
            </div>
          </article>
          <button onClick={onAdvance} className="btn-primary w-full">
            {isLastRound ? "See your score →" : "Next round →"}
          </button>
        </>
      ) : (
        <button
          onClick={onSubmit}
          className="btn-primary w-full"
          disabled={remaining < 0}
        >
          {remaining < 0 ? "Over-staked: reduce your bets" : "Submit bets"}
        </button>
      )}
    </div>
  );
}

function EventRow({
  event,
  stake,
  onStake,
  settled,
  result,
}: {
  event: BettingEvent;
  stake: number;
  onStake: (n: number) => void;
  settled: boolean;
  result?: { won: boolean; net: number; stake: number };
}) {
  const active = stake > 0 || (settled && result && result.stake > 0);
  return (
    <div
      className={`rounded-sm border p-3 ${
        settled && result?.stake
          ? result.won
            ? "border-bull bg-surface-muted"
            : "border-bear bg-surface-muted"
          : active
            ? "border-accent bg-surface-muted"
            : "border-subtle"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-primary">{event.label}</span>
        <span className="chip shrink-0 border-accent text-accent">{fmtOdds(event.houseOdds)}</span>
      </div>
      {!settled ? (
        <StakeInput stake={stake} onStake={onStake} />
      ) : result && result.stake > 0 ? (
        <p className={`num mt-2 text-sm ${result.won ? "text-bull" : "text-bear"}`}>
          {result.won ? "WON" : "LOST"} · staked {fmtMoney(result.stake)} → {fmtMoney(result.net)}
        </p>
      ) : (
        <p className="label mt-2 !normal-case tracking-normal text-muted">Not bet</p>
      )}
    </div>
  );
}

function SpecialRow({
  label,
  odds,
  stake,
  onStake,
  settled,
  won,
  net,
}: {
  label: string;
  odds: number;
  stake: number;
  onStake: (n: number) => void;
  settled: boolean;
  won?: boolean;
  net?: number;
}) {
  return (
    <div
      className={`rounded-sm border p-3 ${
        settled && stake > 0
          ? won
            ? "border-bull bg-surface-muted"
            : "border-bear bg-surface-muted"
          : stake > 0
            ? "border-accent-2 bg-surface-muted"
            : "border-subtle"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-primary">{label}</span>
        <span className="chip shrink-0 border-accent-2 text-accent-2">{fmtOdds(odds)}</span>
      </div>
      {!settled ? (
        <StakeInput stake={stake} onStake={onStake} />
      ) : stake > 0 ? (
        <p className={`num mt-2 text-sm ${won ? "text-bull" : "text-bear"}`}>
          {won ? "WON" : "LOST"} → {fmtMoney(net ?? 0)}
        </p>
      ) : (
        <p className="label mt-2 !normal-case tracking-normal text-muted">Not bet</p>
      )}
    </div>
  );
}

function StakeInput({ stake, onStake }: { stake: number; onStake: (n: number) => void }) {
  const adjust = (d: number) => onStake(Math.max(0, stake + d));
  return (
    <div className="mt-2 flex items-center gap-2">
      <button onClick={() => adjust(-50)} className="btn-ghost !min-h-0 !px-2 !py-1 num text-xs">
        −50
      </button>
      <button onClick={() => adjust(-10)} className="btn-ghost !min-h-0 !px-2 !py-1 num text-xs">
        −10
      </button>
      <input
        className="input !py-1 num text-center text-sm"
        inputMode="numeric"
        value={stake || ""}
        placeholder="0"
        onChange={(e) => onStake(Math.max(0, parseInt(e.target.value, 10) || 0))}
      />
      <button onClick={() => adjust(10)} className="btn-ghost !min-h-0 !px-2 !py-1 num text-xs">
        +10
      </button>
      <button onClick={() => adjust(50)} className="btn-ghost !min-h-0 !px-2 !py-1 num text-xs">
        +50
      </button>
    </div>
  );
}

function Stat({ label, value, tone, big }: { label: string; value: string; tone: number; big?: boolean }) {
  const color = tone > 0 ? "text-bull" : tone < 0 ? "text-bear" : "text-secondary";
  return (
    <div>
      <div className="label text-muted">{label}</div>
      <div className={`num font-semibold ${big ? "text-xl" : "text-sm"} ${color}`}>{value}</div>
    </div>
  );
}

/* ========================================================================== */
/*  Summary (skill + the review table)                                         */
/* ========================================================================== */

function SummaryScreen({
  balance,
  gradeLog,
  onReplay,
}: {
  balance: number;
  gradeLog: { round: number; grades: EventGrade[] }[];
  onReplay: () => void;
}) {
  const allGrades = gradeLog.flatMap((g) => g.grades);
  const skill = skillScore(allGrades);
  const pnl = round2(balance - START_BALANCE);
  const win = pnl >= 0;
  const leaderboard = round2(skill.total * pnl);

  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled relative overflow-hidden p-6 text-center">
        <StampSeal label={win ? "PROFITABLE" : "UNDERWATER"} tone={win ? "bull" : "bear"} />
        <span className="label text-accent">Final</span>
        <div className="num mt-3 font-display text-5xl font-black text-primary">{fmtMoney(balance)}</div>
        <p className={`num mt-1 text-lg font-semibold ${win ? "text-bull" : "text-bear"}`}>
          {pnl >= 0 ? "+" : "−"}
          {fmtMoney(Math.abs(pnl))} PnL
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat label="Decision /7" value={skill.decision.toFixed(1)} tone={1} />
          <Stat label="Sizing /3" value={skill.sizing.toFixed(1)} tone={1} />
          <Stat label="Skill /10" value={skill.total.toFixed(1)} tone={1} big />
        </div>
        <p className="mt-3 text-sm text-secondary">
          Leaderboard score (Skill × PnL):{" "}
          <span className={`num font-semibold ${leaderboard >= 0 ? "text-bull" : "text-bear"}`}>
            {leaderboard.toFixed(0)}
          </span>
        </p>
      </article>

      {gradeLog.map(({ round, grades }) => (
        <article key={round} className="panel-ruled p-4">
          <div className="label text-accent">Round {round} review</div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="label text-muted">
                  <th className="py-1 pr-2 font-normal">Event</th>
                  <th className="py-1 px-2 text-right font-normal">Odds</th>
                  <th className="py-1 px-2 text-right font-normal">Impl.</th>
                  <th className="py-1 px-2 text-right font-normal">Fair</th>
                  <th className="py-1 px-2 text-right font-normal">Edge</th>
                  <th className="py-1 px-2 text-right font-normal">Bet</th>
                  <th className="py-1 px-2 text-right font-normal">Kelly</th>
                  <th className="py-1 pl-2 text-right font-normal">Eff.</th>
                </tr>
              </thead>
              <tbody className="num">
                {grades.map((g) => (
                  <tr key={g.event.id} className="border-t border-subtle">
                    <td className="py-1.5 pr-2 font-sans text-secondary">{g.event.label}</td>
                    <td className="py-1.5 px-2 text-right">{fmtOdds(g.event.houseOdds)}</td>
                    <td className="py-1.5 px-2 text-right text-muted">{fmtPct(g.impliedProb)}</td>
                    <td className="py-1.5 px-2 text-right text-muted">{fmtOdds(g.fairOdds)}</td>
                    <td
                      className={`py-1.5 px-2 text-right font-semibold ${
                        g.edgePct > 1e-9 ? "text-bull" : g.edgePct < -1e-9 ? "text-bear" : "text-muted"
                      }`}
                    >
                      {fmtEdge(g.edgePct)}
                    </td>
                    <td className="py-1.5 px-2 text-right">{g.stake || "—"}</td>
                    <td className="py-1.5 px-2 text-right text-muted">{g.kellyStake || "—"}</td>
                    <td className="py-1.5 pl-2 text-right">{fmtPct(g.efficiency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ))}

      <button onClick={onReplay} className="btn-primary w-full">
        Play again
      </button>
    </div>
  );
}
