import { describe, expect, it } from "vitest";
import { getLevel, PLAYABLE_TRACKS } from "@/content";
import {
  materializeLevel,
  materializeNumericLevel,
} from "@/content/materialize";
import { topicKeyForLevel } from "@/lib/mastery/topicKey";
import { isFlashcardLevel, isNumericLevel, type Level } from "@/types/content";
import { skillByKey } from "@/lib/roadmap/skillGraph";
import { MISCONCEPTION } from "@/lib/tutor/misconception";
import { MISCONCEPTION_LABELS } from "@/lib/dashboard/misconceptionLabels";
import {
  MISCONCEPTION_EDGE,
  PREREQ_DAG,
  prereqNode,
} from "./prereqDAG";
import {
  DIAGNOSTIC_BLUEPRINT,
  COURSE_DIAGNOSTIC_BLUEPRINT,
} from "@/content/diagnostic/blueprint";
import { mentalMathSubtopicOf } from "@/content/mentalMath/subtopics";

/**
 * ATTRIBUTION ACCURACY (RESOLVED DECISION §10.10 — the hard requirement).
 *
 * The engine must be PRECISE about which problem and which MISTAKE maps to which
 * subtopic. This suite ENUMERATES the content served in the guided pipeline's
 * DIAGNOSTIC + DRILLING and asserts, at item granularity:
 *
 *   1. NO ORPHAN TOPIC TAGS — every served item resolves to a VALID KST node
 *      (its `topicKeyOf(trackId, section)` is a real `SKILL_GRAPH` node, and for
 *      the drillable scored topics also a `PREREQ_DAG` node).
 *   2. NO ORPHAN SUBTOPIC TAGS — every mental-math item carries a `concept` that
 *      resolves to a canonical Mental-Arithmetic subtopic (spec §10.9).
 *   3. EVERY AUTHORED WRONG-ANSWER SIGNAL RESOLVES — every machine-readable
 *      misconception tag on a served item (`Question.misconceptions[i]` and
 *      `NumericQuestion.commonErrors[].misconception`) maps to a REAL node — i.e.
 *      it has a learner-facing description in `MISCONCEPTION_LABELS` (so the
 *      weakness report names the true cause) OR routes via a real
 *      `MISCONCEPTION_EDGE` (so remediation descends to the true weak prereq).
 *      Untagged distractors (deterministic `idx:`/`err:` fallbacks) are NOT
 *      authored signals and are out of scope.
 *
 * ── SCOPE ────────────────────────────────────────────────────────────────────
 * "Pipeline-reachable" is taken as: the diagnostic's source levels (both the
 * interview and course blueprints), the remediation probe levels
 * (`PREREQ_DAG` `levelRef`s), AND — because the drilling loop drives the WHOLE
 * KST, serving every scored node's lesson levels — every SCORED level of every
 * PLAYABLE track. That is the comprehensive diagnostic+drilling set. The six
 * `external` timed-drill / game topics (Sequences, No-Arbitrage, Fermi,
 * EV-under-time, Speed Arena, Auctions) are NOT registered into a playable track
 * (their generators are not reachable via `PLAYABLE_TRACKS`), so their authored
 * DOMAIN tags are exercised only through their own `MISCONCEPTION_EDGE` routing
 * (covered in `prereqDAG.test.ts`); they are noted as DEFERRED here.
 */

/** Seeds per level — enough to hit every sub-family behind a mixed generator. */
const SEEDS = Array.from({ length: 60 }, (_, i) => i * 131 + 5);

/** A served item's authored, machine-readable misconception tags (non-empty). */
function itemTags(level: Level): { tags: Set<string>; items: number } {
  const tags = new Set<string>();
  let items = 0;
  for (const seed of SEEDS) {
    if (isNumericLevel(level)) {
      for (const q of materializeNumericLevel(level, seed)) {
        items++;
        for (const e of q.commonErrors ?? []) {
          if (e.misconception && e.misconception.trim()) tags.add(e.misconception);
        }
      }
    } else {
      for (const q of materializeLevel(level, seed)) {
        items++;
        for (const tag of q.misconceptions ?? []) {
          if (tag && tag.trim()) tags.add(tag);
        }
      }
    }
  }
  return { tags, items };
}

/** A tag "resolves" iff it is describable (weakness report) or routable (remediation). */
function tagResolves(tag: string): boolean {
  return (
    tag in MISCONCEPTION_LABELS ||
    tag in MISCONCEPTION_EDGE ||
    (Object.values(MISCONCEPTION) as string[]).includes(tag)
  );
}

/** Every SCORED (non-flashcard) level of every PLAYABLE track, with its topicKey. */
function scoredPlayableLevels(): { level: Level; trackId: string; topicKey: string }[] {
  const out: { level: Level; trackId: string; topicKey: string }[] = [];
  for (const track of PLAYABLE_TRACKS) {
    for (const level of track.levels) {
      if (isFlashcardLevel(level)) continue;
      out.push({
        level,
        trackId: track.id,
        topicKey: topicKeyForLevel(track.id, level),
      });
    }
  }
  return out;
}

