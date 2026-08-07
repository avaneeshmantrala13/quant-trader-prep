import { AnswerField } from "./AnswerField";
import type { ClarifyState } from "@/lib/mock";
import type { UseMockSpeech } from "./useMockSpeech";

/**
 * The CLARIFY block: when an answer's reasoning pointed both ways (mixed /
 * contradictory / hedged), the interviewer forces a SINGLE committed answer.
 * Strictly graded — hedge or contradict again and it is MISSED. Shared by the
 * math card and the brainteaser card so every reasoning-graded question type
 * gets the same commitment gate.
 */
export function ClarifyBlock({
  clarify,
  value,
  onChange,
  onSubmit,
  speech,
}: {
  clarify: ClarifyState;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  speech: UseMockSpeech;
}) {
  const graded = clarify.graded;
  const cScore = clarify.score;
  return (
    <div className="panel border-l-2 border-accent p-5">
      <div className="flex items-center justify-between border-b border-subtle pb-2">
        <span className="label text-accent">Commit to one answer</span>
        <span className="chip border-accent text-accent">clarify</span>
      </div>
      <p className="mt-3 text-[15px] font-medium leading-relaxed text-primary">
        {clarify.prompt}
      </p>
      {!graded ? (
        <div className="mt-3">
          <AnswerField
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            speech={speech}
            multiline
            inputMode="text"
            placeholder="State your ONE final answer and the single reason it's correct"
            ariaLabel="Your committed clarification"
            submitLabel="Commit ▸"
          />
          <p className="mt-2 text-xs text-muted">
            One shot — I grade whether you commit to the correct answer with a
            clean, non-contradictory reason. Hedge or point both ways again and
            it's marked missed.
          </p>
        </div>
      ) : (
        <div className="mt-3 border border-subtle">
          <div
            className={`px-4 py-2 font-mono text-xs font-semibold uppercase tracking-label ${
              cScore?.correct ? "bg-bull text-bg" : "bg-bear text-bg"
            }`}
          >
            {cScore?.correct ? "● Committed — correct" : "● Still unresolved — missed"}
          </div>
          <div className="bg-surface p-3 text-sm text-secondary">
            {cScore?.correct
              ? "Good — you committed to the right answer with a clean reason."
              : "You still didn't commit to the correct answer cleanly — that's the miss an interviewer pushes on."}
          </div>
        </div>
      )}
    </div>
  );
}
