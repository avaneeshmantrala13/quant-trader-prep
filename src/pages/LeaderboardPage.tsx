/**
 * LEADERBOARD (`/leaderboard`) — the unified, self-contained rankings hub for
 * the competitive games (Make-a-Market, Cards, Probability Betting, Fruit
 * Market, Dice & Cards, Next Card Betting, Trading Floor, Speed Arena).
 *
 * LOCAL-FIRST: it reads each game's ranked scores from the dependency-free
 * `localBoard` store, so it is fully functional OFFLINE with zero config. When
 * the optional server leaderboard is configured (`VITE_LEADERBOARD=on` + an
 * endpoint), it MERGES the shared "league" rows on top via the graceful
 * `fetchBoard` client (which returns `null` when unconfigured — no crash, no
 * network). It never crashes on an empty board (honest empty state), matching
 * the full-screen visual conventions of the other game pages.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { ChevronLeftIcon, BoltIcon } from "@/components/icons";
import {
  LEADERBOARD_GAMES,
  LEADERBOARD_GAME_BY_ID,
} from "@/lib/leaderboard/games";
import {
  browserBoardStore,
  compareScores,
  readLocalScores,
  type LocalScore,
} from "@/lib/leaderboard/localBoard";
import { fetchBoard, isLeaderboardEnabled } from "@/lib/leaderboard/client";
import type { BoardEntry } from "@/lib/leaderboard/config";
import { BoardTable, type BoardRow } from "@/components/leaderboard/BoardTable";

/**
 * Merge local scores with optional server rows into a single re-ranked list.
 * Local rows carry their `atMs` (earlier breaks ties); server rows have no
 * timestamp, so they sort AFTER an equal-scoring local run (atMs = Infinity).
 */
function mergeRows(
  local: LocalScore[],
  server: BoardEntry[] | null,
): BoardRow[] {
  const localRows = local.map((s) => ({
    score: s.score,
    atMs: s.atMs,
    name: s.name ?? "You",
    self: true,
    source: "local" as const,
    meta: s.meta,
  }));
  const serverRows = (server ?? []).map((e) => ({
    score: e.score,
    atMs: Number.POSITIVE_INFINITY,
    name: e.name,
    self: e.isSelf === true,
    source: "server" as const,
    meta: undefined,
  }));
  return [...localRows, ...serverRows]
    .sort((a, b) => compareScores(a, b))
    .map((r, i) => ({
      rank: i + 1,
      name: r.name,
      score: r.score,
      self: r.self,
      source: r.source,
      meta: r.meta,
    }));
}

export function LeaderboardPage() {
  const navigate = useNavigate();
  const [gameId, setGameId] = useState<string>(LEADERBOARD_GAMES[0].id);
  const [serverRows, setServerRows] = useState<BoardEntry[] | null>(null);
  const enabled = isLeaderboardEnabled();

  const game = LEADERBOARD_GAME_BY_ID[gameId] ?? LEADERBOARD_GAMES[0];

  // Local scores are read synchronously from storage (re-read when the game
  // changes; a mount is enough since scores only change on a finished run).
  const localScores = useMemo(
    () => readLocalScores(browserBoardStore(), gameId),
    [gameId],
  );

  // Optional server merge — a graceful no-op when the layer is off.
  useEffect(() => {
    setServerRows(null);
    if (!enabled) return;
    let cancelled = false;
    void fetchBoard(gameId, "v1", "global").then((rows) => {
      if (!cancelled) setServerRows(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, gameId]);

  const rows = useMemo(
    () => mergeRows(localScores, serverRows),
    [localScores, serverRows],
  );

  return (
    <div className="relative min-h-[100dvh]">
      <ThemeBackground />

      <header className="sticky top-0 z-20 border-b-[3px] border-border-strong bg-surface">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-2.5">
          <button
            onClick={() => navigate("/games")}
            className="btn-ghost !min-h-0 !px-2 !py-1.5"
            aria-label="Back to games"
          >
            <ChevronLeftIcon width={18} height={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-semibold text-primary">
              Leaderboard
            </div>
          </div>
          <span
            className={`chip ${enabled ? "border-accent text-accent" : "border-subtle text-muted"}`}
            title={
              enabled
                ? "Server leagues are enabled: league rows merge on top."
                : "Local rankings on this device (server leagues are off in this build)."
            }
          >
            {enabled ? "league" : "local · for fun"}
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-4 py-6">
        <div className="animate-print-in space-y-5">
          <header>
            <h1 className="font-display text-3xl font-black text-primary">
              Rankings
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-secondary">
              Every competitive game keeps a ranked board of your best runs on
              this device. Higher scores rank first; ties go to whoever got there
              first. Play a game to put a score on the board.
            </p>
          </header>

          {/* Game picker */}
          <nav
            aria-label="Choose a game board"
            className="flex flex-wrap gap-2"
          >
            {LEADERBOARD_GAMES.map((g) => {
              const active = g.id === gameId;
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setGameId(g.id)}
                  className={`chip ${
                    active
                      ? "border-accent bg-accent text-accent-contrast"
                      : "border-subtle text-secondary hover:border-accent hover:text-primary"
                  }`}
                >
                  {g.title}
                </button>
              );
            })}
          </nav>

          {/* Selected board */}
          <article className="panel-ruled p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-accent">
                  <BoltIcon width={16} height={16} />
                  <span className="label text-accent">{game.title}</span>
                </div>
                <p className="mt-1 text-sm text-secondary">{game.scoreLabel}</p>
                <p className="label mt-1 !normal-case tracking-normal text-muted">
                  {game.ranking}
                </p>
              </div>
              <Link to={game.to} className="btn-secondary !min-h-0 shrink-0 !px-3 !py-1.5 text-sm">
                Play →
              </Link>
            </div>

            <div className="mt-4 border-t border-subtle pt-2">
              <BoardTable
                rows={rows}
                scoreUnit={game.scoreUnit}
                emptyHint={`No ${game.title} scores yet on this device. Play a run to set the first.`}
              />
            </div>
          </article>

          {!enabled && (
            <p className="text-xs text-muted">
              Global leagues are off in this build; rankings are saved locally
              on this device. Set <span className="num">VITE_LEADERBOARD=on</span>{" "}
              with an endpoint to merge server-ranked play.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
