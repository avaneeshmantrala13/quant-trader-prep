/**
 * Speed Arena — presets & constants (Phase 6).
 *
 * The arena is a dedicated timed mental-math drill in the Zetamac / Optiver
 * "80-in-8" mold. Two canonical presets plus a Custom builder, all described by
 * one plain-data `ArenaPreset` so scoring / analytics / the deterministic
 * question stream stay pure and reproducible.
 *
 * Research justification (see build-specs/DESIGN_TIMING_LEADERBOARD.md §1, §4A):
 *  - Optiver's "80-in-8" test (80 questions / 8:00, +1 correct / −1 wrong, skips
 *    free) and Jane Street's ~7-minute Zetamac gate are real market-maker
 *    screens; the arena mirrors them.
 *  - The speed-accuracy tradeoff (§4A) motivates the rushing detector and the
 *    EV coaching nudge — reasoning tabs stay UNTIMED by default (a soft
 *    `TimedToggle` never blocks progression).
 *
 * NOTE: the numeric thresholds below (RUSH_FLOOR_MS, RUSH_RATIO, CARELESS_RATIO,
 * OPTIVER_PASS/COMPETITIVE) are documented DESIGN DEFAULTS and are meant to be
 * tunable — do not treat them as hard invariants.
 */

export type ArenaMode = "zetamac" | "optiver" | "custom";
export type ArenaOp = "add" | "sub" | "mul" | "div";
export type ArenaPack = "int" | "fraction" | "decimal" | "percent";
export type BoardKind = "zetamac" | "optiver";

/**
 * A fully self-describing arena configuration. `ranges` is keyed by operation
 * name (`add`/`sub`/`mul`/`div`); each entry bounds the operands that op draws
 * (see `arenaQuestionStream`). `questionCap` caps total questions (Optiver = 80);
 * omit it for a pure fixed-window Zetamac run.
 */
export interface ArenaPreset {
  mode: ArenaMode;
  durationSec: number;
  questionCap?: number;
  /** true ⇒ wrong answers cost points (Optiver +1/−1); false ⇒ count-only. */
  penalty: boolean;
  /** true ⇒ skipping scores 0; false ⇒ skipping is penalized like a wrong. */
  skipsFree: boolean;
  ops: ArenaOp[];
  packs: ArenaPack[];
  ranges: Record<string, [number, number]>;
  /**
   * Interview pacing overlay (Case B speed focus). Additive and orthogonal to
   * scoring — it is DELIBERATELY excluded from `configHash` so turning it on
   * never changes the leaderboard bucket. When `interview` is true the runner
   * shows a per-question countdown + pacing feedback and the report surfaces
   * speed stats alongside accuracy.
   */
  interview?: boolean;
  /**
   * Optional explicit per-question budget (ms) for the interview overlay. When
   * absent it is derived from the window/cap (see `arena/budget.ts`). Used for
   * pacing feedback + "% within budget" only; never affects scoring.
   */
  budgetMs?: number;
  /** Optional adaptive time pressure: tighten the budget as accuracy stabilizes. */
  adaptive?: boolean;
  /**
   * Optional id of the real OA this preset mirrors (see
   * `@/content/arena/oaFormats.ts`). Powers the budget-parity audit. Never
   * affects scoring or the leaderboard bucket.
   */
  oaFormatId?: string;
}

/** Zetamac's classic operand ranges (integers), keyed by operation. */
export const DEFAULT_RANGES: Record<ArenaOp, [number, number]> = {
  add: [2, 100],
  sub: [2, 100],
  mul: [2, 12],
  div: [2, 12],
};

/** Durations (seconds) offered for Zetamac mode. */
export const ZETAMAC_DURATIONS = [30, 60, 120, 300, 600] as const;

/**
 * Zetamac default: fixed 120s window, NO penalty, integers only, all four ops.
 * `score = #correct`.
 */
export const ZETAMAC_DEFAULT: ArenaPreset = {
  mode: "zetamac",
  durationSec: 120,
  penalty: false,
  skipsFree: true,
  ops: ["add", "sub", "mul", "div"],
  packs: ["int"],
  ranges: { ...DEFAULT_RANGES },
};

/**
 * Optiver default: 80 questions / 8:00 (480s), +1 correct / −1 wrong, skips
 * free. Community pass ≈ 56; competitive ≈ 70.
 */
export const OPTIVER_DEFAULT: ArenaPreset = {
  mode: "optiver",
  durationSec: 480,
  questionCap: 80,
  penalty: true,
  skipsFree: true,
  ops: ["add", "sub", "mul", "div"],
  packs: ["int"],
  ranges: { ...DEFAULT_RANGES },
};

/** A neutral Custom starting point the builder mutates. */
export const CUSTOM_DEFAULT: ArenaPreset = {
  mode: "custom",
  durationSec: 120,
  penalty: false,
  skipsFree: true,
  ops: ["add", "sub", "mul", "div"],
  packs: ["int"],
  ranges: { ...DEFAULT_RANGES },
};

/** Rushing detector: hard floor (ms) below which "fast" always counts. */
export const RUSH_FLOOR_MS = 800;
/** Rushing detector: wrong && rt < RUSH_RATIO × median[op] ⇒ a rush error. */
export const RUSH_RATIO = 0.5;
/** Aggregate nudge: rush_errors / total_errors ≥ this ⇒ careless signal. */
export const CARELESS_RATIO = 0.4;

/** Optiver score markers (see §5). */
export const OPTIVER_PASS = 56;
export const OPTIVER_COMPETITIVE = 70;

/**
 * Default per-question budget (ms) for the interview overlay when a preset has
 * no fixed question cap (e.g. Zetamac's open count-up window). Grounded in the
 * arithmetic-sprint consensus of ~6 s/q — Optiver 80-in-8, Flow 60-in-6, and
 * Maven 50-in-5 all land at 6.0 s/q (FIRM_TIMED_ASSESSMENTS.md §1).
 */
export const DEFAULT_SPRINT_BUDGET_MS = 6000;

/** Return the built-in default preset for a mode. */
export function presetForMode(mode: ArenaMode): ArenaPreset {
  if (mode === "zetamac") return { ...ZETAMAC_DEFAULT };
  if (mode === "optiver") return { ...OPTIVER_DEFAULT };
  return { ...CUSTOM_DEFAULT };
}

/**
 * Stable, order-independent hash of the score-affecting fields of a preset.
 * Used as the leaderboard `configHash` so only runs of the SAME config are
 * ranked against each other. Pure and deterministic (no crypto needed — this
 * is a bucketing key, not a security token).
 */
export function configHash(preset: ArenaPreset): string {
  const ops = [...preset.ops].sort().join("");
  const packs = [...preset.packs].sort().join("");
  const rangeKeys = Object.keys(preset.ranges).sort();
  const ranges = rangeKeys
    .map((k) => `${k}:${preset.ranges[k][0]}-${preset.ranges[k][1]}`)
    .join(",");
  return [
    preset.mode,
    `d${preset.durationSec}`,
    `q${preset.questionCap ?? 0}`,
    preset.penalty ? "p1" : "p0",
    preset.skipsFree ? "s1" : "s0",
    `o[${ops}]`,
    `k[${packs}]`,
    `r[${ranges}]`,
  ].join("|");
}
