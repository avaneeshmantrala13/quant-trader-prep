import type { PipelineStage, UserProgress } from "@/types/progress";
import { passesDrillingGate, passesMockGate } from "./gates";

/**
 * The PURE stage machine for the guided pipeline (spec §1 / §3.4). No React, no
 * side effects — every function is a deterministic read over `UserProgress`.
 *
 * This mirrors the `shouldRedirectToDiagnostic` precedent
 * (`src/lib/diagnostic/gate.ts`): the router is a pure function of the pipeline
 * stamps + LIVE gate results, so the UI never owns navigation truth. Phase P1
 * will make {@link resolveStage} the sole navigation authority (behind the
 * `PIPELINE_ENABLED` flag today).
 */

/** Alias for the on-disk stage enum (spec §3.4), re-exported for pipeline code. */
export type Stage = PipelineStage;

/**
 * The authoritative stage order (login is stage 1 in the UX but handled by auth,
 * so this begins at the first in-app stage). `nextStage` / `stageIndex` derive
 * from this array, so adding/reordering a stage happens in exactly one place.
 */
export const stageOrder: readonly Stage[] = [
  "diagnostic-untimed",
  "diagnostic-timed",
  "game-oa",
  "diagnosis",
  "drilling",
  "mock",
  "greenlight",
] as const;

/** The first stage a brand-new user (no `pipeline`) starts at. */
export const FIRST_STAGE: Stage = stageOrder[0];

/** The terminal stage (no successor). */
export const TERMINAL_STAGE: Stage = stageOrder[stageOrder.length - 1];

/** 0-based position of a stage in {@link stageOrder} (−1 if unknown). */
export function stageIndex(stage: Stage): number {
  return stageOrder.indexOf(stage);
}

/**
 * The stage AFTER `stage`, or `null` at the terminal stage (or for an unknown
 * stage). Pure lookup over {@link stageOrder} — no progress needed.
 */
export function nextStage(stage: Stage): Stage | null {
  const i = stageIndex(stage);
  if (i < 0 || i >= stageOrder.length - 1) return null;
  return stageOrder[i + 1];
}

/**
 * The LAST-RESOLVED stage stored on `progress.pipeline`, defaulting to the first
 * stage for a pre-pipeline (migrated) user with `pipeline === undefined`. This
 * is the cheap "what did we persist" read; use {@link resolveStage} when you
 * need the correct stage RE-DERIVED from stamps + live gates.
 */
export function currentStage(progress: UserProgress): Stage {
  return progress.pipeline?.stage ?? FIRST_STAGE;
}

/**
 * DERIVE the correct stage purely from the completion stamps + LIVE gate results
 * (spec §3.4). Walks forward from the first stage, advancing only while each
 * prior stage's completion condition holds:
 *
 *  - stages 2–5 (untimed → timed → game-OA → diagnosis) latch on their write-once
 *    `*At` stamps — these are one-way onboarding markers, like `diagnosticDoneAt`.
 *  - drilling → mock is gated by the LIVE Stage-6 aggregate
 *    ({@link passesDrillingGate}), NOT the `drillingClearedAt` stamp.
 *  - mock → greenlight is gated by the LIVE mock gate ({@link passesMockGate}).
 *
 * Because the last two checks read live mastery/results, a relocked node (Beta
 * decayed below 0.80) or a broken mock streak RE-DERIVES an EARLIER stage even
 * when `greenlitAt` is stamped — i.e. this pure function is what enforces the
 * "readiness can be revoked / un-greenlight" decision (RESOLVED DECISION §10.5).
 * The router should persist the returned stage back into `pipeline.stage`.
 */
export function resolveStage(progress: UserProgress): Stage {
  const p = progress.pipeline;
  if (!p?.untimedDoneAt) return "diagnostic-untimed";
  if (!p.timedDoneAt) return "diagnostic-timed";
  if (!p.gameOaDoneAt) return "game-oa";
  if (!p.diagnosisComputedAt) return "diagnosis";
  // Stage 6 → 7: re-evaluate the aggregate gate from LIVE mastery (relock-aware).
  if (!passesDrillingGate(progress)) return "drilling";
  // Stage 7 → 8: re-evaluate the mock gate from LIVE results.
  if (!passesMockGate(progress)) return "mock";
  return "greenlight";
}
