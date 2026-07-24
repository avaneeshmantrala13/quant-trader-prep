/**
 * quant-trader-prep — AI "flavor / open-ended" Lambda.
 *
 * Sits behind its OWN API Gateway HTTP API (see
 * `infra/cloudformation/quant-trader-prep-ai.yaml`) with a Cognito JWT
 * authorizer, so only signed-in users can call it and the API Gateway has
 * already verified the caller before we run. This handler:
 *
 *   - reads the LLM provider API KEY from SSM Parameter Store (SecureString) —
 *     the key NEVER lives in the browser bundle or in CloudFormation;
 *   - FLAVOR mode: asks the LLM to reskin ONLY the narrative of a
 *     parametrically-generated question, then re-runs the numeric GUARDRAIL
 *     server-side (defense in depth — the client runs the authoritative check
 *     too) and refuses if the math changed;
 *   - OPEN-ENDED mode: asks the LLM for a brand-new question and returns it as
 *     an explicitly-unverified flashcard (never graded as truth);
 *   - (optional) enforces a per-user DAILY QUOTA via a DynamoDB counter to cap
 *     spend, degrading gracefully to "no quota" when the table isn't configured.
 *
 * Runtime: nodejs20.x — `fetch` is global and the AWS SDK v3 (`@aws-sdk/*`) is
 * bundled in the runtime, so this file needs NO npm install / packaging.
 *
 * Provider: OpenAI-compatible by default (`AI_PROVIDER=openai`). The OpenAI
 * branch talks to ANY OpenAI-compatible `/chat/completions` endpoint via a
 * configurable base URL (`AI_BASE_URL`) + model (`AI_MODEL`) + `Bearer` key, so
 * it works unchanged against a raw OpenAI key OR an OpenAI-compatible LLM gateway
 * such as the TrueFoundry AI Gateway (`AI_BASE_URL=https://gateway.truefoundry.ai`,
 * `AI_MODEL=provider_account/model_name`, and a TrueFoundry PAT/VAT in SSM). Set
 * `AI_PROVIDER=anthropic` to use Anthropic's native API instead — both branches
 * are implemented below.
 *
 * Env vars (set by the CloudFormation template):
 *   AI_PROVIDER        "openai" (default) | "openai-compatible" | "anthropic"
 *   AI_BASE_URL        OpenAI-compatible base URL (default the OpenAI API);
 *                      e.g. https://gateway.truefoundry.ai for TrueFoundry SaaS
 *   AI_MODEL           model id (default gpt-4o-mini / claude-3-5-haiku); for
 *                      TrueFoundry use the `provider_account/model_name` form
 *   AI_SSM_PARAM       SSM SecureString name holding the API key (a provider key
 *                      for raw OpenAI/Anthropic, or a TrueFoundry PAT/VAT)
 *   AI_DAILY_QUOTA     integer; 0/unset disables the quota check
 *   AI_QUOTA_TABLE     DynamoDB table for the quota counter (optional)
 *   ALLOW_ORIGIN       CORS allow-origin (default "*")
 */
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const REGION = process.env.AWS_REGION || "us-east-1";
const PROVIDER = (process.env.AI_PROVIDER || "openai").toLowerCase();
const MODEL =
  process.env.AI_MODEL ||
  (PROVIDER === "anthropic" ? "claude-3-5-haiku-latest" : "gpt-4o-mini");
// OpenAI-compatible base URL. Defaults to the raw OpenAI API so nothing changes
// for a plain-OpenAI user. Point it at any OpenAI-compatible gateway (e.g.
// TrueFoundry SaaS `https://gateway.truefoundry.ai`) to use that instead.
const BASE_URL = process.env.AI_BASE_URL || "https://api.openai.com/v1";
const SSM_PARAM = process.env.AI_SSM_PARAM || "/quant-trader-prep/ai/api-key";
const DAILY_QUOTA = Number(process.env.AI_DAILY_QUOTA || "0");
const QUOTA_TABLE = process.env.AI_QUOTA_TABLE || "";
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "*";

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

