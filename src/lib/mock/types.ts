/**
 * TASK T10 — Mock-interview layer (verbal, AI-voice).
 *
 * A self-contained, deterministic interview engine that stitches together three
 * parts of a real quant screen:
 *   (a) spoken MENTAL-MATH with follow-up probes (scored),
 *   (b) BRAINTEASERS under a soft time limit with probing (reflect + self-assess),
 *   (c) BEHAVIORAL / fit questions (reflect-only, never scored).
 *
 * Everything in `src/lib/mock` is PURE: no React, no DOM, no storage, no network.
 * Question selection is fully seedable (same seed ⇒ same interview), and math
 * grading is deterministic. Speech I/O lives behind a feature-detected wrapper
 * (`./speech`) that degrades to typed input when unavailable, so the drill is
 * always usable — including in SSR / test environments with no `window`.
 *
 * PRIVACY: transcripts (spoken or typed) are treated as transient. Nothing here
 * ever writes to `localStorage`, cookies, or the network, and the persistable
 * summary (see `./engine#toPersistableSummary`) deliberately OMITS raw response
 * text so no PII can leak out of the session.
 */
import type { Polarity } from "./conclusion";

/**
 * A difficulty band as it may appear on a question OR a follow-up. Superset of
 * the content `Difficulty` (`easy|medium|hard|expert`) and the pool label
 * (`easy|medium|hard|stretch`). Ranked by `difficultyRank` in `interviewGate.ts`
 * so the follow-up difficulty FLOOR can compare a `stretch` follow-up against an
 * `expert` base. Declared here (not in `questionPools.ts`) to avoid a cycle.
 */
export type PoolDifficultyLike =
  | "easy"
  | "medium"
  | "hard"
  | "stretch"
  | "expert";

/** Which interview part a step belongs to. */
export type MockStage = "math" | "brainteaser" | "marketMaking" | "behavioral";

/**
 * The concrete kind of a scored numeric question. All of these are answerable +
 * deterministically graded and share the `MathStep` shape (a numeric answer, an
 * explanation, and two graded follow-ups). `mental-math` is the terse-is-fine
 * arithmetic sprint; the others expect real reasoning.
 */
export type MockQuestionType =
  | "mental-math"
  | "probability-ev"
  | "sequences"
  | "estimation";

/**
 * The pacing regime a question is played under (drives the timer UI):
 *   • `sprint`    — short hard clock, terse answers (Optiver-style arithmetic);
 *   • `reasoning` — generous budget, narrate + defend your work.
 */
export type MockRegime = "sprint" | "reasoning";

/** The firm-style preset an interview was built from. */
export type PresetId = "optiver" | "janestreet" | "sig";

/** Which of the two sequential graded follow-ups a presentation/record is. */
export type FollowupRole = "probe" | "adversarial";

/**
 * The TAXONOMY of LEGITIMATE follow-up types a real quant interviewer uses. A
 * follow-up MUST be one of these — a genuine escalation, never a DECOMPOSITION
 * of the base (asking for a sub-step the candidate already computed, e.g. "what
 * is the numerator alone"). The acceptance gate (`interviewGate.ts`) enforces
 * that every authored follow-up declares one of these and is NOT a decomposition:
 *   • `generalize-n`     — extend the setup to n / to a larger regime;
 *   • `invert`           — solve for an INPUT given the output, or reverse the ask;
 *   • `add-constraint`   — add a condition/restriction that changes the compute;
 *   • `change-regime`    — with→without replacement, fair→biased, indep→dependent,
 *                          add a cost, etc. (the framework must survive the mutation);
 *   • `adversarial-trap` — challenge a correct answer / spring a trap for shallow
 *                          reasoning ("are you sure it's 50/50?");
 *   • `act-on-it`        — now PRICE / BET / DECIDE using your own number.
 */
export type FollowupType =
  | "generalize-n"
  | "invert"
  | "add-constraint"
  | "change-regime"
  | "adversarial-trap"
  | "act-on-it";

/**
 * A coarse topic-FAMILY tag used by the mock assembler to enforce diversity (no
 * two adjacent scored items from the same family, a per-family cap, and coverage
 * of N distinct families) and by the acceptance gate. Broad on purpose: every
 * "sequences" sub-pattern is ONE family so three sequence problems never run
 * back-to-back, while probability/EV is split into fine-grained families so two
 * adjacent prob-EV slots draw genuinely different topics.
 */
