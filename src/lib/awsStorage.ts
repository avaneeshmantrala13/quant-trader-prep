/**
 * AwsStorageProvider — the AWS Free-Tier implementation of `StorageProvider`.
 *
 * Auth   : Amazon Cognito User Pool (username OR email alias, + Google via the
 *          Hosted UI OAuth redirect). Tokens are handled by
 *          `amazon-cognito-identity-js` (password flows) or a PKCE code
 *          exchange (Google), and cached in localStorage — no client secret.
 * Data   : Amazon DynamoDB, ONE owner-scoped item per user. Temporary,
 *          fine-grained AWS credentials are minted by a Cognito Identity Pool
 *          (leading-key = the caller's identity id), so a user can only ever
 *          read/write their own progress item (PRD §13). No long-lived keys ship
 *          to the browser (PRD §14 C5).
 *
 * Bundle note: every `@aws-sdk/*` / `amazon-cognito-identity-js` import below is
 * a lazy `import()` so the heavy SDK code lands in a SEPARATE async chunk that
 * is fetched ONLY when the AWS backend is actually used. The default local-first
 * build never pulls it into the main bundle.
 *
 * The `StorageProvider` contract is intentionally SYNCHRONOUS for
 * `getSession/loadProgress/saveProgress`, while DynamoDB/Cognito are async. We
 * bridge that with a write-through cache:
 *   - `loadProgress` returns the in-memory / localStorage-mirrored blob instantly.
 *   - `logIn`/`signUp`/`completeOAuthRedirect` AWAIT the remote fetch and
 *     populate the cache *before* resolving, so the very next synchronous
 *     `loadProgress` (fired by ProgressContext when the username changes) sees
 *     the freshest cross-device state.
 *   - `saveProgress` updates the cache immediately and debounces a DynamoDB
 *     write (on top of ProgressContext's own debounce) to stay well inside the
 *     Free-Tier write budget (PRD §14 C3/C4).
 */
import type { CognitoUserPool } from "amazon-cognito-identity-js";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { AwsConfig } from "./awsConfig";
import type { AuthResult, StorageProvider, ThemeChoice } from "./storage";
import { emptyProgress, type UserProgress } from "@/types/progress";

// Device-level theme prefs stay in localStorage on every backend (they are not
// account data). Reuse the same keys the LocalStorageProvider uses.
const THEME_KEY = "qtp.theme";
const THEME_ID_KEY = "qtp.themeId";

// Our own (non-Cognito) localStorage keys.
const CACHE_KEY = "qtp.aws.progress.cache";
const OAUTH_ID_TOKEN = "qtp.aws.oauth.idToken";
const OAUTH_USERNAME = "qtp.aws.oauth.username";
const OAUTH_EXP = "qtp.aws.oauth.exp";
const PKCE_VERIFIER = "qtp.aws.pkce.verifier";

const EMAIL_RE = /.+@.+\..+/;

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** URL-safe base64 decode of a JWT segment → parsed JSON claims. */
function decodeJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1];
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkceChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toBase64Url(new Uint8Array(digest));
}

function errMsg(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}

/**
 * Resolve `p`, but NEVER wait longer than `ms`; on timeout resolve `fallback`
 * (and swallow a late rejection). This is the safety net that guarantees an
 * auth flow can't leave the UI stuck on "Working…" if a network call stalls or
 * a callback never fires.
 */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, ms);
    const finish = (v: T) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(v);
      }
    };
    p.then(finish, () => finish(fallback));
  });
}

/**
 * Map raw Cognito/SDK errors to SHORT, human-readable, actionable messages so
 * the login/signup UI never shows a cryptic dump (or nothing at all).
 *
 * Note: this pool runs with `PreventUserExistenceErrors: ENABLED`, so a login
 * to a NON-EXISTENT account also surfaces as `NotAuthorizedException` — hence
 * we nudge the user toward "Open Account" in that case too.
 */
