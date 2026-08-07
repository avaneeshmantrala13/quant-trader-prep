import { Link, useNavigate } from "react-router-dom";
import { ChevronLeftIcon, GaugeIcon } from "@/components/icons";
import {
  useRoadmapData,
  type RoadmapCoursePath,
  type RoadmapModel,
} from "@/components/roadmap/useRoadmapData";
import { SkillGraph } from "@/components/roadmap/SkillGraph";

/**
 * `/roadmap` — the Readiness Pathway, rebuilt as a CS-style GRAPH of the
 * Knowledge State Tree. Instead of a flat list of tiers, the prerequisite DAG
 * (`@/lib/roadmap/skillGraph`) is drawn as a directed graph: NODES are topics,
 * EDGES are prerequisite relationships (arrow from a prereq into what it
 * unlocks). Nodes are coloured by mastery (mastered / in-progress / ready /
 * locked) and the edges leading into mastered nodes light up, so the pathway
 * visibly illuminates as the learner masters more topics. Clicking a node jumps
 * straight to that topic's practice (the same deep-link the list used).
 *
 * A thin, token-themed CONTAINER: all logic still lives in the pure roadmap
 * modules (`@/lib/roadmap/*`) and the `useRoadmapData` hook; the new graph is a
 * pure presentational component (`@/components/roadmap/SkillGraph`). Everything
 * is styled with the semantic theme tokens so it tracks every theme's colours,
 * fonts, and light/dark automatically.
 */

