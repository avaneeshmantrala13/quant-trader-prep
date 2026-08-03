import { useEffect, useMemo, useRef, useState } from "react";
import type { ArenaOp, ArenaPreset } from "@/lib/arena/config";
import { OPTIVER_COMPETITIVE, OPTIVER_PASS } from "@/lib/arena/config";
import type { OperandShape } from "@/lib/arena/weakSpot";
import { scoreRun, type AnsweredItem } from "@/lib/arena/scoring";
import { PACE_BAND_TOKEN, perQuestionBudgetMs } from "@/lib/arena/budget";
import { questionPace } from "@/lib/arena/pacing";
import { parseFreeResponse } from "@/lib/numeric";

/** The common play shape (int stream OR the richer packs collapse to this). */
export interface PlayItem {
  id: string;
  prompt: string;
  answer: number;
  op: ArenaOp;
  /** When present, grade by rounded compare to this many places. */
  decimals?: number;
  /**
   * Weak-Spot Trainer only: the operand-shape bucket this item was drawn for, so
   * the page can record the (op × shape) attempt after grading. Absent for every
   * other mode, so their play shape is unchanged.
   */
  shape?: OperandShape;
}

const TICK_MS = 100;

function isCorrect(item: PlayItem, value: number): boolean {
  if (item.decimals == null) return value === item.answer;
  const f = 10 ** item.decimals;
  return Math.round(value * f) === Math.round(item.answer * f);
}

/**
 * Free-response parse: accepts plain numbers, decimals, fractions (`1/4`), and
 * simple `+ − × ÷ ( )` expressions via the shared `parseFreeResponse` grader, so
 * the timed arena is genuinely free-response (not MCQ) and a learner can type an
 * un-simplified answer. The timed flow is unchanged — this only widens what a
 * keystroke can mean.
 */
function parse(raw: string): number | null {
  return parseFreeResponse(raw);
}

function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * ArenaRunner — thin timed player. Owns only the wall-clock timer + input; all
 * scoring is delegated to the pure `scoreRun`. Ends at the clock or the
 * question cap and hands the resolved `AnsweredItem[]` + elapsed time up.
 */
export function ArenaRunner({
  items,
  preset,
  onFinish,
}: {
  items: PlayItem[];
  preset: ArenaPreset;
  onFinish: (answered: AnsweredItem[], elapsedMs: number) => void;
}) {
  const cap = preset.questionCap
    ? Math.min(preset.questionCap, items.length)
    : items.length;
  const interview = !!preset.interview;
  const budgetMs = perQuestionBudgetMs(preset);
  const [index, setIndex] = useState(0);
  const [remainingMs, setRemainingMs] = useState(preset.durationSec * 1000);
  const [qElapsedMs, setQElapsedMs] = useState(0);
  const [input, setInput] = useState("");
  const answeredRef = useRef<AnsweredItem[]>([]);
  const [answered, setAnswered] = useState<AnsweredItem[]>([]);
  const qStartRef = useRef<number>(Date.now());
  const startRef = useRef<number>(Date.now());
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onFinish(answeredRef.current, Date.now() - startRef.current);
  };

  // Wall-clock timer (the ONLY source of time; pure session logic is unit-
  // tested separately). Finishes when the window elapses.
  useEffect(() => {
    const id = setInterval(() => {
      if (interview) setQElapsedMs(Date.now() - qStartRef.current);
      setRemainingMs((prev) => {
        const next = prev - TICK_MS;
        if (next <= 0) {
          clearInterval(id);
          finish();
          return 0;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advance = (item: AnsweredItem) => {
    const next = [...answeredRef.current, item];
    answeredRef.current = next;
    setAnswered(next);
    setInput("");
    qStartRef.current = Date.now();
    setQElapsedMs(0);
    if (index + 1 >= cap) {
      finish();
    } else {
      setIndex(index + 1);
    }
  };

  const current = items[index];

  const submit = () => {
    if (!current) return;
    const value = parse(input);
    if (value === null) return;
    advance({
      id: current.id,
      correct: isCorrect(current, value),
      skipped: false,
      rtMs: Date.now() - qStartRef.current,
      op: current.op,
    });
  };

  const skip = () => {
    if (!current) return;
    advance({
      id: current.id,
      correct: false,
      skipped: true,
      rtMs: Date.now() - qStartRef.current,
      op: current.op,
    });
  };

  const liveScore = useMemo(() => scoreRun(answered, preset), [answered, preset]);
  const timerColor =
    remainingMs < 10_000 ? "text-bear" : "text-primary";

  const pace = interview ? questionPace(qElapsedMs, budgetMs) : null;
  const withinBudget = useMemo(
    () =>
      interview
        ? answered.filter((a) => !a.skipped && a.rtMs <= budgetMs).length
        : 0,
    [answered, interview, budgetMs],
  );

  if (!current) return null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <span className="label">Time</span>
          <div className={`num text-4xl font-black ${timerColor}`}>
            {clock(remainingMs)}
          </div>
        </div>
        <div className="text-right">
          <span className="label">Score</span>
          <div className="num text-4xl font-black text-accent">{liveScore}</div>
          {preset.penalty && (
            <div className="label mt-1 text-[9px] text-muted">
              pass {OPTIVER_PASS} · comp {OPTIVER_COMPETITIVE}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        {interview ? (
          <span className="num">
            within budget · {withinBudget}/{answered.length}
          </span>
        ) : (
          <span />
        )}
        <span className="num">
          {index + 1} / {cap}
        </span>
      </div>

      {interview && pace && (
        <div>
          <div className="flex items-center justify-between">
            <span className="label">This question</span>
            <span className={`num text-sm font-bold ${PACE_BAND_TOKEN[pace.band]}`}>
              {(pace.remainingMs / 1000).toFixed(1)}s
              {pace.overBudget ? " · over budget" : ""}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden border border-subtle bg-surface">
            <div
              className={`h-full transition-[width] duration-100 ${
                pace.band === "over"
                  ? "bg-bear"
                  : pace.band === "behind"
                    ? "bg-gold"
                    : "bg-accent"
              }`}
              style={{ width: `${pace.fraction * 100}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-muted">
            Budget {(budgetMs / 1000).toFixed(1)}s/q · pacing feedback only, no
            score effect.
          </p>
        </div>
      )}

      <div className="panel p-8 text-center">
        <div className="num text-4xl font-bold text-primary">
          {current.prompt}
        </div>
      </div>

      <input
        autoFocus
        inputMode="decimal"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Type your answer, Enter to submit"
        className="w-full border-2 border-border-strong bg-surface px-4 py-3 text-center num text-2xl text-primary focus:border-accent focus:outline-none"
      />

      <div className="flex gap-3">
        <button onClick={submit} className="btn-primary flex-1">
          Submit
        </button>
        <button onClick={skip} className="btn-secondary flex-1">
          Skip{preset.skipsFree ? " (free)" : " (−1)"}
        </button>
      </div>

      <button onClick={finish} className="btn-ghost w-full text-xs">
        End run early
      </button>
    </div>
  );
}
