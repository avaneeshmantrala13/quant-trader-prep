import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { GameChrome } from "@/components/games/GameChrome";
import { StampSeal } from "@/components/visuals/StampSeal";
import { celebrate } from "@/lib/celebrate";
import type { Question } from "@/types/content";
import {
  parseDrillIntent,
  bandLabel,
  type DrillSpec,
} from "@/lib/drill/parseIntent";
import { assembleDrill } from "@/lib/drill/assemble";
import { drillTopicByKey } from "@/lib/drill/vocabulary";
import { requestDrillIntent } from "@/lib/drill/aiIntent";

/**
 * Custom Drill Builder (`/drill`).
 *
 * A chatbot-style entry: the learner types what they want to practice ("bayes
 * and EV, medium, 12 questions") and the app assembles a drill from freshly
 * generated, exact-solver-checked questions matching that intent — the same
 * question engine the lessons use (there is no static "verified bank"). It is
 * SELF-CONTAINED, exactly like
 * the Fermi drill — its own session score, and it NEVER writes to mastery /
 * unlock / resume storage. The deterministic parser (`parseDrillIntent`) is the
 * backbone; an optional LLM parser (`requestDrillIntent`, behind the AI flag)
 * refines the intent but its output is snapped back onto the same vocabulary.
 */

type Phase = "intro" | "confirm" | "drill" | "summary";

const EXAMPLES = [
  "Bayes and EV, medium",
  "hard combinatorics, 12 questions",
  "mixed easy warm-up",
  "markov chains and variance",
  "kelly betting, 8 questions",
];

export function DrillPage() {
  const navigate = useNavigate();
  const { themeDef } = useTheme();

  const [phase, setPhase] = useState<Phase>("intro");
  // The learner's raw request, lifted here so an "Edit request" round-trip from
  // the confirm step returns to the box with the text intact.
  const [text, setText] = useState("");
  const [spec, setSpec] = useState<DrillSpec | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);

  const total = questions.length;
  const q = questions[index];
  const answered = q ? answers[index] != null : false;

  // The intent has been resolved (LLM if enabled, else deterministic) and
  // validated/clamped onto the real vocabulary. We ASSEMBLE now (not on Start) so
  // the confirmation can state the ACTUAL number we can deliver — some topics'
  // generators cap out below a big request, and we report that honestly rather
  // than promising a count we can't build.
  const confirmSpec = (resolvedSpec: DrillSpec) => {
    // Fresh seed per build so repeated drills on the same topic vary the items.
    const seed = Date.now() % 2_000_000_000;
    const qs = assembleDrill(resolvedSpec, seed);
    setSpec(resolvedSpec);
    setQuestions(qs);
    setPhase("confirm");
  };

  const startDrill = () => {
    if (!spec || questions.length === 0) return;
    // Questions were already assembled for the confirm step; use them verbatim
    // so the drill matches exactly what the confirmation promised.
    setAnswers(new Array(questions.length).fill(null));
    setIndex(0);
    setPhase("drill");
  };

  const select = (choice: number) => {
    if (answered) return;
    setAnswers((prev) => {
      const next = prev.slice();
      next[index] = choice;
      return next;
    });
  };

  const goNext = () => {
    if (index < total - 1) {
      setIndex(index + 1);
    } else {
      setPhase("summary");
      const anyCorrect = questions.some(
        (qq, i) => answers[i] === qq.correctIndex,
      );
      if (anyCorrect) setTimeout(themeDef.celebration ?? celebrate, 260);
    }
  };

  const restart = () => {
    setSpec(null);
    setText("");
    setQuestions([]);
    setAnswers([]);
    setIndex(0);
    setPhase("intro");
  };

  // Back to the request box from the confirm step, keeping the typed text and
  // the resolved spec (so the live preview still shows what was understood).
  const editRequest = () => setPhase("intro");

  return (
    <GameChrome
      title="Custom Drill Builder"
      onBack={() => navigate("/")}
      progress={
        phase === "drill" && total > 0
          ? (index + (answered ? 1 : 0)) / total
          : undefined
      }
      headerRight={
        phase === "drill" && total > 0 ? (
          <span className="num text-xs text-secondary">
            {String(index + 1).padStart(2, "0")}/{total}
          </span>
        ) : undefined
      }
    >
        {phase === "intro" && (
          <DrillIntro
            text={text}
            onTextChange={setText}
            onResolved={confirmSpec}
          />
        )}

        {phase === "confirm" && spec && (
          <DrillConfirm
            spec={spec}
            built={questions.length}
            onStart={startDrill}
            onEdit={editRequest}
          />
        )}

        {phase === "drill" && q && (
          <DrillQuestionCard
            key={q.id + index}
            question={q}
            number={index + 1}
            total={total}
            selected={answers[index]}
            answered={answered}
            isLast={index === total - 1}
            onSelect={select}
            onNext={goNext}
          />
        )}

        {phase === "drill" && total === 0 && (
          <div className="animate-print-in panel-ruled p-6 text-center">
            <p className="font-display text-lg font-semibold text-primary">
              No questions matched that request.
            </p>
            <p className="mt-2 text-sm text-secondary">
              Try broader topics (e.g. "bayes", "expected value",
              "combinatorics") or widen the difficulty.
            </p>
            <button onClick={restart} className="btn-primary mt-5">
              Try Again
            </button>
          </div>
        )}

        {phase === "summary" && spec && (
          <DrillSummary
            spec={spec}
            questions={questions}
            answers={answers}
            onRestart={restart}
            onDone={() => navigate("/")}
          />
        )}
    </GameChrome>
  );
}

