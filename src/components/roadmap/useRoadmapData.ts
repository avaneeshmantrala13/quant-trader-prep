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

export interface RoadmapModel {
  state: RoadmapState;
  tiers: RoadmapTierGroup[];
  /** Flattened rows in curriculum order (for the "current" lookup + counts). */
  rows: RoadmapSkillRow[];
  currentRow?: RoadmapSkillRow;
  diagnosticDone: boolean;
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

    return {
      state,
      tiers,
      rows,
      currentRow: state.currentSkillKey
        ? rowByKey.get(state.currentSkillKey)
        : undefined,
      diagnosticDone: !!progress.diagnosticDoneAt,
    };
    // getTopicVerdict is derived from `progress`; recompute when progress changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);
}
