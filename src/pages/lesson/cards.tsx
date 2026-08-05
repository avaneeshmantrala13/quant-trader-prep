import { useMemo, useRef, useState } from "react";
import { HintLadder, type SiblingWorked } from "@/components/tutor/HintLadder";
import { WhyThisQuestion } from "@/components/tutor/WhyThisQuestion";
import { StampSeal } from "@/components/visuals/StampSeal";
import type { TopicVerdict } from "@/lib/mastery/verdict";
import {
  freshPracticeSeed,
  generateFreshQuestion,
  generateFreshNumericQuestion,
} from "@/lib/regenerate";
import { deriveWorkedSteps } from "@/lib/tutor/faded";
import { buildHintLadder } from "@/lib/tutor/hintLadder";
import { resolveQuizTag, resolveNumericTag } from "@/lib/tutor/misconception";
import {
  gradeNumeric,
  gradeFreeResponse,
  numericMatches,
  formatNumericAnswer,
} from "@/lib/numeric";
import type { HintRungReached } from "@/lib/tutor/creditSchedule";
import {
  startEpisode,
  submitAttempt,
  isResolved,
  type HintEpisode,
} from "@/lib/tutor/hintEpisode";
import type {
  Difficulty,
  Level,
  Question,
  NumericQuestion,
} from "@/types/content";

/** Props for the honest "Why this question?" adaptive-read panel (Part A). */
export interface WhyThisQuestionProps {
  topicKey: string;
  difficulty: Difficulty;
  predicted?: number;
  verdict: TopicVerdict;
}

