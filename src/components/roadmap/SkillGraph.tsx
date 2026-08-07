import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { RoadmapSkillRow } from "@/components/roadmap/useRoadmapData";
import type { SkillStatus } from "@/lib/roadmap/readiness";
import {
  layoutSkillGraph,
  type GraphLayout,
  type LayoutOptions,
  type RoutedEdge,
} from "@/components/roadmap/graphLayout";

/**
 * SKILL GRAPH — a clean, CS-style directed-graph view of the Knowledge State
 * Tree.
 *
 * Nodes are topics; edges are prerequisite relationships (arrow points from a
 * prerequisite INTO the topic that depends on it). By default only the DIRECT
 * prerequisite edges are drawn (the transitive-reduced tree), routed through
 * the layered layout so they never slice across node boxes. Redundant /
 * long-range links are hidden behind an opt-in "indirect links" toggle and
 * drawn faintly when shown.
 *
 * Nodes are coloured by mastery (mastered → lit "bull" green, in-progress →
 * accent, ready → neutral, locked → dim); the edges leading INTO a mastered
 * node light up so the pathway visibly illuminates as the learner progresses.
 * Everything uses the semantic THEME TOKENS as `rgb(var(--color-*))`, so it
 * re-skins with every theme + light/dark automatically. Layout is analytic
 * (`graphLayout.ts`) — no DOM measurement — so it renders identically in tests.
 */

const NODE_W = 182;
const NODE_H = 56;

const GRAPH_OPTS: Partial<LayoutOptions> = {
  nodeWidth: NODE_W,
  nodeHeight: NODE_H,
  layerGap: 92,
  nodeGap: 26,
  padding: 30,
  orientation: "LR",
  sweeps: 8,
};

/** Per-status stroke / fill / text tokens (resolve to the active theme). */
const STATUS_STYLE: Record<
  SkillStatus,
  { stroke: string; fill: string; text: string; bar: string; strokeW: number }
> = {
  mastered: {
    stroke: "rgb(var(--color-bull))",
    fill: "rgb(var(--color-bull) / 0.15)",
    text: "rgb(var(--color-text-primary))",
    bar: "rgb(var(--color-bull))",
    strokeW: 2,
  },
  "in-progress": {
    stroke: "rgb(var(--color-accent))",
    fill: "rgb(var(--color-accent) / 0.11)",
    text: "rgb(var(--color-text-primary))",
    bar: "rgb(var(--color-accent))",
    strokeW: 2,
  },
  available: {
    stroke: "rgb(var(--color-border-strong))",
    fill: "rgb(var(--color-surface))",
    text: "rgb(var(--color-text-primary))",
    bar: "rgb(var(--color-border-strong))",
    strokeW: 1.5,
  },
  locked: {
    stroke: "rgb(var(--color-border))",
    fill: "rgb(var(--color-surface-muted))",
    text: "rgb(var(--color-text-muted))",
    bar: "rgb(var(--color-border))",
    strokeW: 1,
  },
};

type EdgeKind = "lit" | "frontier" | "dim";

const EDGE_STYLE: Record<
  EdgeKind,
  { stroke: string; width: number; opacity: number; marker: string }
> = {
  lit: {
    stroke: "rgb(var(--color-bull))",
    width: 2.25,
    opacity: 0.95,
    marker: "url(#rm-arrow-lit)",
  },
  frontier: {
    stroke: "rgb(var(--color-accent))",
    width: 2.25,
    opacity: 0.95,
    marker: "url(#rm-arrow-frontier)",
  },
  dim: {
    stroke: "rgb(var(--color-border-strong))",
    width: 1.25,
    opacity: 0.45,
    marker: "url(#rm-arrow-dim)",
  },
};

/**
 * Greedy word-wrap into at most `maxLines` lines of ~`maxChars` chars, with a
 * single clean ellipsis if the name is longer than the box can hold. (The full
 * name is always available via the node's `<title>` tooltip + aria-label.)
 */
function wrapLabel(text: string, maxChars = 21, maxLines = 2): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (cur && candidate.length > maxChars) {
      lines.push(cur);
      cur = w;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);

  let out = lines;
  if (lines.length > maxLines) {
    out = lines.slice(0, maxLines);
    out[maxLines - 1] = lines.slice(maxLines - 1).join(" ");
  }
  return out.map((ln) =>
    ln.length > maxChars ? `${ln.slice(0, maxChars - 1).trimEnd()}…` : ln,
  );
}

function classifyEdge(fromMastered: boolean, toMastered: boolean): EdgeKind {
  if (toMastered) return "lit";
  if (fromMastered) return "frontier";
  return "dim";
}

