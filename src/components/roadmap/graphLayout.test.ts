import { describe, expect, it } from "vitest";
import { layoutSkillGraph, type LayoutInputNode } from "./graphLayout";
import { SKILL_GRAPH } from "@/lib/roadmap/skillGraph";

/**
 * The layered layout owns the invariants that keep the graph readable:
 *  - prerequisite edges always point strictly "forward" (into a higher layer),
 *  - roots sit at layer 0,
 *  - sub-graphs drop dangling prereqs,
 *  - transitive-reduction splits edges into a clean DIRECT tree + implied
 *    "indirect" links,
 *  - no two boxes in a layer overlap (with generous spacing).
 */

const TINY: LayoutInputNode[] = [
  { key: "a", prereqs: [] },
  { key: "b", prereqs: [] },
  { key: "c", prereqs: ["a", "b"] },
  { key: "d", prereqs: ["c"] },
  { key: "e", prereqs: ["a"] },
];

const fromTo = (edges: { from: string; to: string }[]) =>
  edges.map((e) => `${e.from}->${e.to}`).sort();

describe("layoutSkillGraph", () => {
  it("places roots at layer 0 and pushes dependents forward", () => {
    const g = layoutSkillGraph(TINY);
    expect(g.nodeByKey.a.layer).toBe(0);
    expect(g.nodeByKey.b.layer).toBe(0);
    expect(g.nodeByKey.c.layer).toBe(1);
    expect(g.nodeByKey.d.layer).toBe(2);
    expect(g.nodeByKey.e.layer).toBe(1);
  });

  it("keeps every edge pointing to a strictly higher layer", () => {
    const g = layoutSkillGraph(TINY);
    for (const e of g.edges) {
      expect(g.nodeByKey[e.from].layer).toBeLessThan(g.nodeByKey[e.to].layer);
    }
  });

  it("ignores prereqs that are not in the displayed sub-graph", () => {
    // Only c + d shown: c's prereqs a,b are absent → c becomes a root.
    const g = layoutSkillGraph([
      { key: "c", prereqs: ["a", "b"] },
      { key: "d", prereqs: ["c"] },
    ]);
    expect(g.nodeByKey.c.layer).toBe(0);
    expect(g.nodeByKey.d.layer).toBe(1);
    expect(fromTo(g.edges)).toEqual(["c->d"]);
  });

  it("splits shortcut edges into an implied 'indirect' overlay", () => {
    // a→b→c AND a direct a→c: the a→c shortcut is transitively redundant.
    const g = layoutSkillGraph([
      { key: "a", prereqs: [] },
      { key: "b", prereqs: ["a"] },
      { key: "c", prereqs: ["a", "b"] },
    ]);
    const direct = g.edges.filter((e) => !e.indirect);
    const indirect = g.edges.filter((e) => e.indirect);
    expect(fromTo(direct)).toEqual(["a->b", "b->c"]);
    expect(fromTo(indirect)).toEqual(["a->c"]);
  });

  it("routes long edges through waypoints (polyline with mid points)", () => {
    // x depends on a root `a` (layer 0) AND on `k` (layer 1 via j→k), so x is at
    // layer 2 and the kept a→x edge genuinely spans two layers → 1 waypoint.
    const g = layoutSkillGraph([
      { key: "a", prereqs: [] },
      { key: "j", prereqs: [] },
      { key: "k", prereqs: ["j"] },
      { key: "x", prereqs: ["a", "k"] },
    ]);
    for (const e of g.edges.filter((x) => !x.indirect)) {
      const span = g.nodeByKey[e.to].layer - g.nodeByKey[e.from].layer;
      // interior waypoints = points minus the two box-edge anchors.
      const interior = e.points.length - 2;
      expect(interior).toBe(Math.max(0, span - 1));
    }
    const ax = g.edges.find((e) => e.from === "a" && e.to === "x")!;
    expect(ax.points.length - 2).toBe(1);
  });

  it("gives positive canvas dimensions and no overlaps within a layer", () => {
    const g = layoutSkillGraph(TINY, { nodeWidth: 100, nodeHeight: 40 });
    expect(g.width).toBeGreaterThan(0);
    expect(g.height).toBeGreaterThan(0);

    const byLayer = new Map<number, number[]>();
    for (const n of g.nodes) {
      const arr = byLayer.get(n.layer) ?? [];
      arr.push(n.y);
      byLayer.set(n.layer, arr);
    }
    for (const ys of byLayer.values()) {
      const sorted = [...ys].sort((p, q) => p - q);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it("lays out the real skill graph: all edges forward, some reduced away", () => {
    const input = SKILL_GRAPH.map((n) => ({
      key: n.topicKey,
      prereqs: n.prereqs,
    }));
    const g = layoutSkillGraph(input);
    expect(g.nodes).toHaveLength(SKILL_GRAPH.length);
    expect(Object.keys(g.nodeByKey)).toHaveLength(SKILL_GRAPH.length);
    for (const e of g.edges) {
      expect(g.nodeByKey[e.from].layer).toBeLessThan(g.nodeByKey[e.to].layer);
    }
    // Transitive reduction should have moved at least one shortcut edge into
    // the indirect overlay (e.g. Expected Value → Markov Chains).
    expect(g.edges.some((e) => e.indirect)).toBe(true);
    expect(Number.isFinite(g.crossings)).toBe(true);
  });
});