/* -------------------------------------------------------------------------- */
/*  Intro — the chatbot-style intent box                                       */
/* -------------------------------------------------------------------------- */

function DrillIntro({
  text,
  onTextChange,
  onResolved,
}: {
  text: string;
  onTextChange: (t: string) => void;
  onResolved: (spec: DrillSpec) => void;
}) {
  const [busy, setBusy] = useState(false);
  // Live, offline preview of what the deterministic parser understood as the
  // learner types. The AUTHORITATIVE config (which may be refined by the LLM) is
  // resolved on Build and shown on the confirm step.
  const preview = useMemo(
    () => (text.trim() ? parseDrillIntent(text) : null),
    [text],
  );

  const build = async () => {
    if (busy) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    // LLM parser first (if enabled); it runs server-side and returns null when
    // off / on error / invalid JSON, in which case we fall back to the
    // deterministic parse. Either way the result is a spec built ONLY from — and
    // validated against — the known vocabulary (unknown topics dropped, orders
    // and count clamped), so the drill can never be silently misconfigured.
    let spec: DrillSpec | null = null;
    try {
      spec = await requestDrillIntent(trimmed);
    } catch {
      spec = null;
    }
    if (!spec) spec = parseDrillIntent(trimmed);
    setBusy(false);
    onResolved(spec);
  };

  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <span className="label text-accent">Build Your Own Drill</span>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          Tell me what you want to practice
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          Type it like you'd say it: the topics, how hard, and how many. I'll
          generate a fresh set from the same question engine the lessons use —
          each problem is produced and checked by its own exact solver. This is
          practice only: your session score here never touches your mastery or
          progress.
        </p>

        <div className="mt-5">
          <label htmlFor="drill-intent" className="label text-accent">
            Your request
          </label>
          <textarea
            id="drill-intent"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) build();
            }}
            rows={2}
            placeholder="e.g. bayes and expected value problems, mid-level, 12 questions"
            className="mt-2 w-full resize-none border-2 border-border-strong bg-surface p-3 text-[15px] text-primary outline-none focus:border-accent"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => onTextChange(ex)}
                className="chip border-subtle text-secondary hover:text-primary"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {preview && (
          <div className="mt-4 border-l-2 border-subtle bg-surface-muted px-4 py-3">
            <div className="label text-secondary">Preview</div>
            <SpecSummary spec={preview} />
          </div>
        )}
      </article>

      <button
        onClick={build}
        disabled={!text.trim() || busy}
        className="btn-primary w-full disabled:opacity-50"
      >
        {busy ? "Building…" : "Build Drill ▸"}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Confirm — the ACTUAL resolved spec (LLM-refined or deterministic)          */
