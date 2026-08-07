import { useMemo } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useProgress } from "@/context/ProgressContext";
import { getTrack } from "@/content";
import { DIFFICULTY_META, totalQuestions, type Level } from "@/types/content";
import { CheckIcon, LockIcon, ChevronLeftIcon, MOTIF_ICON } from "@/components/icons";
import { levelLockState } from "@/lib/locking";
import { topicKeyForLevel } from "@/lib/mastery/topicKey";
import { seedUnlockedLevelIds } from "@/lib/mastery/unlockGraph";
import {
  getCourse,
  type CourseMeta,
} from "@/lib/mode/courseMap";

/**
 * `/course/:courseId` — the Case-A COURSE curation page (WS2, Option A).
 *
 * This is a PROJECTION over existing content, not new lesson UI: it curates the
 * probability track's topics into one ordered course "route" using the
 * `courseMap` grouping, reusing the SAME per-section lock state and the SAME
 * immersive lesson routes (`/track/:trackId/level/:levelId`). Deep links, mastery,
 * locking, and the hint ladder are all unchanged — Case B is unaffected because
 * this is an additive route.
 *
 * The internal M362K/M362M code is NEVER shown; the learner only sees the course
 * label ("Intro to Probability" / "Intro to Stochastic Processes").
 */

interface CourseTopicGroup {
  topicKey: string;
  /** Section label (the topic name shown to the learner). */
  label: string;
  /** True for shared/upstream topics displayed but owned by the other course. */
  shared: boolean;
  levels: { level: Level; globalIndex: number }[];
  masteredCount: number;
}

