import { Link } from "react-router-dom";
import type { DashboardViewProps } from "./types";
import { ChevronLeftIcon } from "@/components/icons";
import { TopicCard } from "@/components/dashboard/TopicCard";
import { WeaknessList } from "@/components/dashboard/WeaknessList";
import { ReviewsDue } from "@/components/dashboard/ReviewsDue";
import { ReliabilityDiagram } from "@/components/dashboard/ReliabilityDiagram";

/**
 * BASE Dashboard renderer — the default, theme-agnostic Mastery & Calibration
 * dashboard mounted by `src/pages/DashboardPage.tsx` whenever the active theme
 * does NOT supply its own `Dashboard` component. Styled purely with the semantic
 * theme tokens / component classes (`.panel`, `.chip`, `.label`, …), so it
 * already tracks every theme's colors, fonts, and light/dark automatically.
 *
 * It is also the reference implementation for the per-theme dashboard contract:
 * a theme's `Dashboard` (at `src/themes/<id>/Dashboard.tsx`) may delegate to
 * `BaseDashboard` and progressively replace it with a bespoke design. Like the
 * ToC contract, ALL data + routes are OWNED by the page/props — this renderer
 * only styles what it receives, never fetching data or building routes.
 */
export function BaseDashboard({
  diagnosticDone,
  diagnosticHref,
  contentsHref,
  recommended,
  topics,
  weaknesses,
  due,
  reliability,
}: DashboardViewProps) {
  return (
    <div className="relative min-h-[100dvh] bg-surface">
      <header className="sticky top-0 z-20 border-b-[3px] border-border-strong bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <Link
            to={contentsHref}
            className="btn-ghost !min-h-0 !px-2 !py-1.5"
            aria-label="Back to contents"
          >
            <ChevronLeftIcon width={18} height={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-semibold text-primary">
              Mastery Dashboard
            </div>
          </div>
          <Link
            to={diagnosticHref}
            className="btn-ghost !min-h-0 shrink-0 !px-2 !py-1.5 text-xs"
          >
            {diagnosticDone ? "Retake warm-up ↻" : "Run warm-up ▸"}
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl space-y-6 px-4 py-6">
        {/* 1) Headline: recommended next focus + reviews-due + diagnostic nudge */}
        <section className="panel-ruled p-6">
          <span className="label text-accent">Your Desk · Read-Only</span>
          <h1 className="mt-1 font-display text-2xl font-black text-primary sm:text-3xl">
            Mastery & Calibration
          </h1>

          {!diagnosticDone && (
            <p className="mt-3 border border-accent/50 bg-surface px-3 py-2 text-sm text-secondary">
              You haven't run the calibration warm-up yet — it tunes where your
              practice starts.{" "}
              <Link
                to={diagnosticHref}
                className="font-semibold text-accent underline underline-offset-2"
              >
                Run it now ▸
              </Link>
            </p>
          )}

          {/* Link to the ordered readiness pathway (Roadmap). */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border border-subtle bg-surface-muted px-3 py-2">
            <span className="text-sm text-secondary">
              See the full skill pathway and how ready you are for interviews.
            </span>
            <Link
              to="/roadmap"
              className="btn-secondary !min-h-0 shrink-0 !px-3 !py-1.5 text-sm"
            >
              Open the Roadmap ▸
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="panel p-4">
              <div className="label text-secondary">Recommended next focus</div>
              {recommended ? (
                <>
                  <div className="mt-1 font-display text-lg font-semibold text-primary">
                    {recommended.name}
                  </div>
                  <div className="label text-muted">
                    {recommended.trackTitle} · CI_low{" "}
                    {Math.round(recommended.ciLow * 100)}%
                  </div>
                  <Link
                    to={recommended.href}
                    className="btn-primary mt-3 block w-full text-center text-sm"
                  >
                    Practice {recommended.name} ▸
                  </Link>
                </>
              ) : (
                <p className="mt-1 text-sm text-secondary">
                  No clear weak spot yet — explore a new topic or run the warm-up
                  to seed your starting point.
                </p>
              )}
            </div>

            <div className="panel p-4">
              <div className="label text-secondary">Reviews due</div>
              <div className="num mt-1 text-3xl font-semibold text-primary">
                {due.length}
              </div>
              <p className="mt-1 text-xs text-muted">
                Mastered topics resurface on their SM-2 spaced-review schedule.
              </p>
            </div>
          </div>
        </section>

        {/* 2) Reviews due */}
        {due.length > 0 && (
          <section className="panel p-5">
            <h2 className="label mb-3 text-accent">Due for Review</h2>
            <ReviewsDue topics={due} />
          </section>
        )}

        {/* 3) Weakness ranking by CI_low */}
        <section className="panel p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="label text-accent">Weakest First · by CI_low</h2>
            <span className="label text-muted">
              {weaknesses.length} topics with evidence
            </span>
          </div>
          <WeaknessList topics={weaknesses} />
        </section>

        {/* 4) Accuracy × calibration reliability diagram */}
        <section className="panel p-5">
          <h2 className="label mb-3 text-accent">Calibration · Reliability</h2>
          <ReliabilityDiagram data={reliability} />
        </section>

        {/* 5) Per-topic cards */}
        <section>
          <h2 className="label mb-3 text-accent">All Topics</h2>
          {topics.length === 0 ? (
            <p className="text-sm text-secondary">No topics available.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topics.map((t) => (
                <TopicCard key={t.topicKey} topic={t} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