export type TopicFamily =
  | "mental-math"
  | "sequences"
  | "estimation"
  | "market-making"
  | "brainteaser"
  | "independent-events"
  | "conditional-prob"
  | "geometric-race"
  | "optimal-stopping"
  | "order-statistics"
  | "bayes"
  | "random-walk"
  | "gamblers-ruin"
  | "waiting-time"
  | "combinatorics"
  | "monty"
  | "coupon-collector"
  | "birthday"
  | "derangements"
  | "bet-sizing";

/**
 * The judgement of REASONING QUALITY (never of correctness — the deterministic
 * verifier owns correctness). Mirrors the `mock-reason-grade` contract enum:
 *   • `sound`     — correct, complete, well-justified;
 *   • `partial`   — a step/justification is missing, or it reaches a wrong result;
 *   • `flawed`    — the written work contains a demonstrably FALSE arithmetic step
 *                   or a nonsensical / non-sequitur chain that doesn't validly
 *                   reach the answer. This can (and often does) co-occur with a
 *                   CORRECT final answer — e.g. "1 divided by 2 is 5 … so 0.5";
 *   • `ambiguous` — MIXED / contradictory / hedged reasoning: the explanation
 *                   points both ways (a correct part + a wrong or contradictory
 *                   part), or the grader cannot CONFIDENTLY read a single
 *                   committed conclusion. This is the trigger for a CLARIFYING
 *                   follow-up — the candidate must commit to ONE answer. It is
 *                   NEVER treated as correct and NEVER silently marked wrong;
 *   • `vague`     — hand-wavy assertion without work (not necessarily wrong);
 *   • `absent`    — no real reasoning.
 */
export type ReasoningQuality =
  | "sound"
  | "partial"
  | "flawed"
  | "ambiguous"
  | "vague"
  | "absent";

/**
 * PER-QUESTION REQUIRED-JUSTIFICATION signals. The reasoning-quality grader uses
 * these to gate a `sound` verdict on the candidate DEMONSTRATING the underlying
 * MECHANISM specific to this question — not merely restating the final numeric
 * answer or the last arithmetic step, and not merely asserting correctness ("the
 * math checks out / it's obvious / trust me").
 *
 *   • `mechanismSignals` — accepted synonymous phrasings (lower-cased substrings,
 *     matched after light normalization of super/sub-scripts, ×/*, commas and
 *     whitespace) that PROVE the candidate engaged the mechanism. When this list
 *     is non-empty a `sound` verdict REQUIRES ≥1 signal to be present. Author
 *     enough synonyms that a terse-but-correct explanation still matches.
 *   • `bannedAsSoleJustification` — optional per-question pure hand-waves that can
 *     NEVER by themselves earn credit (in addition to the universal hand-wave
 *     bank). Rarely needed; the universal detector usually suffices.
 */
export interface RequiredReasoning {
  /** Accepted phrasings demonstrating the question-specific mechanism. */
  mechanismSignals: string[];
  /** Extra pure hand-waves that can never alone justify this question. */
  bannedAsSoleJustification?: string[];
}

/**
 * A reasoning grade for ONE answer. `source` records whether the LLM produced
 * it (`ai`) or the deterministic structural fallback did (`deterministic`).
 * Correctness is NEVER carried here — it lives on the answer's `MathScore`.
 */
export interface ReasoningGrade {
  quality: ReasoningQuality;
  /** Concrete critiques of the reasoning (never of the answer). May be []. */
  issues: string[];
  /** One sharp adversarial probe, or "" if none. */
  probe: string;
  source: "ai" | "deterministic";
  /**
   * Specific clarify question when `quality === "ambiguous"`. The AI path may
   * supply a conflict-specific prompt ("you concluded X but your reasoning
   * implies Y"); the deterministic path leaves this undefined and the UI builds
   * a generic commit-to-one-answer prompt via `buildReasoningClarifyPrompt`.
   */
  clarifyPrompt?: string;
}

/**
 * An adversarial follow-up the interviewer ASKS after the main answer. Unlike
 * the old reflect-only probes, this is a real question the candidate must
 * answer and which is GRADED deterministically.
 *
 *  • `source: "authored"` — a deterministic harder-variation with a KNOWN
 *    numeric `answer` (the verifier's truth). Used when AI is off.
 *  • `source: "ai"` — the `mock-followup` question text (adaptive). Its answer
 *    is graded client-side against `referenceNote` (the stored `idealAnswerNote`)
 *    — the LLM authored the note but NEVER decides correctness.
 */
