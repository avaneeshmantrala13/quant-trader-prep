import { describe, expect, it } from "vitest";
import {
  diagnosticToSeeds,
  withPrereqUnlocks,
  type DiagnosticOutcome,
  type TopicSeed,
} from "./diagnosticSeed";
import { applyDiagnosticSeed, applyItemAttempt } from "@/lib/mastery/mastery";
import {
  isLowConfidenceUnlock,
  isTopicUnlocked,
} from "@/lib/mastery/unlock";
import { didRelock } from "@/lib/remediation/relock";
import { seedUnlockedLevelIds } from "@/lib/mastery/unlockGraph";
import { levelLockState } from "@/lib/locking";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import { topicsInCourse } from "@/lib/mode/courseMap";
import { probabilityTrack } from "@/content/probability/levels";
import type { ItemAttempt, TopicMastery } from "@/types/mastery";

/**
 * THE DIAGNOSTIC → UNLOCK → LOCKING PATH (Fix 1), pinned end-to-end so it cannot
 * silently regress: a strong diagnostic result on a course topic must (a) seed a
 * LOW-CONFIDENCE unlock for the topic AND its KST prerequisites, and (b) make
 * those topics ACTUALLY ACCESSIBLE through `locking.ts`. A later failing quiz on
 * such a topic must swing it back under the unlock bar and RE-LOCK it.
 */

const CONDITIONAL = topicKeyOf("probability", "Conditional Probability");
const CORE_PROB = topicKeyOf("probability", "Core Probability");
const COMBINATORICS = topicKeyOf("probability", "Combinatorial Analysis");
const MARKOV = topicKeyOf("probability", "Markov Chains");

/** Scope prereq expansion to the course path (both UT courses' topic sets). */
const courseScopeSet = new Set([
  ...topicsInCourse("m362k"),
  ...topicsInCourse("m362m"),
]);
const inCourse = (k: string) => courseScopeSet.has(k);

/**
 * MIRROR of `ProgressContext.applyDiagnosticSeeds` (including the derived-seed
 * guard) so this test exercises the exact write semantics of the seed writer.
 */
function applySeeds(
  map: Record<string, TopicMastery>,
  seeds: TopicSeed[],
): Record<string, TopicMastery> {
  const next = { ...map };
  for (const s of seeds) {
    if (s.derived && (next[s.topicKey]?.n ?? 0) > 0) continue;
    next[s.topicKey] = applyDiagnosticSeed(next[s.topicKey], {
      successes: s.successes,
      failures: s.failures,
      thetaSeed: s.thetaSeed,
    });
  }
  return next;
}

function correctItems(topicKey: string, n: number): DiagnosticOutcome[] {
  return Array.from({ length: n }, () => ({
    topicKey,
    tier: "medium" as const,
    correct: true,
  }));
}

function wrongItems(topicKey: string, n: number): DiagnosticOutcome[] {
  return Array.from({ length: n }, () => ({
    topicKey,
    tier: "medium" as const,
    correct: false,
  }));
}

const levels = probabilityTrack.levels;
const sectionIndices = (label: string) =>
  levels.reduce<number[]>((acc, l, i) => {
    if (l.section === label) acc.push(i);
    return acc;
  }, []);

