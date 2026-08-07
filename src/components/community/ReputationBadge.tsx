import { reputationTier } from "@/lib/community/aggregate";

/**
 * ReputationBadge — a small-caps karma chip with a tier label (Newcomer →
 * Legend). Presentational only: pass a karma total (compute it with
 * `karmaFor`/`computeReputation`). Tier accents follow the editorial theme
 * tokens so it themes automatically.
 */
const TIER_CLS: Record<string, string> = {
  newcomer: "border-subtle text-muted",
  contributor: "border-subtle text-secondary",
  trusted: "border-accent text-accent",
  expert: "border-bull text-bull",
  legend: "border-bull text-bull",
};

export function ReputationBadge({
  handle,
  karma,
  showHandle = false,
}: {
  handle?: string;
  karma: number;
  /** When true, prefixes the badge with the (public) handle. */
  showHandle?: boolean;
}) {
  const tier = reputationTier(karma);
  return (
    <span
      className={`chip ${TIER_CLS[tier.id] ?? "border-subtle text-secondary"}`}
      title={`${tier.label}: ${karma} karma`}
      aria-label={`${handle ? `${handle}: ` : ""}${tier.label}, ${karma} karma`}
    >
      {showHandle && handle && <span className="normal-case">{handle}</span>}
      <span aria-hidden="true">{tier.label}</span>
      <span className="num font-semibold" aria-hidden="true">
        {karma}
      </span>
    </span>
  );
}
