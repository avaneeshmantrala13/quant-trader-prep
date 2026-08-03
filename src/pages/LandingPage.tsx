import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProgress } from "@/context/ProgressContext";
import { useTheme } from "@/context/ThemeContext";
import { PLAYABLE_TRACKS } from "@/content";
import type { Track } from "@/types/content";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { CandlestickIcon, LogoutIcon, MoonIcon, SunIcon } from "@/components/icons";
import {
  CurriculumVisual,
  FreshVisual,
  HintLadderVisual,
  MentalMathVisual,
  RoadmapVisual,
} from "@/components/marketing/visuals";

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

/** The track the student should jump into: first with an unmastered level. */
function useNextTrack(): Track {
  const { getLevelProgress } = useProgress();
  for (const t of PLAYABLE_TRACKS) {
    if (t.levels.some((l) => !getLevelProgress(l.id)?.mastered)) return t;
  }
  return PLAYABLE_TRACKS[0];
}

function useHasProgress(): boolean {
  const { progress } = useProgress();
  return Object.keys(progress.levelProgress).length > 0 || progress.xp > 0;
}

/* ---------------- Header ---------------- */
function LandingHeader() {
  const { theme, toggleTheme } = useTheme();
  const { isAuthed, logOut } = useAuth();
  const { progress } = useProgress();
  const next = useNextTrack();

  return (
    <header className="sticky top-0 z-30 border-b-[3px] border-border-strong bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center border border-border-strong text-primary">
            <CandlestickIcon width={20} height={20} />
          </span>
          <span className="font-display text-xl font-black tracking-tight text-primary sm:text-2xl">
            Quant Trader Prep
          </span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeSwitcher />
          <button
            onClick={toggleTheme}
            className="btn-ghost !min-h-0 !px-2 !py-2"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <SunIcon width={16} height={16} /> : <MoonIcon width={16} height={16} />}
          </button>

          {isAuthed ? (
            <>
              <div className="mr-1 hidden flex-col items-end leading-none sm:flex">
                <span className="label text-[8px]">Streak · XP</span>
                <span className="num text-xs font-semibold text-primary">
                  {progress.streak}d · {progress.xp}
                </span>
              </div>
              <button
                onClick={logOut}
                className="btn-secondary hidden items-center gap-2 sm:inline-flex"
              >
                <LogoutIcon width={15} height={15} /> Log Out
              </button>
              <Link to={`/track/${next.id}`} className="btn-primary">
                Your Tracks →
              </Link>
            </>
          ) : (
            <>
              <Link to="/login?mode=login" className="btn-secondary hidden sm:inline-flex">
                Log In
              </Link>
              <Link to="/login" className="btn-primary">
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ---------------- Hero ---------------- */
function HeroFigure() {
  const bars = [
    [56, 16, true],
    [44, 22, false],
    [50, 26, true],
    [34, 18, true],
    [42, 14, false],
    [24, 22, true],
    [30, 12, false],
    [16, 18, true],
    [22, 10, false],
    [10, 16, true],
  ] as const;
  return (
    <div className="panel-ruled overflow-hidden">
      <div className="flex items-center justify-between border-b border-subtle px-3 py-2">
        <span className="label text-accent">Fig. 1 — Pricing Uncertainty</span>
        <span className="label text-[9px] text-bull">▲ Live</span>
      </div>
      <div className="tex-grid p-3">
        <svg viewBox="0 0 260 120" className="h-40 w-full sm:h-52" aria-hidden="true">
          <path
            d="M6,96 L32,84 L58,88 L84,64 L110,70 L136,44 L162,52 L188,30 L214,36 L250,14"
            fill="none"
            stroke="rgb(var(--color-accent))"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-draw-path"
            style={{ strokeDasharray: 300 }}
          />
          {bars.map(([y, h, bull], i) => {
            const x = 12 + i * 25;
            const color = bull ? "rgb(var(--color-bull))" : "rgb(var(--color-bear))";
            return (
              <g key={i} stroke={color} fill={color}>
                <line x1={x} x2={x} y1={y - 8} y2={y + h + 8} strokeWidth="1.5" />
                <rect x={x - 6} y={y} width="12" height={h} fillOpacity={bull ? 0.9 : 0.5} />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex items-center justify-between border-t border-subtle bg-bull px-3 py-2 text-bg">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-label">● You 0.62</span>
        <span className="font-mono text-[10px] uppercase tracking-label">vs Model 0.55</span>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-label">You Win ▸</span>
      </div>
    </div>
  );
}

function Hero() {
  const { isAuthed, username } = useAuth();
  const next = useNextTrack();
  const resuming = useHasProgress();

  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 sm:pt-12">
      <div className="label flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px]">
        <span>Vol. MMXXVI · No. 1</span>
        <span className="hidden h-3 w-px bg-subtle sm:block" />
        <span>{today()}</span>
        <span className="hidden h-3 w-px bg-subtle sm:block" />
        <span className="text-accent">The Interview Desk</span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-8 border-t-[3px] border-border-strong pt-6 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
        <div>
          <span className="label text-accent">The One Roadmap · Beginner → Expert</span>
          <h1 className="mt-2 font-display text-4xl font-black leading-[1.02] tracking-tight text-primary sm:text-5xl lg:text-6xl">
            Learn to price uncertainty.
            <br />
            <span className="text-accent">Land the quant desk.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-secondary">
            The whole quant-trader funnel — online assessment, technical
            interview, superday games — is one skill:{" "}
            <span className="font-semibold text-primary">
              pricing uncertainty and updating on information.
            </span>{" "}
            We teach it as a single ordered path, with problems that are
            generated and verifier-checked — so they never go stale and can't be
            memorized.
          </p>

          {isAuthed ? (
            <>
              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                <Link to={`/track/${next.id}`} className="btn-primary sm:px-8">
                  {resuming ? "Continue" : "Start"} → {next.title}
                </Link>
                <Link to="/contents" className="btn-secondary sm:px-8">
                  See All Sections →
                </Link>
              </div>
              <p className="label mt-3 text-[9px]">
                Signed in as {username} · pick up where you left off
              </p>
            </>
          ) : (
            <>
              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                <Link to="/login" className="btn-primary sm:px-8">
                  Start Free — Open Account
                </Link>
                <Link to="/login?mode=login" className="btn-secondary sm:px-8">
                  I Have an Account
                </Link>
              </div>
              <p className="label mt-3 text-[9px]">
                Local-first · No email required · No API keys
              </p>
            </>
          )}
        </div>

        <div className="lg:pt-6">
          <HeroFigure />
        </div>
      </div>

      <div className="mx-auto mt-8 grid max-w-2xl grid-cols-3 divide-x divide-subtle border-y border-subtle">
        {[
          ["4", "Core Tracks"],
          ["17", "Mastery Levels"],
          ["∞", "Fresh Problems"],
        ].map(([v, l], i) => (
          <div key={i} className="px-3 py-4 text-center">
            <div className="num text-3xl font-semibold text-primary">{v}</div>
            <div className="label mt-1 text-[9px]">{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Feature section ---------------- */
function Feature({
  no,
  kicker,
  title,
  body,
  bullets,
  visual,
  reverse,
  flag,
  id,
}: {
  no: string;
  kicker: string;
  title: string;
  body: string;
  bullets?: string[];
  visual: ReactNode;
  reverse?: boolean;
  flag?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="mx-auto max-w-6xl scroll-mt-28 border-t border-subtle px-4 py-12 sm:py-16"
    >
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-14">
        <div className={reverse ? "lg:order-2" : ""}>
          <div className="flex items-center gap-3">
            <span className="num text-sm text-muted">{no}</span>
            <span className="label text-accent">{kicker}</span>
            {flag && <span className="chip border-accent text-accent">{flag}</span>}
          </div>
          <h2 className="mt-2 font-display text-3xl font-black leading-tight text-primary sm:text-4xl">
            {title}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-secondary sm:text-base">
            {body}
          </p>
          {bullets && (
            <ul className="mt-4 space-y-2">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 font-mono text-sm font-bold text-bull">✓</span>
                  <span className="text-sm text-primary">{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={reverse ? "lg:order-1" : ""}>{visual}</div>
      </div>
    </section>
  );
}

/* ---------------- How it works ---------------- */
function HowItWorks() {
  const steps = [
    ["01", "Learn", "A short, skippable briefing teaches exactly what you need — skip it if you already know."],
    ["02", "Practice fresh", "Answer generated, verifier-checked problems. Every wrong option is a real mistake, not a giveaway."],
    ["03", "Master to unlock", "Clear the mastery bar to complete a topic and unlock the next one."],
  ];
  return (
    <section className="mx-auto max-w-6xl border-t border-subtle px-4 py-12 sm:py-16">
      <div className="text-center">
        <span className="label text-accent">The Method</span>
        <h2 className="mt-2 font-display text-3xl font-black text-primary sm:text-4xl">
          Learn · Practice · Master
        </h2>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {steps.map(([n, t, d]) => (
          <div key={n} className="panel-ruled p-5">
            <div className="num text-2xl font-semibold text-accent">{n}</div>
            <h3 className="mt-2 font-display text-xl font-semibold text-primary">{t}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-secondary">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Closing CTA ---------------- */
function ClosingCTA() {
  const { isAuthed } = useAuth();
  const next = useNextTrack();
  const resuming = useHasProgress();
  return (
    <section className="mx-auto max-w-6xl px-4 py-4">
      <div className="panel-ruled tex-grid p-8 text-center sm:p-12">
        <span className="label text-accent">The Bottom Line</span>
        <h2 className="mx-auto mt-2 max-w-2xl font-display text-3xl font-black leading-tight text-primary sm:text-5xl">
          Your coursework turns into offers here.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-secondary">
          One roadmap, fresh problems, and calibration as your edge.{" "}
          {isAuthed
            ? "Pick up where you left off and clear your next topic."
            : "Open a free account and clear your first topic today."}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
          {isAuthed ? (
            <>
              <Link to={`/track/${next.id}`} className="btn-primary sm:px-10">
                {resuming ? "Resume" : "Start"} → {next.title}
              </Link>
              <Link to="/contents" className="btn-secondary sm:px-10">
                See All Sections →
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-primary sm:px-10">
                Start Free ▸
              </Link>
              <Link to="/login?mode=login" className="btn-secondary sm:px-10">
                Log In
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */
function Footer() {
  const cols = [
    ["Sections", ["Probability & Statistics", "Mental Math", "Brainteasers", "Interview Games"]],
    ["The Product", ["The Roadmap", "The Hint Ladder", "Fresh Questions"]],
    ["The Funnel", ["Online Assessment", "Technical Interview", "Superday Games"]],
  ] as const;
  return (
    <footer className="mx-auto mt-8 max-w-6xl border-t-[3px] border-border-strong px-4 py-8">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center border border-border-strong text-primary">
              <CandlestickIcon width={18} height={18} />
            </span>
            <span className="font-display text-lg font-black text-primary">
              Quant Trader Prep
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-secondary">
            The definitive beginner→expert quant-interview desk, built on a
            calibration engine that can't go stale.
          </p>
        </div>
        {cols.map(([head, items]) => (
          <div key={head}>
            <div className="label">{head}</div>
            <ul className="mt-3 space-y-1.5">
              {items.map((it) => (
                <li key={it} className="text-sm text-secondary">
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-subtle pt-4 sm:flex-row">
        <span className="label text-[9px]">
          © MMXXVI Quant Trader Prep · Local Edition
        </span>
        <span className="label text-[9px]">
          Set in Fraunces &amp; IBM Plex Mono
        </span>
      </div>
    </footer>
  );
}

/* ---------------- Page ---------------- */
export function LandingPage() {
  const { isAuthed } = useAuth();

  return (
    <div className="relative min-h-[100dvh]">
      <ThemeBackground />
      <div className="relative z-10">
        <LandingHeader />

        <Hero />

        <div className="mt-8">
          <Feature
            no="No. 01"
            kicker="The Roadmap"
            title="One clear path. Not a pile of tabs."
            body="One ordered path from fundamentals to interview-ready. Each topic unlocks only after you've mastered the last, so you always know exactly what to learn next — instead of piecing together your own curriculum from a dozen scattered sites."
            bullets={[
              "Beginner → expert, in a deliberate order",
              "Mastery-gated: master this topic to unlock the next",
              "Your progress, streak, and best scores, saved",
            ]}
            visual={<RoadmapVisual />}
          />

          <Feature
            no="No. 02"
            kicker="The Hint Ladder"
            title="Five rungs of coaching — never the answer."
            body="Miss a problem and you don't get the solution dumped on you. A five-rung ladder escalates exactly as much as you need — name the trap, make a plan of attack, study a worked sibling, then confront it in a simulation — and withholds the final number until the last rung. You build the reasoning interviewers actually probe for, instead of memorizing solutions you can't reproduce under pressure."
            bullets={[
              "Five escalating rungs, keyed to the mistake you actually made",
              "The final answer stays withheld through the first four rungs",
              "Full worked solution unlocks only once you've worked the ladder",
            ]}
            visual={<HintLadderVisual />}
            reverse
          />

          <Feature
            no="No. 03"
            kicker="Fresh Forever"
            title="Problems that can't be memorized or leaked."
            body="You'll never run out of practice, and you can't shortcut it by memorizing a leaked bank. Every problem is generated fresh and checked by an exact verifier, so the answer is provably correct and you get a brand-new instance each time — while static banks get memorized and go stale the moment a firm changes its test."
            bullets={[
              "Exact-verifier ground truth — never a wrong 'correct' answer",
              "Distractors are real mistakes, matched in length so nothing leaks",
              "Unlimited fresh reps on every concept",
            ]}
            visual={<FreshVisual />}
          />

          <Feature
            id="coverage"
            no="No. 04"
            kicker="Full Coverage"
            title="From your first sample space to a two-sided market."
            body="Probability from the ground up, speed mental math, the classic brainteasers, and the expected-value and market-making games from real superdays — one product for the whole funnel, from online assessment to technical interview to superday."
            bullets={[
              "Probability · Mental Math · Brainteasers · Interview Games",
              "Genuinely hard, interview-grade problems in the top tiers",
              "Grounded in a 24-firm trader-track requirements sweep",
            ]}
            visual={<CurriculumVisual linked={isAuthed} />}
            reverse
          />

          <Feature
            no="No. 05"
            kicker="Speed Gate"
            title="Beat the clock where it counts."
            body="Timed mental-math gates like the 80-in-8 and 60-in-8 sprints screen candidates out before anything else. Drill the fast, exact arithmetic and the odds↔probability conversions traders live on — fresh sets every time, against the clock — so speed is never the thing that ends your interview."
            bullets={[
              "Zetamac-style timed mental-math sprints",
              "Two-digit products, divisions, %, fraction & odds conversions",
              "Track your best and push it higher",
            ]}
            visual={<MentalMathVisual />}
          />
        </div>

        <HowItWorks />
        <ClosingCTA />
        <Footer />
      </div>
    </div>
  );
}
