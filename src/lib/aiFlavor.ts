/**
 * aiFlavor.ts — the OPTIONAL LLM "flavor / open-ended" layer that sits ON TOP OF
 * the parametric generators + exact solvers. It NEVER computes or grades an
 * answer; the solver's answer stays the source of truth.
 *
 * Two modes:
 *  1. FLAVOR (primary, fully verifiable): given a parametrically-generated
 *     question — its exact numbers, its solver-computed answer, its options —
 *     the LLM rewrites ONLY the surface narrative. A programmatic GUARDRAIL
 *     (`verifyFlavor`) then confirms every required numeric quantity survived
 *     the rewrite unchanged; if the check fails we DISCARD the LLM text and fall
 *     back to the original parametric prompt. The answer/options/explanation are
 *     the ORIGINAL solver values — the client just swaps the prompt string. This
 *     yields infinite fresh-feeling variety with ZERO correctness risk.
 *  2. OPEN-ENDED (secondary, conservative, clearly labeled): the LLM proposes a
 *     brand-new question for a topic. Because arbitrary LLM math can't be
 *     trusted, the result is returned as a FLASHCARD (reveal answer +
 *     explanation) explicitly labeled "AI-generated — not verifier-checked" and
 *     is NEVER graded as authoritative.
 *
 * Everything is gated behind `VITE_AI_LAYER=on` (+ an endpoint). With the flag
 * off — the DEFAULT — every exported async function is a graceful no-op that
 * returns `null`, so the caller shows no button and nothing breaks. The LLM
 * provider API key lives ONLY in SSM Parameter Store, read by the Lambda; it is
 * never in this bundle. The client talks to the Lambda with plain `fetch` (no
 * SDK) and sends the Cognito JWT for auth.
 */
import type { Flashcard, NumericQuestion, Question } from "@/types/content";
import {
  aiLayerEnabled,
  readAiConfig,
  type AiConfig,
  type EnvLike,
} from "./aiConfig";
import { readAwsConfig } from "./awsConfig";

/* -------------------------------------------------------------------------- */
/*  Public result types                                                        */
/* -------------------------------------------------------------------------- */

/** A flavored MC question — identical math/options, only the prompt reskinned. */
export interface FlavoredVariant<Q extends Question | NumericQuestion> {
  /** Same-shape question; only `prompt` may differ from the original. */
  question: Q;
  /**
   * `"ai"`   — the LLM reskin passed the guardrail and is in use.
   * `"stub"` — local-dev stub returned the original prompt unchanged.
   * `"fallback"` — the LLM ran but its output FAILED the guardrail (or errored),
   *                so we discarded it and kept the original parametric prompt.
   */
  source: "ai" | "stub" | "fallback";
}

/**
 * A conservative, clearly-labeled open-ended item. It is ALWAYS surfaced as a
 * flashcard (reveal + self-assess), NEVER auto-graded. `verified` is always
 * `false` and `label` says so.
 */
export interface OpenEndedResult {
  card: Flashcard;
  verified: false;
  label: string;
}

/* -------------------------------------------------------------------------- */
/*  The GUARDRAIL — pure, unit-testable, the core correctness gate             */
/* -------------------------------------------------------------------------- */

/**
 * Extract the distinct numeric VALUES from a string, normalizing away `$`,
 * thousands separators, and a trailing `%`. "$1,000" and "1000" collapse to the
 * same value; "2.00" and "2" collapse to `2`. Returns canonical numeric strings
 * (via `Number`) so set-comparison is float-safe for the clean values these
 * generators produce.
 */
export function extractNumbers(text: string): string[] {
  const out: string[] = [];
  // Match an optional leading $, a digit run with optional thousands commas,
  // an optional decimal part, and an optional trailing %.
  const re = /\$?\s?(\d[\d,]*(?:\.\d+)?)\s?%?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1].replace(/,/g, "");
    const n = Number(raw);
    if (Number.isFinite(n)) out.push(String(n));
  }
  return out;
}