/* -------------------------------------------------------------------------- */

/**
 * Shows the resolved, validated {@link DrillSpec} alongside the number we ACTUALLY
 * assembled (`built`), so the "I'll build: N <level> questions on <topics>" line
 * the learner confirms is EXACTLY what starts — count, difficulty band, and
 * topics all reflect the real config (after any LLM refinement + vocabulary
 * validation/clamping) AND the true generator capacity. When a topic can't reach
 * the requested count we say so honestly and still offer the smaller drill; when
 * nothing could be assembled we send them back to edit.
 */
function DrillConfirm({
  spec,
  built,
  onStart,
  onEdit,
}: {
  spec: DrillSpec;
  built: number;
  onStart: () => void;
  onEdit: () => void;
}) {
  const canStart = built > 0;
  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <span className="label text-accent">Confirm Your Drill</span>
        <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary">
          Ready when you are
        </h2>
        <div className="mt-4 border-l-2 border-accent bg-surface-muted px-4 py-3">
          <div className="label text-accent">I'll build</div>
          <SpecSummary spec={spec} built={built} />
        </div>
      </article>

      {canStart ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={onStart} className="btn-primary flex-1">
            Start Drill ▸
          </button>
          <button onClick={onEdit} className="btn-secondary flex-1">
            Edit request
          </button>
        </div>
      ) : (
        <button onClick={onEdit} className="btn-primary w-full">
          Edit request
        </button>
      )}
    </div>
  );
}

/**
 * Renders a resolved spec in plain English ("10 medium questions on …"). When
 * `built` is provided it is the source of truth for the count shown (the ACTUAL
 * number assembled); if it falls short of the requested `spec.count` we add an
 * honest note, and if it's zero we explain nothing matched. Without `built` (the
 * live preview while typing) we show the requested count as intent.
 */
