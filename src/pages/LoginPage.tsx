import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { AuthResult } from "@/lib/storage";
import { isAwsBackend, type EnvLike } from "@/lib/awsConfig";
import { useTheme } from "@/context/ThemeContext";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { TickerTape } from "@/components/visuals/TickerTape";
import { MoonIcon, SunIcon } from "@/components/icons";

/**
 * True when the app is running against the AWS backend (accounts in Cognito,
 * progress synced to DynamoDB) rather than the local-first default. Read once
 * at module load from the same `VITE_STORAGE_BACKEND` signal `storage.ts` uses,
 * so the access-panel copy (status pill + blurb) is always accurate for the
 * active deployment.
 */
const AWS_BACKEND = isAwsBackend(import.meta.env as unknown as EnvLike);

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

function LeadFigure() {
  // A small editorial "figure" — an engraved candlestick chart with a caption.
  const bars = [
    [30, 12, true],
    [24, 16, false],
    [26, 20, true],
    [18, 14, true],
    [22, 10, false],
    [12, 16, true],
    [16, 8, false],
    [8, 12, true],
  ] as const;
  return (
    <figure className="border border-border-strong bg-surface p-3">
      <svg viewBox="0 0 200 90" className="h-28 w-full" aria-hidden="true">
        <line x1="0" y1="70" x2="200" y2="70" stroke="rgb(var(--color-border))" />
        {bars.map(([y, h, bull], i) => {
          const x = 14 + i * 24;
          const color = bull ? "rgb(var(--color-bull))" : "rgb(var(--color-bear))";
          return (
            <g key={i} stroke={color} fill={color}>
              <line x1={x} x2={x} y1={y - 8} y2={y + h + 8} strokeWidth={1.5} />
              <rect x={x - 6} y={y} width={12} height={h} fillOpacity={bull ? 0.9 : 0.5} />
            </g>
          );
        })}
      </svg>
      <figcaption className="label mt-2 text-[9px]">
        Fig. 1 — The whole funnel is one skill: pricing uncertainty.
      </figcaption>
    </figure>
  );
}

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
                  "This is taking too long — check your connection and try again.",
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

      <button
        onClick={toggleTheme}
        className="btn-ghost absolute right-3 top-3 z-20 !min-h-0 !px-2 !py-1.5"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? (
          <SunIcon width={16} height={16} />
        ) : (
          <MoonIcon width={16} height={16} />
        )}
      </button>

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8">
        {/* Nameplate */}
        <div className="text-center">
          <div className="label flex items-center justify-center gap-3 text-[9px]">
            <span className="hidden sm:inline">Vol. MMXXVI · No. 1</span>
            <span className="hidden h-3 w-px bg-subtle sm:block" />
            <span>{today()}</span>
            <span className="hidden h-3 w-px bg-subtle sm:block" />
            <span className="hidden sm:inline">Price: Free</span>
          </div>
          <div className="mt-2 border-y-[3px] border-border-strong py-3">
            <Link to="/" aria-label="Back to front page">
              <h1 className="font-display text-4xl font-black leading-none tracking-tight text-primary transition-colors hover:text-accent sm:text-6xl">
                Quant Trader Prep
              </h1>
            </Link>
            <p className="label mt-2 text-[10px]">
              The Interview Desk · Probability · Mental Math · Brainteasers ·
              Market Making
            </p>
          </div>
        </div>

        {/* Body: lead editorial + access panel */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Lead article */}
          <article className="border-r-0 lg:border-r lg:border-subtle lg:pr-6">
            <span className="label text-accent">Lead · The One Roadmap</span>
            <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-primary sm:text-3xl">
              From “I know some algebra” to a two-sided market under a timer.
            </h2>
            <div className="mt-4 gap-5 text-[15px] leading-relaxed text-secondary sm:columns-2">
              <p className="mb-3">
                <span className="float-left mr-2 font-display text-5xl font-black leading-[0.8] text-primary">
                  Q
                </span>
                uant interviews reward one durable skill — pricing uncertainty
                honestly. This desk teaches it as a single ordered path:
                probability from the ground up, speed arithmetic, the classic
                brainteasers, and the expected-value games traders actually play.
              </p>
              <p className="mb-3">
                Every question is exact and every wrong answer is a real mistake,
                not a giveaway. Levels unlock only when you earn mastery, drawn
                as a charted route across the map — a beautifully typeset
                broadsheet for a trader’s desk.
              </p>
            </div>
            <div className="mt-4">
              <LeadFigure />
            </div>
          </article>

          {/* Access panel */}
          <aside>
            <div className="panel-ruled p-5">
              <div className="flex items-center justify-between">
                <span className="label">Desk Access</span>
                <span className="label text-bull">
                  ● Secure · {AWS_BACKEND ? "Cloud" : "Local"}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 border border-subtle">
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
                        : "bg-surface text-secondary hover:text-primary"
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

              <p className="label mt-4 text-[9px] leading-relaxed">
                {AWS_BACKEND
                  ? "Cloud edition — your account is secured by Amazon Cognito and your progress syncs privately to the cloud, so it follows you across devices."
                  : "Local-first edition — your account and progress are stored privately in this browser. No email, no API keys."}
              </p>
            </div>
          </aside>
        </div>
      </div>

      <div className="relative z-10 mt-2">
        <TickerTape />
      </div>
    </div>
  );
}
