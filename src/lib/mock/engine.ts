import { Rng } from "@/lib/rng";
import type { NumericQuestion } from "@/types/content";
import { MOCK_GATE_POOLS } from "./mathGate";
import { ALL_BRAINTEASER_FAMILIES } from "@/content/brainteasers/generators";
import { scoreMathAnswer } from "./scoring";
import { selectBehavioral } from "./behavioral";
import {
  buildFollowupPresentations,
  gradeFollowup,
  gradeClarification,
  gradeMainClarification,
} from "./followups";
import {
  buildMarketMakingSteps,
  buildMockMmStep,
  initMmState,
  playMmRound,
} from "./marketMaking";
import {
  archetypeFamily,
  drawArchetype,
  drawNumericQuestionAvoiding,
  type MockNumericQuestion,
  type PoolDifficulty,
} from "./questionPools";
import { getPreset, type PresetItem } from "./presets";
import { familyCap } from "./interviewGate";
import type { TopicFamily } from "./types";
import type { Quote } from "@/lib/games/makeMarket/engine";
import type {
  BrainteaserStep,
  FollowupPresentation,
  FollowupRecord,
  FollowupRole,
  FollowupVerdictSummary,
  MarketMakingStep,
  MathScore,
  MathStep,
  MathTier,
  MockConfig,
  MockQuestionType,
  MockResponse,
  MockScript,
  MockStep,
  MockSummary,
  MockRegime,
  PersistableResponse,
  ReasoningGrade,
} from "./types";

/**
 * The PURE interview engine: a deterministic, seedable script builder plus a
 * reducer-style state machine. No React, no DOM, no storage, no network.
 *
 * `buildInterview(config)` is a total function of its config — the same seed,
 * counts, and tier always produce byte-identical questions. The state machine
 * (`createSession` + `mockReducer`) is entirely speech-agnostic: it drives the
 * exact same usable flow whether answers arrive by speech or by typing, which is
 * what guarantees graceful degradation when no microphone / SpeechRecognition is
 * available (the UI just switches the input widget, not the engine).
 */

/* -------------------------------------------------------------------------- */
/*  Deterministic script building                                             */
/* -------------------------------------------------------------------------- */

/**
 * The mock arithmetic gate draws from MOCK-SCOPED pools (`./mathGate`) that
 * guarantee non-trivial instances. The shared lesson / Speed-Arena pools stay
 * untouched — this only affects the mock so the gate never emits a memorised
 * freebie (e.g. "1/2 as a decimal").
 */
const MATH_POOLS: Record<MathTier, ((rng: Rng) => NumericQuestion)[]> =
  MOCK_GATE_POOLS;

const TARGET_MS: Record<MathTier, number> = {
  easy: 12000,
  medium: 15000,
  hard: 18000,
};

/** Reflect-only follow-up probes for a math step, chosen deterministically. */
const MATH_PROBES = [
  "Walk me through the shortcut you used to get there.",
  "How would your answer change if one of the numbers were doubled?",
  "What's a fast sanity check that your answer is the right order of magnitude?",
  "Talk me through where a careless version of this goes wrong.",
];

/** Reflect-only probes for a brainteaser step. */
const BRAINTEASER_PROBES = [
  "What's the single key insight that unlocks this?",
  "How would the answer change if the numbers were bigger?",
  "Can you bound the answer before computing it exactly?",
  "Where would a first-instinct answer go wrong here?",
];

/** Map a preset difficulty label to a mental-math tier (stretch → hard). */
function difficultyToTier(d: PoolDifficulty): MathTier {
  if (d === "easy") return "easy";
  if (d === "medium") return "medium";
  return "hard"; // hard + stretch
}

/**
 * Wrap a `NumericQuestion` into a fully-graded `MathStep`. For scored CONCEPTUAL
 * questions (probability-ev, sequences, estimation) that authored their own
 * concept-specific follow-ups, attach the probe + adversarial. MENTAL-MATH is a
 * pure SPEED gate and deliberately gets NO conceptual follow-up.
 */
