/**
 * mock/presets.ts — the THREE firm-style mock-interview presets, transcribed
 * from `datasets/FIRM_MOCK_PRESETS.md` (Optiver / Jane Street / SIG).
 *
 * Each preset is a fully-ordered question mix with per-question time targets,
 * difficulty tiers, and a pacing regime, plus the documented scoring nuance and
 * adversary signature. These are "style" presets — clearly NOT the firms' actual
 * question keys — and require ZERO options/derivatives finance knowledge.
 *
 * PURE data: no React, DOM, storage, or network.
 */
import type { MathTier, MockRegime, PresetId } from "./types";
import type { ArchetypeId, PoolDifficulty } from "./questionPools";

/** The kind of a preset item (superset of the scored numeric `MockQuestionType`). */
export type PresetItemKind =
  | "mental-math"
  | "probability-ev"
  | "sequences"
  | "estimation"
  | "brainteaser"
  | "market-making";

export interface PresetItem {
  kind: PresetItemKind;
  difficulty: PoolDifficulty;
  /** Per-question time target in SECONDS (per the spec). */
  targetSec: number;
  regime: MockRegime;
  /** Short note from the spec (shown as flavour on the card). */
  note?: string;
  /**
   * PIN a firm-signature archetype for this slot. When set, this exact flagship
   * problem + its concept-specific follow-ups are drawn instead of a random draw
   * from the difficulty pool — e.g. Jane Street's bank-or-roll cascade, SIG's
   * confidence→bet-size item, or Optiver's pinned quadratic-sequence demo. The
   * archetype's own `kind` must match this slot's `kind` (a `sequences`
   * archetype on a `sequences` slot, a `probability-ev` archetype on a
   * `probability-ev` slot).
   */
  archetype?: ArchetypeId;
}

export interface MockPreset {
  id: PresetId;
  name: string;
  tagline: string;
  /** Desk tier the candidate is measured against (drives `tierLabel`). */
  tier: MathTier;
  scoringNote: string;
  adversary: string;
  calculatorAllowed?: boolean;
  intro: string;
  items: PresetItem[];
  /** Behavioral prompts appended at the END as unscored flashcards. */
  behavioralCount: number;
}

/* -------------------------------------------------------------------------- */
/*  PRESET 1 — Optiver Style — Sequences & Odds (12 Q)                          */
/* -------------------------------------------------------------------------- */

/**
 * Optiver's 2026 assessment PHASED OUT the old rapid-arithmetic gate (per a
 * firsthand 2026 candidate). The OA is now: NumberLogic (26 progressive
 * number-SEQUENCE patterns, ~25 min) → Beat the Odds (~20 FAST probability /
 * expected-value questions) → Zap-N cognitive games. So this preset has NO
 * arithmetic sprint: it LEADS with escalating sequences and rapid prob/EV, then
 * market-making. (The standalone timed arithmetic screen still lives separately
 * in the Speed Arena.)
 */
