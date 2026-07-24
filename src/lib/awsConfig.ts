/**
 * AWS backend configuration, read from Vite build-time env vars (`VITE_*`).
 *
 * The whole AWS backend is OPT-IN: unless `VITE_STORAGE_BACKEND === "aws"` the
 * app runs 100% local-first (see `storage.ts`) and none of these values are
 * required. Every value below is public/client-safe (Cognito pool ids, an
 * identity-pool id, a DynamoDB table name, an API URL). No secrets ever live in
 * the client — server-only secrets go in SSM Parameter Store / Lambda env
 * (see `infra/`), never here (PRD §14 C5).
 */

export interface AwsConfig {
  region: string;
  userPoolId: string;
  userPoolClientId: string;
  /** Cognito Identity Pool id — mints scoped temp AWS creds for DynamoDB. */
  identityPoolId: string;
  /** DynamoDB table holding one owner-scoped progress item per user. */
  progressTable: string;
  /** Cognito Hosted-UI domain (for the Google federated sign-in redirect). */
  cognitoDomain?: string;
  /** OAuth redirect URI registered on the app client (Google sign-in). */
  redirectUri?: string;
  /**
   * True iff Google federated sign-in is actually configured in this
   * deployment. Gated by `VITE_GOOGLE_AUTH` (default OFF) AND the presence of
   * the Hosted-UI domain + redirect URI. When false the app hides the "Continue
   * with Google" button entirely so users never hit the Hosted UI's broken
   * "Login option is not available" screen (a Cognito domain always exists even
   * when no Google IdP is set up — so the domain alone is NOT a valid signal).
   */
  googleEnabled: boolean;
  /** API Gateway base URL for privileged / server-only writes (optional). */
  apiBaseUrl?: string;
}

/** Minimal shape of the env bag we read from (mirrors `import.meta.env`). */
export type EnvLike = Record<string, string | boolean | undefined>;

function str(v: string | boolean | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Parse an on/off feature flag from the env bag. Defaults to `false`, and only
 * the explicit truthy values `on` / `true` / `1` / `yes` enable it (so a
 * missing, empty, `off`, or unexpected value is treated as OFF).
 */
function flag(v: string | boolean | undefined): boolean {
  if (v === true) return true;
  const s = str(v).toLowerCase();
  return s === "on" || s === "true" || s === "1" || s === "yes";
}

/**
 * True iff the app is configured to use the AWS backend. Defaults to `false`
 * (local-first) so the app builds & runs with ZERO AWS config.
 */
export function isAwsBackend(env: EnvLike): boolean {
  return str(env.VITE_STORAGE_BACKEND).toLowerCase() === "aws";
}

/**
 * Read + validate the AWS config from the env bag. Returns `null` when the
 * REQUIRED values are missing so the caller can safely fall back to local
 * storage instead of crashing the app.
 */
export function readAwsConfig(env: EnvLike): AwsConfig | null {
  const cognitoDomain = str(env.VITE_COGNITO_DOMAIN) || undefined;
  const redirectUri = str(env.VITE_COGNITO_REDIRECT_URI) || undefined;
  const cfg: AwsConfig = {
    region: str(env.VITE_AWS_REGION),
    userPoolId: str(env.VITE_COGNITO_USER_POOL_ID),
    userPoolClientId: str(env.VITE_COGNITO_USER_POOL_CLIENT_ID),
    identityPoolId: str(env.VITE_COGNITO_IDENTITY_POOL_ID),
    progressTable: str(env.VITE_DYNAMODB_TABLE),
    cognitoDomain,
    redirectUri,
    // Google is only "on" when the flag is explicitly set AND we have the
    // Hosted-UI domain + redirect URI to actually run the OAuth redirect.
    // Default OFF so a deployment without Google never shows a broken button.
    googleEnabled:
      flag(env.VITE_GOOGLE_AUTH) && !!cognitoDomain && !!redirectUri,
    apiBaseUrl: str(env.VITE_API_BASE_URL) || undefined,
  };

  const required: (keyof AwsConfig)[] = [
    "region",
    "userPoolId",
    "userPoolClientId",
    "identityPoolId",
    "progressTable",
  ];
  const missing = required.filter((k) => !cfg[k]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[storage] VITE_STORAGE_BACKEND=aws but missing required env: ${missing
        .map((k) => k)
        .join(", ")}. Falling back to local storage.`,
    );
    return null;
  }
  return cfg;
}
