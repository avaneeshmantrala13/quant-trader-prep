/**
 * leaderboard/client.ts — the thin fetch client for the server-authoritative
 * Speed Arena leaderboard (Phase 6).
 *
 * Mirrors `aiFlavor.ts`: everything is a GRACEFUL NO-OP when the layer is off /
 * unconfigured (returns `null`, never throws), so the arena is fully functional
 * with the leaderboard OFF (local personal-best only). When on, the client
 * requests a server seed for a ranked run, submits ONLY its answers (the server
 * re-scores authoritatively — see `rescore.ts`), and reads the top-N board.
 *
 * Auth: reads the Cognito ID token from the well-known localStorage locations
 * `awsStorage` writes (we do NOT import storage internals — owned by another
 * workstream) and sends it as the `authorization` header, exactly like the AI
 * client. No AWS SDK in the bundle — plain `fetch`.
 */
import type { EnvLike } from "@/lib/awsConfig";
import { readAwsConfig } from "@/lib/awsConfig";
import {
  readLeaderboardConfig,
  leaderboardEnabled,
  type BoardEntry,
  type BoardScope,
  type LeaderboardConfig,
} from "./config";

/** A ranked submission — answers only; the server re-scores from (seed,config). */
export interface RankedSubmission {
  board: "zetamac" | "optiver";
  configHash: string;
  seed: number;
  answers: { id: string; value: number | null; rtMs: number }[];
  clientElapsedMs: number;
}

/** Server verdict for a ranked submission. */
export interface RankedResult {
  ok: boolean;
  bestScore?: number;
  rank?: number;
}

/** The seed + issue timestamp the server hands out for a ranked run. */
export interface RankedSeed {
  seed: number;
  issuedAtMs: number;
}

function env(): EnvLike {
  return import.meta.env as unknown as EnvLike;
}

/** True iff the leaderboard layer is switched on (ranked UI may appear). */
export function isLeaderboardEnabled(): boolean {
  return leaderboardEnabled(env());
}

/**
 * Best-effort read of the current Cognito ID token (same keys `awsStorage.ts`
 * writes). Returns `null` when unauthenticated. Kept local — no storage import.
 */
function readCognitoIdToken(e: EnvLike): string | null {
  if (typeof localStorage === "undefined") return null;
  const get = (k: string): string | null => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const oauthTok = get("qtp.aws.oauth.idToken");
  const oauthExp = Number(get("qtp.aws.oauth.exp") ?? "0");
  if (oauthTok && oauthExp > Date.now()) return oauthTok;

  const cfg = readAwsConfig(e);
  const clientId = cfg?.userPoolClientId;
  if (!clientId) return null;
  const last = get(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`);
  if (!last) return null;
  return get(`CognitoIdentityServiceProvider.${clientId}.${last}.idToken`);
}

async function postBoard(
  cfg: LeaderboardConfig,
  e: EnvLike,
  path: string,
  body: unknown,
): Promise<Record<string, unknown> | null> {
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    const token = readCognitoIdToken(e);
    if (token) headers["authorization"] = token;
    const res = await fetch(`${cfg.endpoint}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[leaderboard] endpoint returned ${res.status}; ignoring.`);
      return null;
    }
    return (await res.json()) as Record<string, unknown>;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[leaderboard] request failed; ignoring:", err);
    return null;
  }
}

/**
 * Request a server-issued seed for a ranked run. Returns `null` when the layer
 * is off/unconfigured (the caller then plays a casual, local-only run).
 */
export async function requestRankedSeed(
  board: "zetamac" | "optiver",
  configHash: string,
): Promise<RankedSeed | null> {
  const e = env();
  const cfg = readLeaderboardConfig(e);
  if (!cfg) return null;
  const payload = await postBoard(cfg, e, "/leaderboard/seed", {
    board,
    configHash,
  });
  if (!payload || typeof payload["seed"] !== "number") return null;
  return {
    seed: payload["seed"] as number,
    issuedAtMs:
      typeof payload["issuedAtMs"] === "number"
        ? (payload["issuedAtMs"] as number)
        : Date.now(),
  };
}

/**
 * Submit a ranked run. The server re-scores from `(seed, config, answers)` and
 * returns the authoritative best score + rank. Returns `null` (graceful no-op)
 * when the layer is off/unconfigured or on any error.
 */
export async function submitRankedRun(
  s: RankedSubmission,
): Promise<RankedResult | null> {
  const e = env();
  const cfg = readLeaderboardConfig(e);
  if (!cfg) return null;
  const payload = await postBoard(cfg, e, "/leaderboard/submit", s);
  if (!payload) return null;
  return {
    ok: payload["ok"] === true,
    bestScore:
      typeof payload["bestScore"] === "number"
        ? (payload["bestScore"] as number)
        : undefined,
    rank:
      typeof payload["rank"] === "number"
        ? (payload["rank"] as number)
        : undefined,
  };
}

/**
 * Fetch a board (leagues / friends / global) for a config. Returns `null` when
 * the layer is off/unconfigured or on any error (the UI then shows local PB).
 */
export async function fetchBoard(
  board: string,
  configHash: string,
  scope: BoardScope,
): Promise<BoardEntry[] | null> {
  const e = env();
  const cfg = readLeaderboardConfig(e);
  if (!cfg) return null;
  const payload = await postBoard(cfg, e, "/leaderboard/board", {
    board,
    configHash,
    scope,
  });
  if (!payload || !Array.isArray(payload["entries"])) return null;
  return (payload["entries"] as unknown[])
    .map((raw): BoardEntry | null => {
      if (typeof raw !== "object" || raw === null) return null;
      const r = raw as Record<string, unknown>;
      if (typeof r["name"] !== "string" || typeof r["score"] !== "number") {
        return null;
      }
      return {
        name: r["name"] as string,
        score: r["score"] as number,
        rank: typeof r["rank"] === "number" ? (r["rank"] as number) : 0,
        isSelf: r["isSelf"] === true,
      };
    })
    .filter((x): x is BoardEntry => x !== null);
}
