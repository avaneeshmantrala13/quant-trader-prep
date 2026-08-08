import type { ReasoningGrade, ReasoningQuality } from "@/lib/mock";

/**
 * Presentational panel for a reasoning-quality grade (`mock-reason-grade` or the
 * deterministic fallback). It shows the quality tag and concrete issues only. It
 * deliberately shows NO correctness verdict — the answer's correctness is owned
 * by the deterministic verifier and rendered separately; the LLM only ever judges
 * reasoning quality here. The interviewer's adversarial "probe" is NOT shown here
 * as advisory text (that caused two questions on screen at once); it is instead
 * asked as the first of two sequential, graded follow-ups below the panel.
 */

const QUALITY_META: Record<
  ReasoningQuality,
  { label: string; tone: string; blurb: string }
> = {
  sound: {
    label: "Sound",
    tone: "border-bull text-bull",
    blurb: "Correct, complete, and well-justified.",
  },
  partial: {
    label: "Partial",
    tone: "border-accent text-accent",
    blurb: "Mostly there, but a step or justification is missing.",
  },
  flawed: {
    label: "Flawed",
    tone: "border-bear text-bear",
    blurb:
      "A stated step is false or nonsensical — the answer may be right, but the reasoning is broken.",
  },
  ambiguous: {
    label: "Needs a commit",
    tone: "border-accent text-accent",
    blurb:
      "Mixed / both-sides reasoning — you pointed both ways. Commit to ONE answer below.",
  },
  vague: {
    label: "Vague",
    tone: "border-bear text-bear",
    blurb: "Hand-wavy — asserted without showing the work.",
  },
  absent: {
    label: "No reasoning",
    tone: "border-bear text-bear",
    blurb: "No real reasoning was given.",
  },
};

export function ReasoningPanel({
  grade,
  loading,
}: {
  grade: ReasoningGrade | null;
  loading: boolean;
}) {
  if (loading && !grade) {
    return (
      <div className="aside">
        <div className="label text-accent">Reasoning check</div>
        <p className="mt-1 flex items-center gap-2 text-sm text-secondary" role="status">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          Grading your reasoning…
        </p>
      </div>
    );
  }
  if (!grade) return null;
  const meta = QUALITY_META[grade.quality];

  return (
    <div className="aside">
      <div className="flex items-center justify-between">
        <div className="label text-accent">Reasoning quality</div>
        <span className={`chip ${meta.tone}`}>{meta.label}</span>
      </div>
      <p className="mt-1 text-sm text-secondary">{meta.blurb}</p>
      {grade.issues.length > 0 && (
        <ul className="mt-2 space-y-1.5 text-sm text-secondary">
          {grade.issues.map((issue, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 bg-bear" />
              <span>{issue}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted">
        Reasoning judged by {grade.source === "ai" ? "the interviewer (AI)" : "structural checks"} · never changes whether your answer was correct
      </p>
    </div>
  );
}
