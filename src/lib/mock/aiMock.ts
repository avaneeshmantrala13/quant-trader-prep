/**
 * mock/aiMock.ts — the CLIENT-SIDE AI helper for the mock interview.
 *
 * This is the ONLY mock module that touches the network / env. The pure engine
 * (`engine.ts` and friends) never imports it, so the engine stays framework- and
 * network-free. Each function calls the AI Lambda per `datasets/MOCK_AI_CONTRACT.md`
 * and falls back to the DETERMINISTIC pure implementation when the AI layer is
 * off / stubbed / unreachable or returns something unusable. Nothing here can
 * ever decide correctness — that always comes from the verifier, passed in.
 *
 * The modes:
 *   • `gradeReasoning`   → `mock-extract-claims` (EXTRACT-AND-VERIFY: the LLM only
 *                           TRANSLATES the reasoning into structured claims; the
 *                           QUALITY VERDICT is computed DETERMINISTICALLY from
 *                           those claims by `./claims`. The LLM never judges.)
 *   • `generateFollowup` → `mock-followup`       (adaptive adversarial follow-up)
 *   • `getDiagnosis`     → `mock-diagnosis`       (final brutal prose)
 */
import { readAiConfig } from "@/lib/aiConfig";
import { env, postAi } from "@/lib/aiFlavor";
import {
  gradeReasoningDeterministic,
  type ReasoningInput,
} from "./reasoning";
import {
  extractClaimsDeterministic,
  gradeReasoningFromClaims,
  normalizeClaimsPayload,
  type ClaimSet,
} from "./claims";
import { buildAiFollowup } from "./followups";
import {
  deterministicDiagnosis,
  floorDiagnosis,
  normalizeDiagnosisPayload,
} from "./diagnosis";
import type {
  FollowupPresentation,
  MockDiagnosis,
  MockPerformance,
  ReasoningGrade,
} from "./types";

/**
 * EXTRACT the candidate's free-text reasoning into a STRUCTURED list of claims.
 * The LLM's ONLY job is translation (text → claims): intermediate arithmetic,
 * the asserted final answer, and the method/mechanism invoked. It is explicitly
 * NOT asked to judge correctness. Falls back to the deterministic extractor when
 * the AI layer is off / stubbed / unreachable or returns nothing usable, so a
 * `ClaimSet` is ALWAYS returned.
 */
export async function extractReasoningClaims(
  input: ReasoningInput,
  opts: { concept?: string; signal?: AbortSignal } = {},
): Promise<ClaimSet> {
  const fallback = extractClaimsDeterministic(input.reasoning, {
    mechanismSignals: input.mechanismSignals,
  });

  const e = env();
  const cfg = readAiConfig(e);
  if (!cfg || cfg.stub) return fallback;

  const payload = await postAi(
    cfg,
    e,
    {
      mode: "mock-extract-claims",
      prompt: input.prompt,
      correctAnswer: input.correctAnswer,
      reasoning: input.reasoning,
      concept: opts.concept ?? null,
    },
    opts.signal,
  );
  if (!payload) return fallback;
  const ai = normalizeClaimsPayload(payload);
  // If the model returned nothing usable, keep the deterministic claims so the
  // verifier still has structured facts to check.
  return ai.claims.length > 0 ? ai : fallback;
}

/**
 * Grade reasoning QUALITY via EXTRACT-AND-VERIFY. The LLM (when available) only
 * TRANSLATES the reasoning into claims (`extractReasoningClaims`); the VERDICT is
 * then computed 100% DETERMINISTICALLY from those claims against the problem's
 * computable truth (`gradeReasoningFromClaims`). The verifier's `correct` verdict
 * is authoritative and is never re-decided by the model. With the AI layer off,
 * the claims are extracted deterministically and the result is byte-identical to
 * `gradeReasoningDeterministic` (the tested fallback) — no regression.
 */
export async function gradeReasoning(
  input: ReasoningInput,
  opts: { concept?: string; signal?: AbortSignal } = {},
): Promise<ReasoningGrade> {
  const e = env();
  const cfg = readAiConfig(e);
  // Fast path: AI off/stubbed → skip extraction entirely and use the tested
  // deterministic verdict directly.
  if (!cfg || cfg.stub) return gradeReasoningDeterministic(input);

  const claimSet = await extractReasoningClaims(input, opts);
  return gradeReasoningFromClaims(input, claimSet);
}

/**
 * Generate the adaptive adversarial follow-up. On AI failure (or an empty
 * `question`) returns the deterministic `authored` follow-up so the flow always
 * has a real, gradable question.
 */
export async function generateFollowup(
  args: {
    prompt: string;
    correctAnswer: string;
    reasoning?: string;
    concept?: string;
    difficulty?: "harder" | "variation" | "break-logic";
    authored: FollowupPresentation;
  },
  signal?: AbortSignal,
): Promise<FollowupPresentation> {
  const e = env();
  const cfg = readAiConfig(e);
  if (!cfg || cfg.stub) return args.authored;

  const payload = await postAi(
    cfg,
    e,
    {
      mode: "mock-followup",
      prompt: args.prompt,
      correctAnswer: args.correctAnswer,
      reasoning: args.reasoning ?? "",
      concept: args.concept ?? null,
      difficulty: args.difficulty ?? "harder",
    },
    signal,
  );
  // buildAiFollowup falls back to `authored` when the payload lacks a question.
  return buildAiFollowup(args.authored, payload);
}

/**
 * Get the final diagnosis. The CLIENT computes every number in `perf`; the LLM
 * only turns them into prose. Falls back to the deterministic diagnosis on any
 * failure, and any missing field is filled with the contract's safe default.
 */
export async function getDiagnosis(
  perf: MockPerformance,
  signal?: AbortSignal,
): Promise<MockDiagnosis> {
  const fallback = deterministicDiagnosis(perf);

  const e = env();
  const cfg = readAiConfig(e);
  if (!cfg || cfg.stub) return fallback;

  const payload = await postAi(
    cfg,
    e,
    { mode: "mock-diagnosis", summary: perf },
    signal,
  );
  if (!payload) return fallback;

  // Floor to the deterministic diagnosis FIELD-BY-FIELD: a partial/verdict-only
  // AI reply (empty strengths/weaknesses/next-steps) is completed from the
  // deterministic floor so the candidate always gets a complete report.
  const parsed = normalizeDiagnosisPayload(payload);
  return floorDiagnosis(parsed, fallback);
}