/* ----------------------------- numeric guardrail -------------------------- */
// Mirror of the client's `extractNumbers` / `verifyFlavor` (defense in depth).
function extractNumbers(text) {
  const out = [];
  const re = /\$?\s?(\d[\d,]*(?:\.\d+)?)\s?%?/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(n)) out.push(String(n));
  }
  return out;
}
function verifyFlavor(original, candidate, requiredNumbers) {
  if (!candidate || !candidate.trim()) return { ok: false, reason: "empty" };
  const required = new Set(
    requiredNumbers && requiredNumbers.length
      ? requiredNumbers.map(String)
      : extractNumbers(original),
  );
  const cand = new Set(extractNumbers(candidate));
  for (const n of required) if (!cand.has(n)) return { ok: false, reason: "missing" };
  for (const n of cand) if (!required.has(n)) return { ok: false, reason: "introduced" };
  return { ok: true };
}

/* --------------------------------- prompts -------------------------------- */
function flavorMessages(body) {
  const sys =
    "You reskin quantitative-finance practice questions. You are given a question. " +
    "Rewrite ONLY the surface narrative/scenario (make it a vivid quant/trading story). " +
    "You MUST keep EVERY number, quantity, and answer choice EXACTLY as given — do not add, " +
    "remove, round, or change any number. Do not solve the question. Do not add new numbers " +
    "(no times, dates, prices, or counts that weren't already present). Keep the same question " +
    "being asked. Reply with ONLY the rewritten question text, no preamble.";
  const nums = (body.requiredNumbers || []).join(", ");
  const user =
    `Question:\n${body.prompt}\n\n` +
    (body.concept ? `Concept: ${body.concept}\n` : "") +
    (nums ? `Numbers that MUST appear unchanged: ${nums}\n` : "") +
    (body.choices ? `Answer choices (do not alter): ${JSON.stringify(body.choices)}\n` : "") +
    "\nRewrite the narrative now:";
  return { sys, user };
}
function openEndedMessages(body) {
  const sys =
    "You are a quant-interview question writer. Propose ONE original practice question for the " +
    "given topic. Keep the math self-contained and unambiguous. Respond as strict JSON with keys " +
    '"prompt" (the question), "answer" (the concise final answer), and "explanation" (the full ' +
    "worked reasoning). No markdown, no extra keys.";
  const user = `Topic: ${body.topic}\nReturn the JSON now:`;
  return { sys, user };
}

/* -------------------------------- providers ------------------------------- */
// Join an OpenAI-compatible base URL with the chat-completions path, robustly:
//   - trims trailing slashes on the base;
//   - if the base already ends in `/chat/completions`, uses it as-is;
//   - otherwise appends `/chat/completions`.
// So `https://api.openai.com/v1` → `.../v1/chat/completions` (raw OpenAI) and
// `https://gateway.truefoundry.ai` → `.../chat/completions` (TrueFoundry SaaS),
// with no double `/v1` for operators who set the full base themselves.
export function chatCompletionsUrl(base) {
  const b = String(base || "").trim().replace(/\/+$/, "");
  return /\/chat\/completions$/.test(b) ? b : `${b}/chat/completions`;
}

async function callOpenAI(key, sys, user, wantJson) {
  const res = await fetch(chatCompletionsUrl(BASE_URL), {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.9,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      ...(wantJson ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content?.trim() || "";
}
async function callAnthropic(key, sys, user) {
  // To switch providers set AI_PROVIDER=anthropic (+ store an Anthropic key).
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0.9,
      system: sys,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return (j.content?.[0]?.text || "").trim();
}
async function callLLM(key, sys, user, wantJson) {
  if (PROVIDER === "anthropic") return callAnthropic(key, sys, user);
  return callOpenAI(key, sys, user, wantJson);
}

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

  const sub =
    event?.requestContext?.authorizer?.jwt?.claims?.sub || null;

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

  try {
    if (body.mode === "open-ended") {
      const { sys, user } = openEndedMessages(body);
      const text = await callLLM(key, sys, user, true);
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        return reply(502, { ok: false, error: "model returned non-JSON" });
      }
      return reply(200, {
        ok: true,
        prompt: parsed.prompt || "",
        answer: parsed.answer || "",
        explanation: parsed.explanation || "",
        verified: false,
      });
    }

    // Default: flavor mode.
    const { sys, user } = flavorMessages(body);
    const candidate = await callLLM(key, sys, user, false);
    const check = verifyFlavor(body.prompt || "", candidate, body.requiredNumbers);
    if (!check.ok) {
      // Server-side guardrail failed — tell the client to fall back.
      return reply(200, { ok: false, error: `guardrail:${check.reason}` });
    }
    return reply(200, { ok: true, prompt: candidate });
  } catch (e) {
    console.warn("LLM call failed:", e?.message);
    return reply(502, { ok: false, error: "LLM call failed" });
  }
};
