import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProgress } from "@/context/ProgressContext";
import { useTheme } from "@/context/ThemeContext";
import type { GoalMode } from "@/types/progress";
import { appTitleFor } from "@/lib/mode/goalMode";
import { NavMenu } from "@/components/layout/NavMenu";
import { PLAYABLE_TRACKS } from "@/content";
import type { Track } from "@/types/content";
import { ThemeBackground } from "@/components/visuals/ThemeBackground";
import { CardShuffleIntro } from "@/components/visuals/CardShuffle";
import { CandlestickIcon, LogoutIcon, MoonIcon, SunIcon } from "@/components/icons";
import {
  CurriculumVisual,
  FreshVisual,
  HintLadderVisual,
  RoadmapVisual,
} from "@/components/marketing/visuals";

/**
 * FRONTEND GOAL MODE — course remediation is backend-only, so the landing page
 * (like the rest of the frontend) always operates in the quant "interview" path:
 * the quant product name and the interview "Start / Continue" target. The
 * course-mode helpers (`courseStartHref`, `appTitleFor("course")`, …) stay
 * defined for a future re-enable; the UI just never reads them.
 */
const FRONTEND_GOAL_MODE: GoalMode = "interview";

/** The track the student should jump into: first with an unmastered level. */
function useNextTrack(): Track {
  const { getLevelProgress } = useProgress();
  for (const t of PLAYABLE_TRACKS) {
    if (t.levels.some((l) => !getLevelProgress(l.id)?.mastered)) return t;
  }
  return PLAYABLE_TRACKS[0];
}

/**
 * The "Start / Continue" CTA target. The frontend is quant-only, so this always
 * resumes the learner in their next quant track (course mode's `/course/:id`
 * resume path stays in `courseResume.ts` for a future re-enable).
 */
function useStartTarget(): { href: string; label: string } {
  const next = useNextTrack();
  return { href: `/track/${next.id}`, label: next.title };
}

function useHasProgress(): boolean {
  const { progress } = useProgress();
  return Object.keys(progress.levelProgress).length > 0 || progress.xp > 0;
}

/** The product name. Quant-only frontend, so always the quant title. */
function useAppTitle(): string {
  return appTitleFor(FRONTEND_GOAL_MODE);
}

