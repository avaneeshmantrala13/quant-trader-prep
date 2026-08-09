/**
 * quant-trader-prep — AI "flavor / open-ended / mock-interview" Lambda.
 *
 * Sits behind its OWN API Gateway HTTP API (see
 * `infra/cloudformation/quant-trader-prep-ai.yaml`) with a Cognito JWT
 * authorizer, so only signed-in users can call it and the API Gateway has
 * already verified the caller before we run.
 *
 * THIN WRAPPER: all prompt building, guardrails, provider calls, and per-mode
 * routing live in `./core.mjs` — the SAME module the LOCAL dev server
 * (`scripts/ai-dev-server.mjs`) imports, so localhost === prod behavior (DRY).
 * This file only adds the AWS-specific envelope:
 *
 *   - reads the LLM provider API KEY from SSM Parameter Store (SecureString) —
 *     the key NEVER lives in the browser bundle, in CloudFormation, or in `core`;
 *   - verifies the caller via the Cognito JWT authorizer (API Gateway) and
 *     enforces an optional per-user DAILY QUOTA via a DynamoDB counter;
 *   - translates the API-Gateway event ⇄ the `{ status, payload }` the router
 *     returns, with CORS headers.
 *
 * Runtime: nodejs20.x — `fetch` is global and the AWS SDK v3 (`@aws-sdk/*`) is
 * bundled in the runtime, so this handler needs NO npm install / packaging. Ship
 * BOTH `index.mjs` AND `core.mjs` in the zip (see `infra/deploy-ai.sh`).
 *
 * Provider: OpenAI-compatible by default (`AI_PROVIDER=openai`), configurable via
 * `AI_BASE_URL` + `AI_MODEL` (also works against an OpenAI-compatible gateway).
 * Set `AI_PROVIDER=anthropic` for Anthropic's native API. See `core.mjs`.
 *
 * Env vars (set by CloudFormation):
 *   AI_PROVIDER  "openai" (default) | "openai-compatible" | "anthropic"
 *   AI_BASE_URL  OpenAI-compatible base URL (default the OpenAI API)
 *   AI_MODEL     model id (default gpt-4o-mini / claude-3-5-haiku)
 *   AI_SSM_PARAM SSM SecureString name holding the API key
 *   AI_DAILY_QUOTA  integer; 0/unset disables the quota check
 *   AI_QUOTA_TABLE  DynamoDB table for the quota counter (optional)
 *   ALLOW_ORIGIN    CORS allow-origin (default "*")
 */
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { buildProviderConfig, makeLlmCaller, routeAiRequest } from "./core.mjs";

const REGION = process.env.AWS_REGION || "us-east-1";
const SSM_PARAM = process.env.AI_SSM_PARAM || "/quant-trader-prep/ai/api-key";
const DAILY_QUOTA = Number(process.env.AI_DAILY_QUOTA || "0");
const QUOTA_TABLE = process.env.AI_QUOTA_TABLE || "";
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "*";

// Provider config is fixed per deployment; the key is fetched at runtime.
const CONFIG = buildProviderConfig(process.env);

const ssm = new SSMClient({ region: REGION });

// Cache the API key across warm invocations (never logged).
let cachedKey = null;
async function getApiKey() {
  if (cachedKey) return cachedKey;
  const out = await ssm.send(
    new GetParameterCommand({ Name: SSM_PARAM, WithDecryption: true }),
  );
  cachedKey = out.Parameter?.Value || null;
  return cachedKey;
}

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

/* ------------------------------- daily quota ------------------------------ */
// Best-effort per-user daily cap. Uses a DynamoDB atomic counter with a
// conditional expression; on ANY error (or when unconfigured) we allow the call
// rather than hard-fail — the hard spend cap is your provider-side budget.
async function checkQuota(sub) {
  if (!DAILY_QUOTA || !QUOTA_TABLE || !sub) return { ok: true };
  try {
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
    const { DynamoDBDocumentClient, UpdateCommand } = await import(
      "@aws-sdk/lib-dynamodb"
    );
    const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
    const day = new Date().toISOString().slice(0, 10);
    const ttl = Math.floor(Date.now() / 1000) + 3 * 24 * 3600; // auto-expire
    await doc.send(
      new UpdateCommand({
        TableName: QUOTA_TABLE,
        Key: { pk: `${sub}#${day}` },
        UpdateExpression: "SET #c = if_not_exists(#c, :z) + :one, #t = :ttl",
        ConditionExpression: "attribute_not_exists(#c) OR #c < :limit",
        ExpressionAttributeNames: { "#c": "count", "#t": "ttl" },
        ExpressionAttributeValues: {
          ":z": 0,
          ":one": 1,
          ":limit": DAILY_QUOTA,
          ":ttl": ttl,
        },
      }),
    );
    return { ok: true };
  } catch (e) {
    if (e?.name === "ConditionalCheckFailedException") {
      return { ok: false, reason: "quota" };
    }
    return { ok: true }; // fail-open on infra errors
  }
}

/* --------------------------------- handler -------------------------------- */
export const handler = async (event) => {
  const method =
    event?.requestContext?.http?.method || event?.httpMethod || "POST";
  if (method === "OPTIONS") return reply(200, { ok: true });

  let body = {};
  try {
    body = JSON.parse(event?.body || "{}");
  } catch {
    return reply(400, { ok: false, error: "bad json" });
  }

  const sub = event?.requestContext?.authorizer?.jwt?.claims?.sub || null;

  const quota = await checkQuota(sub);
  if (!quota.ok) {
    return reply(429, { ok: false, error: "daily AI quota reached" });
  }

  let key;
  try {
    key = await getApiKey();
  } catch (e) {
    console.warn("SSM getParameter failed:", e?.message);
    return reply(500, { ok: false, error: "AI key not configured" });
  }
  if (!key) return reply(500, { ok: false, error: "AI key not configured" });

  const callLLM = makeLlmCaller({ key, config: CONFIG });
  const { status, payload } = await routeAiRequest({ body, callLLM });
  return reply(status, payload);
};
