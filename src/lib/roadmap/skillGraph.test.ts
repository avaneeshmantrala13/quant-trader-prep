import { describe, expect, it } from "vitest";
import {
  COMPETENCY_BRAINTEASER,
  COMPETENCY_TRADING,
  SKILL_GRAPH,
  SKILL_TIERS,
  skillByKey,
  skillKeySet,
  skillOrder,
  skillTiers,
} from "./skillGraph";
import { getLevel, PLAYABLE_TRACKS } from "@/content";
import { groupLevelsIntoTopics } from "@/lib/topics";
import { topicKeyOf } from "@/lib/mastery/topicKey";
import { PREREQ_DAG } from "@/content/remediation/prereqDAG";
import {
  COMPETENCY_BRAINTEASER as GATE_COMPETENCY_BRAINTEASER,
  COMPETENCY_TRADING as GATE_COMPETENCY_TRADING,
} from "@/lib/pipeline/gates";

describe("SKILL_GRAPH structure", () => {
  it("has a node per major topic with unique topicKeys", () => {
    const keys = SKILL_GRAPH.map((s) => s.topicKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(SKILL_GRAPH.length).toBeGreaterThanOrEqual(15);
  });

  it("references a REAL first level whose topicKey matches the node", () => {
    // EXTERNAL drill/game topics are authored but not yet registered into a
    // playable track, so their firstLevelId does not resolve via `getLevel` until
    // the integrator wires them in. Every NON-external node must still resolve.
    for (const node of SKILL_GRAPH.filter((n) => !n.external)) {
      const found = getLevel(node.trackId, node.firstLevelId);
      expect(found, `${node.trackId}/${node.firstLevelId} must exist`).toBeDefined();
      const key = topicKeyOf(node.trackId, found!.level.section);
      expect(key).toBe(node.topicKey);
    }
  });

  it("external drill/game topics rest only on REAL (registered) prerequisite nodes", () => {
    // An external node has no probe level of its own, so remediation can only
    // route it DOWN — every prereq must be a real, non-external node so the
    // descent target resolves to a real probe level.
    for (const node of SKILL_GRAPH.filter((n) => n.external)) {
      expect(node.prereqs.length, `${node.topicKey} must route somewhere`).toBeGreaterThan(0);
      for (const p of node.prereqs) {
        const parent = skillByKey(p);
        expect(parent, `${node.topicKey} → ${p}`).toBeDefined();
        expect(parent!.external, `${p} (target of ${node.topicKey}) must be real`).not.toBe(true);
      }
    }
  });

  it("every prereq is itself a node, with no self-edges", () => {
    const set = skillKeySet();
    for (const node of SKILL_GRAPH) {
      for (const p of node.prereqs) {
        expect(set.has(p), `${p} must be a node`).toBe(true);
        expect(p).not.toBe(node.topicKey);
      }
    }
  });

  it("is a DAG in curriculum order (prereqs appear before their dependents)", () => {
    const seen = new Set<string>();
    for (const node of SKILL_GRAPH) {
      for (const p of node.prereqs) {
        expect(seen.has(p), `${p} must precede ${node.topicKey}`).toBe(true);
      }
      seen.add(node.topicKey);
    }
  });

  it("uses a known tier for every node", () => {
    for (const node of SKILL_GRAPH) {
      expect(SKILL_TIERS[node.tier], `tier ${node.tier}`).toBeDefined();
    }
  });

  it("assigns a positive interview-importance weight", () => {
    for (const node of SKILL_GRAPH) {
      expect(node.weight).toBeGreaterThan(0);
    }
  });

  it("covers every mastery topic that exists in the playable tracks", () => {
    const contentTopics = new Set<string>();
    for (const track of PLAYABLE_TRACKS) {
      for (const g of groupLevelsIntoTopics(track.levels)) {
        contentTopics.add(topicKeyOf(track.id, g.section));
      }
    }
    for (const key of contentTopics) {
      expect(skillByKey(key), `graph is missing ${key}`).toBeDefined();
    }
  });
});

describe("competency nodes (spec §3.2)", () => {
  const bt = skillByKey(COMPETENCY_BRAINTEASER);
  const trading = skillByKey(COMPETENCY_TRADING);

  it("adds both first-class competency nodes to the graph", () => {
    expect(bt, "brainteaser-reasoning node").toBeDefined();
    expect(trading, "trading-intuition node").toBeDefined();
  });

  it("keys match the (un-editable) P0 gate stubs exactly", () => {
    expect(COMPETENCY_BRAINTEASER).toBe(GATE_COMPETENCY_BRAINTEASER);
    expect(COMPETENCY_TRADING).toBe(GATE_COMPETENCY_TRADING);
    expect(COMPETENCY_BRAINTEASER).toBe("competency::brainteaser-reasoning");
    expect(COMPETENCY_TRADING).toBe("competency::trading-intuition");
  });

  it("are marked external (no probe ladder ⇒ the real-first-level invariant skips them)", () => {
    expect(bt!.external).toBe(true);
    expect(trading!.external).toBe(true);
  });

  it("carry the §3.2 prerequisites", () => {
    expect(new Set(bt!.prereqs)).toEqual(
      new Set([
        topicKeyOf("probability", "Combinatorial Analysis"),
        topicKeyOf("probability", "Conditional Probability"),
        topicKeyOf("probability", "Expected Value"),
      ]),
    );
    expect(new Set(trading!.prereqs)).toEqual(
      new Set([
        topicKeyOf("probability", "Expected Value"),
        topicKeyOf("interview-games"),
      ]),
    );
  });

  it("are EXCLUDED from the scored content topics (gated separately by their Beta)", () => {
    // Mirrors gates.scoredContentTopicKeys(): external ⇒ not a scored-content node.
    const scored = SKILL_GRAPH.filter(
      (n) => !n.external && n.trackId !== "brainteasers",
    ).map((n) => n.topicKey);
    expect(scored).not.toContain(COMPETENCY_BRAINTEASER);
    expect(scored).not.toContain(COMPETENCY_TRADING);
  });
});

describe("skillGraph reconciles with the remediation prereq DAG", () => {
  it("preserves each remediation edge (superset)", () => {
    for (const node of Object.values(PREREQ_DAG)) {
      const graphNode = skillByKey(node.topicKey);
      expect(graphNode, `${node.topicKey} should be a skill`).toBeDefined();
      for (const p of node.prereqs) {
        expect(
          graphNode!.prereqs,
          `${node.topicKey} should require ${p}`,
        ).toContain(p);
      }
    }
  });
});

describe("skillTiers", () => {
  it("groups all skills, ascending by tier order, in curriculum order", () => {
    const groups = skillTiers();
    const orders = groups.map((g) => g.tier.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    const flat = groups.flatMap((g) => g.skills);
    expect(flat.length).toBe(SKILL_GRAPH.length);
  });
});

describe("skillOrder / skillByKey", () => {
  it("returns the canonical order and resolves keys", () => {
    expect(skillOrder()[0].topicKey).toBe(SKILL_GRAPH[0].topicKey);
    expect(skillByKey("nope::nope")).toBeUndefined();
  });
});
