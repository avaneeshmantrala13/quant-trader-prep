import { Link, useNavigate } from "react-router-dom";
import {
  CheckIcon,
  ChevronLeftIcon,
  GaugeIcon,
  LockIcon,
} from "@/components/icons";
import {
  useRoadmapData,
  type RoadmapSkillRow,
  type RoadmapTierGroup,
} from "@/components/roadmap/useRoadmapData";
import type { SkillStatus } from "@/lib/roadmap/readiness";

/**
 * `/roadmap` — the Readiness Pathway. Turns the sprawling catalog into a single
 * ordered, prerequisite-respecting pathway (see `datasets/CURRICULUM_ROADMAP.md`)
 * with an overall readiness indicator, "where you are now," and how much is left
 * before the learner is ready to attempt quant OAs and interviews.
 *
 * A thin, token-themed CONTAINER: all logic is in the pure roadmap modules
 * (`@/lib/roadmap/*`) and the `useRoadmapData` hook. Styled purely with the
 * semantic theme tokens / component classes so it tracks every theme's colors,
 * fonts, and light/dark automatically (no per-theme override needed — see the
 * placement rationale in the task report / provenance doc).
 */

const STATUS_META: Record<
  SkillStatus,
  { label: string; chip: string; dot: string }
> = {
  mastered: {
    label: "Mastered",
    chip: "border-bull/60 text-bull",
    dot: "bg-bull",
  },
  "in-progress": {
    label: "In progress",
    chip: "border-accent/60 text-accent",
    dot: "bg-accent",
  },
  available: {
    label: "Ready to start",
    chip: "border-subtle text-secondary",
    dot: "bg-secondary",
  },
  locked: {
    label: "Locked",
    chip: "border-subtle text-muted",
    dot: "bg-muted",
  },
};

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
          <> · you're fully ready — keep it sharp</>
        )}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="label text-muted">{label}</span>
      <span className="num text-sm text-primary">{value}</span>
    </div>
  );
}

function SkillRow({
  row,
  isCurrent,
}: {
  row: RoadmapSkillRow;
  isCurrent: boolean;
}) {
  const { progress: p } = row;
  const meta = STATUS_META[p.status];
  const locked = p.status === "locked";

  return (
    <details
      className={`group border ${
        isCurrent ? "border-accent" : "border-subtle"
      } bg-surface`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 marker:content-none hover:bg-surface-muted">
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${
            p.mastered
              ? "border-bull text-bull"
              : locked
                ? "border-subtle text-muted"
                : "border-accent text-accent"
          }`}
          aria-hidden="true"
        >
          {p.mastered ? (
            <CheckIcon width={14} height={14} />
          ) : locked ? (
            <LockIcon width={13} height={13} />
          ) : (
            <span className="num text-xs font-semibold">{p.masteryPct}</span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-display text-sm font-semibold text-primary">
              {row.name}
            </span>
            {isCurrent && (
              <span className="chip border-accent text-accent">You are here</span>
            )}
          </span>
          {/* Per-skill mastery bar. */}
          <span className="mt-1.5 block h-1.5 w-full overflow-hidden border border-subtle bg-surface-muted">
            <span
              className={`block h-full ${p.mastered ? "bg-bull" : "bg-accent"}`}
              style={{ width: `${p.masteryPct}%` }}
            />
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className={`chip ${meta.chip}`}>{meta.label}</span>
          <span className="num text-xs text-secondary">{p.masteryPct}%</span>
        </span>
      </summary>

      <div className="border-t border-subtle bg-surface p-3">
        <p className="text-xs leading-relaxed text-muted">{row.node.source}</p>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Mastered"
            value={`${p.masteryPct}%`}
          />
          <Stat
            label="Raw accuracy"
            value={p.meanPct != null ? `${p.meanPct}%` : "—"}
          />
          <Stat label="Graded items" value={String(p.gradedCount)} />
          <Stat
            label="Levels"
            value={`${p.levelsMastered}/${p.levelsTotal}`}
          />
        </div>

        {locked && row.missingPrereqNames.length > 0 && (
          <p className="mt-3 border border-subtle bg-surface-muted px-3 py-2 text-xs text-secondary">
            Unlocks after mastering:{" "}
            <span className="font-semibold text-primary">
              {row.missingPrereqNames.join(", ")}
            </span>
          </p>
        )}

        <Link
          to={row.href}
          className={`mt-3 block w-full text-center text-sm ${
            locked ? "btn-ghost" : "btn-primary"
          }`}
        >
          {p.mastered
            ? "Review this skill ↻"
            : locked
              ? "Preview this skill ▸"
              : `Practice ${row.name} ▸`}
        </Link>
      </div>
    </details>
  );
}

function TierSection({
  tier,
  currentKey,
}: {
  tier: RoadmapTierGroup;
  currentKey?: string;
}) {
  return (
    <section className="panel p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-primary">
          {tier.label}
        </h2>
        <span className="num shrink-0 text-xs text-secondary">
          {tier.masteredCount}/{tier.totalCount}
        </span>
      </div>
      <p className="mt-1 text-sm text-secondary">{tier.blurb}</p>
      <div className="mt-4 flex flex-col gap-2">
        {tier.rows.map((row) => (
          <SkillRow
            key={row.node.topicKey}
            row={row}
            isCurrent={row.node.topicKey === currentKey}
          />
        ))}
      </div>
    </section>
  );
}

export function RoadmapPage() {
  const navigate = useNavigate();
  const model = useRoadmapData();
  const { state, currentRow, diagnosticDone } = model;

  return (
    <div className="relative min-h-[100dvh] bg-surface">
      <header className="sticky top-0 z-20 border-b-[3px] border-border-strong bg-surface">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-2.5">
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

      <main className="relative z-10 mx-auto max-w-4xl space-y-6 px-4 py-6">
        <section className="panel-ruled p-6">
          <span className="label text-accent">Your Pathway to Interview-Ready</span>
          <h1 className="mt-1 font-display text-2xl font-black text-primary sm:text-3xl">
            Skill Roadmap
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">
            A single prerequisite-respecting pathway across every track, ordered
            from the timed-arithmetic screen up through stochastic processes and
            market making — grounded in UT Austin's M362K / M362M sequences and
            the quant-interview canon. Master each skill to climb toward full
            readiness for quant OAs and interviews.
          </p>

          {!diagnosticDone && (
            <p className="mt-3 border border-accent/50 bg-surface px-3 py-2 text-sm text-secondary">
              Run the calibration warm-up first — it seeds an accurate starting
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
                  Every skill on the pathway is mastered — you're fully ready.
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

        {model.tiers.map((tier) => (
          <TierSection
            key={tier.id}
            tier={tier}
            currentKey={state.currentSkillKey}
          />
        ))}
      </main>
    </div>
  );
}
