import { Rng } from "@/lib/rng";
import type { NumericQuestion } from "@/types/content";
import {
  MM_EASY_NUMERIC,
  MM_HARD_NUMERIC,
  MM_MEDIUM_NUMERIC,
} from "@/content/mentalMath/generators";
import { ALL_BRAINTEASER_FAMILIES } from "@/content/brainteasers/generators";
import { scoreMathAnswer } from "./scoring";
import { selectBehavioral } from "./behavioral";
import type {
  BrainteaserStep,
  MathStep,
  MathTier,
  MockConfig,
  MockResponse,
  MockScript,
  MockStep,
  MockSummary,
  PersistableResponse,
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

const MATH_POOLS: Record<MathTier, ((rng: Rng) => NumericQuestion)[]> = {
  easy: MM_EASY_NUMERIC,
  medium: MM_MEDIUM_NUMERIC,
  hard: MM_HARD_NUMERIC,
};

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

function buildMathSteps(rng: Rng, tier: MathTier, count: number): MathStep[] {
  const pool = MATH_POOLS[tier];
  const steps: MathStep[] = [];
  for (let i = 0; i < count; i++) {
    const gen = rng.pick(pool);
    const q = gen(rng);
    const followUps = rng.shuffle(MATH_PROBES).slice(0, 2);
    steps.push({
      kind: "math",
      id: `mock-math-${i}-${q.id}`,
      prompt: q.prompt.replace(/\s*\(Enter[^)]*\)\s*$/, "").trim(),
      answer: q.answer,
      decimals: q.decimals,
      concept: q.concept,
      explanation: q.explanation,
      commonErrors: q.commonErrors,
      followUps,
      targetMs: TARGET_MS[tier],
      source: q.source,
    });
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
      probes,
      timeLimitSec: card.difficulty === "hard" ? 180 : 120,
      source: card.source,
    });
  }
  return steps;
}

/**
 * Build a deterministic interview script from a config. Order is fixed:
 * math → brainteasers → behavioral, matching a real screen's arc.
 */
export function buildInterview(config: MockConfig): MockScript {
  const tier = config.tier ?? "medium";
  const mathCount = config.mathCount ?? 3;
  const brainteaserCount = config.brainteaserCount ?? 2;
  const behavioralCount = config.behavioralCount ?? 2;

  const rng = new Rng(config.seed);
  const math = buildMathSteps(rng, tier, mathCount);
  const brainteasers = buildBrainteaserSteps(rng, brainteaserCount);
  const behavioral = selectBehavioral(rng, behavioralCount);

  const steps: MockStep[] = [...math, ...brainteasers, ...behavioral];

  return {
    seed: config.seed,
    tier,
    intro:
      "Welcome — I'll be your interviewer today. We'll do a few mental-math " +
      "questions out loud, then a couple of brainteasers under time, and finish " +
      "with some quick behavioral questions. Think out loud; take your time.",
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
    }
  | {
      type: "recordReflect";
      raw: string;
      viaSpeech: boolean;
      selfAssessed?: "got" | "missed";
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
      });
    }

    case "recordReflect": {
      const step = currentStep(session);
      if (!step || step.kind === "math") return session;
      return withResponse(session, {
        stepId: step.id,
        stage: step.kind,
        raw: action.raw,
        viaSpeech: action.viaSpeech,
        selfAssessed:
          step.kind === "brainteaser" ? action.selfAssessed : undefined,
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
