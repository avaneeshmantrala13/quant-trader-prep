/**
 * mock/blueprint.ts — the MACHINE-READABLE 2026 interview blueprint.
 *
 * This closes the docs→runtime gap: the firm research in `datasets/*.md`
 * (`FIRM_INTERVIEW_LIVE_RESEARCH_2026.md`, `FIRM_MOCK_PRESETS.md`, …) is
 * transcribed here as TYPED data the generator + acceptance gate consume, rather
 * than prose no code ever reads. Each firm declares its rounds, the topic-
 * FAMILIES tested, the difficulty bands, the HARD ARCHETYPES that must appear,
 * and the FOLLOW-UP PATTERNS real interviewers use (the taxonomy in `types.ts`).
 *
 * Calibration: every valid OPENER must be at least as hard as the two GOLD
 * ANCHORS — the urn `P(both red | ≥ one red)` conditional-probability problem and
 * the lattice-path intersection problem. Nothing easier counts.
 *
 * A conformance test (`blueprint.test.ts`) asserts the three built presets
 * (Optiver / Jane Street / SIG) satisfy their blueprint: the pinned archetypes
 * appear, every declared follow-up pattern is a real `FollowupType`, and the
 * difficulty bands clear the anchor floor.
 *
 * PURE data: no React, DOM, storage, or network.
 */
import type {
  FollowupType,
  PoolDifficultyLike,
  PresetId,
  TopicFamily,
} from "./types";
import type { ArchetypeId } from "./questionPools";
import { FAMILY_DIFFICULTY, EASY_FAMILY_CAP } from "./interviewGate";

/* -------------------------------------------------------------------------- */
/*  Per-family difficulty class (re-exported single source of truth)          */
/* -------------------------------------------------------------------------- */

/**
 * Re-export of the canonical per-family DIFFICULTY classification (defined once
 * in `interviewGate.ts`). An `"easy"`/not-super-difficult family — sequences,
 * basic mental arithmetic, simple fraction/percent estimation — is a low-signal
 * warm-up and is HARD-CAPPED at {@link EASY_FAMILY_CAP} (one) per mock; every
 * genuinely-hard family may legitimately repeat. The blueprint surfaces this so
 * a firm's round `families` can be reasoned about by difficulty class without
 * duplicating the table. See {@link INTERVIEW_BLUEPRINT_2026}.
 */
export { FAMILY_DIFFICULTY, EASY_FAMILY_CAP };

/** The `"easy"` families in a blueprint round (each hard-capped at one/mock). */
export function easyFamiliesInRound(round: RoundBlueprint): TopicFamily[] {
  return round.families.filter((f) => FAMILY_DIFFICULTY[f] === "easy");
}

/* -------------------------------------------------------------------------- */
/*  Gold anchors — the difficulty floor for a valid opener                    */
/* -------------------------------------------------------------------------- */

export interface GoldAnchor {
  id: string;
  description: string;
  family: TopicFamily;
  /** No opener may be EASIER than this band. */
  minDifficulty: PoolDifficultyLike;
}

/**
 * The two problems the whole difficulty scale is pinned to. An item that a
 * candidate finds easier than these is not an interview-grade opener.
 */
export const GOLD_ANCHORS: GoldAnchor[] = [
  {
    id: "urn-conditional",
    description:
      "Urn of red/blue balls, draw two without replacement: P(both red | at " +
      "least one red). The canonical conditional-probability opener.",
    family: "conditional-prob",
    minDifficulty: "hard",
  },
  {
    id: "lattice-intersection",
    description:
      "Two monotone lattice walkers heading toward each other: probability they " +
      "meet in time (parity trap) / their paths intersect.",
    family: "random-walk",
    minDifficulty: "stretch",
  },
];

/* -------------------------------------------------------------------------- */
/*  Follow-up taxonomy — the LEGIT curveball moves                            */
/* -------------------------------------------------------------------------- */

export interface FollowupPatternSpec {
  type: FollowupType;
  description: string;
  example: string;
}

/**
 * The ONLY legitimate follow-up moves. A follow-up must be one of these AND be
 * at least as hard as the base — never a decomposition (asking for a sub-step
 * the candidate already computed). See `interviewGate.ts` for enforcement.
 */
