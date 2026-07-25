import { useState } from "react";
import type { SelfExplainMCQ } from "@/lib/tutor/selfExplain";

/**
 * Thin view for a self-explanation MCQ (Chi et al. 1989/1994). The learner picks
 * the reasoning that justifies the step; grading is deterministic against the
 * stored `correctIndex` (no LLM). Used to grade a faded blank as a
 * self-explanation prompt.
 */
export function SelfExplainPrompt({
  mcq,
  onGraded,
}: {
  mcq: SelfExplainMCQ;
  onGraded?: (correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;

  const choose = (i: number) => {
    if (answered) return;
    setPicked(i);
    onGraded?.(i === mcq.correctIndex);
  };

  return (
    <div className="panel p-4">
      <div className="label text-accent">Self-explain</div>
      <p className="mt-1 text-sm font-medium text-primary">{mcq.prompt}</p>
      <div className="mt-3 border border-subtle">
        {mcq.options.map((opt, i) => {
          const isChosen = picked === i;
          const isAnswer = i === mcq.correctIndex;
          let cls =
            "flex w-full items-start gap-3 border-b border-subtle p-3 text-left text-sm last:border-b-0 min-h-[44px] ";
          if (!answered) cls += "bg-surface hover:bg-surface-muted";
          else if (isAnswer) cls += "bg-success-soft";
          else if (isChosen) cls += "bg-danger-soft";
          else cls += "bg-surface opacity-55";
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={answered}
              className={cls}
            >
              <span className="num mt-0.5 shrink-0 text-xs text-muted">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="text-primary">{opt}</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <p
          className={`mt-2 text-sm ${picked === mcq.correctIndex ? "text-bull" : "text-bear"}`}
        >
          {picked === mcq.correctIndex
            ? "That's the reasoning that actually justifies it."
            : "Not quite — re-read the highlighted reasoning above."}
        </p>
      )}
    </div>
  );
}