function makeMathStep(args: {
  rng: Rng;
  q: NumericQuestion | MockNumericQuestion;
  qtype: MockQuestionType;
  regime: MockRegime;
  difficulty: string;
  targetMs: number;
  index: number;
}): MathStep {
  const { rng, q, qtype, regime, difficulty, targetMs, index } = args;
  const followUps = rng.shuffle(MATH_PROBES).slice(0, 2);
  const followupSeeds =
    qtype !== "mental-math" ? (q as MockNumericQuestion).followups : undefined;
  const authored = followupSeeds
    ? buildFollowupPresentations(followupSeeds, targetMs)
    : undefined;
  return {
    kind: "math",
    id: `mock-math-${index}-${q.id}`,
    qtype,
    regime,
    prompt: q.prompt.replace(/\s*\(Enter[^)]*\)\s*$/, "").trim(),
    answer: q.answer,
    decimals: q.decimals,
    concept: q.concept,
    difficulty,
    ...(qtype !== "mental-math" && (q as MockNumericQuestion).difficulty
      ? { baseDifficulty: (q as MockNumericQuestion).difficulty }
      : {}),
    family:
      qtype === "mental-math"
        ? "mental-math"
        : (q as MockNumericQuestion).family,
    ...(qtype !== "mental-math" && (q as MockNumericQuestion).baseIntermediates
      ? { baseIntermediates: (q as MockNumericQuestion).baseIntermediates }
      : {}),
    explanation: q.explanation,
    commonErrors: q.commonErrors,
    followUps,
    ...(authored
      ? { authoredProbe: authored.probe, authoredAdversarial: authored.adversarial }
      : {}),
    ...(qtype !== "mental-math" &&
    (q as MockNumericQuestion).requiredReasoning
      ? { requiredReasoning: (q as MockNumericQuestion).requiredReasoning }
      : {}),
    targetMs,
    source: q.source,
  };
}

function buildMathSteps(rng: Rng, tier: MathTier, count: number): MathStep[] {
  const pool = MATH_POOLS[tier];
  const steps: MathStep[] = [];
  for (let i = 0; i < count; i++) {
    const q = rng.pick(pool)(rng);
    steps.push(
      makeMathStep({
        rng,
        q,
        qtype: "mental-math",
        regime: "sprint",
        difficulty: tier,
        targetMs: TARGET_MS[tier],
        index: i,
      }),
    );
  }
  return steps;
}

function buildBrainteaserSteps(rng: Rng, count: number): BrainteaserStep[] {
  const families = rng.shuffle(ALL_BRAINTEASER_FAMILIES);
  const n = Math.max(0, Math.min(count, families.length));
  const steps: BrainteaserStep[] = [];
  for (let i = 0; i < n; i++) {
    const [, gen] = families[i];
    const card = gen(rng);
    const probes = rng.shuffle(BRAINTEASER_PROBES).slice(0, 2);
    steps.push({
      kind: "brainteaser",
      id: `mock-bt-${i}-${card.id}`,
      prompt: card.prompt,
      answer: card.answer,
      explanation: card.explanation,
      concept: card.concept,
      difficulty: card.difficulty,
      probes,
      timeLimitSec: card.difficulty === "hard" ? 180 : 120,
      source: card.source,
    });
  }
  return steps;
}

/* -------------------------------------------------------------------------- */
/*  Preset-based building                                                      */
/* -------------------------------------------------------------------------- */

/** Brainteaser family generators grouped by difficulty (name-keyed). */
const BT_BY_NAME = Object.fromEntries(ALL_BRAINTEASER_FAMILIES);
const BT_MEDIUM_NAMES = ["genAdjacentCross", "genWalkOfferDown", "genBackupDealer"];
const BT_HARD_NAMES = ["genFadingBuyer", "genRoundTrip", "genInventoryCap"];

/** A cursor over a shuffled pool that draws distinct items, wrapping if needed. */
function makeCursor<T>(items: T[]): () => T {
  let i = 0;
  return () => {
    const v = items[i % items.length];
    i += 1;
    return v;
  };
}

/**
 * Build a preset interview: an ORDERED question mix with per-question timing,
 * difficulty tiers, and pacing regime, exactly per `datasets/FIRM_MOCK_PRESETS.md`.
 * Behavioral prompts are appended at the VERY END as UNSCORED flashcards.
 */
