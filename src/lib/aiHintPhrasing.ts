/**
 * aiHintPhrasing.ts — the OPTIONAL LLM "hint phrasing" wrapper (PHASE_7 §3/§5).
 *
 * The Phase-2 hint ladder (`buildHintLadder`) is 100% deterministic: it CHOOSES
 * the hint logic, the rung order, and WITHHOLDS the final answer until rung 5.
 * This wrapper does exactly ONE thing: when the AI layer is switched on, it asks
 * the server to rephrase a single rung's WORDING for tone/clarity — it never
 * chooses which rung, never reorders, and (re-guarded on both ends) never lets
 * the answer leak. On the flag being off, a null/errored response, or a
 * guardrail-rejected rephrase, it returns the ORIGINAL deterministic rung text
 * verbatim. The deterministic rung ALWAYS wins.
 *
 * Research anchor (RESEARCH_ML_USAGE.md §1.9): LearnLM ≈/> human tutors at the
 * "language end" (hint phrasing / scaffolding), so the LLM earns its keep on
 * WORDING; but because LLMs are unreliable at the math/logic end, the logic and
 * the answer-withholding stay with the deterministic verifier.
 *
 * Everything is gated behind `VITE_AI_LAYER=on` (+ endpoint). With the flag off
 * — the DEFAULT — `requestHintPhrasing` is a graceful no-op returning the input
 * rung text, so the hint ladder looks and works exactly as it does today.
 */
import { readAiConfig } from "./aiConfig";
import { env, extractNumbers, postAi, verifyHint } from "./aiFlavor";

/** A Phase-2 hint rung reduced to what the phrasing layer needs. */
export interface HintPhrasingInput {
  /** The deterministic rung text to rephrase (the fallback, always returned on failure). */
  text: string;
  /** The item's final answer — used ONLY by the no-final-answer guard; never sent to be shown. */
  answer: number | string;
}

export interface HintPhrasingOptions {
  signal?: AbortSignal;
}

/**
 * Rephrase a Phase-2 hint rung's WORDING (never its logic). Returns the ORIGINAL
 * `rung.text` unchanged on any of: the AI layer being off/unconfigured, the stub
 * sub-mode, a null/errored response, or a rephrase that fails the client-side
 * re-guard (`verifyHint`: it changed a number OR leaked the answer). The rung's
 * chosen logic/order and its answer-withholding are ALWAYS the deterministic
 * Phase-2 ladder's — this only ever swaps the surface phrasing.
 */
export async function requestHintPhrasing(
  rung: HintPhrasingInput,
  opts: HintPhrasingOptions = {},
): Promise<string> {
  const e = env();
  const cfg = readAiConfig(e);
  // Flag off / unconfigured → graceful no-op: the deterministic rung wins.
  if (!cfg) return rung.text;

  // Local-dev stub: never hit the network; keep the original rung text.
  if (cfg.stub) return rung.text;

  const requiredNumbers = extractNumbers(rung.text);

  const payload = await postAi(
    cfg,
    e,
    {
      mode: "hint",
      // Send the rung wording + the context numbers the rephrase must preserve.
      // The `answer` is sent for the SERVER's no-final-answer guard only.
      rung: rung.text,
      answer: rung.answer,
      requiredNumbers,
    },
    opts.signal,
  );

  const candidate =
    payload && typeof payload["hint"] === "string"
      ? (payload["hint"] as string)
      : null;
  if (!candidate) return rung.text; // no usable output → keep the original rung

  // Defense in depth: re-run the authoritative guard on the client too. A
  // rephrase that changed a context number or leaked the answer is discarded.
  const check = verifyHint(rung.text, candidate, {
    answer: rung.answer,
    requiredNumbers,
  });
  if (!check.ok) {
     
    console.warn(`[ai] hint guardrail rejected rephrase: ${check.reason}`);
    return rung.text;
  }

  return candidate;
}