const OPTIVER: MockPreset = {
  id: "optiver",
  name: "Optiver Style — Sequences & Odds",
  tagline: "Progressive number-pattern sequences + rapid probability under a relentless clock.",
  tier: "hard",
  scoringNote:
    "Optiver's 2026 OA is progressive number-sequence patterns (NumberLogic) and rapid probability / expected-value (Beat the Odds) — not an arithmetic sprint. So this mock LEADS with escalating sequences and fast prob/EV under time (no back-navigation), then market-making. Speed is graded but a correct answer is always correct.",
  adversary: "Pickoff bot + relentless clock.",
  intro:
    "Optiver style. Optiver's 2026 assessment is progressive number-sequence " +
    "patterns and rapid probability/EV — not the old arithmetic sprint — so we open " +
    "with sequences that escalate, then fast probability and expected-value " +
    "questions under time (each right answer earns a concept follow-up that presses " +
    "whether you actually understand it), an estimate, and two market-making rounds " +
    "where I pick off any quote that's off.",
  items: [
    { kind: "sequences", difficulty: "hard", targetSec: 45, regime: "reasoning", note: "NumberLogic-style: next-in-sequence (quadratic; constant 2nd difference)", archetype: "optiver-quadratic-demo" },
    { kind: "sequences", difficulty: "hard", targetSec: 45, regime: "reasoning", note: "progressive pattern; continue it" },
    { kind: "sequences", difficulty: "hard", targetSec: 55, regime: "reasoning", note: "pattern with a twist; state the rule" },
    { kind: "probability-ev", difficulty: "hard", targetSec: 60, regime: "reasoning", note: "Beat-the-Odds: conditional draw without replacement" },
    { kind: "probability-ev", difficulty: "hard", targetSec: 75, regime: "reasoning", note: "expected flips = 1/p; memorylessness" },
    { kind: "probability-ev", difficulty: "hard", targetSec: 90, regime: "reasoning", note: "order statistics (max/min of dice)" },
    { kind: "probability-ev", difficulty: "stretch", targetSec: 100, regime: "reasoning", note: "pattern-wait / gambler's ruin (self-overlap trap)" },
    { kind: "probability-ev", difficulty: "stretch", targetSec: 120, regime: "reasoning", note: "lattice random-walk meeting + parity trap (anchor)", archetype: "lattice-paths" },
    { kind: "probability-ev", difficulty: "hard", targetSec: 90, regime: "reasoning", note: "optimal stopping / bank-or-roll EV" },
    { kind: "probability-ev", difficulty: "stretch", targetSec: 120, regime: "reasoning", note: "Bayes / combinatorics with a constraint" },
    { kind: "market-making", difficulty: "hard", targetSec: 120, regime: "reasoning", note: "face-down cards: quote a two-way market; bot picks off" },
    { kind: "market-making", difficulty: "stretch", targetSec: 120, regime: "reasoning", note: "bot picks off harder — reveal a card, re-quote tighter" },
  ],
  behavioralCount: 2,
};

/* -------------------------------------------------------------------------- */
/*  PRESET 2 — Jane Street Style — Make a Market (11 Q)                         */
/* -------------------------------------------------------------------------- */

const JANE_STREET: MockPreset = {
  id: "janestreet",
  name: "Jane Street Style — Make a Market",
  tagline: "Fair-value reasoning + defend-and-extend under pressure.",
  tier: "hard",
  scoringNote:
    "Jane Street screens arithmetic in a SEPARATE timed math test, so this mock is the trader conversation, not a math sprint: one quick numeric warm-up, then the signal — probability/optimal-stopping and brainteasers reasoning-graded, and market-making scored on P&L + update quality. Every right answer earns a follow-up that changes an assumption or asks you to generalize.",
  adversary: "Adverse selection + \"defend & extend\".",
  intro:
    "Jane Street style. Jane Street screens arithmetic in a separate timed math " +
    "test — so this mock is the trader conversation, not a math sprint. After one " +
    "quick numeric warm-up, we spend the time reasoning out loud: EV and optimal-" +
    "stopping games that I mutate as you go (change a rule, add an adversary, " +
    "generalize to n), probability with a twist, a Fermi estimate, and an escalating " +
    "make-a-market finale where I trade against your quotes and reveal information " +
    "between rounds. I'll press every correct answer to see if your framework holds.",
  items: [
    { kind: "mental-math", difficulty: "hard", targetSec: 8, regime: "sprint", note: "one hard numeric warm-up (math is screened separately)" },
    { kind: "probability-ev", difficulty: "hard", targetSec: 120, regime: "reasoning", note: "conditional / gambler's ruin — narrate, then change an assumption" },
    { kind: "probability-ev", difficulty: "stretch", targetSec: 140, regime: "reasoning", note: "hard conditional/pattern-wait; change an assumption" },
    { kind: "probability-ev", difficulty: "hard", targetSec: 150, regime: "reasoning", note: "bank-or-roll cascade: rule change → generalize-to-n", archetype: "bank-or-roll" },
    { kind: "brainteaser", difficulty: "hard", targetSec: 120, regime: "reasoning", note: "logic puzzle under pressure; clarify the rules" },
    { kind: "brainteaser", difficulty: "hard", targetSec: 150, regime: "reasoning", note: "generalize-to-n variant" },
    { kind: "probability-ev", difficulty: "hard", targetSec: 120, regime: "reasoning", note: "optimal-stopping EV — narrate, then mutate a rule" },
    { kind: "probability-ev", difficulty: "stretch", targetSec: 140, regime: "reasoning", note: "hard Bayes / combinatorics with a constraint" },
    { kind: "market-making", difficulty: "hard", targetSec: 150, regime: "reasoning", note: "make a market on a hidden value; interviewer trades" },
    { kind: "market-making", difficulty: "hard", targetSec: 150, regime: "reasoning", note: "adverse selection → re-quote, manage inventory" },
    { kind: "market-making", difficulty: "stretch", targetSec: 180, regime: "reasoning", note: "quote on a running sum" },
  ],
  behavioralCount: 2,
};

