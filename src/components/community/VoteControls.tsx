import type { QualityTally, TargetKind } from "@/lib/community/types";

/**
 * VoteControls — an accessible up/down quality voter with a net-score readout.
 * Presentational + controlled: the parent passes the current `tally` and the
 * viewer's own `myVote` (+1 / −1 / 0), and gets an `onVote(value)` callback
 * where `value` is the NEW state (clicking your current vote again clears it →
 * 0). No store access here.
 */
export function VoteControls({
  targetKind,
  targetId,
  tally,
  myVote = 0,
  onVote,
  disabled = false,
}: {
  targetKind: TargetKind;
  targetId: string;
  tally: QualityTally;
  myVote?: -1 | 0 | 1;
  onVote?: (value: -1 | 0 | 1) => void;
  disabled?: boolean;
}) {
  const cast = (dir: -1 | 1) => {
    if (disabled || !onVote) return;
    onVote(myVote === dir ? 0 : dir);
  };

  const scoreCls =
    tally.score > 0 ? "text-bull" : tally.score < 0 ? "text-bear" : "text-secondary";

  return (
    <div
      className="inline-flex items-center gap-1"
      role="group"
      aria-label={`Quality vote for ${targetKind} ${targetId}`}
    >
      <button
        type="button"
        onClick={() => cast(1)}
        disabled={disabled}
        aria-pressed={myVote === 1}
        aria-label="Upvote"
        className={`chip px-1.5 ${
          myVote === 1 ? "border-bull text-bull" : "border-subtle text-muted hover:text-primary"
        } disabled:opacity-50`}
      >
        <span aria-hidden="true">▲</span>
      </button>
      <span
        className={`num min-w-[2ch] text-center text-sm font-semibold ${scoreCls}`}
        aria-label={`Net score ${tally.score}, ${tally.up} up, ${tally.down} down`}
      >
        {tally.score}
      </span>
      <button
        type="button"
        onClick={() => cast(-1)}
        disabled={disabled}
        aria-pressed={myVote === -1}
        aria-label="Downvote"
        className={`chip px-1.5 ${
          myVote === -1 ? "border-bear text-bear" : "border-subtle text-muted hover:text-primary"
        } disabled:opacity-50`}
      >
        <span aria-hidden="true">▼</span>
      </button>
    </div>
  );
}
