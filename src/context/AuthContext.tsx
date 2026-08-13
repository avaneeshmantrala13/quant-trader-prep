import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { storage, type AuthResult } from "@/lib/storage";
import {
  DEV_COGNITO_PASSWORD,
  DEV_COGNITO_USERNAME,
  DEV_USER_ID,
  endDevSession,
  isDevSessionActive,
  isDeveloperCredentials,
  startDevSession,
} from "@/lib/dev/devAccount";
import { maybeRunOneTimeDevReset } from "@/lib/dev/devReset";

/**
 * Best-effort REAL Cognito sign-in for the developer demo. Authenticates as the
 * throwaway {@link DEV_COGNITO_USERNAME} account through the SAME
 * `storage.logIn` path a normal user uses, so the resulting User-Pool ID token
 * lands in the exact localStorage keys `readCognitoIdToken` (aiFlavor.ts) reads
 * — unlocking the JWT-gated `/ai` grading endpoint and real, identity-scoped
 * DynamoDB persistence.
 *
 * NEVER throws and never blocks the demo: on failure (offline, or a backend
 * without this Cognito user — e.g. the local-first build) it logs a clear
 * warning and resolves `false`, leaving the caller in local-only dev mode where
 * grading falls back to the deterministic path. Returns `true` on success.
 */
async function ensureDevCognitoSession(): Promise<boolean> {
  try {
    const res = await storage.logIn(DEV_COGNITO_USERNAME, DEV_COGNITO_PASSWORD);
    if (!res.ok) {
       
      console.warn(
        "[dev] Cognito-backed demo sign-in failed; real LLM grading is disabled " +
          "and the demo falls back to local-only dev mode.",
        res.error,
      );
      return false;
    }
    return true;
  } catch (e) {
     
    console.warn(
      "[dev] Cognito-backed demo sign-in threw; falling back to local-only dev mode.",
      e,
    );
    return false;
  }
}

interface AuthContextValue {
  username: string | null;
  isAuthed: boolean;
  /**
   * TRUE when the session is the local DEVELOPER demo account (a demo escape
   * hatch, not production auth — see `src/lib/dev/devAccount.ts`). It flags a
   * dev-only skip control in the guided shell; it is FALSE for every real
   * account, so no real user can bypass the pipeline gates. Discoverable app-
   * wide via {@link useIsDeveloper}.
   */
  isDeveloper: boolean;
  signUp: (username: string, password: string) => Promise<AuthResult>;
  logIn: (username: string, password: string) => Promise<AuthResult>;
  logOut: () => void;
  /**
   * Present only when Google federated sign-in is actually CONFIGURED in the
   * active backend — i.e. the AWS Cognito backend AND `VITE_GOOGLE_AUTH=on`
   * with a Hosted-UI domain + redirect URI (see `awsConfig.googleEnabled`).
   * `undefined` on the local backend and on any AWS deployment without Google,
   * so the UI can feature-detect and hide the "Continue with Google" button
   * entirely rather than sending users to a broken Hosted UI screen.
   */
  signInWithGoogle?: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // A persisted developer session takes precedence over any backend session so
  // it survives reloads and works identically on every StorageProvider. When a
  // dev session is restored on a reload, run the deploy-scoped one-time reset
  // BEFORE ProgressProvider (a child) hydrates, so a new build's demo starts
  // clean without a per-login wipe (see maybeRunOneTimeDevReset).
  const [isDeveloper, setIsDeveloper] = useState<boolean>(() => {
    const active = isDevSessionActive();
    if (active) maybeRunOneTimeDevReset();
    return active;
  });
  const [username, setUsername] = useState<string | null>(() =>
    isDevSessionActive() ? DEV_USER_ID : storage.getSession(),
  );

  // If the current URL is a Cognito OAuth (Google) redirect callback, finish
  // the token exchange and establish the session. No-op on the local backend
  // (the method is undefined) and a no-op when there's no `?code=` param.
  useEffect(() => {
    let cancelled = false;
    void storage.completeOAuthRedirect?.().then((res) => {
      if (!cancelled && res?.ok) setUsername(storage.getSession());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // On a reload that RESTORED a developer session, refresh the Cognito-backed
  // demo session so the ID token stays valid (the stored token expires ~1h, and
  // `readCognitoIdToken` reads it verbatim without refreshing). This re-auths in
  // the background so real LLM grading keeps working across reloads; a failure
  // is non-fatal (local-only dev mode).
  useEffect(() => {
    if (isDevSessionActive()) void ensureDevCognitoSession();
  }, []);

  // Establish the DEVELOPER demo session. It stays a demo escape hatch (flags
  // `isDeveloper`, adopts the stable dev userId namespace so all dev powers +
  // the demo reset keep working), but now ALSO performs a REAL Cognito sign-in
  // as the throwaway demo user so the session carries a valid ID token → real
  // LLM grading via the JWT-gated `/ai` endpoint and identity-scoped DynamoDB
  // persistence. Intercepted from BOTH signUp and logIn so the client-facing
  // `developer`/`123456` credentials work regardless of which tab is active.
  const enterDeveloperMode = useCallback(async (): Promise<AuthResult> => {
    // Deploy-scoped one-time reset BEFORE adopting the dev namespace, so the
    // first dev login on a new build sees a clean demo (and later logins do
    // not — the token guards against a persistence-breaking per-login wipe).
    maybeRunOneTimeDevReset();
    startDevSession();
    setIsDeveloper(true);
    // Keep the STABLE dev userId as the app-facing username so every dev power
    // (forced-stage skip, DevKstView, the demo reset's `::developer` scoping)
    // is unchanged; persistence still routes to the real Cognito identity
    // because the AWS storage provider keys DynamoDB by the signed-in identity,
    // not this display name.
    setUsername(DEV_USER_ID);
    // Best-effort real Cognito session (never blocks/breaks the demo on failure).
    await ensureDevCognitoSession();
    return { ok: true };
  }, []);

  const signUp = useCallback(
    async (u: string, p: string) => {
      if (isDeveloperCredentials(u, p)) return enterDeveloperMode();
      const res = await storage.signUp(u, p);
      if (res.ok) {
        setIsDeveloper(false);
        setUsername(storage.getSession());
      }
      return res;
    },
    [enterDeveloperMode],
  );

  const logIn = useCallback(
    async (u: string, p: string) => {
      if (isDeveloperCredentials(u, p)) return enterDeveloperMode();
      const res = await storage.logIn(u, p);
      if (res.ok) {
        setIsDeveloper(false);
        setUsername(storage.getSession());
      }
      return res;
    },
    [enterDeveloperMode],
  );

  const logOut = useCallback(() => {
    endDevSession();
    storage.logOut();
    setIsDeveloper(false);
    setUsername(null);
  }, []);

  const signInWithGoogle = useMemo(
    () =>
      storage.signInWithGoogle
        ? () => storage.signInWithGoogle?.()
        : undefined,
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      username,
      isAuthed: !!username,
      isDeveloper,
      signUp,
      logIn,
      logOut,
      signInWithGoogle,
    }),
    [username, isDeveloper, signUp, logIn, logOut, signInWithGoogle],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/**
 * Convenience hook exposing ONLY the developer flag. A thin wrapper over
 * {@link useAuth} so feature code can gate dev-only affordances with a single,
 * self-documenting call (`const isDev = useIsDeveloper()`).
 */
export function useIsDeveloper(): boolean {
  return useAuth().isDeveloper;
}