function friendlyAuthError(e: unknown, fallback: string): string {
  const name =
    e && typeof e === "object" && "name" in e
      ? String((e as { name?: unknown }).name ?? "")
      : "";
  const raw = errMsg(e, fallback);
  switch (name) {
    case "UserNotFoundException":
      return "No account found with that username. Try “Open Account”.";
    case "NotAuthorizedException":
      return "Incorrect username or password. If you don’t have an account yet, choose “Open Account”.";
    case "UserNotConfirmedException":
      return "Your account isn’t confirmed yet — check your email for a code.";
    case "UsernameExistsException":
      return "That username is already taken. Switch to “Log In” instead.";
    case "InvalidPasswordException":
      return "That password doesn’t meet the requirements (min. 6 characters).";
    case "PasswordResetRequiredException":
      return "A password reset is required for this account.";
    case "TooManyRequestsException":
    case "LimitExceededException":
      return "Too many attempts — please wait a moment and try again.";
    case "NetworkError":
      return "Network error — check your connection and try again.";
    default:
      return raw;
  }
}

interface CachedCreds {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  identityId: string;
  expiresAt: number; // epoch ms
}

export class AwsStorageProvider implements StorageProvider {
  private readonly cfg: AwsConfig;
  private cognitoMod: typeof import("amazon-cognito-identity-js") | null = null;
  private poolPromise: Promise<CognitoUserPool> | null = null;
  private creds: CachedCreds | null = null;
  private doc: DynamoDBDocumentClient | null = null;

  // Write-through progress cache (single active user).
  private cachedProgress: UserProgress | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSave: UserProgress | null = null;

  /**
   * Begin Google federated sign-in — present ONLY when Google is actually
   * configured (`cfg.googleEnabled`). Left `undefined` otherwise so the UI can
   * feature-detect and hide the "Continue with Google" button entirely, instead
   * of sending users to a Hosted UI that errors with "Login option is not
   * available" when no Google IdP exists in the pool.
   */
  readonly signInWithGoogle?: () => void;

  constructor(cfg: AwsConfig) {
    this.cfg = cfg;
    // Warm the in-memory cache from the localStorage mirror so a page reload is
    // instant & offline-tolerant. All heavy/network init is lazy.
    const raw = safeGet(CACHE_KEY);
    if (raw) {
      try {
        this.cachedProgress = JSON.parse(raw) as UserProgress;
      } catch {
        this.cachedProgress = null;
      }
    }
    // Expose the Google entry point ONLY when federation is configured.
    if (cfg.googleEnabled) {
      this.signInWithGoogle = () => {
        void this.beginGoogle();
      };
    }
  }

  // -------------------------------------------------- lazy SDK modules/clients
  private async cognito(): Promise<typeof import("amazon-cognito-identity-js")> {
    if (!this.cognitoMod) {
      this.cognitoMod = await import("amazon-cognito-identity-js");
    }
    return this.cognitoMod;
  }

  private async userPool(): Promise<CognitoUserPool> {
    if (!this.poolPromise) {
      this.poolPromise = this.cognito().then(
        (m) =>
          new m.CognitoUserPool({
            UserPoolId: this.cfg.userPoolId,
            ClientId: this.cfg.userPoolClientId,
          }),
      );
    }
    return this.poolPromise;
  }

  private get providerName(): string {
    return `cognito-idp.${this.cfg.region}.amazonaws.com/${this.cfg.userPoolId}`;
  }

  // ------------------------------------------------------------------- session
  getSession(): string | null {
    // OAuth (Google) session first.
    const oauthUser = safeGet(OAUTH_USERNAME);
    const oauthExp = Number(safeGet(OAUTH_EXP) ?? "0");
    if (oauthUser && oauthExp > Date.now()) return oauthUser;

    // Password session (managed by amazon-cognito-identity-js) — read the
    // well-known localStorage keys directly so this stays synchronous & needs
    // no SDK load.
    const clientId = this.cfg.userPoolClientId;
    const last = safeGet(
      `CognitoIdentityServiceProvider.${clientId}.LastAuthUser`,
    );
    if (last) {
      const idTok = safeGet(
        `CognitoIdentityServiceProvider.${clientId}.${last}.idToken`,
      );
      if (idTok) return last;
    }
    return null;
  }

  /** Resolve a valid ID token for the active session (refreshing if needed). */
  private async getIdToken(): Promise<string | null> {
    // OAuth path.
    const oauthTok = safeGet(OAUTH_ID_TOKEN);
    const oauthExp = Number(safeGet(OAUTH_EXP) ?? "0");
    if (oauthTok && oauthExp > Date.now()) return oauthTok;

    const pool = await this.userPool();
    return new Promise((resolve) => {
      const user = pool.getCurrentUser();
      if (!user) {
        resolve(null);
        return;
      }
      user.getSession(
        (
          err: Error | null,
          session: { getIdToken(): { getJwtToken(): string } } | null,
        ) => {
          if (err || !session) {
            resolve(null);
            return;
          }
          resolve(session.getIdToken().getJwtToken());
        },
      );
    });
  }

