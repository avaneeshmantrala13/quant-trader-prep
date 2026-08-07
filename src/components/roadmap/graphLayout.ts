/**
 * A dependency-free **layered DAG layout** (a hand-rolled Sugiyama pipeline) for
 * the roadmap's Knowledge State Tree. Pure + deterministic so it can be
 * unit-tested and reused by both the interview pathway (Case B) and each course
 * sub-graph (Case A) without pulling in a heavy graph library.
 *
 * The pipeline, tuned for a ~30-node prerequisite DAG:
 *   1. TRANSITIVE REDUCTION — drop "shortcut" prerequisite edges that are
 *      already implied by a longer path (A→C when A→B→C exists). This leaves the
 *      clean, DIRECT prerequisite tree and removes most of the long-range
 *      spaghetti. The removed edges are still returned (flagged `indirect`) so
 *      the UI can offer them as a faint, opt-in overlay.
 *   2. LAYER ASSIGNMENT — longest-path over the reduced graph, so every
 *      prerequisite edge points strictly "forward" into a higher layer.
 *   3. VIRTUAL NODES — every edge spanning more than one layer is broken into a
 *      chain of thin dummy waypoints, one per intermediate layer, so edges are
 *      routed cleanly in the gaps BETWEEN node columns instead of slicing across
 *      boxes.
 *   4. CROSSING REDUCTION — weighted-median ordering sweeps plus a transpose
 *      (adjacent-swap) pass, keeping the best ordering seen. Dramatically cuts
 *      edge crossings.
 *   5. COORDINATE ASSIGNMENT — a priority/relaxation pass pulls each node toward
 *      the median of its neighbours while a min-separation constraint keeps
 *      boxes (and labels) from ever overlapping, with generous spacing.
 *
 * No DOM measurement happens here (sizes are analytic), so it renders
 * identically under jsdom in tests and in the browser.
 */

/** One input node: its stable key and the keys of its prerequisites. */
export interface LayoutInputNode {
  key: string;
  /** Prerequisite keys. Any not present in `input` are ignored (sub-graphs). */
  prereqs: string[];
}

/** A node placed on the grid. `x,y` is the top-left of its box. */
export interface PositionedNode {
  key: string;
  layer: number;
  index: number;
  x: number;
  y: number;
  cx: number;
  cy: number;
}

/** A routed prerequisite edge. `points` is the full polyline (box edge → box
 *  edge) threaded through any virtual waypoints. `indirect` edges were removed
 *  by transitive reduction and are drawn only as an opt-in overlay. */
export interface RoutedEdge {
  from: string;
  to: string;
  points: { x: number; y: number }[];
  indirect: boolean;
}

export interface LayoutOptions {
  nodeWidth: number;
  nodeHeight: number;
  /** Gap between layers (columns in "LR"). */
  layerGap: number;
  /** Min gap between sibling nodes within a layer. */
  nodeGap: number;
  padding: number;
  /** "LR" = layers flow left→right; "TB" = top→bottom. */
  orientation: "LR" | "TB";
  /** Ordering (crossing-reduction) sweep passes. */
  sweeps: number;
}

export interface GraphLayout {
  nodes: PositionedNode[];
  nodeByKey: Record<string, PositionedNode>;
  edges: RoutedEdge[];
  width: number;
  height: number;
  layerCount: number;
  /** Number of crossings among the DIRECT edges (diagnostic / for tests). */
  crossings: number;
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  nodeWidth: 188,
  nodeHeight: 60,
  layerGap: 96,
  nodeGap: 30,
  padding: 30,
  orientation: "LR",
  sweeps: 8,
};

/** Cross-axis footprint of a virtual waypoint (kept thin so edges pack tight). */
const DUMMY_SIZE = 5;
/** Waypoints need much less breathing room than labelled boxes. */
const DUMMY_GAP_SCALE = 0.34;

