import { useMemo, useRef, useState } from "react";
import type { Flashcard } from "@/types/content";
import type { DiagnosticResult } from "@/types/progress";
import { formatNumericAnswer, parseFreeResponse } from "@/lib/numeric";
import { useProgress } from "@/context/ProgressContext";
import {
  gradeBrainteaserNumeric,
  gradeUntimedNumeric,
  materializeUntimedRun,
  untimedToCompetencyAttempts,
  untimedToDiagnosticSeeds,
  untimedToResult,
  type MaterializedUntimedItem,
  type UntimedOutcome,
} from "@/lib/diagnostic/untimedRun";

/**
 * STAGE 2 — the ~100-item UNTIMED FREE-RESPONSE diagnostic (spec §2, P3 bullet 5).
 *
 * Implements the guided-pipeline StageComponent contract
 * (`(props: { onComplete }) => JSX`): it renders ONE question at a time, untimed,
 * with an `n / N` progress bar, and owns NO navigation. Each item is either a
 * FREE-RESPONSE numeric entry or a BRAINTEASER flashcard graded by the HYBRID
 * rule (decision §10.3): a brainteaser with a numeric answer requires entering
 * the number (objective grade); otherwise it is "Show answer → I got it / missed
 * it" self-eval.
 *
 * On finish it PERSISTS via the ProgressContext — seeding topic mastery from the
 * numeric outcomes (`applyDiagnosticSeeds`) and folding the brainteaser outcomes
 * into `competency::brainteaser-reasoning` (`recordItemAttempt`, P2 scorer credit)
 * — then hands the `DiagnosticResult` back through `onComplete(result)` for the
 * coordinator to write into `progress.pipeline.untimed`.
 *
 * Matches the minimalist dark UI (shared `panel` / `label` / `btn-*` classes).
 */