export interface FollowupPresentation {
  prompt: string;
  source: "authored" | "ai";
  /** Which of the two sequential follow-ups this is. */
  role: FollowupRole;
  /** A visible step indicator, e.g. "Follow-up 1 of 2 · Probe". */
  label: string;
  /**
   * HOW this follow-up is graded (drives both the grader AND the input widget):
   *   • `numeric`   — a single clean numeric target (default); graded by exact
   *                   numeric verification (probes and short adversarials).
   *   • `reasoning` — an OPEN question with no single-number answer; graded by
   *                   whether the written reasoning REACHES the correct
   *                   conclusion (key value(s) + required conclusion words). A
   *                   correct reasoning answer is NEVER marked "missed".
   * Absent ⇒ treated as `numeric` (back-compat).
   */
  answerKind?: "numeric" | "reasoning";
  /** Taxonomy type of this follow-up (carried from the authoring `FollowupSeed`). */
  type?: FollowupType;
  /** The follow-up's own difficulty band (carried from the seed; floor-checked). */
  difficulty?: PoolDifficultyLike;
  /** Authored numeric truth (present for numeric follow-ups). */
  answer?: number;
  decimals?: number;
  commonErrors?: { value: number; feedback: string; misconception?: string }[];
  /**
   * Reasoning follow-ups: the key numeric conclusion(s) a correct answer must
   * state (matched anywhere in the candidate's text within tolerance). Empty/
   * absent ⇒ no numeric conclusion is required.
   */
  conclusionTargets?: number[];
  /**
   * Reasoning follow-ups: groups of acceptable conclusion words; a correct
   * answer must contain ≥1 word from EACH group (case-insensitive), e.g.
   * `[["overround","inconsistent","not consistent"]]`.
   */
  conclusionKeywords?: string[][];
  /**
   * How the numeric-target and keyword signals COMBINE (default `"all"`):
   *   • `"all"` — a correct answer must satisfy BOTH every required conclusion
   *               value AND every keyword group (the strict default).
   *   • `"any"` — EITHER hitting every required value OR satisfying every keyword
   *               group is sufficient. Used when a single hard-to-guess numeric
   *               value fully PROVES the method (e.g. "state the rule AND give the
   *               value at position 10": nailing the far-out term proves the rule
   *               even if the candidate phrases it outside our keyword bank).
   * Ignored when only one signal (value XOR keywords) is present.
   */
  conclusionMode?: ConclusionMode;
  /**
   * Groups of phrases that signal COMMITMENT TO A WRONG conclusion (any one
   * present ⇒ a wrong-side signal). Enables the rock-solid grader to catch
   * "correct-fact-but-wrong-conclusion" and contradictions: a mixed answer
   * (correct + wrong) → `clarify`; a purely wrong commitment → `missed`.
   */
  wrongKeywords?: string[][];
  /** Numeric value(s) that indicate a WRONG committed conclusion (decoys). */
  wrongValues?: number[];
  /**
   * Expected polarity for a yes/no or same/different reasoning follow-up:
   * `"deny"` = the correct answer is NO / different / it-changes; `"affirm"` =
   * YES / same / unchanged. A leading yes/no (or same/different) that conflicts
   * with this is a wrong-side commitment.
   */
  expectedPolarity?: Polarity;
  /**
   * Reasoning follow-ups: accepted phrasings that PROVE the candidate engaged
   * the MECHANISM (not just the committed side/value). When non-empty, a
   * `correct` verdict additionally REQUIRES ≥1 signal — a bare "yes/no + true
   * buzzword" or pure hand-wave routes to CLARIFY instead of passing.
   */
  mechanismSignals?: string[];
  /** Extra pure hand-waves that can never alone justify this follow-up. */
  bannedAsSoleJustification?: string[];
  /** AI's `idealAnswerNote`, stored for client-side deterministic grading. */
  referenceNote?: string;
  /**
   * The CANONICAL answer / committed stance to reveal when the candidate's
   * answer to this follow-up is not fully correct (missed / caved). For a
   * reasoning follow-up this is the human-readable position (e.g. `"Larger"` or
   * `"a = 3, b = −3, c = 5"`); a numeric follow-up may omit it and fall back to
   * the graded `answer`. Paired with `modelReasoning` (the demo "how-to").
   */
  modelAnswer?: string;
  /**
   * A concise (1–3 sentence) MODEL reasoning shown alongside `modelAnswer` when
   * the follow-up was not fully correct — the ideal way to reach the answer.
   */
  modelReasoning?: string;
  targetMs: number;
}

/** How a reasoning follow-up combines its numeric-target and keyword signals. */
export type ConclusionMode = "all" | "any";