function buildPresetInterview(config: MockConfig): MockScript {
  const preset = getPreset(config.preset!);
  const rng = new Rng(config.seed);

  const btMedium = makeCursor(
    rng.shuffle(BT_MEDIUM_NAMES.map((n) => BT_BY_NAME[n])),
  );
  const btHard = makeCursor(rng.shuffle(BT_HARD_NAMES.map((n) => BT_BY_NAME[n])));

  const steps: MockStep[] = [];
  let mmIndex = 0;

  // DIVERSITY state: the family of the immediately-preceding scored item and the
  // running per-family counts, so a non-archetype draw avoids repeating the
  // previous family and never exceeds a family's cap (see `interviewGate.ts`).
  let prevFamily: TopicFamily | null = null;
  const familyCounts = new Map<TopicFamily, number>();
  const noteFamily = (family: TopicFamily | undefined | null) => {
    if (!family) {
      prevFamily = null;
      return;
    }
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
    prevFamily = family;
  };

  preset.items.forEach((item: PresetItem, i: number) => {
    const targetMs = item.targetSec * 1000;
    if (item.kind === "mental-math") {
      const q = rng.pick(MATH_POOLS[difficultyToTier(item.difficulty)])(rng);
      steps.push(
        makeMathStep({
          rng,
          q,
          qtype: "mental-math",
          regime: item.regime,
          difficulty: item.difficulty,
          targetMs,
          index: i,
        }),
      );
      noteFamily("mental-math");
    } else if (
      item.kind === "probability-ev" ||
      item.kind === "sequences" ||
      item.kind === "estimation"
    ) {
      // A pinned firm-signature archetype overrides the random pool draw so a
      // preset slot always features that flagship problem — for ANY numeric kind
      // (e.g. Optiver's pinned quadratic-sequence demo on a `sequences` slot, or
      // a probability-ev cascade on a `probability-ev` slot). Non-pinned slots
      // draw a family that AVOIDS the previous scored item's family and any
      // family already at its cap, so no two adjacent items share a topic.
      let q: MockNumericQuestion;
      if (item.archetype) {
        q = drawArchetype(rng, item.archetype);
      } else {
        const avoid = new Set<TopicFamily>();
        if (prevFamily) avoid.add(prevFamily);
        for (const [fam, count] of familyCounts) {
          if (count >= familyCap(fam)) avoid.add(fam);
        }
        // Also avoid colliding with the family of an immediately-following
        // pinned archetype so a pinned slot never sits next to a same-family draw.
        const nextItem = preset.items[i + 1];
        if (nextItem?.archetype) avoid.add(archetypeFamily(nextItem.archetype));
        q = drawNumericQuestionAvoiding(rng, item.kind, item.difficulty, avoid);
      }
      steps.push(
        makeMathStep({
          rng,
          q,
          qtype: item.kind,
          regime: item.regime,
          difficulty: item.difficulty,
          targetMs,
          index: i,
        }),
      );
      noteFamily(q.family ?? null);
    } else if (item.kind === "brainteaser") {
      const gen = item.difficulty === "medium" ? btMedium() : btHard();
      const card = gen(rng);
      const probes = rng.shuffle(BRAINTEASER_PROBES).slice(0, 2);
      steps.push({
        kind: "brainteaser",
        id: `mock-bt-${i}-${card.id}`,
        prompt: card.prompt,
        answer: card.answer,
        explanation: card.explanation,
        concept: card.concept,
        // The preset SLOT difficulty is the authoritative floor label for this
        // brainteaser (hard/stretch), so the gate can floor-check it.
        difficulty: item.difficulty,
        probes,
        timeLimitSec: item.targetSec,
        source: card.source,
      });
      noteFamily("brainteaser");
    } else {
      // market-making
      steps.push(
        buildMockMmStep(rng, item.difficulty, mmIndex, {
          betSizing: preset.id === "sig",
          targetMs,
        }),
      );
      mmIndex += 1;
      noteFamily("market-making");
    }
  });

  // Behavioral prompts LAST, as unscored prep flashcards.
  steps.push(...selectBehavioral(rng, preset.behavioralCount));

  return {
    seed: config.seed,
    tier: preset.tier,
    presetId: preset.id,
    presetName: preset.name,
    scoringNote: preset.scoringNote,
    calculatorAllowed: preset.calculatorAllowed ?? false,
    intro: preset.intro,
    steps,
  };
}

