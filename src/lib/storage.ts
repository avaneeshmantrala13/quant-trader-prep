import { hashPassword, randomSalt, verifyPassword } from "./hash";
import { emptyProgress, type UserProgress } from "@/types/progress";
import { AwsStorageProvider } from "./awsStorage";
import { isAwsBackend, readAwsConfig, type EnvLike } from "./awsConfig";

/**
 * The whole persistence + auth surface lives behind this interface so the app
 * never touches localStorage or Firebase directly. Today it's implemented by
 * `LocalStorageProvider`; swapping to Firebase later means writing a
 * `FirebaseStorageProvider` with the same shape and changing ONE line in the
 * provider wiring — no component or context code changes.
 */
export interface AuthResult {
  ok: boolean;
  error?: string;
  /**
   * AWS Cognito only: sign-up succeeded but the account still needs an emailed
   * confirmation code (i.e. auto-confirm is disabled). Callers may surface a
   * code field and call `confirmSignUp`. Never set by the local provider.
   */
  needsConfirmation?: boolean;
  /** The concrete Cognito username to pass to `confirmSignUp`. */
  pendingUsername?: string;
}

export type ThemeChoice = "light" | "dark";

export interface StorageProvider {
  // --- auth ---
  getSession(): string | null; // returns the logged-in username, or null
  signUp(username: string, password: string): Promise<AuthResult>;
  logIn(username: string, password: string): Promise<AuthResult>;
  logOut(): void;

  // --- per-user course data ---
  loadProgress(username: string): UserProgress;
  saveProgress(username: string, progress: UserProgress): void;

  // --- theme (device-level preference) ---
  getTheme(): ThemeChoice | null; // light/dark mode
  setTheme(theme: ThemeChoice): void;
  getThemeId(): string | null; // named visual theme (e.g. "broadsheet")
  setThemeId(id: string): void;

  // --- optional richer Cognito flows (AWS backend only) ---
  /** Confirm a Cognito sign-up with the emailed code. */
  confirmSignUp?(username: string, code: string): Promise<AuthResult>;
  /** Re-send the Cognito confirmation code. */
  resendConfirmationCode?(username: string): Promise<AuthResult>;
  /** Begin Google federated sign-in (redirects to the Cognito Hosted UI). */
  signInWithGoogle?(): void;
  /**
   * If the current URL is a Cognito OAuth redirect callback (`?code=...`),
   * complete the token exchange and establish a session. Resolves `null` when
   * this isn't a callback (so it's safe to call on every mount).
   */
  completeOAuthRedirect?(): Promise<AuthResult | null>;
}

interface StoredAccount {
  username: string;
  usernameLower: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
}

const KEYS = {
  accounts: "qtp.accounts",
  session: "qtp.session",
  progress: (u: string) => `qtp.progress.${u.toLowerCase()}`,
  theme: "qtp.theme",
  themeId: "qtp.themeId",
};

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / unavailable — non-fatal for the MVP */
  }
}

export class LocalStorageProvider implements StorageProvider {
  private accounts(): Record<string, StoredAccount> {
    return readJSON<Record<string, StoredAccount>>(KEYS.accounts, {});
  }

  getSession(): string | null {
    try {
      return localStorage.getItem(KEYS.session);
    } catch {
      return null;
    }
  }

  async signUp(username: string, password: string): Promise<AuthResult> {
    const uname = username.trim();
    if (!USERNAME_RE.test(uname)) {
      return {
        ok: false,
        error: "Username must be 3–20 letters, numbers, or underscores.",
      };
    }
    if (password.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters." };
    }
    const accounts = this.accounts();
    const lower = uname.toLowerCase();
    if (accounts[lower]) {
      return { ok: false, error: "That username is already taken." };
    }
    const salt = randomSalt();
    const passwordHash = await hashPassword(password, salt);
    accounts[lower] = {
      username: uname,
      usernameLower: lower,
      salt,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    writeJSON(KEYS.accounts, accounts);
    // Initialize an empty progress doc so first load is instant.
    if (!localStorage.getItem(KEYS.progress(uname))) {
      writeJSON(KEYS.progress(uname), emptyProgress());
    }
    try {
      localStorage.setItem(KEYS.session, uname);
    } catch {
      /* ignore */
    }
    return { ok: true };
  }

  async logIn(username: string, password: string): Promise<AuthResult> {
    const lower = username.trim().toLowerCase();
    const account = this.accounts()[lower];
    if (!account) {
      return { ok: false, error: "No account found with that username." };
    }
    const good = await verifyPassword(
      password,
      account.salt,
      account.passwordHash,
    );
    if (!good) {
      return { ok: false, error: "Incorrect password." };
    }
    try {
      localStorage.setItem(KEYS.session, account.username);
    } catch {
      /* ignore */
    }
    return { ok: true };
  }

  logOut(): void {
    try {
      localStorage.removeItem(KEYS.session);
    } catch {
      /* ignore */
    }
  }

  loadProgress(username: string): UserProgress {
    return readJSON<UserProgress>(KEYS.progress(username), emptyProgress());
  }

  saveProgress(username: string, progress: UserProgress): void {
    writeJSON(KEYS.progress(username), progress);
  }

  getTheme(): ThemeChoice | null {
    try {
      const t = localStorage.getItem(KEYS.theme);
      return t === "light" || t === "dark" ? t : null;
    } catch {
      return null;
    }
  }

  setTheme(theme: ThemeChoice): void {
    try {
      localStorage.setItem(KEYS.theme, theme);
    } catch {
      /* ignore */
    }
  }

  getThemeId(): string | null {
    try {
      return localStorage.getItem(KEYS.themeId);
    } catch {
      return null;
    }
  }

  setThemeId(id: string): void {
    try {
      localStorage.setItem(KEYS.themeId, id);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Provider selection (the single wiring point).
 *
 * The DEFAULT is always `LocalStorageProvider` so the app builds & runs
 * local-first with ZERO AWS configuration. Setting `VITE_STORAGE_BACKEND=aws`
 * (plus the required `VITE_COGNITO_*` / `VITE_DYNAMODB_TABLE` vars — see
 * `infra/AWS_SETUP.md`) swaps in the `AwsStorageProvider` for real accounts +
 * cross-device DynamoDB sync. If the flag is set but config is incomplete, we
 * log a warning and fall back to local so the app never hard-crashes.
 *
 * Exported as a pure function so provider selection is unit-testable without
 * real AWS credentials.
 */
export function createStorageProvider(env: EnvLike): StorageProvider {
  if (isAwsBackend(env)) {
    const cfg = readAwsConfig(env);
    if (cfg) return new AwsStorageProvider(cfg);
  }
  return new LocalStorageProvider();
}

export const storage: StorageProvider = createStorageProvider(
  import.meta.env as unknown as EnvLike,
);
