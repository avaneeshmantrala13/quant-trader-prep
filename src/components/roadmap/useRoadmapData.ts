import { useMemo } from "react";
import { useProgress } from "@/context/ProgressContext";
import { PLAYABLE_TRACKS } from "@/content";
import { groupLevelsIntoTopics } from "@/lib/topics";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import { topicDisplayName } from "@/lib/dashboard/misconceptionLabels";
import {
  computeRoadmap,
  type RoadmapState,
  type SkillEvidence,
} from "@/lib/roadmap/readiness";
import {
  SKILL_GRAPH,
  SKILL_TIERS,
  skillByKey,
  type SkillNode,
} from "@/lib/roadmap/skillGraph";
import { resolveGoalMode } from "@/lib/mode/goalMode";
import { COURSES, type CourseId } from "@/lib/mode/courseMap";
import type { GoalMode } from "@/types/progress";

/**
 * Read-only roadmap model (mirrors `useDashboardData`): a THIN consumer that
 * gathers per-skill evidence — the Phase-1 `TopicVerdict` plus level-completion
 * counts — and hands it to the pure `computeRoadmap`. No mastery math or state
 * mutation happens here; it works with every flag OFF.
 */

/** Per-skill display row (pure-derived progress + graph metadata + links). */
export interface RoadmapSkillRow {
  node: SkillNode;
  /** Nice display name (curated where available, else the graph label). */
  name: string;
  progress: RoadmapState["skills"][number];
  /** Deep-link to practice this skill (its first level). */
  href: string;
  /** Human-readable prereq names still needed (for the "locked" hint). */
  missingPrereqNames: string[];
}

export interface RoadmapTierGroup {
  id: string;
  label: string;
  blurb: string;
  rows: RoadmapSkillRow[];
  /** How many skills in this tier are mastered. */
  masteredCount: number;
  totalCount: number;
}

/**
 * A single Case-A course "path": the ordered topic sequence for one UT course
 * (Intro to Probability or Intro to Stochastic Processes) with each topic's
 * mastery / lock / complete state and an overall per-path progress indicator.
 * Reuses the SAME `RoadmapSkillRow`s + `computeRoadmap` state as the Case-B
 * tiers (prereqs are resolved across the whole graph, so a course topic can
 * still show "locked" behind an upstream foundation) — it is purely a REGROUPING
 * of the same rows by course, never a second computation.
 */
export interface RoadmapCoursePath {
  id: CourseId;
  /** Course label — the ONLY name shown (never the M362 code). */
  label: string;
  blurb: string;
  /** This course's PRIMARY owned topics, in curriculum order. */
  rows: RoadmapSkillRow[];
  /** How many of this path's topics are mastered. */
  masteredCount: number;
  totalCount: number;
  /** 0..100 weighted readiness across this path's topics. */
  readiness: number;
  /** First not-mastered, prereqs-met topic in this path (its "current" step). */
  currentKey?: string;
}

export interface RoadmapModel {
  state: RoadmapState;
  tiers: RoadmapTierGroup[];
  /** Flattened rows in curriculum order (for the "current" lookup + counts). */
  rows: RoadmapSkillRow[];
  currentRow?: RoadmapSkillRow;
  diagnosticDone: boolean;
  /** Active Goal Mode — Case A ("course") regroups the pathway into courses. */
  goalMode: GoalMode;
  /** Case-A two-course paths (empty in Case B, where the tiers are used). */
  coursePaths: RoadmapCoursePath[];
}

/** Level-completion counts (mastered / total) per topicKey across all tracks. */
function levelCompletionByTopic(
  isMastered: (levelId: string) => boolean,
): Map<string, { mastered: number; total: number }> {
  const out = new Map<string, { mastered: number; total: number }>();
  for (const track of PLAYABLE_TRACKS) {
    for (const g of groupLevelsIntoTopics(track.levels)) {
      const key = topicKeyOf(track.id, g.section);
      const acc = out.get(key) ?? { mastered: 0, total: 0 };
      for (let i = g.startIndex; i <= g.endIndex; i++) {
        acc.total += 1;
        if (isMastered(track.levels[i].id)) acc.mastered += 1;
      }
      // Merge any non-contiguous same-section runs into one bucket.
      out.set(key, acc);
    }
  }
  return out;
}

