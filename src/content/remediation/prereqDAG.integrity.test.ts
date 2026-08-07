import { describe, expect, it } from "vitest";
import { PLAYABLE_TRACKS } from "@/content";
import { groupLevelsIntoTopics } from "@/lib/topics";
import { isFlashcardLevel } from "@/types/content";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import { MISCONCEPTION } from "@/lib/tutor/misconception";
import { MISCONCEPTION_EDGE, PREREQ_DAG, prereqNode } from "./prereqDAG";

/**
 * KST ACCURACY — dynamic, whole-catalog integrity guarantees for the Knowledge
 * State Tree (the remediation prereq DAG). These complement the hand-listed
 * coverage assertions in `prereqDAG.test.ts` with checks that scale
 * automatically as content is added, so a newly-authored scored topic that is
 * never wired into the KST FAILS here instead of silently disabling remediation
 * + the ZPD suggestions for it.
 */

/** Every (track, section) topic that has at least one SCORED (non-flashcard) level. */
function scoredTopics(): { topicKey: string; trackId: string; section?: string }[] {
  const out: { topicKey: string; trackId: string; section?: string }[] = [];
  const seen = new Set<string>();
  for (const track of PLAYABLE_TRACKS) {
    for (const g of groupLevelsIntoTopics(track.levels)) {
      const topicKey = topicKeyOf(track.id, g.section);
      if (seen.has(topicKey)) continue;
      seen.add(topicKey);
      // `endIndex` is INCLUSIVE (see groupLevelsIntoTopics).
      const anyScored = track.levels
        .slice(g.startIndex, g.endIndex + 1)
        .some((l) => !isFlashcardLevel(l));
      if (anyScored) out.push({ topicKey, trackId: track.id, section: g.section });
    }
  }
  return out;
}

describe("KST integrity — scored-topic coverage (dynamic)", () => {
  it("EVERY scored topic in the playable catalog is a KST node (no silent no-gap)", () => {
    const missing: string[] = [];
    for (const t of scoredTopics()) {
      // Flashcard-only Brainteasers tracks are intentionally out of scope; any
      // OTHER scored topic MUST be a remediable KST node.
      const isBrainteaserFlashcard = t.trackId === "brainteasers";
      if (isBrainteaserFlashcard) continue;
      if (!prereqNode(t.topicKey)) missing.push(t.topicKey);
    }
    expect(missing, `scored topics missing a KST node: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("KST integrity — edges valid + acyclic + descent always terminates", () => {
  const nodes = Object.values(PREREQ_DAG);

  it("every prereq edge points at a real node and never at itself", () => {
    for (const n of nodes) {
      for (const p of n.prereqs) {
        expect(PREREQ_DAG[p], `${n.topicKey} → ${p}`).toBeDefined();
        expect(p).not.toBe(n.topicKey);
      }
    }
  });

  it("is acyclic (DFS back-edge detection)", () => {
    const state = new Map<string, "open" | "done">();
    const dfs = (key: string): boolean => {
      const s = state.get(key);
      if (s === "open") return true;
      if (s === "done") return false;
      state.set(key, "open");
      for (const p of PREREQ_DAG[key].prereqs) if (dfs(p)) return true;
      state.set(key, "done");
      return false;
    };
    for (const key of Object.keys(PREREQ_DAG)) expect(dfs(key)).toBe(false);
  });

  it("every node's prerequisite closure reaches a FLOOR (descent bottoms out)", () => {
    const reachesFloor = (key: string, seen = new Set<string>()): boolean => {
      const node = PREREQ_DAG[key];
      if (!node) return false;
      if (node.floor) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return node.prereqs.some((p) => reachesFloor(p, seen));
    };
    for (const n of nodes) {
      expect(reachesFloor(n.topicKey), `${n.topicKey} must reach a floor`).toBe(true);
    }
  });
});

describe("KST integrity — misconception → prereq edges for the common error modes", () => {
  it("EVERY canonical misconception tag has a prereq-routing edge", () => {
    // The canonical Phase-2 error modes must each implicate a prerequisite so a
    // tripping misconception descends to the RIGHT gap (not just prereqs[0]).
    const uncovered = Object.values(MISCONCEPTION).filter(
      (tag) => !(tag in MISCONCEPTION_EDGE),
    );
    expect(uncovered, `misconceptions with no prereq edge: ${uncovered.join(", ")}`).toEqual([]);
  });

  it("every misconception edge target is a real node AND a prereq of some node that can trip it", () => {
    for (const [tag, target] of Object.entries(MISCONCEPTION_EDGE)) {
      expect(prereqNode(target), `${tag} → ${target}`).toBeDefined();
      const someParent = Object.values(PREREQ_DAG).some((n) =>
        n.prereqs.includes(target),
      );
      expect(someParent, `${tag} → ${target} must be reachable via descent`).toBe(true);
    }
  });
});