/**
 * The pending / recorded CLARIFYING follow-up for an answer whose reasoning was
 * MIXED / contradictory / hedged. Exactly ONE clarify round is ever asked (no
 * loops); if it is still unresolved after the clarification, the item is MISSED.
 */
export interface ClarifyState {
  /** The commitment-forcing question (names the two sides in tension). */
  prompt: string;
  /** The candidate's committed answer — TRANSIENT (device-local only). */
  raw: string;
  viaSpeech: boolean;
  /** True once the candidate has answered the clarify prompt. */
  graded: boolean;
  /** STRICT grade of the clarification (correct ⇒ resolved; else ⇒ missed). */
  score?: MathScore;
}

/**
 * A CONCEPT-SPECIFIC follow-up authored BY THE QUESTION GENERATOR (in
 * `questionPools.ts`), before the engine assigns its role / label / clock. It
 * references the SPECIFIC setup of its parent question (not the numeric shape of
 * the answer), so it deepens or challenges the actual PRINCIPLE rather than doing
 * arithmetic on the previous answer. Graded deterministically by `answerKind`:
 *   • `numeric`   — a genuine related computation with an exact target;
 *   • `reasoning` — an open logic challenge graded on reaching the correct
 *                   conclusion (value(s) and/or conclusion words).
 */
export interface FollowupSeed {
  prompt: string;
  answerKind: "numeric" | "reasoning";
  /**
   * WHICH taxonomy type of follow-up this is (see `FollowupType`). Required for
   * every scored (non-mental-math) question's seeds — the acceptance gate rejects
   * a build if any reachable follow-up omits it or is a DECOMPOSITION of the base.
   */
  type?: FollowupType;
  /**
   * The follow-up's own difficulty band. The gate enforces a DIFFICULTY FLOOR:
   * a follow-up must be at least as hard as its base (ideally harder). Defaults
   * to the base's difficulty when omitted, so an un-annotated follow-up can never
   * be treated as EASIER than the base.
   */
  difficulty?: PoolDifficultyLike;
  /** Numeric seeds: the exact graded target. */
  answer?: number;
  decimals?: number;
  commonErrors?: { value: number; feedback: string; misconception?: string }[];
  /** Reasoning seeds: key numeric conclusion(s) the answer must reach. */
  conclusionTargets?: number[];
  /** Reasoning seeds: groups of acceptable conclusion words (≥1 per group). */
  conclusionKeywords?: string[][];
  /**
   * How the value/keyword signals combine (default `"all"`). Set `"any"` when a
   * single hard-to-guess numeric value fully proves the reasoning, so a correct
   * value is accepted even if the rule is phrased outside the keyword bank.
   */
  conclusionMode?: ConclusionMode;
  /** Reasoning seeds: phrases signalling a WRONG committed conclusion. */
  wrongKeywords?: string[][];
  /** Reasoning seeds: numeric value(s) indicating a WRONG committed conclusion. */
  wrongValues?: number[];
  /** Reasoning seeds: expected yes/no or same/different polarity. */
  expectedPolarity?: Polarity;
  /**
   * Reasoning seeds: accepted phrasings that PROVE the candidate engaged the
   * MECHANISM. When non-empty, a `correct` verdict additionally requires ≥1
   * signal so a "committed-correct side + true buzzword" (no mechanism) or a
   * pure hand-wave cannot pass — it routes to the one-round clarify instead.
   */
  mechanismSignals?: string[];
  /** Reasoning seeds: extra pure hand-waves that can never alone justify it. */
  bannedAsSoleJustification?: string[];
  /**
   * The CANONICAL answer / position to SHOW the candidate when their reasoning
   * on this follow-up is anything less than fully correct (they miss it or cave
   * under pressure) — e.g. the exact value or a committed stance like
   * `"0 — impossible under mutual exclusivity"`. For a numeric probe this may be
   * omitted (the UI shows the graded `answer`); a reasoning follow-up should
   * ALWAYS set it so the learner sees the target stance. See `modelReasoning`.
   */
  modelAnswer?: string;
  /**
   * A concise (1–3 sentence) MODEL reasoning — the "demo answer" showing HOW to
   * get to `modelAnswer` — surfaced only when the candidate's answer/reasoning
   * was not fully correct, so they learn the ideal response for next time.
   */
  modelReasoning?: string;
}