/* ---------------- Header ---------------- */
function LandingHeader() {
  const { theme, toggleTheme } = useTheme();
  const { isAuthed, logOut } = useAuth();
  const { progress } = useProgress();
  const appTitle = useAppTitle();
  const start = useStartTarget();
  const diagnosticDone = !!progress.diagnosticDoneAt;

  // Show the same hamburger nav menu the rest of the app has — but NOT on the
  // learner's very first login (before the diagnostic is done), where the home
  // page stays a clean, menu-free landing.
  const showNavMenu = diagnosticDone;

  return (
    <header className="sticky top-0 z-30 border-b border-border-strong bg-surface/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between gap-3 px-6 py-3 sm:px-10 lg:px-14">
        <div className="flex items-center gap-2.5">
          {showNavMenu && <NavMenu mode={FRONTEND_GOAL_MODE} />}
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center border border-border-strong bg-surface-muted text-accent">
              <CandlestickIcon width={18} height={18} />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-primary">
              {appTitle}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={toggleTheme}
            className="btn-ghost !min-h-0 !px-2 !py-2"
            aria-label="Toggle light or dark mode"
          >
            {theme === "dark" ? <SunIcon width={16} height={16} /> : <MoonIcon width={16} height={16} />}
          </button>

          {isAuthed ? (
            <>
              <button
                onClick={logOut}
                className="btn-ghost hidden items-center gap-2 sm:inline-flex"
              >
                <LogoutIcon width={15} height={15} /> Log out
              </button>
              {diagnosticDone ? (
                <Link to={start.href} className="btn-primary">
                  Your tracks
                </Link>
              ) : (
                <Link to="/diagnostic" className="btn-primary">
                  Diagnostic
                </Link>
              )}
            </>
          ) : (
            <>
              <Link to="/login?mode=login" className="btn-ghost hidden sm:inline-flex">
                Log in
              </Link>
              <Link to="/login" className="btn-primary">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ---------------- Hero ---------------- */
function Hero() {
  const { isAuthed, username } = useAuth();
  const { progress } = useProgress();
  const start = useStartTarget();
  const resuming = useHasProgress();
  const diagnosticDone = !!progress.diagnosticDoneAt;

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-screen-2xl items-center px-6 pb-14 pt-10 sm:px-10 lg:px-14">
      <div className="w-full max-w-3xl">
        <div>
          <span className="label text-accent">Quant trader OA &amp; interview prep</span>
          <h1 className="mt-3 font-display text-[2.75rem] font-black leading-[1.03] tracking-tight text-primary sm:text-6xl">
            Get quant-trader interview ready.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-secondary">
            One ordered path from first principles to a two-sided market under a
            timer.
          </p>

          {isAuthed ? (
            <>
              <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
                {diagnosticDone ? (
                  <>
                    <Link to={start.href} className="btn-primary sm:px-8">
                      {resuming ? "Continue" : "Start"}: {start.label}
                    </Link>
                    <Link to="/contents" className="btn-secondary sm:px-8">
                      Browse all sections
                    </Link>
                  </>
                ) : (
                  <Link to="/diagnostic" className="btn-primary sm:px-8">
                    Take the diagnostic
                  </Link>
                )}
              </div>
              <p className="label mt-4 text-[9px]">
                {diagnosticDone
                  ? `Signed in as ${username}. Pick up where you left off.`
                  : `Signed in as ${username}. Start with a quick diagnostic.`}
              </p>
            </>
          ) : (
            <>
              <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
                <Link to="/login" className="btn-primary sm:px-8">
                  Get started
                </Link>
                <Link to="/login?mode=login" className="btn-secondary sm:px-8">
                  I have an account
                </Link>
              </div>
              <p className="label mt-4 text-[9px]">
                Local-first. No email or API keys required.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------------- How it works ---------------- */
function HowItWorks() {
  const steps = [
    [
      "01",
      "Take the diagnostic",
      "A short placement finds where you actually stand, so you start at the right level instead of guessing.",
    ],
    [
      "02",
      "Practice what firms test",
      "Adaptive reps across probability and EV, timed mental math, brainteasers, and market-making games.",
    ],
    [
      "03",
      "Rehearse the real gates",
      "Timed OA sections and firm-style mock interviews, so the format feels familiar before it counts.",
    ],
    [
      "04",
      "Track mastery and readiness",
      "A roadmap and mastery view show what you have locked in and what to work on next.",
    ],
  ];
  return (
    <section className="mx-auto w-full max-w-screen-2xl border-t border-subtle px-6 py-14 sm:px-10 sm:py-16 lg:px-14">
      <div className="max-w-2xl">
        <span className="label text-accent">How it works</span>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-primary">
          A guided path from first practice to interview day.
        </h2>
      </div>
      <div className="mt-9 grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2">
        {steps.map(([n, t, d]) => (
          <div key={n} className="flex gap-4 border-t border-subtle pt-5">
            <span className="num text-sm font-semibold text-accent">{n}</span>
            <div>
              <h3 className="font-display text-lg font-semibold text-primary">{t}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-secondary">{d}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- What you'll practice ---------------- */
function WhatYouPractice() {
  const { isAuthed } = useAuth();
  return (
    <section className="mx-auto w-full max-w-screen-2xl border-t border-subtle px-6 py-14 sm:px-10 sm:py-16 lg:px-14">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <span className="label text-accent">What you'll practice</span>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-primary">
            The skills the trader funnel actually tests.
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-secondary">
            Every section maps to a real part of the quant-trader hiring
            process: the probability and expected-value reasoning on online
            assessments, the fast mental math that gates many first rounds, the
            classic brainteasers, and the two-sided market-making games from
            superdays.
          </p>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-secondary">
            The topics and difficulty are grounded in a sweep of trader-track
            requirements across many firms, so you practice what you will
            actually be asked.
          </p>
        </div>
        <div>
          <CurriculumVisual linked={isAuthed} />
        </div>
      </div>
    </section>
  );
}

/* ---------------- Feature deep-dive ---------------- */
function Feature({
  kicker,
  title,
  body,
  bullets,
  visual,
  reverse,
  id,
}: {
  kicker: string;
  title: string;
  body: string;
  bullets?: string[];
  visual: ReactNode;
  reverse?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="mx-auto w-full max-w-screen-2xl scroll-mt-24 border-t border-subtle px-6 py-14 sm:px-10 sm:py-16 lg:px-14"
    >
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className={reverse ? "lg:order-2" : ""}>
          <span className="label text-accent">{kicker}</span>
          <h2 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-primary sm:text-3xl">
            {title}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-secondary">{body}</p>
          {bullets && (
            <ul className="mt-5 space-y-2.5">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="text-[15px] leading-snug text-primary">{b}</span>
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

/* ---------------- Closing CTA ---------------- */
function ClosingCTA() {
  const { isAuthed } = useAuth();
  const { progress } = useProgress();
  const start = useStartTarget();
  const resuming = useHasProgress();
  const diagnosticDone = !!progress.diagnosticDoneAt;

  return (
    <section className="mx-auto w-full max-w-screen-2xl px-6 py-16 sm:px-10 lg:px-14">
      <div className="border-t border-subtle pt-12 text-center">
        <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight text-primary sm:text-4xl">
          Start where you stand. Build toward the offer.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-secondary">
          {isAuthed
            ? "Pick up your path and clear your next topic."
            : "Take the diagnostic and get a plan built around what you already know."}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row">
          {isAuthed ? (
            diagnosticDone ? (
              <Link to={start.href} className="btn-primary sm:px-10">
                {resuming ? "Continue" : "Start"}: {start.label}
              </Link>
            ) : (
              <Link to="/diagnostic" className="btn-primary sm:px-10">
                Take the diagnostic
              </Link>
            )
          ) : (
            <>
              <Link to="/login" className="btn-primary sm:px-10">
                Get started
              </Link>
              <Link to="/login?mode=login" className="btn-secondary sm:px-10">
                Log in
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
  const appTitle = useAppTitle();
  const cols = [
    ["Practice", ["Probability & statistics", "Mental math", "Brainteasers", "Interview games"]],
    ["Prepare", ["Diagnostic placement", "Timed OA sections", "Mock interviews"]],
    ["Track", ["Readiness roadmap", "Mastery dashboard", "Guided hint ladder"]],
  ] as const;
  return (
    <footer className="mx-auto w-full max-w-screen-2xl border-t border-subtle px-6 py-10 sm:px-10 lg:px-14">
      <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center border border-border-strong text-primary">
              <CandlestickIcon width={16} height={16} />
            </span>
            <span className="font-display text-base font-bold text-primary">
              {appTitle}
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-secondary">
            Focused, adaptive practice for quant-trader online assessments and
            interviews.
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
      <div className="mt-9 border-t border-subtle pt-5">
        <span className="label text-[9px]">
          © {new Date().getFullYear()} {appTitle}. Local edition.
        </span>
      </div>
    </footer>
  );
}

/* ---------------- Page ---------------- */
export function LandingPage() {
  return (
    <div className="relative min-h-[100dvh]">
      <ThemeBackground />
      <CardShuffleIntro />
      <div className="relative z-10">
        <LandingHeader />

        <Hero />
        <HowItWorks />
        <WhatYouPractice />

        <Feature
          id="path"
          kicker="A guided path"
          title="One ordered path, not a pile of tabs."
          body="Topics unlock in a deliberate order, from fundamentals to interview-hard. Each one opens only after you master the last, so you always know exactly what to learn next instead of assembling your own curriculum from scattered sources."
          bullets={[
            "Beginner to interview-ready, in a considered order",
            "Mastery-gated: clear a topic to unlock the next",
            "Your progress, streak, and best scores are saved",
          ]}
          visual={<RoadmapVisual />}
        />

        <Feature
          kicker="Coaching, not answers"
          title="Build the reasoning interviewers probe for."
          body="Miss a problem and you don't get the solution dumped on you. A five-rung hint ladder escalates only as much as you need. It names the trap, helps you plan, walks a worked sibling, and lets you confront a simulation, while the final answer stays withheld until the last rung."
          bullets={[
            "Hints keyed to the specific mistake you made",
            "The final answer is withheld through the first four rungs",
            "You practice reproducing the reasoning, not memorizing it",
          ]}
          visual={<HintLadderVisual />}
          reverse
        />

        <Feature
          kicker="Fresh every time"
          title="Practice that can't be memorized or leaked."
          body="Every problem is generated fresh and checked by an exact verifier, so the answer is provably correct and you get a new instance each time. Static banks get memorized and go stale the moment a firm changes its test. These never run out and never go stale."
          bullets={[
            "Exact-verifier ground truth on every question",
            "Distractors are real mistakes, so nothing gives the answer away",
            "Unlimited fresh reps on every concept",
          ]}
          visual={<FreshVisual />}
        />

        <ClosingCTA />
        <Footer />
      </div>
    </div>
  );
}