  // ------------------------------------------------------------ password auth
  async signUp(username: string, password: string): Promise<AuthResult> {
    const id = username.trim();
    if (!id || !password) {
      return { ok: false, error: "Enter a username and a password." };
    }
    const isEmail = EMAIL_RE.test(id);
    let m: typeof import("amazon-cognito-identity-js");
    let pool: CognitoUserPool;
    try {
      m = await this.cognito();
      pool = await this.userPool();
    } catch (e) {
      return {
        ok: false,
        error: errMsg(e, "Auth service unavailable — check your connection."),
      };
    }
    // Cognito forbids email-format usernames when email is an alias, so email
    // sign-ups get a generated username; the user signs in with their email.
    const cognitoUsername = isEmail
      ? `u_${toBase64Url(crypto.getRandomValues(new Uint8Array(9)))}`
      : id;
    const attrs = isEmail
      ? [new m.CognitoUserAttribute({ Name: "email", Value: id })]
      : [];

    // Bounded so a stalled network call can't hang the "Working…" button.
    const signUpResult = await withTimeout<AuthResult>(
      new Promise<AuthResult>((resolve) => {
        try {
          pool.signUp(cognitoUsername, password, attrs, [], (err) => {
            if (err) {
              resolve({ ok: false, error: friendlyAuthError(err, "Sign-up failed.") });
              return;
            }
            resolve({ ok: true });
          });
        } catch (e) {
          resolve({ ok: false, error: friendlyAuthError(e, "Sign-up failed.") });
        }
      }),
      20_000,
      { ok: false, error: "Sign-up timed out — check your connection and try again." },
    );
    if (!signUpResult.ok) return signUpResult;

    // The default infra auto-confirms sign-ups (PreSignUp trigger), so we can
    // sign the user straight in. If auto-confirm is disabled, logIn will report
    // that confirmation is required and the caller can surface confirmSignUp.
    const loginId = isEmail ? id : cognitoUsername;
    const login = await this.logIn(loginId, password);
    if (login.ok) return login;
    return {
      ok: false,
      error: login.error,
      needsConfirmation: /confirm/i.test(login.error ?? ""),
      pendingUsername: cognitoUsername,
    };
  }

  async logIn(username: string, password: string): Promise<AuthResult> {
    const id = username.trim();
    if (!id || !password) {
      return { ok: false, error: "Enter your username and password." };
    }
    let m: typeof import("amazon-cognito-identity-js");
    let pool: CognitoUserPool;
    try {
      m = await this.cognito();
      pool = await this.userPool();
    } catch (e) {
      return {
        ok: false,
        error: errMsg(e, "Auth service unavailable — check your connection."),
      };
    }

    const authPromise = new Promise<AuthResult>((resolve) => {
      try {
        const user = new m.CognitoUser({ Username: id, Pool: pool });
        const details = new m.AuthenticationDetails({
          Username: id,
          Password: password,
        });
        user.authenticateUser(details, {
          onSuccess: () => {
            // Prime creds + pull remote progress so the next synchronous
            // loadProgress sees cross-device state — but NEVER block the
            // caller (and the "Working…" button) on it: cap the hydrate so a
            // slow/blocked DynamoDB/identity call can't stall the login.
            void withTimeout(this.hydrateAfterAuth(), 8_000, undefined).then(
              () => resolve({ ok: true }),
            );
          },
          onFailure: (err) => {
            resolve({ ok: false, error: friendlyAuthError(err, "Login failed.") });
          },
          newPasswordRequired: () => {
            resolve({
              ok: false,
              error:
                "A new password is required for this account. Please reset via the AWS console.",
            });
          },
        });
      } catch (e) {
        // A synchronous throw inside the SDK must reject cleanly, not hang.
        resolve({ ok: false, error: friendlyAuthError(e, "Login failed.") });
      }
    });

    // Absolute backstop so logIn can NEVER hang indefinitely.
    return withTimeout<AuthResult>(authPromise, 20_000, {
      ok: false,
      error: "Login timed out — check your connection and try again.",
    });
  }

  async confirmSignUp(username: string, code: string): Promise<AuthResult> {
    const m = await this.cognito();
    const pool = await this.userPool();
    return new Promise((resolve) => {
      const user = new m.CognitoUser({ Username: username.trim(), Pool: pool });
      user.confirmRegistration(code.trim(), true, (err) => {
        if (err) {
          resolve({ ok: false, error: errMsg(err, "Confirmation failed.") });
          return;
        }
        resolve({ ok: true });
      });
    });
  }