export function useRoadmapData(): RoadmapModel {
  const { getTopicVerdict, progress } = useProgress();

  return useMemo(() => {
    const isMastered = (levelId: string) =>
      !!progress.levelProgress[levelId]?.mastered;
    const completion = levelCompletionByTopic(isMastered);

    const evidenceFor = (topicKey: string): SkillEvidence => {
      const v = getTopicVerdict(topicKey);
      const c = completion.get(topicKey) ?? { mastered: 0, total: 0 };
      return {
        topicKey,
        ciLow: v.lo,
        mean: v.mean,
        gradedCount: v.n,
        theta: v.theta,
        levelsMastered: c.mastered,
        levelsTotal: c.total,
      };
    };

    const state = computeRoadmap(evidenceFor);
    const progressByKey = new Map(state.skills.map((s) => [s.topicKey, s]));

    const nameOf = (node: SkillNode) =>
      topicDisplayName(node.topicKey, node.label);

    const toRow = (node: SkillNode): RoadmapSkillRow => {
      const p = progressByKey.get(node.topicKey)!;
      return {
        node,
        name: nameOf(node),
        progress: p,
        href: `/track/${node.trackId}/level/${node.firstLevelId}`,
        missingPrereqNames: p.missingPrereqs.map((k) => {
          const n = skillByKey(k);
          return n ? nameOf(n) : k;
        }),
      };
    };

    const rows = SKILL_GRAPH.map(toRow);
    const rowByKey = new Map(rows.map((r) => [r.node.topicKey, r]));

    // Group into tiers, ascending by tier order, in curriculum order.
    const byTier = new Map<string, RoadmapSkillRow[]>();
    for (const r of rows) {
      const arr = byTier.get(r.node.tier) ?? [];
      arr.push(r);
      byTier.set(r.node.tier, arr);
    }
    const tiers: RoadmapTierGroup[] = [...byTier.entries()]
      .map(([id, tierRows]) => {
        const meta = SKILL_TIERS[id];
        return {
          id,
          label: meta.label,
          blurb: meta.blurb,
          rows: tierRows,
          masteredCount: tierRows.filter((r) => r.progress.mastered).length,
          totalCount: tierRows.length,
          order: meta.order,
        };
      })
      .sort((a, b) => a.order - b.order)
      .map(({ order: _order, ...g }) => g);

    // Case-A course paths: regroup the SAME rows by course (primary topics, in
    // curriculum order). Foundations / quant-only topics are excluded — a path
    // shows only its course's owned topics.
    const coursePaths: RoadmapCoursePath[] = COURSES.map((course) => {
      const pathRows = course.topicKeys
        .map((k) => rowByKey.get(k))
        .filter((r): r is RoadmapSkillRow => !!r);
      const masteredCount = pathRows.filter((r) => r.progress.mastered).length;
      let weightSum = 0;
      let accum = 0;
      for (const r of pathRows) {
        weightSum += r.node.weight;
        accum += r.node.weight * (r.progress.masteryPct / 100);
      }
      const current = pathRows.find(
        (r) => !r.progress.mastered && r.progress.prereqsMet,
      );
      return {
        id: course.id,
        label: course.label,
        blurb: course.blurb,
        rows: pathRows,
        masteredCount,
        totalCount: pathRows.length,
        readiness: weightSum > 0 ? Math.round(100 * (accum / weightSum)) : 0,
        currentKey: current?.node.topicKey,
      };
    });

    return {
      state,
      tiers,
      rows,
      currentRow: state.currentSkillKey
        ? rowByKey.get(state.currentSkillKey)
        : undefined,
      diagnosticDone: !!progress.diagnosticDoneAt,
      goalMode: resolveGoalMode(progress),
      coursePaths,
    };
    // getTopicVerdict is derived from `progress`; recompute when progress changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);
}
