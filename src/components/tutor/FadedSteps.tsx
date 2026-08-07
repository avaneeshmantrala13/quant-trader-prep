import { useState, type ReactNode } from "react";
import type { FadedStage } from "@/lib/tutor/faded";
import type { SelfExplainMCQ } from "@/lib/tutor/selfExplain";
import type { DeepDiveView } from "@/lib/tutor/deepDive";
import { hasDeepDive } from "@/lib/tutor/deepDive";
import { SelfExplainPrompt } from "./SelfExplainPrompt";
import { DeepDivePanel } from "./DeepDivePanel";

/**
 * Faded / completion view (Renkl & Atkinson 2003). The transition between
 * studying and solving: a same-family instance with the misconception-critical
 * step BLANKED as a self-explanation prompt. Thin — the stage + MCQ are computed
 * upstream (`buildFadedStages`, `buildSelfExplainMCQ`).
 *
 * The two footer buttons are now genuinely distinct: the PRIMARY button proceeds
 * into the questions; the SECONDARY button reveals an inline "Explain in more
 * detail" deep-dive of the underlying worked example — after which the learner
 * can still proceed straight into the round.
 */
export function FadedSteps({
  concept,
  prompt,
  stage,
  selfExplain,
  illustration,
  onContinue,
  continueLabel = "Ready: start practice ▸",
  deepDive,
  detailLabel = "Explain in more detail ▾",
}: {
  concept?: string;
  prompt: string;
  stage: FadedStage;
  selfExplain?: SelfExplainMCQ | null;
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
          <span className="label text-accent">Fill in the missing step</span>
          {concept && (
            <span className="chip border-subtle text-secondary">{concept}</span>
          )}
        </div>
        <p className="mt-3 font-display text-lg font-semibold leading-relaxed text-primary">
          {prompt}
        </p>
        {illustration && <div className="mt-4">{illustration}</div>}

        <ol className="mt-4 list-decimal space-y-2 pl-5">
          {stage.steps.map((s, i) =>
            s.blanked ? (
              <li key={i} className="text-[15px] leading-relaxed">
                <span className="inline-block min-w-[8rem] border-b-2 border-dashed border-accent align-bottom text-transparent">
                  ______
                </span>
                <span className="ml-2 text-xs italic text-muted">
                  (your step: explain the reasoning)
                </span>
              </li>
            ) : (
              <li key={i} className="text-[15px] leading-relaxed text-secondary">
                {s.text}
              </li>
            ),
          )}
        </ol>
      </article>

      {selfExplain && <SelfExplainPrompt mcq={selfExplain} />}

      {showDetail && deepDive && (
        <DeepDivePanel
          view={deepDive}
          onStart={onContinue}
          headingId="faded-deep-dive"
        />
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={onContinue} className="btn-primary flex-1">
          {continueLabel}
        </button>
        {canExpand && (
          <button
            onClick={() => setShowDetail((v) => !v)}
            aria-expanded={showDetail}
            aria-controls="faded-deep-dive"
            className="btn-secondary flex-1"
          >
            {showDetail ? "Hide the detailed explanation ▴" : detailLabel}
          </button>
        )}
      </div>
    </div>
  );
}
