import { useEffect, useState } from "react";
import { fetchBoard, isLeaderboardEnabled } from "@/lib/leaderboard/client";
import type { BoardEntry, BoardScope } from "@/lib/leaderboard/config";
import { validateDisplayName } from "@/lib/leaderboard/identity";
import type { PersonalBest } from "@/lib/arena/localPb";

/**
 * Leaderboard — thin view. When the leaderboard layer is OFF (the default), it
 * shows LOCAL personal-best only. When ON, it adds league / friends / global
 * tabs (default = league), an opt-in display name, and a global opt-in toggle.
 * Ranking is by opt-in display name — never email.
 */
const SCOPES: BoardScope[] = ["league", "friends", "global"];

export function Leaderboard({
  board,
  configHash,
  pb,
}: {
  board: string;
  configHash: string;
  pb: PersonalBest | null;
}) {
  const enabled = isLeaderboardEnabled();
  const [scope, setScope] = useState<BoardScope>("league");
  const [entries, setEntries] = useState<BoardEntry[] | null>(null);
  const [name, setName] = useState("");
  const [globalOptIn, setGlobalOptIn] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void fetchBoard(board, configHash, scope).then((rows) => {
      if (!cancelled) setEntries(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, board, configHash, scope]);

  const nameCheck = validateDisplayName(name);

  return (
    <div className="panel-ruled space-y-3 p-4">
      <div className="flex items-center justify-between">
        <span className="label">Leaderboard</span>
        {!enabled && (
          <span className="chip border-subtle text-muted">local · for fun</span>
        )}
      </div>

      {/* Local personal best is ALWAYS available. */}
      <div className="flex items-baseline justify-between border-b border-subtle pb-2">
        <span className="text-sm text-secondary">Personal best</span>
        <span className="num text-2xl font-bold text-primary">
          {pb ? pb.bestScore : "—"}
        </span>
      </div>

      {!enabled ? (
        <p className="text-xs text-muted">
          Global leagues are off in this build. Your best is saved locally on
          this device. Set <span className="num">VITE_LEADERBOARD</span> to enable
          server-ranked play.
        </p>
      ) : (
        <>
          <div className="flex gap-1">
            {SCOPES.map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`chip capitalize ${
                  scope === s
                    ? "border-accent text-accent"
                    : "border-subtle text-secondary"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-secondary">
            <input
              type="checkbox"
              checked={globalOptIn}
              onChange={(e) => setGlobalOptIn(e.target.checked)}
            />
            Opt in to the global board
          </label>

          <div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name (3–20 chars)"
              className="w-full border border-subtle bg-surface px-2 py-1 text-sm text-primary focus:border-accent focus:outline-none"
            />
            {name && !nameCheck.ok && (
              <span className="label mt-1 text-[9px] text-bear">
                {nameCheck.reason}
              </span>
            )}
          </div>

          <ol className="space-y-1">
            {(entries ?? []).map((e) => (
              <li
                key={`${e.rank}-${e.name}`}
                className={`flex justify-between text-sm ${
                  e.isSelf ? "text-accent" : "text-secondary"
                }`}
              >
                <span className="num">
                  {e.rank}. {e.name}
                </span>
                <span className="num font-semibold">{e.score}</span>
              </li>
            ))}
            {entries !== null && entries.length === 0 && (
              <li className="text-xs text-muted">
                No entries yet this week — be the first.
              </li>
            )}
          </ol>
        </>
      )}
    </div>
  );
}