export function UntimedDiagnosticStage({
  onComplete,
}: {
  onComplete: (result?: DiagnosticResult) => void;
}) {
  const { applyDiagnosticSeeds, recordItemAttempt } = useProgress();

  // A stable per-attempt seed so items stay reproducible across re-renders.
  const seedRef = useRef<number>(Math.floor(Math.random() * 2 ** 31) >>> 0);
  const items = useMemo<MaterializedUntimedItem[]>(
    () => materializeUntimedRun(seedRef.current),
    [],
  );

  const total = items.length;
  const [index, setIndex] = useState(0);
  const outcomesRef = useRef<UntimedOutcome[]>([]);

  // Per-item interaction state.
  const [entry, setEntry] = useState("");
  const [graded, setGraded] = useState<null | {
    correct: boolean;
    feedback?: string;
  }>(null);
  const [revealed, setRevealed] = useState(false);
  const finishedRef = useRef(false);

  const current = items[index];
  const isLast = index >= total - 1;

  const resetItemState = () => {
    setEntry("");
    setGraded(null);
    setRevealed(false);
  };

  const pushOutcome = (o: UntimedOutcome) => {
    outcomesRef.current = [...outcomesRef.current, o];
  };

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const outcomes = outcomesRef.current;

    // Seed the scored KST nodes from the numeric outcomes.
    const seeds = untimedToDiagnosticSeeds(outcomes);
    applyDiagnosticSeeds(
      seeds.map((s) => ({
        topicKey: s.topicKey,
        successes: s.successes,
        failures: s.failures,
        thetaSeed: s.thetaSeed,
        misconceptions: s.misconceptions,
      })),
    );

    // Fold the brainteaser outcomes into the competency node.
    for (const attempt of untimedToCompetencyAttempts(outcomes)) {
      recordItemAttempt(attempt);
    }

    const result = untimedToResult(outcomes);
    onComplete(result);
  };

  const advance = () => {
    if (isLast) {
      finish();
      return;
    }
    setIndex((i) => i + 1);
    resetItemState();
  };

  /* ---- numeric free-response item ---------------------------------------- */
  const submitNumeric = () => {
    if (current.kind !== "numeric" || graded || entry.trim() === "") return;
    const grade = gradeUntimedNumeric(current.question, entry);
    pushOutcome({
      topicKey: current.topicKey,
      subtopic: current.subtopic,
      kind: "numeric",
      tier: current.tier,
      correct: grade.correct,
      misconceptionTag: grade.matchedError?.misconception,
      at: new Date().toISOString(),
    });
    setGraded({
      correct: grade.correct,
      feedback: grade.matchedError?.feedback,
    });
  };

  /* ---- brainteaser: objective numeric commit ----------------------------- */
  const submitBrainteaserNumeric = () => {
    if (current.kind !== "brainteaser" || graded || entry.trim() === "") return;
    const value = parseFreeResponse(entry);
    const correct = value !== null && gradeBrainteaserNumeric(current.flashcard, value);
    pushOutcome({
      topicKey: current.topicKey,
      subtopic: current.subtopic,
      kind: "brainteaser",
      tier: "medium",
      correct,
      at: new Date().toISOString(),
    });
    setGraded({ correct });
    setRevealed(true);
  };

  /* ---- brainteaser: self-eval -------------------------------------------- */
  const selfEval = (got: boolean) => {
    if (current.kind !== "brainteaser" || graded) return;
    pushOutcome({
      topicKey: current.topicKey,
      subtopic: current.subtopic,
      kind: "brainteaser",
      tier: "medium",
      correct: got,
      at: new Date().toISOString(),
    });
    setGraded({ correct: got });
  };

  const progressPct = Math.round((index / total) * 100);

  return (
    <section className="panel-ruled space-y-6 p-6" data-testid="untimed-diagnostic-stage">
      {/* Header + progress */}
      <header className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            <span className="label text-accent">Stage 2 · Diagnostic</span>
            <h2 className="font-display text-2xl font-bold leading-tight text-primary">
              Untimed diagnostic
            </h2>
          </div>
          <span className="num shrink-0 text-sm text-secondary">
            <span className="font-semibold text-primary">{index + 1}</span>
            <span className="text-muted"> / {total}</span>
          </span>
        </div>
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={0}
          aria-valuemax={total}
        >
          <div
            className="h-full rounded-full bg-accent transition-all duration-200 ease-out"
            style={{ width: `${progressPct}%` }}
            data-testid="untimed-progress"
          />
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Take your time — this maps your starting level across every topic. There
          is no clock.
        </p>
      </header>

      {current.kind === "numeric" ? (
        <NumericItemView
          item={current}
          entry={entry}
          setEntry={setEntry}
          graded={graded}
          onSubmit={submitNumeric}
          onNext={advance}
          isLast={isLast}
        />
      ) : (
        <BrainteaserItemView
          item={current}
          entry={entry}
          setEntry={setEntry}
          graded={graded}
          revealed={revealed}
          onReveal={() => setRevealed(true)}
          onCommit={submitBrainteaserNumeric}
          onSelfEval={selfEval}
          onNext={advance}
          isLast={isLast}
        />
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Numeric item                                                               */
/* -------------------------------------------------------------------------- */

function NumericItemView({
  item,
  entry,
  setEntry,
  graded,
  onSubmit,
  onNext,
  isLast,
}: {
  item: Extract<MaterializedUntimedItem, { kind: "numeric" }>;
  entry: string;
  setEntry: (v: string) => void;
  graded: { correct: boolean; feedback?: string } | null;
  onSubmit: () => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const { question } = item;
  return (
    <div className="space-y-4">
      {/* The concept/trick label is intentionally NOT shown here: a real quant
          diagnostic never reveals the topic. The item's `topicKey`/`subtopic`
          still drive attribution + mastery seeding — this only hides display. */}
      <div className="space-y-2">
        <p className="font-display text-lg font-semibold leading-relaxed text-primary">
          {question.prompt}
        </p>
      </div>

      {!graded ? (
        <div className="space-y-3">
          <div className="flex items-stretch gap-2">
            {question.unit && (
              <span className="label flex shrink-0 items-center border border-subtle bg-surface-muted px-3 text-secondary">
                {question.unit}
              </span>
            )}
            <input
              autoFocus
              inputMode="decimal"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
              }}
              placeholder="Type a number — e.g. 0.25, 3/8, 5%"
              aria-label="Your answer"
              className="input flex-1"
            />
          </div>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={onSubmit}
            disabled={entry.trim() === ""}
          >
            Submit
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className={`verdict ${graded.correct ? "bg-bull text-bg" : "bg-bear text-bg"}`}>
            {graded.correct ? "● Correct" : "● Not quite"}
          </div>
          <div className="reveal">
            <p>
              <span className="label text-secondary">Answer · </span>
              <span className="num font-semibold">{formatNumericAnswer(question)}</span>
              {question.unit ? ` ${question.unit}` : ""}
            </p>
            {!graded.correct && graded.feedback && (
              <p className="text-secondary">{graded.feedback}</p>
            )}
            <p className="text-secondary">{question.explanation}</p>
          </div>
          <button type="button" className="btn-primary w-full" onClick={onNext}>
            {isLast ? "Finish diagnostic ▸" : "Next ▸"}
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Brainteaser item (hybrid grading)                                          */
/* -------------------------------------------------------------------------- */

function BrainteaserItemView({
  item,
  entry,
  setEntry,
  graded,
  revealed,
  onReveal,
  onCommit,
  onSelfEval,
  onNext,
  isLast,
}: {
  item: Extract<MaterializedUntimedItem, { kind: "brainteaser" }>;
  entry: string;
  setEntry: (v: string) => void;
  graded: { correct: boolean } | null;
  revealed: boolean;
  onReveal: () => void;
  onCommit: () => void;
  onSelfEval: (got: boolean) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const { flashcard, numericGradable } = item;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <span className="chip border-accent text-accent">Brainteaser</span>
        <p className="font-display text-lg font-semibold leading-relaxed text-primary">
          {flashcard.prompt}
        </p>
      </div>

      {/* Objective numeric brainteaser: commit a number, then reveal + grade. */}
      {numericGradable ? (
        !graded ? (
          <div className="space-y-3">
            <input
              autoFocus
              inputMode="decimal"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCommit();
              }}
              placeholder="Enter your numeric answer"
              aria-label="Your brainteaser answer"
              className="input"
            />
            <button
              type="button"
              className="btn-primary w-full"
              onClick={onCommit}
              disabled={entry.trim() === ""}
            >
              Commit &amp; reveal
            </button>
          </div>
        ) : (
          <RevealBlock
            flashcard={flashcard}
            verdict={graded.correct ? "correct" : "missed"}
            onNext={onNext}
            isLast={isLast}
          />
        )
      ) : /* Open-ended brainteaser: reveal then self-grade. */
      !revealed ? (
        <button type="button" className="btn-secondary w-full" onClick={onReveal}>
          Show answer
        </button>
      ) : !graded ? (
        <div className="space-y-3">
          <RevealBody flashcard={flashcard} />
          <div className="flex gap-3">
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={() => onSelfEval(true)}
            >
              I got it
            </button>
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => onSelfEval(false)}
            >
              I missed it
            </button>
          </div>
        </div>
      ) : (
        <RevealBlock
          flashcard={flashcard}
          verdict={graded.correct ? "got" : "missed"}
          onNext={onNext}
          isLast={isLast}
        />
      )}
    </div>
  );
}

function RevealBody({ flashcard }: { flashcard: Flashcard }) {
  return (
    <div className="reveal">
      <p>
        <span className="label text-secondary">Answer · </span>
        <span className="text-primary">{flashcard.answer}</span>
      </p>
      <p className="text-secondary">{flashcard.explanation}</p>
    </div>
  );
}

function RevealBlock({
  flashcard,
  verdict,
  onNext,
  isLast,
}: {
  flashcard: Flashcard;
  verdict: "correct" | "missed" | "got";
  onNext: () => void;
  isLast: boolean;
}) {
  const good = verdict === "correct" || verdict === "got";
  return (
    <div className="space-y-3">
      <div className={`verdict ${good ? "bg-bull text-bg" : "bg-bear text-bg"}`}>
        {verdict === "correct"
          ? "● Correct"
          : verdict === "got"
            ? "● Marked got it"
            : "● Marked missed"}
      </div>
      <RevealBody flashcard={flashcard} />
      <button type="button" className="btn-primary w-full" onClick={onNext}>
        {isLast ? "Finish diagnostic ▸" : "Next ▸"}
      </button>
    </div>
  );
}
