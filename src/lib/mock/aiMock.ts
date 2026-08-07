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
 * The three modes:
 *   • `gradeReasoning`   → `mock-reason-grade`  (reasoning quality only)
 *   • `generateFollowup` → `mock-followup`      (adaptive adversarial follow-up)
 *   • `getDiagnosis`     → `mock-diagnosis`      (final brutal prose)
 */
import { readAiConfig } from "@/lib/aiConfig";
import { env, postAi } from "@/lib/aiFlavor";
import {
  gradeReasoningDeterministic,
  normalizeReasoningPayload,
  type ReasoningInput,
} from "./reasoning";
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
 * Grade reasoning QUALITY. The verifier's `correct` verdict is passed straight
 * through and is authoritative; the LLM only judges quality/issues/probe and can
 * never contradict it (the response schema has no correctness field, and we never
 * read one). Falls back to the deterministic structural grader on any failure.
 */
export async function gradeReasoning(
  input: ReasoningInput,
  opts: { concept?: string; signal?: AbortSignal } = {},
): Promise<ReasoningGrade> {
  const fallback = gradeReasoningDeterministic(input);

  const e = env();
  const cfg = readAiConfig(e);
  if (!cfg || cfg.stub) return fallback;

  const payload = await postAi(
    cfg,
    e,
    {
      mode: "mock-reason-grade",
      prompt: input.prompt,
      correctAnswer: input.correctAnswer,
      correct: input.correct, // AUTHORITATIVE context; model may not contradict
      reasoning: input.reasoning,
      concept: opts.concept ?? null,
      isMentalMath: input.isMentalMath === true,
    },
    opts.signal,
  );
  if (!payload) return fallback;
  return normalizeReasoningPayload(payload);
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