export const FOLLOWUP_TAXONOMY: FollowupPatternSpec[] = [
  {
    type: "generalize-n",
    description:
      "Replace a concrete count with n / a third player / one more stage — force " +
      "the general argument, not a bigger arithmetic grind.",
    example:
      "Urn base asks P(both red | ≥1 red); follow-up asks three draws: P(all " +
      "three red | ≥ two red).",
  },
  {
    type: "invert",
    description:
      "Solve for an INPUT that produces a target output, or swap the quantity " +
      "asked (probability↔expectation, count↔threshold) — a fresh calculation.",
    example:
      "Bayes base gives P(disease | +); follow-up: what prevalence makes a " +
      "positive a 50/50?",
  },
  {
    type: "add-constraint",
    description:
      "Layer an extra condition / exclusion / unit-conversion the base did not " +
      "have, changing the counting or the chain.",
    example:
      "Committee base counts selections with A and B; follow-up excludes any " +
      "committee where A, B, C are all together.",
  },
  {
    type: "change-regime",
    description:
      "Flip a structural assumption: with→without replacement, fair→biased, " +
      "independent→dependent, add a cost. The framework must survive.",
    example:
      "Gambler's-ruin base uses a 0.6 coin; follow-up flips the edge against you " +
      "(0.4) so the ratio r > 1.",
  },
  {
    type: "adversarial-trap",
    description:
      "Challenge a CORRECT answer, or bait a plausible-but-wrong commitment, to " +
      "see whether the candidate flinches or defends the logic.",
    example:
      "Lattice base answer is 0 (parity); follow-up: forget timing — do the paths " +
      "intersect with probability greater or less than 1/2?",
  },
  {
    type: "act-on-it",
    description:
      "Now PRICE / BET / QUOTE on the result: turn the number into a two-way " +
      "market or a bankroll decision (the desk move).",
    example:
      "SIG confidence→bet-size: given your probability, how much of your bankroll " +
      "would you stake at these odds?",
  },
];

/* -------------------------------------------------------------------------- */
/*  Per-firm blueprint                                                        */
/* -------------------------------------------------------------------------- */

export type RoundKind =
  | "arithmetic-gate"
  | "reasoning"
  | "market-making"
  | "fit";

export type TimingRegime = "sprint" | "reasoning";

export interface RoundBlueprint {
  round: RoundKind;
  timingRegime: TimingRegime;
  /** Per-question time target range in SECONDS. */
  perQuestionSec: [number, number];
  /** Topic-families this round draws from. */
  families: TopicFamily[];
  /** Difficulty bands allowed in this round. */
  difficultyBands: PoolDifficultyLike[];
  /** Hard archetypes that SHOULD anchor this round (pinned in the preset). */
  hardArchetypes: ArchetypeId[];
}

export type FirmPriority = "top" | "second" | "third";
export type Confidence = "high" | "medium" | "low";

export interface FirmBlueprint {
  firm: string;
  /** The runtime preset this firm is wired to (absent ⇒ reference-only). */
  presetId?: PresetId;
  priority: FirmPriority;
  confidence: Confidence;
  /** One-line description of the OA / gate. */
  gate: string;
  rounds: RoundBlueprint[];
  /** The firm's signature adversarial move. */
  signatureAdversarial: string;
  /** The follow-up patterns this firm's interviewers actually use. */
  followupPatterns: FollowupType[];
  sources: string[];
}

/**
 * The 2026 blueprint. The first three entries are WIRED to runtime presets; the
 * rest are reference data for future generators (kept so the docs→runtime gap
 * cannot silently reopen — a new preset has its spec ready).
 */