/**
 * The TWO concept-specific follow-ups a scored NON-mental-math question carries:
 *   • `probe`       — Follow-up 1: deepens the SAME principle in a genuinely
 *                     different way (a related computation or small
 *                     generalization a pattern-matcher would miss);
 *   • `adversarial` — Follow-up 2: challenges the FUNDAMENTAL logic (change an
 *                     assumption, "why is this valid / what breaks", generalize
 *                     to n, or a trap for shallow reasoning) — usually reasoning-
 *                     graded so it truly tests understanding.
 * Mental-math (speed) questions deliberately carry NONE.
 */
export interface QuestionFollowups {
  probe: FollowupSeed;
  adversarial: FollowupSeed;
}

/** The asked-and-graded follow-up record attached to a math response. */
export interface FollowupRecord {
  presentation: FollowupPresentation;
  /** Candidate's answer to the follow-up — TRANSIENT (device-local only). */
  raw: string;
  viaSpeech: boolean;
  /** Deterministic grade of the follow-up answer; absent until answered. */
  score?: MathScore;
  /** True once the candidate has answered (whether right or wrong). */
  graded: boolean;
  /**
   * The ONE clarifying follow-up asked when this follow-up's reasoning was
   * MIXED / contradictory / hedged (`score.verdict === "clarify"`). Present only
   * after a clarify is triggered; its STRICT grade decides correct vs missed.
   */
  clarify?: ClarifyState;
}

/**
 * The TWO distinct, sequential, graded follow-ups asked after a main answer:
 *   • `probe`       — Follow-up 1 of 2: a real, answerable direct probe;
 *   • `adversarial` — Follow-up 2 of 2: a harder variation, shown ONLY after the
 *                     probe is submitted.
 * Each is a DIFFERENT question with its OWN known target, graded independently.
 * Never both active at once (the UI reveals the adversarial only once the probe
 * is graded).
 */
export interface FollowupSet {
  probe?: FollowupRecord;
  adversarial?: FollowupRecord;
}

/** How the learner answers a step — spoken (with typed fallback) or reflect-only. */
export type StepMode = "answer" | "reflect";

/**
 * (a) A scored spoken mental-math question. `answer`/`decimals`/`commonErrors`
 * mirror the shape `@/lib/numeric` grades against, so a spoken or typed answer
 * string can be graded deterministically. `followUps` are reflect-only verbal
 * probes the interviewer asks after the answer (never scored).
 */
export interface MathStep {
  kind: "math";
  id: string;
  /** Which concrete numeric family this is (drives grading nuance + labels). */
  qtype: MockQuestionType;
  /** Pacing regime (sprint = hard clock/terse; reasoning = narrate + defend). */
  regime: MockRegime;
  /** Spoken/displayed question prompt. */
  prompt: string;
  /** Exact correct value (graded via `@/lib/numeric`). */
  answer: number;
  /** Decimal precision the answer carries (see `NumericQuestion.decimals`). */
  decimals?: number;
  concept?: string;
  /** Difficulty tier this item was drawn at (easy/medium/hard/stretch). */
  difficulty?: string;
  /**
   * The GENERATOR's INTRINSIC difficulty (what the follow-ups were authored
   * against), independent of the preset SLOT's pacing label in `difficulty`. A
   * `hard` conditional-probability item scheduled in a `stretch` (longer-clock)
   * slot still has a `hard` base, so its `hard` follow-ups are correctly judged
   * "≥ base" instead of being wrongly flagged as easier than the slot label.
   */
  baseDifficulty?: string;
  /**
   * Coarse topic-FAMILY tag (see `TopicFamily`) used by the assembler's diversity
   * constraints and the acceptance gate. `mental-math` for the speed gate; the
   * scored conceptual families for prob-EV / sequences / estimation.
   */
  family?: TopicFamily;
  /**
   * Values already computed while solving THIS question (numerator, sub-counts,
   * thresholds). The acceptance gate rejects any follow-up whose answer equals
   * one of these (a decomposition). Threaded from the drawn `MockNumericQuestion`.
   */
  baseIntermediates?: number[];
  /** Worked solution revealed after answering. */
  explanation: string;
  /** Known wrong values → targeted coaching (mirrors `NumericQuestion.commonErrors`). */
  commonErrors?: { value: number; feedback: string; misconception?: string }[];
  /** Reflect-only follow-up probes (legacy display backbone). */
  followUps: string[];
  /**
   * The CONCEPT-SPECIFIC authored PROBE (Follow-up 1 of 2): a directly-
   * answerable question that deepens the SAME principle, authored by the
   * question generator from its own setup. Always-on backbone; asked-and-graded
   * when the AI layer is off. ABSENT for mental-math (speed) steps, which get no
   * conceptual follow-up.
   */
  authoredProbe?: FollowupPresentation;
  /**
   * The CONCEPT-SPECIFIC authored ADVERSARIAL follow-up (Follow-up 2 of 2): a
   * challenge to the FUNDAMENTAL logic, DISTINCT from the probe. Used when the AI
   * adversarial follow-up is off / unusable. ABSENT for mental-math steps.
   */
  authoredAdversarial?: FollowupPresentation;
  /**
   * PER-QUESTION required-justification signals for the MAIN reasoning-quality
   * grade: a `sound` verdict requires the candidate to convey this question's
   * MECHANISM (not just restate the final answer/arithmetic). ABSENT for pure
   * mental-math speed steps (brevity is fine there).
   */
  requiredReasoning?: RequiredReasoning;
  /** Timing target in ms; scoring bands are derived from this. */
  targetMs: number;
  source?: string;
}

