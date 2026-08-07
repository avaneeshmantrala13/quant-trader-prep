import type { DashboardTopicEntry } from "@/themes/types";
import { topicSubskill } from "@/lib/dashboard/misconceptionLabels";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Up to two most-frequent specific misconception sentences for a weak topic. */
const MAX_MISCONCEPTIONS = 2;

/**
 * The SPECIFIC, actionable things to fix for a weak topic. `misconceptions` is
 * already ranked by decayed frequency (`topMisconceptions`), so we take the top
 * few. When a topic has no tracked misconception yet we still name its concrete
 * CORE SUB-SKILL — never a bare topic restatement.
 */
function focusLines(t: DashboardTopicEntry): string[] {
  if (t.misconceptions.length > 0) {
    return t.misconceptions.slice(0, MAX_MISCONCEPTIONS).map((m) => m.label);
  }
  return [topicSubskill(t.topicKey, t.name)];
}

/**
 * Weakness ranking (PHASE_5 §5/§6): ordered ascending by CI_low — always shows
 * the credible interval, not just the mean, so "confidently weak" surfaces
 * first, PLUS the specific mistakes to fix (ranked by frequency) so the row is
 * actionable, not just a score. `topics` is already ranked by the pure
 * `rankWeaknesses`. Pure view.
 */
export function WeaknessList({ topics }: { topics: DashboardTopicEntry[] }) {
  if (topics.length === 0) {
    return (
      <p className="text-sm text-secondary">
        No graded evidence yet. Practice a few items (or run the warm-up) to
        rank your weak spots.
      </p>
    );
  }
  return (
    <ol className="divide-y divide-subtle border border-subtle">
      {topics.map((t, i) => (
        <li key={t.topicKey} className="flex flex-col gap-1.5 px-3 py-2.5">
          <div className="flex items-start justify-between gap-3">
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
              <div className="num text-sm text-primary">
                CI_low {pct(t.ciLow)}
              </div>
              <div className="num text-xs text-muted">
                {pct(t.ciLow)}–{pct(t.ciHigh)}
              </div>
            </div>
          </div>
          <ul className="ml-7 flex flex-col gap-1">
            {focusLines(t).map((line, j) => (
              <li
                key={j}
                className="flex items-start gap-1.5 text-xs text-secondary"
              >
                <span aria-hidden="true" className="text-bear">
                  ✗
                </span>
                <span className="min-w-0">{line}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
