/**
 * quant-trader-prep — Speed Arena LEADERBOARD Lambda (Phase 6).
 *
 * Server-authoritative: the client sends ONLY its answers for a ranked run; the
 * server regenerates the exact question stream from `(seed, preset)`, re-scores
 * with the SHARED logic in `scoring.mjs` (a line-for-line twin of the client's
 * TypeScript), applies plausibility caps + a per-user hourly rate limit, and
 * writes a bounded top-N shard. Never trusts a client-reported score.
 *
 * Sits behind its OWN API Gateway HTTP API (see
 * `infra/cloudformation/quant-trader-prep-leaderboard.yaml`) with a Cognito JWT
 * authorizer pointed at the EXISTING User Pool. Runtime nodejs20.x → `fetch` is
 * global and the AWS SDK v3 is bundled, so no packaging beyond these two .mjs
 * files.
 *
 * DynamoDB single table (provisioned 25 WCU / 25 RCU, NO GSIs):
 *   PB     : PK=USER#<sub>  SK=PB#<board>#<cfg>              {bestScore,bestRunAt,displayName,attempts}
 *   Week   : PK=USER#<sub>  SK=WEEK#<isoWeek>#<board>#<cfg>  {weekBestScore,leagueId,displayName,updatedAt}
 *   Rate   : PK=RATE#<sub>#<hour>  SK=RL                     {count, ttl}
 *   Top-N  : PK=LB#<board>#<cfg>#<isoWeek>#<leagueId>  SK=TOPN  {entries:[{name,score}], version}
 *
 * All writes are tiny; reads are a single GetItem. A ranked submit is ~3–4 tiny
 * writes. At app scale this is ≪ 25 WCU and ≪ the 1M free Lambda reqs/mo ⇒ ~$0.
 */
import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  arenaQuestionStream,
  rescore,
  isoWeekKey,
  validateDisplayName,
} from "./scoring.mjs";

const REGION = process.env.AWS_REGION || "us-east-1";
const TABLE = process.env.LEADERBOARD_TABLE || "";
const TOPN = Number(process.env.TOPN || "40");
const LEAGUE_COUNT = Math.max(1, Number(process.env.LEAGUE_COUNT || "20"));
const RANKED_PER_HOUR = Number(process.env.RANKED_PER_HOUR || "60");
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "*";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const CORS = {
  "content-type": "application/json",
  "access-control-allow-origin": ALLOW_ORIGIN,
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const reply = (statusCode, obj) => ({
  statusCode,
  headers: CORS,
  body: JSON.stringify(obj),
});

/** Stable, non-crypto hash → a league bucket + a per-run seed helper. */
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function leagueFor(sub) {
  return `L${hashStr(sub) % LEAGUE_COUNT}`;
}

/** Per-user hourly rate limit (fail-open on infra error). */
async function rateOk(sub) {
  if (!RANKED_PER_HOUR || !sub) return true;
  const hour = new Date().toISOString().slice(0, 13); // yyyy-mm-ddThh
  const ttl = Math.floor(Date.now() / 1000) + 2 * 3600;
  try {
    await doc.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `RATE#${sub}#${hour}`, SK: "RL" },
        UpdateExpression:
          "SET #c = if_not_exists(#c, :z) + :one, #t = :ttl",
        ConditionExpression: "attribute_not_exists(#c) OR #c < :limit",
        ExpressionAttributeNames: { "#c": "count", "#t": "ttl" },
        ExpressionAttributeValues: {
          ":z": 0,
          ":one": 1,
          ":limit": RANKED_PER_HOUR,
          ":ttl": ttl,
        },
      }),
    );
    return true;
  } catch (e) {
    if (e?.name === "ConditionalCheckFailedException") return false;
    return true; // fail-open on infra errors
  }
}

