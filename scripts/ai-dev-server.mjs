#!/usr/bin/env node
/**
 * scripts/ai-dev-server.mjs — LOCAL AI endpoint for `npm run dev`.
 *
 * Serves `POST /ai` implementing the EXACT same contract as the deployed AWS
 * Lambda, because it imports the SAME shared router (`infra/lambda/ai-flavor/
 * core.mjs`). So localhost behavior === prod behavior for every mode: `flavor`,
 * `open-ended`, `hint`, `self-explain`, `parse-drill-intent`, `mock-extract-claims`,
 * `mock-review-reasoning`, `mock-reason-grade`, `mock-clarify-grade`,
 * `mock-followup`, `mock-diagnosis`.
 *
 * SECURITY — the provider key never reaches the browser:
 *   • The key is read from `process.env.AI_PROVIDER_API_KEY` (a NON-`VITE_` var),
 *     loaded from a GITIGNORED `.env.local`. Anything named `VITE_*` is compiled
 *     into the browser bundle by Vite, so the key MUST NOT be a `VITE_` var.
 *   • The key lives only in this Node process; it is never logged or returned.
 *   • The client points `VITE_AI_ENDPOINT` at this server (default
 *     `http://localhost:8788`) and POSTs to `${VITE_AI_ENDPOINT}/ai`.
 *
 * DEV conveniences: no Cognito auth (accepts unauthenticated requests locally),
 * permissive CORS for the Vite origin, and a clear error if the key is missing.
 *
 * Usage:
 *   AI_PROVIDER_API_KEY=sk-... npm run ai:dev
 *   # or put AI_PROVIDER_API_KEY (+ optional AI_PROVIDER_MODEL) in .env.local
 * Optional env: AI_DEV_PORT (default 8788), AI_PROVIDER (openai|anthropic),
 *   AI_PROVIDER_MODEL / AI_MODEL, AI_PROVIDER_BASE_URL / AI_BASE_URL.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildProviderConfig, makeLlmCaller, routeAiRequest } from "../infra/lambda/ai-flavor/core.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");

/* ---- Minimal .env loader (no dependency) --------------------------------- */
// Load KEY=VALUE lines from the given dotenv files into process.env WITHOUT
// overwriting anything already set (so real shell env wins). Supports `#`
// comments, blank lines, `export KEY=...`, and surrounding single/double quotes.
// We deliberately DON'T print any value — secrets never hit the console.
function loadEnvFile(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return; // file absent → nothing to load
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    // Strip a trailing inline comment only when the value is unquoted.
    if (!/^["']/.test(val)) val = val.replace(/\s+#.*$/, "").trim();
    // Unwrap matching surrounding quotes.
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

// `.env.local` first (developer's real values), then `.env` as a base.
loadEnvFile(resolve(REPO_ROOT, ".env.local"));
loadEnvFile(resolve(REPO_ROOT, ".env"));

const PORT = Number(process.env.AI_DEV_PORT || 8788);
const CONFIG = buildProviderConfig(process.env);
const API_KEY = process.env.AI_PROVIDER_API_KEY || "";

/* ---- CORS (permissive for local dev) ------------------------------------- */
function corsHeaders(origin) {
  return {
    "content-type": "application/json",
    // Echo the caller's origin (Vite is 5173/4173) so credentials-less fetch works.
    "access-control-allow-origin": origin || "*",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    vary: "origin",
  };
}

function send(res, status, obj, origin) {
  const bodyStr = JSON.stringify(obj);
  res.writeHead(status, corsHeaders(origin));
  res.end(bodyStr);
}

function readBody(req) {
  return new Promise((resolvePromise) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolvePromise(""));
  });
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  const url = req.url || "/";

  if (req.method === "OPTIONS") return send(res, 200, { ok: true }, origin);

  // Simple health check for humans / scripts.
  if (req.method === "GET" && (url === "/" || url === "/health")) {
    return send(
      res,
      200,
      { ok: true, service: "ai-dev-server", provider: CONFIG.provider, model: CONFIG.model, hasKey: !!API_KEY },
      origin,
    );
  }

  if (req.method !== "POST" || !url.startsWith("/ai")) {
    return send(res, 404, { ok: false, error: "not found (use POST /ai)" }, origin);
  }

  if (!API_KEY) {
    // Clear, actionable error — and a helpful server log (never the key itself).
    console.error(
      "[ai-dev] No AI_PROVIDER_API_KEY set. Add it to .env.local (server-only, " +
        "gitignored) or export it, then restart `npm run ai:dev`.",
    );
    return send(
      res,
      500,
      {
        ok: false,
        error:
          "AI key not configured on the local server. Set AI_PROVIDER_API_KEY in .env.local (server-only) and restart `npm run ai:dev`.",
      },
      origin,
    );
  }

  let body = {};
  try {
    body = JSON.parse((await readBody(req)) || "{}");
  } catch {
    return send(res, 400, { ok: false, error: "bad json" }, origin);
  }

  const callLLM = makeLlmCaller({ key: API_KEY, config: CONFIG });
  const { status, payload } = await routeAiRequest({ body, callLLM });
  return send(res, status, payload, origin);
});

server.listen(PORT, () => {
  const keyState = API_KEY ? "key loaded from env" : "NO KEY — set AI_PROVIDER_API_KEY in .env.local";
  console.log(`\n[ai-dev] Local AI endpoint listening on http://localhost:${PORT}`);
  console.log(`[ai-dev] Provider: ${CONFIG.provider}  Model: ${CONFIG.model}  Base: ${CONFIG.baseUrl}`);
  console.log(`[ai-dev] ${keyState}`);
  console.log(`[ai-dev] Point the client at it:  VITE_AI_LAYER=on  VITE_AI_ENDPOINT=http://localhost:${PORT}`);
  console.log(`[ai-dev] The client POSTs to http://localhost:${PORT}/ai (no auth required locally).\n`);
});