export function QuizCard({
  question,
  number,
  total,
  answered,
  selected,
  isLast,
  onSelect,
  onNext,
  headerLabel,
  nextLabel,
  hintLevel,
  why,
}: {
  question: Question;
  number: number;
  total: number;
  answered: boolean;
  selected: number | null;
  isLast: boolean;
  onSelect: (i: number) => void;
  onNext: () => void;
  /** Overrides the "Question NN / total" header (used for bonus practice). */
  headerLabel?: string;
  /** Overrides the advance-button label (used for bonus practice). */
  nextLabel?: string;
  /**
   * OPTIONAL, additive. When present, renders the honest "Why this question?"
   * adaptive-read panel next to the concept chip. Omitted for bonus practice /
   * remediation cards (where per-item mastery data is not the primary signal).
   */
  why?: WhyThisQuestionProps;
  /**
   * When present, a WRONG answer shows the answer-withholding hint ladder
   * (PHASE_2 §5/§6) instead of the immediate explanation — the level is used to
   * regenerate a same-family worked sibling for rung 3. Purely presentational:
   * this NEVER records mastery (that is `recordItemAttempt` in the players).
   */
  hintLevel?: Level;
}) {
  const isCorrect = answered && selected === question.correctIndex;

  // Build the answer-withholding hint ladder for a WRONG primary/bonus answer.
  const ladder = useMemo(
    () =>
      answered && !isCorrect && selected !== null && hintLevel
        ? buildHintLadder({
            question,
            chosenIndex: selected,
            misconceptionTag: resolveQuizTag(question, selected),
            section: hintLevel.section,
          })
        : null,
    [answered, isCorrect, selected, hintLevel, question],
  );
  // Regenerate a same-family worked sibling for the ladder's rung 3 (completion).
  const sibling = useMemo<SiblingWorked | null>(() => {
    if (!ladder || !hintLevel) return null;
    const sib = generateFreshQuestion(
      hintLevel,
      freshPracticeSeed(),
      question.family,
      question,
      true,
      question,
    );
    if (!sib) return null;
    return {
      prompt: sib.prompt,
      steps: deriveWorkedSteps(sib.explanation).map((s) => s.text),
    };
     
  }, [ladder, hintLevel, question]);

  return (
    <div className="animate-print-in space-y-4">
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label">
            {headerLabel ??
              `Question ${String(number).padStart(2, "0")} / ${total}`}
          </span>
          <span className="flex items-center gap-2">
            {question.concept && (
              <span className="chip border-subtle text-secondary">
                {question.concept}
              </span>
            )}
            {why && <WhyThisQuestion {...why} />}
          </span>
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
                {answered && isAnswer ? "✓" : answered && isChosen ? "✕" : String.fromCharCode(65 + i)}
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
          {/* Trade-ticket header */}
          <div
            className={`flex items-center justify-between px-4 py-2 ${
              isCorrect ? "bg-bull text-bg" : "bg-bear text-bg"
            }`}
          >
            <span className="font-mono text-xs font-semibold uppercase tracking-label">
              {isCorrect ? "● Filled — Correct" : "● Rejected — Incorrect"}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-label opacity-90">
              Trade Ticket
            </span>
          </div>
          <div className="space-y-2 bg-surface p-4">
            {isCorrect ? (
              <p className="text-sm leading-relaxed text-secondary">
                {question.explanation}
              </p>
            ) : ladder ? (
              // Answer-withholding: the ladder holds "your error" (rung 1) through
              // the full worked solution (rung 5), revealed one rung at a time.
              <HintLadder rungs={ladder} siblingWorked={sibling} />
            ) : (
              <>
                {selected !== null &&
                  question.distractorRationale?.[selected] && (
                    <p className="text-sm text-primary">
                      <span className="label text-bear">Your error · </span>
                      {question.distractorRationale[selected]}
                    </p>
                  )}
                <p className="text-sm leading-relaxed text-secondary">
                  {question.explanation}
                </p>
              </>
            )}
            {question.needsVerification && (
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                Hand-authored · flagged for expert verification
              </p>
            )}
            <button onClick={onNext} className="btn-primary mt-2 w-full">
              {nextLabel ?? (isLast ? "Settle & See Results ▸" : "Next Question ▸")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Summary({
  correct,
  total,
  threshold,
  mastered,
  xpGained,
  questions,
  answers,
  onRetry,
  onDone,
}: {
  correct: number;
  total: number;
  threshold: number;
  mastered: boolean;
  xpGained: number;
  questions: Question[];
  answers: (number | null)[];
  onRetry: () => void;
  onDone: () => void;
}) {
  const pct = Math.round((correct / total) * 100);
  return (
    <div className="animate-print-in space-y-5">
      <div className="panel-ruled p-6 text-center">
        <span className="label">Settlement Statement</span>

        <div className="relative mt-4 flex justify-center">
          <StampSeal
            label={mastered ? "Mastered" : "Under Review"}
            sub={mastered ? "Position Settled" : "Not Yet Filled"}
            tone={mastered ? "bull" : "accent"}
          />
          {mastered && (
            <span className="animate-rise-fade num absolute -top-2 right-1/4 text-lg font-semibold text-bull">
              +{xpGained} XP
            </span>
          )}
        </div>

        <div className="mx-auto mt-6 grid max-w-sm grid-cols-3 divide-x divide-subtle border-y border-subtle">
          <div className="px-2 py-3">
            <div className="label text-[9px]">Score</div>
            <div className="num mt-1 text-xl font-semibold text-primary">
              {correct}/{total}
            </div>
          </div>
          <div className="px-2 py-3">
            <div className="label text-[9px]">Accuracy</div>
            <div
              className={`num mt-1 text-xl font-semibold ${mastered ? "text-bull" : "text-primary"}`}
            >
              {pct}%
            </div>
          </div>
          <div className="px-2 py-3">
            <div className="label text-[9px]">Bar</div>
            <div className="num mt-1 text-xl font-semibold text-secondary">
              {Math.round(threshold * 100)}%
            </div>
          </div>
        </div>

        <p className="mt-4 font-mono text-xs uppercase tracking-wider text-muted">
          {mastered
            ? "Next node unlocked on the route."
            : "Review the tickets below, then trade a fresh set."}
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {!mastered && (
            <button onClick={onRetry} className="btn-primary flex-1">
              Re-run (Fresh Questions)
            </button>
          )}
          <button
            onClick={onDone}
            className={mastered ? "btn-primary flex-1" : "btn-secondary flex-1"}
          >
            Back to Route
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="border-b-[3px] border-border-strong px-4 py-2.5">
          <span className="label">Blotter · Review</span>
        </div>
        <ul>
          {questions.map((qq, i) => {
            const ok = answers[i] === qq.correctIndex;
            return (
              <li
                key={qq.id}
                className="flex items-start gap-3 border-b border-subtle p-4 last:border-b-0"
              >
                <span
                  className={`num mt-0.5 grid h-6 w-6 shrink-0 place-items-center text-xs font-semibold ${
                    ok ? "bg-bull text-bg" : "bg-bear text-bg"
                  }`}
                >
                  {ok ? "✓" : "✕"}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-primary">
                    {qq.prompt}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-secondary">
                    Ans · {qq.choices[qq.correctIndex]}
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

export function NumericCard({
  question,
  number,
  total,
  answered,
  entered,
  isLast,
  onSubmit,
  onNext,
  headerLabel,
  nextLabel,
  hintLevel,
  why,
}: {
  question: NumericQuestion;
  number: number;
  total: number;
  answered: boolean;
  entered: number | null;
  isLast: boolean;
  onSubmit: (value: number) => void;
  onNext: () => void;
  /** Overrides the "Question NN / total" header (used for bonus practice). */
  headerLabel?: string;
  /** Overrides the advance-button label (used for bonus practice). */
  nextLabel?: string;
  /** When present, a WRONG answer shows the answer-withholding hint ladder. */
  hintLevel?: Level;
  /** OPTIONAL honest "Why this question?" adaptive-read panel (Part A). */
  why?: WhyThisQuestionProps;
}) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const unit = question.unit ?? "$";
  // Kelly (dollar) levels keep their "stake" framing; other numeric levels
  // (game values, probabilities) get a neutral "Your answer" framing.
  const isMoney = unit === "$";
  const inputLabel = isMoney ? "Your stake" : "Your answer";
  const placeholder = isMoney
    ? "e.g. 300"
    : question.decimals != null
      ? `e.g. ${(0).toFixed(question.decimals)}`
      : "e.g. 5";

  // Grade the (persisted) entered value once answered, so resume shows feedback.
  const grade =
    answered && entered !== null
      ? gradeNumeric(question, String(entered))
      : null;
  const isCorrect = grade?.correct ?? false;

  // Answer-withholding hint ladder for a WRONG numeric answer (PHASE_2 §5/§6).
  const ladder = useMemo(
    () =>
      answered && !isCorrect && entered !== null && hintLevel
        ? buildHintLadder({
            question,
            chosenValue: entered,
            misconceptionTag: resolveNumericTag(question, entered),
            section: hintLevel.section,
          })
        : null,
    [answered, isCorrect, entered, hintLevel, question],
  );
  const sibling = useMemo<SiblingWorked | null>(() => {
    if (!ladder || !hintLevel) return null;
    const sib = generateFreshNumericQuestion(
      hintLevel,
      freshPracticeSeed(),
      question.family,
      question,
      true,
      question,
    );
    if (!sib) return null;
    return {
      prompt: sib.prompt,
      steps: deriveWorkedSteps(sib.explanation).map((s) => s.text),
    };
     
  }, [ladder, hintLevel, question]);

  const handleSubmit = () => {
    if (answered) return;
    const g = gradeNumeric(question, raw);
    if (g.parsed === null) {
      setError(
        isMoney
          ? "Enter a whole-dollar number (digits only, e.g. 300)."
          : "Enter a number (e.g. 2.8).",
      );
      return;
    }
    setError(null);
    onSubmit(g.parsed);
  };

  return (
    <div className="animate-print-in space-y-4">
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label">
            {headerLabel ??
              `Question ${String(number).padStart(2, "0")} / ${total}`}
          </span>
          <span className="flex items-center gap-2">
            {question.concept && (
              <span className="chip border-subtle text-secondary">
                {question.concept}
              </span>
            )}
            {why && <WhyThisQuestion {...why} />}
          </span>
        </div>
        <p className="mt-3 font-display text-xl font-semibold leading-relaxed text-primary">
          {question.prompt}
        </p>
      </div>

      {/* Free-entry numeric input */}
      <div className="panel p-5">
        <label
          htmlFor={`num-${question.id}`}
          className="label text-accent"
        >
          {inputLabel}
        </label>
        <div className="mt-2 flex items-stretch gap-2">
          <div className="flex flex-1 items-center border-2 border-border-strong bg-surface focus-within:border-accent">
            <span className="px-3 font-mono text-lg font-semibold text-secondary">
              {unit}
            </span>
            <input
              id={`num-${question.id}`}
              type="text"
              inputMode={question.decimals != null ? "decimal" : "numeric"}
              autoComplete="off"
              disabled={answered}
              value={answered && entered !== null ? String(entered) : raw}
              onChange={(e) => {
                setRaw(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              placeholder={placeholder}
              aria-label={isMoney ? "Stake in dollars" : "Your numeric answer"}
              aria-invalid={error ? true : undefined}
              className="num min-h-[44px] w-full bg-transparent py-2 pr-3 text-lg font-semibold text-primary outline-none disabled:opacity-70"
            />
          </div>
          {!answered && (
            <button onClick={handleSubmit} className="btn-primary px-5">
              Submit ▸
            </button>
          )}
        </div>
        {error && (
          <p className="mt-2 text-sm text-bear" role="alert">
            {error}
          </p>
        )}
      </div>

      {answered && grade && (
        <div
          role="status"
          aria-live="polite"
          className="animate-print-in border border-subtle"
        >
          <div
            className={`flex items-center justify-between px-4 py-2 ${
              isCorrect ? "bg-bull text-bg" : "bg-bear text-bg"
            }`}
          >
            <span className="font-mono text-xs font-semibold uppercase tracking-label">
              {isCorrect ? "● Filled — Correct" : "● Rejected — Incorrect"}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-label opacity-90">
              Trade Ticket
            </span>
          </div>
          <div className="space-y-2 bg-surface p-4">
            {isCorrect ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">
                {question.explanation}
              </p>
            ) : ladder ? (
              // Answer-withholding: the correct value + worked explanation live
              // inside the ladder's reveal (rung 5), shown only after the rungs.
              <HintLadder rungs={ladder} siblingWorked={sibling} />
            ) : (
              <>
                <p className="text-sm text-primary">
                  <span className="label text-bear">
                    {isMoney ? "Correct stake · " : "Correct answer · "}
                  </span>
                  <span className="num font-semibold">
                    {unit}
                    {formatNumericAnswer(question)}
                  </span>
                  {entered !== null && (
                    <span className="text-secondary">
                      {"  "}(you entered {unit}
                      {entered.toLocaleString("en-US")})
                    </span>
                  )}
                </p>
                {grade.matchedError && (
                  <p className="text-sm text-primary">
                    <span className="label text-bear">Your error · </span>
                    {grade.matchedError.feedback}
                  </p>
                )}
                <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">
                  {question.explanation}
                </p>
              </>
            )}
            {question.needsVerification && (
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                Hand-authored · flagged for expert verification
              </p>
            )}
            <button onClick={onNext} className="btn-primary mt-2 w-full">
              {nextLabel ?? (isLast ? "Settle & See Results ▸" : "Next Question ▸")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * FREE-RESPONSE player card with the PHASE_1 re-attempt hint flow.
 *
 * On a WRONG answer it does NOT reveal — it discloses the 5-rung ladder ONE rung
 * at a time (rung 1 = the detected-misconception coaching sentence from the
 * item's parametric error modes) and lets the learner RE-ATTEMPT the SAME
 * instance. It tracks the highest rung reached and, when the episode resolves
 * (correct at some rung, or still wrong after all 5), calls `onResolve` ONCE with
 * the partial-credit inputs. Answer normalization accepts numbers, fractions,
 * decimals, percentages, and simple expressions (`gradeFreeResponse`).
 *
 * This is the primary-round player; the bonus/remediation paths keep the simpler
 * `NumericCard` (single submit, post-hoc ladder) so their behaviour is unchanged.
 */
export function FreeResponseCard({
  question,
  number,
  total,
  isLast,
  hintLevel,
  onResolve,
  onNext,
  why,
}: {
  question: NumericQuestion;
  number: number;
  total: number;
  isLast: boolean;
  hintLevel: Level;
  onResolve: (r: {
    finalValue: number;
    correct: boolean;
    highestRung: HintRungReached;
    firstWrongValue?: number;
  }) => void;
  onNext: () => void;
  /** OPTIONAL honest "Why this question?" adaptive-read panel (Part A). */
  why?: WhyThisQuestionProps;
}) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [episode, setEpisode] = useState<HintEpisode>(() => startEpisode());
  const [lastWrong, setLastWrong] = useState<number | null>(null);
  const firstWrongRef = useRef<number | undefined>(undefined);
  const resolvedRef = useRef(false);

  const unit = question.unit ?? "$";
  const isMoney = unit === "$";
  const inputLabel = isMoney ? "Your stake" : "Your answer";
  const placeholder = isMoney
    ? "e.g. 300"
    : question.decimals != null
      ? `e.g. ${(0).toFixed(question.decimals)}`
      : "e.g. 5";

  const resolved = isResolved(episode);
  const isCorrect = episode.status === "correct";

  // Ladder rebuilt from the MOST RECENT wrong entry so rung-1 coaching reflects
  // what the learner actually did; rungs 2–5 are family/generic and stable.
  const ladder = useMemo(
    () =>
      lastWrong !== null
        ? buildHintLadder({
            question,
            chosenValue: lastWrong,
            misconceptionTag: resolveNumericTag(question, lastWrong),
            section: hintLevel.section,
          })
        : null,
    [question, lastWrong, hintLevel],
  );
  const hasLadder = ladder !== null;
  const sibling = useMemo<SiblingWorked | null>(() => {
    if (!hasLadder) return null;
    const sib = generateFreshNumericQuestion(
      hintLevel,
      freshPracticeSeed(),
      question.family,
      question,
      true,
      question,
    );
    if (!sib) return null;
    return {
      prompt: sib.prompt,
      steps: deriveWorkedSteps(sib.explanation).map((s) => s.text),
    };
     
  }, [hasLadder, hintLevel, question]);

  const handleSubmit = () => {
    if (resolved) return;
    const g = gradeFreeResponse(question, raw);
    if (g.parsed === null) {
      setError(
        isMoney
          ? "Enter a whole-dollar number (digits only, e.g. 300)."
          : "Enter a number, fraction, or expression (e.g. 2.8 or 1/3).",
      );
      return;
    }
    setError(null);
    const nextEp = submitAttempt(episode, g.correct);
    setEpisode(nextEp);
    if (!g.correct) {
      if (firstWrongRef.current === undefined) firstWrongRef.current = g.parsed;
      setLastWrong(g.parsed);
      setRaw("");
    }
    if (isResolved(nextEp) && !resolvedRef.current) {
      resolvedRef.current = true;
      onResolve({
        finalValue: g.parsed,
        correct: nextEp.status === "correct",
        highestRung: nextEp.highestRung,
        firstWrongValue: firstWrongRef.current,
      });
    }
  };

  const shownValue = resolved
    ? isCorrect
      ? raw || (lastWrong !== null ? String(lastWrong) : "")
      : lastWrong !== null
        ? String(lastWrong)
        : raw
    : raw;

  return (
    <div className="animate-print-in space-y-4">
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b border-subtle pb-2">
          <span className="label">
            {`Question ${String(number).padStart(2, "0")} / ${total}`}
          </span>
          <span className="flex items-center gap-2">
            {question.concept && (
              <span className="chip border-subtle text-secondary">
                {question.concept}
              </span>
            )}
            {why && <WhyThisQuestion {...why} />}
          </span>
        </div>
        <p className="mt-3 font-display text-xl font-semibold leading-relaxed text-primary">
          {question.prompt}
        </p>
      </div>

      {/* Free-response input (stays enabled for re-attempts until resolved). */}
      <div className="panel p-5">
        <label htmlFor={`fr-${question.id}`} className="label text-accent">
          {inputLabel}
        </label>
        <div className="mt-2 flex items-stretch gap-2">
          <div className="flex flex-1 items-center border-2 border-border-strong bg-surface focus-within:border-accent">
            <span className="px-3 font-mono text-lg font-semibold text-secondary">
              {unit}
            </span>
            <input
              id={`fr-${question.id}`}
              type="text"
              inputMode={question.decimals != null ? "decimal" : "numeric"}
              autoComplete="off"
              disabled={resolved}
              value={shownValue}
              onChange={(e) => {
                setRaw(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              placeholder={placeholder}
              aria-label={isMoney ? "Stake in dollars" : "Your numeric answer"}
              aria-invalid={error ? true : undefined}
              className="num min-h-[44px] w-full bg-transparent py-2 pr-3 text-lg font-semibold text-primary outline-none disabled:opacity-70"
            />
          </div>
          {!resolved && (
            <button onClick={handleSubmit} className="btn-primary px-5">
              {episode.revealed > 0 ? "Re-attempt ▸" : "Submit ▸"}
            </button>
          )}
        </div>
        {error && (
          <p className="mt-2 text-sm text-bear" role="alert">
            {error}
          </p>
        )}
        {!resolved && episode.revealed > 0 && (
          <p className="mt-2 text-xs text-muted">
            Not quite — read the coaching below, then re-enter your answer above.
          </p>
        )}
      </div>

      {/* Progressive hint ladder — disclosed one rung per wrong attempt. */}
      {ladder && episode.revealed > 0 && (
        <HintLadder
          rungs={ladder}
          siblingWorked={sibling}
          controlledRevealed={episode.revealed}
        />
      )}

      {resolved && (
        <div
          role="status"
          aria-live="polite"
          className="animate-print-in border border-subtle"
        >
          <div
            className={`flex items-center justify-between px-4 py-2 ${
              isCorrect ? "bg-bull text-bg" : "bg-bear text-bg"
            }`}
          >
            <span className="font-mono text-xs font-semibold uppercase tracking-label">
              {isCorrect
                ? episode.highestRung === 0
                  ? "● Filled — Correct"
                  : `● Filled — Correct after ${episode.highestRung} hint${episode.highestRung > 1 ? "s" : ""}`
                : "● Rejected — Incorrect"}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-label opacity-90">
              Trade Ticket
            </span>
          </div>
          <div className="space-y-2 bg-surface p-4">
            {!isCorrect && (
              <p className="text-sm text-primary">
                <span className="label text-bear">
                  {isMoney ? "Correct stake · " : "Correct answer · "}
                </span>
                <span className="num font-semibold">
                  {unit}
                  {formatNumericAnswer(question)}
                </span>
              </p>
            )}
            <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">
              {question.explanation}
            </p>
            {question.needsVerification && (
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                Hand-authored · flagged for expert verification
              </p>
            )}
            <button onClick={onNext} className="btn-primary mt-2 w-full">
              {isLast ? "Settle & See Results ▸" : "Next Question ▸"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function NumericSummary({
  correct,
  total,
  displayScore,
  threshold,
  mastered,
  xpGained,
  questions,
  answers,
  onRetry,
  onDone,
}: {
  correct: number;
  total: number;
  /** Credit-weighted VISIBLE score in [0,1] — the shown "Mastery %". */
  displayScore: number;
  threshold: number;
  mastered: boolean;
  xpGained: number;
  questions: NumericQuestion[];
  answers: (number | null)[];
  onRetry: () => void;
  onDone: () => void;
}) {
  // The visible percentage is the credit-weighted mastery (partial credit for
  // hint use), NOT the raw fraction correct. The "Score correct/total" column
  // below still shows the honest raw tally.
  const pct = Math.round(displayScore * 100);
  return (
    <div className="animate-print-in space-y-5">
      <div className="panel-ruled p-6 text-center">
        <span className="label">Settlement Statement</span>

        <div className="relative mt-4 flex justify-center">
          <StampSeal
            label={mastered ? "Mastered" : "Under Review"}
            sub={mastered ? "Position Settled" : "Not Yet Filled"}
            tone={mastered ? "bull" : "accent"}
          />
          {mastered && (
            <span className="animate-rise-fade num absolute -top-2 right-1/4 text-lg font-semibold text-bull">
              +{xpGained} XP
            </span>
          )}
        </div>

        <div className="mx-auto mt-6 grid max-w-sm grid-cols-3 divide-x divide-subtle border-y border-subtle">
          <div className="px-2 py-3">
            <div className="label text-[9px]">Score</div>
            <div className="num mt-1 text-xl font-semibold text-primary">
              {correct}/{total}
            </div>
          </div>
          <div className="px-2 py-3">
            <div className="label text-[9px]">Mastery</div>
            <div
              className={`num mt-1 text-xl font-semibold ${mastered ? "text-bull" : "text-primary"}`}
            >
              {pct}%
            </div>
          </div>
          <div className="px-2 py-3">
            <div className="label text-[9px]">Bar</div>
            <div className="num mt-1 text-xl font-semibold text-secondary">
              {Math.round(threshold * 100)}%
            </div>
          </div>
        </div>

        <p className="mt-4 font-mono text-xs uppercase tracking-wider text-muted">
          {mastered
            ? "Next node unlocked on the route."
            : "Review the tickets below, then size a fresh set."}
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          {!mastered && (
            <button onClick={onRetry} className="btn-primary flex-1">
              Re-run (Fresh Questions)
            </button>
          )}
          <button
            onClick={onDone}
            className={mastered ? "btn-primary flex-1" : "btn-secondary flex-1"}
          >
            Back to Route
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="border-b-[3px] border-border-strong px-4 py-2.5">
          <span className="label">Blotter · Review</span>
        </div>
        <ul>
          {questions.map((qq, i) => {
            const ok = answers[i] !== null && numericMatches(qq, answers[i] as number);
            const unit = qq.unit ?? "$";
            return (
              <li
                key={qq.id}
                className="flex items-start gap-3 border-b border-subtle p-4 last:border-b-0"
              >
                <span
                  className={`num mt-0.5 grid h-6 w-6 shrink-0 place-items-center text-xs font-semibold ${
                    ok ? "bg-bull text-bg" : "bg-bear text-bg"
                  }`}
                >
                  {ok ? "✓" : "✕"}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-primary">
                    {qq.prompt}
                  </div>
                  <div className="num mt-0.5 font-mono text-xs text-secondary">
                    Ans · {unit}
                    {formatNumericAnswer(qq)}
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

/* -------------------------------------------------------------------------- */
/*  "Generate another like this" — bonus practice (quiz + numeric).            */
/*                                                                             */
/*  These are EXTRA, un-scored reps produced by re-invoking the level's own    */
/*  parametric generator with a fresh random seed (see `@/lib/regenerate`).    */
/*  They keep their own local state and NEVER touch progress: no recordAttempt,*/
/*  no resume, no mastery/streak/unlock. Grading reuses the exact same solver  */
/*  path as normal questions (quiz `correctIndex`, numeric `gradeNumeric` +    */
/*  `commonErrors`), so feedback/rationale are identical to a real item.       */
/*                                                                             */
/*  When the OPTIONAL LLM flavor layer is enabled (`isAiLayerEnabled()` — OFF  */
/*  by default), an extra "✨ Fresh variant" action appears beside the plain   */
/*  button. It generates the SAME fresh parametric item and then reskins only  */
/*  its prompt via `requestFlavoredVariant`; if the layer is unconfigured or   */
/*  the guardrail rejects the reskin it degrades to the plain parametric item  */
/*  (see `resolveFlavoredItem`). The answer/options/explanation stay the       */
/*  solver's truth, and these items still NEVER touch progress.                */
/* -------------------------------------------------------------------------- */

export function PracticeHeader() {
  return (
    <div className="flex items-center justify-between">
      <span className="label text-accent">Bonus Practice · Not Scored</span>
      <span className="chip border-subtle text-secondary">Same concept</span>
    </div>
  );
}
