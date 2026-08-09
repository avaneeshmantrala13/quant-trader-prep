/**
 * mock/interviewGate.ts — the INTERVIEW-GRADE structural acceptance gate.
 *
 * This is the deterministic, CI-runnable half of the anti-regression fix. It
 * encodes — as executable checks — every quality rule a real quant screen obeys,
 * so a weak mock can never ship again:
 *
 *   1. NO DECOMPOSITION FOLLOW-UPS — a follow-up may never ask for a sub-step the
 *      candidate already computed in the base (the numerator, a sub-count, a
 *      threshold). Enforced numerically (`answer ∈ base intermediates`) AND by a
 *      phrasing blocklist ("first nail the piece", "the numerator", …).
 *   2. FOLLOW-UP DIFFICULTY FLOOR — every follow-up is at least as hard as its
 *      base (ideally harder). No follow-up easier than the opener.
 *   3. TAXONOMY-TYPED FOLLOW-UPS — every follow-up declares a legit `FollowupType`
 *      (generalize-n / invert / add-constraint / change-regime / adversarial-trap
 *      / act-on-it) so it introduces genuinely new reasoning.
 *   4. DIVERSITY — no two ADJACENT scored items share a topic-family (market-
 *      making rounds are an intentional escalating finale and are exempt), a cap
 *      on items per family, and coverage of ≥ N distinct families.
 *   5. DIFFICULTY FLOOR on the whole set — every scored item is `hard`+.
 *
 * PURE: no React, DOM, storage, or network. Operates on a built `MockScript` (so
 * the vitest suite can assemble each firm preset and assert it passes) and also
 * exposes per-follow-up predicates the generator-level tests use directly.
 */
import type {
  FollowupPresentation,
  FollowupType,
  MathStep,
  MockScript,
  MockStep,
  PoolDifficultyLike,
  TopicFamily,
} from "./types";

/* -------------------------------------------------------------------------- */
/*  Difficulty ranking                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Total order over difficulty bands. `stretch` (the preset "hardest" label) and
 * `expert` (the generator label) both sit at the top so a `stretch` follow-up is
 * never wrongly flagged as easier than an `expert` base.
 */
export function difficultyRank(d: PoolDifficultyLike | string | undefined): number {
  switch (d) {
    case "easy":
      return 0;
    case "medium":
      return 1;
    case "hard":
      return 2;
    case "stretch":
    case "expert":
      return 3;
    default:
      return 1; // unknown → treat as medium (never the top)
  }
}

/** The lowest difficulty a firm-mock scored item may carry (hard or above). */
export const MIN_ITEM_DIFFICULTY_RANK = difficultyRank("hard");

/* -------------------------------------------------------------------------- */
/*  Follow-up taxonomy + decomposition detection                              */
/* -------------------------------------------------------------------------- */

export const FOLLOWUP_TYPES: ReadonlySet<FollowupType> = new Set<FollowupType>([
  "generalize-n",
  "invert",
  "add-constraint",
  "change-regime",
  "adversarial-trap",
  "act-on-it",
]);

/**
 * Phrasings that BETRAY a decomposition follow-up — asking for a sub-step the
 * candidate already produced. These are the exact tells of the old trivial
 * probes ("First nail the piece that drives it…", "the numerator", "isolate one
 * branch", "the denominator of your Bayes update"). A regression to any of them
 * fails the gate even if the numeric check somehow slipped.
 */
export const DECOMPOSITION_PHRASES: RegExp[] = [
  /\bfirst nail\b/i,
  /piece that drives/i,
  /\bthe numerator\b/i,
  /\bthe denominator\b/i,
  /\bisolate\b/i,
  /sub-estimate/i,
  /before conditioning/i,
  /\bno conditioning\b/i,
  /break it into cases/i,
  /one branch of/i,
  /the marginal that/i,
];

/**
 * STRICT reuse-equality for decomposition detection. A decomposition RE-ASKS a
 * value the base already COMPUTED, so the two are the identical quantity — equal
 * to the 4-decimal precision every generator rounds to. We therefore compare the
 * values QUANTIZED to 4 decimals rather than with a loose grader tolerance: this
 * catches true reuse (identical rounded value) while never mistaking two
 * genuinely-different quantities that merely land close (e.g. a Bayes posterior
 * 0.0917 vs an inverted-prevalence 0.0909) for a decomposition.
 */
function reuseEqual(a: number, b: number): boolean {
  return Math.round(a * 1e4) === Math.round(b * 1e4);
}

/** The base a follow-up is judged against: its answer + already-computed values. */
export interface FollowupBase {
  answer: number;
  /** Difficulty band of the base item. */
  difficulty?: PoolDifficultyLike | string;
  /** Values already computed while solving the base (numerator, sub-counts, …). */
  baseIntermediates?: number[];
}

/** A follow-up as the gate inspects it (subset of `FollowupPresentation`/seed). */
export interface FollowupLike {
  prompt: string;
  answerKind?: "numeric" | "reasoning";
  answer?: number;
  type?: FollowupType;
  difficulty?: PoolDifficultyLike | string;
}

