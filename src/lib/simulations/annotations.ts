/**
 * ============================================================================
 *  SIMULATIONS — ANNOTATION POSITIONING MATH (pure, unit-tested)
 * ============================================================================
 * Small, dependency-free geometry helpers that place a callout (a short leader
 * line + a caption) next to a target point inside an SVG plot box. Kept pure —
 * no React, no DOM — so the arrow/caption placement is trivially unit-testable
 * and reused by the shared `LineChart` / `BarChart` `annotations` prop.
 *
 * Everything works in VIEWBOX PIXEL space (the same coordinates the chart's
 * `sx`/`sy` scale functions emit) so the math is independent of data domains.
 * The one job that matters for correctness is CLAMPING: a caption must never
 * spill outside the plot box / viewBox, no matter where its target sits.
 */

export interface Point {
  x: number;
  y: number;
}

/** The plottable rectangle, in viewBox pixels. */
export interface PlotBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Which way the caption sits relative to its target (the leader direction). */
export type AnnotationSide = "up" | "down" | "left" | "right";

/** SVG text-anchor produced for a caption. */
export type TextAnchor = "start" | "middle" | "end";

/** SVG dominant-baseline produced for a caption. */
export type Baseline = "auto" | "middle" | "hanging";

export interface AnnotationPlacement {
  /** The arrow tip — sits exactly on the target point. */
  tip: Point;
  /** Where the leader line ends and the caption text is anchored. */
  anchor: Point;
  /** text-anchor to hand the caption `<text>`. */
  textAnchor: TextAnchor;
  /** dominant-baseline to hand the caption `<text>`. */
  baseline: Baseline;
}

/** Clamp `v` into `[lo, hi]` (returns `lo` if the range is inverted). */
export function clamp(v: number, lo: number, hi: number): number {
  if (hi < lo) return lo;
  return Math.min(hi, Math.max(lo, v));
}

/**
 * The raw caption anchor for a target `tip`, `distance` pixels away in the
 * given `side` direction (before any clamping). `up`/`down` move vertically,
 * `left`/`right` move horizontally.
 */
export function leaderAnchor(
  tip: Point,
  side: AnnotationSide,
  distance: number,
): Point {
  switch (side) {
    case "up":
      return { x: tip.x, y: tip.y - distance };
    case "down":
      return { x: tip.x, y: tip.y + distance };
    case "left":
      return { x: tip.x - distance, y: tip.y };
    case "right":
      return { x: tip.x + distance, y: tip.y };
  }
}

/** The caption's horizontal text-anchor for a given leader side. */
export function textAnchorForSide(side: AnnotationSide): TextAnchor {
  if (side === "left") return "end";
  if (side === "right") return "start";
  return "middle";
}

/** The caption's vertical baseline for a given leader side. */
export function baselineForSide(side: AnnotationSide): Baseline {
  if (side === "up") return "auto"; // text sits ABOVE the anchor point
  if (side === "down") return "hanging"; // text sits BELOW the anchor point
  return "middle";
}

/**
 * A cheap monospace-ish width estimate for a caption, in pixels. Good enough
 * for clamping so the caption never overflows the viewBox; ~0.6em per glyph is
 * a safe upper bound for the small fonts used on the charts.
 */
export function estimateCaptionWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.6;
}

/**
 * The [minX, maxX] the anchor's x may take so a caption of `width` rendered
 * with `textAnchor` stays within `[box.left+pad, box.right-pad]`.
 */
function anchorXBounds(
  box: PlotBox,
  textAnchor: TextAnchor,
  width: number,
  pad: number,
): [number, number] {
  const lo = box.left + pad;
  const hi = box.right - pad;
  switch (textAnchor) {
    case "start": // text extends to the RIGHT of the anchor
      return [lo, hi - width];
    case "end": // text extends to the LEFT of the anchor
      return [lo + width, hi];
    case "middle": // text extends both ways
      return [lo + width / 2, hi - width / 2];
  }
}

export interface PlaceAnnotationOptions {
  tip: Point;
  side: AnnotationSide;
  /** Leader-line length in viewBox pixels. */
  distance: number;
  text: string;
  fontSize: number;
  box: PlotBox;
  /** Inner padding kept between the caption and the box edges. */
  pad?: number;
}

/**
 * Compute the full placement for one callout: the arrow tip (on the target),
 * the caption anchor `distance` px away on `side`, and the SVG text-anchor /
 * baseline — with the anchor CLAMPED so the caption's box never spills outside
 * the plot box. The tip is left exactly on the target so the arrow still points
 * at the right mark even when the caption was clamped away from it.
 */
export function placeAnnotation(
  opts: PlaceAnnotationOptions,
): AnnotationPlacement {
  const { tip, side, distance, text, fontSize, box } = opts;
  const pad = opts.pad ?? 4;

  const textAnchor = textAnchorForSide(side);
  const baseline = baselineForSide(side);
  const raw = leaderAnchor(tip, side, distance);

  const width = estimateCaptionWidth(text, fontSize);
  const [minX, maxX] = anchorXBounds(box, textAnchor, width, pad);

  // Vertical room: leave the font's cap-height clear of the top/bottom edges.
  const topBound = box.top + pad + (baseline === "auto" ? fontSize : 0);
  const bottomBound = box.bottom - pad - (baseline === "hanging" ? fontSize : 0);

  return {
    tip,
    anchor: {
      x: clamp(raw.x, minX, maxX),
      y: clamp(raw.y, topBound, bottomBound),
    },
    textAnchor,
    baseline,
  };
}

/**
 * A tiny arrowhead (two short barbs) for the tip of a leader line, returned as
 * an SVG polyline `points` string. `size` is the barb length in pixels; the
 * barbs open back toward the caption `anchor` so the head reads as an arrow
 * pointing AT the tip.
 */
export function arrowHeadPoints(
  tip: Point,
  anchor: Point,
  size: number,
): string {
  const dx = anchor.x - tip.x;
  const dy = anchor.y - tip.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // Rotate the unit direction ±35° and step `size` back from the tip.
  const spread = 0.6; // ~35° in radians
  const cos = Math.cos(spread);
  const sin = Math.sin(spread);
  const b1 = {
    x: tip.x + size * (ux * cos - uy * sin),
    y: tip.y + size * (ux * sin + uy * cos),
  };
  const b2 = {
    x: tip.x + size * (ux * cos + uy * sin),
    y: tip.y + size * (-ux * sin + uy * cos),
  };
  return `${b1.x},${b1.y} ${tip.x},${tip.y} ${b2.x},${b2.y}`;
}
