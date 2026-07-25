import type { DashboardTopicEntry } from "@/themes/types";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Weakness ranking (PHASE_5 §5/§6): ordered ascending by CI_low — always shows
 * the credible interval, not just the mean, so "confidently weak" surfaces
 * first. `topics` is already ranked by the pure `rankWeaknesses`. Pure view.
 */
export function WeaknessList({ topics }: { topics: DashboardTopicEntry[] }) {
  if (topics.length === 0) {
    return (
      <p className="text-sm text-secondary">
        No graded evidence yet — practice a few items (or run the warm-up) to
        rank your weak spots.
      </p>
    );
  }
  return (
    <ol className="divide-y divide-subtle border border-subtle">
      {topics.map((t, i) => (
        <li
          key={t.topicKey}
          className="flex items-center justify-between gap-3 px-3 py-2"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="num w-5 shrink-0 text-xs text-muted">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-primary">
                {t.name}
              </div>
              <div className="label text-muted">{t.trackTitle}</div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="num text-sm text-primary">CI_low {pct(t.ciLow)}</div>
            <div className="num text-xs text-muted">
              {pct(t.ciLow)}–{pct(t.ciHigh)}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