/**
 * (d) A MARKET-MAKING question, backed by a DETERMINISTIC adversarial bot (no
 * LLM). The candidate quotes a two-sided market each round; a mixed
 * informed+uninformed counterparty (reusing the Make-Me-a-Market math) trades
 * against them, picking off bad/wide/offside quotes to produce a P&L.
 */
export interface MarketMakingStep {
  kind: "marketMaking";
  id: string;
  /** The scenario the candidate must make a market in. */
  prompt: string;
  /** A short coaching hint on what a disciplined quote looks like. */
  contextHint: string;
  /** The hidden true value the informed counterparty knows. */
  trueValue: number;
  /** Strict max spread (ask − bid must be < this). */
  maxSpread: number;
  /** How many tight-market rounds the candidate quotes. */
  totalRounds: number;
  /** Aggression of the informed flow (size pressed when picked off). */
  aggression: number;
  /** Deterministic seed for the counterparty's RNG (resume-stable). */
  seed: number;
  concept?: string;
  /** Difficulty tier label (medium/hard/stretch). */
  difficulty?: string;
  /** Per-question time target in ms (UI hint; MM does not hard-gate). */
  targetMs?: number;
  /**
   * SIG-style "think in bets" framing: the exercise is a bet-sizing /
   * pot-odds decision rather than tight-spread HFT market making. Purely a
   * presentation + coaching flavour flag; the deterministic bot is unchanged.
   */
  betSizing?: boolean;
  source?: string;
}

/** One completed market-making round: the quote and the counterparty's action. */
export interface MmRoundResult {
  round: number;
  quote: { bid: number; ask: number; bidSize: number; askSize: number };
  /** From the player's perspective; null when nobody traded. */
  fill: { side: "buy" | "sell"; price: number; size: number } | null;
  chatter: string;
  kind: "informed" | "noise" | "pass";
}

/** Live/persisted state of a market-making step as the candidate plays it. */
export interface MmState {
  trueValue: number;
  maxSpread: number;
  totalRounds: number;
  /** Completed rounds so far. */
  results: MmRoundResult[];
  done: boolean;
  /** Mark-to-true P&L across all fills (computed when done). */
  pnl: number;
  /** Number of adverse (informed) pick-offs suffered. */
  picked: number;
  /** Deterministic one-line verdict (computed when done). */
  verdict: string;
}

/**
 * (b) A brainteaser posed under a soft time limit. Reveal-and-self-assess (no
 * deterministic scoring — the "aha" is the point), with probing follow-ups.
 */
export interface BrainteaserStep {
  kind: "brainteaser";
  id: string;
  prompt: string;
  /** Concise answer revealed after the learner reasons / time expires. */
  answer: string;
  /** Full reasoning shown on reveal. */
  explanation: string;
  concept?: string;
  /** Probing follow-ups the interviewer asks (reflect-only). */
  probes: string[];
  /** Soft time budget in seconds (UI hint; does not gate the flow). */
  timeLimitSec: number;
  source?: string;
}

/**
 * (c) A behavioral / fit question. Reflect-only: the learner speaks or types a
 * response for their own review; nothing is graded or judged.
 */
export interface BehavioralStep {
  kind: "behavioral";
  id: string;
  prompt: string;
  /** Optional single probing follow-up. */
  followUp?: string;
  /** Bulleted things a strong answer tends to cover (self-review hints). */
  reflectionHints: string[];
}

export type MockStep =
  | MathStep
  | BrainteaserStep
  | MarketMakingStep
  | BehavioralStep;

/** Difficulty tier that selects the mental-math pool. */
export type MathTier = "easy" | "medium" | "hard";

/**
 * Deterministic interview configuration. The same `seed` (and counts/tier)
 * always produces byte-identical questions.
 */