function ReadinessGauge({
  readiness,
  masteredCount,
  totalCount,
  remainingCount,
}: {
  readiness: number;
  masteredCount: number;
  totalCount: number;
  remainingCount: number;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2">
        <GaugeIcon width={16} height={16} />
        <span className="label text-secondary">Interview readiness</span>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="num text-4xl font-black text-primary">{readiness}%</span>
        <span className="mb-1 text-xs text-muted">
          weighted across every skill
        </span>
      </div>
      <div
        className="relative mt-3 h-3 w-full overflow-hidden border border-subtle bg-surface-muted"
        role="progressbar"
        aria-valuenow={readiness}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Overall interview readiness"
      >
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${readiness}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-secondary">
        <span className="num text-primary">{masteredCount}</span> of{" "}
        <span className="num text-primary">{totalCount}</span> skills mastered
        {remainingCount > 0 ? (
          <>
            {" "}
            · <span className="num text-primary">{remainingCount}</span> to go
          </>
        ) : (
          <> · you're fully ready, keep it sharp</>
        )}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Case A — the two-course roadmap (WS3)                                      */
/* -------------------------------------------------------------------------- */

/**
 * One Case-A course path: its per-path progress bar plus the course's topics
 * drawn as a prerequisite graph. Reuses the SAME `SkillGraph` as the interview
 * pathway — this is purely a regrouping of the same rows by course.
 */
function CoursePathSection({ path }: { path: RoadmapCoursePath }) {
  return (
    <section className="panel p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-primary">
          {path.label}
        </h2>
        <span className="num shrink-0 text-xs text-secondary">
          {path.masteredCount}/{path.totalCount} mastered
        </span>
      </div>
      <p className="mt-1 text-sm text-secondary">{path.blurb}</p>

      {/* Overall progress toward completing this course. */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="label text-secondary">Course progress</span>
          <span className="num text-xs text-muted">{path.readiness}%</span>
        </div>
        <div
          className="h-3 w-full overflow-hidden border border-subtle bg-surface-muted"
          role="progressbar"
          aria-valuenow={path.readiness}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${path.label} progress`}
        >
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${path.readiness}%` }}
          />
        </div>
      </div>

      <div className="mt-4">
        <SkillGraph
          rows={path.rows}
          currentKey={path.currentKey}
          ariaLabel={`${path.label} prerequisite graph`}
        />
      </div>
    </section>
  );
}

/** The Case-A roadmap: two course paths instead of the interview tiers. */
function CourseRoadmap({
  model,
  onBack,
}: {
  model: RoadmapModel;
  onBack: () => void;
}) {
  const { coursePaths, diagnosticDone } = model;
  return (
    <div className="relative min-h-[100dvh] bg-surface">
      <header className="sticky top-0 z-20 border-b-[3px] border-border-strong bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <button
            onClick={onBack}
            className="btn-ghost !min-h-0 !px-2 !py-1.5"
            aria-label="Back to contents"
          >
            <ChevronLeftIcon width={18} height={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-semibold text-primary">
              Course Roadmap
            </div>
          </div>
          <Link
            to="/dashboard"
            className="btn-ghost !min-h-0 shrink-0 !px-2 !py-1.5 text-xs"
          >
            Dashboard ▸
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl space-y-6 px-4 py-6">
        <section className="panel-ruled p-6">
          <span className="label text-accent">Your Two Course Paths</span>
          <h1 className="mt-1 font-display text-2xl font-black text-primary sm:text-3xl">
            Course Roadmap
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">
            Two guided paths: <strong>Intro to Probability</strong> and{" "}
            <strong>Intro to Stochastic Processes</strong>, each ordered so
            every topic builds on the ones before it. Each course is drawn as a
            prerequisite graph — master a topic to light up the arrows leading
            out of it and open what comes next.
          </p>

          {!diagnosticDone && (
            <p className="mt-3 border border-accent/50 bg-surface px-3 py-2 text-sm text-secondary">
              Run the calibration warm-up first; it seeds an accurate starting
              picture across both courses.{" "}
              <Link
                to="/diagnostic"
                className="font-semibold text-accent underline underline-offset-2"
              >
                Run it now ▸
              </Link>
            </p>
          )}
        </section>

        {coursePaths.map((path) => (
          <CoursePathSection key={path.id} path={path} />
        ))}
      </main>
    </div>
  );
}

export function RoadmapPage() {
  const navigate = useNavigate();
  const model = useRoadmapData();
  const { state, currentRow, diagnosticDone } = model;

  // Case A ("course"): regroup the pathway into the two UT course paths. Case B
  // (interview / unset) renders the interview knowledge graph below.
  if (model.goalMode === "course") {
    return <CourseRoadmap model={model} onBack={() => navigate("/contents")} />;
  }

  return (
    <div className="relative min-h-[100dvh] bg-surface">
      <header className="sticky top-0 z-20 border-b-[3px] border-border-strong bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <button
            onClick={() => navigate("/contents")}
            className="btn-ghost !min-h-0 !px-2 !py-1.5"
            aria-label="Back to contents"
          >
            <ChevronLeftIcon width={18} height={18} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-semibold text-primary">
              Readiness Roadmap
            </div>
          </div>
          <Link
            to="/dashboard"
            className="btn-ghost !min-h-0 shrink-0 !px-2 !py-1.5 text-xs"
          >
            Dashboard ▸
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl space-y-6 px-4 py-6">
        <section className="panel-ruled p-6">
          <span className="label text-accent">Your Pathway to Interview-Ready</span>
          <h1 className="mt-1 font-display text-2xl font-black text-primary sm:text-3xl">
            Skill Roadmap
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">
            A single prerequisite-respecting pathway across every track, ordered
            from the timed-arithmetic screen up through stochastic processes and
            market making, grounded in UT Austin's M362K / M362M sequences and
            the quant-interview canon. Master each skill to climb toward full
            readiness for quant OAs and interviews.
          </p>

          {!diagnosticDone && (
            <p className="mt-3 border border-accent/50 bg-surface px-3 py-2 text-sm text-secondary">
              Run the calibration warm-up first; it seeds an accurate starting
              picture across this whole pathway.{" "}
              <Link
                to="/diagnostic"
                className="font-semibold text-accent underline underline-offset-2"
              >
                Run it now ▸
              </Link>
            </p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ReadinessGauge
              readiness={state.overallReadiness}
              masteredCount={state.masteredCount}
              totalCount={state.totalCount}
              remainingCount={state.remainingCount}
            />
            <div className="panel p-5">
              <span className="label text-secondary">Where you are now</span>
              {currentRow ? (
                <>
                  <div className="mt-1 font-display text-lg font-semibold text-primary">
                    {currentRow.name}
                  </div>
                  <div className="label text-muted">
                    {currentRow.progress.masteryPct}% mastered · next up on your
                    path
                  </div>
                  <Link
                    to={currentRow.href}
                    className="btn-primary mt-3 block w-full text-center text-sm"
                  >
                    Continue with {currentRow.name} ▸
                  </Link>
                </>
              ) : state.complete ? (
                <p className="mt-1 text-sm text-secondary">
                  Every skill on the pathway is mastered: you're fully ready.
                  Keep skills sharp with spaced review from the Dashboard.
                </p>
              ) : (
                <p className="mt-1 text-sm text-secondary">
                  Start with the foundations below to open the rest of the
                  pathway.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* The Knowledge State Tree, drawn as a directed prerequisite graph. */}
        <section className="panel p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-primary">
              Knowledge State Tree
            </h2>
            <span className="num shrink-0 text-xs text-secondary">
              {state.masteredCount}/{state.totalCount} mastered
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-secondary">
            Every node is a skill; each arrow points from a prerequisite into the
            topic it unlocks. Nodes light up as you master them, and the arrows
            leading into mastered skills illuminate to show your progression.
            Click any node to practice it.
          </p>
          <div className="mt-4">
            <SkillGraph
              rows={model.rows}
              currentKey={state.currentSkillKey}
              ariaLabel="Interview readiness knowledge state graph"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
