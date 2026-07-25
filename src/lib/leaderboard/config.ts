/**
 * leaderboard/config.ts — Speed Arena leaderboard configuration (Phase 6).
 *
 * The server-authoritative leaderboard is OPT-IN and OFF BY DEFAULT (mirrors
 * `aiConfig.ts`). Unless `VITE_LEADERBOARD === "on"` AND an endpoint is set, the
 * client functions in `client.ts` are graceful no-ops (return `null`), the
 * ranked-submission UI is hidden, and the arena shows LOCAL personal-best only.
 * This is exactly the "Phase 6-backup" shippable increment: leave the endpoint
 * unset and the arena is fully functional with local PB.
 *
 * Every value here is public / client-safe (an endpoint URL + a flag). No
 * secrets ever live in the browser bundle — the Lambda reads any server-only
 * config from its own env / SSM (see infra/).
 */
import type { EnvLike } from "@/lib/awsConfig";

export interface LeaderboardConfig {
  /** Base URL of the leaderboard HTTP API; client POSTs to `${endpoint}/leaderboard`. */
  endpoint: string;
}

function str(v: string | boolean | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * True iff the leaderboard layer is switched on. Defaults to `false` so the app
 * builds & runs with ZERO leaderboard config (local PB only).
 */
export function leaderboardEnabled(env: EnvLike): boolean {
  return str(env.VITE_LEADERBOARD).toLowerCase() === "on";
}

/**
 * Read + validate the leaderboard config. Returns `null` when the layer is off
 * OR when the required endpoint is missing, so callers can safely no-op. Prefers
 * a dedicated `VITE_LEADERBOARD_ENDPOINT`, falling back to the shared
 * `VITE_API_BASE_URL` so one API base can serve everything.
 */
export function readLeaderboardConfig(env: EnvLike): LeaderboardConfig | null {
  if (!leaderboardEnabled(env)) return null;
  const endpoint =
    str(env.VITE_LEADERBOARD_ENDPOINT) || str(env.VITE_API_BASE_URL);
  if (!endpoint) {
    // eslint-disable-next-line no-console
    console.warn(
      "[leaderboard] VITE_LEADERBOARD=on but no VITE_LEADERBOARD_ENDPOINT " +
        "(or VITE_API_BASE_URL) is set. Leaderboard disabled (local PB only).",
    );
    return null;
  }
  return { endpoint: endpoint.replace(/\/+$/, "") };
}

/** Board scope the client can request. Default view = friends + league. */
export type BoardScope = "league" | "friends" | "global";

/** A single ranked row (never carries email — only an opt-in display name). */
export interface BoardEntry {
  name: string;
  score: number;
  rank: number;
  /** True for the signed-in user's own row (client-annotated). */
  isSelf?: boolean;
}