describe("good diagnostic performance unlocks the topic + its KST prereqs (low confidence)", () => {
  const outcomes = correctItems(CONDITIONAL, 2); // performed WELL
  const seeds = withPrereqUnlocks(diagnosticToSeeds(outcomes), inCourse);
  const mastery = applySeeds({}, seeds);
  const masteryOf = (k: string) => mastery[k];

  it("seeds the assessed topic AND its prereqs as LOW-CONFIDENCE unlocks", () => {
    for (const key of [CONDITIONAL, CORE_PROB, COMBINATORICS]) {
      expect(isTopicUnlocked(mastery[key]), key).toBe(true);
      expect(isLowConfidenceUnlock(mastery[key]), key).toBe(true);
    }
    // The derived prereq seeds carry a tiny pseudo-count (α+β = 4) so they swing.
    expect(mastery[CORE_PROB].alpha + mastery[CORE_PROB].beta).toBe(4);
  });

  it("makes the topic + prereqs ACCESSIBLE via locking.ts (the root-cause gap)", () => {
    const seedUnlocked = seedUnlockedLevelIds(levels, "probability", masteryOf);
    const pred = (id: string) => seedUnlocked.has(id);
    const isMastered = () => false; // nothing earned yet

    for (const label of ["Conditional Probability", "Core Probability", "Combinatorial Analysis"]) {
      const idx = sectionIndices(label);
      expect(idx.length, label).toBeGreaterThan(1);
      const secondLevel = idx[1]; // a NON-first level of the section
      // Without the seed signal it would be locked (previous level not mastered)...
      expect(levelLockState(levels, secondLevel, isMastered)).toBe("locked");
      // ...but the diagnostic low-confidence unlock opens the whole topic.
      expect(levelLockState(levels, secondLevel, isMastered, pred)).toBe(
        "unlocked",
      );
    }
  });

  it("does NOT unlock unrelated topics (Markov Chains is not a prereq here)", () => {
    const seedUnlocked = seedUnlockedLevelIds(levels, "probability", masteryOf);
    const pred = (id: string) => seedUnlocked.has(id);
    const mIdx = sectionIndices("Markov Chains");
    if (mIdx.length > 1) {
      expect(levelLockState(levels, mIdx[1], () => false, pred)).toBe("locked");
    }
    expect(isTopicUnlocked(mastery[MARKOV])).toBe(false);
  });
});

describe("direct poor performance on a prereq is respected (not fake-unlocked)", () => {
  it("a prereq assessed poorly stays locked even though a downstream topic passed", () => {
    const outcomes = [
      ...correctItems(CONDITIONAL, 2), // WELL on Conditional Probability
      ...wrongItems(CORE_PROB, 2), // BADLY on its Core Probability prereq
    ];
    const seeds = withPrereqUnlocks(diagnosticToSeeds(outcomes), inCourse);
    const mastery = applySeeds({}, seeds);
    // Conditional Probability unlocked; Core Probability NOT (direct miss wins).
    expect(isTopicUnlocked(mastery[CONDITIONAL])).toBe(true);
    expect(isTopicUnlocked(mastery[CORE_PROB])).toBe(false);
  });
});

describe("later poor performance RE-LOCKS a low-confidence unlock", () => {
  it("one failing quiz item swings the mean under the bar and re-locks the topic", () => {
    const seeds = withPrereqUnlocks(
      diagnosticToSeeds(correctItems(CONDITIONAL, 2)),
      inCourse,
    );
    const before = applySeeds({}, seeds);
    const beforeM = before[CONDITIONAL];
    expect(isTopicUnlocked(beforeM)).toBe(true);

    // A NON-first Conditional Probability level is accessible before the miss.
    const cpIdx = sectionIndices("Conditional Probability");
    const second = cpIdx[1];
    const predBefore = (id: string) =>
      seedUnlockedLevelIds(levels, "probability", (k) => before[k]).has(id);
    expect(levelLockState(levels, second, () => false, predBefore)).toBe(
      "unlocked",
    );

    // Fail one graded quiz item on the topic.
    const fail: ItemAttempt = {
      topicKey: CONDITIONAL,
      tier: "medium",
      correct: false,
      mode: "quiz",
      kOptions: 4,
      at: "2026-02-01T00:00:00.000Z",
    };
    const afterM = applyItemAttempt(beforeM, undefined, fail, 0).mastery;

    expect(didRelock(beforeM, afterM)).toBe(true);
    expect(isTopicUnlocked(afterM)).toBe(false);

    // The gate now RE-LOCKS the previously-open level.
    const after = { ...before, [CONDITIONAL]: afterM };
    const predAfter = (id: string) =>
      seedUnlockedLevelIds(levels, "probability", (k) => after[k]).has(id);
    expect(levelLockState(levels, second, () => false, predAfter)).toBe(
      "locked",
    );
  });
});
