import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProgress } from "@/context/ProgressContext";
import type { Question } from "@/types/content";
import {
  buildDiagnosticPlan,
  buildFollowUpPlan,
  outcomesFromAnswers,
  type PlanItem,
} from "@/lib/diagnostic/run";
import { diagnosticToSeeds, selfReportToSeed } from "@/lib/diagnostic/diagnosticSeed";
import {
  computeDiagnosticResult,
  diagnosticTrend,
} from "@/lib/diagnostic/history";
import type { DiagnosticResult } from "@/types/progress";
import { LineChart } from "@/components/simulations/charts/LineChart";
import { ChevronLeftIcon } from "@/components/icons";

/**
 * `/diagnostic` — the REQUIRED-once onboarding warm-up (PHASE_3 + approved
 * redesign). A short, RE-RUNNABLE, NON-SCORING, NON-GATING MCQ flow that mirrors
 * the quiz player. Its only side effect is seeding Phase-1 topic priors (via the
 * context's `applyDiagnosticSeeds`) + stamping `diagnosticDoneAt`. It never
 * calls `recordAttempt` and never touches `locking.ts`.
 *
 * On the FIRST (required) run the intro offers two REAL choices that both seed
 * and both stamp `diagnosticDoneAt`: the full warm-up, or a ~20-second
 * self-report fast lane. After either, the learner is never force-gated again.
 * The run itself is lightly adaptive: a global routing tier, a gated Markov
 * probe, and an adaptive tiebreak item are injected by `run.ts` as a FOLLOW-UP
 * stage after the always-on base items.
 */

type Phase = "intro" | "selfreport" | "quiz" | "summary";
type Stage = "base" | "followup";
type Lane = "full" | "self";

/** Special resume key so an unfinished base run survives a reload. */
const DIAGNOSTIC_RESUME_ID = "__diagnostic__";