/**
 * Build a deterministic interview script from a config. When `config.preset` is
 * set, the ordered firm-style preset mix is used; otherwise the legacy
 * count-based path (math → brainteasers → market-making → behavioral) applies.
 */
export function buildInterview(config: MockConfig): MockScript {
  if (config.preset) return buildPresetInterview(config);

  const tier = config.tier ?? "medium";
  const mathCount = config.mathCount ?? 3;
  const brainteaserCount = config.brainteaserCount ?? 2;
  const marketMakingCount = config.marketMakingCount ?? 1;
  const behavioralCount = config.behavioralCount ?? 2;

  const rng = new Rng(config.seed);
  const math = buildMathSteps(rng, tier, mathCount);
  const brainteasers = buildBrainteaserSteps(rng, brainteaserCount);
  const marketMaking = buildMarketMakingSteps(rng, tier, marketMakingCount);
  const behavioral = selectBehavioral(rng, behavioralCount);

  const steps: MockStep[] = [
    ...math,
    ...brainteasers,
    ...marketMaking,
    ...behavioral,
  ];

  return {
    seed: config.seed,
    tier,
    intro:
      "Welcome — I'll be your interviewer today. We'll do a few mental-math " +
      "questions out loud (I'll press you with a follow-up on each), then " +
      "brainteasers under time, a market-making exercise where I trade against " +
      "your quotes, and finish with behavioral questions. Think out loud.",
    steps,
  };
}

/* -------------------------------------------------------------------------- */
/*  State machine (speech-agnostic → graceful degradation)                    */
/* -------------------------------------------------------------------------- */

export type SessionStatus = "intro" | "running" | "summary";
export type InputMode = "speech" | "typed";

export interface MockSession {
  script: MockScript;
  /** Whether the host reported SpeechRecognition support (decision input only). */
  speechSupported: boolean;
  status: SessionStatus;
  /** Index into `script.steps` while running. */
  index: number;
  /** In-memory responses keyed by step order. Transcripts stay transient here. */
  responses: MockResponse[];
}

export type MockAction =
  | { type: "start" }
  | {
      type: "recordMath";
      raw: string;
      viaSpeech: boolean;
      elapsedMs: number;
      /** The candidate's reasoning text (transient); optional. */
      reasoning?: string;
    }
  | {
      type: "recordReflect";
      raw: string;
      viaSpeech: boolean;
      selfAssessed?: "got" | "missed";
    }
  | {
      /** Attach a reasoning-quality grade (from AI or deterministic) to a step. */
      type: "applyReasoningGrade";
      stepId: string;
      grade: ReasoningGrade;
    }
  | {
      /**
       * Present one of the TWO sequential follow-ups (probe or adversarial) for a
       * math step. The presentation's `role` decides which slot it fills.
       */
      type: "askFollowup";
      stepId: string;
      followup: FollowupPresentation;
    }
  | {
      /** Record + deterministically grade a follow-up answer (by role). */
      type: "recordFollowup";
      stepId: string;
      role: FollowupRole;
      raw: string;
      viaSpeech: boolean;
      elapsedMs: number;
    }
  | {
      /**
       * Present the ONE clarifying follow-up for a MIXED / contradictory / hedged
       * answer. `target` is `"main"` (the main answer's reasoning) or a follow-up
       * role. Idempotent: never clobbers an already-answered clarify.
       */
      type: "askClarify";
      stepId: string;
      target: "main" | FollowupRole;
      prompt: string;
    }
  | {
      /**
       * Record + STRICTLY grade the clarification. There is exactly one clarify
       * round; a still-hedged/contradictory/wrong clarification is MISSED.
       */
      type: "recordClarify";
      stepId: string;
      target: "main" | FollowupRole;
      raw: string;
      viaSpeech: boolean;
      elapsedMs: number;
    }
  | {
      /** Resolve one market-making round against the deterministic bot. */
      type: "submitMmQuote";
      stepId: string;
      quote: Quote;
    }
  | { type: "next" }
  | { type: "restart" };

