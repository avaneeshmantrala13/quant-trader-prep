import { Link } from "react-router-dom";
import { MASTERY_BAR } from "@/lib/mastery/config";
import type { DashboardTopicEntry } from "@/themes/types";
import { MasteryBadge } from "./MasteryBadge";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Per-topic card (PHASE_5 §6): mean ± 95% CI bar with the 0.80 mastery bar
 * marked, the STRONG/WEAK/UNCERTAIN badge, θ, FRIENDLY misconception chips
 * (human-readable concept descriptions — never raw keys), and a review-due flag.
 * A pure presentational consumer of a display-ready `DashboardTopicEntry`.
 */
export function TopicCard({ topic }: { topic: DashboardTopicEntry }) {
  const hasEvidence = topic.hasEvidence;

  return (
    <article className="panel flex flex-col gap-3 p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="label text-muted">{topic.trackTitle}</div>
          <h3 className="truncate font-display text-base font-semibold text-primary">
            {topic.name}
          </h3>
        </div>
        <MasteryBadge state={topic.verdict} />
      </header>

      {/* Mean ± 95% CI bar with the 0.80 mastery bar marked. */}
      <div>
        <div className="flex items-baseline justify-between">
          <span className="label text-secondary">Mastery</span>
          <span className="num text-sm text-primary">
            {hasEvidence ? pct(topic.mean) : "—"}
            {hasEvidence && (
              <span className="ml-1 text-xs text-muted">
                (95% CI {pct(topic.ciLow)}–{pct(topic.ciHigh)})
              </span>
            )}
          </span>
        </div>
        <div className="relative mt-1.5 h-2.5 w-full border border-subtle bg-surface-muted">
          {hasEvidence && (
            <div
              className="absolute top-0 h-full bg-accent/40"
              style={{
                left: `${topic.ciLow * 100}%`,
                width: `${Math.max(topic.ciHigh - topic.ciLow, 0) * 100}%`,
              }}
              aria-hidden="true"
            />
          )}
          {hasEvidence && (
            <div
              className="absolute top-[-2px] h-[calc(100%+4px)] w-0.5 bg-primary"
              style={{ left: `${topic.mean * 100}%` }}
              title={`mean ${pct(topic.mean)}`}
              aria-hidden="true"
            />
          )}
          {/* 0.80 mastery bar */}
          <div
            className="absolute top-[-3px] h-[calc(100%+6px)] w-px bg-border-strong"
            style={{ left: `${MASTERY_BAR * 100}%` }}
            title={`mastery bar ${pct(MASTERY_BAR)}`}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="chip border-subtle text-secondary" title="Elo skill (logit)">
          θ {topic.theta.toFixed(2)}
        </span>
        <span className="chip border-subtle text-muted">
          {topic.gradedCount} graded
        </span>
        {topic.reviewDue && (
          <span className="chip border-accent text-accent">Review due</span>
        )}
      </div>

      {topic.misconceptions.length > 0 && (
        <div>
          <div className="label text-bear">Where you struggle</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {topic.misconceptions.map((m) => (
              <span key={m.key} className="chip border-bear/60 text-bear">
                {m.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <Link to={topic.href} className="btn-ghost mt-auto w-full text-center text-sm">
        Practice this ▸
      </Link>
    </article>
  );
}
