import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { AuthResult } from "@/lib/storage";
import { useTheme } from "@/context/ThemeContext";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { CardShuffleIntro } from "@/components/visuals/CardShuffle";
import { MoonIcon, SunIcon } from "@/components/icons";

function today(): string {
  return new Date()
    .toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
}

/** The four practice areas, set as a mono ledger index. */
const PRACTICE_INDEX = [
  ["01", "Probability & EV"],
  ["02", "Mental math"],
  ["03", "Brainteasers"],
  ["04", "Market making"],
] as const;

export function LoginPage() {
  const { isAuthed, signUp, logIn, signInWithGoogle } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [mode, setMode] = useState<"login" | "signup">(
    params.get("mode") === "login" ? "login" : "signup",
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isAuthed) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    const uname = username.trim();
    if (!uname || !password) {
      setError("Enter your username and password.");
      return;
    }

    setBusy(true);
    try {
      const action =
        mode === "signup"
          ? signUp(uname, password)
          : logIn(uname, password);

      // Ultimate client-side backstop: even if the auth promise somehow never
      // settles (unhandled rejection, dropped chunk, SDK edge case), the button
      // MUST leave "Working…" and show a clear message instead of hanging.
      const res = await Promise.race<AuthResult>([
        action,
        new Promise<AuthResult>((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: false,
                error:
                  "This is taking too long. Check your connection and try again.",
              }),
            25_000,
          ),
        ),
      ]);

      if (res.ok) {
        navigate("/", { replace: true });
      } else {
        setError(res.error ?? "Something went wrong. Please try again.");
      }
    } catch (err) {
      // A thrown/rejected promise must surface as a readable error, never a
      // silent, permanently-spinning button.
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      // ALWAYS exit the "Working…" state — success, failure, throw, or timeout.
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-[100dvh]">
      <ThemeBackground />
      <CardShuffleIntro />

      <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
        <button
          onClick={toggleTheme}
          className="btn-ghost !min-h-0 !px-2 !py-1.5"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <SunIcon width={16} height={16} />
          ) : (
            <MoonIcon width={16} height={16} />
          )}
        </button>
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-screen-2xl flex-col justify-center px-6 py-8 sm:px-10 lg:px-14">
        {/* Nameplate */}
        <div className="flex items-baseline justify-between gap-4 border-b-[3px] border-border-strong pb-4">
          <Link to="/" aria-label="Back to front page" className="min-w-0">
            <h1 className="font-display text-3xl font-black leading-none tracking-tight text-primary transition-colors hover:text-accent sm:text-5xl">
              The Quant Factory
            </h1>
          </Link>
          <span className="label hidden shrink-0 text-[9px] text-muted sm:block">
            {today()}
          </span>
        </div>

        {/* Body: lead editorial + access panel */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12">
          {/* Lead article */}
          <article className="lg:border-r lg:border-subtle lg:pr-10">
            <span className="label text-accent">The one roadmap</span>
            <h2 className="mt-3 font-display text-3xl font-semibold leading-[1.1] text-primary sm:text-[2.6rem]">
              From “I know some algebra” to a two-sided market under a timer.
            </h2>

            <ul className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-subtle pt-7 sm:max-w-lg">
              {PRACTICE_INDEX.map(([n, label]) => (
                <li key={n} className="flex items-baseline gap-3.5">
                  <span className="num text-4xl font-semibold leading-none text-accent sm:text-5xl">
                    {n}
                  </span>
                  <span className="text-[15px] font-medium text-primary">{label}</span>
                </li>
              ))}
            </ul>
          </article>

          {/* Access panel */}
          <aside>
            <div className="panel-ruled p-5">
              <div className="grid grid-cols-2 overflow-hidden rounded border border-subtle">
                {(["signup", "login"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMode(m);
                      setError(null);
                    }}
                    className={`py-2.5 font-mono text-[11px] font-semibold uppercase tracking-label transition-colors ${
                      mode === m
                        ? "bg-primary text-bg"
                        : "bg-surface text-secondary hover:bg-surface-muted hover:text-primary"
                    }`}
                  >
                    {m === "signup" ? "Open Account" : "Log In"}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="username" className="label mb-1.5 block">
                    Username
                  </label>
                  <input
                    id="username"
                    className="input"
                    value={username}
                    autoComplete="username"
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="trader_arjun"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="label mb-1.5 block">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    className="input"
                    value={password}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "min. 6 characters" : "password"}
                  />
                </div>

                {error && (
                  <p
                    role="alert"
                    className="border-l-2 border-danger bg-danger-soft px-3 py-2 font-mono text-xs text-danger"
                  >
                    {error}
                  </p>
                )}

                <button type="submit" disabled={busy} className="btn-primary w-full">
                  {busy
                    ? "Working…"
                    : mode === "signup"
                      ? "Open Account & Enter"
                      : "Authenticate"}
                </button>
              </form>

              {/* Google federated sign-in — only rendered when Google is
                  actually configured (AWS Cognito + VITE_GOOGLE_AUTH=on). Hidden
                  on local-first AND on any AWS deploy without Google, so users
                  never hit the Hosted UI's "Login option is not available". */}
              {signInWithGoogle && (
                <>
                  <div className="my-4 flex items-center gap-3">
                    <span className="h-px flex-1 bg-subtle" />
                    <span className="label text-[9px]">Or</span>
                    <span className="h-px flex-1 bg-subtle" />
                  </div>
                  <button
                    type="button"
                    onClick={() => signInWithGoogle()}
                    className="btn-ghost w-full"
                  >
                    Continue with Google
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
