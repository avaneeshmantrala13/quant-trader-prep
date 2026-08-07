import { rankReports, tallyQuality } from "@/lib/community/aggregate";
import type {
  ExperienceReport,
  InterviewOutcome,
  Vote,
} from "@/lib/community/types";
import { ReputationBadge } from "./ReputationBadge";
import { VoteControls } from "./VoteControls";

/**
 * ExperienceReportList — a ranked, themed list of interview EXPERIENCE REPORTS
 * for an item. Presentational: it ranks with the pure `rankReports` and shows
 * each report's quality vote controls, self-reported outcome, tags, and (when a
 * karma map is supplied) the author's reputation badge. Voting is delegated
 * upward via `onVote`.
 */
const OUTCOME: Record<InterviewOutcome, { label: string; cls: string }> = {
  offer: { label: "Offer", cls: "border-bull text-bull" },
  no_offer: { label: "No offer", cls: "border-bear text-bear" },
  pending: { label: "Pending", cls: "border-accent text-accent" },
  withdrew: { label: "Withdrew", cls: "border-subtle text-muted" },
};

export function ExperienceReportList({
  reports,
  votes,
  karmaByHandle,
  myVotes,
  onVote,
  onFlag,
  flaggedIds,
}: {
  reports: ExperienceReport[];
  votes: Vote[];
  /** Optional handle → karma map to render author reputation badges. */
  karmaByHandle?: Record<string, number>;
  /** Optional reportId → viewer's current vote (+1/−1/0). */
  myVotes?: Record<string, -1 | 0 | 1>;
  onVote?: (reportId: string, value: -1 | 0 | 1) => void;
  /** Optional report/flag hook — renders a "Report" affordance per report. */
  onFlag?: (reportId: string) => void;
  /** Report ids the viewer has already flagged this session (for UI feedback). */
  flaggedIds?: ReadonlySet<string>;
}) {
  const ranked = rankReports(reports, votes);

  if (ranked.length === 0) {
    return (
      <p className="label text-muted">
        No experience reports yet. Share how your interview went.
      </p>
    );
  }

  return (
    <ul className="space-y-3" aria-label="Interview experience reports">
      {ranked.map((r) => {
        const tally = tallyQuality(votes, "report", r.id);
        const outcome = r.outcome ? OUTCOME[r.outcome] : null;
        return (
          <li key={r.id} className="panel-ruled space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-primary">{r.title}</h3>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-secondary">
                  <span className="num">{r.authorHandle}</span>
                  {karmaByHandle && (
                    <ReputationBadge
                      handle={r.authorHandle}
                      karma={karmaByHandle[r.authorHandle] ?? 0}
                    />
                  )}
                  {(r.company || r.role) && (
                    <span className="text-muted">
                      {[r.role, r.company].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  {outcome && (
                    <span className={`chip ${outcome.cls}`}>{outcome.label}</span>
                  )}
                </div>
              </div>
              <VoteControls
                targetKind="report"
                targetId={r.id}
                tally={tally}
                myVote={myVotes?.[r.id] ?? 0}
                onVote={onVote ? (v) => onVote(r.id, v) : undefined}
              />
            </div>
            <p className="whitespace-pre-line text-sm text-secondary">{r.body}</p>
            <div className="flex flex-wrap items-center gap-2">
              {r.tags.map((t) => (
                <span key={t} className="chip border-subtle text-muted">
                  {t}
                </span>
              ))}
              {onFlag &&
                (flaggedIds?.has(r.id) ? (
                  <span className="label text-muted" aria-live="polite">
                    Reported for review
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onFlag(r.id)}
                    className="label text-muted hover:text-bear"
                    aria-label={`Report ${r.title}`}
                  >
                    Report
                  </button>
                ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
