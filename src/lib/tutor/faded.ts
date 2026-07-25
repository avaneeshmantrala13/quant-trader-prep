/**
 * Faded / completion-problem construction (PHASE_2 §5).
 *
 * Research anchors: Renkl & Atkinson 2003 and Renkl, Atkinson & Maier 2002 —
 * FADING is the transition from studying a worked example to solving
 * independently: blank out steps progressively (full → last step → last two →
 * bare), turning each blank into a self-explanation prompt. Crucially, FADE THE
 * MISCONCEPTION-CRITICAL STEP FIRST (the step carrying the topic's core trap) so
 * the learner practises exactly the move they most often get wrong.
 *
 * Pure + deterministic: derives steps from an item's worked `explanation` and
 * computes the fade ORDER and progressive STAGES with no randomness.
 */

export interface WorkedStep {
  text: string;
  /** True for the step that carries the topic's core misconception/trap. */
  isMisconceptionCritical: boolean;
}

/** One faded stage: each step is shown or blanked (a self-explanation prompt). */
export interface FadedStage {
  steps: { text: string; blanked: boolean }[];
}

/** Cue phrases that flag the misconception-critical step in a worked solution. */
const TRAP_CUES = [
  "trap",
  "not ",
  "instead",
  "reversed",
  "neglect",
  "forgot",
  "forget",
  "wrong",
  "classic",
  "tempting",
  "naive",
  "mistake",
  "careful",
  "beware",
];

/**
 * Split a worked `explanation` into ordered steps (sentence-ish units) and mark
 * the misconception-critical one. If `criticalIndex` is supplied it wins;
 * otherwise the first step matching a trap cue is used, else the LAST step
 * (the step that lands the answer is the most consequential to practise).
 */
export function deriveWorkedSteps(
  explanation: string,
  criticalIndex?: number,
): WorkedStep[] {
  const parts = explanation
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) return [];

  let critical = criticalIndex;
  if (critical == null) {
    const cueIdx = parts.findIndex((p) => {
      const low = p.toLowerCase();
      return TRAP_CUES.some((c) => low.includes(c));
    });
    critical = cueIdx >= 0 ? cueIdx : parts.length - 1;
  }
  const clamped = Math.max(0, Math.min(critical, parts.length - 1));
  return parts.map((text, i) => ({
    text,
    isMisconceptionCritical: i === clamped,
  }));
}

/**
 * The ORDER in which steps get blanked as the learner fades into independence:
 * the misconception-critical step FIRST (Renkl), then the remaining steps from
 * the LAST backward (full → last → last two → bare, minus the already-faded
 * critical step). Returns step indices, length === steps.length.
 */
export function selectFadeOrder(steps: WorkedStep[]): number[] {
  if (steps.length === 0) return [];
  const critical = steps.findIndex((s) => s.isMisconceptionCritical);
  const criticalIdx = critical >= 0 ? critical : steps.length - 1;
  const order: number[] = [criticalIdx];
  for (let i = steps.length - 1; i >= 0; i--) {
    if (i !== criticalIdx) order.push(i);
  }
  return order;
}

/**
 * Progressive fade stages from FULL (nothing blanked) to BARE (all blanked).
 * Stage `k` blanks the first `k` indices of {@link selectFadeOrder}. There are
 * `steps.length + 1` stages (stage 0 = full worked example).
 */
export function buildFadedStages(steps: WorkedStep[]): FadedStage[] {
  const order = selectFadeOrder(steps);
  const stages: FadedStage[] = [];
  for (let k = 0; k <= steps.length; k++) {
    const blanked = new Set(order.slice(0, k));
    stages.push({
      steps: steps.map((s, i) => ({ text: s.text, blanked: blanked.has(i) })),
    });
  }
  return stages;
}