const median = (xs: number[]): number => {
  if (xs.length === 0) return -1;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/* --------------------------- graph preprocessing --------------------------- */

/** Reachable descendants (excluding self) for every node, via memoized DFS. */
function computeDescendants(
  keys: string[],
  childrenOf: Map<string, string[]>,
): Map<string, Set<string>> {
  const memo = new Map<string, Set<string>>();
  const inStack = new Set<string>();
  const visit = (k: string): Set<string> => {
    const cached = memo.get(k);
    if (cached) return cached;
    if (inStack.has(k)) return new Set();
    inStack.add(k);
    const out = new Set<string>();
    for (const c of childrenOf.get(k) ?? []) {
      out.add(c);
      for (const d of visit(c)) out.add(d);
    }
    inStack.delete(k);
    memo.set(k, out);
    return out;
  };
  for (const k of keys) visit(k);
  return memo;
}

/** Longest-path layer for every node over the given (reduced) child edges. */
function assignLayers(
  keys: string[],
  parentsOf: Map<string, string[]>,
): Map<string, number> {
  const layer = new Map<string, number>();
  const inStack = new Set<string>();
  const visit = (k: string): number => {
    const cached = layer.get(k);
    if (cached !== undefined) return cached;
    if (inStack.has(k)) return 0;
    inStack.add(k);
    const ps = parentsOf.get(k) ?? [];
    const depth = ps.length === 0 ? 0 : Math.max(...ps.map(visit)) + 1;
    inStack.delete(k);
    layer.set(k, depth);
    return depth;
  };
  for (const k of keys) visit(k);
  return layer;
}

/* ---------------------------- crossing counting ---------------------------- */

interface Segment {
  upper: string;
  lower: string;
}

/** Count edge crossings between two adjacent layers given current orderings. */
function countGapCrossings(
  segs: Segment[],
  upperPos: Map<string, number>,
  lowerPos: Map<string, number>,
): number {
  const pairs = segs
    .map((s) => [upperPos.get(s.upper)!, lowerPos.get(s.lower)!] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let crossings = 0;
  for (let i = 0; i < pairs.length; i++) {
    for (let j = i + 1; j < pairs.length; j++) {
      if (pairs[j][1] < pairs[i][1]) crossings++;
    }
  }
  return crossings;
}

/* -------------------------------------------------------------------------- */

/**
 * Lay a prerequisite DAG out into layers. `input` order is treated as the
 * canonical (curriculum) order and used to break ties, so the result is stable.
 */
export function layoutSkillGraph(
  input: LayoutInputNode[],
  options: Partial<LayoutOptions> = {},
): GraphLayout {
  const opts = { ...DEFAULT_LAYOUT, ...options };
  const {
    nodeWidth,
    nodeHeight,
    layerGap,
    nodeGap,
    padding,
    orientation,
    sweeps,
  } = opts;

  const keys = input.map((n) => n.key);
  const present = new Set(keys);
  const orderIndex = new Map(keys.map((k, i) => [k, i]));

  // Direct prerequisite edges among displayed nodes (dedup, no self-loops).
  const childrenOf = new Map<string, string[]>();
  const rawParents = new Map<string, string[]>();
  for (const k of keys) {
    childrenOf.set(k, []);
    rawParents.set(k, []);
  }
  const rawEdges: { from: string; to: string }[] = [];
  const seen = new Set<string>();
  for (const n of input) {
    for (const p of n.prereqs) {
      if (!present.has(p) || p === n.key) continue;
      const id = `${p}->${n.key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      rawEdges.push({ from: p, to: n.key });
      childrenOf.get(p)!.push(n.key);
      rawParents.get(n.key)!.push(p);
    }
  }

  // 1. Transitive reduction: an edge u→v is redundant iff v is reachable from
  //    some OTHER direct child of u. Keep the rest as the "direct" tree.
  const descendants = computeDescendants(keys, childrenOf);
  const directParents = new Map<string, string[]>(keys.map((k) => [k, []]));
  const directChildren = new Map<string, string[]>(keys.map((k) => [k, []]));
  const indirectEdges: { from: string; to: string }[] = [];
  for (const e of rawEdges) {
    const otherChildren = (childrenOf.get(e.from) ?? []).filter(
      (c) => c !== e.to,
    );
    const redundant = otherChildren.some((c) => descendants.get(c)?.has(e.to));
    if (redundant) {
      indirectEdges.push(e);
    } else {
      directParents.get(e.to)!.push(e.from);
      directChildren.get(e.from)!.push(e.to);
    }
  }

  // 2. Layer assignment over the reduced graph.
  const layerOf = assignLayers(keys, directParents);
  const layerCount = keys.length
    ? Math.max(...keys.map((k) => layerOf.get(k)!)) + 1
    : 0;

  // 3. Virtual nodes: split each direct edge that spans >1 layer into a chain.
  //    `layers` holds ordered node ids per layer (real keys + dummy ids).
  const layers: string[][] = Array.from({ length: layerCount }, () => []);
  for (const n of input) layers[layerOf.get(n.key)!].push(n.key);

  const isDummy = (id: string) => id.startsWith("\u0000d");
  // Chain of waypoint ids per direct edge (empty when adjacent layers).
  const edgeChain = new Map<string, string[]>();
  const segsByGap: Segment[][] = Array.from({ length: Math.max(0, layerCount - 1) }, () => []);
  let dummySeq = 0;
  for (const from of keys) {
    for (const to of directChildren.get(from)!) {
      const lu = layerOf.get(from)!;
      const lv = layerOf.get(to)!;
      const chain: string[] = [];
      let prev = from;
      for (let l = lu + 1; l < lv; l++) {
        const id = `\u0000d${dummySeq++}`;
        layers[l].push(id);
        chain.push(id);
        segsByGap[prev === from ? lu : l - 1].push({ upper: prev, lower: id });
        prev = id;
      }
      segsByGap[lv - 1].push({ upper: prev, lower: to });
      edgeChain.set(`${from}->${to}`, chain);
    }
  }

  // 4. Crossing reduction — weighted-median sweeps + transpose, keep best.
  // upAdj: node → its neighbours one layer ABOVE; downAdj: one layer BELOW.
  const upAdj = new Map<string, string[]>();
  const downAdj = new Map<string, string[]>();
  for (const gap of segsByGap) {
    for (const s of gap) {
      if (!downAdj.has(s.upper)) downAdj.set(s.upper, []);
      if (!upAdj.has(s.lower)) upAdj.set(s.lower, []);
      downAdj.get(s.upper)!.push(s.lower);
      upAdj.get(s.lower)!.push(s.upper);
    }
  }

  const positionsOf = (ls: string[][]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const layer of ls) layer.forEach((id, i) => m.set(id, i));
    return m;
  };

  const realOrderKey = (id: string) =>
    isDummy(id) ? Number.parseInt(id.slice(2), 10) + 1e6 : orderIndex.get(id)!;

  const wmedianSweep = (dir: "down" | "up") => {
    const pos = positionsOf(layers);
    const range =
      dir === "down"
        ? [...layers.keys()].slice(1)
        : [...layers.keys()].slice(0, -1).reverse();
    for (const li of range) {
      const adj = dir === "down" ? upAdj : downAdj;
      const key = new Map<string, number>();
      layers[li].forEach((id, i) => {
        const ns = (adj.get(id) ?? [])
          .map((n) => pos.get(n))
          .filter((p): p is number => p !== undefined);
        const m = median(ns);
        key.set(id, m < 0 ? i : m);
      });
      layers[li] = [...layers[li]].sort((a, b) => {
        const d = key.get(a)! - key.get(b)!;
        return d !== 0 ? d : realOrderKey(a) - realOrderKey(b);
      });
      layers[li].forEach((id, i) => pos.set(id, i));
    }
  };

  const totalCrossings = (): number => {
    const pos = positionsOf(layers);
    let total = 0;
    for (const gap of segsByGap) total += countGapCrossings(gap, pos, pos);
    return total;
  };

  const transpose = () => {
    let improved = true;
    let guard = 0;
    while (improved && guard++ < 8) {
      improved = false;
      for (let li = 0; li < layers.length; li++) {
        const layer = layers[li];
        for (let i = 0; i < layer.length - 1; i++) {
          const before = totalCrossings();
          [layer[i], layer[i + 1]] = [layer[i + 1], layer[i]];
          const after = totalCrossings();
          if (after < before) improved = true;
          else [layer[i], layer[i + 1]] = [layer[i + 1], layer[i]];
        }
      }
    }
  };

  let best = layers.map((l) => [...l]);
  let bestCross = totalCrossings();
  for (let s = 0; s < sweeps; s++) {
    wmedianSweep(s % 2 === 0 ? "down" : "up");
    transpose();
    const c = totalCrossings();
    if (c < bestCross) {
      bestCross = c;
      best = layers.map((l) => [...l]);
    }
  }
  for (let i = 0; i < layers.length; i++) layers[i] = best[i];

  // 5. Coordinate assignment along the CROSS axis (priority + relaxation).
  const sizeOf = (id: string) => (isDummy(id) ? DUMMY_SIZE : crossSize());
  function crossSize() {
    return orientation === "LR" ? nodeHeight : nodeWidth;
  }
  const gapBetween = (a: string, b: string) =>
    isDummy(a) || isDummy(b) ? nodeGap * DUMMY_GAP_SCALE : nodeGap;

  const center = new Map<string, number>();
  // Seed: pack each layer sequentially.
  for (const layer of layers) {
    let cursor = 0;
    layer.forEach((id, i) => {
      if (i > 0) {
        const prev = layer[i - 1];
        cursor += sizeOf(prev) / 2 + gapBetween(prev, id) + sizeOf(id) / 2;
      } else {
        cursor = sizeOf(id) / 2;
      }
      center.set(id, cursor);
    });
  }

  const relax = (layer: string[]) => {
    for (let pass = 0; pass < 40; pass++) {
      let moved = false;
      for (let i = 1; i < layer.length; i++) {
        const a = layer[i - 1];
        const b = layer[i];
        const minSep = sizeOf(a) / 2 + gapBetween(a, b) + sizeOf(b) / 2;
        const gap = center.get(b)! - center.get(a)!;
        if (gap < minSep - 1e-6) {
          const mid = (center.get(a)! + center.get(b)!) / 2;
          center.set(a, mid - minSep / 2);
          center.set(b, mid + minSep / 2);
          moved = true;
        }
      }
      if (!moved) break;
    }
  };

  for (let it = 0; it < 6; it++) {
    const dir: "down" | "up" = it % 2 === 0 ? "down" : "up";
    const range =
      dir === "down"
        ? [...layers.keys()]
        : [...layers.keys()].reverse();
    for (const li of range) {
      const adj = dir === "down" ? upAdj : downAdj;
      layers[li].forEach((id) => {
        const ns = (adj.get(id) ?? [])
          .map((n) => center.get(n))
          .filter((c): c is number => c !== undefined);
        if (ns.length) center.set(id, median(ns));
      });
      relax(layers[li]);
    }
  }

  // Compaction: squeeze out slack toward each layer's centre of mass while
  // preserving order + min separation, so straightening never inflates height.
  for (let pass = 0; pass < 3; pass++) {
    for (const layer of layers) {
      if (layer.length < 2) continue;
      const centers = layer.map((id) => center.get(id)!);
      const anchor = centers.reduce((a, b) => a + b, 0) / centers.length;
      // Pivot around the node nearest the anchor; pull the two sides inward.
      let pivot = 0;
      for (let i = 1; i < layer.length; i++) {
        if (Math.abs(centers[i] - anchor) < Math.abs(centers[pivot] - anchor)) {
          pivot = i;
        }
      }
      for (let i = pivot + 1; i < layer.length; i++) {
        const a = layer[i - 1];
        const b = layer[i];
        const minSep = sizeOf(a) / 2 + gapBetween(a, b) + sizeOf(b) / 2;
        center.set(b, Math.min(center.get(b)!, center.get(a)! + minSep));
      }
      for (let i = pivot - 1; i >= 0; i--) {
        const a = layer[i];
        const b = layer[i + 1];
        const minSep = sizeOf(a) / 2 + gapBetween(a, b) + sizeOf(b) / 2;
        center.set(a, Math.max(center.get(a)!, center.get(b)! - minSep));
      }
    }
  }

  // Normalize the cross axis so the min edge sits at `padding`.
  let minCross = Infinity;
  let maxCross = -Infinity;
  for (const layer of layers) {
    for (const id of layer) {
      const c = center.get(id)!;
      minCross = Math.min(minCross, c - sizeOf(id) / 2);
      maxCross = Math.max(maxCross, c + sizeOf(id) / 2);
    }
  }
  if (!Number.isFinite(minCross)) {
    minCross = 0;
    maxCross = 0;
  }
  const crossShift = padding - minCross;

  const nodeAlong = orientation === "LR" ? nodeWidth : nodeHeight;
  const alongCenterOf = (layer: number) =>
    padding + nodeAlong / 2 + layer * (nodeAlong + layerGap);

  // Build positioned REAL nodes + a lookup of every id's (along, cross) center.
  const centerPoint = (id: string, layer: number): { x: number; y: number } => {
    const along = alongCenterOf(layer);
    const cross = center.get(id)! + crossShift;
    return orientation === "LR" ? { x: along, y: cross } : { x: cross, y: along };
  };

  const nodes: PositionedNode[] = [];
  const nodeByKey: Record<string, PositionedNode> = {};
  layers.forEach((layer, li) => {
    let realIdx = 0;
    for (const id of layer) {
      if (isDummy(id)) continue;
      const cpt = centerPoint(id, li);
      const node: PositionedNode = {
        key: id,
        layer: li,
        index: realIdx++,
        x: cpt.x - nodeWidth / 2,
        y: cpt.y - nodeHeight / 2,
        cx: cpt.x,
        cy: cpt.y,
      };
      nodes.push(node);
      nodeByKey[id] = node;
    }
  });

  // Anchor a routed edge onto the box edges of its endpoints.
  const exitAnchor = (n: PositionedNode) =>
    orientation === "LR"
      ? { x: n.x + nodeWidth, y: n.cy }
      : { x: n.cx, y: n.y + nodeHeight };
  const entryAnchor = (n: PositionedNode) =>
    orientation === "LR" ? { x: n.x, y: n.cy } : { x: n.cx, y: n.y };

  const routedEdges: RoutedEdge[] = [];
  for (const from of keys) {
    for (const to of directChildren.get(from)!) {
      const nf = nodeByKey[from];
      const nt = nodeByKey[to];
      const chain = edgeChain.get(`${from}->${to}`) ?? [];
      const baseLayer = layerOf.get(from)! + 1;
      const mid = chain.map((id, idx) => centerPoint(id, baseLayer + idx));
      routedEdges.push({
        from,
        to,
        points: [exitAnchor(nf), ...mid, entryAnchor(nt)],
        indirect: false,
      });
    }
  }
  for (const e of indirectEdges) {
    const nf = nodeByKey[e.from];
    const nt = nodeByKey[e.to];
    routedEdges.push({
      from: e.from,
      to: e.to,
      points: [exitAnchor(nf), entryAnchor(nt)],
      indirect: true,
    });
  }

  const alongTotal =
    layerCount * nodeAlong + Math.max(0, layerCount - 1) * layerGap;
  const crossTotal = maxCross - minCross;
  const width =
    padding * 2 + (orientation === "LR" ? alongTotal : crossTotal);
  const height =
    padding * 2 + (orientation === "LR" ? crossTotal : alongTotal);

  return {
    nodes,
    nodeByKey,
    edges: routedEdges,
    width: Math.max(width, nodeWidth + padding * 2),
    height: Math.max(height, nodeHeight + padding * 2),
    layerCount,
    crossings: bestCross,
  };
}
