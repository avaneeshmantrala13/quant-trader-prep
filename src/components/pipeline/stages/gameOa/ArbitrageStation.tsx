import { useMemo, useRef, useState } from "react";
import {
  buildArbitrageDrill,
  gradeNumericItem,
  gradeQuizItem,
  type DrillItem,
} from "@/lib/games/arbitrage/engine";
import { formatNumericAnswer } from "@/lib/numeric";
import { tradingSubtopicByGame } from "@/lib/mastery/tradingSubtopics";
import {
  StationProgress,
  useStationFold,
  useStationSeed,
  type StationProps,
} from "./kit";

const SUBTOPIC = tradingSubtopicByGame("arbitrage").key;

export const ARBITRAGE_ROUNDS = 6;
/** Of the six rounds, at least this many are NUMERIC (de-vig / implied prob / arb sizing). */
const NUMERIC_TARGET = 3;

type QuizItem = Extract<DrillItem, { kind: "quiz" }>;
type NumericItem = Extract<DrillItem, { kind: "numeric" }>;

/**
 * Pick the battery's rounds from a seeded drill draw: a balanced interleave of
 * NUMERIC free-entry items (implied-probability / de-vig / arb-sizing — the
 * "compute the fair prob / overround" skill) and QUIZ detection items. The
 * numeric slice is prioritized to include a genuine de-vig (`genDeVigFair`) item
 * so the station scores the numeric de-vig it claims, not just yes/no detection.
 */
function pickRounds(seed: number): DrillItem[] {
  const drawn = buildArbitrageDrill(seed, ARBITRAGE_ROUNDS * 4);
  const numeric = drawn.filter((it): it is NumericItem => it.kind === "numeric");
  const quiz = drawn.filter((it): it is QuizItem => it.kind === "quiz");

  // Prefer a de-vig numeric item first, then the rest of the numeric draw.
  const numericOrdered = [
    ...numeric.filter((it) => it.family === "genDeVigFair"),
    ...numeric.filter((it) => it.family !== "genDeVigFair"),
  ];

  const chosenNumeric = numericOrdered.slice(0, NUMERIC_TARGET);
  const chosenQuiz = quiz.slice(0, ARBITRAGE_ROUNDS - chosenNumeric.length);

  // Interleave numeric/quiz for variety, then top up from whatever remains.
  const rounds: DrillItem[] = [];
  const maxLen = Math.max(chosenNumeric.length, chosenQuiz.length);
  for (let i = 0; i < maxLen; i += 1) {
    if (chosenNumeric[i]) rounds.push(chosenNumeric[i]);
    if (chosenQuiz[i]) rounds.push(chosenQuiz[i]);
  }
  const pool = [...numericOrdered.slice(NUMERIC_TARGET), ...quiz.slice(chosenQuiz.length)];
  for (const it of pool) {
    if (rounds.length >= ARBITRAGE_ROUNDS) break;
    rounds.push(it);
  }
  return rounds.slice(0, ARBITRAGE_ROUNDS);
}

/**
 * Arbitrage & de-vig battery station — reuses `buildArbitrageDrill` and now plays
 * BOTH the numeric items (implied probability / de-vig fair-prob / arb sizing,
 * graded by the exact-rational solver via `gradeNumericItem`) and the quiz
 * detection items (`gradeQuizItem`), folding each into `competency::arbitrage-devig`.
 * Restoring the numeric de-vig items means the station scores the fair-prob /
 * overround computation itself, not merely yes/no Dutch-book detection.
 */
export default function ArbitrageStation({ onComplete, seed }: StationProps) {
  const { record, summary } = useStationFold(SUBTOPIC);
  const mountSeed = useStationSeed(seed);
  const rounds = useMemo<DrillItem[]>(() => pickRounds(mountSeed), [mountSeed]);

  const [index, setIndex] = useState(0);
  const [raw, setRaw] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [reveal, setReveal] = useState<{
    correct: boolean;
    feedback?: string;
  } | null>(null);
  const correctRef = useRef(0);
  const doneRef = useRef(false);

  const item = rounds[index];
  const isLast = index >= rounds.length - 1;

  const submitNumeric = () => {
    if (reveal || !item || item.kind !== "numeric") return;
    const grade = gradeNumericItem(item, raw);
    if (grade.correct) correctRef.current += 1;
    record(grade.correct ? 1 : 0);
    setReveal({ correct: grade.correct, feedback: grade.matchedError?.feedback });
  };

  const chooseQuiz = (i: number) => {
    if (reveal || !item || item.kind !== "quiz") return;
    const { correct } = gradeQuizItem(item, i);
    if (correct) correctRef.current += 1;
    record(correct ? 1 : 0);
    setPicked(i);
    setReveal({ correct });
  };

  const advance = () => {
    if (isLast) {
      if (doneRef.current) return;
      doneRef.current = true;
      onComplete(summary(`${correctRef.current} / ${rounds.length}`));
      return;
    }
    setReveal(null);
    setRaw("");
    setPicked(null);
    setIndex((n) => n + 1);
  };

  if (!item) return null;

  return (
    <div className="space-y-4" data-testid="arbitrage-station">
      <StationProgress
        index={index}
        total={rounds.length}
        correct={correctRef.current}
      />

      <div className="panel-ruled p-5">
        <span className="label text-accent">
          {item.kind === "numeric" ? "Compute" : "Classify"} · {item.family}
        </span>
        <div className="mt-1 font-display text-base font-semibold leading-snug text-primary">
          {item.question.prompt}
        </div>
      </div>

      {item.kind === "numeric" ? (
        reveal === null ? (
          <div className="space-y-3">
            <input
              className="input w-full"
              inputMode="decimal"
              placeholder="e.g. 0.5263, 1/2, 55%"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitNumeric()}
              aria-label="numeric answer"
            />
            <button
              type="button"
              className="btn-primary w-full"
              onClick={submitNumeric}
              disabled={raw.trim() === ""}
            >
              Submit
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className={`verdict ${reveal.correct ? "bg-bull text-bg" : "bg-bear text-bg"}`}
            >
              {reveal.correct ? "● Correct" : "● Not quite"} · answer{" "}
              <span className="num">{formatNumericAnswer(item.question)}</span>
            </div>
            <p className="reveal text-secondary">
              {reveal.feedback ? `${reveal.feedback} ` : ""}
              {item.question.explanation}
            </p>
            <button
              type="button"
              className="btn-primary w-full"
              onClick={advance}
              data-testid="station-advance"
            >
              {isLast ? "Finish game →" : "Next →"}
            </button>
          </div>
        )
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2">
            {item.question.choices.map((opt, i) => {
              const isCorrect = i === item.question.correctIndex;
              const isPicked = i === picked;
              const tone =
                reveal === null
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
                  className={`btn-ghost justify-start border text-left ${tone}`}
                  onClick={() => chooseQuiz(i)}
                  disabled={reveal !== null}
                  aria-label={`option ${i + 1}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {reveal !== null && (
            <div className="space-y-3">
              <p className="reveal text-secondary">{item.question.explanation}</p>
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
      )}
    </div>
  );
}