/**
 * The default INPUT MODE decision. When SpeechRecognition is unavailable (no
 * mic, SSR, test env) we fall back to typed entry — but the engine flow is
 * identical either way, so the drill stays fully usable. This is the single
 * graceful-degradation decision the UI consults.
 */
export function defaultInputMode(speechSupported: boolean): InputMode {
  return speechSupported ? "speech" : "typed";
}

/** Create a fresh session for a script. Starts on the intro screen. */
export function createSession(
  script: MockScript,
  opts?: { speechSupported?: boolean },
): MockSession {
  return {
    script,
    speechSupported: opts?.speechSupported ?? false,
    status: "intro",
    index: 0,
    responses: [],
  };
}

/** The step currently in focus, or `null` outside the running phase. */
export function currentStep(session: MockSession): MockStep | null {
  if (session.status !== "running") return null;
  return session.script.steps[session.index] ?? null;
}

/** Whether the current step already has a recorded response. */
export function isCurrentAnswered(session: MockSession): boolean {
  const step = currentStep(session);
  if (!step) return false;
  return session.responses.some((r) => r.stepId === step.id);
}

function withResponse(
  session: MockSession,
  response: MockResponse,
): MockSession {
  const responses = session.responses.filter(
    (r) => r.stepId !== response.stepId,
  );
  responses.push(response);
  return { ...session, responses };
}

/** Find a step by id (any stage). */
function stepById(session: MockSession, stepId: string): MockStep | undefined {
  return session.script.steps.find((s) => s.id === stepId);
}

/**
 * Immutably patch the existing response for `stepId`. Returns the session
 * unchanged when there is no response yet (patches only apply post-answer).
 */
function patchResponse(
  session: MockSession,
  stepId: string,
  patch: (r: MockResponse) => MockResponse,
): MockSession {
  const existing = session.responses.find((r) => r.stepId === stepId);
  if (!existing) return session;
  return withResponse(session, patch(existing));
}

/**
 * Pure reducer. Given a session and an action, returns the next session. Never
 * mutates its input and never touches storage/DOM.
 */