export interface MockConfig {
  seed: number;
  /**
   * A firm-style preset (Optiver / Jane Street / SIG). When set, the ordered
   * question mix, per-question timing, difficulty tiers, and MM flavour come
   * ENTIRELY from the preset spec and the count/tier fields below are ignored.
   */
  preset?: PresetId;
  /** Number of scored math questions (default 3). Legacy count-based path. */
  mathCount?: number;
  /** Number of timed brainteasers (default 2). Legacy count-based path. */
  brainteaserCount?: number;
  /** Number of market-making questions (default 1). Legacy count-based path. */
  marketMakingCount?: number;
  /** Number of behavioral questions (default 2). Legacy count-based path. */
  behavioralCount?: number;
  /** Mental-math difficulty pool (default "medium"). Legacy count-based path. */
  tier?: MathTier;
}

/** A fully-built, deterministic interview script. */
export interface MockScript {
  seed: number;
  tier: MathTier;
  /** The firm-style preset this was built from (absent for legacy count-based). */
  presetId?: PresetId;
  /** Human name of the preset, e.g. "Optiver Style — Speed & Odds". */
  presetName?: string;
  /** One-line description of the preset's scoring nuance / adversary. */
  scoringNote?: string;
  /** Whether a calculator + scratch pad is allowed (SIG-style). */
  calculatorAllowed?: boolean;
  /** A friendly, deterministic opening line from the AI interviewer. */
  intro: string;
  steps: MockStep[];
}

/** Timing verdict for a math answer. */
export type TimingBand = "fast" | "ok" | "slow";

/**
 * The three-way verdict for a reasoning-graded answer/follow-up:
 *   • `correct`  — committed to the verified conclusion with valid, non-
 *                  contradictory reasoning;
 *   • `missed`   — committed to the wrong side, or otherwise wrong/unresolved;
 *   • `clarify`  — MIXED / contradictory / hedged / can't-confirm → the caller
 *                  must ask ONE clarifying follow-up. `correct` is `false` while
 *                  a `clarify` is pending (an ambiguous answer never passes).
 */
export type FollowupVerdict = "correct" | "missed" | "clarify";

/** Deterministic grade for one spoken/typed math answer. */
export interface MathScore {
  /** Parsed numeric value (after spoken-number normalization), or null. */
  parsed: number | null;
  correct: boolean;
  /** Targeted feedback if the wrong answer matched a known error. */
  matchedError?: { value: number; feedback: string; misconception?: string };
  elapsedMs: number;
  targetMs: number;
  timing: TimingBand;
  /** 0..1 correctness score (timing is reported separately, never penalizes it). */
  score: number;
  /**
   * Three-way verdict for reasoning-graded follow-ups. Present only for
   * reasoning follow-ups (numeric follow-ups are `correct`/`missed` binary). A
   * `"clarify"` means the answer was MIXED/contradictory/hedged and a clarifying
   * follow-up must be asked; `correct` stays `false` until it is resolved.
   */
  verdict?: FollowupVerdict;
  /** When `verdict === "clarify"`, the specific commitment-forcing prompt. */
  clarifyPrompt?: string;
}

/**
 * One in-memory response record. `raw` is the TRANSIENT transcript (spoken or
 * typed) and is intentionally excluded from any persistable summary — see the
 * `PersistableResponse` type and `toPersistableSummary`.
 */
export interface MockResponse {
  stepId: string;
  stage: MockStage;
  /** Raw transcript — TRANSIENT, in-memory only, never persisted. */
  raw: string;
  /** Whether the input arrived via speech recognition (vs typed fallback). */
  viaSpeech: boolean;
  /** Present only for math steps. */
  score?: MathScore;
  /** Learner self-assessment for brainteasers ("got it" / "missed it"). */
  selfAssessed?: "got" | "missed";
  /**
   * The candidate's reasoning text — TRANSIENT (device-local resume only, never
   * exported in the PII-free summary).
   */
  reasoningRaw?: string;
  /** Reasoning-quality grade (LLM or deterministic); correctness NOT here. */
  reasoningGrade?: ReasoningGrade;
  /**
   * The ONE clarifying follow-up for the MAIN answer's reasoning, asked when the
   * reasoning grade was `ambiguous` (mixed / contradictory / hedged). Its STRICT
   * grade resolves the reasoning to `sound` or leaves it charged as weak.
   */
  clarify?: ClarifyState;
  /** The TWO asked-and-graded follow-ups (probe then adversarial; math steps). */
  followups?: FollowupSet;
  /** Market-making play state (marketMaking steps). */
  mm?: MmState;
}

