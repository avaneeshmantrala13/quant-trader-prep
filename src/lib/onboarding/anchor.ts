/**
 * Pure geometry for the ONBOARDING TOUR coach-marks. Given a target element's
 * bounding rect (or `null` when the target is missing/off-screen), the current
 * viewport, and the measured box size, this decides which SIDE of the target to
 * place the box on, the clamped top/left of the box, and where the arrow should
 * sit along the box edge so it points back at the target.
 *
 * No React, no DOM, no side effects — just numbers in, numbers out — so the
 * placement + fallback logic is deterministically unit-testable. The overlay
 * component owns all measurement (getBoundingClientRect), scrolling, and
 * re-layout on resize/scroll; it just feeds rects into these helpers.
 */

import type { TourTarget } from "@/lib/onboarding/steps";

/** Which side of the target the box is placed on. `center` = no anchor. */
export type CoachmarkSide = "top" | "bottom" | "left" | "right" | "center";

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Placement {
  /** Side of the target the box sits on (`center` when there is no target). */
  side: CoachmarkSide;
  /** Viewport-clamped box position, in px (for `position: fixed`). */
  top: number;
  left: number;
  /**
   * Arrow offset measured from the box's own top-left corner, in px, along the
   * edge that touches the target. Only meaningful when `side !== "center"`.
   */
  arrowLeft: number;
  arrowTop: number;
}

/** Gap between the target and the box, in px. */
export const COACHMARK_GAP = 12;
/** Minimum distance the box keeps from the viewport edges, in px. */
export const COACHMARK_MARGIN = 8;
/** Keep the arrow this far from the box's own corners, in px. */
export const COACHMARK_ARROW_INSET = 18;

/** The CSS selector for a given tour target hook. */
export function tourTargetSelector(target: TourTarget): string {
  return `[data-tour="${target}"]`;
}

function clamp(value: number, min: number, max: number): number {
  // When the box is wider/taller than the available span, `min` can exceed
  // `max`; prefer pinning to the start edge (min) so nothing runs off-screen.
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function centerPlacement(viewport: Size, box: Size): Placement {
  return {
    side: "center",
    top: clamp(
      (viewport.height - box.height) / 2,
      COACHMARK_MARGIN,
      viewport.height - box.height - COACHMARK_MARGIN,
    ),
    left: clamp(
      (viewport.width - box.width) / 2,
      COACHMARK_MARGIN,
      viewport.width - box.width - COACHMARK_MARGIN,
    ),
    arrowLeft: 0,
    arrowTop: 0,
  };
}

/**
 * Decide where to place a coach-mark box relative to `target`.
 *
 * - `target === null` → a centered box (graceful fallback for a missing target).
 * - Otherwise prefer BELOW the target (nav lives at the top of the page), then
 *   ABOVE, then RIGHT, then LEFT — whichever first has room for the whole box.
 *   If nothing fits (tiny viewport) we still place below and let clamping keep
 *   the box on-screen.
 *
 * The returned `top`/`left` are always clamped inside the viewport, and the
 * arrow offset is clamped to stay within the box's edge (never past a corner).
 */
export function computeCoachmarkPlacement(
  target: Rect | null,
  viewport: Size,
  box: Size,
): Placement {
  if (!target) return centerPlacement(viewport, box);

  const spaceBelow = viewport.height - (target.top + target.height);
  const spaceAbove = target.top;
  const spaceRight = viewport.width - (target.left + target.width);
  const spaceLeft = target.left;

  const needV = box.height + COACHMARK_GAP + COACHMARK_MARGIN;
  const needH = box.width + COACHMARK_GAP + COACHMARK_MARGIN;

  let side: CoachmarkSide;
  if (spaceBelow >= needV) side = "bottom";
  else if (spaceAbove >= needV) side = "top";
  else if (spaceRight >= needH) side = "right";
  else if (spaceLeft >= needH) side = "left";
  else side = "bottom";

  const targetCenterX = target.left + target.width / 2;
  const targetCenterY = target.top + target.height / 2;

  let top: number;
  let left: number;
  if (side === "bottom") {
    top = target.top + target.height + COACHMARK_GAP;
    left = targetCenterX - box.width / 2;
  } else if (side === "top") {
    top = target.top - COACHMARK_GAP - box.height;
    left = targetCenterX - box.width / 2;
  } else if (side === "right") {
    left = target.left + target.width + COACHMARK_GAP;
    top = targetCenterY - box.height / 2;
  } else {
    left = target.left - COACHMARK_GAP - box.width;
    top = targetCenterY - box.height / 2;
  }

  top = clamp(top, COACHMARK_MARGIN, viewport.height - box.height - COACHMARK_MARGIN);
  left = clamp(left, COACHMARK_MARGIN, viewport.width - box.width - COACHMARK_MARGIN);

  let arrowLeft: number;
  let arrowTop: number;
  if (side === "bottom" || side === "top") {
    arrowLeft = clamp(
      targetCenterX - left,
      COACHMARK_ARROW_INSET,
      box.width - COACHMARK_ARROW_INSET,
    );
    arrowTop = side === "bottom" ? 0 : box.height;
  } else {
    arrowTop = clamp(
      targetCenterY - top,
      COACHMARK_ARROW_INSET,
      box.height - COACHMARK_ARROW_INSET,
    );
    arrowLeft = side === "right" ? 0 : box.width;
  }

  return { side, top, left, arrowLeft, arrowTop };
}