function SpecSummary({ spec, built }: { spec: DrillSpec; built?: number }) {
  const names = spec.topicKeys
    .map((k) => drillTopicByKey(k)?.label)
    .filter((x): x is string => !!x);
  if (names.length === 0) {
    return (
      <p className="mt-1 text-sm text-secondary">
        No topics recognized yet. Try naming a topic like "bayes", "expected
        value", or "combinatorics".
      </p>
    );
  }
  const topicText =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;

  const band = bandLabel(spec.minOrder, spec.maxOrder);

  // A confirmed spec whose generators couldn't produce anything in-band.
  if (typeof built === "number" && built === 0) {
    return (
      <p className="mt-1 text-sm text-secondary">
        No questions available for {topicText} at that difficulty. Try widening
        the level or picking another topic.
      </p>
    );
  }

  // Count shown is the ACTUAL number we can deliver when known (confirm step),
  // else the requested count (live preview).
  const shown = typeof built === "number" ? built : spec.count;
  const short = typeof built === "number" && built < spec.count;

  return (
    <>
      <p className="mt-1 text-sm text-secondary">
        <span className="num font-semibold text-primary">{shown}</span>{" "}
        <span className="font-semibold text-primary">{band}</span>{" "}
        question{shown === 1 ? "" : "s"} on{" "}
        <span className="font-semibold text-primary">{topicText}</span>.
      </p>
      {short && (
        <p className="mt-1 text-xs text-muted">
          Only {built} unique {band === "all levels" ? "" : `${band} `}
          question{built === 1 ? "" : "s"} available for {topicText} right now —
          building {built} instead of the {spec.count} you asked for.
        </p>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  One MCQ — self-contained scored card (no mastery side-effects)             */
/* -------------------------------------------------------------------------- */

function DrillQuestionCard({
  question,
  number,
  total,
  selected,
  answered,
  isLast,
  onSelect,
  onNext,
}: {
  question: Question;
  number: number;
  total: number;
  selected: number | null;
  answered: boolean;
  isLast: boolean;
  onSelect: (i: number) => void;
  onNext: () => void;
}) {
  const isCorrect = answered && selected === question.correctIndex;

  return (
    <div className="animate-print-in space-y-4">
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label">
            Question {String(number).padStart(2, "0")} / {total}
          </span>
          {question.concept && (
            <span className="chip border-subtle text-secondary">
              {question.concept}
            </span>
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
          <div
            className={`flex items-center justify-between px-4 py-2 ${
              isCorrect ? "bg-bull text-bg" : "bg-bear text-bg"
            }`}
          >
            <span className="font-mono text-xs font-semibold uppercase tracking-label">
              {isCorrect ? "● Filled: Correct" : "● Rejected: Incorrect"}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-label opacity-90">
              Trade Ticket
            </span>
          </div>
          <div className="space-y-2 bg-surface p-4">
            {!isCorrect &&
              selected !== null &&
              question.distractorRationale?.[selected] && (
                <p className="text-sm text-primary">
                  <span className="label text-bear">Your error · </span>
                  {question.distractorRationale[selected]}
                </p>
              )}
            <p className="text-sm leading-relaxed text-secondary">
              {question.explanation}
            </p>
          </div>
        </div>
      )}

      {answered && (
        <button onClick={onNext} className="btn-primary w-full">
          {isLast ? "See Results ▸" : "Next Question ▸"}
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Summary                                                                    */
/* -------------------------------------------------------------------------- */

function DrillSummary({
  spec,
  questions,
  answers,
  onRestart,
  onDone,
}: {
  spec: DrillSpec;
  questions: Question[];
  answers: (number | null)[];
  onRestart: () => void;
  onDone: () => void;
}) {
  const correct = questions.reduce(
    (s, q, i) => s + (answers[i] === q.correctIndex ? 1 : 0),
    0,
  );
  const total = questions.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const strong = pct >= 70;

  return (
    <div className="animate-print-in space-y-5">
      <div className="panel-ruled p-6 text-center">
        <span className="label">Drill Scorecard</span>
        <div className="relative mt-4 flex justify-center">
          <StampSeal
            label={strong ? "Sharp" : "Keep Drilling"}
            sub={bandLabel(spec.minOrder, spec.maxOrder)}
            tone={strong ? "bull" : "accent"}
          />
        </div>

        <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 divide-x divide-subtle border-y border-subtle">
          <div className="px-2 py-3">
            <div className="label text-[9px]">Score</div>
            <div className="num mt-1 text-xl font-semibold text-primary">
              {correct}/{total}
            </div>
          </div>
          <div className="px-2 py-3">
            <div className="label text-[9px]">Accuracy</div>
            <div
              className={`num mt-1 text-xl font-semibold ${strong ? "text-bull" : "text-primary"}`}
            >
              {pct}%
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button onClick={onRestart} className="btn-primary flex-1">
            New Drill
          </button>
          <button onClick={onDone} className="btn-secondary flex-1">
            Back Home
          </button>
        </div>
      </div>

      {/* Per-question blotter */}
      <div className="panel">
        <div className="border-b-[3px] border-border-strong px-4 py-2.5">
          <span className="label">Blotter · Review</span>
        </div>
        <ul>
          {questions.map((q, i) => {
            const chosen = answers[i];
            const right = chosen === q.correctIndex;
            return (
              <li
                key={q.id + i}
                className="space-y-1.5 border-b border-subtle p-4 last:border-b-0"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`num mt-0.5 grid h-6 w-6 shrink-0 place-items-center text-xs font-semibold ${
                      right ? "bg-bull text-bg" : "bg-bear text-bg"
                    }`}
                  >
                    {right ? "✓" : "✕"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-primary">
                      {q.prompt}
                    </div>
                    <div className="mt-1 text-xs text-secondary">
                      <span className="label text-secondary">You · </span>
                      {chosen != null ? q.choices[chosen] : "—"}
                      {!right && (
                        <>
                          {"   "}
                          <span className="label text-bull">Answer · </span>
                          {q.choices[q.correctIndex]}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