/**
 * Why a follow-up is a DECOMPOSITION of its base, or `null` if it is not. A
 * numeric follow-up whose answer equals the base answer OR any already-computed
 * intermediate is a decomposition; so is any follow-up whose prompt uses a
 * decomposition phrasing.
 */
export function decompositionReason(
  base: FollowupBase,
  fu: FollowupLike,
): string | null {
  for (const re of DECOMPOSITION_PHRASES) {
    if (re.test(fu.prompt)) return `decomposition phrasing ${re}`;
  }
  if (fu.answerKind !== "reasoning" && typeof fu.answer === "number") {
    if (reuseEqual(fu.answer, base.answer)) {
      return `answer equals the base answer (${base.answer})`;
    }
    for (const v of base.baseIntermediates ?? []) {
      if (reuseEqual(fu.answer, v)) {
        return `answer equals a base intermediate (${v}) — a sub-step already computed`;
      }
    }
  }
  return null;
}

/** Why a follow-up is BELOW its base's difficulty floor, or `null`. */
export function belowFloorReason(
  base: FollowupBase,
  fu: FollowupLike,
): string | null {
  if (fu.difficulty === undefined) return null; // defaults to base ⇒ never easier
  const baseRank = difficultyRank(base.difficulty);
  const fuRank = difficultyRank(fu.difficulty);
  return fuRank < baseRank
    ? `follow-up difficulty ${fu.difficulty} (rank ${fuRank}) is below base ${base.difficulty} (rank ${baseRank})`
    : null;
}

/** Why a follow-up lacks a valid taxonomy type, or `null`. */
export function missingTypeReason(fu: FollowupLike): string | null {
  if (!fu.type) return "missing follow-up taxonomy `type`";
  if (!FOLLOWUP_TYPES.has(fu.type)) return `unknown follow-up type "${fu.type}"`;
  return null;
}