/** Smooth path through the routed waypoints (horizontal tangents for LR). */
function edgePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const span = b.x - a.x;
    const dx = Math.sign(span || 1) * Math.max(26, Math.abs(span) * 0.5);
    d += ` C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  }
  return d;
}

function ArrowMarker({ id, color }: { id: string; color: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="8.5"
      refY="5"
      markerWidth="7"
      markerHeight="7"
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
    </marker>
  );
}

function SkillGraphNode({
  row,
  x,
  y,
  isCurrent,
  onSelect,
}: {
  row: RoadmapSkillRow;
  x: number;
  y: number;
  isCurrent: boolean;
  onSelect: (row: RoadmapSkillRow) => void;
}) {
  const p = row.progress;
  const style = STATUS_STYLE[p.status];
  const lines = wrapLabel(row.name);
  const locked = p.status === "locked";
  const barW = NODE_W - 24;
  const fillW = Math.max(0, Math.min(1, p.masteryPct / 100)) * barW;
  const textTop = lines.length === 1 ? y + 30 : y + 23;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${row.name} — ${p.status.replace("-", " ")}, ${p.masteryPct}% mastered. Open to practice.`}
      className="rm-node"
      style={{ cursor: "pointer" }}
      onClick={() => onSelect(row)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(row);
        }
      }}
    >
      <title>
        {row.name} · {p.status.replace("-", " ")} · {p.masteryPct}% toward
        mastery
      </title>

      {isCurrent && (
        <rect
          x={x - 5}
          y={y - 5}
          width={NODE_W + 10}
          height={NODE_H + 10}
          rx={12}
          fill="none"
          stroke="rgb(var(--color-accent))"
          strokeWidth={2}
          className="rm-current-ring"
        />
      )}

      <rect
        x={x}
        y={y}
        width={NODE_W}
        height={NODE_H}
        rx={10}
        fill={style.fill}
        stroke={style.stroke}
        strokeWidth={style.strokeW}
        filter={p.mastered ? "url(#rm-glow-bull)" : undefined}
      />

      {/* Status accent strip on the left edge. */}
      <rect
        x={x}
        y={y + 7}
        width={4}
        height={NODE_H - 14}
        rx={2}
        fill={style.stroke}
      />

      {/* Status glyph, top-right: check (mastered) / lock (locked) / dot. */}
      {p.mastered ? (
        <path
          d={`M ${x + NODE_W - 21} ${y + 13} l 3 3 l 6 -7`}
          fill="none"
          stroke="rgb(var(--color-bull))"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : locked ? (
        <g stroke={style.stroke} strokeWidth={1.4} fill="none">
          <rect
            x={x + NODE_W - 23}
            y={y + 12}
            width={11}
            height={8}
            rx={1.5}
            fill="rgb(var(--color-surface-muted))"
          />
          <path
            d={`M ${x + NODE_W - 20.5} ${y + 12} v -2 a 2.5 2.5 0 0 1 6 0 v 2`}
          />
        </g>
      ) : (
        <circle cx={x + NODE_W - 16} cy={y + 15} r={3.5} fill={style.stroke} />
      )}

      {/* Topic name (1–2 lines). */}
      {lines.map((ln, i) => (
        <text
          key={i}
          x={x + 12}
          y={textTop + i * 14}
          fontSize={12}
          fontWeight={600}
          fill={style.text}
          style={{ fontFamily: "var(--font-display)" }}
        >
          {ln}
        </text>
      ))}

      {/* Mastery mini-bar + percentage. */}
      <rect
        x={x + 12}
        y={y + NODE_H - 13}
        width={barW}
        height={5}
        rx={2.5}
        fill="rgb(var(--color-surface-muted))"
        stroke="rgb(var(--color-border) / 0.6)"
        strokeWidth={0.5}
      />
      <rect
        x={x + 12}
        y={y + NODE_H - 13}
        width={fillW}
        height={5}
        rx={2.5}
        fill={style.bar}
      />
      <text
        x={x + NODE_W - 12}
        y={y + NODE_H - 16}
        textAnchor="end"
        fontSize={9.5}
        fill="rgb(var(--color-text-muted))"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {p.masteryPct}%
      </text>
    </g>
  );
}

export interface SkillGraphProps {
  /** Rows (nodes) to render. Prereq edges are drawn only between shown rows. */
  rows: RoadmapSkillRow[];
  /** The learner's "you are here" topicKey, highlighted with a pulsing ring. */
  currentKey?: string;
  /** Override navigation (defaults to routing to the topic's practice link). */
  onNavigate?: (row: RoadmapSkillRow) => void;
  /** Accessible label for the graph region. */
  ariaLabel?: string;
}