export function DiagnosticPage() {
  const navigate = useNavigate();
  const {
    applyDiagnosticSeeds,
    recordDiagnosticResult,
    progress,
    saveResume,
    getResume,
    clearResume,
  } = useProgress();

  // Restore an in-progress base run (humane "answer later" — don't restart).
  // Only trust a snapshot whose shape still matches the current blueprint.
  const resumed = useRef(getResume(DIAGNOSTIC_RESUME_ID));
  const validResume =
    resumed.current &&
    resumed.current.answers.length === buildDiagnosticPlan(resumed.current.seed).length
      ? resumed.current
      : undefined;

  const [phase, setPhase] = useState<Phase>(() => (validResume ? "quiz" : "intro"));
  const [lane, setLane] = useState<Lane>("full");
  const [stage, setStage] = useState<Stage>("base");
  const [seed, setSeed] = useState(
    () => validResume?.seed ?? Date.now() % 2_000_000_000,
  );

  const basePlan = useMemo<PlanItem[]>(() => buildDiagnosticPlan(seed), [seed]);
  const [baseAnswers, setBaseAnswers] = useState<(number | null)[]>(() =>
    validResume ? validResume.answers.slice() : new Array(basePlan.length).fill(null),
  );
  const [followupPlan, setFollowupPlan] = useState<PlanItem[]>([]);
  const [followupAnswers, setFollowupAnswers] = useState<(number | null)[]>([]);
  const [index, setIndex] = useState(() =>
    validResume ? Math.min(validResume.index, validResume.answers.length - 1) : 0,
  );

  const activePlan = stage === "base" ? basePlan : followupPlan;
  const activeAnswers = stage === "base" ? baseAnswers : followupAnswers;
  const item = activePlan[index];
  const answered = item ? activeAnswers[index] !== null : false;

  const baseTotal = basePlan.length;
  const total = baseTotal + (stage === "followup" ? followupPlan.length : 0);
  const displayNumber = (stage === "followup" ? baseTotal : 0) + index + 1;

  // Persist unfinished base progress (debounced by the context) so a reload
  // resumes exactly where the learner left off, seeding what was answered.
  const persistBase = (answers: (number | null)[], nextIndex: number) => {
    saveResume({
      levelId: DIAGNOSTIC_RESUME_ID,
      seed,
      questions: basePlan.map((p) => p.item),
      index: nextIndex,
      answers,
      lessonSkipped: true,
      startedAt: resumed.current?.startedAt ?? new Date().toISOString(),
    });
  };

  const select = (choice: number) => {
    if (answered) return;
    if (stage === "base") {
      const next = baseAnswers.slice();
      next[index] = choice;
      setBaseAnswers(next);
      persistBase(next, index);
    } else {
      const next = followupAnswers.slice();
      next[index] = choice;
      setFollowupAnswers(next);
    }
  };

  const finalize = (
    plan: PlanItem[],
    answers: (number | null)[],
    usedLane: Lane,
  ) => {
    // Compute graded outcomes once; reuse for the seed stamp AND the history
    // entry so both share a single timestamp.
    const outcomes = outcomesFromAnswers(plan, answers);
    const stamp = new Date().toISOString();
    applyDiagnosticSeeds(diagnosticToSeeds(outcomes), stamp);
    // Record this attempt for the improvement graph. Only the full lane grades
    // items; skip empty attempts (e.g. "finish now" with nothing answered) so
    // the trend never shows a degenerate 0% point. The self-report lane has no
    // graded items and is intentionally NOT recorded (see submitSelfReport).
    const result = computeDiagnosticResult(outcomes, stamp);
    if (result.itemsAnswered > 0) recordDiagnosticResult(result);
    clearResume(DIAGNOSTIC_RESUME_ID);
    setLane(usedLane);
    setPhase("summary");
  };

  const goNext = () => {
    if (stage === "base") {
      if (index < basePlan.length - 1) {
        const nextIndex = index + 1;
        setIndex(nextIndex);
        persistBase(baseAnswers, nextIndex);
        return;
      }
      // Base done — compute the adaptive follow-up (gated Markov + tiebreaks).
      const followups = buildFollowUpPlan(seed, basePlan, baseAnswers);
      clearResume(DIAGNOSTIC_RESUME_ID);
      if (followups.length > 0) {
        setFollowupPlan(followups);
        setFollowupAnswers(new Array(followups.length).fill(null));
        setStage("followup");
        setIndex(0);
        return;
      }
      finalize(basePlan, baseAnswers, "full");
      return;
    }
    // Follow-up stage.
    if (index < followupPlan.length - 1) {
      setIndex(index + 1);
      return;
    }
    finalize(
      [...basePlan, ...followupPlan],
      [...baseAnswers, ...followupAnswers],
      "full",
    );
  };

  // "Answer later" — seed only what was answered so far, then leave. Still
  // stamps diagnosticDoneAt (so the required gate is satisfied) and is fully
  // re-runnable later.
  const finishEarly = () => {
    const plan = stage === "base" ? basePlan : [...basePlan, ...followupPlan];
    const answers =
      stage === "base" ? baseAnswers : [...baseAnswers, ...followupAnswers];
    finalize(plan, answers, "full");
  };

  const submitSelfReport = (answers: Record<string, string>) => {
    applyDiagnosticSeeds(selfReportToSeed(answers));
    clearResume(DIAGNOSTIC_RESUME_ID);
    setLane("self");
    setPhase("summary");
  };

  const retake = () => {
    const s = Date.now() % 2_000_000_000;
    resumed.current = undefined;
    clearResume(DIAGNOSTIC_RESUME_ID);
    setSeed(s);
    setBaseAnswers(new Array(buildDiagnosticPlan(s).length).fill(null));
    setFollowupPlan([]);
    setFollowupAnswers([]);
    setStage("base");
    setIndex(0);
    setPhase("intro");
  };

  return (
    <div className="relative min-h-[100dvh] bg-surface">
      <header className="sticky top-0 z-20 border-b-[3px] border-border-strong bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <button
            onClick={() => navigate("/contents")}
            className="btn-ghost !min-h-0 !px-2 !py-1.5"
            aria-label="Back to contents"
          >
            <ChevronLeftIcon width={18} height={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-semibold text-primary">
              Calibration Warm-Up
            </div>
            {phase === "quiz" && (
              <div className="mt-1 h-1.5 w-full border border-subtle bg-surface">
                <div
                  className="h-full bg-accent transition-all"
                  style={{
                    width: `${((displayNumber - (answered ? 0 : 1)) / Math.max(total, 1)) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
          {phase === "quiz" && (
            <span className="num text-xs text-secondary">
              {displayNumber} of {total}
            </span>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-6">
        {phase === "intro" && (
          <Intro
            baseTotal={baseTotal}
            alreadyDone={!!progress.diagnosticDoneAt}
            history={progress.diagnosticHistory}
            onStartFull={() => {
              setStage("base");
              setIndex(0);
              setPhase("quiz");
            }}
            onSelfReport={() => setPhase("selfreport")}
          />
        )}

        {phase === "selfreport" && (
          <SelfReport
            onSubmit={submitSelfReport}
            onBack={() => setPhase("intro")}
          />
        )}

        {phase === "quiz" && item && (
          <DiagnosticCard
            key={item.item.id + String(stage) + String(index)}
            question={item.item}
            number={displayNumber}
            total={total}
            answered={answered}
            selected={activeAnswers[index]}
            isLast={stage === "followup" && index === followupPlan.length - 1}
            onSelect={select}
            onNext={goNext}
            onFinishEarly={finishEarly}
          />
        )}

        {phase === "summary" && (
          <Summary
            lane={lane}
            history={progress.diagnosticHistory}
            onRetake={retake}
            onDone={() => navigate("/contents")}
          />
        )}
      </main>
    </div>
  );
}

function Intro({
  baseTotal,
  alreadyDone,
  history,
  onStartFull,
  onSelfReport,
}: {
  baseTotal: number;
  alreadyDone: boolean;
  history?: DiagnosticResult[];
  onStartFull: () => void;
  onSelfReport: () => void;
}) {
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <div className="flex items-center justify-between">
          <span className="label text-accent">
            {alreadyDone ? "Recalibrate · Not a Test" : "Warm-Up · Not a Test"}
          </span>
          <span className="chip border-subtle text-secondary">~10–15 min</span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          {alreadyDone
            ? "Re-tune your starting point"
            : "Let's calibrate your starting point"}
        </h2>
        <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-secondary">
          <p>
            This is a quick warm-up across the core topics — probability,
            expected value, counting, mental math and more.{" "}
            <span className="font-semibold text-primary">
              It is not scored and it never locks or unlocks anything.
            </span>{" "}
            We only use it to tune where your practice starts, so early questions
            land at the right difficulty instead of wasting your time.
          </p>
          <p>
            About two quick questions per topic (~{baseTotal}, plus a few
            adaptive follow-ups). In a hurry? The{" "}
            <span className="font-semibold text-primary">20-second self-report</span>{" "}
            sets a rough starting point instead. You can{" "}
            <span className="font-semibold text-primary">retake anytime</span> —
            a retake simply re-tunes your starting point.
          </p>
        </div>
        {alreadyDone && (
          <p className="mt-4 border-t border-subtle pt-3 font-mono text-xs uppercase tracking-wider text-muted">
            You've done this before · retaking overwrites your prior calibration
          </p>
        )}
      </article>

      {alreadyDone ? <ImprovementGraph history={history} /> : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={onStartFull} className="btn-primary flex-1">
          Full warm-up · ~10–15 min ▸
        </button>
        <button onClick={onSelfReport} className="btn-secondary flex-1">
          20-second self-report ▸
        </button>
      </div>
      <p className="text-center text-xs text-muted">
        Either choice gets you started — the warm-up is never scored and never
        locks or unlocks anything.
      </p>
    </div>
  );
}

/**
 * ~20-second self-report fast lane (PHASE_3 §2 BACKUP path). Maps a few coarse
 * answers to per-topic priors via `selfReportToSeed`, then stamps
 * `diagnosticDoneAt` — the same non-gating, re-runnable contract as the full run.
 */
function SelfReport({
  onSubmit,
  onBack,
}: {
  onSubmit: (answers: Record<string, string>) => void;
  onBack: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const questions: {
    key: string;
    prompt: string;
    options: { value: string; label: string }[];
  }[] = [
    {
      key: "m362k",
      prompt: "Have you taken a college probability course (e.g. M362K)?",
      options: [
        { value: "yes", label: "Yes" },
        { value: "some", label: "Some exposure" },
        { value: "no", label: "No" },
      ],
    },
    {
      key: "probCourse",
      prompt: "How comfortable are you with conditional probability / Bayes?",
      options: [
        { value: "strong", label: "Strong" },
        { value: "some", label: "Okay" },
        { value: "no", label: "Rusty" },
      ],
    },
    {
      key: "mentalMath",
      prompt: "Rate your mental-math speed.",
      options: [
        { value: "fast", label: "Fast" },
        { value: "average", label: "Average" },
        { value: "slow", label: "Slow" },
      ],
    },
  ];
  const allAnswered = questions.every((q) => answers[q.key] !== undefined);

  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <span className="label text-accent">Self-Report · ~20 seconds</span>
        <h2 className="mt-2 font-display text-2xl font-semibold text-primary">
          A rough starting point
        </h2>
        <p className="mt-2 text-sm text-secondary">
          Three quick taps set a coarse prior. It's not scored and never locks
          or unlocks anything — you can take the full warm-up later to sharpen it.
        </p>
      </article>

      {questions.map((q) => (
        <div key={q.key} className="panel p-5">
          <p className="font-display text-lg font-semibold text-primary">
            {q.prompt}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            {q.options.map((o) => {
              const chosen = answers[q.key] === o.value;
              return (
                <button
                  key={o.value}
                  onClick={() => setAnswers({ ...answers, [q.key]: o.value })}
                  className={`flex-1 border p-3 text-sm font-medium transition-colors min-h-[44px] ${
                    chosen
                      ? "border-accent bg-success-soft text-primary"
                      : "border-subtle bg-surface text-secondary hover:bg-surface-muted"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => onSubmit(answers)}
          disabled={!allAnswered}
          className="btn-primary flex-1 disabled:opacity-50"
        >
          Set my starting point ▸
        </button>
        <button onClick={onBack} className="btn-ghost flex-1">
          ← Take the full warm-up instead
        </button>
      </div>
    </div>
  );
}

/**
 * Minimal MCQ card that mirrors the quiz player's look (PHASE_3 §3 allows a
 * minimal local card). No new grading: correctness is the question's
 * `correctIndex`; a miss surfaces the distractor rationale (the trap).
 */
function DiagnosticCard({
  question,
  number,
  total,
  answered,
  selected,
  isLast,
  onSelect,
  onNext,
  onFinishEarly,
}: {
  question: Question;
  number: number;
  total: number;
  answered: boolean;
  selected: number | null;
  isLast: boolean;
  onSelect: (i: number) => void;
  onNext: () => void;
  onFinishEarly: () => void;
}) {
  return (
    <div className="animate-print-in space-y-4">
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label">
            Warm-Up {number} / {total}
          </span>
          {question.concept && (
            <span className="chip border-subtle text-secondary">{question.concept}</span>
          )}
        </div>
        <p className="mt-3 font-display text-xl font-semibold leading-relaxed text-primary">
          {question.prompt}
        </p>
      </div>

      <div className="border border-subtle">
        {question.choices.map((choice, i) => {
          const isChosen = selected === i;
          const isAnswer = i === question.correctIndex;
          let rowCls =
            "flex w-full items-start gap-3 border-b border-subtle p-4 text-left transition-colors last:border-b-0 min-h-[44px] ";
          let boxCls =
            "mt-0.5 grid h-6 w-6 shrink-0 place-items-center border font-mono text-xs font-semibold ";
          if (!answered) {
            rowCls += "bg-surface hover:bg-surface-muted";
            boxCls += "border-border-strong text-secondary";
          } else if (isAnswer) {
            rowCls += "bg-success-soft";
            boxCls += "border-bull bg-bull text-bg";
          } else if (isChosen) {
            rowCls += "bg-danger-soft";
            boxCls += "border-bear bg-bear text-bg";
          } else {
            rowCls += "bg-surface opacity-55";
            boxCls += "border-subtle text-muted";
          }
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              disabled={answered}
              className={rowCls}
            >
              <span className={boxCls}>
                {answered && isAnswer
                  ? "✓"
                  : answered && isChosen
                    ? "✕"
                    : String.fromCharCode(65 + i)}
              </span>
              <span className="font-sans text-[15px] font-medium text-primary">
                {choice}
              </span>
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="animate-print-in border border-subtle">
          <div className="flex items-center justify-between bg-surface-muted px-4 py-2">
            <span className="label text-secondary">Noted — not scored</span>
          </div>
          <div className="space-y-2 bg-surface p-4">
            {selected !== null &&
              selected !== question.correctIndex &&
              question.distractorRationale?.[selected] && (
                <p className="text-sm text-primary">
                  <span className="label text-bear">Common trap · </span>
                  {question.distractorRationale[selected]}
                </p>
              )}
            <p className="text-sm leading-relaxed text-secondary">
              {question.explanation}
            </p>
            <button onClick={onNext} className="btn-primary mt-2 w-full">
              {isLast ? "Finish warm-up ▸" : "Next ▸"}
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-subtle pt-3">
        <button onClick={onFinishEarly} className="btn-ghost w-full text-sm">
          Finish now — seed what I've answered (you can retake later)
        </button>
      </div>
    </div>
  );
}

function Summary({
  lane,
  history,
  onRetake,
  onDone,
}: {
  lane: Lane;
  history?: DiagnosticResult[];
  onRetake: () => void;
  onDone: () => void;
}) {
  return (
    <div className="animate-print-in space-y-5">
      <div className="panel-ruled p-6 text-center">
        <span className="label text-accent">Warm-Up Complete</span>
        <h2 className="mt-4 font-display text-2xl font-semibold text-primary">
          Calibrated your starting point
        </h2>
        <p className="mt-2 text-sm text-secondary">
          {lane === "self"
            ? "Your self-report set a rough starting point. Your first practice questions in each topic will start near it and adapt as you go — take the full warm-up anytime to sharpen it. This did not affect any scores or unlocks."
            : "Your first practice questions in each topic will now start at the right difficulty and adapt as you go. This did not affect any scores or unlocks."}
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button onClick={onDone} className="btn-primary flex-1">
            Go to Contents ▸
          </button>
          <button onClick={onRetake} className="btn-secondary flex-1">
            Retake warm-up ↻
          </button>
        </div>
      </div>

      {/* The full lane records a graded result during finalize(), so this
          reflects the just-completed attempt. The self-report lane records
          nothing, so the graph invites the learner to take the full warm-up. */}
      <ImprovementGraph history={history} />
    </div>
  );
}

/**
 * Themed improvement graph for the Recalibrate flow: plots the overall
 * diagnostic score across attempts with a first-vs-latest read. Uses the sim
 * tab's `LineChart` (token-themed, AA) and degrades gracefully with 0–1
 * attempts by inviting another run instead of drawing a degenerate chart.
 */
function ImprovementGraph({ history }: { history?: DiagnosticResult[] }) {
  const trend = diagnosticTrend(history);
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  if (trend.count < 2) {
    return (
      <div className="panel-ruled p-5">
        <span className="label text-accent">Your progress over time</span>
        <p className="mt-2 text-sm text-secondary">
          {trend.count === 0
            ? "Complete a warm-up to start tracking your score across retakes."
            : "Take it again to see your trend — you've completed one warm-up so far."}
        </p>
        {trend.count === 1 && trend.latest ? (
          <p className="mt-2 text-sm text-secondary">
            This attempt:{" "}
            <span className="num text-primary">
              {pct(trend.latest.overallScore)}
            </span>{" "}
            <span className="text-muted">
              ({trend.latest.itemsAnswered} items)
            </span>
          </p>
        ) : null}
      </div>
    );
  }

  const first = trend.first!;
  const latest = trend.latest!;
  const deltaPts = Math.round(latest.overallScore * 100) -
    Math.round(first.overallScore * 100);
  const points = trend.points.map((p) => ({ x: p.attempt, y: p.score }));

  return (
    <div className="panel-ruled space-y-3 p-5">
      <div className="flex items-center justify-between">
        <span className="label text-accent">Your progress over time</span>
        <span
          className={`num text-sm ${deltaPts >= 0 ? "text-bull" : "text-bear"}`}
        >
          {deltaPts >= 0 ? "▲" : "▼"} {Math.abs(deltaPts)} pts
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="flex flex-col">
          <span className="label text-secondary">First</span>
          <span className="num text-primary">{pct(first.overallScore)}</span>
        </div>
        <div className="flex flex-col">
          <span className="label text-secondary">Latest</span>
          <span className="num text-primary">{pct(latest.overallScore)}</span>
        </div>
        <div className="flex flex-col">
          <span className="label text-secondary">Attempts</span>
          <span className="num text-primary">{trend.count}</span>
        </div>
      </div>

      <LineChart
        series={[{ points, colorClass: "stroke-accent", label: "score" }]}
        xLabel="attempt"
        yLabel="score"
        yDomain={[0, 1]}
        xDomain={[1, trend.count]}
        annotations={[
          {
            x: 1,
            y: first.overallScore,
            side: "up",
            text: `first ${pct(first.overallScore)}`,
          },
          {
            x: trend.count,
            y: latest.overallScore,
            side: "left",
            text: `latest ${pct(latest.overallScore)}`,
          },
        ]}
        formatX={(x) => String(Math.round(x))}
        formatY={(y) => pct(y)}
        ariaLabel="Your overall diagnostic score across attempts over time"
      />

      <p className="text-xs leading-relaxed text-muted">
        {trend.improving
          ? `You're improving — up ${deltaPts} points since your first warm-up.`
          : deltaPts === 0
            ? "Holding steady — same overall score as your first warm-up."
            : "Down from your first attempt — keep practicing and retake to climb back."}
      </p>
    </div>
  );
}
