import { useMemo } from "react";
import { useProgress } from "@/context/ProgressContext";
import { PLAYABLE_TRACKS } from "@/content";
import { groupLevelsIntoTopics } from "@/lib/topics";
import { isLevelUnlockedBySection } from "@/lib/locking";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import type { TopicVerdict } from "@/lib/mastery/verdict";
import { resolveGoalMode } from "@/lib/mode/goalMode";
import { isCourseTopic } from "@/lib/mode/courseMap";
import type { GoalMode } from "@/types/progress";
import { rankWeaknesses, reviewsDue } from "@/lib/calibration/ranking";
import {
  reliabilityDiagram,
  type ReliabilityDiagramData,
} from "@/lib/calibration/reliability";
import { toCalibrationPairs } from "@/lib/calibration/persistedLog";

/**
 * Read-only dashboard model (PHASE_5 §6). This hook is a THIN consumer: it
 * enumerates topics from the content graph, pulls Phase-1 verdicts via
 * `getTopicVerdict`, and orders them with the pure `ranking`/`reliability`
 * modules. No mastery math or state mutation happens here — the dashboard is a
 * read-only view over deterministic Phase-1 state and works with every flag OFF.
 */

export interface DashboardTopic {
  topicKey: string;
  trackId: string;
  trackTitle: string;
  /** Human label: section name, or the track title for section-less tracks. */
  label: string;
  /** First level of the topic (deep-link target for "practice this"). */
  firstLevelId: string;
  /** Prereqs satisfied (from locking.ts). A topic's first level is always unlocked. */
  unlocked: boolean;
  verdict: TopicVerdict;
}

export interface DashboardModel {
  topics: DashboardTopic[];
  /** Topics with graded evidence (n > 0), for cards + ranking. */
  evidenced: DashboardTopic[];
  /** Ascending by CI_low (worst-most-confident first), evidenced only. */
  weaknesses: DashboardTopic[];
  /** Top unlocked, non-mastered weakness — the recommended next focus. */
  recommended?: DashboardTopic;
  /** Topics with a spaced review due at `now`. */
  due: DashboardTopic[];
  /** Pooled reliability diagram (insufficient-data when the session log is empty). */
  reliability: ReliabilityDiagramData;
  diagnosticDone: boolean;
  /** Active Goal Mode (drives dashboard focus). */
  goalMode: GoalMode;
  /** True when any Speed Arena attempt exists (Case-B timing-panel gate). */
  hasTimingData: boolean;
}

/**
 * The candidate pool for the dashboard's FOCUS surfaces — the weakness ranking,
 * the "recommended next focus", and reviews-due — scoped to the active mode.
 *
 * In course mode (Case A) ONLY the two courses' topics are eligible, so
 * Foundations (Mental Arithmetic, Rates/Algebra, Number Theory, Geometry) and
 * quant-only topics (Kelly, Game Theory, Interview Games / market-making,
 * Brainteasers, Speed Arena, Fermi) NEVER surface as a recommendation, weak
 * spot, or review — the learner is only ever pointed at Intro to Probability /
 * Intro to Stochastic Processes topics. In interview mode (Case B) the pool is
 * unchanged (every topic is eligible), so today's behavior is byte-for-byte
 * preserved. Pure + deterministic — a plain filter over the enumerated topics.
 */
export function scopeTopicsToMode(
  topics: DashboardTopic[],
  mode: GoalMode,
): DashboardTopic[] {
  return mode === "course"
    ? topics.filter((t) => isCourseTopic(t.topicKey))
    : topics;
}

/** True when the learner has recorded any Speed Arena run (local PB store). */
function hasArenaAttempts(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  const ls = window.localStorage;
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k && k.startsWith("qtp.arena.pb.")) return true;
  }
  return false;
}

export function useDashboardData(now: string): DashboardModel {
  const { getTopicVerdict, progress } = useProgress();

  return useMemo(() => {
    const goalMode = resolveGoalMode(progress);
    const topics: DashboardTopic[] = [];
    const seen = new Set<string>();

    for (const track of PLAYABLE_TRACKS) {
      const isMastered = (id: string) =>
        !!progress.levelProgress[id]?.mastered;
      const grouped = groupLevelsIntoTopics(track.levels);
      for (const g of grouped) {
        const topicKey = topicKeyOf(track.id, track.levels[g.startIndex].section);
        if (seen.has(topicKey)) continue; // merge non-contiguous same-section runs
        seen.add(topicKey);
        topics.push({
          topicKey,
          trackId: track.id,
          trackTitle: track.title,
          label: g.section ?? track.title,
          firstLevelId: track.levels[g.startIndex].id,
          unlocked: isLevelUnlockedBySection(
            track.levels,
            g.startIndex,
            isMastered,
          ),
          verdict: getTopicVerdict(topicKey),
        });
      }
    }

    const byKey = new Map(topics.map((t) => [t.topicKey, t]));
    const evidenced = topics.filter((t) => t.verdict.n > 0);

    // FOCUS surfaces (weakness ranking → recommended focus, reviews-due) draw
    // from the mode-scoped pool: in Case A ONLY course topics are eligible, so
    // Foundations / quant-only topics never surface as something to practice.
    // In Case B the pool is every topic (unchanged).
    const weaknesses = rankWeaknesses(
      scopeTopicsToMode(evidenced, goalMode).map((t) => t.verdict),
    )
      .map((v) => byKey.get(v.topicKey))
      .filter((t): t is DashboardTopic => !!t);

    const recommended = weaknesses.find(
      (t) => t.unlocked && !t.verdict.mastered,
    );

    const due = reviewsDue(
      scopeTopicsToMode(topics, goalMode).map((t) => t.verdict),
      now,
    )
      .map((v) => byKey.get(v.topicKey))
      .filter((t): t is DashboardTopic => !!t);

    // Pool from the PERSISTED cross-session calibration log (WS-CAL) so the
    // reliability panel accrues across reloads instead of resetting each session.
    const reliability = reliabilityDiagram(
      toCalibrationPairs(progress.calibrationLog),
    );

    return {
      topics,
      evidenced,
      weaknesses,
      recommended,
      due,
      reliability,
      diagnosticDone: !!progress.diagnosticDoneAt,
      goalMode,
      hasTimingData: hasArenaAttempts(),
    };
    // getTopicVerdict is derived from `progress`; recompute when progress changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, now]);
}