/** Read-modify-write the bounded top-N shard with an optimistic version guard. */
async function upsertShard(pk, name, score) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const cur = await doc.send(
      new GetCommand({ TableName: TABLE, Key: { PK: pk, SK: "TOPN" } }),
    );
    const item = cur.Item || { PK: pk, SK: "TOPN", entries: [], version: 0 };
    const entries = Array.isArray(item.entries) ? item.entries.slice() : [];
    const existing = entries.find((e) => e.name === name);
    if (existing) {
      if (score > existing.score) existing.score = score;
    } else {
      entries.push({ name, score });
    }
    entries.sort((a, b) => b.score - a.score);
    const trimmed = entries.slice(0, TOPN);
    const nextVersion = (item.version || 0) + 1;
    try {
      await doc.send(
        new PutCommand({
          TableName: TABLE,
          Item: { PK: pk, SK: "TOPN", entries: trimmed, version: nextVersion },
          ConditionExpression:
            "attribute_not_exists(version) OR version = :v",
          ExpressionAttributeValues: { ":v": item.version || 0 },
        }),
      );
      const rank = trimmed.findIndex((e) => e.name === name);
      return { entries: trimmed, rank: rank >= 0 ? rank + 1 : undefined };
    } catch (e) {
      if (e?.name !== "ConditionalCheckFailedException") throw e;
      // lost the race — retry the read-modify-write
    }
  }
  return { entries: [], rank: undefined };
}

async function readShard(pk) {
  const cur = await doc.send(
    new GetCommand({ TableName: TABLE, Key: { PK: pk, SK: "TOPN" } }),
  );
  const entries = cur.Item && Array.isArray(cur.Item.entries)
    ? cur.Item.entries
    : [];
  return entries.map((e, i) => ({ name: e.name, score: e.score, rank: i + 1 }));
}

/* --------------------------------- routes --------------------------------- */

async function handleSeed() {
  // A ranked run gets a fresh pseudo-random seed + issue timestamp. The seed
  // only selects questions; score legitimacy is enforced by re-scoring +
  // plausibility caps at submit time.
  const seed = Math.floor(Math.random() * 2 ** 31) >>> 0;
  return reply(200, { ok: true, seed, issuedAtMs: Date.now() });
}