/** PII-free per-follow-up verdict summary (no transcript text). */
export interface FollowupVerdictSummary {
  source: "authored" | "ai";
  correct?: boolean;
  graded: boolean;
  /** The three-way verdict (`clarify` while a clarification is pending). */
  verdict?: FollowupVerdict;
  /** Whether a clarify was asked and whether it resolved. */
  clarify?: { asked: boolean; resolved?: boolean };
}

/**
 * PII-free projection of a response, safe to persist/export. Note the ABSENCE
 * of `raw` — no transcript text ever appears here.
 */
export interface PersistableResponse {
  stepId: string;
  stage: MockStage;
  viaSpeech: boolean;
  correct?: boolean;
  timing?: TimingBand;
  score?: number;
  selfAssessed?: "got" | "missed";
  /** Reasoning-quality tag only (no transcript text). */
  reasoningQuality?: ReasoningQuality;
  /**
   * Whether the MAIN reasoning triggered a clarify and whether it resolved
   * (committed-correct on the clarification). PII-free structural flags only.
   */
  clarify?: { asked: boolean; resolved?: boolean };
  /** Both follow-up verdicts only (no transcript text). */
  followups?: {
    probe?: FollowupVerdictSummary;
    adversarial?: FollowupVerdictSummary;
  };
  /** Market-making outcome only. */
  mm?: { pnl: number; verdict: string; picked: number; done: boolean };
}

/** Aggregate, PII-free session summary. */
export interface MockSummary {
  seed: number;
  tier: MathTier;
  mathTotal: number;
  mathCorrect: number;
  mathAvgElapsedMs: number | null;
  brainteaserSeen: number;
  brainteaserGotIt: number;
  behavioralAnswered: number;
  responses: PersistableResponse[];
}

/** A per-competency correct/total tally used by the strict diagnosis. */
export interface CompetencyTally {
  correct: number;
  total: number;
}

/** Counts of each reasoning-quality verdict across the interview. */
export interface ReasoningTags {
  sound: number;
  partial: number;
  flawed: number;
  vague: number;
  absent: number;
  /**
   * MIXED / contradictory / hedged reasoning that triggered a clarify and stayed
   * unresolved. Optional for back-compat with hand-built summaries; treated as 0
   * when absent.
   */
  ambiguous?: number;
}

/**
 * The DETERMINISTIC, PII-minimized performance summary. Every number is
 * computed client-side; this is the exact payload handed to `mock-diagnosis`
 * (mirrors the contract's `summary` object). The LLM turns these numbers into
 * prose but must never invent a statistic not present here.
 */
export interface MockPerformance {
  scorePct: number;
  mathCorrect: number;
  mathTotal: number;
  avgMathMs: number;
  brainteaserCorrect: number;
  brainteaserTotal: number;
  /** Combined across BOTH follow-ups (probe + adversarial) — AI contract field. */
  followupCorrect: number;
  followupTotal: number;
  /** Probe-only tally (Follow-up 1 of 2). */
  probeCorrect: number;
  probeTotal: number;
  /** Adversarial-only tally (Follow-up 2 of 2). */
  adversarialCorrect: number;
  adversarialTotal: number;
  mmPnl?: number;
  mmVerdict?: string;
  reasoningTags: ReasoningTags;
  /**
   * Correct answers whose reasoning was weak: vague/absent on non-MM questions,
   * or demonstrably FLAWED (a false/nonsensical stated step) on ANY question.
   * Mental-math brevity alone is never counted here.
   */
  correctButVagueCount: number;
  tier: string;
  /**
   * PER-COMPETENCY breakdown (optional; present from `computePerformance`). These
   * let the diagnosis grade each skill separately — speed vs conceptual — instead
   * of one blended `mathCorrect`. `mathCorrect`/`mathTotal` stay the blended tally
   * for back-compat and the overall score.
   */
  speed?: CompetencyTally;
  /** Average elapsed ms over MENTAL-MATH items only (speed gate pace). */
  speedAvgMs?: number;
  probEv?: CompetencyTally;
  sequences?: CompetencyTally;
  estimation?: CompetencyTally;
}

/** The final diagnosis prose (LLM `mock-diagnosis` or deterministic fallback). */
export interface MockDiagnosis {
  verdict: string;
  wouldPass: "yes" | "borderline" | "no";
  strengths: string[];
  weaknesses: string[];
  nextSteps: string[];
  source: "ai" | "deterministic";
}