export function SkillGraph({
  rows,
  currentKey,
  onNavigate,
  ariaLabel = "Knowledge state graph",
}: SkillGraphProps) {
  const navigate = useNavigate();
  const [showIndirect, setShowIndirect] = useState(false);

  const { layout, rowByKey, masteredByKey } = useMemo(() => {
    const lay: GraphLayout = layoutSkillGraph(
      rows.map((r) => ({ key: r.node.topicKey, prereqs: r.node.prereqs })),
      GRAPH_OPTS,
    );
    const byKey = new Map(rows.map((r) => [r.node.topicKey, r]));
    const mastered = new Map(
      rows.map((r) => [r.node.topicKey, r.progress.mastered]),
    );
    return { layout: lay, rowByKey: byKey, masteredByKey: mastered };
  }, [rows]);

  const handleSelect = (row: RoadmapSkillRow) => {
    if (onNavigate) onNavigate(row);
    else navigate(row.href);
  };

  const directEdges = layout.edges.filter((e) => !e.indirect);
  const indirectEdges = layout.edges.filter((e) => e.indirect);
  // Draw dim → frontier → lit so highlighted edges sit on top.
  const rank = (e: RoutedEdge) =>
    classifyEdge(!!masteredByKey.get(e.from), !!masteredByKey.get(e.to)) === "lit"
      ? 2
      : classifyEdge(!!masteredByKey.get(e.from), !!masteredByKey.get(e.to)) ===
          "frontier"
        ? 1
        : 0;
  const orderedDirect = [...directEdges].sort((a, b) => rank(a) - rank(b));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <SkillGraphLegend />
        {indirectEdges.length > 0 && (
          <label className="flex cursor-pointer select-none items-center gap-1.5">
            <input
              type="checkbox"
              className="accent-accent"
              checked={showIndirect}
              onChange={(e) => setShowIndirect(e.target.checked)}
            />
            <span className="label text-secondary">
              Indirect links ({indirectEdges.length})
            </span>
          </label>
        )}
      </div>

      <div
        className="rm-graph-scroll relative overflow-auto border border-subtle bg-surface"
        style={{ maxHeight: "76vh" }}
      >
        <style>{`
          @keyframes rm-ring-pulse { 0%,100% { opacity: 0.95; } 50% { opacity: 0.4; } }
          .rm-current-ring { animation: rm-ring-pulse 1.9s ease-in-out infinite; transform-box: fill-box; }
          .rm-node:focus { outline: none; }
          .rm-node:focus-visible > rect:nth-of-type(1) { stroke: rgb(var(--color-accent)); stroke-width: 2.5; }
          .rm-node:hover { filter: brightness(1.05); }
        `}</style>
        <svg
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label={ariaLabel}
          style={{ display: "block", margin: "0 auto" }}
        >
          <defs>
            <ArrowMarker id="rm-arrow-lit" color="rgb(var(--color-bull))" />
            <ArrowMarker
              id="rm-arrow-frontier"
              color="rgb(var(--color-accent))"
            />
            <ArrowMarker
              id="rm-arrow-dim"
              color="rgb(var(--color-border-strong))"
            />
            <filter
              id="rm-glow-bull"
              x="-40%"
              y="-40%"
              width="180%"
              height="180%"
            >
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="3.5"
                floodColor="rgb(var(--color-bull))"
                floodOpacity="0.45"
              />
            </filter>
            <pattern
              id="rm-grid"
              width="28"
              height="28"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 28 0 L 0 0 0 28"
                fill="none"
                stroke="rgb(var(--tex-grid) / 0.3)"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          <rect
            x={0}
            y={0}
            width={layout.width}
            height={layout.height}
            fill="url(#rm-grid)"
          />

          {/* Opt-in indirect (transitively-implied) links, faint + behind. */}
          {showIndirect && (
            <g fill="none">
              {indirectEdges.map((e) => (
                <path
                  key={`i-${e.from}->${e.to}`}
                  d={edgePath(e.points)}
                  stroke="rgb(var(--color-text-muted))"
                  strokeWidth={1}
                  strokeOpacity={0.32}
                  strokeDasharray="2 6"
                  strokeLinecap="round"
                />
              ))}
            </g>
          )}

          {/* Direct prerequisite edges (prereq → dependent). */}
          <g fill="none">
            {orderedDirect.map((e) => {
              const kind = classifyEdge(
                !!masteredByKey.get(e.from),
                !!masteredByKey.get(e.to),
              );
              const es = EDGE_STYLE[kind];
              return (
                <path
                  key={`${e.from}->${e.to}`}
                  d={edgePath(e.points)}
                  stroke={es.stroke}
                  strokeWidth={es.width}
                  strokeOpacity={es.opacity}
                  strokeLinecap="round"
                  markerEnd={es.marker}
                />
              );
            })}
          </g>

          {/* Nodes on top. */}
          {layout.nodes.map((n) => {
            const row = rowByKey.get(n.key);
            if (!row) return null;
            return (
              <SkillGraphNode
                key={n.key}
                row={row}
                x={n.x}
                y={n.y}
                isCurrent={n.key === currentKey}
                onSelect={handleSelect}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/** Compact colour legend for the graph (mastery states + path highlight). */
export function SkillGraphLegend() {
  const dots: { label: string; color: string; soft?: boolean }[] = [
    { label: "Mastered", color: "rgb(var(--color-bull))" },
    { label: "In progress", color: "rgb(var(--color-accent))" },
    { label: "Ready", color: "rgb(var(--color-border-strong))" },
    { label: "Locked", color: "rgb(var(--color-border))", soft: true },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {dots.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: it.color, opacity: it.soft ? 0.6 : 1 }}
            aria-hidden="true"
          />
          <span className="label text-secondary">{it.label}</span>
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block h-0.5 w-5"
          style={{ backgroundColor: "rgb(var(--color-bull))" }}
          aria-hidden="true"
        />
        <span className="label text-secondary">Lit path → mastered</span>
      </span>
    </div>
  );
}