async function handleSubmit(body, sub, claims) {
  if (!(await rateOk(sub))) {
    return reply(429, { ok: false, error: "ranked rate limit reached" });
  }
  const preset = body.preset;
  if (!preset || typeof body.seed !== "number" || !Array.isArray(body.answers)) {
    return reply(400, { ok: false, error: "bad submission" });
  }
  // Sanity: the stream must be non-empty for the given preset.
  const stream = arenaQuestionStream(body.seed, preset);
  if (stream.length === 0) return reply(400, { ok: false, error: "empty stream" });

  const result = rescore({
    board: body.board,
    seed: body.seed,
    preset,
    answers: body.answers,
    clientElapsedMs: Number(body.clientElapsedMs) || 0,
  });
  if (!result.ok) {
    return reply(200, { ok: false, error: `rejected:${result.reason}` });
  }

  // Display name: opt-in, validated, never email. Fall back to a cognito
  // username claim (also not email); reject if nothing valid is available.
  const proposed = body.displayName ?? claims?.["cognito:username"] ?? "";
  const nameCheck = validateDisplayName(proposed);
  if (!nameCheck.ok) {
    return reply(200, {
      ok: true,
      bestScore: result.score,
      rank: undefined,
      note: `not ranked: display name ${nameCheck.reason}`,
    });
  }
  const name = nameCheck.value;
  const cfg = body.configHash || "default";
  const week = isoWeekKey(Date.now());
  const nowIso = new Date().toISOString();

  // PB — conditional put only when the new score beats the stored best.
  try {
    await doc.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `USER#${sub}`, SK: `PB#${body.board}#${cfg}` },
        UpdateExpression:
          "SET bestScore = :s, bestRunAt = :t, displayName = :n ADD attempts :one",
        ConditionExpression:
          "attribute_not_exists(bestScore) OR bestScore < :s",
        ExpressionAttributeValues: {
          ":s": result.score,
          ":t": nowIso,
          ":n": name,
          ":one": 1,
        },
      }),
    );
  } catch (e) {
    if (e?.name !== "ConditionalCheckFailedException") {
      console.warn("PB update failed:", e?.message);
    }
    // Not a new PB (or benign) — still bump the attempt counter.
    try {
      await doc.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { PK: `USER#${sub}`, SK: `PB#${body.board}#${cfg}` },
          UpdateExpression: "ADD attempts :one",
          ExpressionAttributeValues: { ":one": 1 },
        }),
      );
    } catch {
      /* ignore */
    }
  }

  const leagueId = leagueFor(sub);

  // Week best — keep the max for this ISO week.
  try {
    await doc.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: {
          PK: `USER#${sub}`,
          SK: `WEEK#${week}#${body.board}#${cfg}`,
        },
        UpdateExpression:
          "SET weekBestScore = :s, leagueId = :l, displayName = :n, updatedAt = :t",
        ConditionExpression:
          "attribute_not_exists(weekBestScore) OR weekBestScore < :s",
        ExpressionAttributeValues: {
          ":s": result.score,
          ":l": leagueId,
          ":n": name,
          ":t": nowIso,
        },
      }),
    );
  } catch (e) {
    if (e?.name !== "ConditionalCheckFailedException") {
      console.warn("Week update failed:", e?.message);
    }
  }

  // Top-N shard for this league (and the GLOBAL shard when opted in).
  let rank;
  try {
    const leaguePk = `LB#${body.board}#${cfg}#${week}#${leagueId}`;
    const res = await upsertShard(leaguePk, name, result.score);
    rank = res.rank;
    if (body.globalOptIn === true) {
      await upsertShard(`LB#${body.board}#${cfg}#${week}#GLOBAL`, name, result.score);
    }
  } catch (e) {
    console.warn("Shard update failed:", e?.message);
  }

  return reply(200, { ok: true, bestScore: result.score, rank });
}

async function handleBoard(body, sub) {
  const cfg = body.configHash || "default";
  const week = isoWeekKey(Date.now());
  const scope = body.scope || "league";
  const leagueId = scope === "global" ? "GLOBAL" : leagueFor(sub);
  // "friends" has no server-side friend graph yet — fall back to the league
  // board (a small, comparable cohort). A friend-graph is a documented
  // follow-up; see PHASE_6.md deviations.
  const pk = `LB#${body.board}#${cfg}#${week}#${leagueId}`;
  const entries = await readShard(pk);
  return reply(200, { ok: true, entries });
}

/* --------------------------------- handler -------------------------------- */

export const handler = async (event) => {
  const method =
    event?.requestContext?.http?.method || event?.httpMethod || "POST";
  if (method === "OPTIONS") return reply(200, { ok: true });

  const path =
    event?.requestContext?.http?.path || event?.rawPath || "/leaderboard";

  let body = {};
  try {
    body = JSON.parse(event?.body || "{}");
  } catch {
    return reply(400, { ok: false, error: "bad json" });
  }

  const claims = event?.requestContext?.authorizer?.jwt?.claims || null;
  const sub = claims?.sub || null;
  if (!sub) return reply(401, { ok: false, error: "unauthenticated" });
  if (!TABLE) return reply(500, { ok: false, error: "table not configured" });

  try {
    if (path.endsWith("/seed")) return await handleSeed();
    if (path.endsWith("/board")) return await handleBoard(body, sub);
    if (path.endsWith("/submit")) return await handleSubmit(body, sub, claims);
    // Default: treat as submit for a single-route deployment.
    return await handleSubmit(body, sub, claims);
  } catch (e) {
    console.warn("leaderboard handler error:", e?.message);
    return reply(500, { ok: false, error: "internal error" });
  }
};
