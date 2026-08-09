import { describe, expect, it } from "vitest";
import { emptyProgress, type UserProgress } from "@/types/progress";
import type { TopicMastery } from "@/types/mastery";
import {
  COMPETENCY_BRAINTEASER,
  TRADING_SUBTOPIC_KEYS,
  passesDrillingGate,
  scoredContentTopicKeys,
} from "./gates";
import { buildDrillPlan } from "./diagnosis";
import { untimedContentItems } from "@/content/diagnostic/untimedBlueprint";
import { timedDiagnosticTopics } from "@/lib/oa/timedDiagnostic";

/**
 * ============================================================================
 *  CROSS-DIAGNOSTIC DRILL COVERAGE  (regression lock)
 * ============================================================================
 *
 * The drilling stage must target EVERY topic assessed by ANY of the THREE
 * diagnostics on which the learner is below the 0.80 mastery bar (Beta
 * CI_low < 0.80):
 *
 *   1. UNTIMED diagnostic — the free-response content bank + brainteaser
 *      flashcards (`untimedContentItems()` + `competency::brainteaser-reasoning`).
 *   2. TIMED diagnostic — the hard, topic-tagged multi-topic section
 *      (`timedDiagnosticTopics()`).
 *   3. GAME-OA battery — the eleven trading-intuition subtopics
 *      (`TRADING_SUBTOPIC_KEYS`).
 *
 * These tests derive that union straight from the diagnostics' OWN authoritative
 * sources (not a hand-maintained list) and assert:
 *   (a) every diagnostic-covered topic lives in the weakness-detection universe
 *       (`scoredContentTopicKeys()` for content, the competency set otherwise),
 *       so a future edit that introduces a diagnostic topic OUTSIDE that universe
 *       fails here — forcing it to be wired in; and
 *   (b) when those topics are below 0.80, `buildDrillPlan` queues every one of
 *       them (content + competency) and `passesDrillingGate` stays false until
 *       ALL are cleared.
 */

/* -- Beta fixtures (mirror gates.test.ts / diagnosis.test.ts) --------------- */

/** CI_low well above the 0.80 bar (mastered). */
function mastered(): TopicMastery {
  return { theta: 2, n: 62, alpha: 60, beta: 2, lastSeen: "t", misconceptions: {} };
}
/** CI_low below the 0.80 bar (not mastered). */
function weak(): TopicMastery {
  return { theta: -0.3, n: 7, alpha: 3, beta: 4, lastSeen: "t", misconceptions: {} };
}

/**
 * Baseline where the WHOLE Stage-6 gate passes: every scored content node, both
 * competencies, all trading subtopics mastered, and a cleared timed section on
 * record. Individual tests then knock specific topics below the bar.
 */
function allMastered(): UserProgress {
  const p = emptyProgress();
  const tm: Record<string, TopicMastery> = {};
  for (const key of scoredContentTopicKeys()) tm[key] = mastered();
  tm[COMPETENCY_BRAINTEASER] = mastered();
  for (const key of TRADING_SUBTOPIC_KEYS) tm[key] = mastered();
  p.topicMastery = tm;
  p.pipeline = {
    stage: "drilling",
    timed: {
      correct: 28,
      total: 30,
      sections: [
        { label: "timed-diagnostic", correct: 28, total: 30 },
      ],
    },
  };
  return p;
}

/* -- Authoritative per-diagnostic topic universes --------------------------- */

/** Distinct CONTENT topicKeys probed by the untimed free-response diagnostic. */
function untimedDiagnosticContentTopics(): string[] {
  return [...new Set(untimedContentItems().map((it) => it.topicKey))];
}

/**
 * The CONTENT topics assessed across the untimed + timed diagnostics (the
 * game-OA battery feeds competency subtopics, handled separately below).
 */
function diagnosticContentTopics(): string[] {
  return [
    ...new Set([
      ...untimedDiagnosticContentTopics(),
      ...timedDiagnosticTopics(),
    ]),
  ];
}

/**
 * The COMPETENCY topics assessed across the diagnostics: the untimed
 * brainteaser flashcards fold into `competency::brainteaser-reasoning`; the
 * game-OA battery feeds the eleven trading-intuition subtopics.
 */
function diagnosticCompetencyTopics(): string[] {
  return [COMPETENCY_BRAINTEASER, ...TRADING_SUBTOPIC_KEYS];
}