  async resendConfirmationCode(username: string): Promise<AuthResult> {
    const m = await this.cognito();
    const pool = await this.userPool();
    return new Promise((resolve) => {
      const user = new m.CognitoUser({ Username: username.trim(), Pool: pool });
      user.resendConfirmationCode((err) => {
        if (err) {
          resolve({ ok: false, error: errMsg(err, "Could not resend code.") });
          return;
        }
        resolve({ ok: true });
      });
    });
  }

  logOut(): void {
    // Clear the Cognito-managed localStorage session synchronously (no SDK load
    // needed): every token lives under CognitoIdentityServiceProvider.<client>.
    try {
      const prefix = `CognitoIdentityServiceProvider.${this.cfg.userPoolClientId}.`;
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) toRemove.push(key);
      }
      toRemove.forEach((k) => safeRemove(k));
    } catch {
      /* ignore */
    }
    safeRemove(OAUTH_ID_TOKEN);
    safeRemove(OAUTH_USERNAME);
    safeRemove(OAUTH_EXP);
    safeRemove(CACHE_KEY);
    this.cachedProgress = null;
    this.creds = null;
    this.doc = null;
  }

  // -------------------------------------------------------------- Google OAuth
  private async beginGoogle(): Promise<void> {
    if (!this.cfg.cognitoDomain || !this.cfg.redirectUri) {
      // eslint-disable-next-line no-console
      console.warn(
        "[storage] Google sign-in needs VITE_COGNITO_DOMAIN + VITE_COGNITO_REDIRECT_URI.",
      );
      return;
    }
    const verifier = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    safeSet(PKCE_VERIFIER, verifier);
    const challenge = await pkceChallenge(verifier);
    const url =
      `https://${this.cfg.cognitoDomain}/oauth2/authorize` +
      `?identity_provider=Google` +
      `&redirect_uri=${encodeURIComponent(this.cfg.redirectUri)}` +
      `&response_type=CODE` +
      `&client_id=${encodeURIComponent(this.cfg.userPoolClientId)}` +
      `&scope=${encodeURIComponent("openid email profile")}` +
      `&code_challenge_method=S256` +
      `&code_challenge=${challenge}`;
    window.location.assign(url);
  }

  async completeOAuthRedirect(): Promise<AuthResult | null> {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return null;
    if (!this.cfg.cognitoDomain || !this.cfg.redirectUri) return null;

    const verifier = safeGet(PKCE_VERIFIER) ?? "";
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.cfg.userPoolClientId,
      code,
      redirect_uri: this.cfg.redirectUri,
      code_verifier: verifier,
    });
    try {
      const res = await fetch(`https://${this.cfg.cognitoDomain}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!res.ok) {
        return {
          ok: false,
          error: `OAuth token exchange failed (${res.status}).`,
        };
      }
      const tokens = (await res.json()) as {
        id_token?: string;
        expires_in?: number;
      };
      if (!tokens.id_token) {
        return { ok: false, error: "OAuth response missing id_token." };
      }
      const claims = decodeJwt(tokens.id_token);
      const username =
        (claims["email"] as string) ||
        (claims["cognito:username"] as string) ||
        "google-user";
      const exp = Date.now() + (tokens.expires_in ?? 3600) * 1000;
      safeSet(OAUTH_ID_TOKEN, tokens.id_token);
      safeSet(OAUTH_USERNAME, username);
      safeSet(OAUTH_EXP, String(exp));
      safeRemove(PKCE_VERIFIER);

      // Scrub the ?code=... from the URL so a refresh doesn't re-run exchange.
      try {
        window.history.replaceState({}, "", window.location.pathname);
      } catch {
        /* ignore */
      }

      await this.hydrateAfterAuth();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errMsg(e, "OAuth sign-in failed.") };
    }
  }

  // -------------------------------------------------------------------- creds
  private async ensureCreds(): Promise<CachedCreds | null> {
    if (this.creds && this.creds.expiresAt > Date.now() + 60_000) {
      return this.creds;
    }
    const idToken = await this.getIdToken();
    if (!idToken) return null;

    const {
      CognitoIdentityClient,
      GetIdCommand,
      GetCredentialsForIdentityCommand,
    } = await import("@aws-sdk/client-cognito-identity");
    const client = new CognitoIdentityClient({ region: this.cfg.region });
    const logins = { [this.providerName]: idToken };

    const idRes = await client.send(
      new GetIdCommand({
        IdentityPoolId: this.cfg.identityPoolId,
        Logins: logins,
      }),
    );
    const identityId = idRes.IdentityId;
    if (!identityId) return null;

    const credRes = await client.send(
      new GetCredentialsForIdentityCommand({
        IdentityId: identityId,
        Logins: logins,
      }),
    );
    const c = credRes.Credentials;
    if (!c?.AccessKeyId || !c.SecretKey || !c.SessionToken) return null;

    this.creds = {
      accessKeyId: c.AccessKeyId,
      secretAccessKey: c.SecretKey,
      sessionToken: c.SessionToken,
      identityId,
      expiresAt: c.Expiration ? c.Expiration.getTime() : Date.now() + 3_000_000,
    };
    this.doc = null; // rebuild the doc client with fresh creds
    return this.creds;
  }

  private async docClient(): Promise<{
    doc: DynamoDBDocumentClient;
    identityId: string;
  } | null> {
    const creds = await this.ensureCreds();
    if (!creds) return null;
    if (!this.doc) {
      const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
      const { DynamoDBDocumentClient } = await import("@aws-sdk/lib-dynamodb");
      const ddb = new DynamoDBClient({
        region: this.cfg.region,
        credentials: {
          accessKeyId: creds.accessKeyId,
          secretAccessKey: creds.secretAccessKey,
          sessionToken: creds.sessionToken,
        },
      });
      this.doc = DynamoDBDocumentClient.from(ddb, {
        marshallOptions: { removeUndefinedValues: true },
      });
    }
    return { doc: this.doc, identityId: creds.identityId };
  }

  // ----------------------------------------------------------------- progress
  private writeCache(p: UserProgress): void {
    this.cachedProgress = p;
    safeSet(CACHE_KEY, JSON.stringify(p));
  }

  /** After any successful auth: mint creds + pull the remote progress blob. */
  private async hydrateAfterAuth(): Promise<void> {
    try {
      const client = await this.docClient();
      if (!client) return;
      const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
      const res = await client.doc.send(
        new GetCommand({
          TableName: this.cfg.progressTable,
          Key: { userId: client.identityId },
        }),
      );
      const remote = res.Item?.progress as UserProgress | undefined;
      if (remote) {
        this.writeCache(remote);
      } else if (!this.cachedProgress) {
        this.writeCache(emptyProgress());
      }
    } catch (e) {
      // Non-fatal: fall back to the local mirror / empty progress.
      // eslint-disable-next-line no-console
      console.warn("[storage] progress hydrate failed:", errMsg(e, "unknown"));
    }
  }

  loadProgress(_username: string): UserProgress {
    return this.cachedProgress ?? emptyProgress();
  }

  saveProgress(_username: string, progress: UserProgress): void {
    // Immediate local write-through (instant UI + reload + offline tolerance).
    this.writeCache(progress);
    // Debounced remote write (on top of ProgressContext's debounce) → tiny,
    // Free-Tier-safe DynamoDB write volume.
    this.pendingSave = progress;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      void this.flushSave();
    }, 1500);
  }

  private async flushSave(): Promise<void> {
    const toSave = this.pendingSave;
    if (!toSave) return;
    this.pendingSave = null;
    try {
      const client = await this.docClient();
      if (!client) return;
      const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
      const idToken = safeGet(OAUTH_ID_TOKEN) ?? "";
      const sub = idToken ? (decodeJwt(idToken)["sub"] as string) : undefined;
      await client.doc.send(
        new PutCommand({
          TableName: this.cfg.progressTable,
          Item: {
            userId: client.identityId,
            sub,
            progress: toSave,
            updatedAt: new Date().toISOString(),
          },
        }),
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[storage] progress save failed:", errMsg(e, "unknown"));
    }
  }

  // -------------------------------------------------------------------- theme
  getTheme(): ThemeChoice | null {
    const t = safeGet(THEME_KEY);
    return t === "light" || t === "dark" ? t : null;
  }
  setTheme(theme: ThemeChoice): void {
    safeSet(THEME_KEY, theme);
  }
  getThemeId(): string | null {
    return safeGet(THEME_ID_KEY);
  }
  setThemeId(id: string): void {
    safeSet(THEME_ID_KEY, id);
  }
}
