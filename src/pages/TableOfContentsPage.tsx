import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useProgress } from "@/context/ProgressContext";
import { useTheme } from "@/context/ThemeContext";
import { TRACKS } from "@/content";
import { DIFFICULTY_META, totalQuestions } from "@/types/content";
import { levelLockState } from "@/lib/locking";
import { seedUnlockedLevelIds } from "@/lib/mastery/unlockGraph";
import { BaseTableOfContents } from "@/themes/BaseTableOfContents";
import type {
  TocComingSoonTrack,
  TocLessonItem,
  TocLessonState,
  TocTrack,
} from "@/themes/types";

/**
 * The Table of Contents page (`/contents`) — the CONTAINER that owns all data
 * and behavior for the whole-page ToC. It:
 *   1. gathers every track and lesson from the content layer,
 *   2. computes each lesson's locked/unlocked/mastered state using the SAME
 *      unlock + mastery logic as the progression map (first level, or previous
 *      mastered ⇒ unlocked; own mastery ⇒ mastered),
 *   3. builds the theme-agnostic `TocViewProps`, and
 *   4. renders the ACTIVE theme's `TableOfContents` renderer if it provides one,
 *      else the shared `BaseTableOfContents`.
 *
 * Navigation and locking live HERE (in the props), so each theme only styles —
 * it never reimplements how lessons route or lock.
 */

/** The lesson route the map uses. Kept in one place so themes never build it. */
function lessonHref(trackId: string, lessonId: string): string {
  return `/track/${trackId}/level/${lessonId}`;
}

/**
 * The SINGLE SOURCE OF TRUTH for the Table of Contents explainer paragraph.
 * Every theme renders this exact plain text (no theme-specific analogy) via
 * `TocViewProps.intro`, styling only the slot — never the copy.
 */
const TOC_INTRO =
  "Browse every lesson across all four tracks. The first lesson of every topic is open right away, so start any topic you like. Within a topic, each later lesson unlocks the moment you master the one before it.";

export function TableOfContentsPage() {
  const navigate = useNavigate();
  const { getLevelProgress, getTopicMastery } = useProgress();
  const { themeDef } = useTheme();

  const isMastered = useCallback(
    (levelId: string) => !!getLevelProgress(levelId)?.mastered,
    [getLevelProgress],
  );

  const { tracks, comingSoon } = useMemo(() => {
    const playable: TocTrack[] = [];
    const soon: TocComingSoonTrack[] = [];

    for (const track of TRACKS) {
      if (track.comingSoon || track.levels.length === 0) {
        soon.push({
          id: track.id,
          title: track.title,
          tagline: track.tagline,
          description: track.description,
          motif: track.motif,
        });
        continue;
      }

      // Diagnostic low-confidence unlocks for this track (Part B): open a whole
      // topic ahead of mastery when its Beta mean clears the unlock bar.
      const seedUnlockedSet = seedUnlockedLevelIds(
        track.levels,
        track.id,
        getTopicMastery,
      );
      const isSeedUnlocked = (id: string) => seedUnlockedSet.has(id);

      let masteredCount = 0;
      const lessons: TocLessonItem[] = track.levels.map((level, i) => {
        // SAME per-section unlock + mastery logic as the progression map: a
        // lesson is unlocked when it is the first of its section, the previous
        // lesson within that section is mastered, or the diagnostic seeded a
        // low-confidence unlock for the lesson's topic (see `@/lib/locking`).
        const state: TocLessonState = levelLockState(
          track.levels,
          i,
          isMastered,
          isSeedUnlocked,
        );
        if (state === "mastered") masteredCount += 1;
        return {
          id: level.id,
          trackId: track.id,
          title: level.title,
          subtitle: level.subtitle,
          description: level.blurb,
          section: level.section,
          difficulty: level.difficulty,
          difficultyLabel: DIFFICULTY_META[level.difficulty].label,
          state,
          questionCount: totalQuestions(level),
          mode: level.mode ?? "quiz",
        };
      });

      playable.push({
        id: track.id,
        title: track.title,
        tagline: track.tagline,
        description: track.description,
        motif: track.motif,
        lessons,
        masteredCount,
        totalCount: track.levels.length,
      });
    }

    return { tracks: playable, comingSoon: soon };
  }, [isMastered, getTopicMastery]);

  const onSelectLesson = useCallback(
    (trackId: string, lessonId: string) => {
      // Guard: locked lessons never navigate (themes can wire this freely).
      const track = tracks.find((t) => t.id === trackId);
      const lesson = track?.lessons.find((l) => l.id === lessonId);
      if (!lesson || lesson.state === "locked") return;
      navigate(lessonHref(trackId, lessonId));
    },
    [navigate, tracks],
  );

  const isLocked = useCallback(
    (lesson: TocLessonItem) => lesson.state === "locked",
    [],
  );

  const ThemeToc = themeDef.TableOfContents ?? BaseTableOfContents;

  // The standing "New · Interactive Simulations & Visualizations" cross-link
  // banner was removed: it duplicated what the onboarding tour already covers
  // (it has a dedicated "simulations" coach-mark) and the Simulations tab in the
  // main nav, so it read as redundant/overwhelming. The tab remains one click
  // away in the navigation menu.
  return (
    <ThemeToc
      intro={TOC_INTRO}
      tracks={tracks}
      comingSoon={comingSoon}
      onSelectLesson={onSelectLesson}
      lessonHref={lessonHref}
      isLocked={isLocked}
    />
  );
}