/** The diagnostic's source levels (interview + course blueprints), de-duped. */
function diagnosticSourceLevels(): { level: Level; trackId: string; topicKey: string }[] {
  const out: { level: Level; trackId: string; topicKey: string }[] = [];
  const seen = new Set<string>();
  for (const slot of [...DIAGNOSTIC_BLUEPRINT, ...COURSE_DIAGNOSTIC_BLUEPRINT]) {
    const found = getLevel(slot.trackId, slot.levelId);
    if (!found) continue;
    const key = `${slot.trackId}/${slot.levelId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      level: found.level,
      trackId: slot.trackId,
      topicKey: topicKeyForLevel(slot.trackId, found.level),
    });
  }
  return out;
}

/** The remediation probe levels (`PREREQ_DAG` non-external `levelRef`s). */
function drillingProbeLevels(): { level: Level; trackId: string; topicKey: string }[] {
  const out: { level: Level; trackId: string; topicKey: string }[] = [];
  for (const node of Object.values(PREREQ_DAG)) {
    if (!node.levelRef) continue;
    const found = getLevel(node.levelRef.trackId, node.levelRef.levelId);
    if (!found) continue;
    out.push({
      level: found.level,
      trackId: node.levelRef.trackId,
      topicKey: topicKeyForLevel(node.levelRef.trackId, found.level),
    });
  }
  return out;
}

describe("attribution — no orphan TOPIC tags (every served item → a real KST node)", () => {
  it("the diagnostic's source levels all resolve to a real skill-graph node", () => {
    const orphans: string[] = [];
    for (const { topicKey } of diagnosticSourceLevels()) {
      if (!skillByKey(topicKey)) orphans.push(topicKey);
    }
    expect(orphans, `diagnostic source topics with no KST node: ${orphans.join(", ")}`).toEqual(
      [],
    );
  });

  it("the drilling probe levels all resolve to a real, remediable KST node", () => {
    const orphans: string[] = [];
    for (const { topicKey } of drillingProbeLevels()) {
      if (!skillByKey(topicKey) || !prereqNode(topicKey)) orphans.push(topicKey);
    }
    expect(orphans, `drilling probe topics with no KST node: ${orphans.join(", ")}`).toEqual(
      [],
    );
  });

  it("EVERY scored playable level (drilling-reachable) resolves to a skill-graph node", () => {
    // The self-assessed Brainteasers tracks are flashcard-only (already skipped);
    // every OTHER scored level a drilling round can serve must be a real node.
    const orphans = new Set<string>();
    for (const { topicKey } of scoredPlayableLevels()) {
      if (!skillByKey(topicKey)) orphans.add(topicKey);
    }
    expect([...orphans], `scored levels with no KST node: ${[...orphans].join(", ")}`).toEqual(
      [],
    );
  });
});

describe("attribution — no orphan SUBTOPIC tags (mental math, spec §10.9)", () => {
  it("every served mental-math item carries a canonical Mental-Arithmetic subtopic", () => {
    const track = PLAYABLE_TRACKS.find((t) => t.id === "mental-math")!;
    const orphanConcepts = new Set<string>();
    let items = 0;
    for (const level of track.levels) {
      if (isFlashcardLevel(level)) continue;
      for (const seed of SEEDS) {
        const qs = isNumericLevel(level)
          ? materializeNumericLevel(level, seed)
          : materializeLevel(level, seed);
        for (const q of qs) {
          items++;
          if (!mentalMathSubtopicOf(q.concept)) {
            orphanConcepts.add(q.concept ?? "<none>");
          }
        }
      }
    }
    expect(items).toBeGreaterThan(0);
    expect(
      [...orphanConcepts],
      `mental-math items with an orphan subtopic tag: ${[...orphanConcepts].join(", ")}`,
    ).toEqual([]);
  });
});

describe("attribution — every authored MISCONCEPTION tag resolves", () => {
  /** Collect every unresolved tag across a set of levels, with where it came from. */
  function unresolvedIn(
    levels: { level: Level; topicKey: string }[],
  ): { total: number; unresolved: string[] } {
    const unresolved = new Set<string>();
    let total = 0;
    for (const { level, topicKey } of levels) {
      const { tags } = itemTags(level);
      for (const tag of tags) {
        total++;
        if (!tagResolves(tag)) unresolved.add(`${topicKey} :: ${tag}`);
      }
    }
    return { total, unresolved: [...unresolved] };
  }

  it("diagnostic source levels emit only resolvable tags", () => {
    const { unresolved } = unresolvedIn(diagnosticSourceLevels());
    expect(unresolved, `unresolved diagnostic tags: ${unresolved.join(", ")}`).toEqual([]);
  });

  it("drilling probe levels emit only resolvable tags", () => {
    const { unresolved } = unresolvedIn(drillingProbeLevels());
    expect(unresolved, `unresolved probe tags: ${unresolved.join(", ")}`).toEqual([]);
  });

  it("EVERY scored playable level (comprehensive) emits only resolvable tags", () => {
    const { unresolved } = unresolvedIn(scoredPlayableLevels());
    expect(unresolved, `unresolved tags: ${unresolved.join(", ")}`).toEqual([]);
  });
});

describe("attribution — coverage report (diagnostic + drilling reachable set)", () => {
  it("covers a substantial, enumerated set of levels + items + tags", () => {
    const scored = scoredPlayableLevels();
    const uniqueTags = new Set<string>();
    let items = 0;
    for (const { level } of scored) {
      const { tags, items: n } = itemTags(level);
      items += n;
      for (const t of tags) uniqueTags.add(t);
    }
    // Sanity floors so this stays a real, comprehensive audit (not a no-op).
    // Observed at authoring time: 90 scored levels, ~29k materialized item
    // instances, 223 unique tags (26 diagnostic-source + 26 drilling-probe
    // levels). Floors kept conservative so content churn never falsely breaks.
    expect(scored.length).toBeGreaterThanOrEqual(40);
    expect(items).toBeGreaterThanOrEqual(5000);
    expect(uniqueTags.size).toBeGreaterThanOrEqual(50);
    // Every unique tag we saw resolves (belt-and-suspenders vs the per-set tests).
    for (const tag of uniqueTags) {
      expect(tagResolves(tag), `tag ${tag} must resolve`).toBe(true);
    }
  });
});