export function CourseTrackPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { getLevelProgress, getTopicMastery } = useProgress();

  const course: CourseMeta | undefined = courseId ? getCourse(courseId) : undefined;
  const track = getTrack("probability");

  const isMastered = (id: string) => !!getLevelProgress(id)?.mastered;

  // Diagnostic low-confidence unlocks: level ids whose TOPIC is currently
  // unlocked (Beta mean over the bar) — opens the whole topic ahead of mastery
  // and re-locks live when a failing quiz swings the mean back under the bar.
  const seedUnlocked = useMemo(() => {
    const set = track
      ? seedUnlockedLevelIds(track.levels, track.id, getTopicMastery)
      : new Set<string>();
    return (id: string) => set.has(id);
    // getTopicMastery derives from progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, getTopicMastery]);

  // Group the probability track's levels by the course's topics, in course order
  // (primary topics first, then shared/upstream). We keep each level's GLOBAL
  // index in the real track so per-section lock state stays exactly correct.
  const groups = useMemo<CourseTopicGroup[]>(() => {
    if (!course || !track) return [];
    const bySection = new Map<string, { level: Level; globalIndex: number }[]>();
    track.levels.forEach((level, globalIndex) => {
      const key = topicKeyForLevel(track.id, level);
      const arr = bySection.get(key) ?? [];
      arr.push({ level, globalIndex });
      bySection.set(key, arr);
    });

    const sharedSet = new Set(course.sharedTopicKeys);
    const ordered = [...course.topicKeys, ...course.sharedTopicKeys];
    const out: CourseTopicGroup[] = [];
    for (const topicKey of ordered) {
      const levels = bySection.get(topicKey);
      if (!levels || levels.length === 0) continue;
      out.push({
        topicKey,
        label: levels[0].level.section ?? topicKey,
        shared: sharedSet.has(topicKey),
        levels,
        masteredCount: levels.filter((l) => isMastered(l.level.id)).length,
      });
    }
    return out;
    // isMastered derives from progress via getLevelProgress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course, track, getLevelProgress]);

  if (!course || !track) return <Navigate to="/" replace />;

  const totalLevels = groups.reduce((s, g) => s + g.levels.length, 0);
  const masteredLevels = groups.reduce((s, g) => s + g.masteredCount, 0);
  const masteredTopics = groups.filter(
    (g) => !g.shared && g.masteredCount === g.levels.length && g.levels.length > 0,
  ).length;
  const primaryTopicCount = groups.filter((g) => !g.shared).length;
  const Icon = MOTIF_ICON[track.motif];

  return (
    <div className="space-y-5">
      {/* Course header */}
      <header className="panel-ruled p-5">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate("/contents")}
            className="btn-ghost !min-h-0 shrink-0 !px-2 !py-1.5"
            aria-label="Back to contents"
          >
            <ChevronLeftIcon width={18} height={18} />
          </button>
          <span className="hidden h-12 w-12 shrink-0 place-items-center border border-border-strong text-primary sm:grid">
            <Icon width={26} height={26} />
          </span>
          <div className="min-w-0 flex-1">
            <span className="label text-accent">Course · Curated Route</span>
            <h1 className="mt-0.5 font-display text-2xl font-black text-primary sm:text-3xl">
              {course.label}
            </h1>
            <p className="mt-1 text-sm text-secondary">{course.blurb}</p>
          </div>
          <div className="hidden flex-col items-end sm:flex">
            <span className="label text-[9px]">Topics Mastered</span>
            <span className="num text-2xl font-semibold text-primary">
              {masteredTopics}/{primaryTopicCount}
            </span>
          </div>
        </div>

        {/* Course-readiness bar */}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="label text-secondary">Course progress</span>
            <span className="num text-xs text-muted">
              {masteredLevels}/{totalLevels} lessons
            </span>
          </div>
          <div className="h-2 w-full border border-subtle bg-surface">
            <div
              className="h-full bg-accent transition-all"
              style={{
                width: `${totalLevels > 0 ? (masteredLevels / totalLevels) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </header>

      {/* Topic sections */}
      {groups.map((g) => (
        <section key={g.topicKey} className="panel p-5">
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-subtle pb-2">
            <h2 className="font-display text-lg font-semibold text-primary">
              {g.label}
            </h2>
            <div className="flex items-center gap-2">
              {g.shared && (
                <span className="chip border-subtle text-muted">
                  Shared · upstream
                </span>
              )}
              <span className="num text-xs text-secondary">
                {g.masteredCount}/{g.levels.length}
              </span>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.levels.map(({ level, globalIndex }) => {
              const state = levelLockState(
                track.levels,
                globalIndex,
                isMastered,
                seedUnlocked,
              );
              const clickable = state !== "locked";
              return (
                <button
                  key={level.id}
                  disabled={!clickable}
                  onClick={() =>
                    navigate(`/track/${track.id}/level/${level.id}`)
                  }
                  className={[
                    "flex items-center gap-3 border p-3 text-left transition-colors min-h-[44px]",
                    state === "mastered"
                      ? "border-bull/60 bg-success-soft"
                      : state === "unlocked"
                        ? "border-subtle bg-surface hover:bg-surface-muted"
                        : "cursor-not-allowed border-subtle bg-surface-muted opacity-60",
                  ].join(" ")}
                  title={
                    state === "locked"
                      ? `Master “${track.levels[globalIndex - 1]?.title ?? ""}” first`
                      : level.title
                  }
                >
                  <span
                    className={[
                      "grid h-8 w-8 shrink-0 place-items-center border font-mono text-xs font-semibold",
                      state === "mastered"
                        ? "border-bull bg-bull text-bg"
                        : state === "unlocked"
                          ? "border-accent text-accent"
                          : "border-subtle text-muted",
                    ].join(" ")}
                  >
                    {state === "mastered" ? (
                      <CheckIcon width={16} height={16} />
                    ) : state === "locked" ? (
                      <LockIcon width={14} height={14} />
                    ) : (
                      String(globalIndex + 1).padStart(2, "0")
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-sm font-semibold text-primary">
                      {level.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <span className="chip border-subtle text-secondary">
                        {DIFFICULTY_META[level.difficulty].label}
                      </span>
                      <span className="num text-[11px] text-muted">
                        {totalQuestions(level)}Q
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