export const INTERVIEW_BLUEPRINT_2026: Record<string, FirmBlueprint> = {
  optiver: {
    firm: "Optiver",
    presetId: "optiver",
    priority: "top",
    confidence: "high",
    gate:
      "2026: arithmetic sprint PHASED OUT of the main track — NumberLogic " +
      "progressive sequences (~25 min) + Beat-the-Odds rapid prob/EV, then " +
      "Zap-N games. (The 80-in-8 sprint lives separately in the Speed Arena.)",
    rounds: [
      {
        round: "reasoning",
        timingRegime: "reasoning",
        perQuestionSec: [45, 60],
        families: ["sequences"],
        difficultyBands: ["hard"],
        hardArchetypes: ["optiver-quadratic-demo"],
      },
      {
        round: "reasoning",
        timingRegime: "reasoning",
        perQuestionSec: [60, 120],
        families: [
          "conditional-prob",
          "geometric-race",
          "order-statistics",
          "optimal-stopping",
          "gamblers-ruin",
          "random-walk",
          "bayes",
          "combinatorics",
        ],
        difficultyBands: ["hard", "stretch"],
        hardArchetypes: ["lattice-paths"],
      },
      {
        round: "market-making",
        timingRegime: "reasoning",
        perQuestionSec: [120, 120],
        families: ["market-making"],
        difficultyBands: ["hard", "stretch"],
        hardArchetypes: [],
      },
    ],
    signatureAdversarial:
      "The clock + pickoff bot: each face-down-card reveal forces a re-quote; " +
      "traders push back on answers to see how you defend a position.",
    followupPatterns: ["generalize-n", "change-regime", "adversarial-trap", "act-on-it"],
    sources: [
      "datasets/FIRM_INTERVIEW_LIVE_RESEARCH_2026.md §2 (Optiver)",
      "techinterview.org/companies/optiver-interview-guide (2026)",
      "quantblueprint.com/guides/how-to-get-a-job-at-optiver (2026)",
    ],
  },

  janestreet: {
    firm: "Jane Street",
    presetId: "janestreet",
    priority: "top",
    confidence: "high",
    gate:
      "~60-question, ~7–8-minute Zetamac-style mental-math gate (2-digit ×, %, " +
      "fractions; no calculator). Screened SEPARATELY from the trader " +
      "conversation. ~70–80% correct to pass.",
    rounds: [
      {
        round: "arithmetic-gate",
        timingRegime: "sprint",
        perQuestionSec: [8, 8],
        families: ["mental-math"],
        difficultyBands: ["hard"],
        hardArchetypes: [],
      },
      {
        round: "reasoning",
        timingRegime: "reasoning",
        perQuestionSec: [120, 150],
        families: [
          "conditional-prob",
          "gamblers-ruin",
          "optimal-stopping",
          "waiting-time",
          "bayes",
          "combinatorics",
          "brainteaser",
        ],
        difficultyBands: ["hard", "stretch"],
        hardArchetypes: ["bank-or-roll"],
      },
      {
        round: "market-making",
        timingRegime: "reasoning",
        perQuestionSec: [150, 180],
        families: ["market-making"],
        difficultyBands: ["hard", "stretch"],
        hardArchetypes: [],
      },
    ],
    signatureAdversarial:
      "Mutate the game mid-problem: change a rule, introduce an adversary, " +
      "generalize-to-n, offer an elegant reframe as a hint; in MM, adverse " +
      "selection ('I keep lifting your ask — adjust').",
    followupPatterns: ["change-regime", "generalize-n", "adversarial-trap", "act-on-it"],
    sources: [
      "datasets/FIRM_INTERVIEW_LIVE_RESEARCH_2026.md §1 (Jane Street)",
      "janestreet.com/trading-interviews (firm-official)",
      "Jane Street 'bank-or-roll' mock interview video (firm-official primary)",
    ],
  },

  sig: {
    firm: "SIG (Susquehanna)",
    presetId: "sig",
    priority: "top",
    confidence: "high",
    gate:
      "Mercer|Mettl problem-solving OA, CALCULATOR allowed, freer navigation, " +
      "open-answer. Pressure is social/confidence, not the clock.",
    rounds: [
      {
        round: "arithmetic-gate",
        timingRegime: "sprint",
        perQuestionSec: [20, 20],
        families: ["mental-math"],
        difficultyBands: ["hard"],
        hardArchetypes: [],
      },
      {
        round: "reasoning",
        timingRegime: "reasoning",
        perQuestionSec: [180, 240],
        families: [
          "bet-sizing",
          "conditional-prob",
          "bayes",
          "geometric-race",
          "combinatorics",
          "brainteaser",
        ],
        difficultyBands: ["hard", "stretch"],
        hardArchetypes: ["sig-confidence-bet"],
      },
      {
        round: "market-making",
        timingRegime: "reasoning",
        perQuestionSec: [150, 180],
        families: ["market-making"],
        difficultyBands: ["hard", "stretch"],
        hardArchetypes: [],
      },
    ],
    signatureAdversarial:
      "'How confident are you — 60%? 90%? How much of your bankroll would you " +
      "bet?' then offer a bet at exploitative odds to expose miscalibration; " +
      "twist the payout rule after each answer.",
    followupPatterns: ["act-on-it", "change-regime", "invert", "adversarial-trap"],
    sources: [
      "datasets/FIRM_INTERVIEW_LIVE_RESEARCH_2026.md §3 (SIG)",
      "sig.com/who-we-are/game-theory-decision-science (firm-official)",
      "techinterview.org/companies/sig-susquehanna-interview-guide (2026)",
    ],
  },

  /* ------------------------------ reference-only ------------------------------ */

  citadel: {
    firm: "Citadel Securities",
    priority: "top",
    confidence: "high",
    gate: "OA: probability + game theory (+ coding). Superday market-making + 'bet on the next draw'.",
    rounds: [
      {
        round: "reasoning",
        timingRegime: "reasoning",
        perQuestionSec: [120, 240],
        families: ["bayes", "conditional-prob", "combinatorics"],
        difficultyBands: ["hard", "stretch"],
        hardArchetypes: ["citadel-bet"],
      },
      {
        round: "market-making",
        timingRegime: "reasoning",
        perQuestionSec: [150, 240],
        families: ["market-making"],
        difficultyBands: ["hard", "stretch"],
        hardArchetypes: [],
      },
    ],
    signatureAdversarial: "Adverse selection + 'now bet on your own answer' (hidden-composition Bayes).",
    followupPatterns: ["act-on-it", "invert", "adversarial-trap"],
    sources: ["datasets/FIRM_INTERVIEW_LIVE_RESEARCH_2026.md (Citadel Securities)"],
  },

  imc: {
    firm: "IMC",
    priority: "top",
    confidence: "medium",
    gate: "Mental-math + sequences + probability OA; group/1:1 trading game (dice sum, marble urn).",
    rounds: [
      {
        round: "reasoning",
        timingRegime: "reasoning",
        perQuestionSec: [90, 180],
        families: ["order-statistics", "conditional-prob", "monty"],
        difficultyBands: ["hard", "stretch"],
        hardArchetypes: ["monty-hold-firm"],
      },
      {
        round: "market-making",
        timingRegime: "reasoning",
        perQuestionSec: [120, 180],
        families: ["market-making"],
        difficultyBands: ["hard"],
        hardArchetypes: [],
      },
    ],
    signatureAdversarial: "Trades against you repeatedly; challenges CORRECT answers to see if you flinch.",
    followupPatterns: ["adversarial-trap", "generalize-n", "act-on-it"],
    sources: ["datasets/FIRM_INTERVIEW_LIVE_RESEARCH_2026.md (IMC)"],
  },

  drw: {
    firm: "DRW",
    priority: "top",
    confidence: "high",
    gate: "6Q / 45min deep math (one ~unsolvable); 1:1 market-making mock.",
    rounds: [
      {
        round: "reasoning",
        timingRegime: "reasoning",
        perQuestionSec: [240, 450],
        families: ["random-walk", "gamblers-ruin", "combinatorics", "bayes"],
        difficultyBands: ["stretch"],
        hardArchetypes: ["lattice-paths"],
      },
      {
        // The DRW signature (per 2026 research): a brainteaser/hard-result round
        // that PIVOTS into "now make a market on it" — defend the number by
        // quoting a two-way market the interviewer trades against.
        round: "market-making",
        timingRegime: "reasoning",
        perQuestionSec: [180, 300],
        families: ["market-making"],
        difficultyBands: ["hard", "stretch"],
        hardArchetypes: [],
      },
    ],
    signatureAdversarial:
      "Leave-it-blank triage; defend a hard result, then PIVOT it into 'now make " +
      "a market on your answer' and trade against your quote.",
    followupPatterns: ["generalize-n", "change-regime", "adversarial-trap", "act-on-it"],
    sources: ["datasets/FIRM_INTERVIEW_LIVE_RESEARCH_2026.md (DRW)"],
  },

  fiveRings: {
    firm: "Five Rings",
    priority: "second",
    confidence: "medium",
    gate: "15–20Q / <20min typed numeric; rapid-fire prob/estimation.",
    rounds: [
      {
        round: "reasoning",
        timingRegime: "reasoning",
        perQuestionSec: [30, 90],
        families: ["conditional-prob", "combinatorics", "estimation"],
        difficultyBands: ["hard", "stretch"],
        hardArchetypes: [],
      },
    ],
    signatureAdversarial: "Speed as the adversary; JS-like reasoning probes.",
    followupPatterns: ["generalize-n", "invert"],
    sources: ["datasets/FIRM_INTERVIEW_LIVE_RESEARCH_2026.md (Five Rings)"],
  },

  hrt: {
    firm: "HRT",
    priority: "third",
    confidence: "medium",
    gate: "CodeSignal + math stage (trader): green-book prob/EV, geometric probability, code-validate.",
    rounds: [
      {
        round: "reasoning",
        timingRegime: "reasoning",
        perQuestionSec: [120, 300],
        families: ["order-statistics", "geometric-race", "combinatorics"],
        difficultyBands: ["hard", "stretch"],
        hardArchetypes: [],
      },
    ],
    signatureAdversarial: "Derive AND simulate; less market-making-central.",
    followupPatterns: ["generalize-n", "invert", "add-constraint"],
    sources: ["datasets/FIRM_INTERVIEW_LIVE_RESEARCH_2026.md (HRT)"],
  },

  jump: {
    firm: "Jump Trading",
    priority: "second",
    confidence: "medium",
    gate: "Rapid mental-math + prob OA; trader round on futures/market intuition.",
    rounds: [
      {
        round: "arithmetic-gate",
        timingRegime: "sprint",
        perQuestionSec: [6, 10],
        families: ["mental-math"],
        difficultyBands: ["hard"],
        hardArchetypes: [],
      },
      {
        round: "reasoning",
        timingRegime: "reasoning",
        perQuestionSec: [90, 180],
        families: ["conditional-prob", "optimal-stopping"],
        difficultyBands: ["hard", "stretch"],
        hardArchetypes: [],
      },
    ],
    signatureAdversarial: "Speed + market-event reasoning ('why Jump').",
    followupPatterns: ["change-regime", "generalize-n"],
    sources: ["datasets/FIRM_INTERVIEW_LIVE_RESEARCH_2026.md (Jump)"],
  },

  akuna: {
    firm: "Akuna Capital",
    priority: "second",
    confidence: "medium",
    gate: "80-in-8 + 24 sequences/12min + VidCruiter betting game; PnL-ranked group trading game.",
    rounds: [
      {
        round: "arithmetic-gate",
        timingRegime: "sprint",
        perQuestionSec: [6, 8],
        families: ["mental-math", "sequences"],
        difficultyBands: ["hard"],
        hardArchetypes: [],
      },
      {
        round: "market-making",
        timingRegime: "reasoning",
        perQuestionSec: [120, 180],
        families: ["market-making", "bet-sizing"],
        difficultyBands: ["hard", "stretch"],
        hardArchetypes: ["sig-confidence-bet"],
      },
    ],
    signatureAdversarial: "Group market; inventory punishment; confidence→stake.",
    followupPatterns: ["act-on-it", "generalize-n", "adversarial-trap"],
    sources: ["datasets/FIRM_INTERVIEW_LIVE_RESEARCH_2026.md (Akuna)"],
  },
};

/** The blueprint for a wired preset id (Optiver / Jane Street / SIG). */
export function blueprintForPreset(presetId: PresetId): FirmBlueprint | undefined {
  return Object.values(INTERVIEW_BLUEPRINT_2026).find(
    (b) => b.presetId === presetId,
  );
}

/** All hard archetypes the blueprint says must appear across a firm's rounds. */
export function requiredArchetypes(bp: FirmBlueprint): ArchetypeId[] {
  return bp.rounds.flatMap((r) => r.hardArchetypes);
}
