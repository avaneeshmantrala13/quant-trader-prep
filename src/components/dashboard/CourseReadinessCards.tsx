import { Link } from "react-router-dom";
import type { CourseReadiness } from "@/themes/types";

/**
 * Case-A dashboard focus: two course-readiness cards (one per course), each with
 * a progress bar toward completion, the next unmastered topic, and a compact
 * per-topic STRONG / WEAK / UNCERTAIN list. Token-styled so it tracks every
 * theme's colors automatically. Replaces the Case-B weakness ranking + timing.
 */
export function CourseReadinessCards({
  courses,
}: {
  courses: CourseReadiness[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {courses.map((c) => (
        <section key={c.id} className="panel p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-display text-lg font-semibold text-primary">
                {c.label}
              </h3>
              <p className="mt-0.5 text-xs text-muted">{c.blurb}</p>
            </div>
            <span className="num shrink-0 text-2xl font-semibold text-primary">
              {Math.round(c.pct * 100)}%
            </span>
          </div>

          {/* Progress toward course completion. */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="label text-secondary">Course readiness</span>
              <span className="num text-xs text-muted">
                {c.masteredCount}/{c.totalCount} topics
              </span>
            </div>
            <div className="h-2 w-full border border-subtle bg-surface">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${Math.round(c.pct * 100)}%` }}
              />
            </div>
          </div>

          {/* Next up. */}
          {c.nextTopic ? (
            <Link
              to={c.nextTopic.href}
              className="btn-primary mt-3 block w-full text-center text-sm"
            >
              Next: {c.nextTopic.name} ▸
            </Link>
          ) : (
            <p className="mt-3 border border-bull/50 bg-success-soft px-3 py-2 text-sm text-primary">
              Every topic mastered. This course is complete. 🎉
            </p>
          )}

          {/* Compact per-topic verdicts. */}
          <ul className="mt-3 space-y-1">
            {c.topics.map((t) => (
              <li key={t.topicKey}>
                <Link
                  to={t.href}
                  className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-surface-muted"
                >
                  <span className="min-w-0 truncate text-secondary">
                    {t.name}
                    {t.shared && (
                      <span className="label ml-1.5 text-[8px] text-muted">
                        shared
                      </span>
                    )}
                  </span>
                  <VerdictChip
                    verdict={t.verdict}
                    hasEvidence={t.hasEvidence}
                    mastered={t.mastered}
                  />
                </Link>
              </li>
            ))}
          </ul>

          <Link
            to={c.href}
            className="btn-secondary mt-3 block w-full text-center text-sm"
          >
            Open {c.label} ▸
          </Link>
        </section>
      ))}
    </div>
  );
}

function VerdictChip({
  verdict,
  hasEvidence,
  mastered,
}: {
  verdict: string;
  hasEvidence: boolean;
  mastered: boolean;
}) {
  if (!hasEvidence) {
    return <span className="chip border-subtle text-muted">Not started</span>;
  }
  if (mastered) {
    return <span className="chip border-bull text-bull">Mastered</span>;
  }
  const cls =
    verdict === "STRONG"
      ? "border-bull text-bull"
      : verdict === "WEAK"
        ? "border-bear text-bear"
        : "border-accent text-accent";
  const label =
    verdict === "STRONG" ? "Strong" : verdict === "WEAK" ? "Weak" : "Uncertain";
  return <span className={`chip ${cls}`}>{label}</span>;
}