/** All gate violations for a single follow-up (empty ⇒ interview-grade). */
export function auditFollowup(base: FollowupBase, fu: FollowupLike): string[] {
  const out: string[] = [];
  const decomp = decompositionReason(base, fu);
  if (decomp) out.push(decomp);
  const floor = belowFloorReason(base, fu);
  if (floor) out.push(floor);
  const type = missingTypeReason(fu);
  if (type) out.push(type);
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Topic-family diversity constants                                          */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Per-family DIFFICULTY classification + the easy-family hard cap            */
/* -------------------------------------------------------------------------- */

/**
 * DIFFICULTY CLASS of every topic family. An `"easy"` (i.e. "not super
 * difficult") family — sequences, basic mental arithmetic, simple
 * fraction/percent estimation — is a low-signal warm-up that a real screen would
 * never repeat: seeing two of them in one mock (e.g. the reported Optiver mock
 * with 2 sequence problems) means an easy topic is crowding out a harder one.
 * Every genuinely-hard family (conditional probability, Bayes, gambler's ruin,
 * combinatorics, market-making, …) is `"hard"` and may legitimately appear more
 * than once. This drives {@link familyCap} and the structural easy-cap rule in
 * {@link auditScript}, and is consumed by the assembler (`engine.ts`) + presets.
 */
export const FAMILY_DIFFICULTY: Record<TopicFamily, "easy" | "hard"> = {
  // Easy / "not super difficult" — HARD-CAPPED to ONE per mock.
  "mental-math": "easy",
  sequences: "easy",
  estimation: "easy",
  // Hard families — may exceed one (subject to the per-family cap below).
  "market-making": "hard",
  brainteaser: "hard",
  "independent-events": "hard",
  "conditional-prob": "hard",
  "geometric-race": "hard",
  "optimal-stopping": "hard",
  "order-statistics": "hard",
  bayes: "hard",
  "random-walk": "hard",
  "gamblers-ruin": "hard",
  "waiting-time": "hard",
  combinatorics: "hard",
  monty: "hard",
  "coupon-collector": "hard",
  birthday: "hard",
  derangements: "hard",
  "bet-sizing": "hard",
};

/** Whether a family is classified "easy" (⇒ hard-capped at one per mock). */
export function isEasyFamily(family: TopicFamily): boolean {
  return FAMILY_DIFFICULTY[family] === "easy";
}

/** The HARD CAP on how many items of an EASY family a mock may contain. */
export const EASY_FAMILY_CAP = 1;

/**
 * Per-family CAP on how many scored items of one family a mock may contain.
 * EASY families are hard-capped at {@link EASY_FAMILY_CAP} (one). Among HARD
 * families the escalating market-making finale and brainteasers may repeat a few
 * times; every fine-grained probability/EV family is capped at 2 so no sub-topic
 * dominates.
 */
export const DEFAULT_FAMILY_CAP = 2;
export const FAMILY_CAP_BY_FAMILY: Partial<Record<TopicFamily, number>> = {
  "market-making": 3, // the escalating MM finale
  brainteaser: 3,
};

export function familyCap(family: TopicFamily): number {
  if (isEasyFamily(family)) return EASY_FAMILY_CAP;
  return FAMILY_CAP_BY_FAMILY[family] ?? DEFAULT_FAMILY_CAP;
}

/** Minimum number of DISTINCT topic-families a firm mock must cover. */
export const MIN_DISTINCT_FAMILIES = 5;

/**
 * Families whose adjacent repetition is ALLOWED (an intentional escalating block
 * rather than lazy repetition). Market-making rounds are a designed multi-round
 * finale where the interviewer reveals information between quotes.
 */
const ADJACENCY_EXEMPT: ReadonlySet<TopicFamily> = new Set<TopicFamily>([
  "market-making",
]);

/* -------------------------------------------------------------------------- */
/*  Script-level audit                                                        */
/* -------------------------------------------------------------------------- */

/** The family of any step (math/brainteaser/market-making), or null. */
export function familyOfStep(step: MockStep): TopicFamily | null {
  switch (step.kind) {
    case "math":
      return step.family ?? (step.qtype === "mental-math" ? "mental-math" : null);
    case "brainteaser":
      return "brainteaser";
    case "marketMaking":
      return "market-making";
    default:
      return null; // behavioral — unscored, ignored for diversity
  }
}

export interface GateReport {
  ok: boolean;
  violations: string[];
  /** Distinct scored families covered. */
  families: TopicFamily[];
  /** Per-family counts. */
  familyCounts: Record<string, number>;
  /** Number of scored items audited. */
  scoredItems: number;
}

/** Audit a single assembled math step's two authored follow-ups. */
export function auditMathStepFollowups(step: MathStep): string[] {
  const base: FollowupBase = {
    answer: step.answer,
    // Judge follow-ups against the GENERATOR's intrinsic difficulty (what they
    // were authored against), not the preset slot's pacing label — a `hard`
    // item in a longer `stretch` slot still has a `hard` base.
    difficulty: step.baseDifficulty ?? step.difficulty,
    baseIntermediates: step.baseIntermediates,
  };
  const out: string[] = [];
  const check = (fu: FollowupPresentation | undefined, label: string) => {
    if (!fu) return;
    for (const v of auditFollowup(base, {
      prompt: fu.prompt,
      answerKind: fu.answerKind,
      answer: fu.answer,
      type: fu.type,
      difficulty: fu.difficulty,
    })) {
      out.push(`${step.id} ${label}: ${v}`);
    }
  };
  check(step.authoredProbe, "probe");
  check(step.authoredAdversarial, "adversarial");
  return out;
}

/**
 * Full structural audit of an assembled interview script. Returns every
 * violation (empty ⇒ interview-grade) plus the family coverage. This is exactly
 * what the per-preset vitest asserts is clean.
 */
export function auditScript(script: MockScript): GateReport {
  const violations: string[] = [];
  const scoredSteps = script.steps.filter(
    (s): s is MockStep => familyOfStep(s) !== null,
  );

  // 1) Diversity: no two ADJACENT scored items share a family (MM exempt).
  let prevFamily: TopicFamily | null = null;
  const familyCounts: Record<string, number> = {};
  for (const step of scoredSteps) {
    const fam = familyOfStep(step);
    if (!fam) continue;
    familyCounts[fam] = (familyCounts[fam] ?? 0) + 1;
    if (
      prevFamily === fam &&
      !ADJACENCY_EXEMPT.has(fam)
    ) {
      violations.push(`back-to-back same family "${fam}" at step ${step.id}`);
    }
    prevFamily = fam;
  }

  // 2) Per-family cap — with the EASY-family HARD CAP of one broken out as its
  //    own structural rule (an "easy"/not-super-difficult family may appear at
  //    most once per mock; harder families may exceed one).
  for (const [fam, count] of Object.entries(familyCounts)) {
    const family = fam as TopicFamily;
    if (isEasyFamily(family)) {
      if (count > EASY_FAMILY_CAP) {
        violations.push(
          `easy family "${fam}" appears ${count}× (hard cap ${EASY_FAMILY_CAP}/mock — ` +
            `an easy/not-super-difficult topic may appear at most once)`,
        );
      }
      continue;
    }
    const cap = familyCap(family);
    if (count > cap) {
      violations.push(`family "${fam}" appears ${count}× (cap ${cap})`);
    }
  }

  // 3) Coverage: at least N distinct families.
  const families = Object.keys(familyCounts) as TopicFamily[];
  if (families.length < MIN_DISTINCT_FAMILIES) {
    violations.push(
      `only ${families.length} distinct families (need ≥ ${MIN_DISTINCT_FAMILIES}): ${families.join(", ")}`,
    );
  }

  // 4) Difficulty floor on every SCORED numeric/brainteaser item + 5) follow-ups.
  for (const step of scoredSteps) {
    if (step.kind === "math") {
      if (difficultyRank(step.difficulty) < MIN_ITEM_DIFFICULTY_RANK) {
        violations.push(
          `${step.id}: difficulty "${step.difficulty}" is below the hard floor`,
        );
      }
      if (step.qtype !== "mental-math") {
        violations.push(...auditMathStepFollowups(step));
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    families,
    familyCounts,
    scoredItems: scoredSteps.length,
  };
}
