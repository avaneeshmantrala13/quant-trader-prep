import { Link } from "react-router-dom";
import type { DashboardTopicEntry } from "@/themes/types";

/**
 * Spaced-review resurfacing (PHASE_5 §5/§6): topics whose SM-2 `reviewDue` has
 * arrived. `topics` is already filtered/sorted by the pure `reviewsDue`. Pure
 * presentational consumer — it links each row via the entry's own `href`.
 */
export function ReviewsDue({ topics }: { topics: DashboardTopicEntry[] }) {
  if (topics.length === 0) {
    return (
      <p className="text-sm text-secondary">
        Nothing due for review — mastered topics resurface here on their SM-2
        schedule.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {topics.map((t) => (
        <li
          key={t.topicKey}
          className="flex items-center justify-between gap-3 border border-accent/50 bg-surface px-3 py-2"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-primary">
              {t.name}
            </div>
            <div className="label text-muted">{t.trackTitle}</div>
          </div>
          <Link
            to={t.href}
            className="btn-secondary !min-h-0 shrink-0 !px-3 !py-1.5 text-xs"
          >
            Review ▸
          </Link>
        </li>
      ))}
    </ul>
  );
}
