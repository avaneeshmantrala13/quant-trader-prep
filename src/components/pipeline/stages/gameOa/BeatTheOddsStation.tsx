import { useMemo, useRef, useState } from "react";
import { type BtoFormat } from "@/content/games/beatTheOddsQuestions";
import {
  advanceBto,
  answerBto,
  createBtoSession,
  paperFor,
  scoreItem,
  DEFAULT_BTO_BUDGET_MS,
} from "@/lib/games/beatTheOdds/engine";
import { tradingSubtopicByGame } from "@/lib/mastery/tradingSubtopics";
import {
  StationProgress,
  TimerBar,
  useMountSeed,
  useShotClock,
  useStationFold,
  type StationProps,
} from "./kit";

const SUBTOPIC = tradingSubtopicByGame("beat-the-odds").key;

export const BEAT_THE_ODDS_ROUNDS = 8;

/** Render a Beat-the-Odds numeric option in its question's format. */
function fmtOption(v: number, format: BtoFormat): string {
  if (format === "percent") return `${(v * 100).toFixed(1)}%`;
  if (format === "ev") return `$${v.toFixed(2)}`;
  return String(v);
}

/**
 * Beat the Odds battery station — reuses the pure SESSION engine
 * (`createBtoSession` / `answerBto` / `advanceBto` / `scoreItem`) so the
 * embedded drill runs against the SAME ~90s-per-question shot clock as the
 * stand-alone section. Time pressure feeds the subtopic Beta two ways: a
 * per-question TIMEOUT auto-commits a miss (`answerBto(..., timedOut)`, points 0
 * ⇒ credit 0), and a correct answer's credit is SPEED-WEIGHTED by the engine's
 * own `scoreItem` bonus (instant ⇒ 1.0, at-the-buzzer ⇒ 0.5), folded into
 * `competency::rapid-ev`.
 */
export default function BeatTheOddsStation({ onComplete }: StationProps) {
  const { record, summary } = useStationFold(SUBTOPIC);
  const seed = useMountSeed();
  const [session, setSession] = useState(() =>
    createBtoSession({
      seed,
      nowTs: Date.now(),
      count: BEAT_THE_ODDS_ROUNDS,
      budgetMs: DEFAULT_BTO_BUDGET_MS,
    }),
  );
  const paper = useMemo(() => paperFor(session), [session.seed, session.count]);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const correctRef = useRef(0);
  const doneRef = useRef(false);

  const q = paper[session.index];
  const maxItemScore = q ? scoreItem(q.tier, true, 0) : 1;
  const isLast = session.index + 1 >= session.count;

  const commit = (chosen: number | null, timedOut: boolean) => {
    if (revealed || !q) return;
    const atTs = timedOut ? session.questionDeadlineTs : Date.now();
    const next = answerBto(session, chosen, atTs, timedOut);
    const ans = next.answers[session.index];
    const credit = ans && ans.correct ? ans.points / maxItemScore : 0;
    if (ans?.correct) correctRef.current += 1;
    record(credit);
    setSession(next);
    setPicked(chosen);
    setRevealed(true);
  };

  const clock = useShotClock({
    durationMs: session.budgetMs,
    running: !revealed && !doneRef.current,
    resetKey: session.index,
    onExpire: () => commit(null, true),
  });

  const advance = () => {
    if (isLast) {
      if (doneRef.current) return;
      doneRef.current = true;
      onComplete(summary(`${correctRef.current} / ${session.count}`));
      return;
    }
    setSession((s) => advanceBto(s, Date.now()));
    setPicked(null);
    setRevealed(false);
  };

  if (!q) return null;

  const answer = session.answers[session.index];

  return (
    <div className="space-y-4" data-testid="beat-the-odds-station">
      {!revealed && (
        <TimerBar remainingMs={clock.remainingMs} durationMs={session.budgetMs} />
      )}
      <StationProgress
        index={session.index}
        total={session.count}
        correct={correctRef.current}
        label="Question"
      />

      <div className="panel-ruled p-5">
        <span className="label text-accent">
          Tier {q.tier} · {q.category}
        </span>
        <div className="mt-1 font-display text-lg font-semibold leading-snug text-primary">
          {q.prompt}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correctIndex;
          const isPicked = i === picked;
          const tone = !revealed
            ? "border-subtle hover:border-accent"
            : isCorrect
              ? "border-bull text-bull"
              : isPicked
                ? "border-bear text-bear"
                : "border-subtle opacity-60";
          return (
            <button
              key={i}
              type="button"
              className={`btn-ghost justify-center border ${tone}`}
              onClick={() => commit(i, false)}
              disabled={revealed}
              aria-label={`option ${i + 1}`}
            >
              <span className="num">{fmtOption(opt, q.format)}</span>
            </button>
          );
        })}
      </div>

      {revealed && (
        <div className="space-y-3">
          <div
            className={`verdict ${
              answer?.correct ? "bg-bull text-bg" : "bg-bear text-bg"
            }`}
          >
            {answer?.correct
              ? `● Correct · +${answer.points} pts`
              : answer?.timedOut
                ? "● Out of time"
                : "● Not quite"}
          </div>
          {q.explanation && (
            <p className="reveal text-secondary">{q.explanation}</p>
          )}
          <button
            type="button"
            className="btn-primary w-full"
            onClick={advance}
            data-testid="station-advance"
          >
            {isLast ? "Finish game →" : "Next →"}
          </button>
        </div>
      )}
    </div>
  );
}
