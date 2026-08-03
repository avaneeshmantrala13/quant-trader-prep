import type { ItemAggregate } from "@/lib/community/types";

/**
 * SocialProofCounts — a compact strip of social-proof chips derived from an
 * `ItemAggregate` (produce it with `summarizeItem` / `getItemAggregate`): how
 * many reports, solutions, comments, and distinct contributors an item has,
 * plus a difficulty readout and a "verified solution" marker. Purely
 * presentational. Renders a quiet "Be the first" prompt when the item is empty
 * so an offline / cold-start item still looks intentional.
 */
function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1" title={label}>
      <span className="num text-sm font-semibold text-primary">{value}</span>
      <span className="label">{label}</span>
    </span>
  );
}

export function SocialProofCounts({ agg }: { agg: ItemAggregate }) {
  const empty =
    agg.reportCount === 0 && agg.solutionCount === 0 && agg.commentCount === 0;

  if (empty) {
    return (
      <p className="label text-muted" aria-live="polite">
        No community activity yet — be the first to share.
      </p>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1"
      aria-label="Community activity"
    >
      <Stat value={agg.reportCount} label="reports" />
      <Stat value={agg.solutionCount} label="solutions" />
      <Stat value={agg.commentCount} label="comments" />
      <Stat value={agg.contributorCount} label="contributors" />
      {agg.difficulty.average !== null && (
        <Stat
          value={`${agg.difficulty.average.toFixed(1)}/5`}
          label="difficulty"
        />
      )}
      {agg.verifiedSolutionId && (
        <span className="chip border-bull text-bull" title="Has a verified solution">
          <span aria-hidden="true">✓</span> verified
        </span>
      )}
    </div>
  );
}
