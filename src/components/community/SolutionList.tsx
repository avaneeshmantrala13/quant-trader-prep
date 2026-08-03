import {
  isVerified,
  rankSolutions,
  tallyQuality,
} from "@/lib/community/aggregate";
import type {
  SubmittedSolution,
  VerificationFlag,
  Vote,
} from "@/lib/community/types";
import { VoteControls } from "./VoteControls";

/**
 * SolutionList — user-SUBMITTED SOLUTIONS for an item, ranked best-first by the
 * pure `rankSolutions` (verified → quality → recency). The canonical verified
 * solution is pinned at the top with a "verified" badge. Presentational: voting
 * is delegated via `onVote`. Works with zero backend (empty arrays render an
 * empty state).
 */
export function SolutionList({
  solutions,
  votes,
  verifications,
  myVotes,
  onVote,
}: {
  solutions: SubmittedSolution[];
  votes: Vote[];
  verifications: VerificationFlag[];
  myVotes?: Record<string, -1 | 0 | 1>;
  onVote?: (solutionId: string, value: -1 | 0 | 1) => void;
}) {
  const ranked = rankSolutions(solutions, votes, verifications);

  if (ranked.length === 0) {
    return (
      <p className="label text-muted">
        No solutions submitted yet — add yours.
      </p>
    );
  }

  return (
    <ul className="space-y-3" aria-label="Submitted solutions">
      {ranked.map((s) => {
        const verified = isVerified(s.id, verifications);
        const tally = tallyQuality(votes, "solution", s.id);
        return (
          <li
            key={s.id}
            className={`space-y-2 p-4 ${
              verified ? "panel-ruled border-bull" : "panel"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
                <span className="num">{s.authorHandle}</span>
                {s.language && (
                  <span className="chip border-subtle text-muted">{s.language}</span>
                )}
                {verified && (
                  <span
                    className="chip border-bull text-bull"
                    title="Verified solution"
                  >
                    <span aria-hidden="true">✓</span> verified
                  </span>
                )}
              </div>
              <VoteControls
                targetKind="solution"
                targetId={s.id}
                tally={tally}
                myVote={myVotes?.[s.id] ?? 0}
                onVote={onVote ? (v) => onVote(s.id, v) : undefined}
              />
            </div>
            <pre className="num overflow-x-auto whitespace-pre-wrap text-sm text-primary">
              {s.body}
            </pre>
          </li>
        );
      })}
    </ul>
  );
}
