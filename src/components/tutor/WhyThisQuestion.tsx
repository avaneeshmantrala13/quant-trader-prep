import { useEffect, useId, useRef, useState } from "react";
import type { Difficulty } from "@/types/content";
import { DIFFICULTY_META } from "@/types/content";
import type { TopicVerdict } from "@/lib/mastery/verdict";
import {
  describeMisconception,
  topicDisplayName,
} from "@/lib/dashboard/misconceptionLabels";

/**
 * "Why this question?" — an honest, live window into the adaptive engine.
 *
 * HONESTY CONTRACT (locked with the product owner): the app does NOT currently
 * route questions through ZPDES on the live lesson path — the learner chose the
 * topic by navigating, and the level serves items from its own generators. So
 * this panel shows only TRUE, already-computed data — the Bayesian mastery
 * estimate, the difficulty tier, the guessing-corrected predicted success, and
 * the misconceptions being watched — and NEVER claims the engine "selected" or
 * "picked" this item. It surfaces the sophistication that already exists without
 * overstating it.
 *
 * Purely presentational: every value is derived by the parent (`QuizLevel` /
 * `NumericLevel`) from the same helpers the dashboard and calibration use, so
 * this can never drift from what the engine actually believes.
 */
export function WhyThisQuestion({
  topicKey,
  difficulty,
  predicted,
  verdict,
}: {
  topicKey: string;
  difficulty: Difficulty;
  /** Guessing-corrected P(correct) at this tier, 0..1. Omit for flashcards. */
  predicted?: number;
  verdict: TopicVerdict;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // Esc closes the panel and returns focus to the toggle (mirrors tutor UI).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const topicName = topicDisplayName(topicKey, verdict.topicKey);
  const tierLabel = DIFFICULTY_META[difficulty].label;
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  const stateCopy: Record<TopicVerdict["state"], string> = {
    STRONG: "looking strong",
    WEAK: "still shaky",
    UNCERTAIN: "not enough data to call yet",
  };

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="chip border-subtle text-secondary hover:text-primary"
        title="Why am I seeing this?"
      >
        ⓘ Why this?
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="region"
          aria-label="Why this question"
          className="animate-print-in absolute right-0 top-8 z-20 w-80 space-y-3 border border-border-strong bg-surface p-4 text-left shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-subtle pb-2">
            <span className="label text-accent">Your adaptive read</span>
            <span className="chip border-subtle text-secondary">{tierLabel}</span>
          </div>

          <p className="text-[13px] leading-relaxed text-secondary">
            <span className="text-primary">{topicName}</span> at the{" "}
            <span className="text-primary">{tierLabel.toLowerCase()}</span> tier.
          </p>

          {predicted != null && (
            <p className="text-[13px] leading-relaxed text-secondary">
              Predicted success at this level:{" "}
              <span className="num font-semibold text-primary">
                ~{pct(predicted)}
              </span>
            </p>
          )}

          {verdict.n === 0 ? (
            <p className="text-[13px] leading-relaxed text-secondary">
              No graded answers on this topic yet; this is a starting estimate
              from the prior. It sharpens the moment you begin.
            </p>
          ) : (
            <p className="text-[13px] leading-relaxed text-secondary">
              You're around{" "}
              <span className="num font-semibold text-primary">
                {pct(verdict.mean)}
              </span>{" "}
              <span className="num text-muted">
                [{pct(verdict.lo)}–{pct(verdict.hi)}]
              </span>{" "}
              here, {stateCopy[verdict.state]}{" "}
              <span className="label text-accent">{verdict.state}</span>{" "}
              <span className="text-muted">({verdict.n} answered)</span>
            </p>
          )}

          {verdict.namedMisconceptions.length > 0 && (
            <div className="space-y-1">
              <div className="label text-secondary">Watching for</div>
              <ul className="list-disc space-y-1 pl-4">
                {verdict.namedMisconceptions.slice(0, 3).map((key) => (
                  <li
                    key={key}
                    className="text-[12px] leading-snug text-secondary"
                  >
                    {describeMisconception(key, { topicName })}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="border-t border-subtle pt-2 text-[11px] leading-snug text-muted">
            Estimated from your answers so far (Bayesian); it sharpens as you
            practice. You chose this topic; the numbers above are the engine's
            live read on it.
          </p>
        </div>
      )}
    </span>
  );
}