/* -------------------------------------------------------------------------- */
/*  PRESET 3 — SIG Style — Think in Bets (12 Q)                                 */
/* -------------------------------------------------------------------------- */

const SIG: MockPreset = {
  id: "sig",
  name: "SIG Style — Think in Bets",
  tagline: "Calibrated decisions under uncertainty — calculator allowed.",
  tier: "hard",
  scoringNote:
    "No wrong-answer penalty; reasoning-graded with partial credit for correct framing even if the final number slips. Just one quick numeric warm-up up front; after that the calculator + scratch pad are enabled and arithmetic speed is not the differentiator.",
  adversary: "\"How much would you bet?\" + poker EV calibration.",
  calculatorAllowed: true,
  intro:
    "SIG style. Slower and deeper — the pressure is your own confidence, not the " +
    "clock. After one quick numeric warm-up, the calculator and scratch pad are " +
    "allowed and the difficulty is framing the problem correctly. After each answer " +
    "I'll ask how sure you are and how much you'd bet on it, and we finish with " +
    "bet-sizing / pot-odds decisions.",
  items: [
    { kind: "mental-math", difficulty: "hard", targetSec: 20, regime: "sprint", note: "one hard numeric warm-up (do it in your head)" },
    { kind: "probability-ev", difficulty: "hard", targetSec: 180, regime: "reasoning", note: "confidence → how much would you bet?", archetype: "sig-confidence-bet" },
    { kind: "probability-ev", difficulty: "hard", targetSec: 180, regime: "reasoning", note: "conditional draw / independence, multi-step" },
    { kind: "probability-ev", difficulty: "hard", targetSec: 210, regime: "reasoning", note: "conditional / Bayes, multi-step" },
    { kind: "probability-ev", difficulty: "hard", targetSec: 210, regime: "reasoning", note: "geometric expected waiting-time" },
    { kind: "probability-ev", difficulty: "stretch", targetSec: 240, regime: "reasoning", note: "combinatorics with a constraint" },
    { kind: "brainteaser", difficulty: "hard", targetSec: 240, regime: "reasoning", note: "logic + path-counting" },
    { kind: "brainteaser", difficulty: "hard", targetSec: 210, regime: "reasoning", note: "constraint/deduction" },
    { kind: "brainteaser", difficulty: "stretch", targetSec: 240, regime: "reasoning", note: "single-variable optimization" },
    { kind: "probability-ev", difficulty: "stretch", targetSec: 210, regime: "reasoning", note: "bet on your own posterior (Bayesian composition)" },
    { kind: "market-making", difficulty: "hard", targetSec: 150, regime: "reasoning", note: "make a market as a bet-sizing decision" },
    { kind: "market-making", difficulty: "hard", targetSec: 180, regime: "reasoning", note: "pot-odds / EV under social pressure" },
  ],
  behavioralCount: 2,
};

export const MOCK_PRESETS: Record<PresetId, MockPreset> = {
  optiver: OPTIVER,
  janestreet: JANE_STREET,
  sig: SIG,
};

export const PRESET_ORDER: PresetId[] = ["optiver", "janestreet", "sig"];

export function getPreset(id: PresetId): MockPreset {
  return MOCK_PRESETS[id];
}