export function mockReducer(
  session: MockSession,
  action: MockAction,
): MockSession {
  switch (action.type) {
    case "start":
      return session.status === "intro"
        ? { ...session, status: "running", index: 0 }
        : session;

    case "recordMath": {
      const step = currentStep(session);
      if (!step || step.kind !== "math") return session;
      const score = scoreMathAnswer(step, action.raw, action.elapsedMs);
      return withResponse(session, {
        stepId: step.id,
        stage: "math",
        raw: action.raw,
        viaSpeech: action.viaSpeech,
        score,
        reasoningRaw: action.reasoning ?? "",
      });
    }

    case "recordReflect": {
      const step = currentStep(session);
      if (!step || step.kind === "math" || step.kind === "marketMaking")
        return session;
      return withResponse(session, {
        stepId: step.id,
        stage: step.kind,
        raw: action.raw,
        viaSpeech: action.viaSpeech,
        // A brainteaser's typed reasoning IS the thing we grade for quality.
        reasoningRaw: step.kind === "brainteaser" ? action.raw : undefined,
        selfAssessed:
          step.kind === "brainteaser" ? action.selfAssessed : undefined,
      });
    }

    case "applyReasoningGrade":
      return patchResponse(session, action.stepId, (r) => ({
        ...r,
        reasoningGrade: action.grade,
      }));

    case "askFollowup": {
      const step = stepById(session, action.stepId);
      if (!step || step.kind !== "math") return session;
      const role = action.followup.role;
      return patchResponse(session, action.stepId, (r) => {
        const existing = r.followups?.[role];
        // Don't clobber an already-answered follow-up of this role.
        if (existing?.graded) return r;
        return {
          ...r,
          followups: {
            ...r.followups,
            [role]: {
              presentation: action.followup,
              raw: "",
              viaSpeech: false,
              graded: false,
            },
          },
        };
      });
    }

    case "recordFollowup": {
      const role = action.role;
      return patchResponse(session, action.stepId, (r) => {
        const rec = r.followups?.[role];
        if (!rec || rec.graded) return r;
        const score =
          gradeFollowup(rec.presentation, action.raw, action.elapsedMs) ??
          undefined;
        return {
          ...r,
          followups: {
            ...r.followups,
            [role]: {
              ...rec,
              raw: action.raw,
              viaSpeech: action.viaSpeech,
              score,
              graded: true,
            },
          },
        };
      });
    }

    case "askClarify": {
      return patchResponse(session, action.stepId, (r) => {
        if (action.target === "main") {
          // Don't clobber an already-answered main clarify.
          if (r.clarify?.graded) return r;
          return {
            ...r,
            clarify: {
              prompt: action.prompt,
              raw: "",
              viaSpeech: false,
              graded: false,
            },
          };
        }
        const role = action.target;
        const rec = r.followups?.[role];
        if (!rec || rec.clarify?.graded) return r;
        return {
          ...r,
          followups: {
            ...r.followups,
            [role]: {
              ...rec,
              clarify: {
                prompt: action.prompt,
                raw: "",
                viaSpeech: false,
                graded: false,
              },
            },
          },
        };
      });
    }

    case "recordClarify": {
      const step = stepById(session, action.stepId);
      if (!step) return session;
      return patchResponse(session, action.stepId, (r) => {
        if (action.target === "main") {
          if (!r.clarify || r.clarify.graded) return r;
          // Grade the MAIN clarification strictly against the verified answer.
          const correctAnswer =
            step.kind === "math"
              ? String(step.answer)
              : step.kind === "brainteaser"
                ? step.answer
                : "";
          const targetMs =
            step.kind === "math"
              ? step.targetMs
              : step.kind === "brainteaser"
                ? step.timeLimitSec * 1000
                : 30000;
          const score = gradeMainClarification(
            correctAnswer,
            action.raw,
            action.elapsedMs,
            targetMs,
          );
          // Resolve the reasoning grade: a clean committed-correct clarification
          // upgrades the ambiguous reasoning to `sound`; otherwise it stays weak.
          const resolvedGrade: ReasoningGrade | undefined = r.reasoningGrade
            ? {
                ...r.reasoningGrade,
                quality: score.correct ? "sound" : r.reasoningGrade.quality,
              }
            : r.reasoningGrade;
          return {
            ...r,
            reasoningGrade: resolvedGrade,
            clarify: {
              ...r.clarify,
              raw: action.raw,
              viaSpeech: action.viaSpeech,
              graded: true,
              score,
            },
          };
        }
        const role = action.target;
        const rec = r.followups?.[role];
        if (!rec || !rec.clarify || rec.clarify.graded) return r;
        const cscore = gradeClarification(rec.presentation, action.raw, action.elapsedMs);
        // The clarification's verdict becomes the follow-up's effective result.
        const baseScore = rec.score;
        const nextScore: MathScore | undefined = baseScore
          ? {
              ...baseScore,
              correct: cscore.correct,
              score: cscore.score,
              verdict: cscore.correct ? "correct" : "missed",
              clarifyPrompt: undefined,
            }
          : cscore;
        return {
          ...r,
          followups: {
            ...r.followups,
            [role]: {
              ...rec,
              score: nextScore,
              clarify: {
                ...rec.clarify,
                raw: action.raw,
                viaSpeech: action.viaSpeech,
                graded: true,
                score: cscore,
              },
            },
          },
        };
      });
    }

    case "submitMmQuote": {
      const step = stepById(session, action.stepId);
      if (!step || step.kind !== "marketMaking") return session;
      const mmStep: MarketMakingStep = step;
      const existing = session.responses.find((r) => r.stepId === step.id);
      const prevState = existing?.mm ?? initMmState(mmStep);
      const nextState = playMmRound(mmStep, prevState, action.quote);
      // Rejected (invalid) quote or already-done → no state change → no-op.
      if (nextState === prevState) return session;
      return withResponse(session, {
        stepId: step.id,
        stage: "marketMaking",
        raw: existing?.raw ?? "",
        viaSpeech: false,
        reasoningRaw: existing?.reasoningRaw,
        reasoningGrade: existing?.reasoningGrade,
        followups: existing?.followups,
        mm: nextState,
      });
    }

    case "next": {
      if (session.status !== "running") return session;
      if (session.index >= session.script.steps.length - 1) {
        return { ...session, status: "summary" };
      }
      return { ...session, index: session.index + 1 };
    }

    case "restart":
      return createSession(session.script, {
        speechSupported: session.speechSupported,
      });

    default:
      return session;
  }
}