export interface GuardrailResult {
  ok: boolean;
  reason?: string;
  /** Required numbers that are MISSING from the candidate. */
  missing?: string[];
  /** Numbers the candidate INTRODUCED that weren't in the required set. */
  introduced?: string[];
}

export interface GuardrailOptions {
  /**
   * The numbers that MUST survive the rewrite. When omitted, they are derived
   * from `originalPrompt` (every number in the original prompt is required).
   */
  requiredNumbers?: string[];
  /**
   * When `true` (the DEFAULT — maximum safety), the candidate may not introduce
   * ANY numeric value that wasn't in the required set. A compliant reskin keeps
   * exactly the same numbers, so this rejects only outputs that invented/altered
   * a quantity — and a rejection just falls back to the (correct) original, so
   * strict-by-default costs us nothing but variety.
   */
  disallowNewNumbers?: boolean;
}

/**
 * The verifier gate. Confirms a reskinned prompt preserves the original math:
 * every required numeric quantity is still present and (by default) no new
 * number was introduced. If this returns `{ ok: false }`, the caller MUST
 * discard the LLM output and fall back to the original prompt.
 */
export function verifyFlavor(
  originalPrompt: string,
  candidate: string,
  opts: GuardrailOptions = {},
): GuardrailResult {
  const disallowNewNumbers = opts.disallowNewNumbers ?? true;
  const required = new Set(
    opts.requiredNumbers ?? extractNumbers(originalPrompt),
  );
  const candidateNums = new Set(extractNumbers(candidate));

  if (!candidate || candidate.trim().length === 0) {
    return { ok: false, reason: "empty candidate" };
  }

  const missing = [...required].filter((n) => !candidateNums.has(n));
  if (missing.length > 0) {
    return { ok: false, reason: "missing required number(s)", missing };
  }

  if (disallowNewNumbers) {
    const introduced = [...candidateNums].filter((n) => !required.has(n));
    if (introduced.length > 0) {
      return { ok: false, reason: "introduced new number(s)", introduced };
    }
  }

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Env plumbing (read import.meta.env lazily; nothing runs at module load)    */
/* -------------------------------------------------------------------------- */

function env(): EnvLike {
  // `import.meta.env` is defined by Vite (and vitest). Kept behind a function so
  // module import has no side effects and tests can exercise the pure helpers.
  return import.meta.env as unknown as EnvLike;
}

/** True iff the optional AI layer is switched on (the button may appear). */
export function isAiLayerEnabled(): boolean {
  return aiLayerEnabled(env());
}

/**
 * Best-effort read of the current Cognito ID token from the localStorage keys
 * that `awsStorage.ts` writes. We DON'T import storage internals (owned by
 * another workstream); we only read the well-known public token locations using
 * the client id from `awsConfig`. Returns `null` when unauthenticated.
 */
function readCognitoIdToken(e: EnvLike): string | null {
  if (typeof localStorage === "undefined") return null;
  const get = (k: string): string | null => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  // Google OAuth session (see awsStorage OAUTH_* keys).
  const oauthTok = get("qtp.aws.oauth.idToken");
  const oauthExp = Number(get("qtp.aws.oauth.exp") ?? "0");
  if (oauthTok && oauthExp > Date.now()) return oauthTok;

  // Password session managed by amazon-cognito-identity-js.
  const cfg = readAwsConfig(e);
  const clientId = cfg?.userPoolClientId;
  if (!clientId) return null;
  const last = get(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`);
  if (!last) return null;
  return get(`CognitoIdentityServiceProvider.${clientId}.${last}.idToken`);
}

async function postAi(
  cfg: AiConfig,
  e: EnvLike,
  body: unknown,
): Promise<Record<string, unknown> | null> {
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    const token = readCognitoIdToken(e);
    if (token) headers["authorization"] = token;
    const res = await fetch(`${cfg.endpoint}/ai`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[ai] endpoint returned ${res.status}; falling back.`);
      return null;
    }
    return (await res.json()) as Record<string, unknown>;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[ai] request failed; falling back:", err);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Mode 1 — FLAVOR (verifier-gated reskin of a parametric question)           */
/* -------------------------------------------------------------------------- */

export interface FlavorOptions {
  /** Override the guardrail's "no new numbers" strictness (default: strict). */
  disallowNewNumbers?: boolean;
  /** Optional AbortSignal to cancel the request. */
  signal?: AbortSignal;
}

/**
 * Request an LLM-reskinned variant of a PARAMETRICALLY-generated question. The
 * LLM only rewrites the narrative; the answer, options, distractors, and
 * explanation stay the ORIGINAL solver values. The reskinned prompt is passed
 * through `verifyFlavor` — on failure we DISCARD it and return the original
 * prompt (`source: "fallback"`).
 *
 * Returns `null` when the AI layer is off / unconfigured (graceful no-op — the
 * caller should show no button).
 */
export async function requestFlavoredVariant<
  Q extends Question | NumericQuestion,
>(question: Q, opts: FlavorOptions = {}): Promise<FlavoredVariant<Q> | null> {
  const e = env();
  const cfg = readAiConfig(e);
  if (!cfg) return null; // flag off or unconfigured → no-op

  const original = question.prompt;
  const requiredNumbers = extractNumbers(original);

  // Local-dev stub: never touch the network; return the prompt unchanged.
  if (cfg.stub) {
    return { question, source: "stub" };
  }

  // MC choices (if any) are passed for context only — the LLM must not touch
  // them; the client keeps the original options/answer verbatim.
  const choices = "choices" in question ? question.choices : undefined;

  const payload = await postAi(cfg, e, {
    mode: "flavor",
    prompt: original,
    concept: question.concept ?? null,
    requiredNumbers,
    choices,
  });

  const candidate =
    payload && typeof payload["prompt"] === "string"
      ? (payload["prompt"] as string)
      : null;

  if (!candidate) {
    // No usable output → keep the correct original prompt.
    return { question, source: "fallback" };
  }

  const check = verifyFlavor(original, candidate, {
    requiredNumbers,
    disallowNewNumbers: opts.disallowNewNumbers,
  });
  if (!check.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[ai] flavor guardrail rejected output: ${check.reason}`);
    return { question, source: "fallback" };
  }

  // Passed: swap ONLY the prompt; everything else is the solver's truth.
  return { question: { ...question, prompt: candidate }, source: "ai" };
}

/* -------------------------------------------------------------------------- */
/*  Mode 2 — OPEN-ENDED (conservative, flashcard, clearly labeled)             */
/* -------------------------------------------------------------------------- */

export const AI_OPEN_ENDED_LABEL = "AI-generated — not verifier-checked";

export interface OpenEndedOptions {
  signal?: AbortSignal;
}

/**
 * Ask the LLM to propose a NEW open-ended question for a topic/section. Because
 * arbitrary LLM math is untrusted, the result is ALWAYS returned as a flashcard
 * (reveal answer + explanation) explicitly labeled and NEVER auto-graded.
 *
 * Returns `null` when the AI layer is off / unconfigured, or when the response
 * is unusable.
 */
export async function requestOpenEndedQuestion(
  topicSection: string,
  _opts: OpenEndedOptions = {},
): Promise<OpenEndedResult | null> {
  const e = env();
  const cfg = readAiConfig(e);
  if (!cfg) return null;

  if (cfg.stub) return null; // nothing meaningful to stub for a brand-new item

  const payload = await postAi(cfg, e, {
    mode: "open-ended",
    topic: topicSection,
  });
  if (!payload) return null;

  const prompt = typeof payload["prompt"] === "string" ? payload["prompt"] : "";
  const answer = typeof payload["answer"] === "string" ? payload["answer"] : "";
  const explanation =
    typeof payload["explanation"] === "string" ? payload["explanation"] : "";
  if (!prompt || !answer) return null;

  const card: Flashcard = {
    id: `ai-open-${Date.now()}`,
    prompt,
    answer,
    explanation: explanation || answer,
    difficulty: "medium",
    concept: topicSection,
    needsVerification: true, // NEVER treated as verifier-checked truth
    source: AI_OPEN_ENDED_LABEL,
  };
  return { card, verified: false, label: AI_OPEN_ENDED_LABEL };
}
