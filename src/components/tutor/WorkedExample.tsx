import { useState, type ReactNode } from "react";
import type { DeepDiveView } from "@/lib/tutor/deepDive";
import { hasDeepDive } from "@/lib/tutor/deepDive";
import { DeepDivePanel } from "./DeepDivePanel";

/**
 * Worked-example view (Sweller & Cooper 1985). Replaces the passive prologue for
 * new/low-θ learners: a fully worked same-family instance, studied step by step,
 * before they attempt the round. Thin — the steps/answer are derived upstream
 * (`deriveWorkedSteps` on the item's exact `explanation`).
 *
 * The two footer buttons are now genuinely distinct: the PRIMARY button proceeds
 * into the questions; the SECONDARY button reveals an inline "Explain in more
 * detail" deep-dive of THIS worked example (concept, why it works, full steps,
 * pitfalls) — after which the learner can still proceed. Power users can ignore
 * the deep dive and hit the primary button to skip straight into the questions.
 */
export function WorkedExample({
  concept,
  prompt,
  steps,
  answerLabel,
  answer,
  illustration,
  onContinue,
  continueLabel = "I've studied this: start ▸",
  deepDive,
  detailLabel = "Explain in more detail ▾",
}: {
  concept?: string;
  prompt: string;
  steps: string[];
  answerLabel?: string;
  answer?: string;
  illustration?: ReactNode;
  onContinue: () => void;
  continueLabel?: string;
  /** Composed deeper walk-through; when absent the detail affordance is hidden. */
  deepDive?: DeepDiveView;
  detailLabel?: string;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const canExpand = !!deepDive && hasDeepDive(deepDive);

  return (
    <div className="animate-print-in space-y-5">
      <article className="panel-ruled p-6">
        <div className="flex items-center justify-between">
          <span className="label text-accent">Worked Example</span>
          {concept && (
            <span className="chip border-subtle text-secondary">{concept}</span>
          )}
        </div>
        <p className="mt-3 font-display text-lg font-semibold leading-relaxed text-primary">
          {prompt}
        </p>
        {illustration && <div className="mt-4">{illustration}</div>}

        <div className="mt-4 border-t border-subtle pt-3">
          <span className="label text-secondary">Follow the reasoning</span>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            {steps.map((s, i) => (
              <li key={i} className="text-[15px] leading-relaxed text-secondary">
                {s}
              </li>
            ))}
          </ol>
        </div>

        {answer != null && (
          <div className="mt-4 border-l-2 border-accent bg-surface-muted px-4 py-3">
            <div className="label text-accent">{answerLabel ?? "Answer"}</div>
            <div className="num mt-1 font-display text-base font-semibold text-primary">
              {answer}
            </div>
          </div>
        )}

        {showDetail && deepDive && (
          <div className="mt-5">
            <DeepDivePanel
              view={deepDive}
              onStart={onContinue}
              headingId="worked-deep-dive"
            />
          </div>
        )}
      </article>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={onContinue} className="btn-primary flex-1">
          {continueLabel}
        </button>
        {canExpand && (
          <button
            onClick={() => setShowDetail((v) => !v)}
            aria-expanded={showDetail}
            aria-controls="worked-deep-dive"
            className="btn-secondary flex-1"
          >
            {showDetail ? "Hide the detailed explanation ▴" : detailLabel}
          </button>
        )}
      </div>
    </div>
  );
}
