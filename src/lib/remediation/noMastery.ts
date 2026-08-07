import type { TopicVerdict } from "@/lib/mastery/verdict";
import { UNLOCK_MEAN_BAR } from "@/lib/mastery/unlock";

/**
 * NO-MASTERY FALLBACK GUIDANCE (ZPD, escalating).
 *
 * When a learner shows essentially NO mastery ANYWHERE and keeps failing, the
 * prerequisite-descent machinery has nothing solid to descend TO — every
 * foundation is weak. Rather than loop them through more questions they can't
 * yet do, this surfaces escalating, encouraging guidance that steps OUTSIDE the
 * question grind:
 *
 *   Stage 1 — try MENTAL PROBABILITY first (the Mental Math floor): build raw
 *             arithmetic/probability fluency before layered problems.
 *   Stage 2 — explore the SIMULATIONS to build probability INTUITION (see the
 *             law of large numbers, conditioning, and randomness play out) before
 *             more questions, then come back.
 *   Stage 3 — if it still isn't clicking, learn the content from a TEXTBOOK, and
 *             review high-school math (basic calculus & statistics) — the app
 *             assesses and reinforces, but can't teach a missing foundation from
 *             scratch.
 *
 * The stage escalates with accumulated no-mastery evidence (the learner "keeps
 * failing"), so a first stumble gets the gentlest nudge and persistent struggle
 * gets the most substantive advice. Pure + deterministic; surfaces on the
 * lesson-finish screen and/or the dashboard. It NEVER gates content or mutates
 * mastery.
 *
 * Research: Vygotsky ZPD (when the unaided floor is below the material, drop to
 * an easier representation — here, mental fluency then simulations then external
 * instruction); Bloom 1984 (secure the prerequisite before layered practice).
 */

/** Graded-item counts (across topics) at which the guidance escalates. */
export const NO_MASTERY_STAGE2_ITEMS = 12;
export const NO_MASTERY_STAGE3_ITEMS = 30;

/** Stable in-app routes the guidance links to (see `src/App.tsx`). */
export const MENTAL_MATH_HREF = "/track/mental-math";
export const SIMULATIONS_HREF = "/simulations";

/** 0 = not triggered; 1 → 2 → 3 escalate with persistence. */
export type NoMasteryStage = 0 | 1 | 2 | 3;

export interface NoMasteryAction {
  label: string;
  /** In-app route, or undefined for advice with no destination (textbook). */
  href?: string;
}

export interface NoMasteryGuidance {
  triggered: boolean;
  stage: NoMasteryStage;
  headline: string;
  body: string;
  actions: NoMasteryAction[];
}

export interface NoMasteryInput {
  /** Per-topic verdicts (any topics; only evidenced ones count toward escalation). */
  verdicts: TopicVerdict[];
  /**
   * True when this is being surfaced right after a FAILED finish. A fresh
   * no-mastery learner who just failed gets stage-1 guidance even before much
   * evidence has accrued; absent, the guidance only fires once some graded
   * evidence exists (so the dashboard doesn't nag a brand-new user).
   */
  justFailed?: boolean;
}

const NOT_TRIGGERED: NoMasteryGuidance = {
  triggered: false,
  stage: 0,
  headline: "",
  body: "",
  actions: [],
};

/**
 * Decide whether — and how strongly — to show the no-mastery fallback guidance.
 * "Essentially no mastery anywhere" means NO topic is confidently mastered AND
 * the best-evidenced topic's posterior mean is still below the unlock bar
 * ({@link UNLOCK_MEAN_BAR}). Pure; deterministic given the same verdicts.
 */
export function assessNoMasteryGuidance(
  input: NoMasteryInput,
): NoMasteryGuidance {
  const { verdicts, justFailed } = input;
  const evidenced = verdicts.filter((v) => v.n > 0);
  const anyMastered = verdicts.some((v) => v.mastered);
  const bestMean = evidenced.reduce((mx, v) => Math.max(mx, v.mean), 0);
  const totalGraded = evidenced.reduce((sum, v) => sum + v.n, 0);

  // Essentially no mastery: nothing confidently mastered and even the strongest
  // evidenced topic sits below the (lenient) unlock bar.
  const noMastery = !anyMastered && bestMean < UNLOCK_MEAN_BAR;
  const triggered = noMastery && (justFailed === true || totalGraded > 0);
  if (!triggered) return NOT_TRIGGERED;

  const stage: NoMasteryStage =
    totalGraded >= NO_MASTERY_STAGE3_ITEMS
      ? 3
      : totalGraded >= NO_MASTERY_STAGE2_ITEMS
        ? 2
        : 1;

  return buildGuidance(stage);
}

function buildGuidance(stage: NoMasteryStage): NoMasteryGuidance {
  if (stage === 1) {
    return {
      triggered: true,
      stage: 1,
      headline: "Let's build the floor first",
      body: "These problems layer several ideas at once. Before more of them, spend a few minutes on Mental Probability — the fast arithmetic and single-step odds the rest of the app builds on. It's the quickest way to make the harder questions start clicking.",
      actions: [{ label: "Warm up with Mental Probability", href: MENTAL_MATH_HREF }],
    };
  }
  if (stage === 2) {
    return {
      triggered: true,
      stage: 2,
      headline: "Build the intuition, then come back",
      body: "Still rough — that's normal. Rather than grind more questions, explore the Simulations: watch probabilities, conditioning, and the law of large numbers play out visually to build intuition for how randomness actually behaves. Then come back and try again.",
      actions: [
        { label: "Explore the Simulations", href: SIMULATIONS_HREF },
        { label: "More Mental Probability reps", href: MENTAL_MATH_HREF },
      ],
    };
  }
  return {
    triggered: true,
    stage: 3,
    headline: "Learn the content, then reinforce here",
    body: "You've put in real reps and it still isn't clicking — that usually means the underlying content needs to be LEARNED first, not just practiced. Work through a probability/statistics textbook (or an intro course), and brush up on high-school math — basic calculus and statistics. This app is built to assess and reinforce a foundation; once you've studied the material, come back and it'll help you lock it in.",
    actions: [
      { label: "Revisit the Simulations for intuition", href: SIMULATIONS_HREF },
      { label: "Back to Mental Probability basics", href: MENTAL_MATH_HREF },
    ],
  };
}