/* -------------------------------------------------------------------------- */
/*  PII-free summary                                                          */
/* -------------------------------------------------------------------------- */

/** PII-free per-follow-up verdict summary (verdict + clarify resolution). */
function followupVerdictSummary(rec: FollowupRecord): FollowupVerdictSummary {
  return {
    source: rec.presentation.source,
    correct: rec.score?.correct,
    graded: rec.graded,
    ...(rec.score?.verdict ? { verdict: rec.score.verdict } : {}),
    ...(rec.clarify
      ? {
          clarify: {
            asked: true,
            ...(rec.clarify.graded
              ? { resolved: !!rec.clarify.score?.correct }
              : {}),
          },
        }
      : {}),
  };
}

/**
 * Project a response to its PII-free, persistable form. Crucially, the raw
 * transcript (`raw`) is DROPPED — only structural/graded fields survive, so no
 * spoken or typed text can leak into any persisted/exported summary.
 */
export function toPersistableResponse(r: MockResponse): PersistableResponse {
  return {
    stepId: r.stepId,
    stage: r.stage,
    viaSpeech: r.viaSpeech,
    correct: r.score?.correct,
    timing: r.score?.timing,
    score: r.score?.score,
    selfAssessed: r.selfAssessed,
    // PII-free grades only — never the reasoning/follow-up transcript text.
    reasoningQuality: r.reasoningGrade?.quality,
    ...(r.clarify
      ? {
          clarify: {
            asked: true,
            ...(r.clarify.graded ? { resolved: !!r.clarify.score?.correct } : {}),
          },
        }
      : {}),
    followups: r.followups
      ? {
          ...(r.followups.probe
            ? { probe: followupVerdictSummary(r.followups.probe) }
            : {}),
          ...(r.followups.adversarial
            ? { adversarial: followupVerdictSummary(r.followups.adversarial) }
            : {}),
        }
      : undefined,
    mm: r.mm
      ? {
          pnl: r.mm.pnl,
          verdict: r.mm.verdict,
          picked: r.mm.picked,
          done: r.mm.done,
        }
      : undefined,
  };
}

/**
 * Build an aggregate, PII-free session summary. Safe to persist or export: it
 * contains counts and per-step verdicts only — never transcript text.
 */
export function toPersistableSummary(session: MockSession): MockSummary {
  const { script, responses } = session;
  const byId = new Map(responses.map((r) => [r.stepId, r]));

  const mathSteps = script.steps.filter((s) => s.kind === "math");
  const btSteps = script.steps.filter((s) => s.kind === "brainteaser");
  const bhvSteps = script.steps.filter((s) => s.kind === "behavioral");

  const mathResponses = mathSteps
    .map((s) => byId.get(s.id))
    .filter((r): r is MockResponse => !!r && !!r.score);
  const mathCorrect = mathResponses.filter((r) => r.score!.correct).length;
  const mathElapsed = mathResponses.map((r) => r.score!.elapsedMs);
  const mathAvgElapsedMs =
    mathElapsed.length > 0
      ? Math.round(mathElapsed.reduce((a, b) => a + b, 0) / mathElapsed.length)
      : null;

  const btGotIt = btSteps.filter(
    (s) => byId.get(s.id)?.selfAssessed === "got",
  ).length;
  const behavioralAnswered = bhvSteps.filter((s) => byId.has(s.id)).length;

  return {
    seed: script.seed,
    tier: script.tier,
    mathTotal: mathSteps.length,
    mathCorrect,
    mathAvgElapsedMs,
    brainteaserSeen: btSteps.length,
    brainteaserGotIt: btGotIt,
    behavioralAnswered,
    responses: responses.map(toPersistableResponse),
  };
}
