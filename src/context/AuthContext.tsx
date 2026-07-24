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

interface AuthContextValue {
  username: string | null;
  isAuthed: boolean;
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
  const [username, setUsername] = useState<string | null>(() =>
    storage.getSession(),
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

  const signUp = useCallback(async (u: string, p: string) => {
    const res = await storage.signUp(u, p);
    if (res.ok) setUsername(storage.getSession());
    return res;
  }, []);

  const logIn = useCallback(async (u: string, p: string) => {
    const res = await storage.logIn(u, p);
    if (res.ok) setUsername(storage.getSession());
    return res;
  }, []);

  const logOut = useCallback(() => {
    storage.logOut();
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
      signUp,
      logIn,
      logOut,
      signInWithGoogle,
    }),
    [username, signUp, logIn, logOut, signInWithGoogle],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