describe("drill coverage — the topic universe spans all three diagnostics", () => {
  it("every diagnostic-covered CONTENT topic is a scored, drillable node", () => {
    const scored = new Set(scoredContentTopicKeys());
    const missing = diagnosticContentTopics().filter((k) => !scored.has(k));
    // If this fails, a diagnostic probes a topic that the drilling gate + drill
    // plan cannot see — wire it into `scoredContentTopicKeys()`.
    expect(missing).toEqual([]);
  });

  it("every diagnostic-covered COMPETENCY topic is gated + drillable", () => {
    const competencyUniverse = new Set([
      COMPETENCY_BRAINTEASER,
      ...TRADING_SUBTOPIC_KEYS,
    ]);
    const missing = diagnosticCompetencyTopics().filter(
      (k) => !competencyUniverse.has(k),
    );
    expect(missing).toEqual([]);
  });

  it("the untimed diagnostic actually probes the whole scored content set", () => {
    // Coverage in the other direction: no scored node is left un-diagnosed, so
    // every gate-relevant content node has diagnostic evidence behind it.
    const probed = new Set(untimedDiagnosticContentTopics());
    const unprobed = scoredContentTopicKeys().filter((k) => !probed.has(k));
    expect(unprobed).toEqual([]);
  });
});

describe("drill plan — targets sub-80% topics from EACH of the three diagnostics", () => {
  // Concrete representatives: an untimed-only content node, a topic in the timed
  // plan, the untimed brainteaser competency, and a game-OA trading subtopic.
  const UNTIMED_ONLY = "probability::Variance, Covariance & the CLT";
  const TIMED = "probability::Markov Chains";
  const GAME_OA = TRADING_SUBTOPIC_KEYS[0];

  it("queues a weak topic from every diagnostic (content + competency)", () => {
    expect(scoredContentTopicKeys()).toContain(UNTIMED_ONLY);
    expect(timedDiagnosticTopics()).toContain(TIMED);

    const p = allMastered();
    p.topicMastery![UNTIMED_ONLY] = weak();
    p.topicMastery![TIMED] = weak();
    p.topicMastery![COMPETENCY_BRAINTEASER] = weak();
    p.topicMastery![GAME_OA] = weak();

    const keys = new Set(buildDrillPlan(p).map((e) => e.key));
    expect(keys.has(UNTIMED_ONLY)).toBe(true);
    expect(keys.has(TIMED)).toBe(true);
    expect(keys.has(COMPETENCY_BRAINTEASER)).toBe(true);
    expect(keys.has(GAME_OA)).toBe(true);

    // The gate must NOT let the user pass while any of them is below 0.80.
    expect(passesDrillingGate(p)).toBe(false);
  });

  it("the gate stays closed until the LAST diagnostic topic clears", () => {
    const p = allMastered();
    const weakTopics = [UNTIMED_ONLY, TIMED, COMPETENCY_BRAINTEASER, GAME_OA];
    for (const k of weakTopics) p.topicMastery![k] = weak();
    expect(passesDrillingGate(p)).toBe(false);

    // Clear them one at a time; the gate opens ONLY once the final one clears.
    for (let i = 0; i < weakTopics.length; i++) {
      p.topicMastery![weakTopics[i]] = mastered();
      const shouldPass = i === weakTopics.length - 1;
      expect(passesDrillingGate(p)).toBe(shouldPass);
    }
  });
});

describe("drill plan — covers the ENTIRE sub-80% diagnostic universe at once", () => {
  it("every diagnostic content + competency topic below 0.80 is queued, gate closed", () => {
    const p = allMastered();
    const contentTopics = diagnosticContentTopics();
    const competencyTopics = diagnosticCompetencyTopics();

    // Knock every diagnostic-covered content + competency topic below the bar.
    for (const k of contentTopics) p.topicMastery![k] = weak();
    for (const k of competencyTopics) p.topicMastery![k] = weak();

    const queued = new Set(buildDrillPlan(p).map((e) => e.key));
    const missing = [...contentTopics, ...competencyTopics].filter(
      (k) => !queued.has(k),
    );
    expect(missing).toEqual([]);
    expect(passesDrillingGate(p)).toBe(false);
  });

  it("once the whole diagnostic universe is mastered, the plan is empty + gate open", () => {
    const p = allMastered();
    expect(buildDrillPlan(p)).toHaveLength(0);
    expect(passesDrillingGate(p)).toBe(true);
  });
});
