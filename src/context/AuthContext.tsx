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
  DEV_USER_ID,
  endDevSession,
  isDevSessionActive,
  isDeveloperCredentials,
  startDevSession,
} from "@/lib/dev/devAccount";

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
  // it survives reloads and works identically on every StorageProvider.
  const [isDeveloper, setIsDeveloper] = useState<boolean>(() =>
    isDevSessionActive(),
  );
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

  // Establish the local DEVELOPER demo session (a demo escape hatch, not real
  // auth): flag the session, adopt the stable dev userId namespace, and skip the
  // backend entirely. Intercepted from BOTH signUp and logIn so the credentials
  // work regardless of which tab the login screen is on.
  const enterDeveloperMode = useCallback((): AuthResult => {
    startDevSession();
    setIsDeveloper(true);
    setUsername(DEV_USER_ID);
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
