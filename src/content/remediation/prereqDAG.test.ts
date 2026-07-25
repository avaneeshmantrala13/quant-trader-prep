import { describe, expect, it } from "vitest";
import { getLevel } from "@/content";
import { topicKeyForLevel } from "@/lib/mastery/topicKey";
import {
  MISCONCEPTION_EDGE,
  PREREQ_DAG,
  misconceptionTagOf,
  prereqNode,
} from "./prereqDAG";

describe("PREREQ_DAG structure", () => {
  const nodes = Object.values(PREREQ_DAG);

  it("keys match each node's topicKey", () => {
    for (const [key, node] of Object.entries(PREREQ_DAG)) {
      expect(node.topicKey).toBe(key);
    }
  });

  it("every prereq references a real node", () => {
    for (const node of nodes) {
      for (const p of node.prereqs) {
        expect(PREREQ_DAG[p], `${node.topicKey} → ${p}`).toBeDefined();
      }
    }
  });

  it("is acyclic", () => {
    // DFS with a recursion stack; a back-edge ⇒ cycle.
    const state = new Map<string, "visiting" | "done">();
    const hasCycle = (key: string): boolean => {
      const s = state.get(key);
      if (s === "visiting") return true;
      if (s === "done") return false;
      state.set(key, "visiting");
      for (const p of PREREQ_DAG[key].prereqs) {
        if (hasCycle(p)) return true;
      }
      state.set(key, "done");
      return false;
    };
    for (const key of Object.keys(PREREQ_DAG)) {
      expect(hasCycle(key)).toBe(false);
    }
  });

  it("every node's levelRef resolves and its section-topicKey matches the node", () => {
    for (const node of nodes) {
      const resolved = getLevel(node.levelRef.trackId, node.levelRef.levelId);
      expect(resolved, `${node.topicKey} levelRef`).toBeDefined();
      // The mastery bucket a probe from this level writes MUST equal the node.
      const derived = topicKeyForLevel(node.levelRef.trackId, resolved!.level);
      expect(derived).toBe(node.topicKey);
    }
  });

  it("every MISCONCEPTION_EDGE value is a node", () => {
    for (const target of Object.values(MISCONCEPTION_EDGE)) {
      expect(PREREQ_DAG[target], target).toBeDefined();
    }
  });

  it("floors have no un-floored dead ends (every leaf is a floor; every non-floor can descend)", () => {
    for (const node of nodes) {
      // A leaf (no prereqs) must be a floor — descent can always terminate.
      if (node.prereqs.length === 0) {
        expect(node.floor, `${node.topicKey} leaf must be a floor`).toBe(true);
      }
      // No non-floor node may be a total dead end.
      if (!node.floor) {
        expect(node.prereqs.length).toBeGreaterThan(0);
      }
    }
  });

  it("every misconception-edge target is a prereq of at least one parent that can trip it", () => {
    // Sanity: the implicated prereq is reachable via descent from some node.
    for (const target of Object.values(MISCONCEPTION_EDGE)) {
      const someParent = Object.values(PREREQ_DAG).some((n) =>
        n.prereqs.includes(target),
      );
      expect(someParent, target).toBe(true);
    }
  });
});

describe("misconceptionTagOf", () => {
  it("strips the topicKey:: prefix from a namespaced key", () => {
    expect(misconceptionTagOf("probability::Conditional Probability::reversed_conditional")).toBe(
      "reversed_conditional",
    );
  });
  it("returns a bare tag unchanged", () => {
    expect(misconceptionTagOf("base_rate_neglect")).toBe("base_rate_neglect");
  });
  it("returns undefined for empty/undefined", () => {
    expect(misconceptionTagOf(undefined)).toBeUndefined();
    expect(misconceptionTagOf("")).toBeUndefined();
  });
});

describe("prereqNode", () => {
  it("returns the node for a known topicKey and undefined otherwise", () => {
    const anyKey = Object.keys(PREREQ_DAG)[0];
    expect(prereqNode(anyKey)?.topicKey).toBe(anyKey);
    expect(prereqNode("nope::nope")).toBeUndefined();
  });
});
