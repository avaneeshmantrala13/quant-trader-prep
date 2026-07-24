/**
 * AI "flavor / open-ended" layer configuration, read from Vite build-time env
 * vars (`VITE_*`).
 *
 * This whole layer is OPT-IN and OFF BY DEFAULT. Unless `VITE_AI_LAYER === "on"`
 * the client functions in `aiFlavor.ts` are graceful no-ops (return `null`), no
 * "✨ Fresh variant" button should appear, and NOTHING about the parametric +
 * exact-verifier backbone changes. The app builds & runs 100% local-first with
 * ZERO AI config and NO LLM dependency in the client bundle (the LLM call lives
 * server-side in a Lambda — see `infra/AI_SETUP.md`).
 *
 * Every value below is public / client-safe: it's just an endpoint URL and some
 * feature flags. The LLM provider API KEY NEVER lives here or in the browser
 * bundle — it lives ONLY in SSM Parameter Store, read server-side by the Lambda
 * (mirrors the AWS backend's "no secrets in the client" rule; see `awsConfig.ts`).
 *
 * Style mirrors `awsConfig.ts`: pure `(env) => …` helpers with graceful
 * fallback (return `null`/`false`) so nothing crashes when unconfigured.
 */
import type { EnvLike } from "./awsConfig";

export type { EnvLike };

export interface AiConfig {
  /**
   * Base URL of the AI Lambda endpoint (the HTTP API from
   * `infra/cloudformation/quant-trader-prep-ai.yaml`). The client POSTs to
   * `${endpoint}/ai`. Falls back to `VITE_API_BASE_URL` when a dedicated
   * `VITE_AI_ENDPOINT` isn't set, so a single shared API base also works.
   */
  endpoint: string;
  /** Informational only — which provider the server is configured for. */
  provider?: string;
  /**
   * Local-dev stub: when `VITE_AI_STUB === "on"` the client SKIPS the network
   * entirely and returns the ORIGINAL prompt unchanged (so devs can exercise
   * the UI wiring with no endpoint/key). Never surfaces a wrong answer.
   */
  stub: boolean;
}

function str(v: string | boolean | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * True iff the optional AI layer is switched on. Defaults to `false` so the app
 * builds & runs with ZERO AI config and no button ever appears.
 */
export function aiLayerEnabled(env: EnvLike): boolean {
  return str(env.VITE_AI_LAYER).toLowerCase() === "on";
}

/** True iff the local-dev stub sub-mode is on (returns the prompt unchanged). */
export function aiStubEnabled(env: EnvLike): boolean {
  return str(env.VITE_AI_STUB).toLowerCase() === "on";
}

/**
 * Read + validate the AI config from the env bag. Returns `null` when the layer
 * is off OR when the REQUIRED endpoint is missing (and stub is off), so the
 * caller can safely no-op instead of crashing.
 *
 * Note: stub mode needs no endpoint (it never hits the network), so a config is
 * still returned (with `endpoint: ""`) when `VITE_AI_STUB=on`.
 */
export function readAiConfig(env: EnvLike): AiConfig | null {
  if (!aiLayerEnabled(env)) return null;

  const stub = aiStubEnabled(env);
  // Prefer a dedicated AI endpoint; fall back to the shared API base URL.
  const endpoint = str(env.VITE_AI_ENDPOINT) || str(env.VITE_API_BASE_URL);

  if (!endpoint && !stub) {
    // eslint-disable-next-line no-console
    console.warn(
      "[ai] VITE_AI_LAYER=on but no VITE_AI_ENDPOINT (or VITE_API_BASE_URL) is set. " +
        "AI features are unavailable (falling back to the parametric backbone).",
    );
    return null;
  }

  return {
    endpoint: endpoint.replace(/\/+$/, ""), // trim trailing slashes
    provider: str(env.VITE_AI_PROVIDER) || undefined,
    stub,
  };
}
